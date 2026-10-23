import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/ledger-verify";
import type { renderLedgerVerifyPage } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, StatGrid } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [verify] = await fetchUI<Parameters<typeof renderLedgerVerifyPage>>(context, request);
	return { verify };
}

export function meta() {
	return [{ title: "Verify — Springforth" }];
}

export default function LedgerVerify({ loaderData }: Route.ComponentProps) {
	const { verify: v } = loaderData;
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.verify.kicker")} title={t("detail.verify.h1")}
					em={v.ok ? t("detail.verify.ok.em") : t("detail.verify.bad.em")}
					lede={v.ok ? t("detail.verify.okBody") : `${t("detail.verify.badBody")} — #${v.brokenAt ?? "?"}`}
					back={{ href: "/ledger", label: t("detail.ledger.kicker") }}
				/>
				<div className="mt-8">
					<StatGrid items={[
						{ v: String(v.events ?? "—"), l: t("detail.verify.events") },
						{ v: v.ok ? <Check className="size-6 text-ok" aria-hidden /> : <X className="size-6 text-coral-ink" aria-hidden />, l: t("detail.verify.integrity") },
						{ v: "OTS", l: t("detail.verify.anchored") },
					]} />
				</div>
				<p className="mt-6 text-sm text-muted">
					<Link to="/ledger" className="font-semibold text-info underline">{t("detail.ledger.browse")}</Link>
				</p>
				<details className="mt-4 rounded-xl border border-line">
					<summary className="cursor-pointer p-3 text-sm font-semibold text-info">{t("detail.data")}</summary>
					<div className="border-t border-line p-4">
						<a href="/ledger/verify?format=json" className="text-info underline">JSON</a>
					</div>
				</details>
			</main>
			<SiteFooter />
		</div>
	);
}
