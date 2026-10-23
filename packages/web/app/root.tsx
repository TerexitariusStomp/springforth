import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";
import { I18nextProvider } from "react-i18next";
import { useMemo } from "react";
import type { Route } from "./+types/root";
import { createI18n, langFrom } from "~/lib/i18n";
import "./app.css";

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	return { lang: langFrom(url, request.headers.get("cookie")) };
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useLoaderData<typeof loader>();
	return (
		<html lang={data?.lang ?? "en"} className="h-full">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<Meta />
				<Links />
				{/* no-JS: reveal-on-scroll targets must not stay hidden */}
				<noscript>
					<style>{`[data-slot="blur-fade"]{opacity:1!important;transform:none!important;filter:none!important}`}</style>
				</noscript>
			</head>
			<body className="min-h-full antialiased">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App({ loaderData }: Route.ComponentProps) {
	const i18n = useMemo(() => createI18n(loaderData.lang), [loaderData.lang]);
	return (
		<I18nextProvider i18n={i18n}>
			<Outlet />
		</I18nextProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	// Renders outside the i18n provider (root boundary) — English fallback is
	// deliberate; a dead page still needs a way home.
	return (
		<div className="flex min-h-screen flex-col bg-cream text-ink">
			<header className="border-b border-line px-5 py-4">
				<a href="/" className="font-display text-xl font-bold text-forest">Springforth</a>
			</header>
			<main className="mx-auto flex max-w-2xl flex-1 flex-col items-start justify-center px-6 py-24">
				<span className="font-display text-8xl text-lime-ink">{message}</span>
				<p className="mt-4 text-muted">{details}</p>
				<div className="mt-8 flex gap-3">
					<a href="/" className="h-11 rounded-full bg-forest px-6 text-sm font-bold text-cream inline-flex items-center transition-colors hover:bg-sage">Home</a>
					<a href="/possibilities" className="h-11 rounded-full border border-line px-6 text-sm font-bold inline-flex items-center transition-colors hover:bg-line/30">The deck</a>
				</div>
				{stack && (
					<pre className="mt-6 w-full overflow-x-auto rounded-lg bg-ink p-4 text-sm text-cream">
						<code>{stack}</code>
					</pre>
				)}
			</main>
		</div>
	);
}
