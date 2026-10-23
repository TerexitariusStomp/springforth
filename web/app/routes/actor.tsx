import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/actor";
import type { renderActorProfile, ActorProfileInput } from '../../../src/portal/index';
import { displayNameText } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, HowNote, tableCls, thCls, tdCls } from "~/components/hub";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input, lang] = await fetchUI<Parameters<typeof renderActorProfile>>(context, request);
	return { i: input as ActorProfileInput, lang };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.i?.actor ? displayNameText(data.i.actor) : "Actor"} — Springforth` }];
}

export default function Actor({ loaderData }: Route.ComponentProps) {
	const { i } = loaderData;
	const { t } = useTranslation();
	const recs = (i.recognitions ?? []).filter((r) => r.note.trim());
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-4xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.actor.kicker")} title={displayNameText(i.actor)}
					back={{ href: "/community#people", label: t("nav.community") }}
				/>
				<p className="mt-3 text-sm text-muted">{t("detail.actor.id")}: <code>{i.actor}</code></p>

				<table className={`${tableCls} mt-6`}>
					<thead><tr><th className={thCls}>{t("col.metric")}</th><th className={thCls}>{t("col.value")}</th></tr></thead>
					<tbody>
						<tr><td className={tdCls}>{t("detail.actor.cards")}</td><td className={tdCls}>{i.created} / {i.joined}</td></tr>
						<tr><td className={tdCls}>{t("detail.actor.appreciated")}</td><td className={tdCls}>{i.appreciatedBy} / {i.appreciated}</td></tr>
						<tr><td className={tdCls}>{t("detail.actor.earned")}</td><td className={tdCls}>{i.earned.toFixed(2)}</td></tr>
						<tr><td className={tdCls}>{t("detail.actor.credits")}</td><td className={tdCls}>{i.assuranceCredits}</td></tr>
						<tr><td className={tdCls}>{t("detail.actor.trust")}</td><td className={tdCls}>{i.trustScore}</td></tr>
					</tbody>
				</table>

				{recs.length > 0 && (
					<>
						<h2 className="mt-10 font-display text-2xl">{t("detail.actor.recognitions")}</h2>
						<ul className="mt-2 space-y-2 text-sm">
							{recs.map((r, idx) => (
								<li key={idx}>
									<em>“{r.note}”</em> — <ActorName id={r.from} />
									{r.possibilityId && (
										<> · <Link to={`/possibilities?card=${r.possibilityId}`} className="text-info underline">{t("detail.actor.cardLink")}</Link></>
									)}
								</li>
							))}
						</ul>
					</>
				)}
				<HowNote noteKey="how.actor.trust" anchor="s3" />

				<h2 className="mt-10 font-display text-2xl">{t("detail.actor.wallets")}</h2>
				<table className={`${tableCls} mt-2`}>
					<thead><tr><th className={thCls}>{t("col.address")}</th><th className={thCls}>{t("col.bound")}</th></tr></thead>
					<tbody>
						{i.wallets.map((w) => (
							<tr key={w.address}>
								<td className={tdCls}><code className="break-all text-xs">{w.address}</code></td>
								<td className={`${tdCls} text-muted`}>{w.at.slice(0, 10)}</td>
							</tr>
						))}
						{i.wallets.length === 0 && (
							<tr><td colSpan={2} className={`${tdCls} italic text-muted`}>{t("detail.actor.noWallets")}</td></tr>
						)}
					</tbody>
				</table>

				<h2 className="mt-10 font-display text-2xl">{t("detail.actor.donations")}</h2>
				<table className={`${tableCls} mt-2`}>
					<thead><tr>
						<th className={thCls}>{t("col.round")}</th><th className={thCls}>{t("col.need")}</th>
						<th className={thCls}>{t("col.amount")}</th><th className={thCls}>{t("col.settlement")}</th>
					</tr></thead>
					<tbody>
						{i.donations.map((d, idx) => (
							<tr key={idx}>
								<td className={tdCls}><Link to={`/rounds/${d.roundId}`} className="text-info underline">{d.roundId}</Link></td>
								<td className={tdCls}>{d.needNodeId}</td>
								<td className={tdCls}>{d.amount} {d.currency}</td>
								<td className={`${tdCls} text-muted`}>
									{d.settlement}{d.settlementRef ? <> · <code>{d.settlementRef.slice(0, 18)}…</code></> : null}
								</td>
							</tr>
						))}
						{i.donations.length === 0 && (
							<tr><td colSpan={4} className={`${tdCls} italic text-muted`}>{t("detail.actor.noDonations")}</td></tr>
						)}
					</tbody>
				</table>
				<p className="mt-6 text-sm text-muted">
					{t("detail.actor.bindNote")} <code>springforth bind actor:{i.actor}</code>
				</p>
			</main>
			<SiteFooter />
		</div>
	);
}
