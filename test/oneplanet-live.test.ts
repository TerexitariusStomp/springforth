import { it, expect } from 'vitest';
import { fetchPlanMcp } from '../src/adapters/oneplanet.ts';
// Live lane — runs only when ONEPLANET_API_KEY is in the environment.
it.runIf(process.env.ONEPLANET_API_KEY)('live MCP import', async () => {
  const plan = await fetchPlanMcp('https://mcp.oneplanet.com/mcp',
    process.env.ONEPLANET_API_KEY!, '294fb866-9bc8-4d3a-ab59-c5e057593231');
  console.log('PLAN:', plan.title, '| nodes:', plan.nodes.length);
  expect(plan.nodes.length).toBe(37);
  expect(plan.title).toContain('Flood');
});
