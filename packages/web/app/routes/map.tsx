import { useTranslation } from "react-i18next";
import type { Route } from "./+types/map";
import type { renderMapPage, MapMarker } from "@springforth/portal";
import { LAND_RINGS } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead } from "~/components/hub";
import { cn } from "~/lib/utils";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderMapPage>>(context, request);
	return { i: input };
}

export function meta() {
	return [{ title: "Map — Springforth" }];
}

const W = 1000, H = 500;
const proj = (lon: number, lat: number): [number, number] =>
	[((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

const DOT: Record<string, string> = {
	active: "fill-forest", draft: "fill-sage", quorum: "fill-info",
	completed: "fill-coral", expired: "fill-muted", evidence: "fill-teal",
};

const LAND = LAND_RINGS.map((ring) =>
	`${ring.map(([lon, lat], i) => {
		const [x, y] = proj(lon!, lat!);
		return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
	}).join("")}Z`,
);

const LEGEND: [string, string][] = [
	["active", "map.live"], ["quorum", "map.quorum"],
	["completed", "map.completed"], ["expired", "map.expired"],
	["evidence", "map.evidence"],
];

export default function MapPage({ loaderData }: Route.ComponentProps) {
	const { i: o } = loaderData;
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-7xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("map.kicker")} title={t("map.h1")} em={t("map.h1.em")} lede={t("map.lede")}
					back={{ href: "/possibilities", label: t("nav.possibilities") }}
				/>
				<svg
					viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t("map.a11y")}
					className="mt-8 block h-auto w-full rounded-xl border border-line bg-map-sea"
				>
					<title>{t("map.title")}</title>
					{LAND.map((d, i) => (
						<path key={i} d={d} className="fill-map-land stroke-line" strokeWidth={0.5} />
					))}
					{(o.evidence ?? []).map((m) => {
						const [x, y] = proj(m.lon, m.lat);
						return (
							<a key={m.id} href={m.href} aria-label={m.title} className="outline-none">
								<circle cx={x} cy={y} r={11} fill="transparent" />
								<circle cx={x} cy={y} r={2.5} className="fill-teal stroke-card opacity-85" strokeWidth={0.8}>
									<title>{m.title}</title>
								</circle>
							</a>
						);
					})}
					{o.markers.map((m) => {
						const [x, y] = proj(m.lon, m.lat);
						const st = DOT[m.status] ? m.status : "draft";
						return (
							<a key={m.id} href={m.href} aria-label={m.title} className="outline-none">
								<circle cx={x} cy={y} r={11} fill="transparent" />
								<circle cx={x} cy={y} r={4.5} className={cn(DOT[st], "stroke-card")} strokeWidth={1.2}>
									<title>{m.title} — {m.status}</title>
								</circle>
							</a>
						);
					})}
				</svg>
				<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
					{LEGEND.map(([cls, key]) => (
						<span key={cls} className="inline-flex items-center gap-1.5">
							<i className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT[cls])} aria-hidden />
							{t(key)}
						</span>
					))}
				</div>
				{o.unlocated.length > 0 && (
					<div className="mt-6">
						<p className="text-xs font-bold uppercase tracking-wide text-muted">{t("map.unlocated")}</p>
						<ul className="mt-2 space-y-1 text-sm">
							{o.unlocated.map((c) => (
								<li key={c.id}>
									<a href={`/possibilities?card=${c.id}`} className="text-info underline">{c.title}</a>
									{c.place ? ` — ${c.place}` : ""}
								</li>
							))}
						</ul>
					</div>
				)}
			</main>
			<SiteFooter />
		</div>
	);
}
