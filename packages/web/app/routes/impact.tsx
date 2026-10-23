import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/impact";
import type { renderImpactPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, HubNav, HubSection, HowNote, StatGrid, emptyCls, cardCls, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderImpactPage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Impact — Springforth" }];
}

const MONEY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const RESULT_KEYS = [
	["possibilities", "metric.possibilities"],
	["activated", "metric.activated"],
	["quorumRate", "metric.quorum"],
	["completionRate", "metric.completed"],
	["evidenceCoverage", "metric.evidence"],
	["declaredHoursTotal", "metric.hours"],
	["complementsConfirmed", "metric.matched"],
	["successfulCoordinationsPerWeek", "metric.coordinations"],
	["expiringSoon", "metric.closing"],
] as const;
const RATE_FIELDS = new Set(["quorumRate", "completionRate", "evidenceCoverage"]);

export default function Impact({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();

	const stats = RESULT_KEYS.map(([f, key]) => {
		const v = Number(o.metrics[f] ?? 0);
		return { v: RATE_FIELDS.has(f) ? `${Math.round(v * 100)}%` : MONEY.format(v), l: t(key) };
	});

	const vals = o.metrics.valueByCurrency ?? {};
	const attCount = new Map<string, number>();
	for (const a of o.attestations)
		if (a.claimId) attCount.set(a.claimId, (attCount.get(a.claimId) ?? 0) + 1);
	const nodeLabel = new Map(o.nodes.map((n) => [n.id, n.label]));
	const latest = [...o.checks].sort((x, y) => Date.parse(y.at) - Date.parse(x.at)).slice(0, 20);

	const possById = new Map(o.possibilities.map((p) => [p.id, p]));
	const lines = tickerLinesLocal(o.events, possById, 10, t);

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main">
				<HubHead kicker={t("hub.impact.kicker")} title={t("hub.impact.h1")} em={t("hub.impact.h1.em")} lede={t("hub.impact.lede")} />
				<div className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
					<HubNav items={["results", "value", "claims", "evidence", "proof", "data"].map((id) => ({
						href: `#${id}`, label: t(`hub.impact.${id}.t`),
					}))} />

					<HubSection id="results" kicker={t("hub.impact.results.k")} title={t("hub.impact.results.t")}>
						<StatGrid items={stats} />
						<p className="mt-3 text-xs text-muted">{t("metric.benchmark")}</p>
					</HubSection>

					<HubSection id="value" kicker={t("hub.impact.value.k")} title={t("hub.impact.value.t")} count={Object.keys(vals).length} lede={t("hub.impact.value.lede")}>
						{Object.keys(vals).length > 0 ? (
							<>
								<div tabIndex={0} role="region" aria-label={`${t("hub.impact.value.t")} — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
									<table className={tableCls}>
										<thead><tr>
											<th className={thCls}>{t("col.currency")}</th>
											<th className={thCls}>{t("val.committed")}</th><th className={thCls}>{t("val.matched")}</th>
											<th className={thCls}>{t("val.inKind")}</th><th className={thCls}>{t("val.volunteer")}</th>
											<th className={thCls}>{t("val.total")}</th><th className={thCls}>{t("val.risk")}</th>
											<th className={thCls}>{t("val.leverage")}</th><th className={thCls}>{t("val.cap")}</th>
										</tr></thead>
										<tbody>
											{Object.entries(vals).map(([cur, r]) => (
												<tr key={cur}>
													<td className={tdCls}><strong>{cur}</strong></td>
													<td className={tdCls}>{MONEY.format(r.committed ?? 0)}</td>
													<td className={tdCls}>{MONEY.format(r.matched ?? 0)}</td>
													<td className={tdCls}>{MONEY.format(r.inKind ?? 0)}</td>
													<td className={tdCls}>{MONEY.format(r.volunteerTime ?? 0)}</td>
													<td className={tdCls}><strong>{MONEY.format(r.total ?? 0)}</strong></td>
													<td className={tdCls}>{MONEY.format(r.riskAvoided ?? 0)}</td>
													<td className={tdCls}>{r.leverage ?? 0}×</td>
													<td className={`${tdCls} text-xs text-muted`}>
														{r.capitals ? (
															<>
																{r.capitals.financial > 0 && <>{MONEY.format(r.capitals.financial)} {t("val.cap.financial")}<br /></>}
																{r.capitals.human > 0 && <>{MONEY.format(r.capitals.human)} {t("val.cap.human")}<br /></>}
																{r.capitals.social > 0 && <>{MONEY.format(r.capitals.social)} {t("val.cap.social")}<br /></>}
																{r.capitals.natural > 0 && <>{MONEY.format(r.capitals.natural)} {t("val.cap.natural")}</>}
															</>
														) : "—"}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<details className="mt-4 rounded-xl border border-line">
									<summary className="cursor-pointer p-3 text-sm font-semibold text-info">{t("hub.impact.value.more")}</summary>
									<div className="border-t border-line p-4">
										<table className={tableCls}>
											<thead><tr>
												<th className={thCls}>{t("col.currency")}</th>
												<th className={thCls}>{t("val.asked")}</th>
												<th className={thCls}>{t("val.riskPerUnit")}</th>
											</tr></thead>
											<tbody>
												{Object.entries(vals).map(([cur, r]) => (
													<tr key={cur}>
														<td className={tdCls}><strong>{cur}</strong></td>
														<td className={tdCls}>{MONEY.format(r.asked ?? 0)}</td>
														<td className={tdCls}>{r.riskPerUnit ? MONEY.format(r.riskPerUnit) : "—"}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</details>
							</>
						) : (
							<p className={emptyCls}>{t("hub.impact.value.none")}</p>
						)}
					</HubSection>

					<HubSection id="claims" kicker={t("hub.impact.claims.k")} title={t("hub.impact.claims.t")} count={o.claims.length} lede={t("hub.impact.claims.lede")}>
						{o.claims.length > 0 ? (
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{o.claims.map((c) => (
									<div key={c.id} className={cardCls}>
										<h3 className="font-display text-lg">
											<Link to={`/claims/${c.id}`} className="hover:underline">{c.workScope}</Link>
										</h3>
										<div className="mt-2 flex flex-wrap gap-1.5">
											<Badge>{t(`status.${c.state}`)}</Badge>
											<Badge>{attCount.get(c.id) ?? 0} {t("hub.impact.claims.atts")}</Badge>
											{c.timeframe.from && (
												<Badge>{c.timeframe.from.slice(0, 10)}{c.timeframe.to ? ` → ${c.timeframe.to.slice(0, 10)}` : ""}</Badge>
											)}
										</div>
										{c.possibilityId && (
											<p className="mt-2 text-sm">
												<Link to={`/possibilities?card=${c.possibilityId}`} className="text-info underline">
													{t("hub.impact.claims.source")} →
												</Link>
											</p>
										)}
									</div>
								))}
							</div>
						) : (
							<p className={emptyCls}>{t("hub.impact.claims.none")}</p>
						)}
					</HubSection>

					<HubSection id="evidence" kicker={t("hub.impact.evidence.k")} title={t("hub.impact.evidence.t")} count={o.checks.length} lede={t("hub.impact.evidence.lede")}>
						{latest.length > 0 ? (
							<div tabIndex={0} role="region" aria-label={`${t("hub.impact.evidence.t")} — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.result")}</th><th className={thCls}>{t("col.source")}</th>
										<th className={thCls}>{t("col.target")}</th><th className={thCls}>{t("col.method")}</th>
										<th className={thCls}>{t("col.date")}</th>
									</tr></thead>
									<tbody>
										{latest.map((c, i) => (
											<tr key={i}>
												<td className={tdCls}>
													<Badge variant={c.result === "match" ? "lime" : c.result === "mismatch" ? "coral" : "default"}>{c.result}</Badge>
												</td>
												<td className={`${tdCls} text-muted`}>{c.source}</td>
												<td className={tdCls}>{c.nodeId ? nodeLabel.get(c.nodeId) ?? c.nodeId : "—"}</td>
												<td className={`${tdCls} text-xs text-muted`}>{c.methodologyRef ?? "—"}</td>
												<td className={`${tdCls} text-muted`}>{c.at.slice(0, 10)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className={emptyCls}>{t("hub.impact.evidence.none")}</p>
						)}
						{o.sources.length > 0 && (
							<details className="mt-4 rounded-xl border border-line">
								<summary className="cursor-pointer p-3 text-sm font-semibold text-info">
									{t("hub.impact.evidence.sources")} ({o.sources.length})
								</summary>
								<ul className="space-y-1.5 border-t border-line p-4 text-sm">
									{o.sources.map((s) => (
										<li key={s.key}>
											<strong>{s.name}</strong>{" "}
											<span className="text-muted">
												— {s.license}
												{s.methodology ? ` · ${s.methodology}` : ""}
												{s.configured ? "" : ` · ${t("hub.impact.evidence.unconfigured")}`}
												{s.lastFetch ? ` · ${s.lastFetch.slice(0, 10)}` : ""}
											</span>
										</li>
									))}
								</ul>
							</details>
						)}
						<HowNote noteKey="how.impact.evidence" anchor="s6" />
					</HubSection>

					<HubSection id="proof" kicker={t("hub.impact.proof.k")} title={t("hub.impact.proof.t")}>
						<p className="text-sm">
							{o.verify.ok ? (
								<strong className="flex items-center gap-1 text-ok"><Check className="size-4" aria-hidden />{t("hub.impact.proof.ok")}</strong>
							) : (
								<strong className="flex items-center gap-1 text-coral-ink"><X className="size-4" aria-hidden />{t("hub.impact.proof.broken")} {o.verify.brokenAt ?? "?"}</strong>
							)}
							{o.verify.ok && <> — {o.verify.events ?? 0} {t("hub.impact.proof.events")}</>}
						</p>
						{lines.length > 0 ? (
							<ul className="mt-3 space-y-1 text-sm">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
						) : (
							<p className="mt-3 text-sm text-muted">{t("ticker.empty")}</p>
						)}
						<p className="mt-3 text-sm">
							<Link to="/ledger" className="font-semibold text-info underline">{t("hub.impact.proof.browse")} →</Link>{" "}
							· <Link to="/ledger/verify" className="font-semibold text-info underline">{t("hub.impact.proof.verify")} →</Link>
						</p>
						<HowNote noteKey="how.impact.ledger" anchor="s6" />
					</HubSection>

					<HubSection id="data" kicker={t("hub.impact.data.k")} title={t("hub.impact.data.t")} count={o.releases.length} lede={t("hub.impact.data.lede")}>
						{o.sources.length > 0 && (
							<div tabIndex={0} role="region" aria-label={`${t("hub.impact.data.t")} · sources — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.source")}</th><th className={thCls}>{t("col.license")}</th>
										<th className={thCls}>{t("col.method")}</th><th className={thCls}>{t("col.status")}</th>
										<th className={thCls}>{t("col.date")}</th>
									</tr></thead>
									<tbody>
										{o.sources.map((s) => (
											<tr key={s.key}>
												<td className={tdCls}><strong>{s.name}</strong></td>
												<td className={`${tdCls} text-muted`}>{s.license}</td>
												<td className={`${tdCls} text-xs text-muted`}>{s.methodology ?? "—"}</td>
												<td className={tdCls}>
													{s.configured
														? <Badge variant="lime">{t("hub.impact.data.src.live")}</Badge>
														: <Badge>{t("hub.impact.data.src.gated")} <code>{s.needs ?? ""}</code></Badge>}
												</td>
												<td className={`${tdCls} text-muted`}>{s.lastFetch ? s.lastFetch.slice(0, 10) : "—"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						<h3 className="mt-6 font-display text-xl">{t("hub.impact.data.releases")}</h3>
						{o.releases.length > 0 ? (
							<div tabIndex={0} role="region" aria-label={`${t("hub.impact.data.releases")} — ${t("a11y.tableScroll")}`} className="mt-2 overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.source")}</th><th className={thCls}>{t("col.records")}</th>
										<th className={thCls}>sha256</th><th className={thCls}>{t("col.date")}</th>
									</tr></thead>
									<tbody>
										{o.releases.map((r) => (
											<tr key={r.id}>
												<td className={tdCls}><strong>{r.name}</strong><br /><small className="text-muted">{r.id}</small></td>
												<td className={tdCls}>{r.records}</td>
												<td className={`${tdCls} text-muted`}><code>{r.sha256.slice(0, 16)}…</code></td>
												<td className={`${tdCls} text-muted`}>{r.createdAt.slice(0, 10)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="mt-2 text-sm text-muted">{t("hub.impact.data.none")}</p>
						)}
						{Object.keys(o.slices).length > 0 && (
							<>
								<h3 className="mt-6 font-display text-xl">{t("hub.impact.data.available")}</h3>
								<ul className="mt-2 space-y-1 text-sm">
									{Object.entries(o.slices).map(([k, d]) => (
										<li key={k}><code>{k}</code> — {d}</li>
									))}
								</ul>
							</>
						)}
					</HubSection>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}

// Minimal tickerLines port — humanized "actor did kind" lines.
function tickerLinesLocal(
	events: { seq: number; at: string; actor: string; kind: string }[],
	possById: Map<string, { title?: string }>,
	n: number,
	t: (k: string) => string,
): string[] {
	return events.slice(-n).reverse().map((e) => {
		const label = e.kind.replace(/\./g, " ");
		return `#${e.seq} · ${e.at.slice(0, 10)} — ${e.actor} · ${label}`;
	});
}
