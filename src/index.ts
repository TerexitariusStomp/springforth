import {
  Possibility, Participation, Appreciation, Pass, Interest, AssuranceCredit,
  OracleCheck, Signal, CouncilSeat, ForumPost,
  FundingRound, Donation, Pledge, ImpactClaim, Attestation,
  RetroRound, RetroBallot, ChainTx, YieldStream,
  ActorWallet, ActorPersonhood, ActorNonce, RoundApplication, RecurringSupport,
  GovernanceProposal, GovernanceBallot, GovernanceParam,
  DatasetRelease, DataAccessGrant, Subscription,
  valueCoordinated,
} from './core';
import {
  allocateMatching, pairwiseAllocate, refreshPledge, badgeholders, tallyRound,
  buildClaim, toHypercertLexicon,
  eligibleVoters, tallyProposal, GOVERNABLE,
} from './funding';
import { to360Giving } from './exports';
import { toIati } from './exports';
import { outcomePayload, evaluationPayload } from './attest';
import {
  chainFor, buildCreateProfileTx, buildCreateRoundTx,
  buildAttestTx, buildMintClaimTx, publicClientFor,
  parseAttestedUid, parsePoolId, readTokenBalance,
  yieldDeltaUnits, unitsToStable, verifyWalletBinding,
  buildCreateFlowTx, buildDeleteFlowTx, parseFlowRate, streamAccrual,
  CFA_FORWARDER, type ChainConfig,
  stellarNetFor, isStellarId, fetchSequence,
  buildStellarPledgeTx, buildStellarPaymentTx, buildStellarUnlockTx,
} from './chain';
import { verifySiweMessage } from '@worldcoin/minikit-js/siwe';
import {
  renderPossibilitiesPage, renderLandingPage,
  renderRoundPage, renderReportPage, renderRoundAdmin,
  renderActorProfile, renderDonorPage,
  renderClaimPage, renderDocsPage,
  renderWhitepaper,
  renderLedgerPage, renderLedgerVerifyPage,
  renderCollaboratePage, renderFundPage, renderImpactPage,
  renderCommunityPage, renderHowItWorksPage, renderMapPage, renderSearchPage,
  renderPlansPage, renderPlanPage,
  t, langFrom, LANGS, type Lang,
  tickerLines, tickerHtml, pageShell, pageHeader, FAVICON_SVG,
} from './portal/index';
import { PICO_CSS, HTMX_JS } from './vendor.js';
import { stringify as devalueStringify } from 'devalue';
import { ogPng } from './og.js';
import {
  PlanNode, ExternalPlan, OverlapRecord,
  detectOverlaps, detectComplements, validateOverlap, mergeProposal, isNeed,
  canonicalize,
  effectiveStatus, quorumMet, trustEdges, scoreCard,
  earnedRecognition, eigenTrust, viewerDeck, identitiesRevealed,
  resolvePlace,
} from './coordination';
import { normalizePlan, fromCsv, fromMarkdown } from './adapters/oneplanet';
import { fromClcJson } from './adapters/formats';
import { fromHolonsJson } from './adapters/formats';
import { fromArtizenJson } from './adapters/formats';
import { fromJson as fromOcJson } from './adapters/oc';
import { fromVfJson } from './adapters/formats';
import { fetchTreegens } from './adapters/treegens';
import {
  fromSilviProjects, fromSilviClusters, clusterSilviClaims,
  fetchSilviProject, fetchSilviTrees,
  fetchSilviCampaign, fetchSilviClaims, fetchLeafScore, silviLastError,
  type SilviClaim, type SilviClaimCluster,
} from './adapters/silvi';
import {
  fetchSoulutionsProjects, fromSoulutionsProjects, soulutionsLastError,
} from './adapters/soulutions';
import {
  fetchGivethProjects, fetchGivethQfRounds, fetchGivethDonations,
  fromGivethProjects, toFundingRounds, toDonations, givethNeedId, givethLastError,
} from './adapters/giveth';
import {
  fetchGapProjects, fromGapProjects, toGapChecks, toGapEndorsements, gapLastError,
} from './adapters/gap';
import {
  fetchRestorSitemap, fetchRestorSite, fromRestorSites, restorCentroid,
  restorLastError, type RestorSite,
} from './adapters/restor';
import {
  fetchOcAccounts, fetchOcOrders, fromOcAccounts, toOcDonations, ocError,
} from './adapters/oc';
import {
  fetchRegenClasses, fetchRegenProjects, fetchRegenBatches, fromRegen, regenLastError,
} from './adapters/regen';
import {
  fetchBloomLocations, fromBloomLocations, bloomLastError,
} from './adapters/bloom';
import { answer as agentAnswer } from './agent';
import { buildManifest } from './attest';
import { OPENAPI } from './openapi.ts';
import {
  checkFromReading, EXPECTED_DIRECTION,
  openaqPm25, sensorCommunity, nasaPower, sentinel2, gbifOccurrences,
  treegensPlantings, atlasHazard, trajectory,
  silviVerifiedTrees, silviClaimClusters, silviLeafAptness, evidenceBoost,
  restorSitesNear,
  eaFlood, openMeteo, eaWaterQuality, foodHygiene, inatObservations,
  osDataHubPlaces, eoDataHubScene, alphaKlimaHazard, naturalEnglandSites,
  placeContext,
  type SourceReading, type GeoLoc,
} from './oracle';
import { liveAtlas } from './adapters/atlas';
import { handleTelegramUpdate, sendTelegram } from './telegram.js';
import { cellToLatLng, isValidCell, latLngToCell } from 'h3-js';
import MiniSearch from 'minisearch';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { NetworkGraph, NetVertex, NetEdge } from './portal/index';
import { get, list, listWhere, listPacked, put, putPackedPage, putMany, putManyIfChanged, del, ledgerAppend, ledgerEvents, ledgerTail, ledgerVerify, ledgerVerifyIncremental } from './store.js';
import {
  VOLUNTEER_GB, GB_PLACE, DATASET_SOURCES, fundingMaps, allocFor,
  loadMetrics, loadCommitments, loadResources, loadTrust,
  loadActorsDirectory, loadRoundsView, loadRetro, loadGovernance,
  loadStreams, loadDatasets, loadSources, loadEvidence, loadLedgerSummary,
  loadCardConnections,
  type Snapshot,
} from './views.js';

// Springforth edge API — the coordination layer. Public reads;
// ADMIN_TOKEN-gated writes. All state in D1; all semantics in
// @springforth/* packages; no wallet anywhere.

export interface Env {
  DB: D1Database;
  SELF?: Fetcher;               // unused — binding kept in wrangler.toml harmlessly
  ADMIN_TOKEN?: string;
  OPENAQ_API_KEY?: string;     // free registration — explore.openaq.org
  TITILER_URL?: string;
  NOTIFY_WEBHOOK?: string;   // quorum-activation notify stub (Teams/Telegram/Discord webhook)
  ONEPLANET_API_KEY?: string; // opk_… — MCP lane (mcp.oneplanet.com/mcp)
  ONEPLANET_URL?: string;    // defaults to https://mcp.oneplanet.com/mcp
  TELEGRAM_BOT_TOKEN?: string;    // @springforth_bot — /tg webhook + quorum notify
  TELEGRAM_WEBHOOK_SECRET?: string; // X-Telegram-Bot-Api-Secret-Token check
  CHAIN_MODE?: string;            // 'off' (default) | 'celo-sepolia' | 'sepolia' | 'celo'
  CHAIN_RPC?: string;             // optional paid-RPC override
  TELEGRAM_CHAT_ID?: string;      // default group for quorum announcements
  SILVI_API_KEY?: string;         // silvi.earth public API key (silvi_…)
  SILVI_CAMPAIGN_ID?: string;     // campaign-scoped keys: the campaign it unlocks
  SILVI_PROJECT_ID?: string;      // project-scoped keys: the project it unlocks
  SILVI_API_URL?: string;         // defaults to https://admin.silvi.earth/public-api
  // External project-place lanes — all keyless public surfaces; these
  // are the env overrides (defaults live in the adapters).
  GIVETH_API?: string;            // defaults to mainnet.serve.giveth.io/graphql
  SOULUTIONS_URL?: string;        // defaults to https://soulutions.earth
  RESTOR_URL?: string;            // defaults to https://restor.eco
  GAP_API?: string;               // defaults to gapapi.karmahq.xyz
  OC_API?: string;                // defaults to api.opencollective.com/graphql/v2
  OC_SEARCH_TERMS?: string;       // comma-separated discovery terms
  REGEN_LCD?: string;             // defaults to lcd-regen.keplr.app
  BLOOM_URL?: string;             // defaults to the public Supabase project
  BLOOM_ANON_KEY?: string;        // Bloom's own public client anon key (RLS
                                // read-only) — also accepted as body.key per
                                // call; a public credential, not a secret
  RESTOR_MAX_SITES?: string;      // in-worker hydrate cap (bulk runs local)
  OS_DATAHUB_KEY?: string;        // Ordnance Survey Data Hub
  EODATAHUB_KEY?: string;         // EO Data Hub (Satellite Applications Catapult)
  ALPHAKLIMA_KEY?: string;        // Alpha-Klima physrisk platform
  DEFRA_KEY?: string;             // defra data services / Natural England
  COMPANIES_HOUSE_KEY?: string;   // api.company-information.service.gov.uk

  AI?: { run(model: string, input: { text: string[] }):
    Promise<{ data: number[][] }> };   // Workers AI bge embeddings
  WEB?: Fetcher;              // springforth-web — React frontend Worker
  WEB_FRONTEND?: string;      // '1' → browser page requests forward to WEB
  PAGES?: R2Bucket;           // optional R2 page-cache binding (springforth-cache)
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


// Measure-to-earn (GainForest-style, non-token): field-report signals
// on a node that an oracle check later corroborates earn the reporter
// an AssuranceCredit — verified evidence has value. Idempotent via the
// credit id (one credit per report × node, not per corroboration).
async function creditFieldReporters(env: Env, nodeId: string, now: string) {
  const reports = (await list<Signal>(env.DB, 'signal'))
    .filter((s) => s.targetId === nodeId && s.intent === 'field-report');
  for (const r of reports) {
    const id = `ac-fr-${r.id}`;
    if (await get<AssuranceCredit>(env.DB, 'assurance-credit', id)) continue;
    await put(env.DB, 'assurance-credit', id, AssuranceCredit.parse({
      id, actor: r.actor, nodeId, source: 'field-evidence', at: now,
    }));
    await ledgerAppend(env.DB, r.actor, 'assurance.credited',
      { id, via: 'field-report', nodeId });
  }
}


// ── Datasets — signed releases + premium access grants ─────────────
// A release freezes a graph slice to JSONL, builds the evidence-anchor
// manifest, OTS-anchors the digest, and optionally pins to IPFS.
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const enc = (s: string) => new TextEncoder().encode(s);

// Pin to IPFS if an endpoint is configured (IPFS_API env — a Kubo RPC
// URL like http://localhost:5001 or a pinning service). Best-effort.
async function pinToIpfs(env: Env, name: string, bytes: Uint8Array): Promise<string | undefined> {
  const api = (env as Env & { IPFS_API?: string }).IPFS_API;
  if (!api) return undefined;
  try {
    const form = new FormData();
    form.append('file', new Blob([bytes as unknown as BlobPart]), `${name}.jsonl`);
    const r = await fetch(`${api.replace(/\/$/, '')}/api/v0/add`, { method: 'POST', body: form });
    if (!r.ok) return undefined;
    const j = await r.json() as { Hash?: string };
    return j.Hash;
  } catch { return undefined; }
}

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
    atlasHazard(node.h3!, liveAtlas()).catch(() => null),
    // Silvi — campaign-scoped keys can't geo-query upstream; the synced
    // claim clusters in D1 answer instead. Project keys keep the live lane.
    (env.SILVI_CAMPAIGN_ID
      ? silviClaimClusters(loc, {
          clusters: () => list<{ lat: number; lng: number; verified: number }>(
            env.DB, 'silvi-cluster'),
        })
      : silviVerifiedTrees(loc, {
          trees: () => env.SILVI_PROJECT_ID
            ? fetchSilviProject(env.SILVI_PROJECT_ID, env.SILVI_API_URL, env.SILVI_API_KEY)
                .then((p) => p?.trees ?? null)
            : fetchSilviTrees(env.SILVI_API_URL, env.SILVI_API_KEY),
        })).catch(() => null),
    silviLeafAptness(loc, { leaf: (l) => fetchLeafScore(l) }).catch(() => null),
    // Restor — hydrated site centroids from D1 answer the near-node count.
    restorSitesNear(loc, {
      // ~200k sites when fully hydrated — project only the centroid, never
      // parse the full site JSON per row.
      sites: () => env.DB.prepare(
        `SELECT json_extract(json,'$.centroid.lat') AS lat,
                json_extract(json,'$.centroid.lng') AS lng
         FROM entities WHERE kind='restor-site'`)
        .all<{ lat: number | null; lng: number | null }>()
        .then((r) => (r.results ?? [])
          .filter((x): x is { lat: number; lng: number } =>
            x.lat != null && x.lng != null)),
    }).catch(() => null),
    // Hackathon-endorsed public sources — keyless readers degrade to null
    // outside their coverage (e.g. EA sources on non-UK nodes), gated ones
    // until their env key lands.
    eaFlood(loc).catch(() => null),
    openMeteo(loc).catch(() => null),
    eaWaterQuality(loc).catch(() => null),
    foodHygiene(loc).catch(() => null),
    inatObservations(loc).catch(() => null),
    osDataHubPlaces(loc, env.OS_DATAHUB_KEY).catch(() => null),
    eoDataHubScene(loc, env.EODATAHUB_KEY).catch(() => null),
    alphaKlimaHazard(loc, env.ALPHAKLIMA_KEY).catch(() => null),
    naturalEnglandSites(loc, env.DEFRA_KEY).catch(() => null),
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
    if (check.result === 'match') await creditFieldReporters(env, node.id, now);
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
const wantsHtml = (req: Request) => (req.headers.get('accept') ?? '').includes('text/html');
const html = (s: string, status = 200) =>
  new Response(s, { status, headers: { 'content-type': 'text/html' } });

// UI contract: the springforth-web Worker asks for a page with
// `x-sf-ui: 1` (+ Accept: text/html so wantsHtml branches still take the
// page path). It gets the render args serialized with devalue (Map/Set
// survive) instead of the legacy HTML string — same public page data.
const page = (req: Request, render: (...a: any[]) => string, ...args: unknown[]) =>
  req.headers.get('x-sf-ui') === '1'
    ? new Response(devalueStringify(args), { headers: { 'content-type': 'application/x-sf-ui' } })
    : html(render(...args));
// Constant-time secret comparison — `===`/`!==` short-circuits on the first
// differing byte, leaking prefix information across a network boundary.
export const timingSafeEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const authed = (req: Request, env: Env) =>
  !!env.ADMIN_TOKEN && timingSafeEq(req.headers.get('authorization') ?? '', `Bearer ${env.ADMIN_TOKEN}`);

// Body caps — ~68 routes parse JSON/formData without bounds; a giant POST
// burns isolate CPU on the free plan. Unauthenticated writes are small
// forms; the 8MB ceiling leaves headroom for admin uploads (evidence packs).
const MAX_BODY = 8 * 1024 * 1024;
const MAX_BODY_ANON = 256 * 1024;

// Feed POSTs may carry a `next` path to land on after the redirect —
// strictly same-origin deck paths only (no protocol-relative escapes).
const safeNext = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^\/possibilities(\?|#|$)/.test(v) ? v : fallback;

// Possibility sweep — advances time-driven statuses once and fires quorum
// effects exactly once per possibility: status flip, `possibility.quorum`
// ledger event, and a notify stub (POSTs to NOTIFY_WEBHOOK when configured).
// Fan-out to subscriptions matching (target, event-kind). The system
// webhook + possibility home chat still fire; subscribers get the same
// text on their chosen channel.
async function notifySubscribers(env: Env, target: string, kind: string,
  text: string, link?: string): Promise<void> {
  const subs = (await list<Subscription & { deletedAt?: string }>(env.DB, 'subscription')).filter((s) => !s.deletedAt);
  const hits = subs.filter((s) =>
    (s.target === target || s.target === '*') &&
    s.events.some((e) => kind.startsWith(e.split('.')[0]!) || kind.includes(e)));
  for (const s of hits) {
    const msg = link ? `${text} — ${link}` : text;
    if (s.channel === 'telegram' && env.TELEGRAM_BOT_TOKEN && s.address)
      await sendTelegram(env, s.address, msg).catch(() => {});
    else if (s.channel === 'webhook' && s.address)
      await fetch(s.address, { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: kind, target, text: msg }) }).catch(() => {});
    // 'email' is recorded only — delivery lands when a relay is configured.
  }
  // System-level fallback: the possibility's home chat / NOTIFY_WEBHOOK.
  if (env.NOTIFY_WEBHOOK)
    await fetch(env.NOTIFY_WEBHOOK, { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }) }).catch(() => {});
  if (kind === 'quorum' && env.TELEGRAM_BOT_TOKEN) {
    const home = await get<{ chatId: number | string }>(env.DB, 'poss-chat', target);
    const tg = home?.chatId ?? env.TELEGRAM_CHAT_ID;
    if (tg) await sendTelegram(env, tg, link ? `${text} — ${link}` : text).catch(() => {});
  }
}

// Council seating — idempotent via the seat id. The council is who may
// post to the card's forum once it opens at quorum.
async function seatCouncil(env: Env, possibilityId: string, actor: string,
  role: CouncilSeat['role'], at: string): Promise<boolean> {
  const id = `seat-${possibilityId}-${actor.toLowerCase().replace(/\W+/g, '-')}-${role}`;
  if (await get<CouncilSeat>(env.DB, 'council-seat', id)) return false;
  await put(env.DB, 'council-seat', id, CouncilSeat.parse({
    id, possibilityId, actor, role, at,
  }));
  return true;
}

async function sweepPossibilities(env: Env, actor = 'system',
  pre?: { poss: Possibility[]; nodes: PlanNode[]; recs: OverlapRecord[]; parts: Participation[] },
): Promise<void> {
  const [poss, nodes, recs, parts] = pre
    ? [pre.poss, pre.nodes, pre.recs, pre.parts]
    : await Promise.all([
      // quorum checks only consult possibilityId-scoped nodes
      list<Possibility>(env.DB, 'possibility'),
      listWhere<PlanNode>(env.DB, 'plannode', "json_extract(json,'$.possibilityId') IS NOT NULL"),
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
      // Seat the council — declarer + every committed participant.
      let seated = 0;
      if (await seatCouncil(env, p.id, p.declarerId, 'declarer', iso)) seated++;
      for (const pt of parts.filter((x) => x.possibilityId === p.id))
        if (await seatCouncil(env, p.id, pt.actor, 'participant', iso)) seated++;
      if (seated)
        await ledgerAppend(env.DB, actor, 'council.seated', { id: p.id, seats: seated });
      await notifySubscribers(env, p.id, 'quorum',
        `Quorum reached: ${p.title} — commitment bound, the council chamber is open`,
        `https://springforth.widespread.workers.dev/possibilities#${p.id}`);
    }
  }
  // Assurance pledges ride the same lifecycle: pending → bound at quorum,
  // → refunded on expiry, bound → released on completion.
  const pledges = await list<Pledge>(env.DB, 'pledge');
  for (const pl of pledges) {
    const p = poss.find((x) => x.id === pl.possibilityId);
    if (!p) continue;
    const next = refreshPledge(pl, p,
      { nodes, overlaps: recs, participations: parts }, now);
    if (next.state !== pl.state) {
      await put(env.DB, 'pledge', pl.id, next);
      await ledgerAppend(env.DB, actor, `pledge.${next.state}`,
        { id: pl.id, possibilityId: p.id });
      // A bound pledge seats the sponsor on the card's council.
      if (next.state === 'bound' && await seatCouncil(env, p.id, pl.pledger, 'sponsor', iso))
        await ledgerAppend(env.DB, actor, 'council.seated', { id: p.id, actor: pl.pledger, role: 'sponsor' });
    }
  }
}

// ── Chain lane ────────────────────────────────────────────────────────
// The worker builds unsigned calldata and reads receipts — signers hold
// the keys. CHAIN_MODE gates everything: 'off' (default) disables tx
// building and the cron sync; 'celo-sepolia'/'sepolia' are the proving
// grounds; alfajores is decommissioned post-L2.
const chainCfg = (env: Env): ChainConfig | null =>
  env.CHAIN_MODE === 'celo-sepolia' || env.CHAIN_MODE === 'sepolia'
    || env.CHAIN_MODE === 'celo'
    ? chainFor(env.CHAIN_MODE as 'celo-sepolia' | 'sepolia' | 'celo') : null;

// Hourly cron: confirm submitted txs, apply side effects. Reads only.

// Recurring-support accrual — elapsed time × flowRate becomes periodic
// Donation records (settled via the stream, ref = stream id).
async function accrueStreams(env: Env): Promise<number> {
  const streams = (await list<RecurringSupport>(env.DB, 'recurring-support'))
    .filter((s) => s.state === 'active');
  const now = Date.now();
  let credited = 0;
  for (const s of streams) {
    const from = s.lastAccrualAt ? Date.parse(s.lastAccrualAt) : Date.parse(s.createdAt);
    const units = streamAccrual(BigInt(s.flowRate), from, now);
    if (units <= 0n) continue;
    const amount = Number(units) / 1e18;
    if (s.needNodeId) {
      // need-targeted stream → periodic Donation records (they join QF).
      // Denominate in the round's own unit — GBP rounds don't mint USD.
      const round = await get<FundingRound>(env.DB, 'round', s.roundId);
      const don = Donation.parse({
        id: `don-stream-${s.id}-${now.toString(36)}`,
        roundId: s.roundId, needNodeId: s.needNodeId,
        donor: s.supporter, amount,
        currency: round?.matchingFund.currency ?? 'USD',
        settlement: 'settled', settlementRef: `superfluid:${s.id}`,
        at: new Date(now).toISOString(),
      });
      await put(env.DB, 'donation', don.id, don);
    } else {
      // untargeted stream → matching-fund sponsor (like yield lanes).
      const round = await get<FundingRound>(env.DB, 'round', s.roundId);
      if (round) await put(env.DB, 'round', round.id, {
        ...round,
        matchingFund: { ...round.matchingFund,
          amount: round.matchingFund.amount + amount },
      });
    }
    await put(env.DB, 'recurring-support', s.id, {
      ...s, accruedUnits: (BigInt(s.accruedUnits) + units).toString(),
      lastAccrualAt: new Date(now).toISOString(),
    });
    credited++;
  }
  return credited;
}

async function syncChain(env: Env): Promise<number> {
  const cfg = chainCfg(env);
  if (!cfg) return 0;
  const client = publicClientFor(cfg, env.CHAIN_RPC);
  const pending = (await list<ChainTx>(env.DB, 'chaintx'))
    .filter((t) => t.status === 'submitted' && t.chainId === cfg.chainId);
  let confirmed = 0;
  for (const t of pending) {
    const receipt = await client.getTransactionReceipt({ hash: t.txHash as `0x${string}` })
      .catch(() => null);
    if (!receipt) continue;
    const now = new Date().toISOString();
    if (receipt.status !== 'success') {
      await put(env.DB, 'chaintx', t.id, { ...t, status: 'failed', confirmedAt: now });
      await ledgerAppend(env.DB, 'cron', 'chaintx.failed', { id: t.id, txHash: t.txHash });
      continue;
    }
    // Side effects per kind — decode the protocol's own event for the ref.
    let result: string | undefined;
    if (t.kind === 'round.create') {
      const poolId = cfg.contracts.allo
        ? parsePoolId(receipt, cfg.contracts.allo) : null;
      result = poolId === null ? undefined : poolId.toString();
      if (result) {
        const round = await get<FundingRound>(env.DB, 'round', t.entityId);
        if (round) await put(env.DB, 'round', round.id, { ...round, chainRef: `${cfg.chainId}:${result}` });
      }
    } else if (t.kind === 'attestation.publish') {
      const uid = cfg.contracts.eas
        ? parseAttestedUid(receipt, cfg.contracts.eas) : null;
      result = uid ?? undefined;
      const att = await get<Attestation>(env.DB, 'attestation', t.entityId);
      if (att) await put(env.DB, 'attestation', att.id, { ...att, uid: uid ?? att.uid });
    } else if (t.kind === 'claim.mint') {
      result = t.txHash;
      const claim = await get<ImpactClaim>(env.DB, 'claim', t.entityId);
      if (claim) await put(env.DB, 'claim', claim.id,
        { ...claim, chainRef: `${cfg.chainId}:${t.txHash}` });
    } else if (t.kind === 'stream.create' || t.kind === 'stream.delete') {
      const s = await get<RecurringSupport>(env.DB, 'recurring-support', t.entityId);
      if (s) {
        const parsed = parseFlowRate(receipt);
        await put(env.DB, 'recurring-support', s.id, {
          ...s,
          state: t.kind === 'stream.create' ? 'active' : 'closed',
          txHash: t.txHash,
          flowRate: parsed ? parsed.flowRate.toString() : s.flowRate,
          lastAccrualAt: now,
        });
        result = parsed?.flowRate.toString();
      }
    } else if (t.kind === 'donation.settle') {
      const don = await get<Donation>(env.DB, 'donation', t.entityId);
      if (don) {
        await put(env.DB, 'donation', don.id,
          { ...don, settlement: 'settled', settlementRef: `${cfg.chainId}:${t.txHash}` });
        // Donor-recognition attestation — settled support becomes
        // exportable reputation for the donor (GIVbacks-analog lane,
        // non-token: the receipt IS the reward).
        const att = Attestation.parse({
          id: `att-donor-${don.id}`,
          attester: 'springforth',
          schemaRef: 'springforth.donation.v1',
          payload: JSON.stringify({ donationId: don.id, roundId: don.roundId,
            needNodeId: don.needNodeId, donor: don.donor, amount: don.amount,
            currency: don.currency, settlementRef: don.settlementRef }),
          at: now,
        });
        await put(env.DB, 'attestation', att.id, att);
      }
    }
    await put(env.DB, 'chaintx', t.id,
      { ...t, status: 'confirmed', result, confirmedAt: now });
    await ledgerAppend(env.DB, 'cron', 'chaintx.confirmed',
      { id: t.id, kind: t.kind, entityId: t.entityId, txHash: t.txHash, result });
    confirmed++;
  }
  return confirmed;
}

// Yield-backed matching: read each active stream's aToken balance; the
// delta since last read credits the round's matchingFund. Read-only —
// the sponsor's wallet holds the position throughout.
async function syncYield(env: Env): Promise<number> {
  const cfg = chainCfg(env);
  if (!cfg) return 0;
  const client = publicClientFor(cfg, env.CHAIN_RPC);
  const streams = (await list<YieldStream>(env.DB, 'yieldstream'))
    .filter((s) => s.state === 'active');
  let credited = 0;
  for (const s of streams) {
    const bal = await readTokenBalance(client,
      s.tokenAddress as `0x${string}`, s.holderAddress as `0x${string}`)
      .catch(() => null);
    if (bal === null) continue;
    const last = s.lastUnits === undefined ? undefined : BigInt(s.lastUnits);
    const { delta, newPrincipal } = yieldDeltaUnits(last, bal);
    const now = new Date().toISOString();
    if (newPrincipal) {
      await put(env.DB, 'yieldstream', s.id,
        { ...s, principalUnits: bal.toString(), lastUnits: bal.toString(), updatedAt: now });
      continue;
    }
    if (delta === 0n) {
      await put(env.DB, 'yieldstream', s.id, { ...s, lastUnits: bal.toString(), updatedAt: now });
      continue;
    }
    const stable = unitsToStable(delta, s.decimals);
    const round = await get<FundingRound>(env.DB, 'round', s.roundId);
    if (round && round.state === 'open') {
      await put(env.DB, 'round', round.id, { ...round,
        matchingFund: { ...round.matchingFund,
          amount: round.matchingFund.amount + stable } });
    }
    await put(env.DB, 'yieldstream', s.id, { ...s,
      lastUnits: bal.toString(),
      yieldAccrued: s.yieldAccrued + stable, updatedAt: now });
    await ledgerAppend(env.DB, 'cron', 'yield.accrued',
      { id: s.id, roundId: s.roundId, delta: stable, sponsor: s.sponsor });
    credited++;
  }
  return credited;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Phase H: CORS allowlist + sliding-window rate limit ────────────
// CORS: browsers get cross-origin reads only from allowlisted origins
// (CORS_ORIGINS env, comma-separated; '*' default since the API is
// read-mostly public data). Preflight short-circuits before routing.
const corsHeaders = (env: Env, origin: string | null) => {
  const allowed = ((env as Env & { CORS_ORIGINS?: string }).CORS_ORIGINS ?? '*')
    .split(',').map((s) => s.trim());
  const h: Record<string, string> = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
  };
  if (origin && (allowed.includes('*') || allowed.includes(origin)))
    h['access-control-allow-origin'] = allowed.includes('*') ? '*' : origin;
  return h;
};
const withCors = (res: Response, env: Env, req: Request) => {
  const h = corsHeaders(env, req.headers.get('origin'));
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
  return out;
};

// Rate limit: sliding window per actor|route, D1-backed. Telegram (/tg)
// is exempt — bot throughput isn't user spam. Writes count against a
// tighter budget than reads. Returns remaining budget or null if over.
// Per-isolate sliding-window limiter. D1-backed limiting wrote a row per
// request — on the 100k/day free-tier row cap that burned the budget and,
// when exhausted, 500'd every page. In-memory limiting is approximate
// across isolates (each isolate has its own window), which is acceptable
// for abuse throttling; correctness never depends on it.
const rlBuckets = new Map<string, { windowStart: number; count: number }>();
function rateLimitOk(_env: Env, key: string, limit: number): boolean {
  const now = Date.now();
  const rec = rlBuckets.get(key);
  if (!rec || now - rec.windowStart > 60_000) {
    if (rlBuckets.size > 10_000) rlBuckets.clear();
    rlBuckets.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

// ── Embeddings — meaning-matched search + overlap scoring ──────────────
// Workers AI bge-base-en-v1.5 (768-dim), stored as `embedding` entities
// keyed emb:<nodeId>. Everything degrades gracefully when env.AI or stored
// vectors are absent — the scorer hook just contributes nothing.
const EMB_MODEL = '@cf/baai/bge-base-en-v1.5';
const EMB_BATCH = 50;

const cosine = (a: number[], b: number[]): number => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

const loadEmbeddings = async (db: D1Database): Promise<Map<string, number[]>> => {
  const rows = await list<{ id: string; vec: number[] }>(db, 'embedding');
  return new Map(rows.map((r) => [r.id.replace(/^emb:/, ''), r.vec]));
};

const nodeText = (n: PlanNode) => `${n.label} ${n.description ?? ''} ${(n.tags ?? []).join(' ')}`.slice(0, 512);

const embedTexts = async (env: Env, texts: string[]): Promise<number[][]> => {
  if (!env.AI) return [];
  const r = await env.AI.run(EMB_MODEL, { text: texts });
  return r.data ?? [];
};

// detectOverlaps `scorer` opt: cosine when both sides have vectors.
const embeddingScorer = (emb: Map<string, number[]>) =>
  emb.size
    ? (a: PlanNode, b: PlanNode) => {
        const va = emb.get(a.id), vb = emb.get(b.id);
        return va && vb ? cosine(va, vb) : undefined;
      }
    : undefined;

// Hybrid meaning search over plan nodes: lexical ∪ semantic cosine.
export interface NodeHit { node: PlanNode; score: number; via: 'semantic' | 'lexical' }
const searchNodes = async (env: Env, q: string): Promise<NodeHit[]> => {
  const nodes = await list<PlanNode>(env.DB, 'plannode');
  const emb = await loadEmbeddings(env.DB);
  let qv: number[] | undefined;
  if (env.AI) qv = (await embedTexts(env, [q]))[0];
  const mini = new MiniSearch<PlanNode>({ fields: ['label', 'description', 'tags'],
    idField: 'id', searchOptions: { prefix: true, fuzzy: 0.2 } });
  mini.addAll(nodes);
  const lex = new Map(mini.search(q).map((r) => [r.id, r.score]));
  const maxLex = Math.max(1, ...lex.values());
  return nodes.map((n) => {
    const v = emb.get(n.id);
    const sem = qv && v ? Math.max(0, cosine(qv, v)) : 0;
    const lexs = (lex.get(n.id) ?? 0) / maxLex;
    const score = Math.max(sem, lexs * 0.85);
    return { node: n, score: Math.round(score * 1000) / 1000,
      via: sem >= lexs ? 'semantic' as const : 'lexical' as const };
  }).filter((r) => (r.via === 'lexical'
    ? r.score >= 0.2
    // bge cosine baseline sits ~0.6 even for unrelated text — a 0.66 floor
    // keeps real semantic matches (observed ≥0.67) and drops noise queries.
    : r.score >= 0.66))
    .sort((a, b) => b.score - a.score).slice(0, 25);
};

// ── Cross-plan network — ForceAtlas2 layout over overlap edges ─────────
// Vertices are plan sources (plus possibility cards); edges are detected
// overlaps that span two sources. Deterministic: circular seed order.
const buildNetwork = (plans: ExternalPlan[], poss: Possibility[],
  nodes: PlanNode[], recs: OverlapRecord[]): NetworkGraph => {
  const srcOf = new Map(nodes.map((n) => [n.id, n.source]));
  const title = new Map<string, string>([
    ...plans.map((p): readonly [string, string] => [p.id, p.title]),
    ...poss.map((p): readonly [string, string] => [`possibility:${p.id}`, p.title]),
  ]);
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.source, (counts.get(n.source) ?? 0) + 1);
  const edges = new Map<string, NetEdge>();
  for (const r of recs) {
    const a = srcOf.get(r.nodeIds[0]), b = srcOf.get(r.nodeIds[1]);
    if (!a || !b || a === b) continue;
    const [lo, hi] = [a, b].sort() as [string, string];
    const e = edges.get(`${lo}~${hi}`) ?? { a: lo, b: hi, count: 0, confidence: 0 };
    e.count++; e.confidence = Math.max(e.confidence, r.confidence);
    edges.set(`${lo}~${hi}`, e);
  }
  if (!edges.size) return { vertices: [], edges: [] };
  // Layout is O(edges × iterations) — bound it to the strongest links; a
  // hairball would be unreadable anyway.
  const laid = [...edges.values()]
    .sort((a, b) => b.confidence - a.confidence || b.count - a.count)
    .slice(0, 80);
  const g = new Graph();
  const ids = [...new Set(laid.flatMap((e) => [e.a, e.b]))].sort();
  ids.forEach((id, i) => {
    const ang = (i / ids.length) * Math.PI * 2;
    g.addNode(id, { x: Math.cos(ang) * 100, y: Math.sin(ang) * 100 });
  });
  for (const e of laid) g.addEdge(e.a, e.b, { weight: e.count });
  const pos = forceAtlas2(g, { iterations: 90,
    settings: { gravity: 1, scalingRatio: 12, slowDown: 4 } });
  const xs = ids.map((id) => pos[id]!.x), ys = ids.map((id) => pos[id]!.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const pad = 90, W = 900, H = 560;
  const sx = (x1 - x0) ? (W - 2 * pad) / (x1 - x0) : 0;
  const sy = (y1 - y0) ? (H - 2 * pad) / (y1 - y0) : 0;
  const s = Math.min(sx || Infinity, sy || Infinity);
  const vertices: NetVertex[] = ids.map((id) => ({
    id,
    label: title.get(id) ?? id.replace(/^[^:]+:/, '').replace(/[-_]/g, ' '),
    x: pad + (pos[id]!.x - x0) * s + (sx && !sy ? 0 : (W - 2 * pad - (x1 - x0) * s) / 2),
    y: pad + (pos[id]!.y - y0) * s + (H - 2 * pad - (y1 - y0) * s) / 2,
    count: counts.get(id) ?? 1,
    kind: id.startsWith('possibility:') ? 'possibility' : 'plan',
  }));
  return { vertices, edges: laid };
};

// Linked-evidence bundle for a node: its plan, inferred/explicit parent,
// child actions, oracle checks, evidence credits and overlap count.
const nodeLinks = async (env: Env, node: PlanNode,
  cache?: { nodes?: PlanNode[]; plans?: ExternalPlan[]; checks?: OracleCheck[]; credits?: AssuranceCredit[]; overlaps?: OverlapRecord[] }) => {
  const [nodes, plans, checks, credits, overlaps] = await Promise.all([
    cache?.nodes ? Promise.resolve(cache.nodes) : list<PlanNode>(env.DB, 'plannode'),
    cache?.plans ? Promise.resolve(cache.plans) : list<ExternalPlan>(env.DB, 'plan'),
    cache?.checks ? Promise.resolve(cache.checks) : list<OracleCheck>(env.DB, 'oracle-check'),
    cache?.credits ? Promise.resolve(cache.credits) : list<AssuranceCredit>(env.DB, 'assurance-credit'),
    cache?.overlaps ? Promise.resolve(cache.overlaps) : list<OverlapRecord>(env.DB, 'overlap'),
  ]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    plan: plans.find((p) => p.id === node.source || p.source === node.source) ?? null,
    parent: node.parentOutcomeId ? byId.get(node.parentOutcomeId) ?? null : null,
    children: nodes.filter((n) => n.parentOutcomeId === node.id),
    checks: checks.filter((c) => c.nodeId === node.id && !c.demo),
    credits: credits.filter((c) => c.nodeId === node.id),
    overlaps: overlaps.filter((r) => r.nodeIds.includes(node.id)),
  };
};

// Proposals below this floor never render in the review queue — storing
// them just burns CPU on every hub load, so detection only persists
// at-or-above-floor records plus complements (which drive matching).
const OVERLAP_REVIEW_FLOOR = 0.5;
// In-worker overlap detection is incremental — pairs touching the synced
// nodes only, time-boxed so a growing graph can't push syncs over the
// Worker CPU cap. Full-corpus detection belongs to local import scripts
// (scripts/*-import.mjs) which run it unbounded.
const SYNC_DETECT_MS = 40;
// `scope` bounds retirement to records touching the newly-synced nodes —
// incremental detection only re-evaluates pairs touching them, so a
// proposed record between two unchanged nodes was never re-checked and
// must not be retired. `exhausted` marks a budget-cut pass — records that
// fell out of the *evaluated* set can't be distinguished from records the
// pass never reached, so retirement is skipped entirely.
const persistDetectedOverlaps = async (
  env: Env, detected: OverlapRecord[], scope?: ReadonlySet<string>,
  exhausted = false,
) => {
  const keep = new Map((await list<OverlapRecord>(env.DB, 'overlap')).map((o) => [o.id, o]));
  const seen = new Set<string>();
  for (const rec of detected) {
    const prior = keep.get(rec.id);
    if (prior && prior.status !== 'proposed') { seen.add(rec.id); continue; }
    if (rec.kind !== 'complement' && rec.confidence < OVERLAP_REVIEW_FLOOR) continue;
    await put(env.DB, 'overlap', rec.id, rec);
    seen.add(rec.id);
  }
  if (exhausted) return 0;
  let retired = 0;
  for (const prior of keep.values())
    if (prior.status === 'proposed' && !seen.has(prior.id)
        && (!scope || prior.nodeIds.some((id) => scope.has(id)))) {
      await del(env.DB, 'overlap', prior.id); retired++;
    }
  return retired;
};

// Plan-meta row — nodes are stripped so feeds carrying 100+ records stay small.
const putPlanMeta = (env: Env, planId: string, plan: ExternalPlan, title?: string) =>
  put(env.DB, 'plan', planId,
    { ...plan, id: planId, ...(title ? { title } : {}), nodes: undefined, nodeCount: plan.nodes.length });

// Shared sync tail for adapter routes: upsert `nodes`, retire stale
// `retirePrefix%` rows not in `changed`, then a scoped+budgeted overlap pass
// over the `excludePrefix%`-excluded pool. `prefix` is shorthand for both.
const syncDetect = async (env: Env, nodes: PlanNode[], opts: {
  prefix?: string; retirePrefix?: string; excludePrefix?: string;
  changedIds?: ReadonlySet<string>; skipPut?: boolean;
} = {}) => {
  const changed = opts.changedIds ?? new Set(nodes.map((n) => n.id));
  const retirePfx = opts.retirePrefix ?? opts.prefix;
  if (retirePfx)
    for (const n of await listWhere<PlanNode>(env.DB, 'plannode', 'id LIKE ?', `${retirePfx}%`))
      if (!changed.has(n.id)) await del(env.DB, 'plannode', n.id);
  if (!opts.skipPut)
    await putManyIfChanged(env.DB, 'plannode', nodes.map((n) => ({ id: n.id, obj: n })));
  const pool = [
    ...(await listWhere<PlanNode>(env.DB, 'plannode', 'id NOT LIKE ?', `${opts.excludePrefix ?? opts.prefix ?? ''}%`)),
    ...nodes];
  const st = { pairs: 0, exhausted: false };
  const detected = [
    ...detectOverlaps(pool, { changedIds: changed, timeBudgetMs: SYNC_DETECT_MS, stats: st }),
    ...detectComplements(pool, { changedIds: changed, timeBudgetMs: SYNC_DETECT_MS, stats: st }),
  ];
  const retired = await persistDetectedOverlaps(env, detected, changed, st.exhausted);
  return { detected, retired, exhausted: st.exhausted };
};

// Retired top-level surfaces → their hub section. `always` routes had no
// JSON form so every GET redirects; the rest only redirect browsers —
// API clients keep receiving the same JSON byte-for-byte.
const RETIRED: Record<string, { to: string; always?: boolean; keep: string[] }> = {
  coordination: { to: '/collaborate#overlaps', always: true, keep: ['node'] },
  outcomes:     { to: '/collaborate#outcomes', always: true, keep: [] },
  portfolio:    { to: '/collaborate#plans',    always: true, keep: [] },
  tour:         { to: '/how-it-works',         always: true, keep: [] },
  all:          { to: '/how-it-works',         always: true, keep: [] },
  commitments:  { to: '/collaborate#needs',    keep: [] },
  resources:    { to: '/collaborate#commons',  keep: [] },
  agent:        { to: '/collaborate#ask',      keep: ['q'] },
  rounds:       { to: '/fund#rounds',          keep: [] },
  pledges:      { to: '/fund#pledges',         keep: [] },
  retro:        { to: '/fund#retro',           keep: [] },
  streams:      { to: '/fund#streams',         keep: [] },
  metrics:      { to: '/impact#results',       keep: [] },
  claims:       { to: '/impact#claims',        keep: [] },
  attestations: { to: '/impact#claims',        keep: [] },
  verify:       { to: '/impact#evidence',      keep: [] },
  sources:      { to: '/impact#evidence',      keep: [] },
  datasets:     { to: '/impact#data',          keep: [] },
  actors:       { to: '/community#people',     keep: [] },
  trust:        { to: '/community#trust',      keep: [] },
  governance:   { to: '/community#decisions',  keep: [] },
};
const HUB_SEGS = new Set(['collaborate', 'fund', 'impact', 'community', 'how-it-works']);

// Anon-GET memo — a full page render burns ~20ms CPU against the free
// plan's 10ms limit (Cloudflare kills the request with error 1102). The
// render work is identical for anonymous viewers, so cache the produced
// response per (URL, output variant) for a few seconds per isolate. Any
// write on this isolate clears the map; cross-isolate staleness is ≤ TTL.
// Personalized callers (cookie/x-actor/authorization) always bypass.
const ANON_GET_TTL = 5_000;
const anonGetCache = new Map<string,
  { at: number; status: number; headers: [string, string][]; body: string }>();

const anonGetKey = (req: Request, env: Env): string | undefined => {
  if (req.method !== 'GET') return undefined;
  if (req.headers.get('cookie') || req.headers.get('x-actor')
    || req.headers.get('authorization') || authed(req, env)) return undefined;
  // `accept` + `x-sf-ui` select the output variant for the same URL.
  const variant = `${req.headers.get('accept')?.includes('text/html') ? 'h' : 'j'}` +
    `${req.headers.get('x-sf-ui') === '1' ? 'u' : ''}`;
  return `${req.url}|${variant}`;
};

const TEXTUAL = /text\/html|application\/(x-sf-ui|json)/;
// Persistent layer: R2 object storage is global and strongly consistent —
// one successful render shelters every visitor everywhere for PAGES_TTL,
// and it costs zero D1 reads (the free-tier row quota is the second
// availability cliff). Writes invalidate globally by bumping `page-epoch`
// — orphaned objects under old epochs are cleaned by a bucket lifecycle
// rule (abort multipart / expire after 1d).
const PAGES_TTL = 60_000;
const PAGE_EPOCH_KEY = 'page-epoch';
const pageKey = (key: string, epoch: string) =>
  `pages/${epoch}/${encodeURIComponent(key)}`;

interface PageEntry {
  at: number; status: number; headers: [string, string][]; body: string;
}

const r2Entry = async (o: R2ObjectBody | null): Promise<PageEntry | undefined> => {
  const m = o?.customMetadata;
  if (!o || !m?.at || !m.status || !m.h) return undefined;
  const entry: PageEntry = { at: Number(m.at), status: Number(m.status),
    headers: JSON.parse(m.h), body: await o.text() };
  return entry;
};

const r2Store = (pages: R2Bucket, key: string, epoch: string, e: PageEntry): Promise<unknown> => {
  // customMetadata caps at 2048 bytes — fall back to content-type only if
  // the full header set is unusually fat.
  let h = JSON.stringify(e.headers);
  if (h.length > 1800) {
    const ct = e.headers.find(([k]) => k === 'content-type');
    h = JSON.stringify(ct ? [ct] : []);
  }
  return pages.put(pageKey(key, epoch), e.body, { customMetadata: {
    at: String(e.at), status: String(e.status), h } });
};

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight short-circuit.
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(env, req.headers.get('origin')) });
    const key = anonGetKey(req, env);
    let epoch = '0';
    let res: Response | undefined;
    let entry = key ? anonGetCache.get(key) : undefined;
    if (entry && Date.now() - entry.at < ANON_GET_TTL) {
      res = new Response(entry.body, { status: entry.status, headers: entry.headers });
    } else if (key && env.PAGES) {
      // R2 layer — epoch-scoped key so a write anywhere invalidates
      // globally (epoch object is bumped on every non-GET below).
      epoch = (await env.PAGES.get(PAGE_EPOCH_KEY).then((o) => o?.text()).catch(() => undefined)) ?? '0';
      const hit = await env.PAGES.get(pageKey(key, epoch))
        .then(r2Entry).catch(() => undefined);
      if (hit && Date.now() - hit.at < PAGES_TTL) {
        entry = hit;
        anonGetCache.set(key, hit);
        res = new Response(hit.body, { status: hit.status, headers: hit.headers });
      }
    }
    if (!res) {
      res = await this.handle(req, env).catch((e) =>
        json({ error: 'internal', detail: String(e) }, 500));
      if (key && res.ok && TEXTUAL.test(res.headers.get('content-type') ?? '')) {
        const copy = res.clone();
        const e: PageEntry = { at: Date.now(), status: copy.status,
          headers: [...copy.headers].filter(([k]) => k !== 'set-cookie') as [string, string][],
          body: await copy.text() };
        anonGetCache.set(key, e);
        if (anonGetCache.size > 300) anonGetCache.clear();
        if (env.PAGES) {
          if (epoch === '0')
            epoch = (await env.PAGES.get(PAGE_EPOCH_KEY).then((o) => o?.text()).catch(() => undefined)) ?? '0';
          const p = r2Store(env.PAGES, key, epoch, e)
            .catch((err) => console.error('r2store failed', err));
          ctx ? ctx.waitUntil(p) : await p;
        }
      }
    }
    if (req.method !== 'GET') {
      anonGetCache.clear();
      // Global invalidation: bump the epoch so every cached page is
      // unreachable; the 303'd reload renders fresh for all colos.
      if (env.PAGES) {
        const p = env.PAGES.put(PAGE_EPOCH_KEY, String(Date.now()))
          .catch((err) => console.error('epoch bump failed', err));
        ctx ? ctx.waitUntil(p) : await p;
      }
    }
    // HTML pages embed live state (footer timestamp, ticker, counts) — never
    // let the browser heuristically cache them; assets carry their own TTLs.
    if (res.headers.get('content-type')?.includes('text/html')) {
      res.headers.set('cache-control', 'no-cache');
      // Remember the chosen locale — switcher links carry ?lang=.
      const lang = new URL(req.url).searchParams.get('lang') as Lang | null;
      if (lang && (LANGS as Lang[]).includes(lang))
        res.headers.append('set-cookie',
          `lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }
    return withCors(res, env, req);
  },
  async handle(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const seg = url.pathname.split('/').filter(Boolean)
      .map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
    // Rate limit: 120 reads/min or 30 writes/min per (actor-ish key, route
    // family). Key = auth token tail, wallet header, or cf-connecting-ip.
    // /tg is exempt — bot webhook traffic isn't user spam.
    if (seg[0] !== 'tg' && seg[0] !== 'docs' && seg[0] !== 'tour' && !authed(req, env)) {
      const actorKey = (
        req.headers.get('authorization')?.slice(-12)
        ?? req.headers.get('x-actor') ?? req.headers.get('cf-connecting-ip') ?? 'anon'
      ).toLowerCase().replace(/[^a-z0-9.:-]/g, '');
      const write = req.method !== 'GET';
      // Read ceiling is generous: a judge crowd behind venue NAT shares one
      // IP — 600/min per route family keeps browsing frictionless while write
      // budgets stay tight.
      const ok = await rateLimitOk(env, `${actorKey}|${seg[0] ?? 'root'}|${write ? 'w' : 'r'}`,
        write ? 30 : 600);
      if (!ok) return err('rate limit exceeded — retry shortly', 429);
    }
    // Cheap pre-parse bound on declared size (no body read). Chunked bodies
    // with no content-length slip through, but the honest-bulk case — an
    // accidental or hostile large POST — is caught here. Authed callers get
    // the generous ceiling for evidence-pack uploads.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const len = Number(req.headers.get('content-length') ?? 0);
      const cap = authed(req, env) ? MAX_BODY : MAX_BODY_ANON;
      if (len > cap) return err(`body exceeds ${cap >> 10}KB`, 413);
    }
    try {
      // Retired surfaces → hub sections. "always" routes had no JSON form;
      // the rest redirect only for browsers (JSON stays byte-identical).
      if (req.method === 'GET' && seg.length === 1) {
        const r = RETIRED[seg[0]!];
        if (r && (r.always || (wantsHtml(req) && url.searchParams.get('format') !== 'json'))) {
          const [to, hash] = r.to.split('#') as [string, string];
          const qs = [...r.keep, 'lang']
            .map((k) => [k, url.searchParams.get(k)] as const)
            .filter((x): x is readonly [string, string] => x[1] != null)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
          return new Response(null, { status: 302,
            headers: { location: `${to}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}` } });
        }
      }
      // Frontend handoff — once WEB_FRONTEND=1, browser page requests go to
      // the springforth-web Worker (React Router SSR). JSON, POSTs, /tg,
      // /vendor, /partials and legacy assets stay here. Retired 302s above
      // already ran, so browser hits to retired slugs still redirect.
      if (env.WEB && env.WEB_FRONTEND === '1' && (req.method === 'GET' || req.method === 'HEAD')) {
        const p = url.pathname;
        const rrAsset = p.startsWith('/assets/') || p.endsWith('.data')
          || p.startsWith('/__manifest') || p === '/favicon.ico'
          || p.startsWith('/og/') || p.startsWith('/tiles/');
        const pageGet = wantsHtml(req) && url.searchParams.get('format') !== 'json'
          && req.headers.get('x-sf-ui') !== '1'
          && !p.startsWith('/vendor/') && !p.startsWith('/partials/')
          && p !== '/favicon.svg' && p !== '/og.png';
        if (rrAsset || pageGet) {
          // Service-binding responses carry immutable headers — re-wrap so the
          // outer fetch can set cache-control/lang on HTML pages.
          const r = await env.WEB.fetch(req);
          return new Response(r.body, r);
        }
      }
      // Vendored MIT assets — same-origin, no CDN at runtime.
      if (req.method === 'GET' && seg[0] === 'vendor' && seg.length === 2) {
        const cache = { 'content-type': '', 'cache-control': 'public, max-age=86400' };
        if (seg[1] === 'pico.css')
          return new Response(PICO_CSS, { headers: { ...cache, 'content-type': 'text/css' } });
        if (seg[1] === 'htmx.js')
          return new Response(HTMX_JS, { headers: { ...cache, 'content-type': 'text/javascript' } });
      }
      // GET /favicon.svg — the spark mark as the tab icon (public, cached).
      if ((req.method === 'GET' || req.method === 'HEAD') && seg[0] === 'favicon.svg') {
        return new Response(FAVICON_SVG,
          { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
      }
      // GET /og.png — the social share card (embedded PNG, generated asset)
      if (req.method === 'GET' && seg[0] === 'og.png') {
        return new Response(ogPng().buffer as ArrayBuffer, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
      }
      // GET /partials/ticker — htmx target for the landing activity ticker.
      if (req.method === 'GET' && seg[0] === 'partials' && seg[1] === 'ticker') {
        const [poss, events] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), ledgerTail(env.DB, 40),
        ]);
        const possById = new Map(poss.map((p) => [p.id, p]));
        return new Response(tickerHtml(tickerLines(events, possById),
          langFrom(url, req.headers.get('cookie'))),
          { headers: { 'content-type': 'text/html' } });
      }
      // GET / → the triage landing: how it works + what needs attention
      if (req.method === 'GET' && seg.length === 0) {
        // Ticker needs only recent events; unmetNeeds/actionNodes need only
        // need/action plannodes — full-table parses were tripping CPU limits.
        const [poss, parts, recs, nodes, plans, events] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<OverlapRecord>(env.DB, 'overlap'),
          listWhere<PlanNode>(env.DB, 'plannode', "json_extract(json,'$.kind') IN ('need','action')"),
          list<ExternalPlan>(env.DB, 'plan'), ledgerTail(env.DB, 40),
        ]);
        if (url.searchParams.get('format') === 'json')
          return json({ possibilities: poss.length, nodes: nodes.length, plans: plans.length, overlaps: recs.length });
        const rallied = new Set(recs
          .filter((r) => r.kind === 'complement' && (r.status === 'confirmed' || r.status === 'coordinated'))
          .map((r) => r.nodeIds[0]));
        const counts = new Map<string, number>();
        for (const pt of parts) counts.set(pt.possibilityId, (counts.get(pt.possibilityId) ?? 0) + 1);
        const possById = new Map(poss.map((p) => [p.id, p]));
        const completed = poss.filter((p) => p.status === 'completed').length;
        const reached = poss.filter((p) => p.quorumAt || p.status === 'completed').length;
        return page(req, renderLandingPage, {
          cards: poss.map((p) => ({ possibility: p, participants: counts.get(p.id) ?? 0 })),
          proposedOverlaps: recs.filter((r) => r.status === 'proposed').length,
          unmetNeeds: nodes.filter((n) => isNeed(n) && !rallied.has(n.id)).length,
          actionNodes: nodes.filter((n) => n.kind === 'action'),
          planCount: plans.length,
          ticker: tickerLines(events, possById),
          participantsTotal: new Set(parts.map((pt) => pt.actor)).size,
          participantInitials: [...new Set(parts.map((pt) => pt.actor))]
            .slice(0, 3).map((a) => a.trim()[0]?.toUpperCase() ?? '·'),
          placesCount: new Set(poss.map((p) => p.place).filter((x): x is string => !!x)).size,
          hoursTotal: parts.reduce((s, pt) => s + (pt.hours ?? 0), 0),
          completedCount: completed,
          quorumRate: poss.length ? Math.round((reached / poss.length) * 100) : 0,
          lang: langFrom(url, req.headers.get('cookie')),
        });
      }
      // GET /search — meaning search over every plan node (hybrid
      // lexical + embeddings). Browsers get the page; ?format=json is the
      // same payload as /nodes/search.
      if (req.method === 'GET' && seg.length === 1 && seg[0] === 'search') {
        const q = (url.searchParams.get('q') ?? '').trim();
        const results = q ? await searchNodes(env, q) : [];
        if (url.searchParams.get('format') === 'json')
          return json({ q, count: results.length, results });
        return page(req, renderSearchPage, {
          lang: langFrom(url, req.headers.get('cookie')), q,
          hits: results.map((r) => ({
            id: r.node.id, label: r.node.label, source: r.node.source,
            kind: r.node.kind, score: r.score, via: r.via,
          })),
        });
      }
      // ── Hubs — the five plain-language surfaces + the walkthrough.
      // Old top-level routes redirect here (RETIRED); their JSON forms
      // are untouched and keep serving the same payloads.
      if (req.method === 'GET' && seg.length === 1 && HUB_SEGS.has(seg[0]!)) {
        const lang = langFrom(url, req.headers.get('cookie'));
        switch (seg[0]) {
          case 'collaborate': {
            const [recs, plans, signals, nodes, poss] = await Promise.all([
              list<OverlapRecord>(env.DB, 'overlap'),
              list<ExternalPlan>(env.DB, 'plan'), list<Signal>(env.DB, 'signal'),
              list<PlanNode>(env.DB, 'plannode'),
              list<Possibility>(env.DB, 'possibility'),
            ]);
            const [commits, res] = await Promise.all([
              loadCommitments(env, url.searchParams, { nodes, overlaps: recs }),
              loadResources(env, { nodes, overlaps: recs }),
            ]);
            const network = buildNetwork(plans, poss, nodes, recs);
            // ?node=<id> — linked-evidence bundle for the focused node.
            const focusId = url.searchParams.get('node');
            const focusNode = focusId ? nodes.find((n) => n.id === focusId) : undefined;
            const focus = focusNode
              ? await nodeLinks(env, focusNode,
                { nodes, plans, overlaps: recs })
              : undefined;
            // /collaborate?q=… — the cited agent reader folded into #ask.
            // Mirrors the /agent JSON handler's computation exactly; that
            // route keeps answering JSON unchanged.
            let ask: { q: string; out?: import('./portal/index').AgentOut } | undefined;
            const q = url.searchParams.get('q');
            if (q) {
              const [parts, apps, credits] = await Promise.all([
                list<Participation>(env.DB, 'participation'),
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
                signals,
                possibilities: poss.map((p) => {
                  const mine = parts.filter((x) => x.possibilityId === p.id);
                  const qu = quorumMet(p, nodes, recs, mine.length);
                  return { id: p.id, title: p.title, status: effectiveStatus(p),
                    deadline: p.deadline, participants: mine.length,
                    minParticipants: p.minParticipants, requiredMet: qu.requiredMet,
                    required: qu.required, report: p.report };
                }),
                trust: edges,
                standing: [...new Set([...Object.keys(earnedMap),
                  ...edges.flatMap((e) => [e.from, e.to])])].map((id) => ({
                  id, earned: earnedMap[id] ?? 0,
                  trustScore: vecMean > 0 ? +((vec[id] ?? 0) / vecMean).toFixed(4) : 0,
                  assuranceCredits: credits.filter((c) => c.actor === id).length,
                })),
              });
              await ledgerAppend(env.DB, 'agent', 'agent.query',
                { q: q.slice(0, 200), intent: out.intent });
              ask = { q, out };
            }
            return page(req, renderCollaboratePage, {
              lang,
              commitments: commits.commitments,
              byCapital: commits.byCapital,
              resources: res.resources,
              overlaps: recs, nodes, plans, signals,
              nodeFocus: url.searchParams.get('node') ?? undefined,
              focus,
              network,
              overlapsAll: url.searchParams.get('overlaps') === 'all',
              page: Math.max(1, Number(url.searchParams.get('page')) || 1),
              outcomesAll: url.searchParams.get('outcomes') === 'all',
              ask,
            });
          }
          case 'fund': {
            const [rv, pledges, retro, streams, poss] = await Promise.all([
              loadRoundsView(env), list<Pledge>(env.DB, 'pledge'),
              loadRetro(env), loadStreams(env),
              list<Possibility>(env.DB, 'possibility'),
            ]);
            return page(req, renderFundPage, {
              lang,
              rounds: rv.rounds, donations: rv.dons, gates: rv.gates,
              endowment: rv.endow,
              pledges,
              retroRounds: retro.rounds, badgeholders: retro.badgeholders,
              streams: streams.streams, yieldStreams: streams.yieldStreams,
              possibilities: poss.map((p) => ({ id: p.id, title: p.title })),
            });
          }
          case 'impact': {
            const [metrics, evidence, ledger, datasets, claims, attestations, poss]
              = await Promise.all([
                loadMetrics(env), loadEvidence(env), loadLedgerSummary(env),
                loadDatasets(env),
                list<ImpactClaim>(env.DB, 'claim'),
                list<Attestation>(env.DB, 'attestation'),
                list<Possibility>(env.DB, 'possibility'),
              ]);
            return page(req, renderImpactPage, {
              lang, metrics,
              checks: evidence.checks, nodes: evidence.nodes,
              sources: evidence.sources,
              claims, attestations,
              releases: datasets.releases, slices: datasets.available,
              verify: ledger.verify, events: ledger.events,
              possibilities: poss,
            });
          }
          case 'community': {
            const [people, trust, gov, apps, seats, poss] = await Promise.all([
              loadActorsDirectory(env), loadTrust(env), loadGovernance(env),
              list<Appreciation>(env.DB, 'appreciation'),
              list<CouncilSeat>(env.DB, 'council-seat'),
              list<Possibility>(env.DB, 'possibility'),
            ]);
            const possById = new Map(poss.map((p) => [p.id, p]));
            const councils = [...new Set(seats.map((s) => s.possibilityId))]
              .flatMap((pid) => {
                const p = possById.get(pid);
                return p ? [{ possibilityId: pid, title: p.title,
                  status: effectiveStatus(p), seats: seats.filter((s) => s.possibilityId === pid)
                    .map((s) => ({ actor: s.actor, role: s.role })) }] : [];
              });
            return page(req, renderCommunityPage, {
              lang,
              people, mutual: trust.mutual,
              proposals: gov.proposals, ballots: gov.ballots,
              params: gov.params, governable: gov.governable,
              voters: gov.eligibleVoters.length,
              peopleAll: url.searchParams.get('people') === 'all',
              voices: apps.filter((a) => a.note.trim())
                .sort((x, y) => Date.parse(y.at) - Date.parse(x.at))
                .map((a) => ({ from: a.fromActor, to: a.toActor, note: a.note,
                  possibilityId: a.possibilityId, at: a.at })),
              councils,
            });
          }
          case 'how-it-works':
            return page(req, renderHowItWorksPage, lang);
        }
      }
      // Telegram bot webhook — secret-token verified, unauthenticated otherwise.
      // Commands mirror the possibility lifecycle; actors are tg:<username>.
      if (req.method === 'POST' && seg[0] === 'tg' && seg.length === 1) {
        if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET
          || !timingSafeEq(req.headers.get('x-telegram-bot-api-secret-token') ?? '', env.TELEGRAM_WEBHOOK_SECRET))
          return err('unauthorized', 401);
        try {
          await handleTelegramUpdate(env, await req.json());
        } catch (e) {
          await sendTelegram(env, env.TELEGRAM_CHAT_ID ?? '', `Bot error: ${String(e).slice(0, 200)}`).catch(() => {});
        }
        return json({ ok: true });
      }
      // Evidence manifest anchoring — sha256 manifest into the ledger,
      // pinned to IPFS when IPFS_API is configured (content-addressed
      // evidence pack, same rail as dataset releases).
      if (req.method === 'POST' && seg[0] === 'evidence' && seg[1] === 'anchor') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const { files } = await req.json() as { files: Array<{ name: string; base64: string }> };
        const m = buildManifest(files.map((f) => ({ name: f.name, bytes: Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0)) })));
        const cid = await pinToIpfs(env, 'evidence-manifest', enc(m.manifestText));
        await ledgerAppend(env.DB, 'api', 'evidence.anchored',
          { manifestDigest: m.manifestDigest, ...(cid ? { cid } : {}) });
        return json({ ...m, ...(cid ? { cid } : {}) });
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
      // Data sources registry — provenance surface. Browsers redirect
      // to /impact#evidence (RETIRED); JSON is unchanged.
      if (req.method === 'GET' && seg[0] === 'sources')
        return json({ sources: await loadSources(env) });
      // Verify — open-evidence readings rendered for review.
      if (req.method === 'GET' && seg[0] === 'verify') {
        const { checks } = await loadEvidence(env);
        return json({ checks });
      }
      // /plans + /plans/:id — the plan document lens (HTML only;
      // ?format=json and API clients keep the JSON below).
      if (req.method === 'GET' && seg[0] === 'plans' && seg.length <= 2
          && wantsHtml(req) && url.searchParams.get('format') !== 'json') {
        const lang = langFrom(url, req.headers.get('cookie'));
        const [plans, nodes, recs, checks] = await Promise.all([
          list<ExternalPlan & { nodeCount?: number }>(env.DB, 'plan'),
          list<PlanNode>(env.DB, 'plannode'),
          list<OverlapRecord>(env.DB, 'overlap'),
          list<OracleCheck>(env.DB, 'oracle-check'),
        ]);
        const srcOf = new Map(nodes.map((n) => [n.id, n.source]));
        const summarise = (p: ExternalPlan & { nodeCount?: number }) => {
          const mine = nodes.filter((n) => n.source === p.id || n.source === p.source);
          const overlaps = recs.filter((r) =>
            r.nodeIds.map((id) => srcOf.get(id)).includes(p.id)
            || r.nodeIds.map((id) => srcOf.get(id)).includes(p.source));
          const by = (k: PlanNode['kind']) => mine.filter((n) => n.kind === k).length;
          return {
            id: p.id, title: p.title, source: p.source, importedAt: p.importedAt,
            nodeCount: p.nodeCount ?? mine.length,
            outcomes: by('outcome'), actions: by('action'), indicators: by('indicator'),
            offers: by('offer'), needs: by('need'),
            overlaps: new Set(overlaps.flatMap((r) => r.nodeIds)
              .filter((id) => srcOf.get(id) !== p.id && srcOf.get(id) !== p.source)).size,
          };
        };
        if (seg.length === 1)
          return page(req, renderPlansPage, { lang, plans: plans.map(summarise) });
        const plan = plans.find((p) => p.id === seg[1]);
        if (!plan) return err('plan not found', 404);
        const summary = summarise(plan);
        const checksByNode: Record<string, { at: string; score: number }[]> = {};
        for (const c of checks)
          if (c.nodeId && !c.demo)
            (checksByNode[c.nodeId] ??= []).push({ at: c.at, score: c.score });
        return page(req, renderPlanPage, {
          lang, plan: summary,
          nodes: nodes.filter((n) => n.source === plan.id || n.source === plan.source),
          overlaps: recs.filter((r) =>
            r.nodeIds.some((id) => srcOf.get(id) === plan.id || srcOf.get(id) === plan.source)),
          checks: checksByNode,
        });
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
          await putPlanMeta(env, plan.id, plan);
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
          const { fetchPlan } = await import('./adapters/oneplanet');
          const plan = await fetchPlan(
            env.ONEPLANET_URL ?? 'https://mcp.oneplanet.com/mcp',
            env.ONEPLANET_API_KEY, planId);
          await putPlanMeta(env, plan.id, plan);
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
      // OnePlanet write lane — the bound key exposes create_* tools, so
      // Springforth graph nodes publish into a plan in the workspace as
      // OAIs, and oracle-style readings write back as progress units.
      //   GET  /oneplanet/status        — ping + connected workspaces
      //   GET  /oneplanet/plans         — plans in the bound workspace
      //   GET  /oneplanet/plans/:uuid   — plan summary (?report=1 adds the
      //                                   full recorded-material report)
      //   GET  /oneplanet/oais/:uuid    — OAI + attachments + progress
      //                                   (?planUuid= required)
      //   GET  /oneplanet/find?q=&kind= — plan|oai name resolution
      //   GET  /oneplanet/search?q=&scope= — plan|content|knowledge
      //   POST /oneplanet/publish       — plannodes → OAIs (idempotent)
      //   POST /oneplanet/report        — attachments: progress |
      //                                   guidance | case_study | story |
      //                                   chart | monitoring
      //   POST /oneplanet/update        — OAI name/desc/status/dueDate
      //   POST /oneplanet/pull          — read back: OAIs → oneplanet-oai
      //                                   rows; progress on pushed OAIs →
      //                                   oracle-checks on our nodes
      //   POST /oneplanet/tool          — {tool,args} passthrough (full
      //                                   surface, allowlisted)
      if (seg[0] === 'oneplanet') {
        if (!authed(req, env)) return err('unauthorized', 401);
        if (!env.ONEPLANET_API_KEY)
          return err('ONEPLANET_API_KEY not configured', 503);
        const opUrl = env.ONEPLANET_URL ?? 'https://mcp.oneplanet.com/mcp';
        const { opTool, listPlans, pushPlanNodes, updateOai, attachToOai,
          pullOai, OP_TOOLS } =
          await import('./adapters/oneplanet');
        if (req.method === 'GET' && seg[1] === 'status')
          return json({
            ping: await opTool(opUrl, env.ONEPLANET_API_KEY, 'ping'),
            connections: await opTool(opUrl, env.ONEPLANET_API_KEY,
              'list_connections').catch(() => null),
          });
        if (req.method === 'GET' && seg[1] === 'plans' && !seg[2])
          return json(await listPlans(opUrl, env.ONEPLANET_API_KEY));
        if (req.method === 'GET' && seg[1] === 'plans' && seg[2])
          return json({
            summary: await opTool(opUrl, env.ONEPLANET_API_KEY,
              'get_plan_summary', { plan_uuid: seg[2] }),
            ...(url.searchParams.get('report') ? {
              report: await opTool(opUrl, env.ONEPLANET_API_KEY,
                'get_plan_report', { plan_uuid: seg[2] }) } : {}),
          });
        if (req.method === 'GET' && seg[1] === 'oais' && seg[2]) {
          const planUuid = url.searchParams.get('planUuid');
          if (!planUuid) return err('planUuid query param required', 400);
          return json(await pullOai(opUrl, env.ONEPLANET_API_KEY,
            planUuid, seg[2]));
        }
        if (req.method === 'GET' && seg[1] === 'find') {
          const q = url.searchParams.get('q') ?? '';
          const kind = url.searchParams.get('kind') ?? 'oai';
          const planUuid = url.searchParams.get('planUuid') ?? undefined;
          return json(await opTool(opUrl, env.ONEPLANET_API_KEY,
            kind === 'plan' ? 'find_plan' : 'find_oai',
            { query: q, ...(planUuid ? { plan_uuid: planUuid } : {}) }));
        }
        if (req.method === 'GET' && seg[1] === 'search') {
          const q = url.searchParams.get('q') ?? '';
          const scope = url.searchParams.get('scope') ?? 'plan';
          const tool = { plan: 'search_plan_content', content: 'search_content',
            knowledge: 'search_knowledge' }[scope] ?? 'search_plan_content';
          const planUuid = url.searchParams.get('planUuid') ?? undefined;
          return json(await opTool(opUrl, env.ONEPLANET_API_KEY, tool,
            { query: q, ...(planUuid ? { plan_uuid: planUuid } : {}) }));
        }
        if (req.method === 'POST' && seg[1] === 'tool') {
          const body = await req.json().catch(() => ({})) as
            { tool?: string; args?: Record<string, unknown> };
          if (!body.tool || !OP_TOOLS.has(body.tool))
            return err(`tool must be one of: ${[...OP_TOOLS].join(', ')}`, 422);
          return json(await opTool(opUrl, env.ONEPLANET_API_KEY,
            body.tool, body.args ?? {}));
        }
        if (req.method === 'POST' && seg[1] === 'update') {
          const body = await req.json().catch(() => ({})) as {
            nodeId?: string; oaiUuid?: string; planUuid?: string;
            kind?: 'outcome' | 'action' | 'indicator';
            name?: string; description?: string;
            status?: string; dueDate?: string;
          };
          const pushedRow = body.nodeId
            ? await get<{ oaiUuid: string; planUuid: string; tool?: string }>(
                env.DB, 'oneplanet-push', `op-${body.nodeId}`)
            : null;
          const oaiUuid = body.oaiUuid ?? pushedRow?.oaiUuid;
          const planUuid = body.planUuid ?? pushedRow?.planUuid;
          if (!oaiUuid || !planUuid)
            return err('oaiUuid + planUuid required (or a pushed nodeId)', 400);
          const kind = body.kind
            ?? ({ create_outcome: 'outcome', create_indicator: 'indicator',
              create_action: 'action' } as const)[pushedRow?.tool ?? '']
            ?? 'action';
          const r = await updateOai(opUrl, env.ONEPLANET_API_KEY,
            planUuid, oaiUuid, kind,
            { name: body.name, description: body.description,
              status: body.status, dueDate: body.dueDate });
          await ledgerAppend(env.DB, 'api', 'oneplanet.updated',
            { oaiUuid, planUuid, nodeId: body.nodeId, kind });
          return json({ ok: true, oaiUuid, result: r }, 201);
        }
        if (req.method === 'POST' && seg[1] === 'pull') {
          const body = await req.json().catch(() => ({})) as {
            planUuid?: string; store?: boolean; maxOais?: number;
          };
          if (!body.planUuid) return err('planUuid required', 400);
          const oais = await opTool(opUrl, env.ONEPLANET_API_KEY,
            'query_plan_oais', { plan_uuid: body.planUuid, limit: 100 }) as { items?: { uuid?: string; name?: string; label?: string }[] };
          const items = oais?.items ?? [];
          const pushed = await listWhere<{
            nodeId: string; oaiUuid: string; planUuid: string;
          }>(env.DB, 'oneplanet-push', 'id LIKE ?', 'op-%');
          const byOai = new Map(
            pushed.filter((p) => p.planUuid === body.planUuid)
              .map((p) => [p.oaiUuid, p.nodeId]));
          if (!body.store)
            return json({ planUuid: body.planUuid, oais: items.length,
              linked: byOai.size, items: items.slice(0, 50) });
          let checks = 0, failed = 0, stored = 0;
          const started = Date.now();
          const maxOais = Math.min(Math.max(body.maxOais ?? 30, 1), 100);
          for (const it of items.slice(0, maxOais)) {
            // pullOai retries once after retryAfterSeconds, but a pull can
            // still be long under their ~1/s limit — bail past 4min and
            // let the caller re-run (stores are idempotent).
            if (Date.now() - started > 240_000) { failed++; continue; }
            const data = await pullOai(opUrl, env.ONEPLANET_API_KEY,
              body.planUuid, String(it.uuid));
            const errored = (data.oai as { error?: string })?.error
              && (data.additional as { error?: string })?.error;
            if (errored) { failed++; continue; }
            await put(env.DB, 'oneplanet-oai', `opo-${it.uuid}`,
              { planUuid: body.planUuid, nodeId: byOai.get(String(it.uuid)),
                ...data });
            stored++;
            const nodeId = byOai.get(String(it.uuid));
            // MCP surface rate-limits hard — pace the per-OAI reads so a
            // pull doesn't degrade to error rows.
            await new Promise((r) => setTimeout(r, 1200));
            if (!nodeId) continue;
            const prog = data.progress as { items?: unknown[] } | undefined;
            const n = Array.isArray(prog?.items) ? prog!.items.length : 0;
            if (!n) continue;
            const check = OracleCheck.parse({
              id: `opc-${it.uuid}-${n}`,
              nodeId, source: 'connector', domain: 'social',
              methodologyRef: 'oneplanet:progress-units',
              result: 'pending',
              score: Math.min(n / 10, 1),
              detail: `${n} self-reported progress unit(s) on OnePlanet OAI ${it.uuid} — source-reported, not independently verified`,
              at: new Date().toISOString(),
            });
            await put(env.DB, 'oracle-check', check.id, check);
            checks++;
          }
          await ledgerAppend(env.DB, 'api', 'oneplanet.pulled',
            { planUuid: body.planUuid, oais: items.length, checks, failed });
          return json({ planUuid: body.planUuid, oais: items.length,
            stored, failed, oracleChecks: checks }, 201);
        }
        if (req.method === 'POST' && seg[1] === 'publish') {
          const body = await req.json().catch(() => ({})) as {
            planUuid?: string; planId?: string; nodeIds?: string[];
            maxNodes?: number; dryRun?: boolean;
          };
          if (!body.planUuid) return err('planUuid (target OnePlanet plan) required', 400);
          let nodes: PlanNode[] = [];
          if (body.nodeIds?.length) {
            for (const id of body.nodeIds) {
              const n = await get<PlanNode>(env.DB, 'plannode', id);
              if (n) nodes.push(n);
            }
          } else if (body.planId) {
            const plan = await get<ExternalPlan & { nodeCount?: number }>(
              env.DB, 'plan', body.planId);
            if (!plan) return err('plan not found', 404);
            nodes = await listWhere<PlanNode>(
              env.DB, 'plannode', "json_extract(json,'$.source') = ?", plan.source);
          } else return err('planId or nodeIds required', 400);
          // Idempotent: oneplanet-push rows remember nodeId → oaiUuid.
          const prior = await listWhere<{ nodeId: string }>(
            env.DB, 'oneplanet-push', 'id LIKE ?', 'op-%');
          const done = new Set(prior.map((p) => p.nodeId));
          const todo = nodes.filter((n) => !done.has(n.id));
          const maxNodes = Math.min(Math.max(body.maxNodes ?? 25, 1), 200);
          const batch = todo.slice(0, maxNodes);
          if (body.dryRun)
            return json({ targetPlanUuid: body.planUuid, total: nodes.length,
              alreadyPushed: done.size, wouldPush: batch.map((n) => n.id) });
          const results = await pushPlanNodes(
            opUrl, env.ONEPLANET_API_KEY, body.planUuid, batch, { maxNodes });
          const pushedOk = results.filter((r) => r.oaiUuid);
          await putManyIfChanged(env.DB, 'oneplanet-push', pushedOk.map((r) => ({
            id: `op-${r.nodeId}`,
            obj: { nodeId: r.nodeId, oaiUuid: r.oaiUuid,
              planUuid: body.planUuid, tool: r.tool,
              at: new Date().toISOString() },
          })));
          const errors = results.filter((r) => r.error);
          await ledgerAppend(env.DB, 'api', 'oneplanet.pushed', {
            planUuid: body.planUuid, pushed: pushedOk.length,
            skipped: results.filter((r) => r.skipped).length,
            errors: errors.length, remaining: todo.length - batch.length,
          });
          return json({ pushed: pushedOk.length, skipped: results.length
            - pushedOk.length - errors.length, errors, results,
            remaining: todo.length - batch.length },
            todo.length - batch.length > 0 ? 202 : 201);
        }
        // report — attachments onto an OAI. `type` picks the create_*
        // tool: progress (default), guidance, case_study, story, chart,
        // monitoring. oaiUuid/planUuid resolve from push provenance when
        // nodeId is given.
        if (req.method === 'POST' && seg[1] === 'report') {
          const body = await req.json().catch(() => ({})) as {
            nodeId?: string; oaiUuid?: string; planUuid?: string;
            type?: 'progress' | 'guidance' | 'case_study' | 'story'
              | 'chart' | 'monitoring';
            value?: string; note?: string; title?: string;
            description?: string; date?: string; url?: string;
            units?: string; target?: string; targetDate?: string;
            benchmark?: string;
          };
          const pushedRow = body.nodeId
            ? await get<{ oaiUuid: string; planUuid: string }>(
                env.DB, 'oneplanet-push', `op-${body.nodeId}`)
            : null;
          const oaiUuid = body.oaiUuid ?? pushedRow?.oaiUuid;
          const planUuid = body.planUuid ?? pushedRow?.planUuid;
          if (!oaiUuid || !planUuid)
            return err('oaiUuid + planUuid required (or a pushed nodeId)', 400);
          const type = body.type ?? 'progress';
          if (type === 'progress' && body.value == null)
            return err('value required for progress units', 400);
          const r = await attachToOai(opUrl, env.ONEPLANET_API_KEY,
            planUuid, oaiUuid, type, body);
          await ledgerAppend(env.DB, 'api', 'oneplanet.reported',
            { oaiUuid, planUuid, nodeId: body.nodeId, type,
              value: body.value });
          return json({ ok: true, oaiUuid, type, result: r }, 201);
        }
        return err('unknown oneplanet route', 404);
      }
      // Plan nodes — read + human correction. Ingest is imperfect by
      // nature; corrections are first-class, attributed, and logged to the
      // audit ledger with a before/after diff — the fix is visible, the
      // extraction trail is never silently rewritten.
      if (seg[0] === 'nodes') {
        // GET /nodes/search?q= — hybrid meaning search: minisearch lexical
        // ∪ cosine over stored embeddings. OnePlanet's search matches by
        // meaning; this one does too — and it's verifiable (every result
        // is a real stored node with provenance).
        if (seg[1] === 'search' && req.method === 'GET') {
          const q = (url.searchParams.get('q') ?? '').trim();
          if (!q) return json({ results: [] });
          const results = await searchNodes(env, q);
          return json({ q, count: results.length, results });
        }
        const node = await get<PlanNode>(env.DB, 'plannode', seg[1] ?? '');
        if (!node) return err('node not found', 404);
        if (req.method === 'GET' && seg.length === 2) {
          // ?links=1 — the node plus its linked evidence bundle
          // (plan, parent, children, oracle checks, credits, overlaps).
          if (url.searchParams.get('links'))
            return json({ ...node, links: await nodeLinks(env, node) });
          return json(node);
        }
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
            ? new Response(null, { status: 303, headers: { location: '/collaborate#overlaps' } })
            : json({ node: corrected, diff });
        }
      }
      // Embed all plannodes lacking vectors — batch via Workers AI,
      // one ledger event per run. Idempotent: skips already-embedded nodes.
      if (req.method === 'POST' && seg[0] === 'embeddings' && seg[1] === 'build') {
        if (!authed(req, env)) return err('unauthorized', 401);
        if (!env.AI) return err('Workers AI binding not configured', 503);
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const have = await loadEmbeddings(env.DB);
        const todo = nodes.filter((n) => !have.has(n.id));
        let done = 0;
        for (let i = 0; i < todo.length; i += EMB_BATCH) {
          const batch = todo.slice(i, i + EMB_BATCH);
          const vecs = await embedTexts(env, batch.map(nodeText));
          for (const [j, n] of batch.entries()) {
            if (!vecs[j]) continue;
            await put(env.DB, 'embedding', `emb:${n.id}`,
              { id: `emb:${n.id}`, nodeId: n.id, vec: vecs[j], model: EMB_MODEL });
            done++;
          }
        }
        await ledgerAppend(env.DB, 'api', 'embeddings.built',
          { nodes: done, skipped: nodes.length - todo.length, model: EMB_MODEL });
        return json({ embedded: done, total: nodes.length, skipped: nodes.length - todo.length });
      }
      // Overlap detection over every stored plannode; stores new records,
      // preserves existing validation state on re-runs.
      if (req.method === 'POST' && seg[0] === 'overlaps' && seg[1] === 'detect') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const emb = await loadEmbeddings(env.DB);
        const detected = [
          ...detectOverlaps(nodes, { scorer: embeddingScorer(emb) }),
          ...detectComplements(nodes),           // need × offer direction
        ];
        const retired = await persistDetectedOverlaps(env, detected);
        await ledgerAppend(env.DB, 'api', 'overlaps.detected', {
          nodes: nodes.length, found: detected.length, retired,
          complements: detected.filter((r) => r.kind === 'complement').length,
        });
        return json({ scanned: nodes.length, overlaps: detected.length, retired, records: detected });
      }
      // Treegens evidence sync — pull filmed/AI-counted/DAO-verified
      // planting records (live + field-team archive), upsert nodes, re-run
      // detection. Feeds are public; statuses stay verbatim as tags.
      if (req.method === 'POST' && seg[0] === 'treegens' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const plans = await fetchTreegens();
        const nodes = [...plans.live.nodes, ...plans.archive.nodes];
        for (const plan of [plans.live, plans.archive])
          await putPlanMeta(env, plan.id, plan);
        const { detected, retired } =
          await syncDetect(env, nodes, { excludePrefix: 'treegens-' });
        await ledgerAppend(env.DB, 'api', 'treegens.synced', {
          records: plans.live.nodes.length + plans.archive.nodes.length,
          plans: [plans.live.id, plans.archive.id], overlaps: detected.length, retired,
        });
        return json({
          live: plans.live.nodes.length, archive: plans.archive.nodes.length,
          overlaps: detected.length,
        }, 201);
      }
      // Silvi sync — pull verified reforestation into the plan graph.
      // Keys are scope-issued: campaign keys read /campaigns/:id/claims/
      // (SILVI_CAMPAIGN_ID), project keys read /projects/:id/
      // (SILVI_PROJECT_ID); ad-hoc {campaignId|projectId, apiKey} allowed.
      if (req.method === 'POST' && seg[0] === 'silvi' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as {
          campaignId?: string; projectId?: string; apiKey?: string;
          maxPages?: number; reviewStatus?: string;
        };
        const apiKey = body.apiKey ?? env.SILVI_API_KEY;
        const campaignId = body.campaignId ?? env.SILVI_CAMPAIGN_ID;
        const projectId = body.projectId ?? env.SILVI_PROJECT_ID;
        if (campaignId) {
          // Resumable claim import: campaigns run to five-figure claim
          // counts, so each call pages ≤ maxPages (500/page) and persists
          // an `after` cursor — repeat until partial:false. Each upstream
          // page lands as ONE packed `silvi-claim-pg` entity verbatim (GPS,
          // species, photos, Celo payout proofs); on completion they
          // cluster into `silvi-cluster` entities + plan-graph nodes.
          const campaign = await fetchSilviCampaign(campaignId, env.SILVI_API_URL, apiKey);
          if (!campaign)
            return err(`silvi api unreachable or key invalid for campaign ${campaignId} — ${silviLastError() || 'bad payload'}`, 502);
          const cursorId = `c${campaignId}`;
          const prev = await get<{ after?: number | null; done?: boolean; pages?: number }>(
            env.DB, 'silvi-sync', cursorId);
          let after = prev?.done ? undefined : prev?.after ?? undefined;
          let pageSeq = prev?.done ? 0 : prev?.pages ?? 0;
          const maxPages = Math.min(Math.max(body.maxPages ?? 10, 1), 40);
          let pages = 0, fetched = 0, done = false;
          // Persist per page — a mid-call worker kill still leaves claims
          // stored and the cursor advanced, so the next call resumes.
          while (pages < maxPages) {
            let page = null;
            for (let attempt = 0; attempt < 3 && !page; attempt++)
              page = await fetchSilviClaims(campaignId,
                { after, limit: 500, reviewStatus: body.reviewStatus },
                env.SILVI_API_URL, apiKey);
            if (!page) break;               // upstream hiccup — cursor resumes
            pages++;
            fetched += page.claims.length;
            await putPackedPage(env.DB, 'silvi-claim-pg',
              `scpg${campaignId}-${String(pageSeq).padStart(4, '0')}`, page.claims);
            pageSeq++;
            if (page.nextAfter == null) { done = true; break; }
            after = page.nextAfter;
            await put(env.DB, 'silvi-sync', cursorId,
              { after, done: false, pages: pageSeq });
          }
          await put(env.DB, 'silvi-sync', cursorId,
            { after: after ?? null, done, pages: pageSeq });
          if (!done)
            return json({ campaign: campaign.title, partial: true, fetched, pages,
              upstream: silviLastError() || null,
              resume: { campaignId, after } }, 202);
          // Finalize — rebuild claim clusters + plan nodes from stored
          // claims (legacy per-claim rows + packed pages, deduped).
          const seenClaims = new Set<string>();
          const claims = [
            ...(await listWhere<SilviClaim>(
              env.DB, 'silvi-claim', 'id LIKE ?', `sc${campaignId}-%`)),
            ...(await listPacked<SilviClaim>(
              env.DB, 'silvi-claim-pg', `scpg${campaignId}-%`)),
          ].filter((c) => !seenClaims.has(String(c.id)) && !!seenClaims.add(String(c.id)));
          const clusters = clusterSilviClaims(claims);
          await putManyIfChanged(env.DB, 'silvi-cluster', clusters.map((c) => ({
            id: `scl${campaignId}-${c.key}`, obj: { campaignId, ...c },
          })));
          const plan = fromSilviClusters(campaign, clusters, claims.length, 'silvi:app');
          await putPlanMeta(env, plan.id, plan);
          const { detected } = await syncDetect(env, plan.nodes,
            { retirePrefix: `silvi-c${campaignId}-`, excludePrefix: 'silvi-' });
          await ledgerAppend(env.DB, 'api', 'silvi.synced', {
            campaign: campaign.id, claims: claims.length,
            clusters: clusters.length, nodes: plan.nodes.length,
            overlaps: detected.length,
          });
          return json({ campaign: campaign.title, claims: claims.length,
            clusters: clusters.length, nodes: plan.nodes.length,
            overlaps: detected.length }, 201);
        }
        if (!projectId)
          return err('SILVI_CAMPAIGN_ID/SILVI_PROJECT_ID unset — pass {campaignId|projectId} (and apiKey if not in secrets)', 400);
        const project = await fetchSilviProject(projectId, env.SILVI_API_URL, apiKey);
        if (!project)
          return err(`silvi api unreachable or key invalid for project ${projectId}`, 502);
        const plan = fromSilviProjects([project], 'silvi:app');
        await putPlanMeta(env, `${plan.id}-${project.id}`, plan, `Silvi — ${project.name}`);
        const { detected } = await syncDetect(env, plan.nodes, { excludePrefix: 'silvi-' });
        await ledgerAppend(env.DB, 'api', 'silvi.synced', {
          project: project.id, nodes: plan.nodes.length, overlaps: detected.length,
        });
        return json({ project: project.name, nodes: plan.nodes.length, overlaps: detected.length }, 201);
      }
      // Soulutions sync — regenerative-impact marketplace (34 live
      // projects, ~5 pages). Listing payloads carry the live funding
      // milestone — mapped verbatim (goal − raised = need budget).
      if (req.method === 'POST' && seg[0] === 'soulutions' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as { maxPages?: number };
        const projects = await fetchSoulutionsProjects(
          { maxPages: body.maxPages ?? 20 });
        if (!projects)
          return err(`soulutions unreachable — ${soulutionsLastError() || 'bad payload'}`, 502);
        const plan = fromSoulutionsProjects(projects, 'soulutions:web');
        await putPlanMeta(env, plan.id, plan);
        const { detected, retired } = await syncDetect(env, plan.nodes, { prefix: 'sol-' });
        await ledgerAppend(env.DB, 'api', 'soulutions.synced', {
          projects: projects.length, nodes: plan.nodes.length,
          overlaps: detected.length, retired,
        });
        return json({ projects: projects.length, nodes: plan.nodes.length,
          overlaps: detected.length, retired }, 201);
      }
      // Giveth sync — public GraphQL. Two modes:
      //   backfill — pages allProjects (CreationDate ASC), persists
      //     `giveth-project` raw + plan nodes per page; resumable `skip`.
      //   sweep    — donations + QF rounds for projects already imported;
      //     bounded by maxProjects/maxPages; Donation entities land as
      //     settled rows, QF rounds as FundingRound entities.
      if (req.method === 'POST' && seg[0] === 'giveth' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as {
          mode?: 'backfill' | 'sweep'; skip?: number; take?: number;
          maxPages?: number; maxProjects?: number;
        };
        const baseUrl = env.GIVETH_API ?? undefined;
        if ((body.mode ?? 'backfill') === 'backfill') {
          const cursorId = 'giveth';
          const prev = await get<{ skip?: number; done?: boolean }>(
            env.DB, 'giveth-sync', cursorId);
          let skip = prev?.done ? 0 : (body.skip ?? prev?.skip ?? 0);
          const take = Math.min(Math.max(body.take ?? 50, 1), 50);
          const maxPages = Math.min(Math.max(body.maxPages ?? 10, 1), 40);
          // Active round membership decides which projects yield need nodes.
          const rounds = await fetchGivethQfRounds(fetch, baseUrl);
          const activeQfIds = new Set(
            (rounds ?? []).filter((r) => r.isActive).map((r) => r.id));
          let pages = 0, fetched = 0, done = false, totalCount = 0;
          const callNodes: PlanNode[] = [];
          while (pages < maxPages) {
            let page = null;
            for (let a = 0; a < 3 && !page; a++)
              page = await fetchGivethProjects({ skip, take }, fetch, baseUrl);
            if (!page) break;
            pages++;
            fetched += page.projects.length;
            totalCount = page.totalCount;
            await putPackedPage(env.DB, 'giveth-project-pg',
              `gpp-${String(skip).padStart(6, '0')}`, page.projects);
            // Fold this page into the plan graph right away.
            const part = fromGivethProjects(page.projects, activeQfIds, 'giveth:graphql');
            await putManyIfChanged(env.DB, 'plannode',
              part.nodes.map((n) => ({ id: n.id, obj: n })));
            callNodes.push(...part.nodes);
            skip += page.projects.length;
            await put(env.DB, 'giveth-sync', cursorId,
              { skip, done: false, totalCount });
            if (!page.projects.length || skip >= page.totalCount) { done = true; break; }
          }
          await put(env.DB, 'giveth-sync', cursorId, { skip, done, totalCount });
          // Incremental overlap pass over this call's nodes — bounded, so
          // each resumable page-batch stays under the CPU cap; the local
          // backfill script runs the unbounded corpus pass. Same-source
          // pairs are skipped inside detection, so the existing giveth-*
          // corpus is excluded from the candidate pool entirely.
          if (callNodes.length)
            await syncDetect(env, callNodes, { excludePrefix: 'giveth-', skipPut: true });
          if (!done)
            return json({ partial: true, fetched, pages, skip, totalCount,
              upstream: givethLastError() || null }, 202);
          // Register the plan entity once the corpus is in.
          const allNodes = await listWhere<PlanNode>(
            env.DB, 'plannode', 'id LIKE ?', 'giveth-%');
          await put(env.DB, 'plan', 'plan-giveth', {
            id: 'plan-giveth', source: 'giveth:graphql',
            title: 'Giveth — public goods funding projects',
            owner: 'giveth', importedAt: new Date().toISOString(),
            nodeCount: allNodes.length,
          });
          await ledgerAppend(env.DB, 'api', 'giveth.synced', {
            projects: totalCount, nodes: allNodes.length,
            mode: 'backfill',
          });
          return json({ done: true, projects: totalCount,
            nodes: allNodes.length }, 201);
        }
        // sweep — donations + QF rounds for imported projects, bounded.
        const maxProjects = Math.min(Math.max(body.maxProjects ?? 25, 1), 100);
        const maxPages = Math.min(Math.max(body.maxPages ?? 4, 1), 20);
        // Relations live on the stored project objects — legacy per-row
        // `giveth-project` + packed `giveth-project-pg` pages, deduped.
        const seenG = new Set<string>();
        const stored = [
          ...(await listWhere<{
            id: string; projectQfRoundRelations?: { qfRoundId?: string | number | null }[];
          }>(env.DB, 'giveth-project', 'id LIKE ?', 'gp-%')),
          ...(await listPacked<{
            id: string; projectQfRoundRelations?: { qfRoundId?: string | number | null }[];
          }>(env.DB, 'giveth-project-pg', 'gpp-%')),
        ].filter((p) => !seenG.has(String(p.id)) && !!seenG.add(String(p.id)));
        const projects = stored.slice(0, maxProjects);
        const rounds = await fetchGivethQfRounds(fetch, baseUrl) ?? [];
        const relByRound = new Map<string, string[]>();
        for (const p of stored)
          for (const r of p.projectQfRoundRelations ?? []) {
            if (r.qfRoundId == null) continue;
            const k = String(r.qfRoundId);
            relByRound.set(k, [...(relByRound.get(k) ?? []), givethNeedId(String(p.id))]);
          }
        const fundingRounds = toFundingRounds(rounds, relByRound);
        // The standing pseudo-round for non-QF direct donations.
        fundingRounds.push({
          id: 'round-giveth-direct', title: 'Giveth — direct donations',
          description: 'Direct project donations on Giveth (outside QF rounds)',
          sponsorIds: ['giveth'],
          matchingFund: { amount: 0, currency: 'USD' },
          eligibleNeedIds: [], opensAt: new Date(0).toISOString(),
          closesAt: new Date(0).toISOString(), state: 'allocated',
          matchingMode: 'lr', conviction: false,
          acceptedTokens: {}, endowment: false, chainRef: 'giveth:direct',
        });
        await putManyIfChanged(env.DB, 'funding-round',
          fundingRounds.map((r) => ({ id: r.id, obj: r })));
        let donations = 0, pages = 0;
        for (const p of projects) {
          let skip = 0;
          for (let pg = 0; pg < maxPages; pg++) {
            const d = await fetchGivethDonations(p.id, { skip, take: 50 }, fetch, baseUrl);
            if (!d || !d.donations.length) break;
            const entities = toDonations(d.donations, p.id);
            await putManyIfChanged(env.DB, 'donation',
              entities.map((e) => ({ id: e.id, obj: e })));
            donations += entities.length; pages++;
            skip += d.donations.length;
            if (skip >= d.totalCount) break;
          }
        }
        await ledgerAppend(env.DB, 'api', 'giveth.synced', {
          mode: 'sweep', projects: projects.length, donations,
          rounds: fundingRounds.length, pages,
        });
        return json({ mode: 'sweep', projects: projects.length, donations,
          rounds: fundingRounds.length }, 201);
      }
      // Karma GAP sync — on-chain grant attestations. Projects page at
      // 10/page; grants ride embedded; milestones → oracle checks;
      // endorsements → raw rows (never trust edges).
      if (req.method === 'POST' && seg[0] === 'gap' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as { maxPages?: number };
        const projects = await fetchGapProjects({ maxPages: body.maxPages ?? 45 });
        if (!projects)
          return err(`gap api unreachable — ${gapLastError() || 'bad payload'}`, 502);
        const plan = fromGapProjects(projects, 'gap:api');
        await putPlanMeta(env, plan.id, plan);
        const checks = toGapChecks(projects);
        await putManyIfChanged(env.DB, 'oracle-check', checks.map((c) => ({ id: c.id, obj: c })));
        const endorses = toGapEndorsements(projects);
        await putManyIfChanged(env.DB, 'gap-endorsement', endorses.map((e) => ({ id: e.id, obj: e })));
        const { detected, retired } = await syncDetect(env, plan.nodes, { prefix: 'gap-' });
        await ledgerAppend(env.DB, 'api', 'gap.synced', {
          projects: projects.length, nodes: plan.nodes.length,
          checks: checks.length, overlaps: detected.length, retired,
        });
        return json({ projects: projects.length, nodes: plan.nodes.length,
          checks: checks.length, overlaps: detected.length, retired }, 201);
      }
      // Restor sync — public sitemap enumeration + per-site RSC hydrate.
      //   enumerate — walk /sitemaps/sites/{i}/sitemap.xml by cursor,
      //     persist {id,lastmod} to `restor-sitemap` rows.
      //   hydrate   — fetch ≤maxSites site pages (newest lastmod first),
      //     extract the RSC-embedded record, persist `restor-site` +
      //     plan nodes; advances the hydrate cursor so calls are cheap.
      if (req.method === 'POST' && seg[0] === 'restor' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as {
          phase?: 'enumerate' | 'hydrate';
          maxSitemaps?: number; maxSites?: number;
        };
        const baseUrl = env.RESTOR_URL ?? undefined;
        if ((body.phase ?? 'enumerate') === 'enumerate') {
          const prev = await get<{ index?: number; done?: boolean }>(
            env.DB, 'restor-sync', 'enumerate');
          let index = prev?.done ? 0 : prev?.index ?? 0;
          const maxSitemaps = Math.min(Math.max(body.maxSitemaps ?? 20, 1), 60);
          let done = false, indexed = 0;
          for (let i = 0; i < maxSitemaps; i++) {
            const entries = await fetchRestorSitemap(index, fetch, baseUrl);
            if (!entries) break;                        // transient — resume
            if (!entries.length) { done = true; break; } // 404 = end of index
            await putPackedPage(env.DB, 'restor-sitemap-pg',
              `rsp-${String(index).padStart(4, '0')}`,
              entries.map((e) => ({ id: e.id, lastmod: e.lastmod })));
            indexed += entries.length; index++;
            await put(env.DB, 'restor-sync', 'enumerate', { index, done: false });
          }
          await put(env.DB, 'restor-sync', 'enumerate', { index, done });
          return json({ phase: 'enumerate', indexed, index, done,
            upstream: restorLastError() || null }, done ? 201 : 202);
        }
        // hydrate — newest lastmod first; advances a position cursor.
        // The index merges packed `restor-sitemap-pg` pages with legacy
        // per-entry `restor-sitemap` rows (read via SQL projection), then
        // sorts in-memory — packed pages can't be ORDER BY'd in SQL.
        const maxSites = Math.min(Math.max(body.maxSites ?? 200, 1), 500);
        const prev = await get<{ offset?: number }>(env.DB, 'restor-sync', 'hydrate');
        const offset = prev?.offset ?? 0;
        const packedIdx = await listPacked<{ id: string; lastmod: string | null }>(
          env.DB, 'restor-sitemap-pg', 'rsp-%');
        const legacyIdx = (await env.DB.prepare(
          `SELECT json_extract(json,'$.id') AS id,
                  json_extract(json,'$.lastmod') AS lastmod
           FROM entities WHERE kind='restor-sitemap'`)
          .all<{ id: string | null; lastmod: string | null }>()).results ?? [];
        const seenS = new Set<string>();
        const index = [...packedIdx, ...legacyIdx]
          .filter((r): r is { id: string; lastmod: string | null } => r.id != null)
          .filter((r) => !seenS.has(r.id) && !!seenS.add(r.id))
          .sort((a, b) => (b.lastmod ?? '').localeCompare(a.lastmod ?? '')
            || a.id.localeCompare(b.id));
        const total = index.length;
        const batch = index.slice(offset, offset + maxSites);
        const sites: RestorSite[] = [];
        for (const row of batch) {
          const r = await fetchRestorSite(row.id, fetch, baseUrl);
          if (r) sites.push(r.site);
        }
        let overlaps = 0;
        if (sites.length) {
          const plan = fromRestorSites(sites, 'restor:web');
          await putManyIfChanged(env.DB, 'restor-site', sites.map((s) => ({
            id: `rst-${s.id}`,
            obj: { ...s, centroid: restorCentroid(s) },
          })));
          await putManyIfChanged(env.DB, 'plannode',
            plan.nodes.map((n) => ({ id: n.id, obj: n })));
          await put(env.DB, 'plan', 'plan-restor', {
            id: 'plan-restor', source: 'restor:web',
            title: 'Restor — restoration sites', owner: 'restor',
            importedAt: new Date().toISOString(),
            nodeCount: (await listWhere<PlanNode>(env.DB, 'plannode', 'id LIKE ?', 'restor-%')).length,
          });
          // Bounded incremental detection — restor-* peers are skipped
          // same-source anyway, so they're excluded from the pool too.
          const { detected } = await syncDetect(env, plan.nodes,
            { excludePrefix: 'restor-', skipPut: true });
          overlaps = detected.length;
        }
        const next = offset + batch.length;
        const done = next >= total;
        await put(env.DB, 'restor-sync', 'hydrate', { offset: next, done });
        return json({ phase: 'hydrate', hydrated: sites.length,
          attempted: batch.length, offset: next, done, overlaps,
          upstream: restorLastError() || null }, done ? 201 : 202);
      }
      // OpenCollective sync — public GraphQL v2 discovery + orders.
      //   accounts — paged `accounts` search (env OC_SEARCH_TERMS or the
      //     public-goods default), stores `oc-collective` + nodes.
      //   orders   — PAID orders for imported collectives → Donation
      //     entities (settled, settlementRef oc:<orderId>); bounded.
      if (req.method === 'POST' && seg[0] === 'oc' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as {
          phase?: 'accounts' | 'orders'; maxPages?: number; maxCollectives?: number;
          searchTerm?: string; reset?: boolean;
        };
        const terms = (env.OC_SEARCH_TERMS ?? 'public goods')
          .split(',').map((t: string) => t.trim()).filter(Boolean);
        if ((body.phase ?? 'accounts') === 'accounts') {
          // Resumable discovery — one search term at a time, paged, with a
          // cursor so a big result set can't blow the call's CPU budget.
          if (body.reset) await del(env.DB, 'oc-sync', 'accounts');
          const prev = await get<{ termIdx?: number; offset?: number; done?: boolean }>(
            env.DB, 'oc-sync', 'accounts');
          if (prev?.done && !body.searchTerm)
            return json({ phase: 'accounts', fetched: 0, done: true,
              note: 'already discovered — post {"reset":true} to re-walk' });
          let termIdx = prev?.termIdx ?? 0;
          let offset = prev?.offset ?? 0;
          const maxPages = Math.min(Math.max(body.maxPages ?? 3, 1), 10);
          let pages = 0, termDone = false;
          const fresh: Parameters<typeof fromOcAccounts>[0] = [];
          while (pages < maxPages && termIdx < terms.length) {
            let r = null;
            for (let a = 0; a < 3 && !r; a++) {   // OC 429s under burst — retry
              r = await fetchOcAccounts(
                { searchTerm: body.searchTerm ?? terms[termIdx]!, limit: 50, offset });
              if (!r) await new Promise((res) => setTimeout(res, 400 * (a + 1)));
            }
            if (!r) break;                       // transient — resume next call
            for (const a of r.accounts) fresh.push(a);
            pages++; offset += r.accounts.length;
            if (!r.accounts.length || offset >= r.totalCount) {
              termDone = true; break;
            }
          }
          if (!pages && !fresh.length)
            return err(`opencollective unreachable — ${ocError() || 'bad payload'}`, 502);
          if (termDone) { termIdx++; offset = 0; }
          const done = termIdx >= terms.length;
          await put(env.DB, 'oc-sync', 'accounts', { termIdx, offset, done });
          if (fresh.length) {
            await putManyIfChanged(env.DB, 'oc-collective', fresh.map((a) => ({
              id: `occ-${a.slug}`, obj: a,
            })));
            const plan = fromOcAccounts(fresh, 'oc:graphql');
            await putManyIfChanged(env.DB, 'plannode',
              plan.nodes.map((n) => ({ id: n.id, obj: n })));
            // Pool excludes existing oc-* nodes — same-source pairs are
            // skipped inside detection; the embedding scorer stays out of
            // sync routes (its table parse alone nears the CPU cap).
            await syncDetect(env, plan.nodes, { excludePrefix: 'oc-', skipPut: true });
          }
          if (done) {
            const count = (await listWhere<PlanNode>(
              env.DB, 'plannode', 'id LIKE ?', 'oc-%')).length;
            await put(env.DB, 'plan', 'plan-opencollective', {
              id: 'plan-opencollective', source: 'oc:graphql',
              title: 'Open Collective — public-goods collectives',
              owner: 'opencollective', importedAt: new Date().toISOString(),
              nodeCount: count,
            });
            await ledgerAppend(env.DB, 'api', 'oc.synced', {
              phase: 'accounts', done: true, nodes: count,
            });
          }
          return json({ phase: 'accounts', fetched: fresh.length,
            termIdx, done }, done ? 201 : 202);
        }
        const maxCollectives = Math.min(Math.max(body.maxCollectives ?? 10, 1), 50);
        const collectives = (await list<{ slug?: string }>(
          env.DB, 'oc-collective')).slice(0, maxCollectives);
        let donations = 0;
        const epoch = new Date(0).toISOString();
        for (const c of collectives) {
          const slug = (c as { slug?: string }).slug ?? '';
          if (!slug) continue;
          // Standing historical round per collective — imported orders are
          // settled donations, never eligible for native matching.
          await put(env.DB, 'funding-round', `round-oc-${slug}`, {
            id: `round-oc-${slug}`, title: `Open Collective — ${slug}`,
            description: `Imported Open Collective orders for /${slug}`,
            sponsorIds: ['opencollective'],
            matchingFund: { amount: 0, currency: 'USD' },
            eligibleNeedIds: [`oc-${slug}-need`],
            opensAt: epoch, closesAt: epoch, state: 'allocated',
            matchingMode: 'lr', conviction: false, acceptedTokens: {},
            endowment: false, chainRef: 'oc:orders',
          });
          let offset = 0;
          for (let pg = 0; pg < 4; pg++) {
            const r = await fetchOcOrders(slug, { limit: 50, offset });
            if (!r || !r.orders.length) break;
            const ents = toOcDonations(r.orders, slug);
            await putManyIfChanged(env.DB, 'donation', ents.map((e) => ({ id: e.id, obj: e })));
            donations += ents.length; offset += r.orders.length;
            if (offset >= r.totalCount) break;
          }
        }
        await ledgerAppend(env.DB, 'api', 'oc.synced', {
          phase: 'orders', collectives: collectives.length, donations,
        });
        return json({ phase: 'orders', collectives: collectives.length, donations }, 201);
      }
      // Regen sync — keyless Cosmos LCD. Classes + projects + batches in
      // a handful of pages; jurisdiction → coarse country centroid.
      if (req.method === 'POST' && seg[0] === 'regen' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const baseUrl = env.REGEN_LCD ?? undefined;
        const [classes, projects, batches] = await Promise.all([
          fetchRegenClasses(fetch, baseUrl),
          fetchRegenProjects(fetch, baseUrl),
          fetchRegenBatches(fetch, baseUrl),
        ]);
        if (!projects)
          return err(`regen lcd unreachable — ${regenLastError() || 'bad payload'}`, 502);
        const plan = fromRegen(projects, classes ?? [], batches ?? [], 'regen:lcd');
        await putPlanMeta(env, plan.id, plan);
        await putManyIfChanged(env.DB, 'regen-project', projects.map((p) => ({
          id: `rg-${p.id}`, obj: p,
        })));
        const { detected, retired } = await syncDetect(env, plan.nodes, { prefix: 'regen-' });
        await ledgerAppend(env.DB, 'api', 'regen.synced', {
          projects: projects.length, classes: classes?.length ?? 0,
          batches: batches?.length ?? 0, nodes: plan.nodes.length,
          overlaps: detected.length, retired,
        });
        return json({ projects: projects.length, classes: classes?.length ?? 0,
          batches: batches?.length ?? 0, nodes: plan.nodes.length,
          overlaps: detected.length, retired }, 201);
      }
      // Bloom Network — public Supabase `locations` table: 57 local Bloom
      // chapters w/ lat/lng, stage, entity_type, needs[]/offers[] (eight-
      // forms-of-capital vocab), embedded projects[] with funding links.
      // The anon key is Bloom's own public client credential; pass it in the
      // request body or bind BLOOM_ANON_KEY.
      if (req.method === 'POST' && seg[0] === 'bloom' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as { key?: string };
        const key = body.key ?? env.BLOOM_ANON_KEY;
        if (!key)
          return err('bloom anon key required (body.key or BLOOM_ANON_KEY)', 422);
        const locations = await fetchBloomLocations(
          key, fetch, env.BLOOM_URL ?? undefined);
        if (!locations)
          return err(`bloom unreachable — ${bloomLastError() || 'bad payload'}`, 502);
        const plan = fromBloomLocations(locations, 'bloom:supabase');
        await putPlanMeta(env, plan.id, plan);
        await putManyIfChanged(env.DB, 'bloom-location', locations.map((l) => ({
          id: `blm-${(l.systemname ?? l.slug ?? l.brandname ?? 'x')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
          obj: l,
        })));
        const { detected, retired } = await syncDetect(env, plan.nodes, { prefix: 'blm-' });
        await ledgerAppend(env.DB, 'api', 'bloom.synced', {
          locations: locations.length, nodes: plan.nodes.length,
          overlaps: detected.length, retired,
        });
        return json({ locations: locations.length, nodes: plan.nodes.length,
          overlaps: detected.length, retired }, 201);
      }
      // Governance — trust-gated parameter ballots. EigenTrust-standing
      // actors vote quadratically on mechanism parameters.
      if (seg[0] === 'governance') {
        const proposals = await list<GovernanceProposal>(env.DB, 'gov-proposal');
        const ballots = await list<GovernanceBallot>(env.DB, 'gov-ballot');
        const params = await list<GovernanceParam>(env.DB, 'gov-param');
        const govApps = await list<Appreciation>(env.DB, 'appreciation');
        const voters = eligibleVoters(govApps);
        if (req.method === 'GET' && seg.length === 1)
          return json({ proposals, ballots, params,
            governable: GOVERNABLE, eligibleVoters: voters });
        if (req.method === 'POST' && seg[1] === 'proposals') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const param = String(b.param ?? '');
          if (!GOVERNABLE[param]) return err(`param must be one of ${Object.keys(GOVERNABLE).join(', ')}`, 422);
          const proposer = String(b.proposer ?? '');
          if (!voters.includes(proposer)) return err('proposer needs EigenTrust standing', 403);
          const now = new Date().toISOString();
          const prop = GovernanceProposal.parse({
            id: `gov-${Date.now().toString(36)}`, param,
            title: String(b.title ?? `${param} → ${b.proposedValue}`),
            description: String(b.description ?? ''),
            proposedValue: String(b.proposedValue ?? ''),
            proposer,
            closesAt: String(b.closesAt ?? new Date(Date.now() + 7 * 86_400_000).toISOString()),
            state: 'open', createdAt: now,
          });
          await put(env.DB, 'gov-proposal', prop.id, prop);
          await ledgerAppend(env.DB, proposer, 'governance.proposed', { id: prop.id, param });
          return ct.includes('form')
            ? new Response(null, { status: 303, headers: { location: '/community#decisions' } })
            : json(prop, 201);
        }
        const prop = await get<GovernanceProposal>(env.DB, 'gov-proposal', seg[1] ?? '');
        if (!prop) return err('proposal not found', 404);
        if (req.method === 'POST' && seg[2] === 'vote') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const voter = String(b.voter ?? '');
          if (!voters.includes(voter)) return err('voter needs EigenTrust standing', 403);
          if (prop.state !== 'open' || Date.parse(prop.closesAt) < Date.now())
            return err('proposal closed', 409);
          const points = Number(b.points ?? 0);
          if (!(points > 0)) return err('positive points required', 422);
          const bal = GovernanceBallot.parse({
            id: `gb-${prop.id}-${voter.toLowerCase().replace(/\W+/g, '-')}`,
            proposalId: prop.id, voter, points,
            support: b.support === true || b.support === 'true',
            at: new Date().toISOString(),
          });
          await put(env.DB, 'gov-ballot', bal.id, bal);
          await ledgerAppend(env.DB, voter, 'governance.voted',
            { proposalId: prop.id, points, support: bal.support });
          return ct.includes('form')
            ? new Response(null, { status: 303, headers: { location: '/community#decisions' } })
            : json(bal, 201);
        }
        if (req.method === 'POST' && seg[2] === 'tally') {
          if (!authed(req, env)) return err('unauthorized', 401);
          const tally = tallyProposal(prop, ballots, voters);
          const state = tally.passed ? 'passed' : 'rejected';
          await put(env.DB, 'gov-proposal', prop.id, { ...prop, state });
          if (tally.passed) {
            await put(env.DB, 'gov-param', prop.param, GovernanceParam.parse({
              id: prop.param, value: prop.proposedValue,
              setBy: prop.id, updatedAt: new Date().toISOString(),
            }));
          }
          await ledgerAppend(env.DB, 'api', 'governance.tallied', tally);
          return json({ ...tally, state });
        }
      }
      // Dataset releases — admin freezes a store slice into a signed,
      // anchored, optionally-pinned bundle. Public registry at GET.
      if (seg[0] === 'docs.json' && req.method === 'GET') return json(OPENAPI);
      if (seg[0] === 'docs' && req.method === 'GET') {
        if (seg[1] === 'json' || url.searchParams.get('format') === 'json')
          return json(OPENAPI);
        if ((req.headers.get('accept') ?? '').includes('text/html')
            || !(req.headers.get('accept') ?? '').includes('application/json'))
          return page(req, renderDocsPage, OPENAPI.paths, langFrom(url, req.headers.get('cookie')));
        return json(OPENAPI);
      }
      if (seg[0] === 'whitepaper' && req.method === 'GET')
        return page(req, renderWhitepaper, langFrom(url, req.headers.get('cookie')));
      // Every surface on one scrollable page — review mode.
      // Recurring support streams — top-level list; round-scoped view
      // also exists at /rounds/:id/stream.
      if (seg[0] === 'streams' && req.method === 'GET')
        return json(await loadStreams(env));
      // Attestations list — EAS payloads stored for claims/donations.
      if (seg[0] === 'attestations' && req.method === 'GET' && seg.length === 1) {
        const atts = await list<Attestation>(env.DB, 'attestation');
        return json({ attestations: atts });
      }
      if (seg[0] === 'datasets') {
        if (req.method === 'GET' && seg.length === 1)
          return json(await loadDatasets(env));
        if (req.method === 'POST' && seg[2] === 'release') {
          if (!authed(req, env)) return err('unauthorized', 401);
          const name = seg[1] ?? '';
          const spec = DATASET_SOURCES[name];
          if (!spec) return err(`dataset must be one of ${Object.keys(DATASET_SOURCES).join(', ')}`, 404);
          const rows = await list<Record<string, unknown>>(env.DB, spec.kind);
          const bundle = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
          const bytes = enc(bundle);
          const m = buildManifest([{ name: `${name}.jsonl`, bytes }]);
          const sha = await sha256Hex(bytes);
          const cid = await pinToIpfs(env, name, bytes);
          // keep the bundle itself so the release is servable later
          await put(env.DB, 'dataset-bundle', `${name}-${Date.now().toString(36)}`,
            { name, createdAt: new Date().toISOString(), bundle });
          const rel = DatasetRelease.parse({
            id: `rel-${name}-${Date.now().toString(36)}`,
            name, records: rows.length,
            manifest: m as unknown as Record<string, unknown>, sha256: sha,
            cid, createdAt: new Date().toISOString(),
          });
          await put(env.DB, 'dataset-release', rel.id, rel);
          await ledgerAppend(env.DB, 'api', 'dataset.released',
            { id: rel.id, name, records: rows.length, cid });
          return json(rel, 201);
        }
        // Access grants — verified payment reference → time-boxed grant.
        // Aggregates stay public; this gates only raw/premium feeds.
        if (req.method === 'POST' && seg[2] === 'grants') {
          const b = await req.json() as Record<string, unknown>;
          const grantee = String(b.grantee ?? '');
          const paymentRef = String(b.paymentRef ?? '');
          if (!grantee || !paymentRef) return err('grantee + paymentRef required', 422);
          const days = Math.min(90, Math.max(1, Number(b.days ?? 30)));
          const g = DataAccessGrant.parse({
            id: `dag-${seg[1]}-${grantee.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
            dataset: seg[1]!, grantee, paymentRef,
            verified: true,   // chain-verified when a tx-hash lane lands; reference-trusted for now
            expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
            createdAt: new Date().toISOString(),
          });
          await put(env.DB, 'data-grant', g.id, g);
          await ledgerAppend(env.DB, grantee, 'dataset.granted', { id: g.id, dataset: g.dataset });
          return json(g, 201);
        }
        if (req.method === 'GET' && seg[2] === 'grants') {
          const grants = (await list<DataAccessGrant>(env.DB, 'data-grant'))
            .filter((g) => g.dataset === seg[1]);
          return json({ grants });
        }
      }
      // Subscriptions — opt in to lifecycle notifications on a target.
      if (seg[0] === 'subscriptions') {
        if (req.method === 'GET')
          return json({ subscriptions: (await list<Subscription & { deletedAt?: string }>
            (env.DB, 'subscription')).filter((s) => !s.deletedAt) });
        if (req.method === 'POST') {
          const b = await req.json() as Record<string, unknown>;
          const sub = Subscription.parse({
            id: `sub-${String(b.actor ?? 'anon').toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
            actor: b.actor, target: b.target ?? '*',
            events: b.events, channel: b.channel, address: b.address,
            createdAt: new Date().toISOString(),
          });
          await put(env.DB, 'subscription', sub.id, sub);
          await ledgerAppend(env.DB, sub.actor, 'subscription.added', { id: sub.id, target: sub.target });
          return json(sub, 201);
        }
        if (req.method === 'DELETE' && seg[1]) {
          const sub = await get<Subscription>(env.DB, 'subscription', seg[1]);
          if (!sub) return err('subscription not found', 404);
          await put(env.DB, 'subscription', seg[1],
            { ...sub, deletedAt: new Date().toISOString() });
          return json({ ok: true });
        }
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
            ? new Response(null, { status: 303, headers: { location: '/collaborate#overlaps' } })
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
            ? new Response(null, { status: 303, headers: { location: `/collaborate?node=${encodeURIComponent(coordNodeId)}#overlaps` } })
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
      if (req.method === 'GET' && seg[0] === 'commitments')
        return json(await loadCommitments(env, url.searchParams));
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
            ? new Response(null, { status: 303, headers: { location: '/collaborate#overlaps' } })
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
            householdsProtected: b.householdsProtected ? Number(b.householdsProtected) : undefined,
            // Optional geo: explicit h3 wins, else lat/lon → cell, else the
            // gazetteer resolves the free-text place at render time.
            h3: typeof b.h3 === 'string' && isValidCell(b.h3) ? b.h3
              : (b.lat != null && b.lon != null && isFinite(Number(b.lat)) && isFinite(Number(b.lon)))
                ? latLngToCell(Number(b.lat), Number(b.lon), 5) : undefined,
            context: b.context,
            status: 'active', createdAt: iso,
          });
          await put(env.DB, 'possibility', p.id, p);
          // Composite declaration: needs become need-nodes (`required`
          // defaults true — blocking for quorum), bringing becomes offers.
          const mk = (t: string, i: number, kind: 'need' | 'offer' | 'action') =>
            `${pid}-${kind}-${i}-${t.toLowerCase().replace(/\W+/g, '-').slice(0, 24)}`;
          const needs = (Array.isArray(b.needs) ? b.needs : []) as Record<string, unknown>[];
          const bringing = (Array.isArray(b.bringing) ? b.bringing : []) as Record<string, unknown>[];
          for (const [i, n] of needs.entries()) {
            const node = PlanNode.parse({
              id: mk(String(n.title ?? 'need'), i, 'need'), kind: 'need',
              label: String(n.title ?? 'need'), canonical: canonicalize(String(n.title ?? 'need')),
              source: `possibility:${pid}`, possibilityId: pid,
              required: n.required !== false && n.required !== 'false',
              h3: typeof n.h3 === 'string' && isValidCell(n.h3) ? n.h3 : undefined,
              category: n.category, flaggedBy: p.declarerId,
              orgIds: [p.declarerId], placeId: p.place,
              terms: n.terms, capital: n.capital, description: String(n.description ?? ''),
              budget: n.budget != null ? Number(n.budget) : undefined,
              budgetCurrency: n.budgetCurrency ?? n.currency,
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
              budget: o.budget != null ? Number(o.budget) : undefined,
              budgetCurrency: o.budgetCurrency ?? o.currency,
              tags: ['possibility', 'bringing'], timeframe: { from: iso },
            });
            await put(env.DB, 'plannode', node.id, node);
          }
          // Declared actions the card commits to — h3-located ones become
          // hourly oracle targets (the UK flood-response lane).
          const actions = (Array.isArray(b.actions) ? b.actions : []) as Record<string, unknown>[];
          for (const [i, a] of actions.entries()) {
            const node = PlanNode.parse({
              id: mk(String(a.title ?? 'action'), i, 'action'), kind: 'action',
              label: String(a.title ?? 'action'), canonical: canonicalize(String(a.title ?? 'action')),
              source: `possibility:${pid}`, possibilityId: pid,
              h3: typeof a.h3 === 'string' && isValidCell(a.h3) ? a.h3 : undefined,
              orgIds: [p.declarerId], placeId: p.place,
              description: String(a.description ?? ''),
              tags: ['possibility'], timeframe: { to: p.deadline },
            });
            await put(env.DB, 'plannode', node.id, node);
          }
          await ledgerAppend(env.DB, p.declarerId, 'possibility.declared',
            { id: pid, needs: needs.length, bringing: bringing.length });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: `/possibilities#${pid}` } })
            : json(p, 201);
        }
        if (req.method === 'GET' && seg.length === 1) {
          // Card-scoped plannodes only — every consumer on this path
          // (quorumMet, scoreCard, needs/bringing, resolvePlace,
          // loadCardConnections) filters by possibilityId anyway; parsing
          // all ~1k imported plan nodes per request trips the CPU limit.
          const [possBefore, nodes, recs, parts, apps, passes, interests, { dons, matchByNeed }] = await Promise.all([
            list<Possibility>(env.DB, 'possibility'),
            listWhere<PlanNode>(env.DB, 'plannode', "json_extract(json,'$.possibilityId') IS NOT NULL"),
            list<OverlapRecord>(env.DB, 'overlap'), list<Participation>(env.DB, 'participation'),
            list<Appreciation>(env.DB, 'appreciation'), list<Pass>(env.DB, 'pass'),
            list<Interest>(env.DB, 'interest'),
            fundingMaps(env),
          ]);
          // Sweep with the same snapshot (it only mutates possibility
          // statuses/credits/pledges) — then re-read just that small table.
          // Fail-open under write-quota outage: the page renders pre-sweep
          // state rather than erroring on a status transition write.
          await sweepPossibilities(env, 'system',
            { poss: possBefore, nodes, recs, parts }).catch(() => undefined);
          const poss = await list<Possibility>(env.DB, 'possibility');
          const possByNeed = new Map(nodes.filter((n) => n.kind === 'need')
            .map((n) => [n.id, n.possibilityId]));
          const edges = trustEdges(apps);
          const viewer = url.searchParams.get('actor') ?? undefined;
          // ?for=<actor> — interest feed: possibilities the actor joined or
          // recorded interest in, so post-engagement progress is one tap away.
          const forActor = url.searchParams.get('for') ?? undefined;
          const scoped = forActor
            ? poss.filter((p) =>
                parts.some((x) => x.possibilityId === p.id && x.actor === forActor)
                || interests.some((i) => i.possibilityId === p.id && i.actor === forActor))
            : poss;
          const now = Date.now();
          const coordinated = new Set(recs
            .filter((o) => o.kind === 'complement' && (o.status === 'confirmed' || o.status === 'coordinated'))
            .map((o) => o.nodeIds[0]));
          const live = ['active', 'quorum', 'draft'];
          // EigenTrust power-iteration is viewer-scoped, not card-scoped —
          // compute once for the whole deck instead of once per card.
          const vec = eigenTrust(edges, { seed: viewer });
          // Identity gradation: participant names hidden until critical mass
          // (cover ≥0.5 or quorum) — counts always public, per the GDD deck.
          const cards = viewerDeck(scoped, passes, viewer).map((p) => {
            const status = effectiveStatus(p, now);
            const myParts = parts.filter((x) => x.possibilityId === p.id);
            const q = quorumMet(p, nodes, recs, myParts.length);
            const s = scoreCard(p, { nodes, overlaps: recs, participants: parts, edges, viewer, now, vec });
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
              value: valueCoordinated({
                hours: myParts.map((x) => x.hours ?? 0).filter((h) => h > 0),
                donations: dons.filter((d) => possByNeed.get(d.needNodeId) === p.id)
                  .map((d) => ({ amount: d.amount, currency: d.currency })),
                matched: [...matchByNeed.values()].filter((m) => possByNeed.get(m.needNodeId) === p.id)
                  .map((m) => ({ amount: m.amount, currency: m.currency })),
                inKind: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'offer' && n.budget != null)
                  .map((n) => ({ amount: n.budget!, currency: n.budgetCurrency ?? (GB_PLACE.test(p.place ?? '') ? 'GBP' : 'USD') })),
                needsCost: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'need' && n.budget != null)
                  .map((n) => ({ amount: n.budget!, currency: n.budgetCurrency ?? (GB_PLACE.test(p.place ?? '') ? 'GBP' : 'USD') })),
                householdsProtected: p.householdsProtected,
                benchmark: GB_PLACE.test(p.place ?? '') ? VOLUNTEER_GB : undefined,
              }),
            };
          }).sort((a, b) =>
            (live.includes(a.status) ? 0 : 1) - (live.includes(b.status) ? 0 : 1)
            || b.score - a.score);
          if (url.searchParams.get('format') === 'json') return json({ possibilities: cards });
          const connections = await loadCardConnections(env, cards,
            { nodes, recs, dons, apps, interests });
          // Viewer-personalized reason data — counts only, no name reveal.
          const me = viewer ?? forActor;
          if (me) {
            const recognized = new Set(edges.filter((e) => e.from === me && e.mutual > 0).map((e) => e.to));
            const myPlaces = new Set(scoped.filter((p) =>
              parts.some((x) => x.possibilityId === p.id && x.actor === me))
              .map((p) => p.place?.toLowerCase()).filter(Boolean));
            for (const c of cards) {
              const mine = parts.filter((x) => x.possibilityId === c.id);
              const myJoin = mine.find((x) => x.actor === me);
              const myInterest = interests.find((i) => i.possibilityId === c.id && i.actor === me);
              // Since-engagement markers: compare the card's audit trail
              // against the viewer's earliest signal (join or interest).
              const engagedAt = [myJoin?.at, myInterest?.at].filter(Boolean).sort()[0];
              const fresh = engagedAt
                ? (connections[c.id]?.trail ?? []).filter((e) => e.at > engagedAt
                    && e.kind !== 'possibility.passed' && e.kind !== 'possibility.interested')
                : [];
              connections[c.id]!.personal = {
                joined: !!myJoin,
                interested: !!myInterest,
                recognized: mine.filter((x) => recognized.has(x.actor)).length,
                near: !myJoin && c.place && myPlaces.has(c.place.toLowerCase()) ? c.place : undefined,
                newSince: fresh.length,
                lastEvent: fresh.length ? fresh[fresh.length - 1]!.kind : undefined,
              };
            }
          }
          return page(req, renderPossibilitiesPage, cards, edges, viewer ?? forActor, {
            status: url.searchParams.get('status') ?? '',
            lang: langFrom(url, req.headers.get('cookie')),
            connections,
            mine: !!forActor,
          });
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
            hours: b.hours ? Number(b.hours) : undefined,
          });
          await put(env.DB, 'participation', part.id, part);
          await ledgerAppend(env.DB, actor, 'possibility.joined', { id: p.id, bringingNodeId });
          await sweepPossibilities(env, actor);   // quorum may have just tipped
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: '/possibilities' } })
            : json(part, 201);
        }
        // Verified-context refresh — pulls live open datasets (endorsed
        // hackathon sources) and merges them onto the card. Context is
        // enrichment only — it never affects quorum.
        if (req.method === 'POST' && seg[2] === 'context' && seg[3] === 'refresh') {
          const b = await req.json().catch(() => ({})) as Record<string, unknown>;
          let loc: GeoLoc | null = (b.lat != null && b.lon != null)
            ? { lat: Number(b.lat), lon: Number(b.lon) } : null;
          if (!loc) {
            const nodes = (await list<PlanNode>(env.DB, 'plannode'))
              .filter((n) => n.possibilityId === p.id && n.h3);
            loc = nodes.length ? locFor(nodes[0]!) : null;
          }
          if (!loc) return err('no lat/lon and no h3-located need node on this card', 400);
          const datasets = await placeContext(loc, {
            placeName: p.place, entityName: typeof b.entityName === 'string' ? b.entityName : undefined,
            companiesHouseKey: env.COMPANIES_HOUSE_KEY,
          });
          const existing = (p.context?.datasets ?? [])
            .filter((d) => !datasets.some((n) => n.name === d.name));
          const merged = [...existing, ...datasets].slice(-40);
          const updated = Possibility.parse({ ...p, context: { datasets: merged } });
          await put(env.DB, 'possibility', p.id, updated);
          await ledgerAppend(env.DB, 'system', 'context.refreshed',
            { id: p.id, added: datasets.length, lat: loc.lat, lon: loc.lon });
          return json({ id: p.id, added: datasets.length, datasets });
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
            ? new Response(null, { status: 303, headers: { location: safeNext(b.next, '/possibilities') } })
            : json(pass, 201);
        }
        // Swipe-right — a logged "I'm interested". The warm signal short
        // of joining: feeds the actor's interest feed and the card's
        // public interest count (identity stays graded like participants).
        if (req.method === 'POST' && seg[2] === 'interest') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const actor = String(b.actor ?? '');
          if (!actor) return err('actor required');
          const interest = Interest.parse({
            id: `interest-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}`,
            possibilityId: p.id, actor, at: new Date().toISOString(),
          });
          await put(env.DB, 'interest', interest.id, interest);
          await ledgerAppend(env.DB, actor, 'possibility.interested', { id: p.id });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: safeNext(b.next, `/possibilities?actor=${encodeURIComponent(actor)}#${p.id}`) } })
            : json(interest, 201);
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
        // Composed field report — report + participants + evidence +
        // appreciations + linked claim, assembled from structured records.
        if (req.method === 'GET' && seg[2] === 'report') {
          const [parts, nodes, checks, apps, claims] = await Promise.all([
            list<Participation>(env.DB, 'participation'),
            list<PlanNode>(env.DB, 'plannode'),
            list<OracleCheck & { nodeId?: string }>(env.DB, 'oracle-check'),
            list<Appreciation>(env.DB, 'appreciation'),
            list<ImpactClaim>(env.DB, 'claim'),
          ]);
          const myNodes = nodes.filter((n) => n.possibilityId === p.id);
          const claim = claims.find((c) => c.possibilityId === p.id);
          return page(req, renderReportPage, {
            possibility: p,
            participants: parts.filter((x) => x.possibilityId === p.id),
            nodes: myNodes,
            checks: checks.filter((c) => c.nodeId && myNodes.some((n) => n.id === c.nodeId)),
            appreciations: apps.filter((a) => a.possibilityId === p.id),
            claim,
            trajectories: myNodes.map((n) => trajectory(n.id, checks)),
            seats: (await list<CouncilSeat>(env.DB, 'council-seat'))
              .filter((s) => s.possibilityId === p.id)
              .map((s) => ({ actor: s.actor, role: s.role })),
            posts: (await list<ForumPost>(env.DB, 'forum-post'))
              .filter((f) => f.possibilityId === p.id)
              .map((f) => ({ id: f.id, parentId: f.parentId, actor: f.actor, kind: f.kind, text: f.text, at: f.at })),
            lang: langFrom(url, req.headers.get('cookie')),
          });
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
        if (url.searchParams.get('format') === 'attestations') {
          const edges = trustEdges(await list<Appreciation>(env.DB, 'appreciation'));
          return json({
            attestations: edges.filter((e) => e.mutual > 0).map((e) => ({
              schema: 'mutual-recognition', from: e.from, to: e.to,
              weight: e.weight, mutual: e.mutual,
              ledgerEvent: 'possibility.appreciated',
            })),
          });
        }
        return json(await loadTrust(env));
      }
      // Actor standing — the "Community Standing" profile: created/joined
      // counts, earned recognition, transitive trust score.
      // Wallet↔actor binding — EIP-191 personal_sign over the canonical
      // bind message. One wallet = one actor for pairwise matching.
      if (req.method === 'POST' && seg[0] === 'actors' && seg[2] === 'bind-wallet') {
        const b = await req.json() as { actor?: string; address?: string; signature?: string };
        const actor = seg[1] ?? b.actor ?? '';
        if (!actor || !b.address || !b.signature) return err('actor, address, signature required');
        if (actor !== (b.actor ?? actor)) return err('actor mismatch', 422);
        const ok = await verifyWalletBinding(actor, b.address, b.signature);
        if (!ok) return err('signature does not verify for this address', 422);
        const w = ActorWallet.parse({
          id: `aw-${b.address.toLowerCase()}`, actor,
          address: b.address as `0x${string}`, signature: b.signature as `0x${string}`,
          at: new Date().toISOString(),
        });
        await put(env.DB, 'actor-wallet', w.id, w);
        await ledgerAppend(env.DB, actor, 'actor.wallet-bound', { address: w.address });
        return json(w, 201);
      }
      // World ID binding — proof of personhood for the mutual-recognition
      // graph. The Mini App runs MiniKit.walletAuth (SIWE signed by a
      // World-verified account's wallet — World App accounts are human-
      // gated). GET issues a one-shot nonce; POST verifies the signature
      // (verifySiweMessage → ERC-1271 on World Chain for contract wallets)
      // and binds the verified wallet to the actor. One wallet = one actor.
      if (seg[0] === 'actors' && seg[2] === 'worldid') {
        const actor = seg[1] ?? '';
        if (!actor) return err('actor id required', 400);
        if (req.method === 'GET') {
          const nonce = crypto.randomUUID().replace(/-/g, '');
          const n = ActorNonce.parse({
            id: `an-${actor}`, actor, nonce,
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          });
          await put(env.DB, 'actor-nonce', n.id, n);
          return json({ nonce, statement: `springforth bind actor:${actor}`,
            signIn: 'MiniKit.walletAuth({ nonce, statement }) → POST the { address, message, signature } here' });
        }
        if (req.method === 'POST') {
          const b = await req.json() as {
            address?: string; message?: string; signature?: string; username?: string;
          };
          if (!b.address || !b.message || !b.signature)
            return err('address, message, signature required (MiniKit walletAuth result)', 422);
          const nonceRow = await get<ActorNonce>(env.DB, 'actor-nonce', `an-${actor}`);
          if (!nonceRow || Date.parse(nonceRow.expiresAt) < Date.now())
            return err('no live nonce — GET this route first', 409);
          let valid = false;
          try {
            const v = await verifySiweMessage(
              { address: b.address, message: b.message, signature: b.signature },
              nonceRow.nonce, `springforth bind actor:${actor}`);
            valid = v.isValid;
          } catch { valid = false; }
          if (!valid) return err('SIWE signature does not verify', 422);
          await del(env.DB, 'actor-nonce', nonceRow.id);
          const address = b.address.toLowerCase();
          const id = `ap-${address}`;
          const existing = await get<ActorPersonhood>(env.DB, 'actor-personhood', id);
          if (existing && existing.actor !== actor)
            return err('this World wallet is bound to another actor', 409);
          const p = ActorPersonhood.parse({
            id, actor, address: b.address, username: b.username,
            at: new Date().toISOString(),
          });
          await put(env.DB, 'actor-personhood', p.id, p);
          await ledgerAppend(env.DB, actor, 'actor.personhood-verified',
            { address: b.address, username: b.username });
          return json(p, existing ? 200 : 201);
        }
      }
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
        if (id && (req.headers.get('accept') ?? '').includes('text/html')) {
          const [wallets, donations] = await Promise.all([
            list<ActorWallet>(env.DB, 'actor-wallet'), list<Donation>(env.DB, 'donation'),
          ]);
          return page(req, renderActorProfile, {
            actor: id,
            created: poss.filter((p) => p.declarerId === id).length,
            joined: parts.filter((x) => x.actor === id).length,
            appreciatedBy: apps.filter((a) => a.toActor === id).length,
            appreciated: apps.filter((a) => a.fromActor === id).length,
            earned: earnedRecognition(edges, credits)[id] ?? 0,
            assuranceCredits: credits.filter((c) => c.actor === id).length,
            trustScore: mean > 0 ? +((vec[id] ?? 0) / mean).toFixed(4) : 0,
            wallets: wallets.filter((w) => w.actor === id),
            donations: donations.filter((d) => d.donor === id),
            recognitions: apps.filter((a) => a.toActor === id && a.note.trim())
              .map((a) => ({ from: a.fromActor, note: a.note, possibilityId: a.possibilityId })),
          }, langFrom(url, req.headers.get('cookie')));
        }
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
      if (req.method === 'GET' && seg[0] === 'resources')
        return json(await loadResources(env));
      // Network health — north-star + funnel metrics.
      if (req.method === 'GET' && seg[0] === 'metrics')
        return json(await loadMetrics(env));
      // ── Funding layer — public mechanisms only ──────────────────────
      // Quadratic rounds (LR/Gitcoin), assurance pledges (Tabarrok),
      // retro ballots (RetroPGF), impact claims (hypercerts lexicon),
      // attestations (EAS). Ledger records of intent — nothing custodies.
      if (seg[0] === 'rounds') {
        if (req.method === 'POST' && seg.length === 1) {
          if (!authed(req, env)) return err('unauthorized', 401);
          const b = await req.json() as Record<string, unknown>;
          const round = FundingRound.parse({
            id: String(b.id ?? `round-${Date.now().toString(36)}`),
            title: String(b.title ?? ''), description: String(b.description ?? ''),
            sponsorIds: b.sponsorIds ?? [], matchingFund: b.matchingFund,
            eligibleNeedIds: b.eligibleNeedIds ?? [],
            opensAt: String(b.opensAt ?? new Date().toISOString()),
            closesAt: String(b.closesAt), state: 'open',
            matchingMode: b.matchingMode === 'pairwise' ? 'pairwise' : 'lr',
            conviction: b.conviction === true,
            acceptedTokens: (b.acceptedTokens ?? {}) as Record<string, string>,
            pledgeGoal: b.pledgeGoal != null ? Number(b.pledgeGoal) : undefined,
            pledgeGoalCurrency: b.pledgeGoalCurrency ? String(b.pledgeGoalCurrency) : undefined,
            minBackers: b.minBackers != null ? Number(b.minBackers) : undefined,
            skimBps: b.skimBps != null ? Number(b.skimBps) : undefined,
            endowment: b.endowment === true,
          });
          await put(env.DB, 'round', round.id, round);
          await ledgerAppend(env.DB, 'api', 'round.opened', { id: round.id });
          return json(round, 201);
        }
        if (req.method === 'GET' && seg.length === 1)
          return json({ rounds: await list<FundingRound>(env.DB, 'round') });
        const round = await get<FundingRound>(env.DB, 'round', seg[1] ?? '');
        if (!round) return err('round not found', 404);
        const donations = (await list<Donation>(env.DB, 'donation'))
          .filter((d) => d.roundId === round.id);
        // Public-spec exports — 360Giving grants JSON / IATI 2.03 XML.
        // Emitted against the live allocation; downstream CoVE-validatable.
        if (req.method === 'GET' && seg[2] === 'export' && seg[3]) {
          const allocation = await allocFor(env, round, donations);
          const nodes = await list<PlanNode>(env.DB, 'plannode');
          const labels = new Map(nodes.map((n) => [n.id, n.label]));
          const owners = new Map(nodes.map((n) => [n.id, n.orgIds[0] ?? n.id]));
          const places = new Map(nodes.map((n) => [n.id, n.placeId ?? '']));
          if (seg[3] === '360giving')
            return json(to360Giving({
              round, allocation, needLabels: labels, needOwners: owners,
              needPlaces: places,
              publisher: { name: 'Springforth', orgId: 'springforth' },
            }));
          if (seg[3] === 'iati')
            return new Response(toIati({
              round, allocation, needLabels: labels, needOwners: owners,
              publisherRef: 'XI-SPRING',
            }), { headers: { 'content-type': 'application/xml' } });
          return err('unknown export format', 404);
        }
        if (req.method === 'GET' && seg.length === 2) {
          const allocation = await allocFor(env, round, donations);
          const nodes = await list<PlanNode>(env.DB, 'plannode');
          if (url.searchParams.get('format') === 'json')
            return json({ ...round, donations, allocation });
          return page(req, renderRoundPage, round, donations, allocation, nodes,
            langFrom(url, req.headers.get('cookie')));
        }
        if (req.method === 'GET' && seg[2] === 'donors' && seg[3]) {
          const donor = decodeURIComponent(seg[3]);
          const ds = (await list<Donation>(env.DB, 'donation'))
            .filter((d) => d.roundId === round.id && d.donor === donor);
          const receipts = (await list<Attestation>(env.DB, 'attestation'))
            .filter((a) => a.schemaRef === 'springforth.donation.v1'
              && a.payload.includes(`"donor":"${donor}"`));
          return page(req, renderDonorPage, {
            roundId: round.id, donor, donations: ds, receipts },
            langFrom(url, req.headers.get('cookie')));
        }
        if (req.method === 'POST' && seg[2] === 'donate') {
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          if (round.state !== 'open') return err(`round is ${round.state}`, 409);
          if (Date.parse(round.closesAt) < Date.now()) return err('round closed', 409);
          const needNodeId = String(b.needNodeId ?? '');
          if (!round.eligibleNeedIds.includes(needNodeId)) return err('need not eligible', 422);
          const donor = String(b.donor ?? b.actor ?? '');
          const amount = Number(b.amount ?? 0);
          if (!donor || !(amount > 0)) return err('donor and positive amount required');
          const donation = Donation.parse({
            id: `don-${round.id}-${donor.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
            roundId: round.id, needNodeId, donor, amount,
            currency: String(b.currency ?? round.matchingFund.currency),
            at: new Date().toISOString(),
          });
          await put(env.DB, 'donation', donation.id, donation);
          await ledgerAppend(env.DB, donor, 'donation.recorded',
            { roundId: round.id, needNodeId, amount, currency: donation.currency });
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: `/rounds/${round.id}` } })
            : json(donation, 201);
        }
        if (req.method === 'POST' && seg[2] === 'close') {
          if (!authed(req, env)) return err('unauthorized', 401);
          const allocation = await allocFor(env, round, donations);
          const closed = { ...round, state: 'allocated' as const };
          await put(env.DB, 'round', round.id, closed);
          await ledgerAppend(env.DB, 'api', 'round.allocated',
            { id: round.id, allocation });
          return json({ ...closed, allocation });
        }
        // On-chain creation — unsigned calldata for the signer's wallet.
        // Allo v2 requires a registry profile before pool creation.
        if (req.method === 'GET' && seg[2] === 'tx') {
          const cfg = chainCfg(env);
          if (!cfg) return err('chain disabled — set CHAIN_MODE=celo-sepolia|sepolia|celo', 503);
          const owner = url.searchParams.get('owner');
          const profileId = url.searchParams.get('profileId') as `0x${string}` | null;
          const initData = url.searchParams.get('initStrategyData') as `0x${string}` | null;
          const meta = `https://springforth.widespread.workers.dev/rounds/${round.id}`;
          if (!profileId) {
            if (!owner) return err('owner=0x… required — the signer address that will own the Allo registry profile', 400);
            return json({
              chain: cfg.name, step: 'createProfile',
              tx: buildCreateProfileTx({ cfg, nonce: BigInt(Date.now()),
                name: `springforth:${round.id}`, owner: owner as `0x${string}`,
                metadataPointer: meta }),
              next: 'submit tx → profileId = keccak256(nonce,owner) → GET ?profileId=0x…&initStrategyData=0x…',
              contracts: cfg.contracts,
            });
          }
          if (!initData)
            return err('initStrategyData=0x… required — strategy init encoding per DonationVotingMerkleDistribution (allo-v2)', 400);
          return json({
            chain: cfg.name, step: 'createPoolWithCustomStrategy',
            tx: buildCreateRoundTx({ cfg, profileId, initStrategyData: initData,
              matchingAmount: BigInt(Math.round(round.matchingFund.amount * 10 ** 18)),
              metadataPointer: meta }),
            then: `POST /chain/record { kind: 'round.create', entityId: '${round.id}', txHash }`,
          });
        }
        // Yield-backed matching — register a sponsor's yield-bearing
        // position; the cron reads its aToken balance and credits the
        // delta to matchingFund. Read-only, non-custodial.
        // Round applications — public intake lane. A need node applies;
        // operator review appends to eligibleNeedIds on approval.
        if (req.method === 'POST' && seg[2] === 'apply') {
          const b = await req.json() as Record<string, unknown>;
          const needNodeId = String(b.needNodeId ?? '');
          const applicant = String(b.applicant ?? '');
          if (!needNodeId || !applicant) return err('needNodeId + applicant required', 422);
          if (round.state !== 'open') return err(`round is ${round.state}`, 409);
          if (round.eligibleNeedIds.includes(needNodeId)) return err('need already eligible', 409);
          const dup = (await list<RoundApplication>(env.DB, 'round-application'))
            .find((a) => a.roundId === round.id && a.needNodeId === needNodeId && a.state === 'pending');
          if (dup) return json(dup);
          const app = RoundApplication.parse({
            id: `app-${round.id}-${Date.now().toString(36)}`,
            roundId: round.id, needNodeId, applicant,
            statement: String(b.statement ?? ''), state: 'pending',
            at: new Date().toISOString(),
          });
          await put(env.DB, 'round-application', app.id, app);
          await ledgerAppend(env.DB, applicant, 'round.applied',
            { roundId: round.id, needNodeId });
          return json(app, 201);
        }
        if (req.method === 'GET' && seg[2] === 'admin') {
          const applications = (await list<RoundApplication>(env.DB, 'round-application'))
            .filter((a) => a.roundId === round.id);
          const nodes = await list<PlanNode>(env.DB, 'plannode');
          return page(req, renderRoundAdmin, round, applications, nodes,
            langFrom(url, req.headers.get('cookie')));
        }
        if (req.method === 'GET' && seg[2] === 'applications') {
          const apps = (await list<RoundApplication>(env.DB, 'round-application'))
            .filter((a) => a.roundId === round.id);
          return json({ applications: apps });
        }
        if (req.method === 'POST' && seg[2] === 'applications' && seg[4] === 'review') {
          if (!authed(req, env)) return err('unauthorized', 401);
          const app = await get<RoundApplication>(env.DB, 'round-application', seg[3] ?? '');
          if (!app || app.roundId !== round.id) return err('application not found', 404);
          if (app.state !== 'pending') return err(`application is ${app.state}`, 409);
          const ct = req.headers.get('content-type') ?? '';
          const b = ct.includes('form')
            ? Object.fromEntries((await req.formData()).entries())
            : await req.json() as Record<string, unknown>;
          const approved = b.approve === true || b.approve === 'true';
          const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
          const next = { ...app,
            state: (approved ? 'approved' : 'rejected') as RoundApplication['state'],
            reviewedAt: new Date().toISOString() };
          await put(env.DB, 'round-application', app.id, next);
          if (approved) {
            await put(env.DB, 'round', round.id,
              { ...round, eligibleNeedIds: [...round.eligibleNeedIds, app.needNodeId] });
          }
          await ledgerAppend(env.DB, 'api', 'round.reviewed',
            { roundId: round.id, applicationId: app.id, approved });
          return wantsHtml
            ? new Response(null, { status: 303, headers: { location: `/rounds/${round.id}/admin` } })
            : json(next);
        }
        // Close — freezes the allocation snapshot; settlements stay
        // external (payout refs recorded, never custodied here).
        if (req.method === 'POST' && seg[2] === 'close') {
          if (!authed(req, env)) return err('unauthorized', 401);
          if (round.state !== 'open') return err(`round is ${round.state}`, 409);
          const donations = (await list<Donation>(env.DB, 'donation'))
            .filter((d) => d.roundId === round.id);
          const allocation = await allocFor(env, round, donations);
          await put(env.DB, 'round', round.id, { ...round, state: 'closed' });
          await ledgerAppend(env.DB, 'api', 'round.closed',
            { roundId: round.id, donations: donations.length,
              allocation: allocation.map((r) => ({ need: r.needNodeId, match: r.match })) });
          return (req.headers.get('accept') ?? '').includes('text/html')
            ? new Response(null, { status: 303, headers: { location: `/rounds/${round.id}/admin` } })
            : json({ ...round, state: 'closed', allocation });
        }
        // Recurring support — Superfluid CFA streams on Celo. Intent is
        // recorded ledger-side; createFlow calldata is signer-facing;
        // the cron accrues elapsed·rate into periodic Donation records.
        if (seg[2] === 'stream') {
          if (req.method === 'GET' && seg.length === 3) {
            const streams = (await list<RecurringSupport>(env.DB, 'recurring-support'))
              .filter((s) => s.roundId === round.id);
            return json({ roundId: round.id, streams });
          }
          if (req.method === 'GET' && seg[3] === 'tx') {
            const cfg = chainCfg(env);
            if (!cfg) return err('chain mode off — set CHAIN_MODE=celo', 503);
            const sender = url.searchParams.get('sender');
            const token = url.searchParams.get('token');
            const receiver = url.searchParams.get('receiver');
            const flowRate = url.searchParams.get('flowRate');
            if (!sender || !token || !receiver || !flowRate)
              return err('sender, token, receiver, flowRate (int96 units/sec) required', 400);
            const op = url.searchParams.get('op') ?? 'create';
            const tx = op === 'delete'
              ? buildDeleteFlowTx({ token: token as `0x${string}`, sender: sender as `0x${string}`,
                  receiver: receiver as `0x${string}` })
              : buildCreateFlowTx({ token: token as `0x${string}`, sender: sender as `0x${string}`,
                  receiver: receiver as `0x${string}`, flowRate: BigInt(flowRate) });
            return json({ chain: cfg.name, forwarder: CFA_FORWARDER, tx,
              then: `POST /chain/record { kind: 'stream.create', entityId: '<streamId>', txHash }` });
          }
          if (req.method === 'POST' && seg.length === 3) {
            const b = await req.json() as Record<string, unknown>;
            const supporter = String(b.supporter ?? '');
            const token = String(b.token ?? '');
            const receiver = String(b.receiver ?? '');
            const flowRate = String(b.flowRate ?? '');
            if (!supporter || !token || !/^0x[0-9a-fA-F]{40}$/.test(receiver) || !flowRate)
              return err('supporter, token, receiver (0x…), flowRate required', 422);
            const s = RecurringSupport.parse({
              id: `rs-${round.id}-${supporter.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
              roundId: round.id,
              needNodeId: b.needNodeId ? String(b.needNodeId) : undefined,
              supporter, token, receiver: receiver as `0x${string}`, flowRate,
              createdAt: new Date().toISOString(),
            });
            await put(env.DB, 'recurring-support', s.id, s);
            await ledgerAppend(env.DB, supporter, 'stream.intended',
              { id: s.id, roundId: round.id, flowRate });
            return json(s, 201);
          }
        }
        if (seg[2] === 'yield') {
          if (req.method === 'GET') {
            const streams = (await list<YieldStream>(env.DB, 'yieldstream'))
              .filter((s) => s.roundId === round.id);
            return json({ roundId: round.id, streams,
              mechanism: 'sponsor holds the position; accrued yield credits the matching fund' });
          }
          if (req.method === 'POST') {
            if (!authed(req, env)) return err('unauthorized', 401);
            const b = await req.json() as Record<string, unknown>;
            const sponsor = String(b.sponsor ?? '');
            const holderAddress = String(b.holderAddress ?? '');
            const tokenAddress = String(b.tokenAddress ?? '');
            if (!sponsor || !/^0x[0-9a-fA-F]{40}$/.test(holderAddress)
              || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress))
              return err('sponsor + valid holderAddress/tokenAddress required', 422);
            const now = new Date().toISOString();
            const stream = YieldStream.parse({
              id: `ys-${round.id}-${sponsor.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
              roundId: round.id, sponsor, holderAddress, tokenAddress,
              label: String(b.label ?? 'aave aToken'),
              decimals: Number(b.decimals ?? 18),
              createdAt: now, updatedAt: now,
            });
            await put(env.DB, 'yieldstream', stream.id, stream);
            await ledgerAppend(env.DB, sponsor, 'yield.registered',
              { id: stream.id, roundId: round.id, tokenAddress });
            return json(stream, 201);
          }
        }
      }
      // ── Impact claims + attestations ────────────────────────────────
      if (seg[0] === 'claims') {
        if (req.method === 'POST' && seg.length === 1) {
          if (!authed(req, env)) return err('unauthorized', 401);
          const b = await req.json() as Record<string, unknown>;
          const p = await get<Possibility>(env.DB, 'possibility', String(b.possibilityId ?? ''));
          if (!p) return err('possibility not found', 404);
          const [nodes, checks, apps] = await Promise.all([
            list<PlanNode>(env.DB, 'plannode'),
            list<OracleCheck>(env.DB, 'oracle-check'),
            list<Appreciation>(env.DB, 'appreciation'),
          ]);
          const claim = buildClaim({
            possibility: p,
            nodes: nodes.filter((n) => n.possibilityId === p.id),
            checks: checks.filter((c) => c.nodeId && nodes.find((n) => n.id === c.nodeId)),
            appreciations: apps.filter((a) => a.possibilityId === p.id),
            id: b.id ? String(b.id) : undefined,
          });
          await put(env.DB, 'claim', claim.id, claim);
          await ledgerAppend(env.DB, 'api', 'claim.built', { id: claim.id, possibilityId: p.id });
          return json({ ...claim, lexicon: toHypercertLexicon(claim) }, 201);
        }
        if (req.method === 'GET' && seg.length === 1) {
          const claims = await list<ImpactClaim>(env.DB, 'claim');
          if (url.searchParams.get('format') === 'lexicon')
            return json({ claims: claims.map(toHypercertLexicon) });
          return json({ claims });
        }
        const claim = await get<ImpactClaim>(env.DB, 'claim', seg[1] ?? '');
        if (!claim) return err('claim not found', 404);
        if (req.method === 'GET' && seg.length === 2) {
          const atts = (await list<Attestation>(env.DB, 'attestation'))
            .filter((a) => a.claimId === claim.id);
          if (url.searchParams.get('format') === 'lexicon')
            return json(toHypercertLexicon(claim));
          if ((req.headers.get('accept') ?? '').includes('text/html'))
            return page(req, renderClaimPage, claim, atts,
              { chainReady: !!chainCfg(env) }, langFrom(url, req.headers.get('cookie')));
          return json({ ...claim, attestations: atts });
        }
        if (req.method === 'POST' && seg[2] === 'attest') {
          const b = await req.json() as Record<string, unknown>;
          const attester = String(b.attester ?? '');
          if (!attester) return err('attester required');
          const verdict = String(b.evaluation ?? 'positive');
          const att = Attestation.parse({
            id: `att-${claim.id}-${attester.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
            claimId: claim.id, attester,
            schemaRef: String(b.schemaRef ?? 'springforth.evaluation.v1'),
            payload: JSON.stringify(evaluationPayload({
              claim,
              verdict: verdict === 'negative' ? 'negative' : verdict === 'neutral' ? 'neutral' : 'positive',
              note: String(b.note ?? '').slice(0, 280),
            })),
            at: new Date().toISOString(),
          });
          await put(env.DB, 'attestation', att.id, att);
          await put(env.DB, 'claim', claim.id, { ...claim, state: 'attested' as const });
          await ledgerAppend(env.DB, attester, 'claim.attested', { id: claim.id, attestationId: att.id });
          return json(att, 201);
        }
        // Hypercert metadata document — the URI mintClaim points at.
        if (req.method === 'GET' && seg[2] === 'metadata') {
          const nodes = await list<PlanNode>(env.DB, 'plannode');
          const labels = claim.nodeIds
            .map((id) => nodes.find((n) => n.id === id)?.label ?? id);
          return json({
            name: claim.workScope,
            description: `Impact claim over ${labels.join(', ') || 'coordinated work'} — evaluated via attestations, never traded.`,
            work_scope: labels,
            work_timeframe: claim.timeframe,
            contributors: claim.contributors,
            evidence: claim.oracleCheckIds.map((id) => `springforth:check:${id}`),
            artifacts: claim.artifactRefs,
            external_url: `https://springforth.widespread.workers.dev/claims/${claim.id}`,
          });
        }
        // Unsigned mintClaim calldata — account= receives the claim.
        if (req.method === 'GET' && seg[2] === 'tx') {
          const cfg = chainCfg(env);
          if (!cfg) return err('chain disabled — set CHAIN_MODE=celo-sepolia|sepolia|celo', 503);
          if (!cfg.contracts.hypercertMinter)
            return err(`hypercert minter not deployed on ${cfg.name} — mint on celo`, 409);
          const account = url.searchParams.get('account');
          if (!account || !/^0x[0-9a-fA-F]{40}$/.test(account))
            return err('account=0x… required — address receiving the claim', 400);
          return json({
            chain: cfg.name,
            tx: buildMintClaimTx({ cfg, account: account as `0x${string}`,
              metadataUri: `https://springforth.widespread.workers.dev/claims/${claim.id}/metadata` }),
            then: `POST /chain/record { kind: 'claim.mint', entityId: '${claim.id}', txHash }`,
          });
        }
        // Artizen artifact links — external work evidence on the claim.
        if (req.method === 'POST' && seg[2] === 'artifacts') {
          const b = await req.json() as Record<string, unknown>;
          const ref = String(b.uri ?? b.ref ?? '');
          if (!/^https?:\/\//.test(ref)) return err('uri=https://… required', 422);
          const next = { ...claim, artifactRefs: [...claim.artifactRefs, ref] };
          await put(env.DB, 'claim', claim.id, next);
          await ledgerAppend(env.DB, String(b.actor ?? 'api'), 'claim.artifact',
            { id: claim.id, uri: ref });
          return json(next, 201);
        }
      }
      // ── Attestation on-chain publish ────────────────────────────────
      if (seg[0] === 'attestations' && req.method === 'GET' && seg[2] === 'tx') {
        const att = await get<Attestation>(env.DB, 'attestation', seg[1] ?? '');
        if (!att) return err('attestation not found', 404);
        const cfg = chainCfg(env);
        if (!cfg) return err('chain disabled — set CHAIN_MODE=celo-sepolia|sepolia|celo', 503);
        const schemaUid = url.searchParams.get('schemaUid');
        if (!schemaUid || !/^0x[0-9a-fA-F]{64}$/.test(schemaUid))
          return err('schemaUid=0x… required — register the schema via EAS SchemaRegistry first', 400);
        const payload = JSON.parse(att.payload) as { schema: string; values: Record<string, unknown> };
        const recipient = url.searchParams.get('recipient') ?? undefined;
        return json({
          chain: cfg.name, schemaRef: att.schemaRef,
          tx: buildAttestTx({ cfg, schemaUid: schemaUid as `0x${string}`,
            schema: payload.schema, values: payload.values,
            recipient: recipient as `0x${string}` | undefined }),
          then: `POST /chain/record { kind: 'attestation.publish', entityId: '${att.id}', txHash }`,
        });
      }
      // ── Retro rounds — badgeholders from EigenTrust ─────────────────
      if (seg[0] === 'retro') {
        if (req.method === 'POST' && seg.length === 1) {
          if (!authed(req, env)) return err('unauthorized', 401);
          const b = await req.json() as Record<string, unknown>;
          const rr = RetroRound.parse({
            id: String(b.id ?? `retro-${Date.now().toString(36)}`),
            title: String(b.title ?? ''), fund: b.fund,
            claimIds: b.claimIds ?? [], badgeholderCount: b.badgeholderCount,
            pointsPerBallot: b.pointsPerBallot,
            ballotClose: String(b.ballotClose), state: 'open',
          });
          await put(env.DB, 'retroround', rr.id, rr);
          await ledgerAppend(env.DB, 'api', 'retro.opened', { id: rr.id });
          return json(rr, 201);
        }
        if (req.method === 'GET' && seg.length === 1)
          return json(await loadRetro(env));
        const rr = await get<RetroRound>(env.DB, 'retroround', seg[1] ?? '');
        if (!rr) return err('retro round not found', 404);
        const ballots = (await list<RetroBallot>(env.DB, 'retroballot'))
          .filter((x) => x.roundId === rr.id);
        if (req.method === 'GET' && seg.length === 2) {
          return json({ ...rr, ballots, tally: tallyRound(rr, ballots) });
        }
        if (req.method === 'POST' && seg[2] === 'vote') {
          if (rr.state !== 'open') return err(`round is ${rr.state}`, 409);
          const b = await req.json() as Record<string, unknown>;
          const holder = String(b.badgeholder ?? '');
          const apps = await list<Appreciation>(env.DB, 'appreciation');
          if (!badgeholders(apps, rr.badgeholderCount).includes(holder))
            return err('not a badgeholder for this round', 403);
          const ballot = RetroBallot.parse({
            id: `ballot-${rr.id}-${holder.toLowerCase().replace(/\W+/g, '-')}`,
            roundId: rr.id, badgeholder: holder,
            weights: b.weights ?? {}, at: new Date().toISOString(),
          });
          await put(env.DB, 'retroballot', ballot.id, ballot);
          await ledgerAppend(env.DB, holder, 'retro.ballot', { roundId: rr.id });
          return json(ballot, 201);
        }
        if (req.method === 'POST' && seg[2] === 'tally') {
          if (!authed(req, env)) return err('unauthorized', 401);
          const tally = tallyRound(rr, ballots);
          const tallied = { ...rr, state: 'tallied' as const };
          await put(env.DB, 'retroround', rr.id, tallied);
          await ledgerAppend(env.DB, 'api', 'retro.tallied', { id: rr.id, tally });
          return json({ ...tallied, tally });
        }
      }
      // ── Assurance pledges on possibility cards ──────────────────────
      if (req.method === 'POST' && seg[0] === 'possibilities' && seg[2] === 'pledge') {
        const p = await get<Possibility>(env.DB, 'possibility', seg[1] ?? '');
        if (!p) return err('possibility not found', 404);
        const ct = req.headers.get('content-type') ?? '';
        const b = ct.includes('form')
          ? Object.fromEntries((await req.formData()).entries())
          : await req.json() as Record<string, unknown>;
        const pledger = String(b.pledger ?? b.actor ?? '');
        const amount = Number(b.amount ?? 0);
        if (!pledger || !(amount > 0)) return err('pledger and positive amount required');
        const eff = effectiveStatus(p);
        if (eff === 'expired' || eff === 'completed')
          return err(`possibility is ${eff}`, 409);
        const pledge = Pledge.parse({
          id: `pl-${p.id}-${pledger.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
          possibilityId: p.id, needNodeId: b.needNodeId ? String(b.needNodeId) : undefined,
          pledger, amount, currency: String(b.currency ?? 'USD'),
          state: 'pending', stateAt: new Date().toISOString(),
        });
        await put(env.DB, 'pledge', pledge.id, pledge);
        await ledgerAppend(env.DB, pledger, 'pledge.pending',
          { id: pledge.id, possibilityId: p.id, amount, currency: pledge.currency });
        const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
        return wantsHtml
          ? new Response(null, { status: 303, headers: { location: `/possibilities#${p.id}` } })
          : json(pledge, 201);
      }
      if (req.method === 'GET' && seg[0] === 'pledges')
        return json({ pledges: await list<Pledge>(env.DB, 'pledge') });
      // ── Council + forum — deliberation scoped to a live card ───────
      // Verifiers self-seat on quorum/completed cards; sponsors seat via
      // bound pledge (sweepPossibilities); declarer/participants auto-seat.
      if (req.method === 'POST' && seg[0] === 'possibilities' && seg[2] === 'council') {
        const p = await get<Possibility>(env.DB, 'possibility', seg[1] ?? '');
        if (!p) return err('possibility not found', 404);
        const ct = req.headers.get('content-type') ?? '';
        const b = ct.includes('form')
          ? Object.fromEntries((await req.formData()).entries())
          : await req.json() as Record<string, unknown>;
        const actor = String(b.actor ?? '');
        if (!actor) return err('actor required');
        const eff = effectiveStatus(p);
        if (eff !== 'quorum' && eff !== 'completed')
          return err('the council chamber opens at quorum', 409);
        const iso = new Date().toISOString();
        const seated = await seatCouncil(env, p.id, actor, 'verifier', iso);
        if (seated)
          await ledgerAppend(env.DB, actor, 'council.seated',
            { id: p.id, actor, role: 'verifier', selfDeclared: true });
        const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
        return wantsHtml
          ? new Response(null, { status: 303, headers: { location: `/possibilities#${p.id}` } })
          : json({ id: `seat-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}-verifier`, seated }, 201);
      }
      // Forum posts — quorum/completed only, council members only, every
      // post ledger-attributed. `parentId` threads replies.
      if (req.method === 'POST' && seg[0] === 'possibilities' && seg[2] === 'forum') {
        const p = await get<Possibility>(env.DB, 'possibility', seg[1] ?? '');
        if (!p) return err('possibility not found', 404);
        const ct = req.headers.get('content-type') ?? '';
        const b = ct.includes('form')
          ? Object.fromEntries((await req.formData()).entries())
          : await req.json() as Record<string, unknown>;
        const actor = String(b.actor ?? ''), text = String(b.text ?? '').slice(0, 600).trim();
        if (!actor || !text) return err('actor and text required');
        const eff = effectiveStatus(p);
        if (eff !== 'quorum' && eff !== 'completed')
          return err('the forum opens at quorum', 409);
        const seats = (await list<CouncilSeat>(env.DB, 'council-seat'))
          .filter((s) => s.possibilityId === p.id);
        if (!seats.some((s) => s.actor === actor))
          return err('forum posts are council-only — join the council first', 403);
        const kind = (['note', 'evidence', 'objection', 'review'] as const)
          .includes(b.kind as 'note') ? b.kind as ForumPost['kind'] : 'note';
        const parentId = b.parentId ? String(b.parentId) : undefined;
        if (parentId) {
          const parent = await get<ForumPost>(env.DB, 'forum-post', parentId);
          if (!parent || parent.possibilityId !== p.id) return err('parent post not found on this card', 422);
        }
        const post = ForumPost.parse({
          id: `fp-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`,
          possibilityId: p.id, parentId, actor, kind, text, at: new Date().toISOString(),
        });
        await put(env.DB, 'forum-post', post.id, post);
        await ledgerAppend(env.DB, actor, 'forum.posted',
          { id: post.id, possibilityId: p.id, kind });
        const wantsHtml = ct.includes('form') || (req.headers.get('accept') ?? '').includes('text/html');
        return wantsHtml
          ? new Response(null, { status: 303, headers: { location: `/possibilities#${p.id}` } })
          : json(post, 201);
      }
      if (req.method === 'GET' && seg[0] === 'councils')
        return json({ seats: await list<CouncilSeat>(env.DB, 'council-seat') });
      if (req.method === 'GET' && seg[0] === 'forum')
        return json({ posts: await list<ForumPost>(env.DB, 'forum-post') });
      // ── /map — the geography surface. Server-rendered SVG, no tiles,
      // no CDN, no JS — markers link into the deck.
      if (req.method === 'GET' && seg[0] === 'map' && seg.length === 1) {
        const [poss, nodes] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<PlanNode>(env.DB, 'plannode'),
        ]);
        const now = Date.now();
        const markers: { id: string; lat: number; lon: number; status: string; title: string; href: string }[] = [];
        const unlocated: { id: string; title: string; place?: string }[] = [];
        for (const p of poss) {
          const g = resolvePlace(p, nodes);
          if (g) markers.push({ id: p.id, lat: g.lat, lon: g.lon,
            status: effectiveStatus(p, now), title: p.title, href: `/possibilities#${p.id}` });
          else unlocated.push({ id: p.id, title: p.title, place: p.place });
        }
        // Evidence layer — field reports / planting records carry their own
        // h3 (Sarafu field reports, Treegens). Possibility-owned nodes are
        // excluded: their card already marks the spot.
        const evidence = nodes
          .filter((n) => n.kind === 'action' && n.h3 && isValidCell(n.h3)
            && !n.source?.startsWith('possibility:'))
          .map((n) => {
            const [lat, lon] = cellToLatLng(n.h3!);
            return { id: n.id, lat, lon, status: 'evidence', title: n.label,
              href: `/collaborate?node=${encodeURIComponent(n.id)}` };
          });
        const lang = langFrom(url, req.headers.get('cookie'));
        return wantsHtml(req)
          ? page(req, renderMapPage, { lang, markers, evidence, unlocated })
          : json({ markers, evidence, unlocated });
      }
      // ── Chain lane — status + tx recording + confirmation mirror ────
      if (seg[0] === 'chain') {
        const cfg = chainCfg(env);
        if (req.method === 'GET' && seg.length === 1) {
          const pending = await list<ChainTx>(env.DB, 'chaintx');
          return json({
            mode: env.CHAIN_MODE ?? 'off',
            ...(cfg ? { chain: cfg.name, chainId: cfg.chainId,
              explorer: cfg.explorer, contracts: cfg.contracts } : {}),
            pending: pending.filter((t) => t.status === 'submitted').length,
            flow: 'GET tx endpoints build unsigned calldata → wallet signs+submits → POST /chain/record → hourly cron confirms receipts',
          });
        }
        if (req.method === 'GET' && seg[1] === 'pending')
          return json({ pending: await list<ChainTx>(env.DB, 'chaintx') });
        // ── Stellar lane — claimable-balance primitives, unsigned XDR ──
        // kind=pledge: destination claims before ?deadline=, source
        //   reclaims after (dominant assurance, no contract).
        // kind=payment: plain settle payment.
        // kind=unlock:  destination claims only at/after ?unlock=.
        // Sequence is read from Horizon at request time; the wallet
        // (Freighter et al.) signs the returned envelope XDR.
        if (req.method === 'GET' && seg[1] === 'stellar' && seg[2] === 'tx') {
          const q = url.searchParams;
          const net = stellarNetFor(q.get('net') ?? 'stellar-testnet');
          const kind = q.get('kind') ?? 'pledge';
          const source = q.get('source') ?? '';
          if (!isStellarId(source))
            return err('source=G… required — the signing account', 400);
          const amount = q.get('amount') ?? '';
          if (!(Number(amount) > 0)) return err('amount (units, e.g. 25.5) required', 400);
          const assetCode = q.get('asset') ?? undefined;
          const assetIssuer = q.get('issuer') ?? undefined;
          if (assetCode && assetCode !== 'XLM' && !isStellarId(assetIssuer ?? ''))
            return err('issuer=G… required for non-XLM assets', 400);
          const secs = (k: string) => {
            const v = q.get(k) ?? '';
            const t = /^\d+$/.test(v) ? Number(v) : Math.floor(Date.parse(v) / 1000);
            return Number.isFinite(t) && t > 0 ? t : 0;
          };
          const memo = q.get('memo') ?? undefined;
          const sequence = await fetchSequence(net, source)
            .catch((e) => ({ error: String(e) }) as { error: string });
          if (typeof sequence !== 'string')
            return err(`horizon lookup failed for ${source} — ${sequence.error}`, 502);
          const base = { net, source, sequence, amount, assetCode, assetIssuer, memo };
          if (kind === 'pledge') {
            const claimant = q.get('claimant') ?? '';
            if (!isStellarId(claimant)) return err('claimant=G… required', 400);
            const deadlineSec = secs('deadline');
            if (!deadlineSec) return err('deadline required — epoch secs or ISO date', 400);
            return json({
              network: net.name, step: 'createClaimableBalance (assurance pledge)',
              tx: buildStellarPledgeTx({ ...base, claimant, deadlineSec }),
              semantics: 'claimant claims while now < deadline; source reclaims after — refund is trustless',
              then: `sign XDR in wallet → submit → POST /chain/stellar/record { txHash, entityId }`,
            });
          }
          if (kind === 'payment') {
            const destination = q.get('destination') ?? '';
            if (!isStellarId(destination)) return err('destination=G… required', 400);
            return json({
              network: net.name, step: 'payment',
              tx: buildStellarPaymentTx({ ...base, destination }),
              then: `sign XDR in wallet → submit → POST /chain/stellar/record { txHash, entityId }`,
            });
          }
          if (kind === 'unlock') {
            const claimant = q.get('claimant') ?? '';
            if (!isStellarId(claimant)) return err('claimant=G… required', 400);
            const unlockSec = secs('unlock');
            if (!unlockSec) return err('unlock required — epoch secs or ISO date', 400);
            return json({
              network: net.name, step: 'createClaimableBalance (scheduled release)',
              tx: buildStellarUnlockTx({ ...base, claimant, unlockSec }),
              semantics: 'claimant can claim only at/after unlock — milestone-gated disbursement',
              then: `sign XDR in wallet → submit → POST /chain/stellar/record { txHash, entityId }`,
            });
          }
          return err('kind must be pledge|payment|unlock', 422);
        }
        // Stellar tx hash recording — the hash is a 32-byte digest of the
        // envelope; ledger-attributed against an existing entity. Horizon
        // confirm polling is wallet-side for now (no cron claim).
        if (req.method === 'POST' && seg[1] === 'stellar' && seg[2] === 'record') {
          const b = await req.json() as Record<string, unknown>;
          const txHash = String(b.txHash ?? '');
          const entityId = String(b.entityId ?? '');
          if (!/^[0-9a-fA-F]{64}$/.test(txHash)) return err('txHash must be 64 hex (Stellar digest)', 422);
          const hit = await get<unknown>(env.DB, 'pledge', entityId)
            ?? await get<unknown>(env.DB, 'possibility', entityId)
            ?? await get<unknown>(env.DB, 'donation', entityId);
          if (!hit) return err('entityId not found (pledge/possibility/donation)', 404);
          await ledgerAppend(env.DB, String(b.actor ?? 'api'), 'stellar.tx.submitted',
            { entityId, txHash });
          return json({ ok: true, entityId, txHash,
            note: 'recorded on the ledger; confirm via Horizon' }, 201);
        }
        if (req.method === 'POST' && seg[1] === 'record') {
          const b = await req.json() as Record<string, unknown>;
          if (!cfg) return err('chain disabled — set CHAIN_MODE=celo-sepolia|sepolia|celo', 503);
          const txHash = String(b.txHash ?? '');
          const kind = String(b.kind ?? '') as ChainTx['kind'];
          const entityId = String(b.entityId ?? '');
          if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return err('txHash must be 0x + 64 hex', 422);
          if (!['round.create', 'donation.settle', 'claim.mint', 'attestation.publish', 'stream.create', 'stream.delete'].includes(kind))
            return err('kind must be a supported chain-tx kind', 422);
          // entity must exist before we track its tx
          const kindStore = { 'round.create': 'round', 'donation.settle': 'donation',
            'stream.create': 'recurring-support', 'stream.delete': 'recurring-support',
            'claim.mint': 'claim', 'attestation.publish': 'attestation' }[kind];
          const entity = await get<unknown>(env.DB, kindStore, entityId);
          if (!entity) return err(`${kindStore} not found`, 404);
          const tx = ChainTx.parse({
            id: `ct-${txHash.slice(2, 10)}-${entityId.slice(0, 24)}`,
            txHash, chainId: cfg.chainId, kind, entityId,
            submittedAt: new Date().toISOString(),
          });
          await put(env.DB, 'chaintx', tx.id, tx);
          await ledgerAppend(env.DB, String(b.actor ?? 'api'), 'chaintx.submitted',
            { id: tx.id, kind, entityId, txHash });
          return json({ ...tx,
            confirm: 'hourly cron reads the receipt and marks confirmed + applies side effects' }, 201);
        }
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
        if (seg[1] === 'verify') {
          const v = await ledgerVerify(env.DB);
          return wantsHtml(req) ? page(req, renderLedgerVerifyPage, v, langFrom(url, req.headers.get('cookie'))) : json(v);
        }
        const events = await ledgerEvents(env.DB);
        if (wantsHtml(req) && url.searchParams.get('format') !== 'json')
          return page(req, renderLedgerPage, events, await ledgerVerifyIncremental(env.DB), langFrom(url, req.headers.get('cookie')));
        return json({ events });
      }
      if ((req.headers.get('accept') ?? '').includes('text/html')) {
        const lang = langFrom(url, req.headers.get('cookie'));
        return new Response(pageShell({ title: `${t(lang, 'nf.title')} — Springforth`, htmx: false, lang }, `<div class="page">
${pageHeader({ kicker: t(lang, 'nf.kicker'), title: t(lang, 'nf.h1'),
  em: t(lang, 'nf.h1.em'), lede: t(lang, 'nf.lede') })}
<p><a href="/possibilities">${t(lang, 'nf.deck')}</a> · <a href="/">${t(lang, 'nf.home')}</a></p>
</div>`), { status: 404, headers: { 'content-type': 'text/html' } });
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
    const chainConfirmed = await syncChain(env).catch(() => 0);
    const streamsAccrued = await accrueStreams(env).catch(() => 0);
    const yieldCredited = await syncYield(env).catch(() => 0);
    await ledgerAppend(env.DB, 'cron', 'oracle.cycle',
      { nodes: nodes.length, chainConfirmed, yieldCredited, at: new Date().toISOString() });
  },
};
