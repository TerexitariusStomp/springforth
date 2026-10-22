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

	return (
		<main className="mx-auto max-w-2xl px-6 pt-24 pb-12">
			<h1 className="font-display text-4xl">{message}</h1>
			<p className="mt-4 text-muted">{details}</p>
			{stack && (
				<pre className="mt-6 w-full overflow-x-auto rounded-lg bg-ink p-4 text-sm text-cream">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
