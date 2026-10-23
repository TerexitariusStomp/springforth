import { useTranslation } from "react-i18next";
import type { Route } from "./+types/plan";
import type { renderPlanPage } from "@springforth/portal";
import { sparkline } from "@springforth/portal";
import type { PlanNode } from "@springforth/coordination";
import { marked } from "marked";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, emptyCls } from "~/components/hub";
import { Badge } from "~/components/ui/badge";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderPlanPage>>(context, request);
	return { i: input };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.i?.plan?.title ?? "Plan"} — Springforth` }];
}

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = (s: string) => marked.parse(esc(s), { async: false }) as string;

const KIND_ORDER: PlanNode["kind"][] =
	["outcome", "action", "indicator", "framework", "organisation", "place", "offer", "need"];

export default function Plan({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();
	const { plan } = o;

	const children = new Map<string, PlanNode[]>();
	for (const n of o.nodes) {
		if (!n.parentOutcomeId) continue;
		children.set(n.parentOutcomeId, [...(children.get(n.parentOutcomeId) ?? []), n]);
	}
	const isChild = new Set(o.nodes.filter((n) => n.parentOutcomeId).map((n) => n.id));
	const byKind = new Map<PlanNode["kind"], PlanNode[]>();
	for (const k of KIND_ORDER) byKind.set(k, []);
	for (const n of o.nodes) byKind.get(n.kind)?.push(n);

	const nodeItem = (n: PlanNode, depth = 0): React.ReactNode => {
		const kids = children.get(n.id) ?? [];
		const series = o.checks?.[n.id] ?? [];
		const spark = sparkline(series);
		return (
			<li key={n.id} className="py-1.5">
				<strong>{n.label}</strong>
				{n.placeId && <span className="text-muted"> · {n.placeId}</span>}
				{spark ? (
					<span dangerouslySetInnerHTML={{ __html: spark }} className="ml-2 inline-block align-middle" />
				) : n.kind === "indicator" ? (
					<span className="ml-2 text-xs text-muted">{t("plans.doc.noreadings")}</span>
				) : null}
				{n.description && (
					<div
						className="mt-1 text-sm text-muted [&_p]:my-0.5"
						dangerouslySetInnerHTML={{ __html: md(n.description) }}
					/>
				)}
				{kids.length > 0 && <ul className="ml-5 border-l border-line pl-4">{kids.map((k) => nodeItem(k, depth + 1))}</ul>}
			</li>
		);
	};

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={`${t("plans.doc.kicker")} · ${plan.source.split(":")[0]}`}
					title={plan.title}
					lede={`${plan.nodeCount} ${t("plans.doc.nodes")} · ${plan.overlaps} ${t("plans.doc.overlaps")} · ${t("plans.doc.imported")} ${plan.importedAt.slice(0, 10)}`}
					back={{ href: "/plans", label: t("plans.back") }}
				/>
				<div className="mt-8">
					{KIND_ORDER.map((k) => {
						const items = (byKind.get(k) ?? []).filter((n) => !isChild.has(n.id));
						if (!items.length) return null;
						return (
							<section key={k} className="mb-8">
								<h3 className="font-display text-2xl">
									{t(`plans.kind.${k}`)} ({(byKind.get(k) ?? []).length})
								</h3>
								<ul className="mt-3">{items.map((n) => nodeItem(n))}</ul>
							</section>
						);
					})}
					{o.nodes.length === 0 && <p className={emptyCls}>{t("plans.none")}</p>}
					{o.overlaps.length > 0 && (
						<>
							<h3 className="font-display text-2xl">{t("plans.doc.linked")}</h3>
							<ul className="mt-3 space-y-1.5 text-sm">
								{o.overlaps.slice(0, 20).map((r) => {
									const other = r.nodeIds.find((id) => !o.nodes.some((n) => n.id === id)) ?? r.nodeIds[0];
									return (
										<li key={r.id}>
											<a href={`/collaborate?node=${encodeURIComponent(other)}`} className="text-info underline">
												<code>{other}</code>
											</a>{" "}
											<Badge variant={r.status === "confirmed" || r.status === "coordinated" ? "lime" : "default"}>
												{r.status}
											</Badge>{" "}
											<span className="text-muted">{(r.confidence * 100).toFixed(0)}%</span>
										</li>
									);
								})}
							</ul>
						</>
					)}
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
