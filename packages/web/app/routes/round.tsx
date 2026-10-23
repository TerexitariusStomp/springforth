import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/round";
import type { renderRoundPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, field, submit, tableCls, thCls, tdCls } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [round, donations, allocation, nodes] =
		await fetchUI<Parameters<typeof renderRoundPage>>(context, request);
	return { round, donations, allocation, nodes };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.round?.title ?? "Round"} — Springforth` }];
}

const MONEY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function Round({ loaderData }: Route.ComponentProps) {
	const { round, donations, allocation, nodes } = loaderData;
	const { t } = useTranslation();
	const label = new Map(nodes.map((n) => [n.id, n.label]));
	const maxTotal = Math.max(...allocation.map((a) => a.total), 1);
	const donors = new Set(donations.map((d) => d.donor)).size;

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-6xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.round.kicker")} title={round.title}
					back={{ href: "/fund#rounds", label: t("nav.fund") }}
				/>
				<p className="mt-3 text-sm text-muted">
					{round.description} {t("detail.round.matchingFund")}:{" "}
					<strong>{round.matchingFund.currency} {MONEY.format(round.matchingFund.amount)}</strong> ·{" "}
					{t("detail.round.state")} <strong>{t(`status.${round.state}`)}</strong> ·{" "}
					{t("detail.round.mechanism")}{" "}
					<strong>
						{round.matchingMode === "pairwise" ? t("detail.round.pairwise") : t("detail.round.quadratic")}
						{round.conviction ? ` + ${t("detail.round.conviction")}` : ""}
					</strong>{" "}
					· {t("detail.round.closes")} {round.closesAt.slice(0, 10)} · {donations.length} {t("misc.donations")}{" "}
					{t("misc.from")} {donors} {t("misc.donors")}.
				</p>
				<p className="mt-2 text-sm">{t("detail.round.matchNote")}</p>

				<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="mt-6 overflow-x-auto">
					<table className={tableCls}>
						<thead><tr>
							<th className={thCls}>{t("col.need")}</th><th className={thCls}>{t("col.donors")}</th>
							<th className={thCls}>{t("col.given")}</th><th className={thCls}>{t("col.match")}</th>
							<th className={thCls}>{t("col.total")}</th><th className={thCls}>{t("col.donate")}</th>
						</tr></thead>
						<tbody>
							{allocation.map((a) => {
								const pct = Math.round((a.total / maxTotal) * 100);
								return (
									<tr key={a.needNodeId}>
										<td className={tdCls}>{label.get(a.needNodeId) ?? a.needNodeId}</td>
										<td className={tdCls}>{a.donorCount}</td>
										<td className={tdCls}>{MONEY.format(a.donations)}</td>
										<td className={tdCls}>{MONEY.format(a.match)}</td>
										<td className={tdCls}>
											<div className="flex items-center gap-2">
												<div className="size-24 overflow-hidden rounded-full bg-line/60">
													<div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
												</div>
												{MONEY.format(a.total)}
											</div>
										</td>
										<td className={tdCls}>
											<form method="post" action={`/rounds/${round.id}/donate`} className="flex gap-1.5">
												<input type="hidden" name="needNodeId" value={a.needNodeId} />
												<input name="donor" placeholder={t("form.name")} required aria-label={t("form.name")} className={`${field} max-w-32`} />
												<input name="amount" type="number" min="1" step="any" placeholder={t("col.amount")} required aria-label={t("col.amount")} className={`${field} max-w-20`} />
												<button disabled={round.state !== "open"} className={`${submit} disabled:opacity-40`}>
													{t("col.donate").toLowerCase()}
												</button>
											</form>
										</td>
									</tr>
								);
							})}
							{allocation.length === 0 && (
								<tr><td colSpan={6} className={`${tdCls} italic text-muted`}>{t("detail.round.noNeeds")}</td></tr>
							)}
						</tbody>
					</table>
				</div>
				<p className="mt-6 text-sm text-muted">
					<a href="/fund#rounds" className="text-info underline">{t("detail.round.allRounds")}</a> ·{" "}
					<Link to={`/rounds/${round.id}/admin`} className="text-info underline">{t("detail.round.operator")}</Link>
				</p>
				<details className="mt-4 rounded-xl border border-line">
					<summary className="cursor-pointer p-3 text-sm font-semibold text-info">{t("detail.data")}</summary>
					<div className="border-t border-line p-4">
						<a href={`/rounds/${round.id}?format=json`} className="text-info underline">JSON</a>
					</div>
				</details>
			</main>
			<SiteFooter />
		</div>
	);
}
