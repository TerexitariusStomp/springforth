import { cn } from "~/lib/utils";

export function Badge({
	children,
	variant = "default",
	className,
}: {
	children: React.ReactNode;
	variant?: "default" | "lime" | "gold" | "coral" | "ok" | "danger";
	className?: string;
}) {
	const styles = {
		default: "bg-forest/10 text-foreground",
		lime: "bg-lime text-forest",
		gold: "bg-gold-mid/40 text-gold-ink",
		coral: "bg-coral/20 text-coral-ink",
		ok: "bg-ok-soft text-ok-ink",
		danger: "bg-danger/25 text-danger-ink",
	}[variant];
	return (
		<span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", styles, className)}>
			{children}
		</span>
	);
}
