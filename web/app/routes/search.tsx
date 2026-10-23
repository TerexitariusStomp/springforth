import { useTranslation } from "react-i18next";
import type { Route } from "./+types/search";
import type { renderSearchPage } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, field, submit } from "~/components/hub";
import { Badge } from "~/components/ui/badge";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderSearchPage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Search — Springforth" }];
}

export default function Search({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("search.kicker")} title={t("search.h1")} em={t("search.h1.em")} lede={t("search.lede")}
					back={{ href: "/collaborate", label: t("nav.collaborate") }}
				/>
				<form method="get" action="/search" role="search" className="mt-6 flex max-w-xl gap-2">
					<input type="search" name="q" defaultValue={o.q} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} className={field} />
					<button type="submit" className={submit}>{t("search.button")}</button>
				</form>
				{o.q && <p className="mt-4 text-sm text-muted">{t("search.count")}: {o.hits.length}</p>}
				{o.hits.length > 0 ? (
					<ul className="mt-4 space-y-2">
						{o.hits.map((h) => (
							<li key={h.id} className="rounded-xl border border-line bg-card px-4 py-3">
								<a href={`/collaborate?node=${encodeURIComponent(h.id)}`} className="font-semibold text-info underline">
									{h.label}
								</a>
								<Badge className="ms-2">{h.kind}</Badge>
								<Badge className="ms-1">{t(h.via === "semantic" ? "search.semantic" : "search.lexical")} {(h.score * 100).toFixed(0)}%</Badge>
								<span className="mt-1 block text-xs text-muted">{h.source}</span>
							</li>
						))}
					</ul>
				) : o.q ? (
					<p className="mt-4 text-sm text-muted">{t("search.none")}</p>
				) : null}
			</main>
			<SiteFooter />
		</div>
	);
}
