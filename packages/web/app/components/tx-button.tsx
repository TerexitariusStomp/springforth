import { useState } from "react";
import { cn } from "~/lib/utils";

// Non-custodial tx button — same flow as the legacy walletScript():
// GET the build endpoint → injected EIP-1193 wallet signs → POST hash
// to /chain/record. The worker never sees keys.
export function TxButton({ build, kind, entity, label }: {
	build: string; kind: string; entity: string; label: string;
}) {
	const [state, setState] = useState<"idle" | "busy" | "done">("idle");
	const [msg, setMsg] = useState(label);

	async function send() {
		const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum;
		if (!eth) { setMsg("no wallet detected"); return; }
		setState("busy");
		setMsg("building…");
		try {
			const built = (await (await fetch(build)).json()) as {
				tx?: { to: string; data: string; value?: string }; error?: string;
			};
			if (!built.tx) { setMsg(built.error || "build failed"); setState("idle"); return; }
			const accts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
			const params: Record<string, string> = { from: accts[0]!, to: built.tx.to, data: built.tx.data };
			if (built.tx.value) params.value = built.tx.value;
			setMsg("sign in wallet…");
			const hash = (await eth.request({ method: "eth_sendTransaction", params: [params] })) as string;
			setMsg("recording…");
			await fetch("/chain/record", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ txHash: hash, kind, entityId: entity }),
			});
			setMsg(`submitted ${hash.slice(0, 10)}…`);
			setState("done");
		} catch (e) {
			setMsg(((e as Error)?.message || "failed").slice(0, 60));
			setState("idle");
		}
	}

	return (
		<button
			type="button"
			onClick={send}
			disabled={state === "busy"}
			className={cn(
				"rounded-full px-4 py-2 text-xs font-extrabold transition-colors",
				state === "done"
					? "bg-ok-soft text-ok-ink"
					: "bg-forest text-cream hover:bg-sage disabled:opacity-50 dark:bg-lime dark:text-forest",
			)}
		>
			{msg}
		</button>
	);
}
