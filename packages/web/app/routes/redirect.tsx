import { redirect, type LoaderFunctionArgs } from "react-router";
import { RETIRED } from "~/lib/retired";

// Retired top-level slugs → hub anchors. Query params named in `keep`
// (e.g. ?node= on /coordination, ?q= on /agent) ride along.
export async function loader({ request, params }: LoaderFunctionArgs) {
	const seg = (params as { seg?: string }).seg ?? "";
	const r = RETIRED[seg];
	if (!r) throw new Response("Not found", { status: 404 });
	const url = new URL(request.url);
	const keep = [...r.keep, "lang"]
		.map((k) => [k, url.searchParams.get(k)] as const)
		.filter((x): x is readonly [string, string] => x[1] != null)
		.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
		.join("&");
	const [to, hash] = r.to.split("#") as [string, string];
	throw redirect(`${to}${keep ? `?${keep}` : ""}${hash ? `#${hash}` : ""}`, 302);
}

export default function Retired() {
	return null;
}
