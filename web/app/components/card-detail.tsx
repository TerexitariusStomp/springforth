import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ActorName } from "~/components/actor-name";
import type { CardConnections, PossibilityCard } from '../../../src/portal/index';
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Check } from "lucide-react";

const money = (amount: number, currency: string) =>
	new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
const money0 = (amount: number, currency: string) =>
	`${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;

function trailKey(kind: string): string {
	if (kind.startsWith("possibility.")) {
		const map: Record<string, string> = {
			declared: "trail.declared", joined: "trail.joined", quorum: "trail.quorum",
			completed: "trail.completed", expired: "trail.expired",
			appreciated: "trail.appreciated", passed: "trail.passed",
			interested: "trail.interested", need_flagged: "trail.need",
		};
		return map[kind.slice("possibility.".length)] ?? "trail.other";
	}
	if (kind.startsWith("pledge.")) return "trail.pledge";
	if (kind === "council.seated") return "trail.seat";
	if (kind === "forum.posted") return "trail.post";
	if (kind === "context.refreshed") return "trail.context";
	return "trail.other";
}

export { trailKey };

function countdown(deadline: string | undefined, t: (k: string) => string): string {
	if (!deadline) return t("card.openEnded");
	const d = Math.ceil((Date.parse(deadline) - Date.now()) / 86_400_000);
	return d < 0 ? t("card.deadlinePassed") : d === 0 ? t("card.today") : `${d} ${t("card.daysLeft")}`;
}

const field =
	"h-11 flex-1 min-w-[8rem] rounded-lg border border-line bg-card px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const submit =
	"h-11 rounded-full bg-forest px-5 text-xs font-extrabold text-cream transition-colors hover:bg-sage dark:bg-lime dark:text-forest";

function Form({ action, children, className }: { action: string; children: React.ReactNode; className?: string }) {
	return (
		<form method="post" action={action} className={cn("mt-2 flex flex-wrap gap-2", className)}>
			{children}
		</form>
	);
}

/** The full card overlay — every block from the legacy detail panel. */
export function CardDetail({ c, conn }: { c: PossibilityCard; conn?: CardConnections }) {
	const { t } = useTranslation();
	const live = c.status === "active" || c.status === "draft";
	const cover = c.scoring.cover;
	const partCap = c.maxParticipants ? `/${c.maxParticipants} cap` : "";

	return (
		<div className="space-y-4">
			<h3 className="font-display text-3xl leading-tight">“{c.title}”</h3>
			<div className="flex flex-wrap gap-1.5">
				<Badge variant="lime">{c.status}</Badge>
				{c.tipping && <Badge variant="gold">{t("card.tipping")}</Badge>}
				<Badge>{countdown(c.deadline, t)}</Badge>
				<Badge>{c.participantCount}/{c.minParticipants} {t("card.in")}{partCap}</Badge>
				{conn?.interestCount ? <Badge>{conn.interestCount} {t("card.interested")}</Badge> : null}
				<Badge>{t("card.needs").toLowerCase()} {c.quorum.requiredMet}/{c.quorum.required}</Badge>
				<Badge>{t("card.score")} {c.score.toFixed(2)}</Badge>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-line/60">
				<div className="h-full rounded-full bg-lime" style={{ width: `${Math.round(cover * 100)}%` }} />
			</div>
			<p className="text-xs text-muted">
				{t("card.cover")} {(cover * 100).toFixed(0)}% · {t("card.trust")} {c.scoring.trust.toFixed(2)} · {t("card.urgency")}{" "}
				{c.scoring.urgency.toFixed(2)}
			</p>

			{c.value && <ValueBlock v={c.value} />}
			<p className="text-sm">
				{t("card.declaredBy")} <strong>{<ActorName id={c.declarerId} />}</strong>
				{c.place ? ` · ${c.place}` : ""}
				{c.timeStart ? ` · ${c.timeStart.slice(0, 10)}${c.timeEnd ? ` → ${c.timeEnd.slice(0, 10)}` : ""}` : ""} ·{" "}
				<a href={`/possibilities/${c.id}/ics`} className="text-info underline">{t("card.ics")}</a>
			</p>
			{conn?.geo && (
				<p className="text-sm">
					<Link to="/map" className="text-info underline">{t("map.full")} →</Link>
					<span className="ml-2 text-muted">({conn.geo.lat.toFixed(3)}, {conn.geo.lon.toFixed(3)})</span>
				</p>
			)}
			{c.description && <p className="text-sm leading-relaxed">{c.description}</p>}
			<WhyBlock c={c} conn={conn} />
			<ScenarioBlock c={c} />
			{c.context?.datasets?.length ? (
				<div>
					<p className="text-sm text-info"><strong>{t("card.verified")}</strong></p>
					<ul className="mt-1 space-y-1 text-sm">
						{c.context.datasets.map((d, i) => (
							<li key={i}>◆ {d.name}: {d.value}{d.source ? <span className="text-muted"> ({d.source})</span> : null}</li>
						))}
					</ul>
				</div>
			) : null}

			{c.needs.length > 0 && (
				<div>
					<p><strong>{t("card.needs")}</strong></p>
					<ul className="mt-1 space-y-1 text-sm">
						{c.needs.map((n) => (
							<li key={n.id} className="flex flex-wrap items-center gap-1.5">
								{n.met
									? <Check className="size-4 text-ok" aria-hidden />
									: <span className="size-1 rounded-full bg-muted" aria-hidden />}
								<span>{n.label}</span>
								{n.category && <span className="text-xs text-muted">[{n.category}]</span>}
								{n.required
									? <span className="text-xs text-danger-ink">{t("need.required")}</span>
									: <span className="text-xs text-muted">{t("need.nice")}</span>}
								{n.flaggedBy && <span className="text-xs text-muted">{t("need.flaggedBy")} {n.flaggedBy}</span>}
								{n.met && <span className="text-xs text-ok">{t("need.met")}</span>}
							</li>
						))}
					</ul>
				</div>
			)}
			{c.bringing.length > 0 && (
				<div>
					<p><strong>{t("card.bringing")}</strong></p>
					<ul className="mt-1 space-y-1 text-sm">
						{c.bringing.map((n) => <li key={n.id}>{n.label} — {n.orgIds[0] ?? ""}</li>)}
					</ul>
				</div>
			)}
			{c.participants === undefined ? (
				<p className="text-sm">
					<strong>{t("card.inH")}:</strong> {c.participantCount} — <em>{t("card.namesReveal")}</em>
				</p>
			) : c.participants.length > 0 ? (
				<div>
					<p><strong>{t("card.inH")} ({c.participantCount})</strong></p>
					<ul className="mt-1 space-y-1 text-sm">
						{c.participants.map((x, i) => (
							<li key={i}>{x.actor}{x.bringingNodeId ? ` + ${t("card.bringingPlus")}` : ""}</li>
						))}
					</ul>
				</div>
			) : null}

			{live && (
				<div className="space-y-3 rounded-xl border border-line bg-pale/50 p-4">
					<Form action={`/possibilities/${c.id}/join`}>
						<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
						<input name="bringing" placeholder={t("form.bringing")} aria-label={t("form.bringing")} className={field} />
						<input name="hours" type="number" min="0" step="0.5" placeholder={t("form.hours")} aria-label={t("form.hours")} className={cn(field, "max-w-28")} />
						<button className={submit}>{t("form.coming")}</button>
					</Form>
					<Form action={`/possibilities/${c.id}/need`}>
						<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
						<input name="title" placeholder={t("form.needMissing")} aria-label={t("form.needMissing")} required className={field} />
						<input name="category" placeholder={t("form.category")} aria-label={t("form.category")} className={field} />
						<button className={submit}>{t("form.flagNeed")}</button>
					</Form>
					<Form action={`/possibilities/${c.id}/pass`}>
						<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
						<button className={submit}>{t("form.pass")}</button>
					</Form>
				</div>
			)}

			{(live || c.status === "quorum") && (
				<details className="rounded-xl border border-line">
					<summary className="cursor-pointer p-3 text-sm font-semibold">{t("pledge.title")}</summary>
					<div className="border-t border-line p-4 text-sm text-muted">
						<p>{t("pledge.body")}</p>
						<Form action={`/possibilities/${c.id}/pledge`}>
							<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
							<input name="amount" type="number" min="1" step="0.01" placeholder={t("pledge.amount")} aria-label={t("pledge.amount")} required className={cn(field, "max-w-28")} />
							<input name="currency" placeholder={t("pledge.currency")} aria-label={t("pledge.currency")} defaultValue={Object.keys(c.value?.byCurrency ?? {})[0] ?? "USD"} className={cn(field, "max-w-20")} />
							<button className={submit}>{t("pledge.cta")}</button>
						</Form>
					</div>
				</details>
			)}

			{(c.status === "completed" || c.status === "quorum") && (
				<Form action={`/possibilities/${c.id}/appreciate`}>
					<input name="from" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
					<input name="to" placeholder={t("form.whoShowed")} aria-label={t("form.whoShowed")} required className={field} />
					<input name="note" placeholder={t("form.noteClutch")} aria-label={t("form.noteClutch")} className={field} />
					<button className={submit}>{t("form.appreciate")}</button>
				</Form>
			)}

			{c.report && (
				<p className="rounded-lg bg-lime/25 p-3 text-sm">
					<strong>{t("card.report")}</strong> {c.report.summary}
					{c.report.learnings ? <> — <em>{c.report.learnings}</em></> : null}
				</p>
			)}

			{conn?.notes?.length ? <Reviews notes={conn.notes} /> : null}
			<Council c={c} conn={conn} />
			<Forum c={c} conn={conn} />
			{conn?.trail?.length ? <Trail trail={conn.trail} /> : null}
			<Connected c={c} conn={conn} />
		</div>
	);
}

function ValueBlock({ v }: { v: NonNullable<PossibilityCard["value"]> }) {
	const { t } = useTranslation();
	const rows = Object.entries(v.byCurrency).filter(([, c]) => c.total > 0 || c.asked > 0 || c.riskAvoided > 0);
	if (!rows.length && !(v.hoursTotal > 0)) return null;
	return (
		<div className="rounded-xl border border-line bg-card p-4 text-xs text-muted">
			<strong className="text-sm text-foreground">{t("valb.title")}</strong> — {t("valb.lede")}
			<ul className="mt-2 space-y-1.5">
				{rows.map(([cur, c]) => {
					const cap = c.capitals;
					const capBits = cap
						? [
								cap.financial > 0 ? `${money(cap.financial, cur)} ${t("valb.cap.financial")}` : "",
								cap.human > 0 ? `${money(cap.human, cur)} ${t("valb.cap.human")}` : "",
								cap.social > 0 ? `${money(cap.social, cur)} ${t("valb.cap.social")}` : "",
							].filter(Boolean).join(" · ")
						: "";
					return (
						<li key={cur}>
							<details>
								<summary className="cursor-pointer text-sm">
									{cur} <strong>{money(c.total, cur)}</strong>
									{c.leverage > 0 && <small> (×{c.leverage} {t("valb.lev")})</small>}
									<span className="ml-2 text-xs text-muted">{t("valb.groups.mobilized")}</span>
								</summary>
								<ul className="ml-4 mt-1 space-y-1">
									{capBits && <li>{t("valb.impacts")}: {capBits}</li>}
									{c.riskAvoided > 0 && (
										<li>
											{t("valb.groups.avoided")}: {t("valb.est")} {money(c.riskAvoided, cur)}
											{cap?.natural ? ` (${t("valb.cap.natural")})` : ""}
											{c.riskPerUnit > 0 ? ` — ${t("valb.est")} ${money(Math.round(c.riskPerUnit), cur)} ${t("valb.per")} ${money(1, cur)}` : ""}
										</li>
									)}
									{c.asked > 0 && <li>{t("valb.deps")} — {t("valb.groups.cost")}: {money(c.asked, cur)}</li>}
								</ul>
								{v.method.length > 0 && (
									<details className="ml-4">
										<summary className="cursor-pointer text-info">{t("valb.replay")}</summary>
										<ul className="ml-2 mt-1 space-y-0.5">
											{v.method.map((m, i) => <li key={i}>{m}</li>)}
										</ul>
									</details>
								)}
							</details>
						</li>
					);
				})}
			</ul>
			<small>{t("valb.frame")}</small>
			<br />
			<small>
				<a href="https://github.com/TerexitariusStomp/springforth/blob/main/docs/hackathon/VALUATION.md" rel="noopener" className="text-info underline">
					{t("valb.methodology")}
				</a>
			</small>
		</div>
	);
}

function ScenarioBlock({ c }: { c: PossibilityCard }) {
	const { t } = useTranslation();
	const cur = Object.entries(c.value?.byCurrency ?? {}).find(([, v]) => (v.riskAvoided ?? 0) > 0 || (v.asked ?? 0) > 0);
	if (!cur) return null;
	const [ccy, cv] = cur;
	return (
		<div className="rounded-xl border border-gold-line bg-gold-tint/60 p-4 text-sm">
			<strong>{t("scen.title")}</strong>
			<div className="mt-2 grid gap-3 sm:grid-cols-2">
				<div>
					<em className="text-xs font-bold uppercase tracking-wide text-gold-ink not-italic">{t("scen.a")}</em>
					<p className="mt-1 text-xs text-ink-mute">
						{cv.riskAvoided > 0 ? `${t("valb.est")} ${money(cv.riskAvoided, ccy)} ${t("scen.a.risk")} ` : ""}
						{t("scen.a.body")}
						{cv.asked > 0 ? ` ${money(cv.asked, ccy)} ${t("scen.a.cost")}` : ""}
					</p>
				</div>
				<div>
					<em className="text-xs font-bold uppercase tracking-wide text-gold-ink not-italic">{t("scen.b")}</em>
					<p className="mt-1 text-xs text-ink-mute">
						{cv.total > 0 ? `${money(cv.total, ccy)} ` : ""}{t("scen.b.body")}
					</p>
				</div>
			</div>
			<small className="text-gold-ink">{t("scen.lanes")}{ccy === "GBP" ? ` ${t("scen.macro")}` : ""}</small>
		</div>
	);
}

function WhyBlock({ c, conn }: { c: PossibilityCard; conn?: CardConnections }) {
	const { t } = useTranslation();
	const cur = Object.entries(c.value?.byCurrency ?? {}).find(([, v]) => (v.asked ?? 0) > 0 || (v.riskPerUnit ?? 0) > 0);
	const bits: string[] = [];
	if (c.householdsProtected) bits.push(`${c.householdsProtected} ${t("card.why.homes")}`);
	if (cur) {
		const [ccy, cv] = cur;
		if (cv.asked > 0) bits.push(`${money(cv.asked, ccy)} ${t("card.why.ask")}`);
		if (cv.riskPerUnit > 0) bits.push(`${t("valb.est")} ${money(Math.round(cv.riskPerUnit), ccy)} ${t("card.why.per")}`);
	}
	if (conn?.pledges) bits.push(`${conn.pledges} ${t("card.why.pledged")}`);
	if (!bits.length) return null;
	return (
		<p className="text-sm text-info">
			<strong>{t("card.why")}</strong> — {bits.join(" · ")}
			{c.tipping ? <> — <em>{t("card.why.tips")}</em></> : null}
		</p>
	);
}

function Reviews({ notes }: { notes: NonNullable<CardConnections["notes"]> }) {
	const { t } = useTranslation();
	const rows = notes.filter((n) => n.note.trim());
	if (!rows.length) return null;
	return (
		<div className="text-sm">
			<strong>{t("reviews.title")}</strong>
			<ul className="mt-1 space-y-2">
				{rows.map((n, i) => (
					<li key={i} className="border-b border-line pb-2">
						<blockquote className="italic text-ink-mute">“{n.note}”</blockquote>
						<span className="text-xs text-muted">— {<ActorName id={n.from} />} → {<ActorName id={n.to} />}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function Council({ c, conn }: { c: PossibilityCard; conn?: CardConnections }) {
	const { t } = useTranslation();
	const seats = conn?.seats ?? [];
	if (!seats.length && c.status !== "quorum" && c.status !== "completed") return null;
	const byRole = new Map<string, string[]>();
	for (const s of seats) {
		if (!byRole.has(s.role)) byRole.set(s.role, []);
		byRole.get(s.role)!.push(s.actor);
	}
	return (
		<div className="rounded-xl border border-line p-4 text-sm">
			<strong>{t("council.title")}</strong>
			<span className="text-muted"> — {t("council.lede")}</span>
			{byRole.size > 0 ? (
				<ul className="mt-2 space-y-1">
					{[...byRole.entries()].map(([role, actors]) => (
						<li key={role}>
							<strong>{t(`council.role.${role}`)}</strong>
							{role === "verifier" && <span className="text-muted"> ({t("council.selfDeclared")})</span>} —{" "}
							{actors.map((a, i) => <span key={i}>{i > 0 && ", "}<ActorName id={a} /></span>)}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-1 text-muted">{t("council.empty")}</p>
			)}
			{(c.status === "quorum" || c.status === "completed") && (
				<Form action={`/possibilities/${c.id}/council`}>
					<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
					<button className={submit}>{t("council.join")}</button>
				</Form>
			)}
		</div>
	);
}

function Forum({ c, conn }: { c: PossibilityCard; conn?: CardConnections }) {
	const { t } = useTranslation();
	const posts = conn?.posts ?? [];
	const open = c.status === "quorum" || c.status === "completed";
	if (!open && !posts.length) return null;
	const byParent = new Map<string | undefined, typeof posts>();
	for (const p of posts) {
		const k = p.parentId;
		if (!byParent.has(k)) byParent.set(k, []);
		byParent.get(k)!.push(p);
	}
	const renderPosts = (parent: string | undefined, depth: number): React.ReactNode =>
		(byParent.get(parent) ?? []).map((p) => (
			<li key={p.id} className={cn("border-b border-line py-2 text-sm", depth > 0 && "ml-4 border-l-2 pl-3")}>
				<span className="me-1.5 rounded bg-forest/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">{t(`forum.k.${p.kind}`)}</span>
				<strong>{<ActorName id={p.actor} />}</strong>{" "}
				<time className="text-xs text-muted">{p.at.slice(0, 10)}</time>
				<br />
				{p.text}
				<ul>{renderPosts(p.id, depth + 1)}</ul>
			</li>
		));
	return (
		<div className="rounded-xl border border-line p-4 text-sm">
			<strong>{t("forum.title")}</strong>
			<span className="text-muted"> — {t("forum.lede")}</span>
			{posts.length > 0 ? <ul className="mt-2">{renderPosts(undefined, 0)}</ul> : <p className="mt-1 text-muted">{t("forum.empty")}</p>}
			{open && (
				<Form action={`/possibilities/${c.id}/forum`}>
					<input name="actor" placeholder={t("form.name")} aria-label={t("form.name")} required className={field} />
					<select name="kind" aria-label={t("forum.kind")} className={cn(field, "max-w-36")}>
						<option value="note">{t("forum.k.note")}</option>
						<option value="evidence">{t("forum.k.evidence")}</option>
						<option value="objection">{t("forum.k.objection")}</option>
						<option value="review">{t("forum.k.review")}</option>
					</select>
					<input name="text" placeholder={t("forum.placeholder")} aria-label={t("forum.placeholder")} required maxLength={600} className={field} />
					<button className={submit}>{t("forum.cta")}</button>
				</Form>
			)}
		</div>
	);
}

function Trail({ trail }: { trail: NonNullable<CardConnections["trail"]> }) {
	const { t } = useTranslation();
	return (
		<details className="rounded-xl border border-line">
			<summary className="cursor-pointer p-3 text-sm font-semibold">
				{t("card.trail")} ({trail.length})
			</summary>
			<div className="border-t border-line p-4">
				<p className="text-xs text-muted">{t("card.trail.lede")}</p>
				<ol className="mt-2 space-y-1.5 text-xs">
					{trail.map((e) => (
						<li key={e.seq} className="border-b border-line pb-1.5">
							<time>{e.at.slice(0, 10)}</time> — <strong>{t(trailKey(e.kind))}</strong>{" "}
							<span className="text-muted">
								{<ActorName id={e.actor} />} · <Link to="/ledger" className="text-info underline">#{e.seq}</Link>
							</span>
						</li>
					))}
				</ol>
			</div>
		</details>
	);
}

function Connected({ c, conn }: { c: PossibilityCard; conn?: CardConnections }) {
	const { t } = useTranslation();
	if (!conn) return null;
	const bits: React.ReactNode[] = [];
	if (conn.overlapCount > 0) {
		bits.push(
			<Link key="ov" to={conn.focusNodeId ? `/collaborate?node=${conn.focusNodeId}#overlaps` : "/collaborate#overlaps"} className="text-info underline">
				{conn.overlapCount} {t("conn.overlaps")} →
			</Link>,
		);
	}
	for (const r of conn.rounds) {
		bits.push(
			<Link key={r.id} to={`/rounds/${r.id}`} className="text-info underline">
				{t("conn.eligible")} <strong>{r.title}</strong> →
			</Link>,
		);
	}
	const committed = Object.entries(conn.committed).filter(([, v]) => v > 0).map(([cur, v]) => money0(v, cur)).join(" · ");
	if (committed || conn.pledges > 0) {
		const parts = [committed ? `${committed} ${t("conn.committed")}` : "", conn.pledges > 0 ? `${conn.pledges} ${t("conn.pledges")}` : ""].filter(Boolean).join(" · ");
		bits.push(<Link key="pl" to="/fund#pledges" className="text-info underline">{parts} →</Link>);
	}
	if (conn.claimId) bits.push(<Link key="cl" to={`/claims/${conn.claimId}`} className="text-info underline">{t("conn.proof")} →</Link>);
	if (conn.hasReport) bits.push(<a key="rp" href={`/possibilities/${c.id}/report`} className="text-info underline">{t("conn.report")} →</a>);
	if (!bits.length) return null;
	return (
		<p className="text-sm">
			<strong>{t("conn.title")}:</strong>{" "}
			{bits.map((b, i) => <span key={i}>{i > 0 && " · "}{b}</span>)}
		</p>
	);
}
