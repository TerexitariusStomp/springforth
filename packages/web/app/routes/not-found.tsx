import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { Button } from "~/components/ui/button";

export function meta() {
	return [{ title: "Not found — Springforth" }];
}

export default function NotFound() {
	const { t } = useTranslation();
	return (
		<div className="flex min-h-screen flex-col bg-cream">
			<SiteHeader />
			<main id="main" className="flex flex-1 items-center justify-center px-5 py-20 text-center">
				<div>
					<span className="font-display text-8xl text-lime-ink">404</span>
					<h1 className="mt-4 font-display text-3xl">{t("nf.h1")} {t("nf.h1.em")}</h1>
					<p className="mt-2 text-muted">{t("nf.lede")}</p>
					<div className="mt-6 flex justify-center gap-3">
						<Button asChild><Link to="/">{t("nf.home")}</Link></Button>
						<Button variant="outline" asChild><Link to="/possibilities">{t("nav.possibilities")}</Link></Button>
					</div>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
