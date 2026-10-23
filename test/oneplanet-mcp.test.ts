import { describe, expect, it } from 'vitest';
import { OnePlanetMcp, fetchPlanMcp, type McpFetch } from '../src/adapters/oneplanet.ts';

const PLAN = {
  id: 'plan-cvl', title: 'Thorntree Community Plan',
  outcomes: [{ id: 'o1', title: 'A greener neighbourhood' }],
  actions: [{ id: 'a1', title: 'Thorntree wetland restoration Q3', outcomeId: 'o1', placeId: 'p1' }],
  organisations: [{ id: 'org1', name: 'Community Ventures Ltd' }],
  places: [{ id: 'p1', name: 'Thorntree' }],
};

const TOOLS = [
  { name: 'get_plan', description: 'Read a plan and its outcomes/actions by id',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'search', description: 'Search the workspace knowledge graph',
    inputSchema: { type: 'object', properties: {} } },
];

function jsonRes(body: unknown, sid?: string) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(sid ? { 'mcp-session-id': sid } : {}) },
  });
}

function sseRes(body: unknown) {
  return new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 'sess-1' },
  });
}

function mockFetch(mode: 'json' | 'sse'): McpFetch {
  const calls: { method: string; args: unknown }[] = [];
  return async (_url, init) => {
    const req = JSON.parse(String(init.body)) as { method: string; id?: number; params?: { name?: string; arguments?: unknown } };
    calls.push({ method: req.method, args: req.params?.arguments });
    if (req.method === 'initialize') return jsonRes({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'oneplanet-test', version: '0.0.0' } } }, 'sess-1');
    if (req.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (req.method === 'tools/list') {
      return mode === 'sse'
        ? sseRes({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } })
        : jsonRes({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } });
    }
    if (req.method === 'tools/call') {
      const name = req.params?.name;
      expect(name).toBe('get_plan');
      const args = req.params?.arguments as Record<string, unknown>;
      // accept id-style args; error on anything else to exercise the fallback loop
      if (!('id' in args) && !('planId' in args)) return jsonRes({ jsonrpc: '2.0', id: req.id, result: { isError: true, content: [{ type: 'text', text: 'bad args' }] } });
      return jsonRes({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(PLAN) }] } });
    }
    throw new Error(`unexpected ${req.method}`);
  };
}

describe('OnePlanetMcp', () => {
  it('initialises, lists tools, calls a tool (json transport)', async () => {
    const mcp = new OnePlanetMcp('https://mcp.oneplanet.com/mcp', 'opk_test', mockFetch('json'));
    const tools = await mcp.listTools();
    expect(tools.map((t) => t.name)).toEqual(['get_plan', 'search']);
    const plan = await mcp.callTool('get_plan', { id: 'plan-cvl' });
    expect((plan as typeof PLAN).title).toBe('Thorntree Community Plan');
  });
  it('parses SSE event-stream responses', async () => {
    const mcp = new OnePlanetMcp('https://mcp.oneplanet.com/mcp', 'opk_test', mockFetch('sse'));
    const tools = await mcp.listTools();
    expect(tools).toHaveLength(2);
  });
});

describe('fetchPlanMcp', () => {
  it('discovers the plan-reading tool and normalises the result', async () => {
    const plan = await fetchPlanMcp('https://mcp.oneplanet.com/mcp', 'opk_test', 'plan-cvl', mockFetch('json'));
    expect(plan.source).toBe('oneplanet:plan-cvl');
    expect(plan.nodes.length).toBe(4);
    const action = plan.nodes.find((n) => n.kind === 'action')!;
    expect(action.parentOutcomeId).toBe('oneplanet:plan-cvl-outcome-o1');
    expect(action.placeId).toBe('thorntree');
  });
});
