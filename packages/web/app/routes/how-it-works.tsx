import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/how-it-works";
import type { renderHowItWorksPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, cardCls } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [lang] = await fetchUI<Parameters<typeof renderHowItWorksPage>>(context, request);
	return { lang };
}

export function meta() {
	return [{ title: "How it works — Springforth" }];
}

const STOPS: { n: number; href: string; label: string }[] = [
	{ n: 1, href: "/possibilities", label: "nav.possibilities" },
	{ n: 2, href: "/collaborate#commons", label: "nav.collaborate" },
	{ n: 3, href: "/collaborate#overlaps", label: "nav.collaborate" },
	{ n: 4, href: "/fund", label: "nav.fund" },
	{ n: 5, href: "/impact", label: "nav.impact" },
	{ n: 6, href: "/community#trust", label: "nav.community" },
	{ n: 7, href: "/community", label: "nav.community" },
];

export default function HowItWorks() {
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead kicker={t("howto.kicker")} title={t("howto.h1")} em={t("howto.h1.em")} lede={t("howto.lede")} />
				<div className="mt-10 space-y-4">
					{STOPS.map((s) => (
						<div key={s.n} className={`${cardCls} flex gap-5`}>
							<span className="font-display text-4xl text-lime-ink">{s.n}</span>
							<div>
								<h3 className="font-display text-xl">{t(`howto.stop.${s.n}.title`)}</h3>
								<p className="mt-1 text-sm">
									<strong>{t("howto.do")}:</strong> {t(`howto.stop.${s.n}.do`)}
								</p>
								<p className="mt-1 text-sm text-muted">
									<strong>{t("howto.look")}:</strong> {t(`howto.stop.${s.n}.look`)}
								</p>
								<p className="mt-2 text-sm">
									<a href={s.href} className="font-semibold text-info underline">{t(s.label)} →</a>
								</p>
							</div>
						</div>
					))}
				</div>
				<p className="mt-8 text-sm text-muted">
					{t("howto.more")}{" "}
					<Link to="/possibilities" className="font-semibold text-info underline">{t("nav.possibilities")} →</Link>
				</p>
				<p className="mt-2 text-sm text-muted">
					<Link to="/whitepaper" className="underline">{t("nav.whitepaper")}</Link> ·{" "}
					<Link to="/docs" className="underline">{t("nav.apiDocs")}</Link>
				</p>
			</main>
			<SiteFooter />
		</div>
	);
}
