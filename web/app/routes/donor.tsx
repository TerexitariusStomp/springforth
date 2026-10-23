import { useTranslation } from "react-i18next";
import type { Route } from "./+types/donor";
import type { renderDonorPage, DonorPageInput } from '../../../src/portal/index';
import { displayNameText } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, tableCls, thCls, tdCls } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input, lang] = await fetchUI<Parameters<typeof renderDonorPage>>(context, request);
	return { i: input as DonorPageInput, lang };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.i?.donor ? displayNameText(data.i.donor) : "Donor"} — Springforth` }];
}

export default function Donor({ loaderData }: Route.ComponentProps) {
	const { i } = loaderData;
	const { t } = useTranslation();
	const total = i.donations.reduce((a, d) => a + d.amount, 0);
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-4xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.donor.kicker")} title={displayNameText(i.donor)}
					back={{ href: `/rounds/${i.roundId}`, label: t("detail.round.kicker") }}
				/>
				<p className="mt-3 text-sm text-muted">
					{i.donations.length} {t("detail.donor.donations")}, {total} {t("detail.donor.total")},{" "}
					{t("detail.donor.inRound")}{" "}
					<a href={`/rounds/${i.roundId}`} className="text-info underline">{i.roundId}</a>.
				</p>
				<table className={`${tableCls} mt-4`}>
					<thead><tr>
						<th className={thCls}>{t("col.need")}</th><th className={thCls}>{t("col.amount")}</th>
						<th className={thCls}>{t("col.settlement")}</th><th className={thCls}>{t("col.date")}</th>
					</tr></thead>
					<tbody>
						{i.donations.map((d, idx) => (
							<tr key={idx}>
								<td className={tdCls}>{d.needNodeId}</td>
								<td className={tdCls}>{d.amount} {d.currency}</td>
								<td className={`${tdCls} text-muted`}>{d.settlement}</td>
								<td className={`${tdCls} text-muted`}>{d.at.slice(0, 10)}</td>
							</tr>
						))}
					</tbody>
				</table>
				<h2 className="mt-10 font-display text-2xl">{t("detail.donor.receipts")}</h2>
				<table className={`${tableCls} mt-2`}>
					<thead><tr><th className={thCls}>{t("col.receipt")}</th><th className={thCls}>{t("col.uid")}</th></tr></thead>
					<tbody>
						{i.receipts.map((a) => (
							<tr key={a.id}>
								<td className={tdCls}><code>{a.id}</code></td>
								<td className={`${tdCls} text-muted`}>
									{a.uid ? <code>{a.uid.slice(0, 16)}…</code> : t("detail.donor.ledgerRecorded")}
								</td>
							</tr>
						))}
						{i.receipts.length === 0 && (
							<tr><td colSpan={2} className={`${tdCls} italic text-muted`}>{t("detail.donor.noReceipts")}</td></tr>
						)}
					</tbody>
				</table>
			</main>
			<SiteFooter />
		</div>
	);
}
