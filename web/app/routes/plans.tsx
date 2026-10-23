import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/plans";
import type { renderPlansPage } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, emptyCls, tableCls, thCls, tdCls } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderPlansPage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Plans — Springforth" }];
}

export default function Plans({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("plans.kicker")} title={t("plans.h1")} em={t("plans.h1.em")} lede={t("plans.lede")}
					back={{ href: "/collaborate", label: t("nav.collaborate") }}
				/>
				{o.plans.length > 0 ? (
					<div tabIndex={0} role="region" aria-label={t("a11y.tableScroll")} className="mt-8 overflow-x-auto">
						<table className={tableCls}>
							<thead><tr>
								<th className={thCls}>{t("col.plan")}</th>
								<th className={thCls}>{t("col.source")}</th>
								<th className={thCls}>{t("col.nodes")}</th>
								<th className={thCls}>{t("plans.cols.oai")}</th>
								<th className={thCls}>{t("plans.cols.on")}</th>
								<th className={thCls}>{t("plans.cols.overlaps")}</th>
								<th className={thCls}>{t("plans.cols.imported")}</th>
							</tr></thead>
							<tbody>
								{o.plans.map((p) => (
									<tr key={p.id}>
										<td className={tdCls}>
											<Link to={`/plans/${encodeURIComponent(p.id)}`} className="font-semibold text-info underline">
												{p.title}
											</Link>
										</td>
										<td className={`${tdCls} text-muted`}>{p.source.split(":")[0] ?? p.source}</td>
										<td className={tdCls}>{p.nodeCount}</td>
										<td className={tdCls}>{p.outcomes} · {p.actions} · {p.indicators}</td>
										<td className={tdCls}>{p.offers} · {p.needs}</td>
										<td className={tdCls}>{p.overlaps || "—"}</td>
										<td className={`${tdCls} text-muted`}>{p.importedAt.slice(0, 10)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className={`${emptyCls} mt-8`}>{t("plans.none")}</p>
				)}
			</main>
			<SiteFooter />
		</div>
	);
}
