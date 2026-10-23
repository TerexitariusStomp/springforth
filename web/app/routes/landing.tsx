import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { effectiveStatus } from '../../../src/coordination';
import type { Route } from "./+types/landing";
import type { renderLandingPage } from '../../../src/portal/index';
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { PossibilityCard } from "~/components/possibility-card";
import { Marquee } from "~/components/magicui/marquee";
import { NumberTicker } from "~/components/magicui/number-ticker";
import { BlurFade } from "~/components/magicui/blur-fade";
import { BorderBeam } from "~/components/magicui/border-beam";
import { AnimatedShinyText } from "~/components/magicui/animated-shiny-text";
import { AuroraText } from "~/components/magicui/aurora-text";
import { Particles } from "~/components/magicui/particles";
import { Button } from "~/components/ui/button";
import { ArrowRight, Check, Plus, Users } from "lucide-react";

const Globe = lazy(() => import("~/components/globe-view").then((m) => ({ default: m.GlobeView })));

export async function loader({ request, context }: Route.LoaderArgs) {
	const [input] = await fetchUI<Parameters<typeof renderLandingPage>>(context, request);
	return { input };
}

export function meta({ data }: Route.MetaArgs) {
	return [
		{ title: "Springforth — Coordinate first." },
		{ name: "description", content: "People declare what they want to make happen; the commons offers what it already has. When enough commit, coordination activates." },
		{ property: "og:title", content: "Springforth" },
	];
}

function daysLeft(deadline: string | undefined, overdue: string) {
	if (!deadline) return "—";
	const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
	return d < 0 ? overdue : `${d}d`;
}

export default function Landing({ loaderData }: Route.ComponentProps) {
	const { input: i } = loaderData;
	const { t } = useTranslation();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const live = i.cards.filter((c) => ["active", "draft"].includes(effectiveStatus(c.possibility)));
	const atQuorum = i.cards.filter((c) => effectiveStatus(c.possibility) === "quorum");
	const near = [...live]
		.filter((c) => c.possibility.minParticipants > 0)
		.sort((x, y) => y.participants / y.possibility.minParticipants - x.participants / x.possibility.minParticipants);
	const orbit = near[0];
	const featured = [...live, ...atQuorum].slice(0, 4);

	// Globe pins — raw h3 cells; the client-only globe component converts
	// them (cellToLatLng is Emscripten-backed — too heavy for SSR).
	const cells = [
		...i.actionNodes.map((n) => n.h3),
		...i.cards.map((c) => c.possibility.h3),
	];

	const orbitPct = orbit?.possibility.minParticipants
		? Math.min(100, Math.round((orbit.participants / orbit.possibility.minParticipants) * 100))
		: 0;

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main">
				{/* ── hero ─────────────────────────────────────────────── */}
				<section className="relative overflow-hidden bg-forest text-cream">
					<Particles className="absolute inset-0 opacity-40" quantity={60} color="var(--color-lime)" staticity={60} />
					<div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-16 lg:grid-cols-2 lg:px-10 lg:pt-24">
						<div className="relative z-10">
							<BlurFade delay={0}>
								<p className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-lime">
									<span className="relative flex size-2">
										<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
										<span className="relative inline-flex size-2 rounded-full bg-lime" />
									</span>
									{t("eyebrow")}
								</p>
							</BlurFade>
							<BlurFade delay={0.1}>
								<h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
									{t("hero.h1.pre")}{" "}
									<AuroraText className="italic" colors={["var(--color-lime)", "var(--color-teal)", "var(--color-coral)"]}>
										{t("hero.h1.em")}
									</AuroraText>
								</h1>
							</BlurFade>
							<BlurFade delay={0.2}>
								<p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">{t("hero.copy")}</p>
							</BlurFade>
							<BlurFade delay={0.3}>
								<div className="mt-8 flex flex-wrap gap-3">
									<Button asChild variant="lime" size="lg">
										<Link to="/possibilities">
											{t("hero.cta.deck")}
											<ArrowRight className="size-4" />
										</Link>
									</Button>
									<Button asChild variant="outline" size="lg" className="border-cream/30 text-cream hover:bg-white/10">
										<a href="#how">{t("hero.cta.how")}</a>
									</Button>
								</div>
							</BlurFade>
							<BlurFade delay={0.4}>
								<div className="mt-8 flex items-center gap-3 text-sm text-cream/80">
									<div className="flex -space-x-2">
										{i.participantInitials.map((_, idx) => (
											<span key={idx} className="flex size-8 items-center justify-center rounded-full border-2 border-forest bg-sage text-cream">
												<Users className="size-3.5" />
											</span>
										))}
										<span className="flex size-8 items-center justify-center rounded-full border-2 border-forest bg-lime text-[10px] font-bold text-forest">
											+{Math.max(0, i.participantsTotal - i.participantInitials.length)}
										</span>
									</div>
									<p>
										<strong className="text-cream">{i.participantsTotal}</strong> {t("hero.trust")}{" "}
										<strong className="text-cream">{i.placesCount}</strong> {t("hero.trust.places")}
									</p>
								</div>
							</BlurFade>
							{orbit && (
								<BlurFade delay={0.5}>
									<aside className="relative mt-8 max-w-md overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
										<BorderBeam size={120} duration={6} colorFrom="var(--color-lime)" colorTo="var(--color-coral)" />
										<div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
											<span className="text-lime">{t("hero.orbit.nearest")}</span>
											<span className="flex items-center gap-1.5 rounded-full bg-coral/20 px-2.5 py-1 text-coral">
												<span className="size-1.5 animate-pulse rounded-full bg-coral" />
												{t("hero.orbit.building")}
											</span>
										</div>
										<h2 className="mt-3 font-display text-2xl">{orbit.possibility.title}</h2>
										<p className="mt-1 text-sm text-cream/70">
											{orbit.possibility.place ?? t("card.anywhere")} · {t("hero.orbit.closes")}{" "}
											{daysLeft(orbit.possibility.deadline, t("card.overdue"))}
										</p>
										<div className="mt-3 flex items-baseline justify-between text-sm">
											<strong>{orbit.participants} {t("orbit.in")}</strong>
											<span className="text-cream/70">
												{Math.max(0, orbit.possibility.minParticipants - orbit.participants)} {t("hero.orbit.more")}
											</span>
										</div>
										<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
											<div className="h-full rounded-full bg-gradient-to-r from-lime to-coral transition-[width]" style={{ width: `${orbitPct}%` }} />
										</div>
										<div className="mt-4 flex items-center justify-between">
											<span className="flex -space-x-1.5">
												{[0, 1, 2].map((x) => (
													<span key={x} className="size-6 rounded-full border-2 border-forest bg-teal/60" />
												))}
											</span>
											<Link to={`/possibilities#${orbit.possibility.id}`} className="text-sm font-semibold text-lime hover:underline">
												{t("hero.orbit.join")} →
											</Link>
										</div>
									</aside>
								</BlurFade>
							)}
						</div>
						{/* globe — real coordination geography */}
						<div className="relative z-0 mx-auto w-full max-w-lg lg:max-w-none">
							{mounted ? (
								<Suspense fallback={<div className="aspect-square w-full rounded-full bg-white/5" />}>
									<Globe cells={cells} />
								</Suspense>
							) : (
								<div className="aspect-square w-full animate-pulse rounded-full bg-white/5" />
							)}
							<div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-3">
								<a href="/collaborate#outcomes" className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-forest/80 px-4 py-2 text-xs font-semibold backdrop-blur transition-colors hover:border-lime/40">
									<Check className="size-3.5 text-lime" />
									<strong><NumberTicker value={i.completedCount} /></strong>
									<span className="text-cream/70">{t("hero.badge.actions")}</span>
								</a>
								<a href="/possibilities" className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-forest/80 px-4 py-2 text-xs font-semibold backdrop-blur transition-colors hover:border-lime/40">
									<Plus className="size-3.5 text-lime" aria-hidden />
									<strong><NumberTicker value={i.cards.length} /></strong>
									<span className="text-cream/70">{t("hero.badge.open")}</span>
								</a>
							</div>
						</div>
					</div>
				</section>

				{/* ── live ticker ──────────────────────────────────────── */}
				<div className="border-y border-line bg-card py-3" role="status" aria-label={t("a11y.liveTicker")}>
					<div className="mx-auto flex max-w-7xl items-center gap-4 px-5 lg:px-10">
						<span className="shrink-0 rounded-full bg-forest px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-lime">
							{t("ticker.label")}
						</span>
						<Marquee pauseOnHover className="[--duration:40s]">
							{(i.ticker.length ? i.ticker : [t("ticker.empty")]).map((line, idx) => (
								<span key={idx} className="mx-4 flex items-center gap-2 text-sm text-ink-mute">
									<span className="size-1.5 rounded-full bg-coral" />
									{line}
								</span>
							))}
						</Marquee>
					</div>
				</div>

				{/* ── how it works ─────────────────────────────────────── */}
				<section id="how" className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
					<div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
						<BlurFade inView>
							<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("how.kicker")}</span>
							<h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
								{t("how.h2")} <em className="text-sage">{t("how.h2.em")}</em>
							</h2>
							<p className="mt-4 max-w-md text-ink-mute">{t("how.copy")}</p>
							<Link to="/how-it-works" className="mt-4 inline-block font-semibold text-forest hover:underline dark:text-lime">
								{t("how.walkthrough")} →
							</Link>
						</BlurFade>
						<div className="grid gap-4 sm:grid-cols-2">
							{[
								["01", t("step.declare"), t("step.declare.body")],
								["02", t("step.commit"), t("step.commit.body")],
								["03", t("step.activate"), t("step.activate.body")],
								["04", t("step.verify"), t("step.verify.body")],
							].map(([n, title, body], idx) => (
								<BlurFade key={n} inView delay={idx * 0.08}>
									<div className="group flex h-full gap-4 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-lime-deep">
										<span className="font-display text-3xl text-lime-deep/60 transition-colors group-hover:text-coral">
											{n}
										</span>
										<div>
											<h3 className="font-semibold">{title}</h3>
											<p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
										</div>
									</div>
								</BlurFade>
							))}
						</div>
					</div>
				</section>

				{/* ── attention strip ──────────────────────────────────── */}
				{(near.length > 0 || i.proposedOverlaps > 0 || i.actionNodes.length > 0) && (
					<section className="border-y border-gold-line bg-gold-tint/60 px-5 py-8 dark:bg-white/5">
						<div className="mx-auto max-w-7xl">
							<h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gold-ink">{t("attention.title")}</h2>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{near.slice(0, 3).map((c) => (
									<div key={c.possibility.id} className="rounded-xl border border-gold-line bg-card p-4 text-sm">
										<strong className="font-display text-base">{c.possibility.title}</strong>
										<p className="mt-1 text-muted">
											{c.participants}/{c.possibility.minParticipants} {t("card.committed")} —{" "}
											{c.possibility.minParticipants - c.participants} {t("card.more")}.
										</p>
										<Link to={`/possibilities#${c.possibility.id}`} className="mt-1 inline-block font-semibold text-forest dark:text-lime">
											{t("att.card.cta")} →
										</Link>
									</div>
								))}
								{i.proposedOverlaps > 0 && (
									<div className="rounded-xl border border-gold-line bg-card p-4 text-sm">
										<strong className="font-display text-base">
											{i.proposedOverlaps} {t(`att.overlap.${i.proposedOverlaps === 1 ? "one" : "many"}`)}
										</strong>
										<p className="mt-1 text-muted">{t("att.overlaps.body")}</p>
										<Link to="/collaborate#overlaps" className="mt-1 inline-block font-semibold text-forest dark:text-lime">
											{t("att.overlaps.cta")} →
										</Link>
									</div>
								)}
								{i.actionNodes.length > 0 && (
									<div className="rounded-xl border border-gold-line bg-card p-4 text-sm">
										<strong className="font-display text-base">
											{i.actionNodes.length} {t(`att.actions.${i.actionNodes.length === 1 ? "one" : "many"}`)}
										</strong>
										<p className="mt-1 text-muted">{t("att.actions.body")}</p>
										<Link to="/collaborate#outcomes" className="mt-1 inline-block font-semibold text-forest dark:text-lime">
											{t("att.actions.cta")} →
										</Link>
									</div>
								)}
							</div>
						</div>
					</section>
				)}

				{/* ── deck preview ─────────────────────────────────────── */}
				<section id="deck" className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
					<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
						<BlurFade inView>
							<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("deck.kicker")}</span>
							<h2 className="mt-2 font-display text-4xl sm:text-5xl">
								{t("deck.h2")} <em className="text-sage">{t("deck.h2.em")}</em>
							</h2>
						</BlurFade>
						<div className="flex items-center gap-4">
							<nav aria-label={t("a11y.filters")} className="flex gap-1 rounded-full border border-line bg-card p-1 text-sm">
								{[
									["/possibilities", t("deck.all"), true],
									["/possibilities?status=active", t("deck.building"), false],
									["/possibilities?status=quorum", t("deck.quorum"), false],
									["/possibilities?status=completed", t("deck.completed"), false],
								].map(([href, label, active]) => (
									<Link
										key={String(href)}
										to={String(href)}
										aria-current={active ? "true" : undefined}
										className={`rounded-full px-3 py-1.5 ${active ? "bg-forest text-cream dark:bg-lime dark:text-forest" : "text-muted hover:bg-pale"}`}
									>
										{label}
									</Link>
								))}
							</nav>
							<Link to="/possibilities" className="hidden text-sm text-muted hover:text-foreground sm:block">
								{i.cards.length} {t("deck.count.cards")} · {live.length} {t("deck.count.open")} · {atQuorum.length}{" "}
								{t("deck.count.quorum")} →
							</Link>
						</div>
					</div>
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{featured.map((c, idx) => (
							<BlurFade key={c.possibility.id} inView delay={idx * 0.06}>
								<PossibilityCard
									d={{
										id: c.possibility.id,
										title: c.possibility.title,
										place: c.possibility.place,
										status: effectiveStatus(c.possibility),
										participants: c.participants,
										min: c.possibility.minParticipants || 0,
										deadline: c.possibility.deadline,
									}}
								/>
							</BlurFade>
						))}
						{featured.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-line p-10 text-center text-muted">{t("attention.none")}</div>}
					</div>
				</section>

				{/* ── doors ────────────────────────────────────────────── */}
				<section className="mx-auto max-w-7xl px-5 pb-20 lg:px-10">
					<h2 className="mb-6 font-display text-3xl">{t("doors.title")}</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{[
							["/possibilities", t("doors.join"), t("doors.join.body")],
							["/collaborate", t("doors.work"), t("doors.work.body")],
							["/fund", t("doors.fund"), t("doors.fund.body")],
							["/impact", t("doors.impact"), t("doors.impact.body")],
						].map(([href, title, body], idx) => (
							<BlurFade key={href} inView delay={idx * 0.06}>
								<Link
									to={href}
									className="group block h-full rounded-2xl border border-line bg-card p-6 transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-lime-deep hover:shadow-lg"
								>
									<h3 className="font-display text-2xl transition-colors group-hover:text-sage">{title}</h3>
									<p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
									<span className="mt-4 inline-block text-coral transition-transform group-hover:translate-x-1">→</span>
								</Link>
							</BlurFade>
						))}
					</div>
				</section>

				{/* ── impact ───────────────────────────────────────────── */}
				<section id="impact" className="bg-forest py-20 text-cream">
					<div className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-2 lg:px-10">
						<BlurFade inView>
							<span className="text-xs font-bold uppercase tracking-widest text-lime">{t("impact.kicker")}</span>
							<h2 className="mt-3 font-display text-4xl sm:text-5xl">
								{t("impact.h2")} <em className="text-lime">{t("impact.h2.em")}</em>
							</h2>
							<p className="mt-4 max-w-md text-cream/80">{t("impact.copy")}</p>
							<div className="mt-6 flex flex-col gap-2.5 text-sm">
								{[t("impact.point.1"), t("impact.point.2"), t("impact.point.3")].map((p) => (
									<span key={p} className="flex items-center gap-2">
										<Check className="size-4 text-lime" />
										{p}
									</span>
								))}
							</div>
						</BlurFade>
						<BlurFade inView delay={0.15}>
							<aside className="rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur">
								<div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-cream/60">
									<span>{t("impact.panel")}</span>
									<span className="flex items-center gap-1.5 text-lime"><span className="size-1.5 animate-pulse rounded-full bg-lime" aria-hidden />{t("landing.live")}</span>
								</div>
								<div className="mt-6">
									<strong className="font-display text-6xl text-lime">
										<NumberTicker value={i.hoursTotal} />
									</strong>
									<span className="ms-2 text-cream/70">{t("impact.hours")}</span>
								</div>
								<div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
									<div>
										<strong className="block text-3xl"><NumberTicker value={i.completedCount} /></strong>
										<span className="text-xs uppercase tracking-wide text-cream/60">{t("impact.actions")}</span>
									</div>
									<div>
										<strong className="block text-3xl"><NumberTicker value={i.cards.length} /></strong>
										<span className="text-xs uppercase tracking-wide text-cream/60">{t("impact.cards")}</span>
									</div>
									<div>
										<strong className="block text-3xl">
											<NumberTicker value={i.quorumRate} />%
										</strong>
										<span className="text-xs uppercase tracking-wide text-cream/60">{t("impact.quorum")}</span>
									</div>
								</div>
								<Link to="/impact" className="mt-6 inline-block font-semibold text-lime hover:underline">
									{t("impact.allResults")} →
								</Link>
							</aside>
						</BlurFade>
					</div>
				</section>

				{/* ── cta ──────────────────────────────────────────────── */}
				<section className="px-5 py-24 text-center">
					<BlurFade inView>
						<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{t("cta.kicker")}</span>
						<h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl sm:text-5xl">
							{t("cta.h2.pre")} <em className="text-sage">{t("cta.h2.em")}</em>
						</h2>
						<p className="mx-auto mt-4 max-w-xl text-ink-mute">{t("cta.copy")}</p>
						<div className="mt-8">
							<Button asChild variant="lime" size="lg" className="text-base">
								<Link to="/possibilities#declare">
									<AnimatedShinyText>{t("cta.button")} →</AnimatedShinyText>
								</Link>
							</Button>
						</div>
					</BlurFade>
				</section>
			</main>
			<SiteFooter />
		</div>
	);
}
