import { useTranslation } from "react-i18next";
import type { Route } from "./+types/claim";
import type { renderClaimPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, tableCls, thCls, tdCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";
import { ActorName } from "~/components/actor-name";
import { TxButton } from "~/components/tx-button";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [claim, attestations, opts] = await fetchUI<Parameters<typeof renderClaimPage>>(context, request);
	return { claim, attestations, opts };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `Claim ${data?.claim?.id ?? ""} — Springforth` }];
}

export default function Claim({ loaderData }: Route.ComponentProps) {
	const { claim, attestations, opts } = loaderData;
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.claim.kicker")} title={claim.workScope || claim.id}
					back={{ href: "/impact#claims", label: t("nav.impact") }}
				/>
				<p className="mt-3 text-sm text-muted">
					{t("detail.actor.id")} <code>{claim.id}</code> · {t("detail.report.state")}{" "}
					<Badge>{claim.state}</Badge> · {t("detail.claim.scope")}: {claim.workScope} ·{" "}
					{claim.contributors.length} {t("detail.claim.contributors")} · {claim.oracleCheckIds.length}{" "}
					{t("detail.claim.checks")}
				</p>
				{claim.artifactRefs.length > 0 && (
					<p className="mt-2 text-sm">
						{t("detail.claim.artifacts")}:{" "}
						{claim.artifactRefs.map((u, i) => (
							<span key={u}>{i > 0 && " · "}<a href={u} rel="noopener" className="text-info underline">{u}</a></span>
						))}
					</p>
				)}

				<h2 className="mt-10 font-display text-2xl">{t("detail.claim.atts")}</h2>
				<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="mt-3 overflow-x-auto">
					<table className={tableCls}>
						<thead><tr>
							<th className={thCls}>ID</th><th className={thCls}>{t("col.attester")}</th>
							<th className={thCls}>{t("col.schema")}</th><th className={thCls}>{t("col.anchored")}</th>
							<th className={thCls}>{t("col.action")}</th>
						</tr></thead>
						<tbody>
							{attestations.map((a) => (
								<tr key={a.id}>
									<td className={tdCls}><code className="break-all text-xs">{a.id}</code></td>
									<td className={tdCls}><ActorName id={a.attester} /></td>
									<td className={tdCls}><code className="break-all text-xs">{a.schemaRef}</code></td>
									<td className={`${tdCls} text-muted`}>
										{a.uid ? <>{t("detail.claim.onchain")} <code>{a.uid.slice(0, 14)}…</code></> : t("detail.claim.ledger")}
									</td>
									<td className={tdCls}>
										{!a.uid && opts.chainReady && (
											<TxButton
												build={`/attestations/${a.id}/tx`}
												kind="attestation.publish"
												entity={a.id}
												label={t("detail.claim.publish")}
											/>
										)}
									</td>
								</tr>
							))}
							{attestations.length === 0 && (
								<tr><td colSpan={5} className={`${tdCls} italic text-muted`}>{t("detail.claim.none")}</td></tr>
							)}
						</tbody>
					</table>
				</div>
				<p className="mt-4 text-sm text-muted">
					{opts.chainReady ? t("detail.claim.chainReady") : t("detail.claim.chainOff")}
				</p>
				<details className="mt-4 rounded-xl border border-line">
					<summary className="cursor-pointer p-3 text-sm font-semibold text-info">{t("detail.data")}</summary>
					<div className="border-t border-line p-4 text-sm">
						<a href="?format=lexicon" className="text-info underline">{t("detail.claim.lexicon")}</a> ·{" "}
						<a href={`/claims/${claim.id}/metadata`} className="text-info underline">{t("detail.claim.metadata")}</a>
					</div>
				</details>
			</main>
			<SiteFooter />
		</div>
	);
}
