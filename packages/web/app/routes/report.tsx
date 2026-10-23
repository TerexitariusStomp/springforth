import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/report";
import type { renderReportPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderReportPage>>(context, request);
	return { i: input };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `Field report — ${data?.i?.possibility?.title ?? ""}` }];
}

export default function Report({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { possibility: p, participants, nodes, checks, appreciations, claim, trajectories } = o;
	const seats = o.seats ?? [];
	const posts = o.posts ?? [];
	const { t } = useTranslation();

	const label = new Map(nodes.map((n) => [n.id, n.label]));
	const checksByNode = new Map<string, typeof checks>();
	for (const c of checks) {
		if (!c.nodeId) continue;
		if (!checksByNode.has(c.nodeId)) checksByNode.set(c.nodeId, []);
		checksByNode.get(c.nodeId)!.push(c);
	}
	const byRole = new Map<string, string[]>();
	for (const s of seats) {
		if (!byRole.has(s.role)) byRole.set(s.role, []);
		byRole.get(s.role)!.push(s.actor);
	}

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-4xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.report.kicker")} title={p.title}
					back={{ href: "/possibilities", label: t("nav.possibilities") }}
				/>
				<p className="mt-3 text-sm text-muted">
					{p.place ?? ""} · {t("detail.report.declaredBy")} <ActorName id={p.declarerId} /> ·{" "}
					{t("detail.report.status")} {p.status}
				</p>

				{p.report ? (
					<div className="mt-6 rounded-2xl border border-line bg-card p-6">
						<h2 className="font-display text-2xl">{t("detail.report.happened")}</h2>
						<p className="mt-3">{p.report.summary}</p>
						<p className="mt-2"><strong>{t("detail.report.evidence")}:</strong> {p.report.evidence}</p>
						<p className="mt-2"><strong>{t("detail.report.learnings")}:</strong> {p.report.learnings}</p>
					</div>
				) : (
					<p className="mt-6 italic text-muted">{t("detail.report.none")}</p>
				)}

				<h2 className="mt-10 font-display text-2xl">{t("detail.report.who")}</h2>
				<p className="mt-2 text-sm">
					{participants.length} {t("detail.report.people")}:{" "}
					{participants.map((x, i) => <span key={i}>{i > 0 && ", "}<ActorName id={x.actor} /></span>) || "—"}
				</p>

				<h2 className="mt-10 font-display text-2xl">{t("detail.report.readings")}</h2>
				<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="mt-3 overflow-x-auto">
					<table className={tableCls}>
						<thead><tr>
							<th className={thCls}>{t("col.target")}</th>
							<th className={thCls}>{t("col.readings")}</th>
							<th className={thCls}>{t("col.result")}</th>
							<th className={thCls}>{t("col.trend")}</th>
						</tr></thead>
						<tbody>
							{[...checksByNode.entries()].map(([nid, cs]) => {
								const tj = trajectories.find((x) => x.nodeId === nid);
								const refs = [...new Set(cs.map((c) => c.methodologyRef).filter((x): x is string => !!x))];
								return (
									<tr key={nid}>
										<td className={tdCls}>
											{label.get(nid) ?? nid}
											{refs.length > 0 && <><br /><small className="text-muted">{refs.join(" · ")}</small></>}
										</td>
										<td className={tdCls}>{cs.length}</td>
										<td className={tdCls}>
											{cs.filter((c) => c.result === "match").length} {t("misc.match")} /{" "}
											{cs.filter((c) => c.result === "mismatch").length} {t("misc.mismatch")}
										</td>
										<td className={tdCls}>
											{tj
												? `${tj.slopePerDay > 0 ? "+" : ""}${tj.slopePerDay}/day${tj.daysToThreshold != null ? ` · ~${tj.daysToThreshold}d ${t("detail.report.toThreshold")}` : ""}`
												: "—"}
										</td>
									</tr>
								);
							})}
							{checksByNode.size === 0 && (
								<tr><td colSpan={4} className={`${tdCls} italic text-muted`}>{t("detail.report.noReadings")}</td></tr>
							)}
						</tbody>
					</table>
				</div>

				<h2 className="mt-10 font-display text-2xl">{t("detail.report.appreciations")}</h2>
				<ul className="mt-2 space-y-1.5 text-sm">
					{appreciations.length > 0 ? appreciations.map((a, i) => (
						<li key={i}>
							<strong><ActorName id={a.fromActor} /></strong> → <strong><ActorName id={a.toActor} /></strong>
							{a.note ? <> — <em>“{a.note}”</em></> : null}
						</li>
					)) : <li className="italic text-muted">{t("detail.report.noneRecorded")}</li>}
				</ul>

				{(seats.length > 0 || posts.length > 0) && (
					<>
						<h2 className="mt-10 font-display text-2xl">{t("detail.report.council")}</h2>
						{byRole.size > 0 && (
							<ul className="mt-2 space-y-1 text-sm">
								{[...byRole.entries()].map(([role, actors]) => (
									<li key={role}>
										<strong>{t(`council.role.${role}`)}</strong>
										{role === "verifier" && <span className="text-muted"> ({t("council.selfDeclared")})</span>} —{" "}
										{actors.map((a, i) => <span key={i}>{i > 0 && ", "}<ActorName id={a} /></span>)}
									</li>
								))}
							</ul>
						)}
						{posts.length > 0 && (
							<ul className="mt-3 space-y-1.5 text-sm">
								{posts.map((fp) => (
									<li key={fp.id}>
										<Badge>{t(`forum.k.${fp.kind}`)}</Badge> <strong><ActorName id={fp.actor} /></strong> — {fp.text}{" "}
										<span className="text-muted">{fp.at.slice(0, 10)}</span>
									</li>
								))}
							</ul>
						)}
					</>
				)}

				{claim && (
					<>
						<h2 className="mt-10 font-display text-2xl">{t("detail.report.claim")}</h2>
						<p className="mt-2 text-sm">
							{t("detail.report.claimWord")} <code>{claim.id}</code> — {t("detail.report.state")}{" "}
							<strong>{claim.state}</strong> — {claim.oracleCheckIds.length} {t("detail.report.checksCited")};{" "}
							{claim.contributors.length} {t("detail.report.contributors")}.
							<details className="mt-2">
								<summary className="cursor-pointer text-info">{t("detail.data")}</summary>
								<a href={`/claims/${claim.id}?format=lexicon`} className="text-info underline">
									{t("detail.report.lexicon")}
								</a>
							</details>
						</p>
					</>
				)}

				<p className="mt-10 text-sm text-muted">
					<Link to={`/possibilities?card=${p.id}`} className="text-info underline">{t("detail.report.card")}</Link> ·{" "}
					{t("detail.report.generated")} {new Date().toISOString()}
				</p>
			</main>
			<SiteFooter />
		</div>
	);
}
