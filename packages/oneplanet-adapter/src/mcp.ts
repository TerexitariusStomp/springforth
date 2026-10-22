import type { ExternalPlan } from '@springforth/coordination';
import { normalizePlan } from './index.js';

// OnePlanet MCP client — Streamable HTTP transport.
// Server accepts JSON-RPC POSTs; responds with application/json OR
// text/event-stream (one SSE `data:` JSON-RPC message per line block).
// A `mcp-session-id` response header must be echoed on later requests.
// Endpoint: https://mcp.oneplanet.com/mcp · auth: Bearer <opk_…>

const PROTOCOL_VERSION = '2025-06-18';

type Json = Record<string, unknown>;
export type McpFetch = (url: string, init: RequestInit) => Promise<Response>;

async function rpc(url: string, key: string, method: string, params: Json | undefined,
  sessionId: { id?: string }, fetchFn: McpFetch): Promise<Json> {
  const isNotif = method.startsWith('notifications/');
  const body = { jsonrpc: '2.0', ...(isNotif ? {} : { id: 1 }), method, ...(params ? { params } : {}) };
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(sessionId.id ? { 'mcp-session-id': sessionId.id } : {}),
    },
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId.id = sid;
  if (!res.ok) throw new Error(`mcp ${res.status} ${method}`);
  if (isNotif || res.status === 202) return {};
  const ct = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (ct.includes('text/event-stream')) {
    // collect every JSON-RPC message in the stream; result = the one with an id
    let out: Json = {};
    for (const m of text.matchAll(/^data:\s*(\{.*\})\s*$/gm)) {
      const msg = JSON.parse(m[1]!) as Json;
      if (msg.id !== undefined) out = msg;
    }
    if (Object.keys(out).length) return out;
    throw new Error(`mcp empty stream ${method}`);
  }
  return JSON.parse(text) as Json;
}

export interface McpTool { name: string; description?: string; inputSchema?: Json }

export class OnePlanetMcp {
  private session: { id?: string } = {};
  private ready: Promise<void>;
  constructor(private url: string, private key: string, private fetchFn: McpFetch = fetch) {
    this.url = url.replace(/\/$/, '');
    this.ready = rpc(this.url, key, 'initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'springforth', version: '0.1.0' },
    }, this.session, fetchFn).then((r) =>
      rpc(this.url, key, 'notifications/initialized', undefined, this.session, fetchFn).then(() => void r));
  }
  async listTools(): Promise<McpTool[]> {
    await this.ready;
    const r = await rpc(this.url, this.key, 'tools/list', {}, this.session, this.fetchFn);
    return ((r.result as Json | undefined)?.tools as McpTool[] | undefined) ?? [];
  }
  async callTool(name: string, args: Json): Promise<unknown> {
    await this.ready;
    const r = await rpc(this.url, this.key, 'tools/call', { name, arguments: args }, this.session, this.fetchFn);
    const result = r.result as Json | undefined;
    if (result?.isError) throw new Error(`mcp tool error: ${JSON.stringify(result.content).slice(0, 200)}`);
    // MCP content blocks → unwrap text payloads; JSON-looking text parsed
    const content = (result?.content as { type: string; text?: string }[] | undefined) ?? [];
    const texts = content.filter((c) => c.type === 'text' && c.text).map((c) => c.text!);
    const joined = texts.join('\n');
    try { return JSON.parse(joined); } catch { return joined || result; }
  }
}

// OnePlanet exposes OAIs (Outcomes / Actions / Indicators) via
// `query_plan_oais` — items carry { uuid, name, description, label, due_date,
// status }. Verified live against mcp.oneplanet.com/mcp (SFLive sandbox).
const OAI_PAT = /oai|plan.*content|list_connections/i;
const READ_PAT = /(get|read|fetch|show|view).*(plan|workspace|node|outcome|action)/i;
const LIST_PAT = /(list|all|plans)/i;
const SEARCH_PAT = /(search|find|query|ask)/i;

const OAI_KIND: Record<string, 'outcomes' | 'actions' | 'indicators'> = {
  outcome: 'outcomes', action: 'actions', indicator: 'indicators' };

// OAI item → the per-collection shape normalizePlan already consumes.
function toOpPlan(planId: string, items: Json[]): Json {
  const plan: Json & { outcomes: Json[]; actions: Json[]; indicators: Json[];
    organisations: Json[]; places: Json[]; frameworks: Json[] } = {
    id: planId, outcomes: [], actions: [], indicators: [],
    organisations: [], places: [], frameworks: [] };
  for (const it of items) {
    const bucket = OAI_KIND[String(it.label ?? '').toLowerCase()];
    if (!bucket) continue;
    plan[bucket].push({
      id: it.uuid ?? it.id, title: it.name ?? it.title,
      description: it.description, endDate: it.due_date ?? undefined,
    });
  }
  return plan;
}

export async function fetchPlanMcp(url: string, key: string, planId: string,
  fetchFn: McpFetch = fetch): Promise<ExternalPlan> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  const tools = await mcp.listTools();
  const pick = (pat: RegExp) => tools.find((t) => pat.test(t.name) || pat.test(t.description ?? ''));

  // Fast path — the real OAI listing tool; returns the node array directly.
  // Name match first: descriptions mention OAIs broadly and would catch
  // e.g. list_workspaces before query_plan_oais.
  const oai = tools.find((t) => /oai/i.test(t.name)) ?? pick(OAI_PAT);
  if (oai) {
    for (const args of [{ plan_uuid: planId, limit: 100 }, { planId, limit: 100 },
      { plan_id: planId, limit: 100 }, { uuid: planId, limit: 100 }]) {
      try {
        const data = await mcp.callTool(oai.name, args) as Json;
        const items = (data?.items ?? data?.results ?? data) as Json[];
        if (Array.isArray(items) && items.length)
          return normalizePlan(toOpPlan(planId, items), 'oneplanet-mcp');
      } catch { /* try next arg shape */ }
    }
  }

  // Fallback — adaptive discovery over whatever read/search tools exist.
  const reader = pick(READ_PAT) ?? pick(LIST_PAT) ?? pick(SEARCH_PAT);
  if (!reader) throw new Error('mcp: no plan/query tools exposed');
  let data: unknown;
  for (const args of [{ id: planId }, { planId }, { plan_id: planId }, { plan_uuid: planId }, { query: planId }, { q: planId }]) {
    try { data = await mcp.callTool(reader.name, args); break; } catch { /* try next arg shape */ }
  }
  if (data === undefined) data = await mcp.callTool(reader.name, { query: planId });
  const d = data as Json | Json[];
  const obj = Array.isArray(d)
    ? (d.find((x) => String(x.id ?? x.planId ?? '') === planId) ?? d[0])
    : d;
  const plan = ((obj as Json)?.plan ?? obj) as Json;
  // a summary/envelope may still wrap items — surface them if present
  const items = (plan.items ?? plan.oais ?? plan.results) as Json[] | undefined;
  if (Array.isArray(items) && items.length)
    return normalizePlan(toOpPlan(planId, items), 'oneplanet-mcp');
  return normalizePlan({ id: planId, ...plan }, 'oneplanet-mcp');
}
