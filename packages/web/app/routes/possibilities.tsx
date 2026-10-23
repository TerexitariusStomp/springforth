import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import type { Route } from "./+types/possibilities";
import type { renderPossibilitiesPage } from "@springforth/portal";
import { ActorName } from "~/components/actor-name";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { PossibilityCard } from "~/components/possibility-card";
import { CardDetail, trailKey } from "~/components/card-detail";
import { Button } from "~/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "~/lib/utils";

export async function loader({ request, context }: Route.LoaderArgs) {
	// Named fields — SerializeFrom collapses optional tuple elements into a
	// union array, so we unpack server-side instead of shipping the tuple.
	const [cards, edges, viewer, opts] =
		await fetchUI<Parameters<typeof renderPossibilitiesPage>>(context, request);
	return { cards, edges: edges ?? [], viewer, opts: opts ?? {} };
}

export function meta() {
	return [{ title: "Possibilities — Springforth" }];
}

const STATUS_FILTERS: Array<[string, string]> = [
	["", "deck.all"], ["active", "deck.building"], ["quorum", "deck.quorum"],
	["completed", "deck.completed"], ["draft", "deck.f.draft"], ["expired", "deck.f.expired"],
];

const field =
	"h-11 flex-1 min-w-[8rem] rounded-lg border border-line bg-card px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

export default function Possibilities({ loaderData }: Route.ComponentProps) {
	const { cards, edges, viewer, opts } = loaderData;
	const status = opts.status ?? "";
	const mine = !!opts.mine;
	const { t } = useTranslation();
	const [params, setParams] = useSearchParams();
	const [q, setQ] = useState("");

	const keep = `${viewer ? `actor=${encodeURIComponent(viewer)}` : ""}${mine ? `${viewer ? "&" : ""}for=${encodeURIComponent(viewer ?? "")}` : ""}`;
	const qp = (extra: string) => `?${[extra, keep].filter(Boolean).join("&")}`;

	const filtered = status ? cards.filter((c) => c.status === status) : cards;
	const searched = q
		? filtered.filter((c) => `${c.title} ${c.place ?? ""}`.toLowerCase().includes(q.toLowerCase()))
		: filtered;

	const openCard = params.get("card");
	const detail = openCard ? cards.find((c) => c.id === openCard) : undefined;
	const declaring = params.get("declare") === "1";

	// Legacy deep link: /possibilities#card-id opened the overlay.
	useEffect(() => {
		const id = window.location.hash.slice(1);
		if (id && id !== "deck" && id !== "declare" && cards.some((c) => c.id === id)) {
			const p = new URLSearchParams(window.location.search);
			p.set("card", id);
			setParams(p, { preventScrollReset: true });
		}
		if (window.location.hash === "#declare") {
			const p = new URLSearchParams(window.location.search);
			p.set("declare", "1");
			setParams(p, { preventScrollReset: true });
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const reasonFor = (c: (typeof cards)[number]): string | undefined => {
		const p = opts.connections?.[c.id]?.personal;
		if (!p) return undefined;
		const bits: string[] = [];
		if (p.joined) bits.push(t("reason.joined"));
		else if (p.interested) bits.push(t("reason.watching"));
		if (p.recognized > 0) bits.push(`${p.recognized} ${t("reason.recognized")}`);
		if (p.near) bits.push(`${t("reason.near")} ${p.near}`);
		if (p.newSince > 0) bits.push(`${p.newSince} ${t("feed.since")}${p.lastEvent ? ` — ${t(trailKey(p.lastEvent))}` : ""}`);
		return bits.length ? bits.join(" · ") : undefined;
	};

	const mutual = edges.filter((e) => e.mutual > 0).slice(0, 10);
	const located = cards.filter((c) => opts.connections?.[c.id]?.geo).length;
	const unlocated = cards.length - located;

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-7xl px-5 py-12 lg:px-10">
				<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
					<div>
						<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("deck.kicker")}</span>
						<h1 className="mt-2 font-display text-4xl sm:text-5xl">
							{t("deck.h1")} <em className="text-sage">{t("deck.h1.em")}</em>
						</h1>
					</div>
					<p className="max-w-md text-sm text-ink-mute">
						{t("deck.lede")}
						{viewer && <><br /><em>{t("deck.sortingFor")} {viewer}</em></>}
						{mine && viewer && <><br /><strong>{t("deck.mine.banner")}</strong> {t("deck.mine.body")}</>}
					</p>
				</div>

				<div className="mb-6 flex flex-wrap items-center gap-3">
					<nav aria-label={t("a11y.deckFilter")} className="flex flex-wrap gap-1 rounded-full border border-line bg-card p-1 text-sm">
						{STATUS_FILTERS.map(([v, l]) => (
							<Link
								key={v || "all"}
								to={v ? qp(`status=${v}`) : keep ? `?${keep}` : "/possibilities"}
								aria-current={status === v ? "true" : undefined}
								className={cn(
									"rounded-full px-3 py-1.5 transition-colors",
									status === v ? "bg-forest text-cream dark:bg-lime dark:text-forest" : "text-muted hover:bg-pale",
								)}
							>
								{t(l)}
							</Link>
						))}
						{viewer && (
							<Link
								to={`/possibilities?actor=${encodeURIComponent(viewer)}${mine ? "" : `&for=${encodeURIComponent(viewer)}`}`}
								aria-current={mine ? "true" : undefined}
								className={cn(
									"rounded-full px-3 py-1.5 transition-colors",
									mine ? "bg-coral text-ink" : "text-muted hover:bg-pale",
								)}
							>
								{t(mine ? "deck.mine.all" : "deck.mine.show")}
							</Link>
						)}
					</nav>
					<label className="flex h-10 flex-1 min-w-48 max-w-xs items-center gap-2 rounded-full border border-line bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
						<Search className="size-4 text-muted" aria-hidden />
						<input
							type="search"
							placeholder={t("deck.search")}
							aria-label={t("a11y.deckSearch")}
							value={q}
							onChange={(e) => setQ(e.target.value)}
							className="w-full bg-transparent text-sm outline-hidden"
						/>
					</label>
					<Button asChild>
						<Link to="/possibilities?declare=1">{t("nav.startPossibility")}</Link>
					</Button>
				</div>

				{located > 0 && (
					<div className="mb-8 rounded-2xl border border-line bg-card p-5">
						<h2 className="font-display text-xl">{t("map.section")}</h2>
						<p className="mt-1 text-sm text-muted">
							<Link to="/map" className="font-semibold text-forest dark:text-lime">{t("map.full")} →</Link>
							{unlocated > 0 && ` · ${unlocated} ${t("map.unlocated")}`}
						</p>
					</div>
				)}

				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" id="card-grid">
					{searched.map((c, idx) => (
						<PossibilityCard
							key={c.id}
							base="/possibilities"
							d={{
								id: c.id, title: c.title, place: c.place,
								status: c.status, participants: c.participantCount,
								min: c.minParticipants || 0, deadline: c.deadline,
								needs: c.needs.filter((n) => !n.met).slice(0, 3).map((n) => n.label),
								reason: reasonFor(c),
							}}
							viewer={viewer ?? null}
							nextId={searched[idx + 1]?.id ?? ""}
							returnTo={`/possibilities${keep ? `?${keep}` : ""}`}
						/>
					))}
					{searched.length === 0 && (
						<div className="col-span-full rounded-2xl border border-dashed border-line p-10 text-center text-muted">
							{t("deck.empty")}{" "}
							<Link to="/possibilities?declare=1" className="font-semibold text-forest dark:text-lime">
								{t("deck.empty.cta")}
							</Link>
							.
						</div>
					)}
				</div>

				{mutual.length > 0 && (
					<div className="mt-10 rounded-2xl border border-line bg-card p-6">
						<h3 className="font-display text-2xl">{t("deck.mutual")}</h3>
						<p className="mt-1 text-sm text-muted">{t("deck.mutual.body")}</p>
						<ul className="mt-3 space-y-1 text-sm">
							{mutual.map((e, i) => (
								<li key={i}>
									{<ActorName id={e.from} />} ↔ {<ActorName id={e.to} />} — {e.mutual} × {t("deck.mutual.times")}
								</li>
							))}
						</ul>
					</div>
				)}

				<p className="mx-auto mt-10 max-w-5xl text-sm text-muted">
					<Link to="/collaborate" className="underline">{t("nav.collaborate")}</Link> ·{" "}
					<Link to="/fund" className="underline">{t("nav.fund")}</Link> ·{" "}
					<Link to="/impact" className="underline">{t("nav.impact")}</Link>
					<br />
					<span title={t("deck.ordering.body")}>{t("deck.ordering")}</span>
					<br />
					{t("deck.telegram.pre")}{" "}
					<a href="https://t.me/springforth_bot" rel="noopener" className="underline">@springforth_bot</a> {t("deck.telegram")}
				</p>
				<details className="mx-auto mt-4 max-w-5xl">
					<summary className="cursor-pointer text-sm text-info">{t("detail.data")}</summary>
					<div className="mt-2"><a href="/possibilities?format=json" className="text-info underline">JSON</a></div>
				</details>
			</main>

			{/* card detail — driven by ?card= so it works SSR + no-JS */}
			<Dialog.Root
				open={!!detail}
				onOpenChange={(open) => {
					if (!open) {
						const p = new URLSearchParams(params);
						p.delete("card");
						setParams(p, { preventScrollReset: true });
					}
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 z-50 bg-forest/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
					<Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(44rem,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-cream p-8 shadow-2xl focus-visible:outline-hidden data-[state=open]:animate-in data-[state=open]:zoom-in-95">
						<Dialog.Close asChild>
							<button aria-label={t("a11y.close")} className="absolute right-4 top-4 rounded-full p-2 hover:bg-line/50">
								<X className="size-5" />
							</button>
						</Dialog.Close>
						<Dialog.Title className="sr-only">{detail?.title}</Dialog.Title>
						{detail && <CardDetail c={detail} conn={opts.connections?.[detail.id]} />}
						{/* no-JS fallback link */}
						{detail && (
							<noscript>
								<Link to="/possibilities" className="mt-4 inline-block text-info underline">{t("a11y.close")}</Link>
							</noscript>
						)}
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>

			{/* declare modal — ?declare=1 */}
			<Dialog.Root
				open={declaring}
				onOpenChange={(open) => {
					if (!open) {
						const p = new URLSearchParams(params);
						p.delete("declare");
						setParams(p, { preventScrollReset: true });
					}
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 z-50 bg-forest/70 backdrop-blur-sm" />
					<Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(38rem,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-cream p-8 shadow-2xl focus-visible:outline-hidden">
						<Dialog.Close asChild>
							<button aria-label={t("a11y.close")} className="absolute right-4 top-4 rounded-full p-2 hover:bg-line/50">
								<X className="size-5" />
							</button>
						</Dialog.Close>
						<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("declare.kicker")}</span>
						<Dialog.Title className="mt-2 font-display text-3xl">{t("declare.h2")}</Dialog.Title>
						<p className="mt-2 text-sm text-muted">{t("declare.lede")}</p>
						<DeclareForm />
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
			{declaring && (
				<section id="declare" className="mx-auto max-w-2xl border-t border-line px-5 py-12 lg:px-10" aria-labelledby="declare-h">
					<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("declare.kicker")}</span>
					<h2 id="declare-h" className="mt-2 font-display text-3xl">{t("declare.h2")}</h2>
					<p className="mt-2 text-sm text-muted">{t("declare.lede")}</p>
					<DeclareForm />
				</section>
			)}
			<SiteFooter />
		</div>
	);
}

// Shared declare form — used by the ?declare=1 dialog and the no-JS
// inline section. Posts plainly to POST /possibilities (303 → deep link).
function DeclareForm() {
	const { t } = useTranslation();
	return (
		<form method="post" action="/possibilities" className="mt-6 space-y-4">
			<input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only" />
			<label className="block text-sm font-semibold">
				{t("declare.possibility")}
				<textarea name="title" required placeholder={t("declare.ph")} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" rows={3} />
			</label>
			<label className="block text-sm font-semibold">
				{t("declare.name")}
				<input name="declarerId" required placeholder={t("declare.namePh")} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
			</label>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block text-sm font-semibold">
					{t("declare.where")}
					<input name="place" placeholder={t("declare.wherePh")} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
				</label>
				<label className="block text-sm font-semibold">
					{t("declare.deadline")}
					<input name="deadline" type="date" className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
				</label>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block text-sm font-semibold">
					{t("declare.min")}
					<input name="minParticipants" type="number" min="1" defaultValue={3} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
				</label>
				<label className="block text-sm font-semibold">
					{t("declare.desc")}
					<input name="description" placeholder={t("declare.descPh")} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
				</label>
			</div>
			<button type="submit" className="w-full rounded-full bg-coral py-3.5 font-bold text-ink transition-colors hover:bg-coral-ink">
				{t("declare.submit")}
			</button>
		</form>
	);
}
