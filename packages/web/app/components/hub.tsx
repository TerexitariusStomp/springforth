import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

/** Page header — kicker + display h1 + lede, matching pageHeader(). */
export function HubHead({ kicker, title, em, lede, back }: {
	kicker: string; title: string; em?: string; lede?: string;
	back?: { href: string; label: string };
}) {
	return (
		<header className="mx-auto max-w-7xl px-5 pt-12 lg:px-10">
			{back && (
				<a href={back.href} className="mb-4 inline-block text-sm font-semibold text-info">
					← {back.label}
				</a>
			)}
			<span className="block text-xs font-bold uppercase tracking-widest text-coral-ink">{kicker}</span>
			<h1 className="mt-2 font-display text-4xl sm:text-5xl">
				{title} {em && <em className="text-sage">{em}</em>}
			</h1>
			{lede && <p className="mt-3 max-w-2xl text-ink-mute">{lede}</p>}
		</header>
	);
}

/** Sticky in-page subnav — plain anchors, works without JS. */
export function HubNav({ items }: { items: { href: string; label: string }[] }) {
	const { t } = useTranslation();
	return (
		<nav
			aria-label={t("a11y.sectionNav")}
			className="sticky top-14 z-30 -mx-5 mt-8 flex gap-1 overflow-x-auto border-y border-line bg-cream/90 px-5 py-2 backdrop-blur lg:-mx-10 lg:px-10"
		>
			{items.map((i) => (
				<a
					key={i.href}
					href={i.href}
					className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-pale hover:text-foreground aria-current:bg-forest aria-current:text-cream dark:aria-current:bg-lime dark:aria-current:text-forest"
				>
					{i.label}
				</a>
			))}
		</nav>
	);
}

/** Collapsible hub section — native details, open by default. */
export function HubSection({ id, kicker, title, count, lede, children, className }: {
	id: string; kicker: string; title: string; count?: number; lede?: string;
	children: React.ReactNode; className?: string;
}) {
	return (
		<details id={id} open className={cn("group scroll-mt-32 border-b border-line py-8", className)}>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
				<div>
					<span className="text-xs font-bold uppercase tracking-widest text-coral-ink">{kicker}</span>
					<h2 className="mt-1 font-display text-2xl sm:text-3xl">
						{title}
						{count != null && <span className="ml-2 text-base font-normal text-muted">· {count}</span>}
					</h2>
				</div>
				<ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
			</summary>
			<div className="mt-5">
				{lede && <p className="mb-4 max-w-2xl text-sm text-ink-mute">{lede}</p>}
				{children}
			</div>
		</details>
	);
}

/** "How this works" note — links into the whitepaper section. */
export function HowNote({ noteKey, anchor }: { noteKey: string; anchor: string }) {
	const { t } = useTranslation();
	return (
		<details className="mt-4 rounded-xl border border-line bg-pale/50">
			<summary className="cursor-pointer p-3 text-sm font-semibold text-info">
				{t("how.label")}
			</summary>
			<div className="border-t border-line px-4 py-3 text-sm text-muted">
				{t(noteKey)}{" "}
				<a href={`/whitepaper#${anchor}`} className="font-semibold text-info underline">
					{t("how.more")}
				</a>
			</div>
		</details>
	);
}

export const field =
	"h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
export const submit =
	"h-11 shrink-0 rounded-full bg-forest px-5 text-xs font-extrabold text-cream transition-colors hover:bg-sage dark:bg-lime dark:text-forest";
export const emptyCls = "rounded-xl border border-dashed border-line p-6 text-sm text-muted";
export const cardCls = "rounded-2xl border border-line bg-card p-5 shadow-sm";
export const tableCls = "w-full border-collapse text-sm";
export const thCls = "border-b border-line pb-2 pr-4 text-left text-xs font-bold uppercase tracking-wide text-muted";
export const tdCls = "border-b border-line/60 py-2 pr-4 align-top";

export function StatGrid({ items }: { items: { v: string; l: string }[] }) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{items.map((i) => (
				<div key={i.l} className="rounded-2xl border border-line bg-card p-4">
					<b className="block font-display text-3xl">{i.v}</b>
					<span className="mt-1 block text-xs uppercase tracking-wide text-muted">{i.l}</span>
				</div>
			))}
		</div>
	);
}
