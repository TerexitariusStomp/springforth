import {
  Possibility, Participation, Appreciation, Pass, AssuranceCredit,
  OracleCheck, Signal,
} from '@springforth/core';
import {
  renderCoordinationPage, renderPossibilitiesPage, renderLandingPage,
  renderPortfolioPage, renderOutcomesPage,
} from '@springforth/portal';
import {
  PlanNode, ExternalPlan, OverlapRecord,
  detectOverlaps, detectComplements, validateOverlap, mergeProposal, isNeed,
  inferCapital, canonicalize,
  effectiveStatus, quorumMet, trustEdges, scoreCard,
  earnedRecognition, eigenTrust, viewerDeck, identitiesRevealed,
  successfulCoordinationsPerWeek,
} from '@springforth/coordination';
import { normalizePlan, fromCsv, fromMarkdown } from '@springforth/oneplanet-adapter';
import { fromJson as fromClcJson } from '@springforth/clc-adapter';
import { fromJson as fromHolonsJson } from '@springforth/holons-adapter';
import { fromJson as fromArtizenJson } from '@springforth/artizen-adapter';
import { fromJson as fromOcJson } from '@springforth/oc-adapter';
import { fromJson as fromVfJson } from '@springforth/vf-adapter';
import { fetchTreegens } from '@springforth/treegens-adapter';
import { answer as agentAnswer } from '@springforth/agent';
import { buildManifest } from '@springforth/evidence-anchor';
import {
  checkFromReading, EXPECTED_DIRECTION, SOURCES,
  openaqPm25, sensorCommunity, nasaPower, sentinel2, gbifOccurrences,
  treegensPlantings,
  type SourceReading, type GeoLoc,
} from '@springforth/oracle';
import { handleTelegramUpdate, sendTelegram } from './telegram.js';
import { cellToLatLng, isValidCell } from 'h3-js';
import { get, list, put, ledgerAppend, ledgerEvents, ledgerVerify } from './store.js';

// Springforth edge API — the coordination layer. Public reads;
// ADMIN_TOKEN-gated writes. All state in D1; all semantics in
// @springforth/* packages; no wallet anywhere.

interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  OPENAQ_API_KEY?: string;     // free registration — explore.openaq.org
  TITILER_URL?: string;
  NOTIFY_WEBHOOK?: string;   // quorum-activation notify stub (Teams/Telegram/Discord webhook)
  ONEPLANET_API_KEY?: string; // opk_… — MCP lane (mcp.oneplanet.com/mcp)
  ONEPLANET_URL?: string;    // defaults to https://mcp.oneplanet.com/mcp
  TELEGRAM_BOT_TOKEN?: string;    // @springforth_bot — /tg webhook + quorum notify
  TELEGRAM_WEBHOOK_SECRET?: string; // X-Telegram-Bot-Api-Secret-Token check
  TELEGRAM_CHAT_ID?: string;      // default group for quorum announcements
}

// OpenTimestamps public calendars — free, keyless Bitcoin anchoring.
const OTS_CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

// h3 cell → centroid for source adapters. Oracle targets are plannodes —
// field records and declared actions carry h3 directly.
function locFor(node: PlanNode): GeoLoc | null {
  if (node.h3 && isValidCell(node.h3)) {
    const [lat, lon] = cellToLatLng(node.h3);
    return { lat, lon, h3: node.h3 };
  }
  return null;
}

interface Snapshot { nodeId: string; key?: string; source: string; value: number; unit: string; at: string }

async function applyOracleCheck(env: Env, nodeId: string, check: OracleCheck, actor: string) {
  await put(env.DB, 'oracle-check', check.id, { ...check, nodeId });
  await ledgerAppend(env.DB, actor, 'oracle.check', { nodeId, source: check.source, result: check.result });
}

// Run all real source adapters for one plannode; baseline-aware.
async function runOracleSources(env: Env, node: PlanNode) {
  const loc = locFor(node);
  if (!loc) return [];
  const snapshots = await list<Snapshot>(env.DB, 'oracle-snapshot');
  const now = new Date().toISOString();
  const readings: (SourceReading | null)[] = await Promise.all([
    openaqPm25(loc, env.OPENAQ_API_KEY).catch(() => null),
    sensorCommunity(loc).catch(() => null),
    nasaPower(loc).catch(() => null),
    sentinel2(loc, fetch, env.TITILER_URL).catch(() => null),
    gbifOccurrences(loc).catch(() => null),
    treegensPlantings(loc).catch(() => null),
  ]);

  const written: OracleCheck[] = [];
  for (const reading of readings) {
    if (!reading) continue;
    const key = `${node.id}:${reading.key}`;
    const baseline = snapshots.find((s) => `${s.nodeId}:${s.key ?? s.source}` === key);
    const direction = EXPECTED_DIRECTION[reading.key] ?? EXPECTED_DIRECTION[
      reading.source === 'iot' && reading.unit.includes('crowd') ? 'sensorcommunity'
      : reading.source === 'connector' ? 'worldbank'
      : reading.methodologyRef.includes('sensor.community') ? 'sensorcommunity'
      : reading.methodologyRef.includes('openaq') ? 'openaq'
      : reading.methodologyRef.includes('NASA') ? 'nasa-power'
      : reading.methodologyRef.includes('Sentinel') ? 'sentinel2'
      : reading.methodologyRef.includes('gbif') ? 'gbif'
      : reading.source] ?? 'flat';
    const check = checkFromReading({
      reading, baseline: baseline ? { value: baseline.value, at: baseline.at } : undefined,
      expectedDirection: direction, at: now, nodeId: node.id,
    });
    await applyOracleCheck(env, node.id, check, 'cron');
    await put(env.DB, 'oracle-snapshot', key, {
      nodeId: node.id, key: reading.key, source: reading.source,
      value: baseline?.value ?? reading.value,   // first reading becomes the baseline
      unit: reading.unit, at: now,
      latest: { value: reading.value, at: reading.at, attribution: reading.attribution },
    });
    written.push(check);
  }
  return written;
}

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x, null, 2), { status, headers: { 'content-type': 'application/json' } });
const err = (m: string, status = 400) => json({ error: m }, status);
const authed = (req: Request, env: Env) =>
  !!env.ADMIN_TOKEN && req.headers.get('authorization') === `Bearer ${env.ADMIN_TOKEN}`;

// Possibility sweep — advances time-driven statuses once and fires quorum
// effects exactly once per possibility: status flip, `possibility.quorum`
// ledger event, and a notify stub (POSTs to NOTIFY_WEBHOOK when configured).
async function sweepPossibilities(env: Env, actor = 'system'): Promise<void> {
  const [poss, nodes, recs, parts] = await Promise.all([
    list<Possibility>(env.DB, 'possibility'), list<PlanNode>(env.DB, 'plannode'),
    list<OverlapRecord>(env.DB, 'overlap'), list<Participation>(env.DB, 'participation'),
  ]);
  const now = Date.now(), iso = new Date(now).toISOString();
  for (const p of poss) {
    const eff = effectiveStatus(p, now);
    if (eff !== p.status && (eff === 'expired' || eff === 'completed')) {
      await put(env.DB, 'possibility', p.id, { ...p, status: eff });
      // Dominant-assurance credit (Tabarrok 1998): pledgers of an expired
      // card earn append-only recognition — "they were willing when
      // willingness wasn't enough." Joining becomes dominant.
      if (eff === 'expired') {
        const pledgers = parts.filter((x) => x.possibilityId === p.id);
        for (const pt of pledgers) {
          await put(env.DB, 'assurance-credit',
            `ac-${p.id}-${pt.actor.toLowerCase().replace(/\W+/g, '-')}`,
            AssuranceCredit.parse({
              id: `ac-${p.id}-${pt.actor.toLowerCase().replace(/\W+/g, '-')}`,
              possibilityId: p.id, actor: pt.actor, at: iso,
            }));
        }
        await ledgerAppend(env.DB, actor, `possibility.${eff}`,
          { id: p.id, assuranceCredits: pledgers.length });
      } else {
        await ledgerAppend(env.DB, actor, `possibility.${eff}`, { id: p.id });
      }
      continue;
    }
    if ((p.status === 'active' || p.status === 'draft') && eff !== 'expired') {
      const count = parts.filter((x) => x.possibilityId === p.id).length;
      if (!quorumMet(p, nodes, recs, count).met) continue;
      await put(env.DB, 'possibility', p.id, { ...p, status: 'quorum', quorumAt: iso });
      await ledgerAppend(env.DB, actor, 'possibility.quorum', { id: p.id });
      if (env.NOTIFY_WEBHOOK)
        await fetch(env.NOTIFY_WEBHOOK, { method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: `Quorum reached: ${p.title} — commitment bound` }),
        }).catch(() => {});
      if (env.TELEGRAM_BOT_TOKEN) {
        const home = await get<{ chatId: number | string }>(env.DB, 'poss-chat', p.id);
        const target = home?.chatId ?? env.TELEGRAM_CHAT_ID;
        if (target) await sendTelegram(env, target,
          `Quorum reached: ${p.title} — commitment bound. https://springforth.widespread.workers.dev/possibilities#${p.id}`)
          .catch(() => {});
      }
    }
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// /verify — open-evidence readings grouped by target node. Confidence is
// reported per-source; nothing here promotes a reading to truth.
function renderVerifyPage(checks: (OracleCheck & { nodeId?: string })[], nodes: PlanNode[]): string {
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const rows = checks.slice().reverse().slice(0, 200).map((c) => {
    const target = c.nodeId ? (label.get(c.nodeId) ?? c.nodeId) : '—';
    const cls = c.result === 'match' ? '#8fd18f' : c.result === 'mismatch' ? '#e88f8f' : '#f0d78a';
    return `<tr><td><span class="badge" style="background:${cls}">${esc(c.result)}</span></td>`
      + `<td>${esc(c.source)}</td><td>${esc(target)}</td><td>${esc(c.detail)}</td>`
      + `<td class="muted">${esc(c.at.slice(0, 16).replace('T', ' '))}</td></tr>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Verify — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
.badge{padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.45rem;text-align:left;font-size:.92rem}
.muted{color:#666}</style></head><body>
<h1>Open-evidence readings</h1>
<p>Independent public sources scored per reading — remote sensing, sensors,
field evidence, biodiversity records. A reading is evidence for review,
not proof: human validation stays authoritative. <a href="/">home</a> ·
<a href="/sources">source registry (JSON)</a></p>
<table><tr><th>Result</th><th>Source</th><th>Target</th><th>Detail</th><th>At</th></tr>
${rows || '<tr><td colspan="5"><em>No readings yet — POST /oracle/run after seeding geo-located nodes.</em></td></tr>'}</table>
<footer><small>Springforth — generated ${new Date().toISOString()}</small></footer>
</body></html>`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const seg = url.pathname.split('/').filter(Boolean);
    try {
      // GET / → the triage landing: how it works + what needs attention
      if (req.method === 'GET' && seg.length === 0) {
        const [poss, parts, recs, nodes, plans] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<OverlapRecord>(env.DB, 'overlap'), list<PlanNode>(env.DB, 'plannode'),
          list<ExternalPlan>(env.DB, 'plan'),
        ]);
        if (url.searchParams.get('format') === 'json')
          return json({ possibilities: poss.length, nodes: nodes.length, plans: plans.length, overlaps: recs.length });
        const rallied = new Set(recs
          .filter((r) => r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated'))
          .map((r) => r.nodeIds[0]));
        const counts = new Map<string, number>();
        for (const pt of parts) counts.set(pt.possibilityId, (counts.get(pt.possibilityId) ?? 0) + 1);
        return new Response(renderLandingPage({
          cards: poss.map((p) => ({ possibility: p, participants: counts.get(p.id) ?? 0 })),
          proposedOverlaps: recs.filter((r) => r.status === 'proposed').length,
          unmetNeeds: nodes.filter((n) => isNeed(n) && !rallied.has(n.id)).length,
          actionNodes: nodes.filter((n) => n.kind === 'action'),
          planCount: plans.length,
        }), { headers: { 'content-type': 'text/html' } });
      }
      // Telegram bot webhook — secret-token verified, unauthenticated otherwise.
      // Commands mirror the possibility lifecycle; actors are tg:<username>.
      if (req.method === 'POST' && seg[0] === 'tg' && seg.length === 1) {
        if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET
          || req.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET)
          return err('unauthorized', 401);
        try {
          await handleTelegramUpdate(env, await req.json());
        } catch (e) {
          await sendTelegram(env, env.TELEGRAM_CHAT_ID ?? '', `Bot error: ${String(e).slice(0, 200)}`).catch(() => {});
        }
        return json({ ok: true });
      }
      // Evidence manifest anchoring — sha256 manifest into the ledger.
      if (req.method === 'POST' && seg[0] === 'evidence' && seg[1] === 'anchor') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const { files } = await req.json() as { files: Array<{ name: string; base64: string }> };
        const m = buildManifest(files.map((f) => ({ name: f.name, bytes: Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0)) })));
        await ledgerAppend(env.DB, 'api', 'evidence.anchored', { manifestDigest: m.manifestDigest });
        return json(m);
      }
      // Manual oracle cycle (admin) — same path as the hourly cron.
      if (req.method === 'POST' && seg[0] === 'oracle' && seg[1] === 'run') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const out: Record<string, number> = {};
        const nodes = (await list<PlanNode>(env.DB, 'plannode'))
          .filter((n) => n.kind === 'action' && n.h3);
        for (const n of nodes) out[n.id] = (await runOracleSources(env, n)).length;
        return json({ ran: out });
      }
      // Data sources registry — provenance surface.
      if (req.method === 'GET' && seg[0] === 'sources') {
        const snapshots = await list<Snapshot & { latest?: { at: string } }>(env.DB, 'oracle-snapshot');
        return json({ sources: SOURCES.map((s) => ({
          ...s,
          configured: s.needs ? !!env[s.needs as 'OPENAQ_API_KEY'] : true,
          lastFetch: snapshots.filter((x) => x.source === s.source).at(-1)?.latest?.at ?? null,
        })) });
      }
      // Verify — open-evidence readings rendered for review.
      if (req.method === 'GET' && seg[0] === 'verify') {
        const [checks, nodes] = await Promise.all([
          list<OracleCheck & { nodeId?: string }>(env.DB, 'oracle-check'),
          list<PlanNode>(env.DB, 'plannode'),
        ]);
        if (url.searchParams.get('format') === 'json') return json({ checks });
        return new Response(renderVerifyPage(checks, nodes), { headers: { 'content-type': 'text/html' } });
      }
      if (seg[0] === 'plans') {
        if (req.method === 'POST' && seg.length === 1) {
          if (!authed(req, env)) return err('unauthorized', 401);
          const body = await req.json() as {
            format?: 'csv' | 'markdown' | 'clc' | 'holons' | 'artizen' | 'opencollective' | 'vf';
            data?: unknown; source?: string;
          } & Record<string, unknown>;
          // `source` must differ per posted plan — same source = same plan id
          // = overwrite, and same-source pairs are never matched.
          const plan = body.format === 'csv' ? fromCsv(String(body.data ?? ''), body.source ?? 'csv:upload')
            : body.format === 'markdown' ? fromMarkdown(String(body.data ?? ''), body.source ?? 'md:upload')
            : body.format === 'clc' ? fromClcJson(body.data ?? body, body.source ?? 'clc:import')
            : body.format === 'holons' ? fromHolonsJson(body.data ?? body, body.source ?? 'holons:import')
            : body.format === 'artizen' ? fromArtizenJson(body.data ?? body, body.source ?? 'artizen:import')
            : body.format === 'opencollective' ? fromOcJson(body.data ?? body, body.source ?? 'oc:import')
            : body.format === 'vf' ? fromVfJson(body.data ?? body, body.source ?? 'vf:import')
            : normalizePlan(body);
          // store plan metadata; nodes persist as plannode rows (keeps the
          // row small — feeds like Treegens carry 100+ records per plan)
          await put(env.DB, 'plan', plan.id,
            { ...plan, nodes: undefined, nodeCount: plan.nodes.length });
          for (const n of plan.nodes) await put(env.DB, 'plannode', n.id, n);
          await ledgerAppend(env.DB, 'api', 'plan.imported', { id: plan.id, nodes: plan.nodes.length });
          // Composite possibility inside a Holons export — the adapter
          // already linked its need/offer nodes; create the card itself.
          const hp = body.format === 'holons' && body.data && typeof body.data === 'object'
            ? (body.data as { possibility?: { title: string; declarer: string; place?: string; timeStart?: string; timeEnd?: string; deadline?: string; minParticipants?: number } }).possibility
            : undefined;
          if (hp) {
            const pid = `poss-${canonicalize(hp.title).replace(/\s+/g, '-').slice(0, 40)}`;
            await put(env.DB, 'possibility', pid, Possibility.parse({
              id: pid, title: hp.title, declarerId: hp.declarer,
              place: hp.place, timeStart: hp.timeStart, timeEnd: hp.timeEnd,
              deadline: hp.deadline, minParticipants: hp.minParticipants ?? 0,
              status: 'active', createdAt: new Date().toISOString(),
            }));
            await ledgerAppend(env.DB, hp.declarer, 'possibility.declared', { id: pid, via: 'holons' });
          }
          return json({ id: plan.id, nodes: plan.nodes.length }, 201);
        }
        // Pull a plan straight from OnePlanet's MCP endpoint — the PS1
        // "agents that query this system via APIs" lane. Needs
        // ONEPLANET_API_KEY (opk_…); tool names discovered adaptively.
        if (req.method === 'POST' && seg[1] === 'import') {
          if (!authed(req, env)) return err('unauthorized', 401);
          if (!env.ONEPLANET_API_KEY) return err('ONEPLANET_API_KEY not configured', 503);
          const { planId } = await req.json() as { planId?: string };
          if (!planId) return err('planId required', 400);
          const { fetchPlan } = await import('@springforth/oneplanet-adapter');
          const plan = await fetchPlan(
            env.ONEPLANET_URL ?? 'https://mcp.oneplanet.com/mcp',
            env.ONEPLANET_API_KEY, planId);
          // store plan metadata; nodes persist as plannode rows (keeps the
          // row small — feeds like Treegens carry 100+ records per plan)
          await put(env.DB, 'plan', plan.id,
            { ...plan, nodes: undefined, nodeCount: plan.nodes.length });
          for (const n of plan.nodes) await put(env.DB, 'plannode', n.id, n);
          await ledgerAppend(env.DB, 'api', 'plan.imported', { id: plan.id, nodes: plan.nodes.length, via: 'mcp' });
          return json({ id: plan.id, nodes: plan.nodes.length }, 201);
        }
        if (req.method === 'GET' && seg.length === 1)
          return json({ plans: await list<ExternalPlan>(env.DB, 'plan') });
        if (req.method === 'GET' && seg.length === 2) {
          const plan = await get<ExternalPlan & { nodeCount?: number }>(env.DB, 'plan', seg[1]!);
          if (!plan) return err('plan not found', 404);
          // stored rows are node-stripped; rehydrate from plannode entities
          if (!plan.nodes) plan.nodes = (await list<PlanNode>(env.DB, 'plannode'))
            .filter((n) => n.source === plan.source);
          return json(plan);
        }
      }
      // Plan nodes — read + human correction. Ingest is imperfect by
      // nature; corrections are first-class, attributed, and logged to the
      // audit ledger with a before/after diff — the fix is visible, the
      // extraction trail is never silently rewritten.
      if (seg[0] === 'nodes') {
        const node = await get<PlanNode>(env.DB, 'plannode', seg[1] ?? '');
        if (!node) return err('node not found', 404);
        if (req.method === 'GET' && seg.length === 2) return json(node);
        if (req.method === 'POST' && seg[2] === 'correct') {
          const ct = req.headers.get('content-type') ?? '';
          const b: Record<string, string> = ct.includes('form')
            ? Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]))
            : await req.json().catch(() => ({})) as Record<string, string>;
          if (!b.actor) return err('actor required');
          const before = PlanNode.parse(node);
          const patch: Partial<PlanNode> = {};
          const diff: Record<string, { from: unknown; to: unknown }> = {};
          const set = <K extends keyof PlanNode>(k: K, v: PlanNode[K] | undefined) => {
            if (v === undefined) return;
            if (JSON.stringify(before[k]) === JSON.stringify(v)) return;
            diff[k] = { from: before[k], to: v };
            (patch as Record<string, unknown>)[k] = v;
          };
          const str = (k: string) => (b[k] ?? '').trim() || undefined;
          set('label', str('label'));
          set('description', str('description'));
          set('placeId', str('placeId'));
          set('h3', str('h3'));
          set('tags', str('tags')?.split(',').map((t) => t.trim()).filter(Boolean));
          set('orgIds', str('orgIds')?.split(',').map((t) => t.trim()).filter(Boolean));
          set('budget', str('budget') !== undefined && !Number.isNaN(Number(b.budget))
            ? Number(b.budget) : undefined);
          const tf = { from: str('timeframeFrom') ?? before.timeframe.from,
            to: str('timeframeTo') ?? before.timeframe.to };
          if (str('timeframeFrom') || str('timeframeTo')) set('timeframe', tf);
          if (!Object.keys(diff).length) return err('nothing to correct');
          const corrected = PlanNode.parse({ ...before, ...patch });
          if (diff.label) corrected.canonical = canonicalize(corrected.label);
          await put(env.DB, 'plannode', corrected.id, corrected);
          await ledgerAppend(env.DB, b.actor, 'node.corrected',
            { id: corrected.id, diff, note: b.note ?? '' });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/coordination' } })
            : json({ node: corrected, diff });
        }
      }
      // Overlap detection over every stored plannode; stores new records,
      // preserves existing validation state on re-runs.
      if (req.method === 'POST' && seg[0] === 'overlaps' && seg[1] === 'detect') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const existing = await list<OverlapRecord>(env.DB, 'overlap');
        const keep = new Map(existing.map((o) => [o.id, o]));
        const detected = [
          ...detectOverlaps(nodes),
          ...detectComplements(nodes),           // need × offer direction
        ];
        for (const rec of detected) {
          const prior = keep.get(rec.id);
          await put(env.DB, 'overlap', rec.id, prior && prior.status !== 'proposed' ? prior : rec);
        }
        await ledgerAppend(env.DB, 'api', 'overlaps.detected', {
          nodes: nodes.length, found: detected.length,
          complements: detected.filter((r) => r.kind === 'complement').length,
        });
        return json({ scanned: nodes.length, overlaps: detected.length, records: detected });
      }
      // Treegens evidence sync — pull filmed/AI-counted/DAO-verified
      // planting records (live + field-team archive), upsert nodes, re-run
      // detection. Feeds are public; statuses stay verbatim as tags.
      if (req.method === 'POST' && seg[0] === 'treegens' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const plans = await fetchTreegens();
        for (const plan of [plans.live, plans.archive]) {
          // store plan metadata; nodes persist as plannode rows (keeps the
          // row small — feeds like Treegens carry 100+ records per plan)
          await put(env.DB, 'plan', plan.id,
            { ...plan, nodes: undefined, nodeCount: plan.nodes.length });
          for (const n of plan.nodes) await put(env.DB, 'plannode', n.id, n);
        }
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const keep = new Map((await list<OverlapRecord>(env.DB, 'overlap')).map((o) => [o.id, o]));
        const detected = [...detectOverlaps(nodes), ...detectComplements(nodes)];
        for (const rec of detected) {
          const prior = keep.get(rec.id);
          await put(env.DB, 'overlap', rec.id, prior && prior.status !== 'proposed' ? prior : rec);
        }
        await ledgerAppend(env.DB, 'api', 'treegens.synced', {
          records: plans.live.nodes.length + plans.archive.nodes.length,
          plans: [plans.live.id, plans.archive.id], overlaps: detected.length,
        });
        return json({
          live: plans.live.nodes.length, archive: plans.archive.nodes.length,
          overlaps: detected.length,
        }, 201);
      }
      if (seg[0] === 'overlaps') {
        if (req.method === 'GET' && seg.length === 1) {
          let recs = await list<OverlapRecord>(env.DB, 'overlap');
          const status = url.searchParams.get('status');
          if (status) recs = recs.filter((r) => r.status === status);
          return json({ overlaps: recs });
        }
        const rec = await get<OverlapRecord>(env.DB, 'overlap', seg[1] ?? '');
        if (!rec) return err('overlap not found', 404);
        if (req.method === 'GET' && seg.length === 2) return json(rec);
        // Agreeable-shaped export (org.agreeable.agreement namespace —
        // Accord/Concerto model): a coordinated overlap becomes an
        // ingestible agreement artifact — CIRCLE mode, COMMUNITY level,
        // parties from node orgIds, community validations as witnesses.
        if (req.method === 'GET' && seg.length === 3 && seg[2] === 'agreement') {
          const nodes = await list<PlanNode>(env.DB, 'plannode');
          const byId = new Map(nodes.map((n) => [n.id, n]));
          const prop = mergeProposal(rec, nodes);
          const partyIds = [...new Set(rec.nodeIds.flatMap((id) => byId.get(id)?.orgIds ?? []))];
          const parties = [
            ...partyIds.map((o) => ({ userId: o, role: 'party' })),
            ...rec.validations.filter((v) => v.verdict === 'confirm')
              .map((v) => ({ userId: v.actor, role: 'witness' })),
          ];
          const terms = [
            prop.rationale,
            rec.scenario ? `Scenario: ${rec.scenario.choice} (chosen by ${rec.scenario.actor}` +
              `${rec.scenario.rationale ? ` — ${rec.scenario.rationale}` : ''})` : '',
            rec.scenario?.objections ? `Objections on record: ${rec.scenario.objections}` : '',
          ].filter(Boolean).join('\n\n');
          return json({
            $class: 'org.agreeable.agreement.Agreement',
            id: `agr-${rec.id}`,
            mode: 'CIRCLE',
            level: 'COMMUNITY',
            status: rec.status === 'coordinated' ? 'ACTIVE'
              : rec.status === 'confirmed' ? 'PENDING_RATIFICATION' : 'DRAFT',
            title: prop.title,
            content: terms,
            intention: rec.reasoning,
            commitments: rec.scenario?.choice ?? 'coordinate',
            outcomes: rec.resolution
              ? `coordinated action ${rec.resolution.coordinationNodeId ?? ''}`
              : prop.sources.join(' + '),
            witnessStructure: 'community validation — each validator is a witness; appreciations map to attestations',
            parties,
            createdAt: rec.createdAt,
            ratifiedAt: rec.resolution?.at,
            provenance: {
              $class: 'org.springforth.Provenance',
              overlapId: rec.id, kind: rec.kind,
              confidence: rec.confidence,
              evidence: rec.evidence,
              counterEvidence: rec.counterEvidence ?? [],
              validations: rec.validations,
              scenario: rec.scenario ?? null,
            },
          });
        }
        // Community validation — open to named actors (form or JSON);
        // human decision is what unlocks coordination.
        if (req.method === 'POST' && seg[2] === 'validate') {
          let actor: string, verdict: 'confirm' | 'reject', note = '';
          let scenario = '', rationale = '', objections = '';
          const ct = req.headers.get('content-type') ?? '';
          if (ct.includes('form')) {
            const f = await req.formData();
            actor = String(f.get('actor') ?? ''); note = String(f.get('note') ?? '');
            verdict = f.get('verdict') === 'reject' ? 'reject' : 'confirm';
            scenario = String(f.get('scenario') ?? '');
            rationale = String(f.get('rationale') ?? '');
            objections = String(f.get('objections') ?? '');
          } else {
            const b = await req.json() as {
              actor: string; verdict: 'confirm' | 'reject'; note?: string;
              scenario?: string; rationale?: string; objections?: string;
            };
            actor = b.actor; verdict = b.verdict; note = b.note ?? '';
            scenario = b.scenario ?? ''; rationale = b.rationale ?? ''; objections = b.objections ?? '';
          }
          if (!actor) return err('actor required');
          const next = validateOverlap(OverlapRecord.parse(rec), actor, verdict, note);
          // Scenario recording — the coordination path the reviewer chose
          // rides on the same human decision (separate/coordinate/combine).
          if (['separate', 'coordinate', 'combine'].includes(scenario))
            next.scenario = {
              choice: scenario as 'separate' | 'coordinate' | 'combine',
              actor, at: new Date().toISOString(), rationale, objections,
            };
          await put(env.DB, 'overlap', rec.id, next);
          await ledgerAppend(env.DB, actor, `overlap.${verdict}ed`,
            { id: rec.id, status: next.status, scenario: scenario || undefined });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/coordination' } })
            : json(next);
        }
        // Confirm → coordinate: materialises the merged proposal as a shared
        // action node in the plan graph; the overlap record carries the
        // resolution (who decided, when, under which scenario).
        if (req.method === 'POST' && seg[2] === 'confirm') {
          if (rec.status !== 'confirmed') return err('overlap must be community-confirmed first', 409);
          let actor = 'api', rationale = '', objections = '';
          let scenario: 'separate' | 'coordinate' | 'combine' = 'coordinate';
          const ct = req.headers.get('content-type') ?? '';
          if (ct.includes('form')) {
            const f = await req.formData();
            actor = String(f.get('actor') ?? 'api');
            const s = String(f.get('scenario') ?? '');
            if (['separate', 'coordinate', 'combine'].includes(s)) scenario = s as typeof scenario;
            rationale = String(f.get('rationale') ?? '');
            objections = String(f.get('objections') ?? '');
          } else {
            const b = (await req.json().catch(() => ({}))) as {
              actor?: string; scenario?: string; rationale?: string; objections?: string };
            actor = b.actor ?? 'api';
            if (['separate', 'coordinate', 'combine'].includes(b.scenario ?? ''))
              scenario = b.scenario as typeof scenario;
            rationale = b.rationale ?? ''; objections = b.objections ?? '';
          }
          const nodes = await list<PlanNode>(env.DB, 'plannode');
          const prop = mergeProposal(rec, nodes);
          const byId = new Map(nodes.map((n) => [n.id, n]));
          const isComplement = rec.kind === 'complement';
          const orgs = [...new Set(rec.nodeIds.flatMap((id) => byId.get(id)?.orgIds ?? []))];
          // The coordinated proposal becomes a real action node — visible on
          // /outcomes, oracle-eligible when it carries h3, overlap-detectable
          // against future imports.
          const coordNodeId = `coord-${rec.id}`;
          const firstNode = byId.get(rec.nodeIds[0]!);
          const coordNode = PlanNode.parse({
            id: coordNodeId,
            kind: 'action',
            label: isComplement ? `Fulfil: ${prop.title}` : prop.title,
            canonical: canonicalize(prop.title),
            source: `coordination:${rec.id}`,
            orgIds: orgs,
            placeId: firstNode?.placeId,
            h3: firstNode?.h3,
            description: prop.rationale,
            budget: prop.combinedBudget || undefined,
            tags: ['coordinated', ...(isComplement ? ['complement'] : [])],
            timeframe: {},
          });
          await put(env.DB, 'plannode', coordNodeId, coordNode);
          const resolved: OverlapRecord = {
            ...rec, status: 'coordinated',
            scenario: { choice: scenario, actor, at: new Date().toISOString(), rationale, objections },
            resolution: { coordinationNodeId: coordNodeId, decidedBy: actor, at: new Date().toISOString() },
          };
          await put(env.DB, 'overlap', rec.id, resolved);
          await ledgerAppend(env.DB, actor,
            isComplement ? 'commitment.presented' : 'overlap.coordinated',
            { id: rec.id, coordinationNodeId: coordNodeId });
          await sweepPossibilities(env, actor);  // a required need may have just tipped quorum
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: `/coordination?node=${encodeURIComponent(coordNodeId)}` } })
            : json(resolved, 201);
        }
      }
      // Commitments — offer and need nodes in the graph. Needs include
      // action nodes the resolver promotes via need-verbs (inferred flag
      // distinguishes them from declared needs).
      // offersMatched = "resources rallied" per need — confirmed/coordinated
      // complement count; a need with offersMatched>0 already mobilised
      // community resources.
      // Filters: ?role=offer|need  ?org=<substring of orgIds>  ?unmet=1
      // (needs with zero confirmed matches).
      if (req.method === 'GET' && seg[0] === 'commitments') {
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const recs = await list<OverlapRecord>(env.DB, 'overlap');
        const matchedBy = new Map<string, number>();
        for (const r of recs) {
          if (r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated'))
            matchedBy.set(r.nodeIds[0]!, (matchedBy.get(r.nodeIds[0]!) ?? 0) + 1);
        }
        const org = url.searchParams.get('org');
        const rows = nodes
          .filter((n) => n.kind === 'offer' || n.kind === 'need' || isNeed(n))
          .map((n) => ({
            ...n,
            role: n.kind === 'offer' ? 'offer' : 'need',
            inferred: n.kind === 'action',      // verb-inferred, not declared
            offersMatched: n.kind === 'offer' ? undefined : (matchedBy.get(n.id) ?? 0),
            capital: inferCapital(n),           // explicit field or heuristic
          }))
          .filter((n) => !url.searchParams.get('role')
            || n.role === url.searchParams.get('role'))
          .filter((n) => !org || n.orgIds.some((o) => o.includes(org)))
          .filter((n) => url.searchParams.get('unmet') !== '1'
            || (n.role === 'need' && !n.offersMatched));
        // Eight-forms aggregate: how much of the flow is non-monetary —
        // "money becomes one stream among eight", made visible.
        const byCapital: Record<string, number> = {};
        for (const n of rows) if (n.capital) byCapital[n.capital] = (byCapital[n.capital] ?? 0) + 1;
        return json({ commitments: rows, byCapital });
      }
      // Coordination page — public overlap report + validation forms
      if (req.method === 'GET' && seg[0] === 'coordination') {
        const recs = await list<OverlapRecord>(env.DB, 'overlap');
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const signals = await list<Signal>(env.DB, 'signal');
        const focus = url.searchParams.get('node') ?? undefined;
        return new Response(renderCoordinationPage(recs, nodes, signals, focus), { headers: { 'content-type': 'text/html' } });
      }
      // Portfolio — plans as comparable objects + overlap clusters.
      if (req.method === 'GET' && seg[0] === 'portfolio' && seg.length === 1) {
        const [plans, nodes, recs] = await Promise.all([
          list<ExternalPlan>(env.DB, 'plan'), list<PlanNode>(env.DB, 'plannode'),
          list<OverlapRecord>(env.DB, 'overlap'),
        ]);
        return new Response(renderPortfolioPage(plans, nodes, recs), { headers: { 'content-type': 'text/html' } });
      }
      // Outcomes — the common outcome layer: who else is pursuing each
      // outcome, which actions could strengthen it.
      if (req.method === 'GET' && seg[0] === 'outcomes' && seg.length === 1) {
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const recs = await list<OverlapRecord>(env.DB, 'overlap');
        return new Response(
          renderOutcomesPage(nodes, recs, nodes.filter((n) => n.kind === 'indicator')),
          { headers: { 'content-type': 'text/html' } });
      }
      // Agent — NL query over the coordination graph; cited, read-only.
      if (seg[0] === 'agent') {
        const q = req.method === 'POST'
          ? String(((await req.json().catch(() => ({}))) as { q?: unknown }).q ?? '')
          : url.searchParams.get('q') ?? '';
        if (!q) return err('q required');
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const recs = await list<OverlapRecord>(env.DB, 'overlap');
        const [poss, parts, apps, credits] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<Appreciation>(env.DB, 'appreciation'),
          list<AssuranceCredit>(env.DB, 'assurance-credit'),
        ]);
        const edges = trustEdges(apps);
        const vec = eigenTrust(edges);
        const vecMean = Object.values(vec).length
          ? Object.values(vec).reduce((a, b) => a + b, 0) / Object.values(vec).length : 0;
        const earnedMap = earnedRecognition(edges, credits);
        const out = agentAnswer(q, {
          nodes, overlaps: recs,
          signals: await list<Signal>(env.DB, 'signal'),
          possibilities: poss.map((p) => {
            const mine = parts.filter((x) => x.possibilityId === p.id);
            const q = quorumMet(p, nodes, recs, mine.length);
            return { id: p.id, title: p.title, status: effectiveStatus(p),
              deadline: p.deadline, participants: mine.length,
              minParticipants: p.minParticipants, requiredMet: q.requiredMet, required: q.required,
              report: p.report };
          }),
          trust: edges,
          standing: [...new Set([...Object.keys(earnedMap),
            ...edges.flatMap((e) => [e.from, e.to])])].map((id) => ({
            id, earned: earnedMap[id] ?? 0,
            trustScore: vecMean > 0 ? +((vec[id] ?? 0) / vecMean).toFixed(4) : 0,
            assuranceCredits: credits.filter((c) => c.actor === id).length,
          })),
        });
        await ledgerAppend(env.DB, 'agent', 'agent.query', { q: q.slice(0, 200), intent: out.intent });
        return json(out);
      }
      // Signals — public intent: a named actor signs support/interest/
      // concern on a node. Cheap legibility; open intake (named actor is
      // the auth), ledger-audited.
      if (seg[0] === 'signals') {
        if (req.method === 'POST' && seg.length === 1) {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          if (b.website) return json({ ok: true }, 201); // honeypot
          const signal = Signal.parse({
            id: `sig-${String(b.actor ?? '').toLowerCase().replace(/\W+/g, '-')}-${String(b.targetId ?? '')}`,
            actor: b.actor, targetId: b.targetId, targetKind: 'node',
            intent: b.intent ?? 'support', note: String(b.note ?? '').slice(0, 500),
            at: new Date().toISOString(),
          });
          await put(env.DB, 'signal', signal.id, signal);
          await ledgerAppend(env.DB, signal.actor, 'signal.declared',
            { id: signal.id, targetId: signal.targetId, intent: signal.intent });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/coordination' } })
            : json(signal, 201);
        }
        if (req.method === 'GET') {
          let sigs = await list<Signal>(env.DB, 'signal');
          const target = url.searchParams.get('target');
          if (target) sigs = sigs.filter((s) => s.targetId === target);
          return json({ signals: sigs });
        }
      }
      if (seg[0] === 'possibilities') {
        if (req.method === 'POST' && seg.length === 1) {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          if (b.website) return json({ ok: true }, 201); // honeypot
          const iso = new Date().toISOString();
          const pid = `poss-${String(b.title ?? '').toLowerCase().replace(/\W+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
          const p = Possibility.parse({
            id: pid, title: b.title, description: String(b.description ?? ''),
            declarerId: String(b.declarerId ?? b.actor ?? ''),
            place: b.place, timeStart: b.timeStart, timeEnd: b.timeEnd,
            deadline: b.deadline, minParticipants: Number(b.minParticipants ?? 0),
            maxParticipants: b.maxParticipants ? Number(b.maxParticipants) : undefined,
            context: b.context,
            status: 'active', createdAt: iso,
          });
          await put(env.DB, 'possibility', p.id, p);
          // Composite declaration: needs become need-nodes (`required`
          // defaults true — blocking for quorum), bringing becomes offers.
          const mk = (t: string, i: number, kind: 'need' | 'offer') =>
            `${pid}-${kind}-${i}-${t.toLowerCase().replace(/\W+/g, '-').slice(0, 24)}`;
          const needs = (Array.isArray(b.needs) ? b.needs : []) as Record<string, unknown>[];
          const bringing = (Array.isArray(b.bringing) ? b.bringing : []) as Record<string, unknown>[];
          for (const [i, n] of needs.entries()) {
            const node = PlanNode.parse({
              id: mk(String(n.title ?? 'need'), i, 'need'), kind: 'need',
              label: String(n.title ?? 'need'), canonical: canonicalize(String(n.title ?? 'need')),
              source: `possibility:${pid}`, possibilityId: pid,
              required: n.required !== false && n.required !== 'false',
              category: n.category, flaggedBy: p.declarerId,
              orgIds: [p.declarerId], placeId: p.place,
              terms: n.terms, capital: n.capital, description: String(n.description ?? ''),
              tags: ['possibility'], timeframe: { to: p.deadline },
            });
            await put(env.DB, 'plannode', node.id, node);
          }
          for (const [i, o] of bringing.entries()) {
            const node = PlanNode.parse({
              id: mk(String(o.title ?? 'offer'), i, 'offer'), kind: 'offer',
              label: String(o.title ?? 'offer'), canonical: canonicalize(String(o.title ?? 'offer')),
              source: `possibility:${pid}`, possibilityId: pid,
              orgIds: [p.declarerId], placeId: p.place,
              terms: o.terms, capital: o.capital, description: String(o.description ?? ''),
              tags: ['possibility', 'bringing'], timeframe: { from: iso },
            });
            await put(env.DB, 'plannode', node.id, node);
          }
          await ledgerAppend(env.DB, p.declarerId, 'possibility.declared',
            { id: pid, needs: needs.length, bringing: bringing.length });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/possibilities' } })
            : json(p, 201);
        }
        if (req.method === 'GET' && seg.length === 1) {
          await sweepPossibilities(env);
          const [poss, nodes, recs, parts, apps, passes] = await Promise.all([
            list<Possibility>(env.DB, 'possibility'), list<PlanNode>(env.DB, 'plannode'),
            list<OverlapRecord>(env.DB, 'overlap'), list<Participation>(env.DB, 'participation'),
            list<Appreciation>(env.DB, 'appreciation'), list<Pass>(env.DB, 'pass'),
          ]);
          const edges = trustEdges(apps);
          const viewer = url.searchParams.get('actor') ?? undefined;
          const now = Date.now();
          const coordinated = new Set(recs
            .filter((o) => o.kind === 'complement' && (o.status === 'confirmed' || o.status === 'coordinated'))
            .map((o) => o.nodeIds[0]));
          const live = ['active', 'quorum', 'draft'];
          // Identity gradation: participant names hidden until critical mass
          // (cover ≥0.5 or quorum) — counts always public, per the GDD deck.
          const cards = viewerDeck(poss, passes, viewer).map((p) => {
            const status = effectiveStatus(p, now);
            const myParts = parts.filter((x) => x.possibilityId === p.id);
            const q = quorumMet(p, nodes, recs, myParts.length);
            const s = scoreCard(p, { nodes, overlaps: recs, participants: parts, edges, viewer, now });
            const revealed = identitiesRevealed(p, s.cover, status);
            return {
              ...p, status, score: s.score, scoring: s, tipping: s.tipping,
              participantCount: myParts.length,
              participants: revealed
                ? myParts.map((x) => ({ actor: x.actor, bringingNodeId: x.bringingNodeId }))
                : undefined,
              needs: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'need')
                .map((n) => ({ ...n, met: coordinated.has(n.id) })),
              bringing: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'offer'),
              quorum: q,
            };
          }).sort((a, b) =>
            (live.includes(a.status) ? 0 : 1) - (live.includes(b.status) ? 0 : 1)
            || b.score - a.score);
          if (url.searchParams.get('format') === 'json') return json({ possibilities: cards });
          return new Response(renderPossibilitiesPage(cards, edges, viewer), { headers: { 'content-type': 'text/html' } });
        }
        const p = await get<Possibility>(env.DB, 'possibility', seg[1] ?? '');
        if (!p) return err('possibility not found', 404);
        if (req.method === 'GET' && seg.length === 2) {
          const parts = await list<Participation>(env.DB, 'participation');
          const apps = (await list<Appreciation>(env.DB, 'appreciation'))
            .filter((a) => a.possibilityId === p.id);
          const nodes = (await list<PlanNode>(env.DB, 'plannode')).filter((n) => n.possibilityId === p.id);
          const recs = await list<OverlapRecord>(env.DB, 'overlap');
          const status = effectiveStatus(p);
          const mine = parts.filter((x) => x.possibilityId === p.id);
          const s = scoreCard(p, {
            nodes, overlaps: recs, participants: parts,
            edges: trustEdges(apps), now: Date.now(),
          });
          const revealed = identitiesRevealed(p, s.cover, status);
          return json({
            ...p, status,
            participantCount: mine.length,
            participants: revealed
              ? mine.map((x) => ({ actor: x.actor, bringingNodeId: x.bringingNodeId }))
              : undefined,
            appreciations: apps, nodes,
          });
        }
        // "I'm coming" (+ optional "I'm bringing X" — an offer node on the card)
        if (req.method === 'POST' && seg[2] === 'join') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const actor = String(b.actor ?? '');
          if (!actor) return err('actor required');
          if (effectiveStatus(p) !== 'active' && effectiveStatus(p) !== 'draft')
            return err(`possibility is ${effectiveStatus(p)}`, 409);
          if (p.maxParticipants) {
            const count = (await list<Participation>(env.DB, 'participation'))
              .filter((x) => x.possibilityId === p.id).length;
            if (count >= p.maxParticipants) return err('possibility is full', 409);
          }
          const iso = new Date().toISOString();
          let bringingNodeId: string | undefined;
          if (b.bringing) {
            bringingNodeId = `${p.id}-offer-${actor.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`;
            await put(env.DB, 'plannode', bringingNodeId, PlanNode.parse({
              id: bringingNodeId, kind: 'offer', label: String(b.bringing),
              canonical: canonicalize(String(b.bringing)), source: `possibility:${p.id}`,
              possibilityId: p.id, orgIds: [actor], placeId: p.place,
              tags: ['possibility', 'bringing'], timeframe: { from: iso },
            }));
          }
          const part = Participation.parse({
            id: `part-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}`,
            possibilityId: p.id, actor, bringingNodeId, at: iso,
          });
          await put(env.DB, 'participation', part.id, part);
          await ledgerAppend(env.DB, actor, 'possibility.joined', { id: p.id, bringingNodeId });
          await sweepPossibilities(env, actor);   // quorum may have just tipped
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/possibilities' } })
            : json(part, 201);
        }
        // Post-event appreciation round — pairwise, ledger-audited.
        if (req.method === 'POST' && seg[2] === 'appreciate') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const from = String(b.from ?? b.actor ?? ''), to = String(b.to ?? '');
          if (!from || !to) return err('from and to required');
          if (from === to) return err('self-appreciation does not count');
          const ap = Appreciation.parse({
            id: `app-${from.toLowerCase().replace(/\W+/g, '-')}-${to.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
            fromActor: from, toActor: to, possibilityId: p.id,
            note: String(b.note ?? '').slice(0, 300), at: new Date().toISOString(),
          });
          await put(env.DB, 'appreciation', ap.id, ap);
          await ledgerAppend(env.DB, from, 'possibility.appreciated', { id: p.id, to });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/possibilities' } })
            : json(ap, 201);
        }
        // Swipe-left — a logged pass. Excluded from the actor's deck;
        // never rendered publicly (demand-shape data, not shame).
        if (req.method === 'POST' && seg[2] === 'pass') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const actor = String(b.actor ?? '');
          if (!actor) return err('actor required');
          const pass = Pass.parse({
            id: `pass-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}`,
            possibilityId: p.id, actor, at: new Date().toISOString(),
          });
          await put(env.DB, 'pass', pass.id, pass);
          await ledgerAppend(env.DB, actor, 'possibility.passed', { id: p.id });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/possibilities' } })
            : json(pass, 201);
        }
        // Escalation step — a participant flags a NEW need on the card.
        // Flagged needs are always nice-to-have; `required` is the
        // declarer's call alone.
        if (req.method === 'POST' && seg[2] === 'need') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const actor = String(b.actor ?? ''), title = String(b.title ?? b.need ?? '');
          if (!actor || !title) return err('actor and title required');
          if (effectiveStatus(p) === 'expired')
            return err('possibility is expired', 409);
          const node = PlanNode.parse({
            id: `${p.id}-need-${title.toLowerCase().replace(/\W+/g, '-').slice(0, 24)}-${Date.now().toString(36)}`,
            kind: 'need', label: title, canonical: canonicalize(title),
            source: `possibility:${p.id}`, possibilityId: p.id,
            required: false, flaggedBy: actor, category: b.category,
            orgIds: [actor], placeId: p.place, terms: b.terms,
            description: String(b.description ?? ''),
            tags: ['possibility', 'flagged'], timeframe: { to: p.deadline },
          });
          await put(env.DB, 'plannode', node.id, node);
          await ledgerAppend(env.DB, actor, 'possibility.need_flagged', { id: p.id, nodeId: node.id });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/possibilities' } })
            : json(node, 201);
        }
        // Completion report (Bloom Action Report pattern): summary/evidence/
        // learnings recorded on the card; `nextNeeds` — "what support would
        // help" — become new need nodes so the loop continues.
        if (req.method === 'POST' && seg[2] === 'complete') {
          const b = await req.json() as Record<string, unknown>;
          const status = effectiveStatus(p);
          if (status !== 'quorum' && status !== 'completed')
            return err(`possibility is ${status} — only quorum/completed cards report`, 409);
          const iso = new Date().toISOString();
          const report = {
            summary: String(b.summary ?? '').slice(0, 2000),
            evidence: String(b.evidence ?? '').slice(0, 1000),
            learnings: String(b.learnings ?? '').slice(0, 2000), at: iso,
          };
          await put(env.DB, 'possibility', p.id, { ...p, status: 'completed', report });
          const created: string[] = [];
          for (const t of (Array.isArray(b.nextNeeds) ? b.nextNeeds : []) as string[]) {
            const nid = `${p.id}-need-${String(t).toLowerCase().replace(/\W+/g, '-').slice(0, 24)}-${Date.now().toString(36)}-${created.length}`;
            await put(env.DB, 'plannode', nid, PlanNode.parse({
              id: nid, kind: 'need', label: String(t), canonical: canonicalize(String(t)),
              source: `possibility:${p.id}`, possibilityId: p.id,
              required: false, flaggedBy: String(b.by ?? p.declarerId),
              orgIds: [p.declarerId], placeId: p.place,
              tags: ['possibility', 'next'], timeframe: {},
            }));
            created.push(nid);
          }
          await ledgerAppend(env.DB, String(b.by ?? p.declarerId), 'possibility.completed',
            { id: p.id, nextNeeds: created });
          return json({ ...p, status: 'completed', report, nextNeeds: created }, 201);
        }
        // ICS export — the Mobilizon interop lane: possibility → calendar
        // event so cards travel into any calendar client.
        if (req.method === 'GET' && seg[2] === 'ics') {
          const toIcsDate = (s?: string) => (s ? s.replace(/[-:]/g, '').replace(/\.\d{3}/, '') : '');
          const lines = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//springforth//possibility//EN',
            'BEGIN:VEVENT', `UID:${p.id}@springforth`, `SUMMARY:${p.title.replace(/\n/g, ' ')}`,
            `DESCRIPTION:${(p.description || p.title).replace(/\n/g, ' ')}`,
            p.timeStart ? `DTSTART:${toIcsDate(p.timeStart)}` : '',
            p.timeEnd ? `DTEND:${toIcsDate(p.timeEnd)}` : '',
            p.place ? `LOCATION:${p.place.replace(/\n/g, ' ')}` : '',
            `URL:https://springforth.widespread.workers.dev/possibilities#${p.id}`,
            'END:VEVENT', 'END:VCALENDAR',
          ].filter(Boolean);
          return new Response(lines.join('\r\n') + '\r\n', {
            headers: { 'content-type': 'text/calendar', 'content-disposition': `inline; filename="${p.id}.ics"` },
          });
        }
      }
      // Trust graph — pairwise edges derived from appreciation rounds.
      // weight = directed rounds; mutual = min(a→b, b→a) — recognition is
      // mutual-only (free-association semantics).
      // Actors carry the two-ledger split: `earned` is append-only
      // (mutual recognition + assurance credits, never spent down);
      // `trustScore` is the uniform-seed EigenTrust vector (transitive
      // propagation).
      // ?format=attestations emits EAS-shaped records — composable
      // reputation export.
      if (req.method === 'GET' && seg[0] === 'trust') {
        const [apps, credits] = await Promise.all([
          list<Appreciation>(env.DB, 'appreciation'),
          list<AssuranceCredit>(env.DB, 'assurance-credit'),
        ]);
        const edges = trustEdges(apps);
        if (url.searchParams.get('format') === 'attestations')
          return json({
            attestations: edges.filter((e) => e.mutual > 0).map((e) => ({
              schema: 'mutual-recognition', from: e.from, to: e.to,
              weight: e.weight, mutual: e.mutual,
              ledgerEvent: 'possibility.appreciated',
            })),
          });
        const earned = earnedRecognition(edges, credits);
        const vec = eigenTrust(edges);   // uniform seed — global scores
        const actorIds = new Set<string>([
          ...Object.keys(earned), ...edges.flatMap((e) => [e.from, e.to]),
          ...credits.map((c) => c.actor),
        ]);
        return json({
          rule: 'mutual recognition = min(a→b, b→a); recognition ∝ √earned (Bloom √-norm); propagation: EigenTrust',
          edges, mutual: edges.filter((e) => e.mutual > 0),
          actors: [...actorIds].map((id) => ({
            id, earned: earned[id] ?? 0,
            trustScore: +((vec[id] ?? 0) / Math.max(...Object.values(vec), 1e-9)).toFixed(4),
            assuranceCredits: credits.filter((c) => c.actor === id).length,
          })).sort((a, b) => b.trustScore - a.trustScore || b.earned - a.earned),
        });
      }
      // Actor standing — the "Community Standing" profile: created/joined
      // counts, earned recognition, transitive trust score.
      if (req.method === 'GET' && seg[0] === 'actors') {
        const id = seg[1] ?? '';
        const [poss, parts, apps, credits] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<Appreciation>(env.DB, 'appreciation'), list<AssuranceCredit>(env.DB, 'assurance-credit'),
        ]);
        const edges = trustEdges(apps);
        const vec = eigenTrust(edges);
        const mean = Object.values(vec).length
          ? Object.values(vec).reduce((a, b) => a + b, 0) / Object.values(vec).length : 0;
        return json({
          id,
          created: poss.filter((p) => p.declarerId === id).length,
          joined: parts.filter((x) => x.actor === id).length,
          appreciatedBy: apps.filter((a) => a.toActor === id).length,
          appreciated: apps.filter((a) => a.fromActor === id).length,
          earned: earnedRecognition(edges, credits)[id] ?? 0,
          assuranceCredits: credits.filter((c) => c.actor === id).length,
          trustScore: mean > 0 ? +((vec[id] ?? 0) / mean).toFixed(4) : 0,
        });
      }
      // Resource commons — every published offer, who brings it, and how
      // many times it has been contributed (coordinated complements).
      if (req.method === 'GET' && seg[0] === 'resources') {
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const recs = await list<OverlapRecord>(env.DB, 'overlap');
        const times = new Map<string, number>();
        for (const r of recs)
          if (r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated'))
            times.set(r.nodeIds[1]!, (times.get(r.nodeIds[1]!) ?? 0) + 1);
        return json({
          resources: nodes.filter((n) => n.kind === 'offer').map((o) => ({
            id: o.id, label: o.label, owner: o.orgIds[0] ?? 'unknown',
            terms: o.terms, capacity: o.capacity, capital: inferCapital(o),
            timesContributed: times.get(o.id) ?? 0, source: o.source,
          })),
        });
      }
      // Network health — north-star + funnel metrics.
      if (req.method === 'GET' && seg[0] === 'metrics') {
        const [poss, parts, apps, recs] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<Appreciation>(env.DB, 'appreciation'), list<OverlapRecord>(env.DB, 'overlap'),
        ]);
        const now = Date.now();
        const statuses = poss.map((p) => ({ p, s: effectiveStatus(p, now) }));
        const activated = statuses.filter((x) => x.s === 'quorum' || x.s === 'completed').length;
        const completedIds = new Set(statuses.filter((x) => x.s === 'completed').map((x) => x.p.id));
        const completedParts = parts.filter((x) => completedIds.has(x.possibilityId)).length;
        const completedApps = apps.filter((a) => a.possibilityId && completedIds.has(a.possibilityId)).length;
        const first = Math.min(...statuses.map((x) => Date.parse(x.p.createdAt)), now);
        const weeks = Math.max(1, (now - first) / (7 * 86_400_000));
        const passes = await list<Pass>(env.DB, 'pass');
        const expiringSoon = statuses.filter((x) =>
          (x.s === 'active' || x.s === 'draft') && x.p.deadline
          && Date.parse(x.p.deadline) - now < 3 * 86_400_000).length;
        return json({
          possibilities: statuses.length, activated, expired: statuses.filter((x) => x.s === 'expired').length,
          quorumRate: statuses.length ? +(activated / statuses.length).toFixed(3) : 0,
          appreciationRatio: completedParts ? +(completedApps / completedParts).toFixed(3) : 0,
          coordinationsPerWeek: +(activated / weeks).toFixed(3),
          successfulCoordinationsPerWeek: successfulCoordinationsPerWeek(poss, apps, now),
          expiringSoon, passesLogged: passes.length,
          complementsConfirmed: recs.filter((r) => r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated')).length,
        });
      }
      // OpenTimestamps anchoring — stamps the ledger head hash into the
      // public Bitcoin calendars. Free and keyless: POST the 32-byte digest
      // to the calendar, it returns a pending .ots receipt; once aggregated
      // into a Bitcoin tx the calendar's /timestamp/{digest} serves the
      // upgraded receipt (status → attested). Anchoring proves the event
      // existed by that time — it never makes a record semantically true.
      if (seg[0] === 'ledger' && seg[1] === 'anchor' && seg.length === 2) {
        if (req.method === 'POST') {
          if (!authed(req, env)) return err('unauthorized', 401);
          const events = await ledgerEvents(env.DB);
          const head = events.at(-1);
          if (!head) return err('ledger empty', 400);
          const digestBytes = Uint8Array.from(head.hash.match(/../g)!.map((h) => parseInt(h, 16)));
          const results: unknown[] = [];
          for (const cal of OTS_CALENDARS) {
            try {
              const r = await fetch(`${cal}/digest`, { method: 'POST', body: digestBytes });
              if (!r.ok) { results.push({ calendar: cal, error: `http ${r.status}` }); continue; }
              const receipt = btoa(String.fromCharCode(...new Uint8Array(await r.arrayBuffer())));
              const anchor = {
                id: `anchor-${head.seq}-${new URL(cal).host}`,
                seq: head.seq, hash: head.hash, calendar: cal, receipt,
                status: 'pending', submittedAt: new Date().toISOString(),
              };
              await put(env.DB, 'anchor', anchor.id, anchor);
              results.push(anchor);
            } catch (e) { results.push({ calendar: cal, error: String(e) }); }
          }
          await ledgerAppend(env.DB, 'api', 'ledger.anchored',
            { seq: head.seq, hash: head.hash, calendars: OTS_CALENDARS.length });
          return json({ seq: head.seq, hash: head.hash, anchors: results }, 201);
        }
        // GET — anchor status; poll calendars to upgrade pending receipts.
        const anchors = await list<{
          id: string; seq: number; hash: string; calendar: string;
          receipt: string; status: string; submittedAt: string; upgradedAt?: string;
        }>(env.DB, 'anchor');
        for (const a of anchors) {
          if (a.status !== 'pending') continue;
          try {
            const r = await fetch(`${a.calendar}/timestamp/${a.hash}`);
            if (r.ok) {
              a.receipt = btoa(String.fromCharCode(...new Uint8Array(await r.arrayBuffer())));
              a.status = 'attested';
              a.upgradedAt = new Date().toISOString();
              await put(env.DB, 'anchor', a.id, a);
            }
          } catch { /* calendar unreachable — stays pending */ }
        }
        return json({
          anchors: anchors.map(({ receipt, ...a }) => ({ ...a, receiptBytes: receipt.length })),
          note: 'receipts are OpenTimestamps proofs — verify with `ots verify`',
        });
      }
      if (req.method === 'GET' && seg[0] === 'ledger') {
        if (seg[1] === 'verify') return json(await ledgerVerify(env.DB));
        return json({ events: await ledgerEvents(env.DB) });
      }
      return err('not found', 404);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'internal error', e instanceof Error && 'issues' in e ? 422 : 500);
    }
  },

  // Hourly evidence cycle — every action node with h3 gets fresh readings
  // from every configured open source; deltas post as checks. The
  // possibility sweep rides the same cadence: expiry and quorum
  // transitions are time-driven too.
  async scheduled(_ev: unknown, env: Env): Promise<void> {
    const nodes = (await list<PlanNode>(env.DB, 'plannode'))
      .filter((n) => n.kind === 'action' && n.h3);
    for (const n of nodes) await runOracleSources(env, n);
    await sweepPossibilities(env, 'cron');
    await ledgerAppend(env.DB, 'cron', 'oracle.cycle', { nodes: nodes.length, at: new Date().toISOString() });
  },
};
