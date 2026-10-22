import { parse as parseDevalue } from "devalue";
import type { AppLoadContext } from "react-router";

/**
 * Page-data contract: asks the edge Worker for the *render args* it would
 * pass to the legacy HTML renderer, serialized with devalue. The edge
 * answers when `x-sf-ui: 1` is present — same public page data, typed by
 * the portal render functions' parameter tuples.
 *
 * Accept: text/html is sent so wantsHtml() branches take the page path,
 * and cookie/actor/IP headers forward so lang, personalization and rate
 * limits behave exactly as if the browser had asked directly.
 */
export async function fetchUI<Args extends unknown[]>(
	context: AppLoadContext,
	request: Request,
): Promise<Args> {
	const url = new URL(request.url);
	const headers = new Headers();
	headers.set("accept", "text/html");
	headers.set("x-sf-ui", "1");
	for (const h of ["cookie", "x-actor", "cf-connecting-ip", "accept-language"]) {
		const v = request.headers.get(h);
		if (v) headers.set(h, v);
	}
	const res = await context.cloudflare.env.API.fetch(url.toString(), {
		method: "GET",
		headers,
	});
	if (res.status === 404) throw new Response("Not found", { status: 404 });
	if (!res.ok)
		throw new Response(`Upstream error ${res.status}`, { status: res.status });
	return parseDevalue(await res.text()) as Args;
}

/** Typed convenience: args tuple of a portal render fn. */
export type UIArgs<F extends (...a: never[]) => unknown> = Parameters<F>;
