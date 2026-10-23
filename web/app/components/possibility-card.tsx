import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRight, MapPin, Users, Target, Clock } from "lucide-react";
import { cn } from "~/lib/utils";

export interface DeckCardData {
	id: string;
	title: string;
	place?: string;
	status: string;
	participants: number;
	min: number;
	deadline?: string;
	needs?: string[];
	reason?: string;
}

const daysLeft = (deadline: string | undefined, overdue: string): string => {
	if (!deadline) return "—";
	const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
	return d < 0 ? overdue : `${d}d`;
};

const toneFor = (status: string, pct: number) =>
	status === "quorum"
		? "border-info-bright/50"
		: status === "completed"
			? "border-coral/60"
			: status === "expired"
				? "border-line opacity-80"
				: pct >= 80
					? "border-gold-mid/60"
					: "border-line";

export function PossibilityCard({
	d,
	base = "/possibilities",
	viewer,
	nextId,
	returnTo,
}: {
	d: DeckCardData;
	base?: string;
	viewer?: string | null;
	nextId?: string;
	returnTo?: string;
}) {
	const { t } = useTranslation();
	const pct = d.min ? Math.min(100, Math.round((d.participants / d.min) * 100)) : 0;
	const more = Math.max(0, d.min - d.participants);
	const skipTo = nextId ? `card-${nextId}` : "deck";
	const back = returnTo ?? base;

	return (
		<article
			id={`card-${d.id}`}
			data-status={d.status}
			className={cn(
				"group relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-md",
				toneFor(d.status, pct),
			)}
		>
			<div className="flex items-center justify-between text-xs">
				<span className="rounded-full bg-forest/5 px-2.5 py-1 font-semibold uppercase tracking-wide text-sage dark:bg-white/10 dark:text-lime">
					{d.status}
				</span>
				<span className="font-semibold text-muted">
					{pct}% {t("card.toQuorum")}
				</span>
			</div>
			<h3 className="font-display text-xl leading-snug">
				<Link to={`${base}?card=${d.id}`} className="hover:underline">
					{d.title}
				</Link>
			</h3>
			<p className="flex items-center gap-1.5 text-sm text-muted">
				<MapPin className="size-3.5" aria-hidden />
				{d.place ?? t("card.anywhere")}
			</p>
			<div className="grid grid-cols-3 gap-2 rounded-xl bg-pale p-3 text-center dark:bg-white/5">
				<div>
					<strong className="block text-lg font-bold">
						<Users className="me-1 inline size-3.5 align-baseline" aria-hidden />
						{d.participants}
					</strong>
					<span className="text-[11px] uppercase tracking-wide text-muted">{t("card.committed")}</span>
				</div>
				<div>
					<strong className="block text-lg font-bold">
						<Target className="me-1 inline size-3.5 align-baseline" aria-hidden />
						{d.min || "—"}
					</strong>
					<span className="text-[11px] uppercase tracking-wide text-muted">{t("card.goal")}</span>
				</div>
				<div>
					<strong className="block text-lg font-bold">
						<Clock className="me-1 inline size-3.5 align-baseline" aria-hidden />
						{daysLeft(d.deadline, t("card.overdue"))}
					</strong>
					<span className="text-[11px] uppercase tracking-wide text-muted">{t("card.left")}</span>
				</div>
			</div>
			<div
				className="h-1.5 overflow-hidden rounded-full bg-line/60"
				role="progressbar"
				aria-valuenow={pct}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={`${pct}% ${t("card.toQuorum")}`}
			>
				<div
					className={cn("h-full rounded-full transition-[width]", d.status === "quorum" ? "bg-info" : "bg-coral")}
					style={{ width: `${pct}%` }}
				/>
			</div>
			{d.needs && d.needs.length > 0 && (
				<p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
					<span>{t("card.needs")}</span>
					{d.needs.slice(0, 3).map((n) => (
						<b key={n} className="rounded-full bg-gold-line/40 px-2 py-0.5 font-semibold text-gold-ink">
							{n}
						</b>
					))}
				</p>
			)}
			{d.reason && <p className="text-xs italic text-ink-mute">{d.reason}</p>}
			<Link
				to={`${base}?card=${d.id}`}
				className="mt-auto inline-flex items-center justify-between rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-sage dark:bg-lime dark:text-forest dark:hover:bg-lime-deep"
			>
				<span>
					{more > 0 ? `${more} ${t("card.more")}` : d.status === "quorum" ? t("card.atQuorum") : t("card.see")}
				</span>
				<ArrowRight className="size-4" aria-hidden />
			</Link>
			{nextId !== undefined &&
				(viewer ? (
					<div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
						<form method="post" action={`/possibilities/${d.id}/pass`}>
							<input type="hidden" name="actor" value={viewer} />
							<input type="hidden" name="next" value={`${back}?card=${d.id}`} />
							<button
								type="submit"
								className="w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-pale"
							>
								{t("feed.skip")}
							</button>
						</form>
						<form method="post" action={`/possibilities/${d.id}/interest`}>
							<input type="hidden" name="actor" value={viewer} />
							<input type="hidden" name="next" value={`${back}?card=${d.id}`} />
							<button
								type="submit"
								className="w-full rounded-lg bg-coral px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-coral-ink"
							>
								{t("feed.interested")}
							</button>
						</form>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
						<a href={`${base}?card=${nextId ?? ""}`} className="rounded-lg border border-line px-3 py-2 text-center text-sm font-medium text-muted hover:bg-pale">
							{t("feed.skip")}
						</a>
						<a href={`${base}?card=${d.id}`} className="rounded-lg bg-coral px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-coral-ink">
							{t("feed.interested")}
						</a>
					</div>
				))}
		</article>
	);
}
