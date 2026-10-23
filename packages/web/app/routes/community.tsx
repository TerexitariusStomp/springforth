import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/community";
import type { renderCommunityPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, HubNav, HubSection, HowNote, field, submit, emptyCls, cardCls, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderCommunityPage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Community — Springforth" }];
}

const PEOPLE_CAP = 24;

export default function Community({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();

	const sorted = [...o.people].sort((a, b) => b.earned - a.earned || b.trustScore - a.trustScore);
	const shown = o.peopleAll ? sorted : sorted.slice(0, PEOPLE_CAP);
	const open = o.proposals.filter((p) => p.state === "open");
	const closed = o.proposals.filter((p) => p.state !== "open");

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main">
				<HubHead kicker={t("hub.community.kicker")} title={t("hub.community.h1")} em={t("hub.community.h1.em")} lede={t("hub.community.lede")} />
				<div className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
					<HubNav items={["people", "trust", "voices", "councils", "decisions"].map((id) => ({
						href: `#${id}`, label: t(`hub.community.${id}.t`),
					}))} />

					<HubSection id="people" kicker={t("hub.community.people.k")} title={t("hub.community.people.t")} count={o.people.length}>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{shown.map((p) => (
								<div key={p.id} className={cardCls}>
									<h3 className="font-display text-lg">
										<Link to={`/actors/${p.id}`} className="hover:underline"><ActorName id={p.id} /></Link>
									</h3>
									<p className="mt-1 text-sm text-muted">
										{p.created} {t("hub.community.people.declared")} · {p.joined} {t("hub.community.people.joined")} ·{" "}
										{p.earned.toFixed(1)} {t("hub.community.people.earned")}
									</p>
								</div>
							))}
						</div>
						{shown.length === 0 && <p className={emptyCls}>{t("hub.community.people.none")}</p>}
						{!o.peopleAll && o.people.length > PEOPLE_CAP && (
							<p className="mt-4"><a href="/community?people=all#people" className="text-sm font-semibold text-info underline">
								{t("hub.community.people.all")} ({o.people.length}) →
							</a></p>
						)}
						{o.peopleAll && (
							<p className="mt-4"><a href="/community#people" className="text-sm font-semibold text-info underline">
								{t("hub.community.people.fewer")} →
							</a></p>
						)}
					</HubSection>

					<HubSection id="trust" kicker={t("hub.community.trust.k")} title={t("hub.community.trust.t")} count={o.mutual.length} lede={t("hub.community.trust.lede")}>
						{o.mutual.length > 0 ? (
							<ul className="space-y-1.5 text-sm">
								{[...o.mutual].sort((a, b) => b.mutual - a.mutual).slice(0, 20).map((m, i) => (
									<li key={i}>
										<Link to={`/actors/${m.from}`} className="text-info underline"><ActorName id={m.from} /></Link> ↔{" "}
										<Link to={`/actors/${m.to}`} className="text-info underline"><ActorName id={m.to} /></Link> —{" "}
										<strong>{m.mutual}</strong> × {t("hub.community.trust.times")}
									</li>
								))}
							</ul>
						) : (
							<p className={emptyCls}>{t("hub.community.trust.none")}</p>
						)}
						<HowNote noteKey="how.community.trust" anchor="s3" />
					</HubSection>

					<HubSection id="voices" kicker={t("hub.community.voices.k")} title={t("hub.community.voices.t")} count={(o.voices ?? []).length} lede={t("hub.community.voices.lede")}>
						{(o.voices ?? []).length > 0 ? (
							<ul className="space-y-2 text-sm">
								{(o.voices ?? []).slice(0, 15).map((v, i) => (
									<li key={i}>
										<em>“{v.note}”</em> —{" "}
										<Link to={`/actors/${v.from}`} className="text-info underline"><ActorName id={v.from} /></Link> →{" "}
										<Link to={`/actors/${v.to}`} className="text-info underline"><ActorName id={v.to} /></Link>
										{v.possibilityId && (
											<> · <Link to={`/possibilities?card=${v.possibilityId}`} className="text-info underline">{t("hub.community.voices.card")}</Link></>
										)}{" "}
										<span className="text-muted">{v.at.slice(0, 10)}</span>
									</li>
								))}
							</ul>
						) : (
							<p className={emptyCls}>{t("hub.community.voices.none")}</p>
						)}
					</HubSection>

					<HubSection id="councils" kicker={t("hub.community.councils.k")} title={t("hub.community.councils.t")} count={(o.councils ?? []).length} lede={t("hub.community.councils.lede")}>
						{(o.councils ?? []).length > 0 ? (
							<ul className="space-y-2 text-sm">
								{(o.councils ?? []).map((c) => (
									<li key={c.possibilityId}>
										<Link to={`/possibilities?card=${c.possibilityId}`} className="font-semibold text-info underline">{c.title}</Link>{" "}
										<Badge>{c.status}</Badge> — {c.seats.length} {t("hub.community.councils.seats")}{" "}
										<span className="text-muted">
											({c.seats.map((s, i) => <span key={i}>{i > 0 && ", "}<ActorName id={s.actor} /></span>)})
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className={emptyCls}>{t("hub.community.councils.none")}</p>
						)}
					</HubSection>

					<HubSection id="decisions" kicker={t("hub.community.decisions.k")} title={t("hub.community.decisions.t")} count={open.length} lede={t("hub.community.decisions.lede")}>
						<p className="mb-3 text-sm text-muted">{o.voters} {t("hub.community.decisions.voters")}</p>
						{o.proposals.length > 0 ? (
							<div tabIndex={0} role="region" aria-label={`${t("hub.community.decisions.t")} — ${t("a11y.tableScroll")}`} className="overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.proposal")}</th><th className={thCls}>{t("col.votes")}</th>
										<th className={thCls}>{t("col.ballotClose")}</th><th className={thCls}>{t("col.state")}</th>
										<th className={thCls}>{t("col.vote")}</th>
									</tr></thead>
									<tbody>
										{[...open, ...closed].map((p) => {
											const bs = o.ballots.filter((b) => b.proposalId === p.id);
											const forW = bs.filter((b) => b.support).reduce((a, b) => a + Math.sqrt(b.points), 0);
											const againstW = bs.filter((b) => !b.support).reduce((a, b) => a + Math.sqrt(b.points), 0);
											return (
												<tr key={p.id}>
													<td className={tdCls}>
														<strong>{p.title}</strong>
														<br />
														<small className="text-muted">
															{p.param} → {p.proposedValue}
															{p.description ? ` · ${p.description}` : ""} — <ActorName id={p.proposer} />
														</small>
													</td>
													<td className={tdCls}>{forW.toFixed(2)} / {againstW.toFixed(2)}</td>
													<td className={`${tdCls} text-muted`}>{p.closesAt.slice(0, 10)}</td>
													<td className={tdCls}><Badge>{t(`status.${p.state}`)}</Badge></td>
													<td className={tdCls}>
														{p.state === "open" && (
															<form method="post" action={`/governance/${p.id}/vote`} className="flex flex-wrap gap-1.5">
																<input name="voter" placeholder={t("form.actor")} aria-label={t("form.actor")} required className={`${field} max-w-28`} />
																<input name="points" type="number" min="1" step="1" defaultValue={1} aria-label={t("form.points")} className={`${field} max-w-16`} />
																<button name="support" value="true" className={submit}>{t("form.for")}</button>
																<button name="support" value="false" className={submit}>{t("form.against")}</button>
															</form>
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						) : (
							<p className="text-sm text-muted">{t("hub.community.decisions.none")}</p>
						)}
						<details className="mt-4">
							<summary className="cursor-pointer text-sm font-semibold text-info">{t("hub.community.decisions.propose")}</summary>
							<form method="post" action="/governance/proposals" className="mt-3 flex max-w-2xl flex-wrap gap-2">
								<select name="param" aria-label={t("col.param")} className={field}>
									{Object.keys(o.governable).map((k) => <option key={k} value={k}>{k}</option>)}
								</select>
								<input name="title" placeholder={t("form.title")} aria-label={t("form.title")} required className={field} />
								<input name="proposedValue" placeholder={t("form.newValue")} aria-label={t("form.newValue")} required className={field} />
								<input name="proposer" placeholder={t("form.actor")} aria-label={t("form.actor")} required className={field} />
								<button className={submit}>{t("form.propose")}</button>
							</form>
						</details>
						{Object.keys(o.governable).length > 0 && (
							<div tabIndex={0} role="region" aria-label={`${t("hub.community.decisions.params")} — ${t("a11y.tableScroll")}`} className="mt-6 overflow-x-auto">
								<table className={tableCls}>
									<thead><tr>
										<th className={thCls}>{t("col.param")}</th><th className={thCls}>{t("col.current")}</th>
										<th className={thCls}>{t("col.meaning")}</th><th className={thCls}>{t("col.setBy")}</th>
									</tr></thead>
									<tbody>
										{Object.entries(o.governable).map(([k, g]) => {
											const cur = o.params.find((p) => p.id === k);
											return (
												<tr key={k}>
													<td className={tdCls}><code>{k}</code></td>
													<td className={tdCls}><strong>{(cur?.value ?? g.default) || "—"}</strong></td>
													<td className={`${tdCls} text-muted`}>{t(`gov.param.${k}`)}</td>
													<td className={`${tdCls} text-muted`}>
														{cur && cur.setBy !== "default"
															? <>{t("hub.community.decisions.setBy")} <code>{cur.setBy}</code></>
															: t("hub.community.decisions.default")}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
						<HowNote noteKey="how.community.gov" anchor="s8" />
					</HubSection>

					<p className="mt-8 text-sm text-muted">
						<a href="https://t.me/springforth_bot" rel="noopener" className="font-semibold text-info underline">
							{t("hub.community.telegram")} →
						</a>{" "}
						— {t("hub.community.telegram.body")}
					</p>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
