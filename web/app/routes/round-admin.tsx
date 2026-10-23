import { useTranslation } from "react-i18next";
import type { Route } from "./+types/round-admin";
import type { renderRoundAdmin } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, submit, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [round, applications, nodes] =
		await fetchUI<Parameters<typeof renderRoundAdmin>>(context, request);
	return { round, applications, nodes };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.round?.title ?? "Round"} — admin` }];
}

export default function RoundAdmin({ loaderData }: Route.ComponentProps) {
	const { round, applications, nodes } = loaderData;
	const { t } = useTranslation();
	const label = new Map(nodes.map((n) => [n.id, n.label]));
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.admin.kicker")} title={round.title}
					back={{ href: "/fund#rounds", label: t("nav.fund") }}
				/>
				<p className="mt-3 text-sm text-muted">
					{applications.filter((a) => a.state === "pending").length} {t("detail.admin.pending")} ·{" "}
					{t("detail.admin.roundIs")} <strong>{t(`status.${round.state}`)}</strong>
				</p>
				<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="mt-6 overflow-x-auto">
					<table className={tableCls}>
						<thead><tr>
							<th className={thCls}>{t("col.need")}</th><th className={thCls}>{t("col.applicant")}</th>
							<th className={thCls}>{t("col.statement")}</th><th className={thCls}>{t("col.state")}</th>
							<th className={thCls}>{t("col.review")}</th>
						</tr></thead>
						<tbody>
							{applications.map((a) => (
								<tr key={a.id}>
									<td className={tdCls}>{label.get(a.needNodeId) ?? a.needNodeId}</td>
									<td className={tdCls}><ActorName id={a.applicant} /></td>
									<td className={`${tdCls} text-muted`}>{a.statement || "—"}</td>
									<td className={tdCls}><Badge>{t(`status.${a.state}`)}</Badge></td>
									<td className={tdCls}>
										{a.state === "pending" && (
											<div className="flex gap-1.5">
												<form method="post" action={`/rounds/${round.id}/applications/${a.id}/review`}>
													<input type="hidden" name="approve" value="true" />
													<button className={submit}>{t("detail.admin.approve")}</button>
												</form>
												<form method="post" action={`/rounds/${round.id}/applications/${a.id}/review`}>
													<input type="hidden" name="approve" value="false" />
													<button className={submit}>{t("detail.admin.reject")}</button>
												</form>
											</div>
										)}
									</td>
								</tr>
							))}
							{applications.length === 0 && (
								<tr><td colSpan={5} className={`${tdCls} italic text-muted`}>{t("detail.admin.none")}</td></tr>
							)}
						</tbody>
					</table>
				</div>
				{round.state === "open" && (
					<form method="post" action={`/rounds/${round.id}/close`} className="mt-6">
						<button className={submit}>{t("detail.admin.close")}</button>
					</form>
				)}
				<p className="mt-6 text-sm text-muted">
					<a href={`/rounds/${round.id}`} className="text-info underline">{t("detail.admin.backRound")}</a>
				</p>
			</main>
			<SiteFooter />
		</div>
	);
}
