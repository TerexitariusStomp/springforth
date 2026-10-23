import { Link, useLocation, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { Menu, X, ChevronDown } from "lucide-react";
import { LANGS } from "~/lib/i18n";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export const SPARK = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="size-5">
		<path d="M12 2v5m0 10v5M2 12h5m10 0h5M5.6 5.6l3.2 3.2m6.4 6.4l3.2 3.2M5.6 18.4l3.2-3.2m6.4-6.4l3.2-3.2" />
	</svg>
);

export function LangSwitch({ label }: { label: string }) {
	const { i18n } = useTranslation();
	const [params] = useSearchParams();
	const { pathname } = useLocation();
	return (
		<nav aria-label={label} className="flex items-center gap-1 text-[11px] font-bold tracking-wider">
			{LANGS.map((l) => {
				const q = new URLSearchParams(params);
				q.set("lang", l);
				const active = i18n.language === l;
				return (
					<a
						key={l}
						href={`${pathname}?${q.toString()}`}
						hrefLang={l}
						lang={l}
						aria-current={active ? "true" : undefined}
						className={cn(
							"rounded-full px-2 py-1 transition-colors",
							active ? "bg-lime text-forest" : "text-cream/70 hover:text-cream",
						)}
					>
						{l.toUpperCase()}
					</a>
				);
			})}
		</nav>
	);
}

export function SiteHeader() {
	const { t } = useTranslation();

	const hubs: [string, string][] = [
		["/possibilities", t("nav.possibilities")],
		["/collaborate", t("nav.collaborate")],
		["/fund", t("nav.fund")],
		["/impact", t("nav.impact")],
		["/community", t("nav.community")],
	];
	const learn: [string, string][] = [
		["/how-it-works", t("nav.howItWorks")],
		["/whitepaper", t("nav.whitepaper")],
		["/docs", t("nav.apiDocs")],
		["https://t.me/springforth_bot", t("nav.telegram")],
	];

	return (
		<>
			<a
				href="#main"
				className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-lime focus:px-4 focus:py-2 focus:text-forest"
			>
				{t("a11y.skipToContent")}
			</a>
			<header className="sticky top-0 z-40 border-b border-white/10 bg-forest text-cream">
				<div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-5 lg:px-10">
					<Link to="/" className="flex items-center gap-2 font-display text-2xl tracking-tight">
						<span className="text-lime">{SPARK}</span>
						Springforth
					</Link>
					<nav aria-label={t("a11y.primaryNav")} className="hidden items-center gap-6 text-sm font-medium lg:flex">
						{hubs.map(([h, l]) => (
							<Link key={h} to={h} className="text-cream/80 transition-colors hover:text-lime">
								{l}
							</Link>
						))}
						<div className="group relative">
							<Link to="/how-it-works" className="flex items-center gap-1 text-cream/80 transition-colors hover:text-lime" aria-haspopup="true">
								{t("nav.learn")}
								<ChevronDown className="size-3.5 transition-transform group-focus-within:rotate-180 group-hover:rotate-180" />
							</Link>
							<nav
								aria-label={t("nav.learn")}
								className="invisible absolute right-0 top-full z-50 mt-1 flex w-52 flex-col rounded-xl border border-white/10 bg-forest p-2 opacity-0 shadow-xl transition-[opacity,transform] group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
							>
								{learn.map(([h, l]) =>
									h.startsWith("http") ? (
										<a key={h} href={h} rel="noopener" className="rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10 hover:text-lime">
											{l}
										</a>
									) : (
										<Link key={h} to={h} className="rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10 hover:text-lime">
											{l}
										</Link>
									),
								)}
							</nav>
						</div>
					</nav>
					<div className="hidden lg:block">
						<LangSwitch label={t("a11y.language")} />
					</div>
					<Button asChild size="sm" className="hidden lg:inline-flex">
						<Link to="/possibilities#declare">{t("nav.startPossibility")}</Link>
					</Button>
					{/* details/summary — the menu opens without JS */}
					<details className="group lg:hidden">
						<summary
							className="inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-lg [&::-webkit-details-marker]:hidden"
							aria-label={t("a11y.menu")}
						>
							<Menu className="size-5 group-open:hidden" />
							<X className="hidden size-5 group-open:block" />
						</summary>
						<nav aria-label={t("a11y.menu")} className="absolute inset-x-0 top-full border-t border-white/10 bg-forest px-5 py-4">
							{[...hubs, ...learn].map(([h, l]) =>
								h.startsWith("http") ? (
									<a key={h} href={h} rel="noopener" className="block rounded-lg px-3 py-2.5 text-cream/85 hover:bg-white/10">
										{l}
									</a>
								) : (
									<Link key={h} to={h} className="block rounded-lg px-3 py-2.5 text-cream/85 hover:bg-white/10">
										{l}
									</Link>
								),
							)}
							<div className="mt-3 border-t border-white/10 pt-3">
								<LangSwitch label={t("a11y.langMenu")} />
							</div>
						</nav>
					</details>
				</div>
			</header>
		</>
	);
}

export function SiteFooter() {
	const { t } = useTranslation();
	const col = (title: string, items: [string, string][]) => (
		<nav aria-label={title} className="flex flex-col gap-2">
			<h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-lime">{title}</h2>
			{items.map(([h, l]) =>
				h.startsWith("http") ? (
					<a key={h} href={h} rel="noopener" className="text-sm text-cream/70 hover:text-cream">
						{l}
					</a>
				) : (
					<Link key={h} to={h} className="text-sm text-cream/70 hover:text-cream">
						{l}
					</Link>
				),
			)}
		</nav>
	);
	return (
		<footer className="border-t border-white/10 bg-forest text-cream">
			<div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
				<div>
					<Link to="/" className="flex items-center gap-2 font-display text-2xl">
						<span className="text-lime">{SPARK}</span>
						Springforth
					</Link>
					<p className="mt-2 max-w-56 text-sm text-cream/70">{t("footer.tagline")}</p>
				</div>
				{col(t("footer.use"), [
					["/possibilities", t("nav.possibilities")],
					["/collaborate", t("nav.collaborate")],
					["/fund", t("nav.fund")],
					["/impact", t("nav.impact")],
					["/community", t("nav.community")],
				])}
				{col(t("footer.learn"), [
					["/how-it-works", t("nav.howItWorks")],
					["/whitepaper", t("nav.whitepaper")],
					["/docs", t("nav.apiDocs")],
				])}
				{col(t("footer.connect"), [
					["https://t.me/springforth_bot", t("nav.telegram")],
					["https://github.com/TerexitariusStomp/springforth", t("footer.github")],
					["/ledger/verify", t("footer.verify")],
				])}
			</div>
			<div className="border-t border-white/10 px-5 py-4 lg:px-10">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<LangSwitch label={t("a11y.langFooter")} />
					<span className="text-xs text-cream/70">
						{t("footer.generated")} {new Date().toISOString()}
					</span>
				</div>
			</div>
		</footer>
	);
}
