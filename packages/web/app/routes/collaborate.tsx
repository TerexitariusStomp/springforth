import { useTranslation } from "react-i18next";
import type { Route } from "./+types/collaborate";
import type { renderCollaboratePage, CollaboratePageInput } from "@springforth/portal";
import type { OverlapRecord, PlanNode } from "@springforth/coordination";
import { triScore } from "@springforth/coordination";
import type { Signal } from "@springforth/core";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, HubNav, HubSection, HowNote, field, submit, emptyCls, cardCls, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderCollaboratePage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Collaborate — Springforth" }];
}

const MIN_CONFIDENCE = 0.5;
const PAGE_SIZE = 12;
const OUTCOME_CAP = 12;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

const KIND_BADGE: Record<string, "coral" | "lime" | "default"> = {
	duplicate: "coral", overlap: "default", complement: "lime", conflict: "coral",
};

function CorrectForm({ n, id }: { n?: PlanNode; id: string }) {
	const { t } = useTranslation();
	return (
		<details className="mt-2">
			<summary className="cursor-pointer text-xs text-info">{t("form.correctPrefix")} {n?.label ?? id}</summary>
			<form method="post" action={`/nodes/${id}/correct`} className="mt-2 flex flex-wrap gap-2">
				<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
				<input name="label" defaultValue={n?.label ?? ""} placeholder={t("form.label")} aria-label={t("form.label")} className={field} />
				<input name="placeId" defaultValue={n?.placeId ?? ""} placeholder={t("form.place")} aria-label={t("form.place")} className={field} />
				<input name="timeframeFrom" defaultValue={n?.timeframe.from ?? ""} placeholder={t("form.from")} aria-label={t("form.from")} className={field} />
				<input name="timeframeTo" defaultValue={n?.timeframe.to ?? ""} placeholder={t("form.to")} aria-label={t("form.to")} className={field} />
				<input name="budget" defaultValue={n?.budget ?? ""} placeholder={t("form.budget")} aria-label={t("form.budget")} className={field} />
				<input name="note" placeholder={t("form.whyCorrection")} aria-label={t("form.whyCorrection")} className={field} />
				<button className={submit}>{t("form.submitCorrection")}</button>
			</form>
		</details>
	);
}

function OverlapCard({ rec, byId, signals, maxBudget }: {
	rec: OverlapRecord; byId: Map<string, PlanNode>; signals: Signal[]; maxBudget: number;
}) {
	const { t } = useTranslation();
	const signed = signals.filter((s) => rec.nodeIds.includes(s.targetId) && s.intent === "support");
	const [a, b] = rec.nodeIds.map((id) => byId.get(id));
	const ce = rec.counterEvidence ?? [];
	const tri = triScore(rec, byId, maxBudget);
	return (
		<div className={cardCls}>
			<h3 className="font-display text-xl leading-snug">
				{rec.kind === "complement" ? (
					<>{a?.label ?? rec.nodeIds[0]} <span className="text-info">← {t("hub.collaborate.metBy")}</span> {b?.label ?? rec.nodeIds[1]}</>
				) : (
					<>{a?.label ?? rec.nodeIds[0]} ↔ {b?.label ?? rec.nodeIds[1]}</>
				)}
			</h3>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<Badge variant={KIND_BADGE[rec.kind] ?? "default"}>{t(`kind.${rec.kind}`)}</Badge>
				<Badge>{t(`status.${rec.status}`)}</Badge>
				<Badge>{t("hub.collaborate.strength")} {pct(tri.strength)}</Badge>
				<Badge>{t("hub.collaborate.materiality")} {tri.materiality !== undefined ? pct(tri.materiality) : "—"}</Badge>
				<Badge>{t("hub.collaborate.readiness")} {pct(tri.readiness)}</Badge>
				{signed.length > 0 && <Badge>{signed.length} {t("hub.collaborate.supports")}</Badge>}
			</div>
			<p className="mt-3 text-sm">{rec.reasoning}</p>
			<details className="mt-3">
				<summary className="cursor-pointer text-sm font-semibold text-info">
					{t("hub.collaborate.evidence")} ({rec.evidence.length} {t("hub.collaborate.ev.for")}
					{ce.length ? ` · ${ce.length} ${t("hub.collaborate.ev.against")}` : ""})
				</summary>
				<table className={`${tableCls} mt-2`}>
					<thead><tr>
						<th className={thCls}>{t("col.field")}</th><th className={thCls}>{t("col.planA")}</th>
						<th className={thCls}>{t("col.planB")}</th><th className={thCls}>{t("col.score")}</th>
					</tr></thead>
					<tbody>
						{rec.evidence.map((e, i) => (
							<tr key={i}>
								<td className={tdCls}>{e.field}</td><td className={tdCls}>{e.a.slice(0, 60)}</td>
								<td className={tdCls}>{e.b.slice(0, 60)}</td><td className={tdCls}>{e.score.toFixed(2)}</td>
							</tr>
						))}
						{ce.map((e, i) => (
							<tr key={`c${i}`} className="text-coral-ink">
								<td className={tdCls}>{e.field}</td><td className={tdCls}>{e.a.slice(0, 60)}</td>
								<td className={tdCls}>{e.b.slice(0, 60)}</td><td className={tdCls}>{t("misc.mismatch")}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
			{rec.validations.length > 0 ? (
				<ul className="mt-3 space-y-1 text-sm">
					{rec.validations.map((v, i) => (
						<li key={i}><ActorName id={v.actor} /> — {t(`verdict.${v.verdict}`)}{v.note ? ` (${v.note})` : ""}</li>
					))}
				</ul>
			) : (
				<p className="mt-3 text-sm italic text-muted">{t("hub.collaborate.awaiting")}</p>
			)}
			{rec.scenario && (
				<p className="mt-3 rounded-lg bg-lime/25 p-3 text-sm">
					{t("hub.collaborate.scenario")} <strong>{rec.scenario.choice}</strong> {t("hub.collaborate.by")}{" "}
					<ActorName id={rec.scenario.actor} />
					{rec.scenario.rationale ? ` — ${rec.scenario.rationale}` : ""}
					{rec.scenario.objections ? <em> ({t("hub.collaborate.objections")} {rec.scenario.objections})</em> : null}
				</p>
			)}
			{(rec.status === "proposed" || rec.status === "confirmed") && (
				<div className="mt-3 space-y-2">
					<form method="post" action={`/overlaps/${rec.id}/validate`} className="flex flex-wrap gap-2">
						<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
						<input name="note" placeholder={t("form.note")} aria-label={t("form.note")} className={field} />
						<select name="scenario" aria-label={t("form.scenario")} className={field}>
							<option value="">{t("form.scenario")}</option>
							<option value="separate">{t("form.keepSeparate")}</option>
							<option value="coordinate">{t("form.coordinateDelivery")}</option>
							<option value="combine">{t("form.combineFunding")}</option>
						</select>
						<input name="rationale" placeholder={t("form.rationale")} aria-label={t("form.rationale")} className={field} />
						<button name="verdict" value="confirm" className={submit}>{t("form.confirm")}</button>
						<button name="verdict" value="reject" className={submit}>{t("form.notSame")}</button>
					</form>
					{rec.status === "confirmed" && (
						<form method="post" action={`/overlaps/${rec.id}/confirm`} className="flex flex-wrap gap-2">
							<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
							<select name="scenario" aria-label={t("form.scenario")} className={field}>
								<option value="coordinate">{t("form.coordinateDelivery")}</option>
								<option value="combine">{t("form.combineFunding")}</option>
							</select>
							<input name="rationale" placeholder={t("form.rationale")} aria-label={t("form.rationale")} className={field} />
							<button className={submit}>{t("form.coordinateAction")}</button>
						</form>
					)}
				</div>
			)}
			{rec.resolution && (
				<p className="mt-3 rounded-lg bg-lime/25 p-3 text-sm">
					{t("hub.collaborate.coordinated")} —{" "}
					<a href={`/overlaps/${rec.id}/agreement`} className="font-semibold text-info underline">{t("hub.collaborate.agreement")}</a>
				</p>
			)}
			{[a, b].some((n) => n?.source.startsWith("treegens")) && (
				<p className="mt-2 text-sm text-info">
					{t("hub.collaborate.treegens")}{" "}
					<a href="https://world.treegens.app" rel="noopener" className="underline">world.treegens.app</a>
				</p>
			)}
			<details className="mt-3">
				<summary className="cursor-pointer text-xs font-semibold text-muted">{t("form.correctTitle")}</summary>
				<CorrectForm n={a} id={rec.nodeIds[0]!} />
				<CorrectForm n={b} id={rec.nodeIds[1]!} />
			</details>
			<form method="post" action="/signals" className="mt-2 flex flex-wrap gap-2">
				<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
				<input type="hidden" name="targetId" value={rec.nodeIds[0]!} />
				<input type="hidden" name="targetKind" value="node" />
				<input type="hidden" name="intent" value="support" />
				<button className={submit}>{t("form.signSupport")} {a?.label ?? t("col.need").toLowerCase()}</button>
			</form>
		</div>
	);
}

function FocusEvidence({ f, parentInferred }: {
	f: NonNullable<CollaboratePageInput["focus"]>; parentInferred: boolean;
}) {
	const { t } = useTranslation();
	const rows: { k: string; v: React.ReactNode }[] = [];
	if (f.plan) rows.push({ k: t("hub.collaborate.focus.plan"), v: f.plan.title });
	if (f.parent) rows.push({
		k: t("hub.collaborate.focus.parent"),
		v: <>
			<a href={`/collaborate?node=${encodeURIComponent(f.parent.id)}`} className="text-info underline">{f.parent.label}</a>
			{parentInferred && <> <Badge>{t("hub.collaborate.focus.inferred")}</Badge></>}
		</>,
	});
	if (f.children.length) rows.push({
		k: t("hub.collaborate.focus.children"),
		v: f.children.map((c) => (
			<a key={c.id} href={`/collaborate?node=${encodeURIComponent(c.id)}`} className="block text-info underline">{c.label}</a>
		)),
	});
	if (f.credits.length) rows.push({ k: t("hub.collaborate.focus.credits"), v: String(f.credits.length) });
	rows.push({ k: t("hub.collaborate.focus.overlaps"), v: String(f.overlaps.length) });
	return (
		<div className={`${cardCls} mt-4`}>
			<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("hub.collaborate.focus.k")}</span>
			<table className={`${tableCls} mt-2`}>
				<tbody>
					{rows.map((r, i) => (
						<tr key={i}>
							<th scope="row" className={`${thCls} w-40 align-top`}>{r.k}</th>
							<td className={tdCls}>{r.v}</td>
						</tr>
					))}
				</tbody>
			</table>
			{f.checks.length > 0 && (
				<>
					<h4 className="mt-4 font-semibold">{t("hub.collaborate.focus.checks")}</h4>
					<table className={`${tableCls} mt-2`}>
						<thead><tr>
							<th className={thCls}>{t("col.source")}</th><th className={thCls}>{t("col.result")}</th>
							<th className={thCls}>{t("col.score")}</th><th className={thCls}>{t("col.detail")}</th>
							<th className={thCls}>{t("col.date")}</th>
						</tr></thead>
						<tbody>
							{f.checks.map((c, i) => (
								<tr key={i}>
									<td className={tdCls}>{c.source}</td>
									<td className={tdCls}>
										<Badge variant={c.result === "match" ? "lime" : c.result === "mismatch" ? "coral" : "default"}>{c.result}</Badge>
									</td>
									<td className={tdCls}>{c.score.toFixed(2)}</td>
									<td className={tdCls}>{c.detail.slice(0, 80)}</td>
									<td className={tdCls}>{c.at.slice(0, 10)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</div>
	);
}

/** Cross-plan network — React port of renderNetworkSvg (coords arrive pre-laid-out). */
function NetworkSvg({ g }: { g: NonNullable<CollaboratePageInput["network"]> }) {
	const { t } = useTranslation();
	if (!g.edges.length) return null;
	const byId = new Map(g.vertices.map((v) => [v.id, v]));
	return (
		<svg
			viewBox="0 0 900 560" role="img" aria-label={t("hub.collaborate.network.t")}
			className="h-auto w-full rounded-xl border border-line bg-card"
		>
			{g.edges.map((e, i) => {
				const a = byId.get(e.a), b = byId.get(e.b);
				if (!a || !b) return null;
				return (
					<line
						key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
						className="stroke-foreground"
						strokeWidth={0.8 + Math.min(4, Math.log2(1 + e.count))}
						strokeOpacity={0.25 + Math.min(0.65, e.confidence * 0.6)}
					>
						<title>{t("hub.collaborate.network.edge")}: {e.count} · {(e.confidence * 100).toFixed(0)}%</title>
					</line>
				);
			})}
			{g.vertices.map((v) => {
				const r = 8 + Math.min(26, Math.sqrt(v.count) * 2.4);
				const label = v.label.length > 34 ? `${v.label.slice(0, 32)}…` : v.label;
				return (
					<g key={v.id}>
						<circle
							cx={v.x} cy={v.y} r={r} fillOpacity={0.85}
							className={v.kind === "possibility" ? "fill-coral stroke-cream" : "fill-foreground stroke-cream"}
							strokeWidth={2}
						>
							<title>{v.label} — {v.count} {t("hub.collaborate.network.nodes")}</title>
						</circle>
						<text x={v.x} y={v.y + r + 12} textAnchor="middle" className="fill-foreground text-[11px]">{label}</text>
						<text x={v.x} y={v.y + r + 22} textAnchor="middle" className="fill-muted text-[9px]">{v.count}</text>
					</g>
				);
			})}
		</svg>
	);
}

export default function Collaborate({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();
	const byId = new Map(o.nodes.map((n) => [n.id, n]));
	const maxBudget = Math.max(1, ...o.nodes.map((n) => n.budget ?? 0));

	/* needs */
	const unmet = o.commitments.filter((n) => n.role === "need" && !n.offersMatched);
	const complements = o.overlaps.filter((r) => r.kind === "complement")
		.sort((x, y) =>
			(Number(y.status === "confirmed" || y.status === "coordinated") -
				Number(x.status === "confirmed" || x.status === "coordinated")) || y.confidence - x.confidence);

	/* overlaps */
	let recs = o.overlaps.filter((r) => r.kind !== "complement");
	if (o.nodeFocus) {
		recs = recs.filter((r) => r.nodeIds.includes(o.nodeFocus!));
	} else if (!o.overlapsAll) {
		recs = recs.filter((r) => r.confidence >= MIN_CONFIDENCE || r.status === "confirmed" || r.status === "coordinated");
	}
	const RANK: Record<string, number> = { confirmed: 0, coordinated: 0, proposed: 1, rejected: 2 };
	const ordered = [...recs].sort((x, y) => (RANK[x.status] ?? 3) - (RANK[y.status] ?? 3) || y.confidence - x.confidence);
	const page = Math.max(1, o.page ?? 1);
	const pageRecs = o.nodeFocus ? ordered : ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	const hidden = o.overlaps.filter((r) => r.kind !== "complement").length -
		o.overlaps.filter((r) => r.kind !== "complement" &&
			(r.confidence >= MIN_CONFIDENCE || r.status === "confirmed" || r.status === "coordinated")).length;

	/* outcomes */
	const indicators = o.nodes.filter((n) => n.kind === "indicator");
	const linked = new Map<string, Set<string>>();
	const link = (a: string, b: string) => {
		if (!linked.has(a)) linked.set(a, new Set());
		if (!linked.has(b)) linked.set(b, new Set());
		linked.get(a)!.add(b); linked.get(b)!.add(a);
	};
	for (const r of o.overlaps) {
		const [a, b] = r.nodeIds;
		link(a, b);
		const pa = byId.get(a)?.parentOutcomeId, pb = byId.get(b)?.parentOutcomeId;
		if (pa && pb && pa !== pb) link(pa, pb);
	}
	const outcomes = o.nodes.filter((n) => n.kind === "outcome");
	const seen = new Set<string>();
	const groups: PlanNode[][] = [];
	for (const oc of outcomes) {
		if (seen.has(oc.id)) continue;
		const group = [oc];
		seen.add(oc.id);
		for (const p of outcomes) {
			if (seen.has(p.id)) continue;
			if (p.canonical === oc.canonical || linked.get(oc.id)?.has(p.id) || linked.get(p.id)?.has(oc.id)) {
				group.push(p); seen.add(p.id);
			}
		}
		groups.push(group);
	}
	const shownGroups = o.outcomesAll ? groups : groups.slice(0, OUTCOME_CAP);

	/* plans */
	const money = (n?: number) => (n ? `£${n.toLocaleString("en-GB")}` : "—");

	const sections = [
		["needs", t("hub.collaborate.needs.t"), o.commitments.length],
		["overlaps", t("hub.collaborate.overlaps.t"), recs.length],
		["outcomes", t("hub.collaborate.outcomes.t"), groups.length],
		["plans", t("hub.collaborate.plans.t"), o.plans.length],
		["commons", t("hub.collaborate.commons.t"), o.resources.length],
		["network", t("hub.collaborate.network.t"), o.network?.edges.length ?? 0],
		["ask", t("hub.collaborate.ask.t"), undefined],
	] as const;

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main">
				<HubHead
					kicker={t("hub.collaborate.kicker")}
					title={t("hub.collaborate.h1")}
					em={t("hub.collaborate.h1.em")}
					lede={t("hub.collaborate.lede")}
				/>
				<div className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
					<HubNav items={sections.map(([id, label]) => ({ href: `#${id}`, label }))} />

					<HubSection id="needs" kicker={t("hub.collaborate.needs.k")} title={t("hub.collaborate.needs.t")} count={o.commitments.length} lede={t("hub.collaborate.needs.lede")}>
						{Object.keys(o.byCapital).length > 0 && (
							<details className="mb-4 rounded-xl border border-line">
								<summary className="cursor-pointer p-3 text-sm font-semibold text-info">{t("hub.collaborate.needs.capital")}</summary>
								<div className="flex flex-wrap gap-1.5 border-t border-line p-3">
									{Object.entries(o.byCapital).map(([k, n]) => <Badge key={k}>{k} × {n}</Badge>)}
								</div>
							</details>
						)}
						<div className="grid gap-4 md:grid-cols-2">
							{unmet.map((n) => (
								<div key={n.id} className={cardCls}>
									<h3 className="font-display text-xl">{n.label}</h3>
									<p className="mt-1 text-sm text-muted">
										{n.placeId ?? "—"}{n.orgIds.length ? ` · ${n.orgIds.map((x) => x).join(", ")}` : ""}
									</p>
									<p className="mt-2">
										<Badge variant="coral">{t("hub.collaborate.needs.zero")}</Badge>
										{n.possibilityId && (
											<a href={`/possibilities?card=${n.possibilityId}`} className="ml-2 text-sm font-semibold text-info underline">
												{t("hub.collaborate.needs.onCard")} →
											</a>
										)}
									</p>
								</div>
							))}
						</div>
						{unmet.length === 0 && <p className={emptyCls}>{t("hub.collaborate.needs.none")}</p>}
						{complements.length > 0 ? (
							<>
								<h3 className="mt-6 font-display text-xl">{t("hub.collaborate.needs.matched")}</h3>
								<div className="mt-3 space-y-4">
									{complements.slice(0, PAGE_SIZE).map((r) => (
										<OverlapCard key={r.id} rec={r} byId={byId} signals={o.signals} maxBudget={maxBudget} />
									))}
								</div>
							</>
						) : (
							<p className="mt-4 text-sm text-muted">{t("hub.collaborate.needs.noComplements")}</p>
						)}
						<HowNote noteKey="how.collaborate.needs" anchor="s4" />
					</HubSection>

					<HubSection id="overlaps" kicker={t("hub.collaborate.overlaps.k")} title={t("hub.collaborate.overlaps.t")} count={recs.length} lede={t("hub.collaborate.overlaps.lede")}>
						{o.nodeFocus && (
							<>
								<p className="rounded-lg bg-lime/25 p-3 text-sm">
									{t("hub.collaborate.overlaps.focus")}{" "}
									<strong>{byId.get(o.nodeFocus)?.label ?? o.nodeFocus}</strong> —{" "}
									<a href="/collaborate#overlaps" className="font-semibold text-info underline">{t("hub.collaborate.overlaps.all")}</a>
								</p>
								<CorrectForm n={byId.get(o.nodeFocus)} id={o.nodeFocus} />
								{o.focus && <FocusEvidence f={o.focus} parentInferred={byId.get(o.nodeFocus)?.parentInferred ?? false} />}
							</>
						)}
						{!o.nodeFocus && !o.overlapsAll && hidden > 0 && (
							<p className="mb-3"><a href="/collaborate?overlaps=all#overlaps" className="text-sm font-semibold text-info underline">
								{t("hub.collaborate.overlaps.showAll")} ({hidden})
							</a></p>
						)}
						{!o.nodeFocus && o.overlapsAll && (
							<p className="mb-3"><a href="/collaborate#overlaps" className="text-sm font-semibold text-info underline">
								{t("hub.collaborate.overlaps.hideLow")}
							</a></p>
						)}
						<div className="space-y-4">
							{pageRecs.map((r) => <OverlapCard key={r.id} rec={r} byId={byId} signals={o.signals} maxBudget={maxBudget} />)}
						</div>
						{pageRecs.length === 0 && <p className={emptyCls}>{t("hub.collaborate.overlaps.none")}</p>}
						{!o.nodeFocus && (page > 1 || page * PAGE_SIZE < ordered.length) && (
							<nav aria-label={t("a11y.pagination")} className="mt-4 flex items-center gap-4 text-sm">
								{page > 1 && (
									<a href={`/collaborate${o.overlapsAll ? "?overlaps=all&" : "?"}page=${page - 1}`} className="font-semibold text-info underline">
										← {t("pager.newer")}
									</a>
								)}
								<span aria-current="page">{t("pager.page")} {page}</span>
								{page * PAGE_SIZE < ordered.length && (
									<a href={`/collaborate${o.overlapsAll ? "?overlaps=all&" : "?"}page=${page + 1}`} className="font-semibold text-info underline">
										{t("pager.older")} →
									</a>
								)}
							</nav>
						)}
						<HowNote noteKey="how.collaborate.overlaps" anchor="s4" />
					</HubSection>

					<HubSection id="outcomes" kicker={t("hub.collaborate.outcomes.k")} title={t("hub.collaborate.outcomes.t")} count={groups.length} lede={t("hub.collaborate.outcomes.lede")}>
						<div className="grid gap-4 md:grid-cols-2">
							{shownGroups.map((g) => {
								const pursuers = g.map((oc) => oc);
								const actions = o.nodes.filter((n) =>
									n.kind === "action" && n.parentOutcomeId && g.some((oc) => oc.id === n.parentOutcomeId));
								const recLinks = o.overlaps.filter((r) => r.nodeIds.some((id) => g.some((oc) => oc.id === id))).map((r) => r.status);
								const stat = recLinks.includes("coordinated") ? "coordinated"
									: recLinks.includes("confirmed") ? "confirmed"
										: recLinks.length ? "proposed" : "";
								const inds = indicators.filter((ind) =>
									g.some((oc) => ind.parentOutcomeId === oc.id) ||
									g.some((oc) => ind.orgIds.some((org) => oc.orgIds.includes(org))));
								return (
									<div key={g[0]!.id} className={cardCls}>
										<h3 className="font-display text-xl">{g[0]!.label}</h3>
										<p className="mt-2 flex flex-wrap gap-1.5">
											{g.length > 1 && <Badge>{g.length} {t("hub.collaborate.outcomes.pursuing")}</Badge>}
											{stat && <Badge>{t(`status.${stat}`)}</Badge>}
										</p>
										<p className="mt-2 text-sm">
											<strong>{t("hub.collaborate.outcomes.who")}</strong>{" "}
											{pursuers.map((oc, idx) => (
												<span key={oc.id}>
													{idx > 0 && ", "}
													<a href={`/collaborate?node=${encodeURIComponent(oc.id)}#overlaps`} className="text-info underline">{oc.label}</a>
													{" "}<small className="text-muted">({oc.source}{oc.orgIds.length ? ` · ${oc.orgIds.join(", ")}` : ""})</small>
												</span>
											))}
										</p>
										{actions.length > 0 ? (
											<>
												<p className="mt-2 text-sm"><strong>{t("hub.collaborate.outcomes.actions")}</strong></p>
												<ul className="mt-1 space-y-1 text-sm">
													{actions.map((ac) => (
														<li key={ac.id}>{ac.label} <small className="text-muted">— {ac.source}{ac.timeframe.from ? ` · ${ac.timeframe.from}` : ""}</small></li>
													))}
												</ul>
											</>
										) : (
											<p className="mt-2 text-sm italic text-muted">{t("hub.collaborate.outcomes.noActions")}</p>
										)}
										{inds.length > 0 && (
											<p className="mt-2 text-sm"><strong>{t("hub.collaborate.outcomes.indicators")}</strong> {inds.map((x) => x.label).join(", ")}</p>
										)}
									</div>
								);
							})}
						</div>
						{groups.length === 0 && <p className={emptyCls}>{t("hub.collaborate.outcomes.none")}</p>}
						{!o.outcomesAll && groups.length > OUTCOME_CAP && (
							<p className="mt-3"><a href="/collaborate?outcomes=all#outcomes" className="text-sm font-semibold text-info underline">{t("hub.collaborate.outcomes.all")}</a></p>
						)}
						{o.outcomesAll && (
							<p className="mt-3"><a href="/collaborate#outcomes" className="text-sm font-semibold text-info underline">{t("hub.collaborate.outcomes.fewer")}</a></p>
						)}
					</HubSection>

					<HubSection id="plans" kicker={t("hub.collaborate.plans.k")} title={t("hub.collaborate.plans.t")} count={o.plans.length}>
						{o.plans.length > 0 ? (
							<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.plan")}</th>
										<th className={thCls}>{t("col.places")}</th>
										<th className={thCls}>{t("col.ask")}</th>
									</tr></thead>
									<tbody>
										{o.plans.map((p) => {
											const pn = p.nodes?.length ? p.nodes : o.nodes.filter((n) => n.source === p.source);
											const places = new Set(pn.map((n) => n.placeId).filter((x): x is string => !!x));
											const budget = pn.reduce((s, n) => s + (n.budget ?? 0), 0);
											const gaps = [
												pn.filter((n) => !n.placeId && !n.h3).length && "place",
												pn.filter((n) => !n.timeframe.from).length && "timeframe",
												pn.filter((n) => !n.orgIds.length).length && "owner",
												!budget && "budget",
											].filter(Boolean).join(", ");
											return (
												<tr key={p.id ?? p.source}>
													<td className={tdCls}>
														<strong>{p.title}</strong>
														<br /><small className="text-muted">{p.source}{gaps ? ` · ${t("hub.collaborate.plans.missing")} ${gaps}` : ""}</small>
													</td>
													<td className={tdCls}>{[...places].slice(0, 4).join(", ") || "—"}</td>
													<td className={tdCls}>{money(budget)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						) : (
							<p className={emptyCls}>{t("hub.collaborate.plans.none")}</p>
						)}
					</HubSection>

					<HubSection id="commons" kicker={t("hub.collaborate.commons.k")} title={t("hub.collaborate.commons.t")} count={o.resources.length} lede={t("hub.collaborate.commons.lede")}>
						{o.resources.length > 0 ? (
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{o.resources.map((r) => (
									<div key={r.id} className={cardCls}>
										<h3 className="font-display text-lg">{r.label}</h3>
										<p className="mt-1 text-sm text-muted">
											<ActorName id={r.owner} /> · {r.timesContributed} {t("hub.collaborate.commons.times")}
											{r.capacity ? ` · ${r.capacity}` : ""}
										</p>
										{r.terms && <p className="mt-1 text-xs text-muted">{r.terms}</p>}
									</div>
								))}
							</div>
						) : (
							<p className={emptyCls}>{t("hub.collaborate.commons.none")}</p>
						)}
					</HubSection>

					<HubSection id="network" kicker={t("hub.collaborate.network.k")} title={t("hub.collaborate.network.t")} count={o.network?.edges.length ?? 0}>
						{o.network?.edges.length ? (
							<>
								<p className="mb-4 text-sm text-muted">{t("hub.collaborate.network.lede")}</p>
								<NetworkSvg g={o.network} />
							</>
						) : (
							<p className={emptyCls}>{t("hub.collaborate.network.none")}</p>
						)}
					</HubSection>

					<HubSection id="ask" kicker={t("hub.collaborate.ask.k")} title={t("hub.collaborate.ask.t")} lede={t("hub.collaborate.ask.lede")}>
						<form method="get" action="/collaborate#ask" className="flex max-w-2xl gap-2">
							<input type="search" name="q" defaultValue={o.ask?.q ?? ""} placeholder={t("hub.collaborate.ask.placeholder")} aria-label={t("hub.collaborate.ask.t")} className={field} />
							<button type="submit" className={submit}>{t("hub.collaborate.ask.button")}</button>
						</form>
						{o.ask?.out && (
							<div className={`${cardCls} mt-4`}>
								<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{o.ask.out.intent}</span>
								<p className="mt-2 text-sm">{o.ask.out.answer}</p>
								{(o.ask.out.citedNodeIds.length > 0 || o.ask.out.citedOverlapIds.length > 0) && (
									<p className="mt-2 text-xs text-muted">
										{t("hub.collaborate.ask.cited")}{" "}
										{[...o.ask.out.citedOverlapIds, ...o.ask.out.citedNodeIds].map((id) => (
											<code key={id} className="mr-1 rounded bg-pale px-1 py-0.5">{id}</code>
										))}
									</p>
								)}
							</div>
						)}
						<p className="mt-6 text-sm text-muted">{t("hub.collaborate.search.lede")}</p>
						<form method="get" action="/search" className="mt-2 flex max-w-2xl gap-2">
							<input type="search" name="q" placeholder={t("hub.collaborate.search.placeholder")} aria-label={t("hub.collaborate.search.t")} className={field} />
							<button type="submit" className={submit}>{t("hub.collaborate.search.button")}</button>
						</form>
					</HubSection>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
