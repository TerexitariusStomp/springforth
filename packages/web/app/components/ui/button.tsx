import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
	{
		variants: {
			variant: {
				// Primary action — coral on dark, deepened coral on light.
				default: "bg-coral-ink text-white shadow-sm hover:bg-coral hover:text-ink",
				lime: "bg-lime text-forest hover:bg-lime-deep shadow-sm",
				forest: "bg-forest text-cream hover:bg-sage",
				outline: "border border-line bg-transparent hover:bg-card text-foreground",
				ghost: "hover:bg-card/60 text-foreground",
				link: "underline-offset-4 hover:underline text-forest dark:text-lime",
			},
			size: {
				default: "h-10 px-5",
				sm: "h-8 px-3 text-xs",
				lg: "h-12 px-7 text-base",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
