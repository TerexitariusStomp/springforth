import { useTranslation } from "react-i18next";
import type { Route } from "./+types/whitepaper";
import { fetchUI } from "~/lib/api";
import type { renderWhitepaper } from "@springforth/portal";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [lang] = await fetchUI<Parameters<typeof renderWhitepaper>>(context, request);
	return { lang };
}

export function meta() {
	return [{ title: "Whitepaper — Springforth" }];
}

// The paper is structured prose; wp.* strings carry inline markup by design.
type Block = { t: "h2" | "h3" | "p" | "pm" | "raw"; k: string; id?: string; no?: string };
const BODY: Block[] = [
	{ t: "h2", k: "wp.s1.h", id: "s1", no: "01" },
	{ t: "p", k: "wp.s1.p1" }, { t: "p", k: "wp.s1.p2" }, { t: "p", k: "wp.s1.p3" },
	{ t: "h2", k: "wp.s2.h", id: "s2", no: "02" },
	{ t: "p", k: "wp.s2.p1" }, { t: "p", k: "wp.s2.p2" }, { t: "p", k: "wp.s2.p3" },
	{ t: "raw", k: "wp.s2.table" }, { t: "p", k: "wp.s2.p4" }, { t: "p", k: "wp.s2.p5" },
	{ t: "h2", k: "wp.s3.h", id: "s3", no: "03" },
	{ t: "p", k: "wp.s3.p1" }, { t: "p", k: "wp.s3.p2" }, { t: "p", k: "wp.s3.p3" },
	{ t: "h2", k: "wp.s4.h", id: "s4", no: "04" },
	{ t: "p", k: "wp.s4.p1" }, { t: "p", k: "wp.s4.p2" }, { t: "p", k: "wp.s4.p3" },
	{ t: "h2", k: "wp.s5.h", id: "s5", no: "05" },
	{ t: "p", k: "wp.s5.intro" },
	{ t: "h3", k: "wp.s5.sub1.h", no: "5.1" }, { t: "p", k: "wp.s5.sub1.p" },
	{ t: "h3", k: "wp.s5.sub2.h", no: "5.2" }, { t: "p", k: "wp.s5.sub2.p" },
	{ t: "h3", k: "wp.s5.sub3.h", no: "5.3" }, { t: "p", k: "wp.s5.sub3.p" },
	{ t: "h3", k: "wp.s5.sub4.h", no: "5.4" }, { t: "p", k: "wp.s5.sub4.p" },
	{ t: "p", k: "wp.s5.live" },
	{ t: "h2", k: "wp.s6.h", id: "s6", no: "06" },
	{ t: "p", k: "wp.s6.p1" }, { t: "p", k: "wp.s6.p2" }, { t: "p", k: "wp.s6.p3" },
	{ t: "h2", k: "wp.s7.h", id: "s7", no: "07" },
	{ t: "p", k: "wp.s7.p1" }, { t: "raw", k: "wp.s7.table" }, { t: "p", k: "wp.s7.p2" },
	{ t: "h2", k: "wp.s8.h", id: "s8", no: "08" }, { t: "p", k: "wp.s8.p1" },
	{ t: "h2", k: "wp.s9.h", id: "s9", no: "09" }, { t: "raw", k: "wp.s9.table" }, { t: "p", k: "wp.s9.p1" },
	{ t: "h2", k: "wp.s10.h", id: "s10", no: "10" },
	{ t: "p", k: "wp.s10.p1" }, { t: "p", k: "wp.s10.p2" }, { t: "p", k: "wp.s10.p3" },
	{ t: "h2", k: "wp.s11.h", id: "s11", no: "11" }, { t: "raw", k: "wp.s11.list" },
	{ t: "h2", k: "wp.s12.h", id: "s12", no: "12" }, { t: "raw", k: "wp.s12.table" },
	{ t: "pm", k: "wp.s12.end" },
];

const WP = ({ html }: { html: string }) => (
	<span dangerouslySetInnerHTML={{ __html: html }} />
);

export default function Whitepaper() {
	const { t } = useTranslation();
	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("wp.kicker")} title="Springforth"
					back={{ href: "/how-it-works", label: t("nav.howItWorks") }}
				/>
				<article className="mx-auto mt-8 max-w-3xl [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-xl [&_table]:w-full [&_table]:text-sm [&_code]:text-[0.85em]">
					<p className="text-ink-mute"><WP html={t("wp.lede")} /></p>
					<div className="mt-6 border-l-[3px] border-lime pl-5 text-lg">
						<WP html={t("wp.abstract")} />
					</div>
					<h2 className="mt-12 font-display text-3xl">{t("wp.toc")}</h2>
					<ol className="mt-4 list-decimal columns-1 gap-10 pl-5 sm:columns-2 [&_a]:text-info [&_a]:underline">
						{Array.from({ length: 12 }, (_, i) => (
							<li key={i} className="my-1 break-inside-avoid">
								<a href={`#s${i + 1}`}><WP html={t(`wp.toc.${i + 1}`)} /></a>
							</li>
						))}
					</ol>
					{BODY.map((b, i) => {
						const html = t(b.k);
						if (b.t === "h2") {
							return (
								<h2 key={i} id={b.id} className="mt-14 scroll-mt-24 font-display text-3xl">
									<span className="mb-1 block font-sans text-[0.55em] font-bold tracking-[0.12em] text-coral-ink">{b.no}</span>
									<WP html={html} />
								</h2>
							);
						}
						if (b.t === "h3") return <h3 key={i}><WP html={`${b.no} ${html}`} /></h3>;
						if (b.t === "pm") return <p key={i} className="mt-4 text-muted"><WP html={html} /></p>;
						if (b.t === "raw") return <div key={i} tabIndex={0} role="region" aria-label={`${t("a11y.tableScroll")} ${i + 1}`} className="my-4 overflow-x-auto"><WP html={html} /></div>;
						return <p key={i} className="mt-4 leading-relaxed"><WP html={html} /></p>;
					})}
				</article>
			</main>
			<SiteFooter />
		</div>
	);
}
