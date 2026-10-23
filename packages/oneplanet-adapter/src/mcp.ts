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

// ── Full surface ────────────────────────────────────────────────────────
// Generic typed passthrough — every tool on the key is callable through
// one entry point, so read surfaces (get_oai, get_oai_additional_data,
// get_oai_progress, get_plan_summary, get_plan_report, compare_plans,
// list_connections, find_plan, find_oai, search_plan_content,
// search_content, search_knowledge, query_plan_oais, ping) never need a
// bespoke wrapper each.
export async function opTool(
  url: string, key: string, tool: string, args: Json = {},
  fetchFn: McpFetch = fetch,
): Promise<unknown> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  return mcp.callTool(tool, args);
}

// Every tool name the SFLive surface has exposed — the route allowlist.
export const OP_TOOLS = new Set([
  'ping', 'list_workspaces', 'list_workspace_plans', 'query_plan_oais',
  'find_plan', 'find_oai', 'get_oai', 'get_oai_additional_data',
  'get_plan_summary', 'get_plan_report', 'compare_plans', 'list_connections',
  'get_oai_progress', 'search_plan_content', 'search_content',
  'search_knowledge',
  'create_outcome', 'create_action', 'create_indicator',
  'create_guidance', 'create_case_study', 'create_story', 'create_chart',
  'create_progress_unit', 'create_monitoring',
  'update_outcome', 'update_action', 'update_indicator',
]);

// workspaces + flattened plan list — the publish-target picker.
export async function listPlans(
  url: string, key: string, fetchFn: McpFetch = fetch,
): Promise<{ workspaces: Json[]; plans: { workspace: string; uuid: string; name: string }[] }> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  const ws = await mcp.callTool('list_workspaces', {}) as { items?: Json[] };
  const plans: { workspace: string; uuid: string; name: string }[] = [];
  for (const w of ws?.items ?? []) {
    const pl = await mcp.callTool('list_workspace_plans',
      { workspace_uuid: w.uuid }) as { items?: Json[] };
    for (const p of pl?.items ?? [])
      plans.push({ workspace: String(w.name ?? w.uuid),
        uuid: String(p.uuid), name: String(p.name) });
  }
  return { workspaces: ws?.items ?? [], plans };
}

const UPDATE_TOOL: Record<string, string> = {
  outcome: 'update_outcome', action: 'update_action',
  indicator: 'update_indicator',
};

// Update an OAI — kind selects the update_* tool (pushed provenance
// records the create tool, so callers can derive it). status/due_date
// only exist on update_action; they're dropped silently for other kinds.
export async function updateOai(
  url: string, key: string, planUuid: string, oaiUuid: string,
  kind: 'outcome' | 'action' | 'indicator',
  patch: { name?: string; description?: string; status?: string; dueDate?: string },
  fetchFn: McpFetch = fetch,
): Promise<unknown> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  const args: Json = { plan_uuid: planUuid, oai_uuid: oaiUuid };
  if (patch.name != null) args.name = patch.name;
  if (patch.description != null) args.description = patch.description;
  if (kind === 'action') {
    if (patch.status != null) args.status = patch.status;
    if (patch.dueDate != null) args.due_date = patch.dueDate;
  }
  return mcp.callTool(UPDATE_TOOL[kind] ?? 'update_action', args);
}

const ATTACH_TOOL = {
  progress: 'create_progress_unit', guidance: 'create_guidance',
  case_study: 'create_case_study', story: 'create_story',
  chart: 'create_chart', monitoring: 'create_monitoring',
} as const;
export type OpAttachment = keyof typeof ATTACH_TOOL;

// Attach content to an OAI — guidance/case_study/story/chart/monitoring/
// progress_unit share plan_uuid+oai_uuid and take shaped fields.
export async function attachToOai(
  url: string, key: string, planUuid: string, oaiUuid: string,
  type: OpAttachment,
  data: { value?: string; note?: string; title?: string; description?: string;
    date?: string; url?: string; units?: string; target?: string;
    targetDate?: string; benchmark?: string },
  fetchFn: McpFetch = fetch,
): Promise<unknown> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  const args: Json = { plan_uuid: planUuid, oai_uuid: oaiUuid };
  switch (type) {
    case 'progress':
      args.progress_value = data.value ?? '';
      if (data.note) args.progress_comments = data.note;
      break;
    case 'guidance':
      args.description = data.description ?? data.note ?? '';
      break;
    case 'monitoring':
      if (data.units) args.setup_units = data.units;
      if (data.target) args.setup_targetvalue = data.target;
      if (data.targetDate) args.setup_targetdate = data.targetDate;
      if (data.benchmark) args.setup_benchmark = data.benchmark;
      break;
    default: // case_study | story | chart
      if (data.title) args.title = data.title;
      if (data.description ?? data.note) args.description = data.description ?? data.note;
      if (data.date) args.happeningdate = data.date;
      if (type === 'chart' && data.url) {
        args.externalsheeturl = data.url; args.url = data.url;
      }
  }
  return mcp.callTool(ATTACH_TOOL[type], args);
}

// Pull one OAI's full record + attachments + progress history — the
// read-back lane: OnePlanet-side monitoring returns to Springforth as
// evidence material.
export async function pullOai(
  url: string, key: string, planUuid: string, oaiUuid: string,
  fetchFn: McpFetch = fetch,
): Promise<{ oai: unknown; progress: unknown; additional: unknown }> {
  const mcp = new OnePlanetMcp(url, key, fetchFn);
  // The MCP surface rate-limits hard (~1 call/s observed, -32029 with
  // retryAfterSeconds) — retry once after the advertised cooldown.
  const call = async (tool: string, args: Json) => {
    try { return await mcp.callTool(tool, args); }
    catch (e) {
      const retry = /retryAfterSeconds["':\s]+(\d+)/.exec(String(e));
      if (retry) {
        await new Promise((r) => setTimeout(r, (+retry[1]! + 1) * 1000));
        return mcp.callTool(tool, args)
          .catch((e2) => ({ error: String(e2).slice(0, 120) }));
      }
      return { error: String(e).slice(0, 120) };
    }
  };
  const oai = await call('get_oai', { plan_uuid: planUuid, oai_uuid: oaiUuid });
  const additional = await call('get_oai_additional_data',
    { plan_uuid: planUuid, oai_uuid: oaiUuid });
  // get_oai_progress is listed but FORBIDDEN on some keys — progress
  // units ride the additional-data groups instead.
  const groups = (additional as { groups?: Record<string, unknown[]> })
    ?.groups ?? {};
  const progress = { items: groups.ProgressUnit ?? [] };
  return { oai, progress, additional };
}
