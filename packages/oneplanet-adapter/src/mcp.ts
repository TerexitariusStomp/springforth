import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ExternalPlan } from '@springforth/coordination';
import { normalizePlan } from './index.js';

// OnePlanet MCP client — official SDK over Streamable HTTP transport.
// The SDK handles protocol-version negotiation, mcp-session-id echo, and
// SSE/JSON response framing. Endpoint: https://mcp.oneplanet.com/mcp ·
// auth: Bearer <opk_…>

type Json = Record<string, unknown>;
export type McpFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface McpTool { name: string; description?: string; inputSchema?: Json }

export class OnePlanetMcp {
  private ready: Promise<void>;
  private client: Client;
  constructor(url: string, key: string, fetchFn: McpFetch = fetch) {
    const transport = new StreamableHTTPClientTransport(
      new URL(url.replace(/\/$/, '')), {
        requestInit: { headers: { authorization: `Bearer ${key}` } },
        fetch: (u, i) => fetchFn(String(u), i ?? {}) as Promise<Response>,
      });
    this.client = new Client({ name: 'springforth', version: '0.1.0' });
    this.ready = this.client.connect(transport).then(() => undefined);
  }
  async listTools(): Promise<McpTool[]> {
    await this.ready;
    return ((await this.client.listTools()).tools ?? []) as McpTool[];
  }
  async callTool(name: string, args: Json): Promise<unknown> {
    await this.ready;
    const result = await this.client.callTool({ name, arguments: args }) as Json;
    if (result.isError) throw new Error(`mcp tool error: ${JSON.stringify(result.content).slice(0, 200)}`);
    const content = (result.content as { type: string; text?: string }[] | undefined) ?? [];
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
function toOpPlan(planId: string, items: Json[], title?: string): Json {
  const plan: Json & { outcomes: Json[]; actions: Json[]; indicators: Json[];
    organisations: Json[]; places: Json[]; frameworks: Json[] } = {
    id: planId, ...(title ? { title } : {}),
    outcomes: [], actions: [], indicators: [],
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

  // Resolve the plan's display name: list workspaces, then plans in each
  // until the uuid matches. Both tools are key-accessible.
  let planTitle: string | undefined;
  const wsTool = tools.find((t) => /^list_workspaces$/i.test(t.name));
  const lpTool = tools.find((t) => /list_workspace_plans/i.test(t.name));
  if (wsTool && lpTool) {
    try {
      const wl = await mcp.callTool(wsTool.name, {}) as Json;
      for (const w of ((wl?.items ?? []) as Json[])) {
        const pl = await mcp.callTool(lpTool.name, { workspace_uuid: w.uuid }) as Json;
        const hit = ((pl?.items ?? []) as Json[]).find((p) => p.uuid === planId);
        if (hit?.name) { planTitle = String(hit.name); break; }
      }
    } catch { /* title optional */ }
  }

  // Fast path — the real OAI listing tool; returns the node array directly.
  // Name match first: descriptions mention OAIs broadly and would catch
  // e.g. list_workspaces before query_plan_oais.
  const oai = tools.find((t) => /oai/i.test(t.name)) ?? pick(OAI_PAT);
  if (oai) {
    // page through the plan — the API caps at 100 items per call
    const page = async (base: Json) => {
      const items: Json[] = []; let more = true;
      for (let offset = 0; more && offset < 2000; offset += 100) {
        const data = await mcp.callTool(oai.name, { ...base, limit: 100, offset }) as Json;
        const page = (data?.items ?? data?.results ?? data) as Json[];
        if (!Array.isArray(page) || !page.length) break;
        items.push(...page);
        more = Boolean((data as Json)?.has_more);
      }
      return items;
    };
    for (const args of [{ plan_uuid: planId }, { planId }, { plan_id: planId }, { uuid: planId }]) {
      try {
        const items = await page(args);
        if (items.length)
          return normalizePlan(toOpPlan(planId, items, planTitle), 'oneplanet-mcp');
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

// ── Write lane ─────────────────────────────────────────────────────────
// Write-capable keys expose create_* tools. There is no create_plan, so
// publishing targets an existing plan_uuid in the bound workspace.
// PlanNode kind → OAI kind: outcome/framework → Outcome, indicator →
// Indicator, action/need/offer → Action (kind is preserved in the
// description so the semantic survives the narrower vocabulary).
// organisation/place have no OAI counterpart — skipped, reported.

import type { PlanNode } from '@springforth/coordination';

const PUSH_TOOL: Partial<Record<PlanNode['kind'], string>> = {
  outcome: 'create_outcome', framework: 'create_outcome',
  action: 'create_action', need: 'create_action', offer: 'create_action',
  indicator: 'create_indicator',
};

export interface PushResult {
  nodeId: string; tool?: string; oaiUuid?: string;
  error?: string; skipped?: string;
}

type ToolCaller = { callTool(name: string, args: Json): Promise<unknown> };

const oaiUuidOf = (r: unknown): string | undefined => {
  const d = r as Json;
  const uuid = d?.uuid ?? d?.oai_uuid ?? (d?.item as Json | undefined)?.uuid
    ?? (d?.oai as Json | undefined)?.uuid;
  return uuid ? String(uuid) : undefined;
};

export async function pushNodesWith(
  mcp: ToolCaller, planUuid: string, nodes: PlanNode[],
): Promise<PushResult[]> {
  const out: PushResult[] = [];
  for (const n of nodes) {
    const tool = PUSH_TOOL[n.kind];
    if (!tool) { out.push({ nodeId: n.id, skipped: `no OAI kind for ${n.kind}` }); continue; }
    try {
      const description = [
        n.kind !== 'action' ? `[springforth ${n.kind}]` : '[springforth]',
        n.description,
        `node: ${n.id}`,
      ].filter(Boolean).join(' — ').slice(0, 800);
      const r = await mcp.callTool(tool, {
        plan_uuid: planUuid,
        name: (n.label || n.id).slice(0, 250),
        description,
      });
      out.push({ nodeId: n.id, tool, oaiUuid: oaiUuidOf(r) });
    } catch (e) {
      out.push({ nodeId: n.id, tool, error: String(e).slice(0, 160) });
    }
  }
  return out;
}

export async function pushPlanNodes(
  url: string, key: string, planUuid: string, nodes: PlanNode[],
  opts: { maxNodes?: number; fetchFn?: McpFetch } = {},
): Promise<PushResult[]> {
  const mcp = new OnePlanetMcp(url, key, opts.fetchFn ?? fetch);
  const max = Math.min(Math.max(opts.maxNodes ?? 25, 1), 200);
  return pushNodesWith(mcp, planUuid, nodes.slice(0, max));
}

// Progress write-back — a recorded value + note on an OAI. This is how
// Springforth oracle readings land on OnePlanet monitoring timelines.
export async function pushProgress(
  url: string, key: string, planUuid: string, oaiUuid: string,
  value: string, note?: string, fetchFn: McpFetch = fetch,
): Promise<unknown> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  return mcp.callTool('create_progress_unit', {
    plan_uuid: planUuid, oai_uuid: oaiUuid,
    progress_value: value,
    ...(note ? { progress_comments: note } : {}),
  });
}
