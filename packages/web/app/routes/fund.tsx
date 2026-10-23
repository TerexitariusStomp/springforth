import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/fund";
import type { renderFundPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, HubNav, HubSection, HowNote, emptyCls, cardCls, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderFundPage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Fund — Springforth" }];
}

const MONEY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtMap = (o: Record<string, number>) =>
	Object.entries(o).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${MONEY.format(Math.round(v * 100) / 100)}`).join(" · ");

export default function Fund({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();
	const possTitle = new Map(o.possibilities.map((p) => [p.id, p.title]));

	const byCur = new Map<string, number>();
	for (const d of o.donations) byCur.set(d.currency, (byCur.get(d.currency) ?? 0) + d.amount);
	const totals = [...byCur.entries()].map(([c, a]) => `${c} ${MONEY.format(a)}`).join(" · ");
	const open = o.rounds.filter((r) => !r.endowment);

	const accruedStr = o.endowment ? fmtMap(o.endowment.accrued) : "";
	const principalStr = o.endowment ? fmtMap(o.endowment.principal) : "";

	const sections = [
		["rounds", open.length],
		["pledges", o.pledges.length],
		["retro", o.retroRounds.length],
		["streams", o.streams.length + o.yieldStreams.length],
		["endowment", undefined],
	] as const;

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main">
				<HubHead kicker={t("hub.fund.kicker")} title={t("hub.fund.h1")} em={t("hub.fund.h1.em")} lede={t("hub.fund.lede")} />
				<div className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
					<HubNav items={sections.map(([id]) => ({ href: `#${id}`, label: t(`hub.fund.${id}.t`) }))} />

					<HubSection id="rounds" kicker={t("hub.fund.rounds.k")} title={t("hub.fund.rounds.t")} count={open.length} lede={t("hub.fund.rounds.lede")}>
						{totals && (
							<p className="mb-4 text-sm text-muted">
								{t("hub.fund.rounds.committed")} <strong>{totals}</strong> — {t("hub.fund.rounds.converted")}.
							</p>
						)}
						<div className="grid gap-4 md:grid-cols-2">
							{open.map((r) => {
								const g = o.gates.get(r.id);
								return (
									<div key={r.id} className={cardCls}>
										<h3 className="font-display text-xl">
											<Link to={`/rounds/${r.id}`} className="hover:underline">{r.title}</Link>
										</h3>
										<div className="mt-2 flex flex-wrap gap-1.5">
											<Badge>{t(`status.${r.state}`)}</Badge>
											<Badge>{r.matchingFund.currency} {MONEY.format(r.matchingFund.amount)}</Badge>
											<Badge>{r.eligibleNeedIds.length} {t("col.needs").toLowerCase()}</Badge>
											{g?.gated && (g.active ? (
												<Badge variant="lime">
													{t("hub.fund.rounds.demandMet")} — {g.backers.length} {t("hub.fund.rounds.backers")} · {MONEY.format(g.pledged)} {t("hub.fund.rounds.pledged")}
												</Badge>
											) : (
												<Badge variant="gold">
													{t("hub.fund.rounds.matchingLocked")} — {g.backers.length}/{g.minBackers} {t("hub.fund.rounds.backers")} · {MONEY.format(g.pledged)}/{MONEY.format(g.goal)} {t("hub.fund.rounds.pledged")}
												</Badge>
											))}
											{r.skimBps ? <Badge>{r.skimBps / 100}% {t("hub.fund.rounds.skim")}</Badge> : null}
										</div>
										{r.description && <p className="mt-3 text-sm text-ink-mute">{r.description}</p>}
										<p className="mt-2 text-xs text-muted">{t("col.closes")} {r.closesAt.slice(0, 10)}</p>
									</div>
								);
							})}
						</div>
						{open.length === 0 && <p className={emptyCls}>{t("hub.fund.rounds.none")}</p>}
						<HowNote noteKey="how.fund.rounds" anchor="s5" />
					</HubSection>

					<HubSection id="pledges" kicker={t("hub.fund.pledges.k")} title={t("hub.fund.pledges.t")} count={o.pledges.length} lede={t("hub.fund.pledges.lede")}>
						{o.pledges.length > 0 ? (
							<div tabIndex={0} role="region" aria-label={`${t("hub.fund.rounds.t")} — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.pledger")}</th><th className={thCls}>{t("col.amount")}</th>
										<th className={thCls}>{t("col.possibility")}</th><th className={thCls}>{t("col.state")}</th>
									</tr></thead>
									<tbody>
										{o.pledges.map((p) => (
											<tr key={p.id}>
												<td className={tdCls}><Link to={`/actors/${p.pledger}`} className="text-info underline"><ActorName id={p.pledger} /></Link></td>
												<td className={tdCls}><strong>{MONEY.format(p.amount)} {p.currency}</strong></td>
												<td className={tdCls}>
													<Link to={`/possibilities?card=${p.possibilityId}`} className="text-info underline">
														{possTitle.get(p.possibilityId) ?? p.possibilityId}
													</Link>
												</td>
												<td className={tdCls}><Badge>{t(`state.pledge.${p.state}`)}</Badge></td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className={emptyCls}>{t("hub.fund.pledges.none")}</p>
						)}
						<HowNote noteKey="how.fund.pledges" anchor="s5" />
					</HubSection>

					<HubSection id="retro" kicker={t("hub.fund.retro.k")} title={t("hub.fund.retro.t")} count={o.retroRounds.length} lede={t("hub.fund.retro.lede")}>
						{o.retroRounds.length > 0 ? (
							<div tabIndex={0} role="region" aria-label={`${t("hub.fund.retro.t")} — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.round")}</th><th className={thCls}>{t("col.fund")}</th>
										<th className={thCls}>{t("col.claims")}</th><th className={thCls}>{t("col.ballotClose")}</th>
										<th className={thCls}>{t("col.state")}</th>
									</tr></thead>
									<tbody>
										{o.retroRounds.map((r) => (
											<tr key={r.id}>
												<td className={tdCls}>{r.title || r.id}</td>
												<td className={tdCls}>{r.fund ? `${MONEY.format(r.fund.amount)} ${r.fund.currency}` : "—"}</td>
												<td className={tdCls}>{r.claimIds?.length ?? 0}</td>
												<td className={`${tdCls} text-muted`}>{r.ballotClose.slice(0, 10)}</td>
												<td className={tdCls}><Badge>{t(`status.${r.state}`)}</Badge></td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className={emptyCls}>{t("hub.fund.retro.none")}</p>
						)}
						{o.badgeholders.length > 0 && (
							<p className="mt-3 text-sm text-muted">
								<strong>{t("hub.fund.retro.badgeholders")}:</strong>{" "}
								{o.badgeholders.map((b, i) => (
									<span key={b}>{i > 0 && " · "}<Link to={`/actors/${b}`} className="text-info underline"><ActorName id={b} /></Link></span>
								))}
							</p>
						)}
						<HowNote noteKey="how.fund.retro" anchor="s5" />
					</HubSection>

					<HubSection id="streams" kicker={t("hub.fund.streams.k")} title={t("hub.fund.streams.t")} count={o.streams.length + o.yieldStreams.length} lede={t("hub.fund.streams.lede")}>
						{o.streams.length > 0 && (
							<div tabIndex={0} role="region" aria-label={`${t("hub.fund.streams.t")} — ${t("a11y.tableScroll")}`} className="mb-6 overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.supporter")}</th><th className={thCls}>{t("col.round")}</th>
										<th className={thCls}>{t("col.flow")}</th><th className={thCls}>{t("col.state")}</th>
									</tr></thead>
									<tbody>
										{o.streams.map((s) => (
											<tr key={s.id}>
												<td className={tdCls}><Link to={`/actors/${s.supporter}`} className="text-info underline"><ActorName id={s.supporter} /></Link></td>
												<td className={tdCls}><Link to={`/rounds/${s.roundId}`} className="text-info underline">{s.roundId}</Link></td>
												<td className={`${tdCls} text-muted`}><code>{s.flowRate}</code>/s</td>
												<td className={tdCls}><Badge>{t(`status.${s.state}`)}</Badge></td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						{o.yieldStreams.length > 0 && (
							<div tabIndex={0} role="region" aria-label={`${t("hub.fund.streams.t")} · yield — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.supporter")}</th><th className={thCls}>{t("col.round")}</th>
										<th className={thCls}>{t("col.source")}</th><th className={thCls}>{t("col.accrued")}</th>
										<th className={thCls}>{t("col.state")}</th>
									</tr></thead>
									<tbody>
										{o.yieldStreams.map((y) => (
											<tr key={y.id}>
												<td className={tdCls}><Link to={`/actors/${y.sponsor}`} className="text-info underline"><ActorName id={y.sponsor} /></Link></td>
												<td className={tdCls}><Link to={`/rounds/${y.roundId}`} className="text-info underline">{y.roundId}</Link></td>
												<td className={`${tdCls} text-muted`}>{y.label}</td>
												<td className={tdCls}>{MONEY.format(y.yieldAccrued)}</td>
												<td className={tdCls}><Badge>{t(`status.${y.state}`)}</Badge></td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						{o.streams.length === 0 && o.yieldStreams.length === 0 && (
							<p className={emptyCls}>{t("hub.fund.streams.none")}</p>
						)}
						<HowNote noteKey="how.fund.streams" anchor="s5" />
					</HubSection>

					<HubSection id="endowment" kicker={t("hub.fund.endowment.k")} title={t("hub.fund.endowment.t")}>
						{accruedStr || principalStr ? (
							<p className="text-sm text-muted">
								{t("hub.fund.endowment.principal")} <strong>{principalStr || "—"}</strong> ·{" "}
								{t("hub.fund.endowment.accrued")} <strong>{accruedStr || "—"}</strong> — {t("hub.fund.endowment.body")}
							</p>
						) : (
							<p className={emptyCls}>{t("hub.fund.endowment.none")}</p>
						)}
					</HubSection>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
