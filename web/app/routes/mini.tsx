import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "~/components/site-header";
import { HubHead } from "~/components/hub";

// World Mini App surface — proof of personhood for the mutual-recognition
// graph. Inside World App the MiniKit walletAuth (SIWE) signature proves
// the visitor is a verified human account; the edge worker re-verifies it
// (ERC-1271 on World Chain) and binds the wallet to the actor. One human,
// one actor — sybil-resistant trust without biometrics on our side.
// Outside World App the page explains the lane instead of dead-ending.
export default function Mini() {
	const { t } = useTranslation();
	const [ready, setReady] = useState(false);
	const [inWorld, setInWorld] = useState(false);
	const [actor, setActor] = useState("");
	const [state, setState] = useState<"idle" | "busy" | "done">("idle");
	const [msg, setMsg] = useState("");

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const { MiniKit } = await import("@worldcoin/minikit-js");
				MiniKit.install();
				if (alive) setInWorld(MiniKit.isInstalled());
			} catch { /* not inside World App */ }
			if (alive) setReady(true);
		})();
		return () => { alive = false; };
	}, []);

	async function verify() {
		const a = actor.trim();
		if (!a) { setMsg(t("mini.enterActor")); return; }
		setState("busy");
		setMsg(t("mini.fetchingNonce"));
		try {
			const { MiniKit } = await import("@worldcoin/minikit-js");
			const nr = await fetch(`/actors/${encodeURIComponent(a)}/worldid`);
			if (!nr.ok) { setMsg(t("mini.nonceFailed")); setState("idle"); return; }
			const { nonce } = await nr.json() as { nonce: string };
			setMsg(t("mini.signing"));
			const res = await MiniKit.walletAuth({
				nonce, statement: `springforth bind actor:${a}`,
			});
			const d = (res as { data?: { address?: string; message?: string; signature?: string } }).data;
			if (!d?.address || !d.message || !d.signature) {
				setMsg(t("mini.signFailed")); setState("idle"); return;
			}
			setMsg(t("mini.verifying"));
			const username = (MiniKit.user as { username?: string })?.username;
			const br = await fetch(`/actors/${encodeURIComponent(a)}/worldid`, {
				method: "POST", headers: { "content-type": "application/json" },
				body: JSON.stringify({ address: d.address, message: d.message, signature: d.signature, username }),
			});
			if (!br.ok) {
				const e = await br.json().catch(() => ({})) as { error?: string };
				setMsg(e.error || t("mini.bindFailed")); setState("idle"); return;
			}
			setMsg(t("mini.bound"));
			setState("done");
		} catch (e) {
			setMsg(((e as Error)?.message || t("mini.failed")).slice(0, 120));
			setState("idle");
		}
	}

	return (
		<div className="min-h-screen bg-cream">
			<SiteHeader />
			<main id="main" className="mx-auto max-w-2xl px-5 pb-16">
				<HubHead kicker={t("mini.kicker")} title={t("mini.title")} />
				<p className="mt-3 text-base text-muted">{t("mini.lede")}</p>

				<div className="mt-8 rounded-2xl border border-line bg-card p-6">
					<label className="block text-xs font-bold uppercase tracking-wide text-muted" htmlFor="actor">
						{t("mini.actorLabel")}
					</label>
					<input
						id="actor" type="text" value={actor}
						onChange={(e) => setActor(e.target.value)}
						placeholder={t("mini.actorPlaceholder")}
						className="mt-2 w-full rounded-lg border border-line bg-cream px-3 py-3 text-base"
					/>
					<button
						type="button" onClick={verify}
						disabled={!ready || !inWorld || state === "busy"}
						className="mt-4 min-h-[44px] w-full rounded-full bg-forest px-6 py-3 text-sm font-extrabold text-cream transition-colors hover:bg-sage disabled:opacity-50 dark:bg-lime dark:text-forest"
					>
						{state === "busy" ? t("mini.working") : t("mini.cta")}
					</button>
					{msg && <p className="mt-3 text-sm text-muted" role="status">{msg}</p>}
					{ready && !inWorld && (
						<p className="mt-3 text-sm text-info">{t("mini.notInWorld")}</p>
					)}
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
