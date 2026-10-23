import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/ledger";
import type { renderLedgerPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, tableCls, thCls, tdCls } from "~/components/hub";
import { ActorName } from "~/components/actor-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [events, verify] = await fetchUI<Parameters<typeof renderLedgerPage>>(context, request);
	return { events, verify };
}

export function meta() {
	return [{ title: "Ledger — Springforth" }];
}

const when = (iso?: string) => (iso ? iso.replace("T", " ").slice(0, 19) : "—");
const short = (h?: string) => (h ? `${h.slice(0, 12)}…` : "—");

export default function Ledger({ loaderData }: Route.ComponentProps) {
	const { events, verify } = loaderData;
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.ledger.kicker")} title={t("detail.ledger.h1")} em={t("detail.ledger.h1.em")}
					lede={t("detail.ledger.lede")}
					back={{ href: "/impact#proof", label: t("nav.impact") }}
				/>
				<p className="mt-6 text-sm">
					{verify.ok ? (
						<strong className="flex items-center gap-1 text-ok"><Check className="size-4" aria-hidden />{t("detail.ledger.ok")}</strong>
					) : (
						<strong className="flex items-center gap-1 text-coral-ink"><X className="size-4" aria-hidden />{t("detail.ledger.broken")} {verify.brokenAt}</strong>
					)}
					{verify.ok && <> — {verify.events} {t("detail.ledger.okBody")}</>} ·{" "}
					<Link to="/ledger/verify" className="font-semibold text-info underline">{t("detail.ledger.verify")}</Link>
				</p>
				<details className="mt-4 rounded-xl border border-line">
					<summary className="cursor-pointer p-3 text-sm font-semibold text-info">{t("detail.data")}</summary>
					<div className="border-t border-line p-4">
						<a href="/ledger?format=json" className="text-info underline">JSON</a>
					</div>
				</details>
				<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="mt-6 overflow-x-auto">
					<table className={tableCls}>
						<thead><tr>
							<th className={thCls}>#</th><th className={thCls}>{t("col.at")}</th>
							<th className={thCls}>{t("col.event")}</th><th className={thCls}>{t("col.actor")}</th>
							<th className={thCls}>{t("col.hash")}</th>
						</tr></thead>
						<tbody>
							{[...events].reverse().map((e) => (
								<tr key={e.seq}>
									<td className={tdCls}>{e.seq}</td>
									<td className={`${tdCls} whitespace-nowrap text-muted`}>{when(e.at)}</td>
									<td className={tdCls}><code>{e.kind}</code></td>
									<td className={tdCls}><ActorName id={e.actor} /></td>
									<td className={`${tdCls} text-muted`} title={e.hash}><code>{short(e.hash)}</code></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
