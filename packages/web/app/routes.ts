import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Route parity with the legacy portal — every path that rendered HTML on
// the edge Worker has a route here, plus the retired-slug redirects.
export default [
	index("routes/landing.tsx"),
	route("possibilities", "routes/possibilities.tsx"),
	route("collaborate", "routes/collaborate.tsx"),
	route("fund", "routes/fund.tsx"),
	route("impact", "routes/impact.tsx"),
	route("community", "routes/community.tsx"),
	route("how-it-works", "routes/how-it-works.tsx"),
	route("whitepaper", "routes/whitepaper.tsx"),
	route("docs", "routes/docs.tsx"),
	route("search", "routes/search.tsx"),
	route("map", "routes/map.tsx"),
	route("plans", "routes/plans.tsx"),
	route("plans/compare", "routes/plans-compare.tsx"),
	route("plans/:id", "routes/plan.tsx"),
	route("ledger", "routes/ledger.tsx"),
	route("ledger/verify", "routes/ledger-verify.tsx"),
	route("actors/:id", "routes/actor.tsx"),
	route("actors/:id/report", "routes/actor-report.tsx"),
	route("rounds/:id", "routes/round.tsx"),
	route("rounds/:id/donors/:donor", "routes/donor.tsx"),
	route("rounds/:id/admin", "routes/round-admin.tsx"),
	route("claims/:id", "routes/claim.tsx"),
	// Retired slugs — single-segment redirects to hub anchors.
	route(":seg", "routes/redirect.tsx", { id: "retired" }),
	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
