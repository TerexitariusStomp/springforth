import { useTranslation } from "react-i18next";
import type { Route } from "./+types/docs";
import type { renderDocsPage } from "@springforth/portal";
import { fetchUI } from "~/lib/api";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead, tableCls, thCls, tdCls } from "~/components/hub";

export async function loader({ request, context }: Route.LoaderArgs) {
	const [paths] = await fetchUI<Parameters<typeof renderDocsPage>>(context, request);
	return { paths };
}

export function meta() {
	return [{ title: "API docs — Springforth" }];
}

const FAMILY: [string, RegExp][] = [
	["coordination", /^\/(possibilities|plans|nodes|overlaps|signals|commitments|coordination|resources|portfolio|trust|agent|import)/],
	["actors", /^\/actors/],
	["funding", /^\/(rounds|pledges|donations|retro|streams|subscriptions)/],
	["claims", /^\/(claims|attestations)/],
	["chain", /^\/chain/],
	["governance", /^\/governance/],
	["data", /^\/(datasets|evidence|ledger)/],
	["evidence", /^\/(oracle|sources|outcomes|report|verify|metrics)/],
	["integrations", /^\/(silvi|treegens|tg)/],
];

const BOT_COMMANDS: [string, string][] = [
	["/cards", "api.bot.cards"],
	["/new <title> | bring <a, b> | need <c> | quorum <n> | place <where> | by <date>", "api.bot.new"],
	["/join <card> [bring <x>]", "api.bot.join"],
	["/need <card> <text>", "api.bot.need"],
	["/pass <card>", "api.bot.pass"],
	["/appreciate <card> @user <note>", "api.bot.appreciate"],
	["/done <card> <summary>", "api.bot.done"],
];

export default function Docs({ loaderData }: Route.ComponentProps) {
	const { paths } = loaderData;
	const { t } = useTranslation();

	const groups = new Map<string, [string, string, string][]>();
	const misc: [string, string, string][] = [];
	for (const [path, ops] of Object.entries(paths)) {
		for (const [method, op] of Object.entries(ops)) {
			const m = method.toUpperCase();
			const key = `api.${m} ${path}`;
			const translated = t(key);
			const row: [string, string, string] = [m, path, translated === key ? (op.summary ?? "") : translated];
			const fam = FAMILY.find(([, re]) => re.test(path));
			if (fam) {
				const arr = groups.get(fam[0]) ?? [];
				arr.push(row);
				groups.set(fam[0], arr);
			} else misc.push(row);
		}
	}

	const Section = ({ famKey, rows }: { famKey: string; rows: [string, string, string][] }) => (
		<section className="mt-8">
			<h2 className="font-display text-2xl">{t(`api.fam.${famKey}`)}</h2>
			<div tabIndex={0} role="region" aria-label={`${t(`api.fam.${famKey}`)} — ${t("a11y.tableScroll")}`} className="mt-3 overflow-x-auto">
				<table className={tableCls}>
					<tbody>
						{rows.sort((a, b) => a[1].localeCompare(b[1])).map(([m, p, s]) => (
							<tr key={`${m}${p}`}>
								<td className={`${tdCls} w-16`}><code className="rounded bg-lime/40 px-1.5 py-0.5 text-xs font-bold">{m}</code></td>
								<td className={tdCls}><code className="text-xs">{p}</code></td>
								<td className={`${tdCls} text-muted`}>{s}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-5xl px-5 pb-16 lg:px-10">
				<HubHead
					kicker={t("detail.docs.kicker")} title={t("detail.docs.title")}
					back={{ href: "/how-it-works", label: t("nav.howItWorks") }}
				/>
				<p className="mt-4 text-ink-mute">{t("detail.docs.lede")}</p>
				<div className="mt-6 rounded-2xl border border-line bg-card p-6">
					<h2 className="font-display text-2xl">
						{t("api.bot.title")} —{" "}
						<a href="https://t.me/springforth_bot" rel="noopener" className="text-info underline">@springforth_bot</a>
					</h2>
					<p className="mt-2 text-sm text-muted">{t("api.bot.body")}</p>
					<table className={`${tableCls} mt-4`}>
						<thead><tr>
							<th className={thCls}>{t("col.command")}</th>
							<th className={thCls}>{t("col.does")}</th>
						</tr></thead>
						<tbody>
							{BOT_COMMANDS.map(([cmd, key]) => (
								<tr key={cmd}>
									<td className={tdCls}><code className="rounded bg-pale px-1.5 py-0.5 text-xs">{cmd}</code></td>
									<td className={tdCls}>{t(key)}</td>
								</tr>
							))}
						</tbody>
					</table>
					<p className="mt-4 text-sm text-muted">{t("api.bot.webhook")}</p>
				</div>
				{[...groups.entries()].map(([g, rows]) => <Section key={g} famKey={g} rows={rows} />)}
				{misc.length > 0 && <Section famKey="other" rows={misc} />}
			</main>
			<SiteFooter />
		</div>
	);
}
