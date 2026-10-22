// Mirrors RETIRED in packages/edge/src/index.ts — browser requests to old
// top-level slugs 302 to their hub section. On the edge Worker the same
// map runs first (belt & braces); web replicates it for routes it now owns.
export const RETIRED: Record<string, { to: string; always?: boolean; keep: string[] }> = {
	coordination: { to: "/collaborate#overlaps", always: true, keep: ["node"] },
	outcomes: { to: "/collaborate#outcomes", always: true, keep: [] },
	portfolio: { to: "/collaborate#plans", always: true, keep: [] },
	tour: { to: "/how-it-works", always: true, keep: [] },
	all: { to: "/how-it-works", always: true, keep: [] },
	commitments: { to: "/collaborate#needs", keep: [] },
	resources: { to: "/collaborate#commons", keep: [] },
	agent: { to: "/collaborate#ask", keep: ["q"] },
	rounds: { to: "/fund#rounds", keep: [] },
	pledges: { to: "/fund#pledges", keep: [] },
	retro: { to: "/fund#retro", keep: [] },
	streams: { to: "/fund#streams", keep: [] },
	metrics: { to: "/impact#results", keep: [] },
	claims: { to: "/impact#claims", keep: [] },
	attestations: { to: "/impact#claims", keep: [] },
	verify: { to: "/impact#evidence", keep: [] },
	sources: { to: "/impact#evidence", keep: [] },
	datasets: { to: "/impact#data", keep: [] },
	actors: { to: "/community#people", keep: [] },
	trust: { to: "/community#trust", keep: [] },
	governance: { to: "/community#decisions", keep: [] },
};
