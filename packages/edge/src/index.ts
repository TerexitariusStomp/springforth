import {
  Possibility, Participation, Appreciation, Pass, AssuranceCredit,
  OracleCheck, Signal,
  FundingRound, Donation, Pledge, ImpactClaim, Attestation,
  RetroRound, RetroBallot, ChainTx, YieldStream,
  ActorWallet, RoundApplication, RecurringSupport,
  GovernanceProposal, GovernanceBallot, GovernanceParam,
  DatasetRelease, DataAccessGrant, Subscription,
  valueCoordinated, roundDemand, endowmentAccrual,
} from '@springforth/core';
import {
  allocateMatching, pairwiseAllocate, refreshPledge, badgeholders, tallyRound,
  buildClaim, toHypercertLexicon,
  eligibleVoters, tallyProposal, paramValue, GOVERNABLE,
} from '@springforth/funding';
import { to360Giving } from '@springforth/export-360giving';
import { toIati } from '@springforth/export-iati';
import { outcomePayload, evaluationPayload } from '@springforth/attest';
import {
  chainFor, buildCreateProfileTx, buildCreateRoundTx,
  buildAttestTx, buildMintClaimTx, publicClientFor,
  parseAttestedUid, parsePoolId, readTokenBalance,
  yieldDeltaUnits, unitsToStable, verifyWalletBinding,
  buildCreateFlowTx, buildDeleteFlowTx, parseFlowRate, streamAccrual,
  CFA_FORWARDER, type ChainConfig,
} from '@springforth/chain-celo';
import {
  renderCoordinationPage, renderPossibilitiesPage, renderLandingPage,
  renderPortfolioPage, renderOutcomesPage, renderRoundsPage, renderRoundPage,
  renderReportPage, renderRoundAdmin, renderActorProfile, renderDonorPage,
  renderClaimPage, renderGovernancePage, renderDocsPage, renderTourPage, renderAllPage, langFrom,
  renderWhitepaper,
  tickerLines, tickerHtml, pageShell, FAVICON_SVG,
} from '@springforth/portal';
import { PICO_CSS, HTMX_JS } from './vendor.js';
import { ogPng } from './og.js';
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
import {
  fromSilviProjects, fetchSilviProject, fetchSilviTrees, fetchLeafScore,
} from '@springforth/silvi-adapter';
import { answer as agentAnswer } from '@springforth/agent';
import { buildManifest } from '@springforth/evidence-anchor';
import { OPENAPI } from './openapi.ts';
import {
  checkFromReading, EXPECTED_DIRECTION, SOURCES,
  openaqPm25, sensorCommunity, nasaPower, sentinel2, gbifOccurrences,
  treegensPlantings, atlasHazard, trajectory,
  silviVerifiedTrees, silviLeafAptness, evidenceBoost,
  eaFlood, openMeteo, eaWaterQuality, foodHygiene, inatObservations,
  osDataHubPlaces, eoDataHubScene, alphaKlimaHazard, naturalEnglandSites,
  placeContext,
  type SourceReading, type GeoLoc,
} from '@springforth/oracle';
import { liveAtlas } from '@springforth/atlas-adapter';
import { handleTelegramUpdate, sendTelegram } from './telegram.js';
import { cellToLatLng, isValidCell } from 'h3-js';
import { get, list, put, ledgerAppend, ledgerEvents, ledgerVerify } from './store.js';

// Springforth edge API — the coordination layer. Public reads;
// ADMIN_TOKEN-gated writes. All state in D1; all semantics in
// @springforth/* packages; no wallet anywhere.

interface Env {
  DB: D1Database;
  SELF?: Fetcher;               // service binding to this worker — /all inlining
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
  SILVI_API_KEY?: string;         // silvi.earth App API — issued PER PROJECT
  SILVI_PROJECT_ID?: string;      // the project SILVI_API_KEY unlocks
  SILVI_API_URL?: string;         // defaults to https://app.silvi.earth
  OS_DATAHUB_KEY?: string;        // Ordnance Survey Data Hub
  EODATAHUB_KEY?: string;         // EO Data Hub (Satellite Applications Catapult)
  ALPHAKLIMA_KEY?: string;        // Alpha-Klima physrisk platform
  DEFRA_KEY?: string;             // defra data services / Natural England
  COMPANIES_HOUSE_KEY?: string;   // api.company-information.service.gov.uk
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


// Volunteer-time benchmark (treasury lane): ONS Household Satellite
// Accounts 2017 rate, as cited by NCVO and the DCMS volunteering-value
// methodology (replacement-cost method). Applied only to GB-placed
// cards — no cited Kenya rate is carried yet, an honest gap.
const VOLUNTEER_GB = {
  key: 'GB', hourRate: 14.43, currency: 'GBP',
  source: 'ONS Household Satellite Accounts (2017)',
  riskPerHome: 30_000, riskSource: 'Environment Agency / ABI (2025)',
};
const GB_PLACE = /shrewsbury|severn|london|england|britain|uk\b|manchester|bristol|oxford|cardiff|edinburgh|birmingham|leeds|glasgow/i;

// Donations + derived match per need node (match is computed per round,
// mapped back by needNodeId). Shared by the deck and /metrics.
async function fundingMaps(env: Env) {
  const [dons, rnds] = await Promise.all([
    list<Donation>(env.DB, 'donation'), list<FundingRound>(env.DB, 'round'),
  ]);
  const matchByNeed = new Map<string, { needNodeId: string; amount: number; currency: string }>();
  const [pledges, nodes] = await Promise.all([
    list<Pledge>(env.DB, 'pledge'), list<PlanNode>(env.DB, 'plannode'),
  ]);
  const needPoss = new Map(nodes.filter((n) => n.possibilityId != null)
    .map((n) => [n.id, n.possibilityId!]));
  for (const r of rnds) {
    // Demand gate + endowment: locked rounds contribute no match — proven
    // demand before treasury flows (Commons mechanic); endowment never
    // allocates its locked principal.
    if (r.endowment || !roundDemand(r, pledges, needPoss).active) continue;
    const alloc = await allocFor(env, r, dons.filter((d) => d.roundId === r.id));
    for (const a of alloc) {
      // Two rounds can fund the same need — matches accumulate per currency.
      const key = `${a.needNodeId}|${r.matchingFund.currency}`;
      const prev = matchByNeed.get(key);
      matchByNeed.set(key, { needNodeId: a.needNodeId,
        amount: (prev?.amount ?? 0) + a.match, currency: r.matchingFund.currency });
    }
  }
  return { dons, rnds, matchByNeed };
}

// Round allocation dispatcher — 'lr' is classic quadratic; 'pairwise'
// discounts coordinated donor pairs via the appreciation trust graph +
// bound-wallet clusters (Phase A moat). Conviction adds time-weight.
async function allocFor(env: Env, round: FundingRound, donations: Donation[]) {
  // Evidence→allocation coupling: oracle trajectory per need becomes a
  // 0.8–1.2 weight multiplier (Phase E). Governance can disable it.
  const checks = await list<OracleCheck>(env.DB, 'oracle-check');
  const govParams = await list<GovernanceParam>(env.DB, 'gov-param');
  const evidenceOn = paramValue(govParams, 'evidence.boost') !== '0';
  const boost = (needNodeId: string) =>
    evidenceOn ? evidenceBoost(needNodeId, checks) : 1;
  if (round.matchingMode !== 'pairwise' && !round.conviction)
    return allocateMatching(round, donations, { weightMultiplier: boost });
  const [apps, wallets] = await Promise.all([
    list<Appreciation>(env.DB, 'appreciation'),
    list<ActorWallet>(env.DB, 'actor-wallet'),
  ]);
  const walletToActor = new Map(wallets.map((w) => [w.address.toLowerCase(), w.actor]));
  return pairwiseAllocate(round, donations, trustEdges(apps), {
    alpha: Number(paramValue(govParams, 'pairwise.alpha')) || 4,
    beta: Number(paramValue(govParams, 'pairwise.beta')) || 2,
    gamma: round.conviction ? Number(paramValue(govParams, 'conviction.gamma')) || 0.5 : 0,
    weightMultiplier: boost,
    walletFor: (donor) => {
      const lower = donor.toLowerCase();
      return walletToActor.get(lower) ?? donor;
    },
  });
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

// Which store slices are exportable as datasets.
const DATASET_SOURCES: Record<string, { kind: string; describe: string }> = {
  plannodes:    { kind: 'plannode',    describe: 'plan graph nodes — actions, needs, offers, outcomes' },
  signals:      { kind: 'signal',      describe: 'support/interest/field-report signals' },
  donations:    { kind: 'donation',    describe: 'donation records incl. settlement refs' },
  'oracle-checks': { kind: 'oracle-check', describe: 'evidence scores per node per source' },
  overlaps:     { kind: 'overlap',     describe: 'detected overlap/complement records' },
  appreciations:{ kind: 'appreciation',describe: 'pairwise appreciation edges' },
};

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
    atlasHazard(node.h3!, liveAtlas()).catch(() => null),
    silviVerifiedTrees(loc, {
      trees: () => env.SILVI_PROJECT_ID
        ? fetchSilviProject(env.SILVI_PROJECT_ID, env.SILVI_API_URL, env.SILVI_API_KEY)
            .then((p) => p?.trees ?? null)
        : fetchSilviTrees(env.SILVI_API_URL, env.SILVI_API_KEY),
    }).catch(() => null),
    silviLeafAptness(loc, { leaf: (l) => fetchLeafScore(l) }).catch(() => null),
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
const authed = (req: Request, env: Env) =>
  !!env.ADMIN_TOKEN && req.headers.get('authorization') === `Bearer ${env.ADMIN_TOKEN}`;

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
      await notifySubscribers(env, p.id, 'quorum',
        `Quorum reached: ${p.title} — commitment bound`,
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

// /verify — open-evidence readings grouped by target node. Confidence is
// reported per-source; nothing here promotes a reading to truth.
function renderVerifyPage(checks: (OracleCheck & { nodeId?: string })[], nodes: PlanNode[]): string {
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const rows = checks.slice().reverse().slice(0, 200).map((c) => {
    const target = c.nodeId ? (label.get(c.nodeId) ?? c.nodeId) : '—';
    const cls = c.result === 'match' ? 'var(--sf-ok-bright)' : c.result === 'mismatch' ? 'var(--sf-danger)' : 'var(--sf-warn-soft)';
    return `<tr><td><span class="badge" style="background:${cls}">${esc(c.result)}</span></td>`
      + `<td>${esc(c.source)}</td><td>${esc(target)}</td><td>${esc(c.detail)}</td>`
      + `<td class="muted">${esc(c.at.slice(0, 16).replace('T', ' '))}</td></tr>`;
  }).join('\n');
  return pageShell({ title: 'Verify — Springforth', htmx: false }, `<div class="page">
<h1>Open-evidence readings</h1>
<p class="lede">Independent public sources scored per reading — remote sensing, sensors,
field evidence, biodiversity records. A reading is evidence for review,
not proof: human validation stays authoritative.
<a href="/sources">source registry (JSON)</a></p>
<table><tr><th>Result</th><th>Source</th><th>Target</th><th>Detail</th><th>At</th></tr>
${rows || '<tr><td colspan="5"><em>No readings yet — POST /oracle/run after seeding geo-located nodes.</em></td></tr>'}</table>
<p class="muted">generated ${new Date().toISOString()}</p>
</div>`);
}

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
async function rateLimitOk(env: Env, key: string, limit: number): Promise<boolean> {
  const now = Date.now();
  const windowMs = 60_000;
  const id = `rl-${key}`;
  const rec = await get<{ windowStart: number; count: number }>(env.DB, 'ratelimit', id);
  if (!rec || now - rec.windowStart > windowMs) {
    await put(env.DB, 'ratelimit', id, { windowStart: now, count: 1 });
    return true;
  }
  if (rec.count >= limit) return false;
  await put(env.DB, 'ratelimit', id, { ...rec, count: rec.count + 1 });
  return true;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // CORS preflight short-circuit.
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(env, req.headers.get('origin')) });
    const res = await this.handle(req, env).catch((e) =>
      json({ error: 'internal', detail: String(e) }, 500));
    return withCors(res, env, req);
  },
  async handle(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const seg = url.pathname.split('/').filter(Boolean);
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
    try {
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
          list<Possibility>(env.DB, 'possibility'), ledgerEvents(env.DB),
        ]);
        const possById = new Map(poss.map((p) => [p.id, p]));
        return new Response(tickerHtml(tickerLines(events, possById)),
          { headers: { 'content-type': 'text/html' } });
      }
      // GET / → the triage landing: how it works + what needs attention
      if (req.method === 'GET' && seg.length === 0) {
        const [poss, parts, recs, nodes, plans, events] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<OverlapRecord>(env.DB, 'overlap'), list<PlanNode>(env.DB, 'plannode'),
          list<ExternalPlan>(env.DB, 'plan'), ledgerEvents(env.DB),
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
        return new Response(renderLandingPage({
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
        const rows = SOURCES.map((s) => ({
          ...s,
          configured: s.needs ? !!env[s.needs as 'OPENAQ_API_KEY'] : true,
          lastFetch: snapshots.filter((x) => x.source === s.source).at(-1)?.latest?.at ?? null,
        }));
        if ((req.headers.get('accept') ?? '').includes('text/html')) {
          const tr = rows.map((s) => `<tr><td><code>${s.key}</code></td><td>${s.name}</td><td>${s.license}</td><td>${s.configured ? '✅ live' : `key-gated (<code>${s.needs}</code>)`}</td><td>${s.lastFetch ?? '—'}</td></tr>`).join('');
          return new Response(pageShell({ title: 'Data sources — Springforth', htmx: false }, `<div class="page">
<h1>Evidence + context sources</h1>
<p class="lede">Oracle readers run hourly per h3-located action node; context connectors attach as "Verified context" on possibility cards. Selection follows the hackathon-endorsed ranking — full matrix in <a href="https://github.com/TerexitariusStomp/springforth/blob/main/docs/hackathon/DATA-SOURCES.md">DATA-SOURCES.md</a>. Key-gated lanes activate when their env secret lands.</p>
<table><tr><th>key</th><th>source</th><th>license</th><th>state</th><th>last fetch</th></tr>${tr}</table>
<p class="muted"><a href="/tour">judge tour</a></p></div>`), { headers: { 'content-type': 'text/html' } });
        }
        return json({ sources: rows });
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
      // Silvi sync — pull a verified reforestation project into the plan
      // graph. Silvi keys are issued per project: SILVI_API_KEY +
      // SILVI_PROJECT_ID, or an ad-hoc {projectId, apiKey} in the body.
      if (req.method === 'POST' && seg[0] === 'silvi' && seg[1] === 'sync') {
        if (!authed(req, env)) return err('unauthorized', 401);
        const body = await req.json().catch(() => ({})) as { projectId?: string; apiKey?: string };
        const projectId = body.projectId ?? env.SILVI_PROJECT_ID;
        const apiKey = body.apiKey ?? env.SILVI_API_KEY;
        if (!projectId)
          return err('SILVI_PROJECT_ID unset — pass {projectId} (and apiKey if not in secrets)', 400);
        const project = await fetchSilviProject(projectId, env.SILVI_API_URL, apiKey);
        if (!project)
          return err(`silvi api unreachable or key invalid for project ${projectId}`, 502);
        const plan = fromSilviProjects([project], 'silvi:app');
        await put(env.DB, 'plan', `${plan.id}-${project.id}`,
          { ...plan, id: `${plan.id}-${project.id}`, title: `Silvi — ${project.name}`, nodes: undefined, nodeCount: plan.nodes.length });
        for (const n of plan.nodes) await put(env.DB, 'plannode', n.id, n);
        const nodes = await list<PlanNode>(env.DB, 'plannode');
        const keep = new Map((await list<OverlapRecord>(env.DB, 'overlap')).map((o) => [o.id, o]));
        const detected = [...detectOverlaps(nodes), ...detectComplements(nodes)];
        for (const rec of detected) {
          const prior = keep.get(rec.id);
          await put(env.DB, 'overlap', rec.id, prior && prior.status !== 'proposed' ? prior : rec);
        }
        await ledgerAppend(env.DB, 'api', 'silvi.synced', {
          project: project.id, nodes: plan.nodes.length, overlaps: detected.length,
        });
        return json({ project: project.name, nodes: plan.nodes.length, overlaps: detected.length }, 201);
      }
      // Governance — trust-gated parameter ballots. EigenTrust-standing
      // actors vote quadratically on mechanism parameters.
      if (seg[0] === 'governance') {
        const proposals = await list<GovernanceProposal>(env.DB, 'gov-proposal');
        const ballots = await list<GovernanceBallot>(env.DB, 'gov-ballot');
        const params = await list<GovernanceParam>(env.DB, 'gov-param');
        const govApps = await list<Appreciation>(env.DB, 'appreciation');
        const voters = eligibleVoters(govApps);
        if (req.method === 'GET' && seg.length === 1) {
          if ((req.headers.get('accept') ?? '').includes('text/html'))
            return new Response(renderGovernancePage({
              proposals, ballots, params, governable: GOVERNABLE,
              voterCount: voters.length,
            }), { headers: { 'content-type': 'text/html' } });
          return json({ proposals, ballots, params,
            governable: GOVERNABLE, eligibleVoters: voters });
        }
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
            ? new Response(null, { status: 303, headers: { location: '/governance' } })
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
            ? new Response(null, { status: 303, headers: { location: '/governance' } })
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
          return new Response(renderDocsPage(OPENAPI.paths), { headers: { 'content-type': 'text/html' } });
        return json(OPENAPI);
      }
      if (seg[0] === 'tour' && req.method === 'GET')
        return new Response(renderTourPage(), { headers: { 'content-type': 'text/html' } });
      if (seg[0] === 'whitepaper' && req.method === 'GET')
        return new Response(renderWhitepaper(), { headers: { 'content-type': 'text/html' } });
      // Every surface on one scrollable page — review mode.
      if (seg[0] === 'all' && req.method === 'GET')
        return new Response(await renderAllPage(env.SELF ?? { fetch }, url.origin),
          { headers: { 'content-type': 'text/html' } });
      // Recurring support streams — top-level list; round-scoped view
      // also exists at /rounds/:id/stream.
      if (seg[0] === 'streams' && req.method === 'GET') {
        const streams = await list<RecurringSupport>(env.DB, 'recurring-support');
        const yieldStreams = await list<YieldStream>(env.DB, 'yieldstream');
        if ((req.headers.get('accept') ?? '').includes('text/html'))
          return new Response(pageShell({ title: 'Streams — Springforth', htmx: false }, `<div class="page">
<h1>Recurring support</h1>
<p class="lede">Superfluid CFA streams on Celo — continuous backing that accrues into
donation records hourly (need-targeted) or into the round's matching fund
(untargeted). Sponsors sign the flow in their own wallet; nothing custodies.</p>
<table><tr><th>Stream</th><th>Round</th><th>Accrued</th><th>Status</th></tr>
${streams.map((s) => `<tr><td>${s.id}</td><td>${s.roundId}</td>
<td>${s.accruedUnits} units</td><td><span class="badge">${s.state}</span></td></tr>`).join('')
  || '<tr><td colspan="4"><em>No streams yet — POST /rounds/:id/stream returns unsigned createFlow calldata for a wallet to sign.</em></td></tr>'}
${yieldStreams.map((s) => `<tr><td>${s.id} (yield)</td><td>${s.roundId}</td>
<td>sponsor aToken position</td><td><span class="badge">${s.state}</span></td></tr>`).join('')}
</table></div>`),
            { headers: { 'content-type': 'text/html' } });
        return json({ streams, yieldStreams });
      }
      // Attestations list — EAS payloads stored for claims/donations.
      if (seg[0] === 'attestations' && req.method === 'GET' && seg.length === 1) {
        const atts = await list<Attestation>(env.DB, 'attestation');
        return json({ attestations: atts });
      }
      if (seg[0] === 'datasets') {
        if (req.method === 'GET' && seg.length === 1) {
          const releases = await list<DatasetRelease>(env.DB, 'dataset-release');
          const available = Object.fromEntries(
            Object.entries(DATASET_SOURCES).map(([k, v]) => [k, v.describe]));
          if ((req.headers.get('accept') ?? '').includes('text/html'))
            return new Response(pageShell({ title: 'Datasets — Springforth', htmx: false }, `<div class="page">
<h1>Signed dataset releases</h1>
<p class="lede">Frozen graph slices — sha256-manifested, OpenTimestamps-anchored, IPFS-
pinnable. Aggregates are public; premium raw feeds move through
payment-referenced access grants. This is the data-revenue lane.</p>
<h2>Releases</h2>
<table><tr><th>Dataset</th><th>Records</th><th>sha256</th><th>CID</th><th>Released</th></tr>
${releases.map((r) => `<tr><td>${r.name}</td><td>${r.records}</td>
<td><code>${r.sha256.slice(0, 12)}…</code></td>
<td>${r.cid ? `<code>${r.cid.slice(0, 12)}…</code>` : '—'}</td>
<td class="muted">${r.createdAt.slice(0, 10)}</td></tr>`).join('')
  || '<tr><td colspan="5"><em>No releases yet — POST /datasets/:name/release (admin) freezes a slice.</em></td></tr>'}
</table>
<h2>Available slices</h2>
<table><tr><th>Name</th><th>Contents</th></tr>
${Object.entries(available).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${v}</td></tr>`).join('')}
</table></div>`),
              { headers: { 'content-type': 'text/html' } });
          return json({ releases, available });
        }
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
            householdsProtected: b.householdsProtected ? Number(b.householdsProtected) : undefined,
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
          await sweepPossibilities(env);
          const [poss, nodes, recs, parts, apps, passes, { dons, matchByNeed }] = await Promise.all([
            list<Possibility>(env.DB, 'possibility'), list<PlanNode>(env.DB, 'plannode'),
            list<OverlapRecord>(env.DB, 'overlap'), list<Participation>(env.DB, 'participation'),
            list<Appreciation>(env.DB, 'appreciation'), list<Pass>(env.DB, 'pass'),
            fundingMaps(env),
          ]);
          const possByNeed = new Map(nodes.filter((n) => n.kind === 'need')
            .map((n) => [n.id, n.possibilityId]));
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
          return new Response(renderPossibilitiesPage(cards, edges, viewer, {
            status: url.searchParams.get('status') ?? '',
            lang: langFrom(url, req.headers.get('cookie')),
          }), { headers: { 'content-type': 'text/html' } });
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
          return new Response(renderReportPage({
            possibility: p,
            participants: parts.filter((x) => x.possibilityId === p.id),
            nodes: myNodes,
            checks: checks.filter((c) => c.nodeId && myNodes.some((n) => n.id === c.nodeId)),
            appreciations: apps.filter((a) => a.possibilityId === p.id),
            claim,
            trajectories: myNodes.map((n) => trajectory(n.id, checks)),
          }), { headers: { 'content-type': 'text/html' } });
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
          return new Response(renderActorProfile({
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
          }), { headers: { 'content-type': 'text/html' } });
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
        const [poss, parts, apps, recs, { dons, matchByNeed }, nodes] = await Promise.all([
          list<Possibility>(env.DB, 'possibility'), list<Participation>(env.DB, 'participation'),
          list<Appreciation>(env.DB, 'appreciation'), list<OverlapRecord>(env.DB, 'overlap'),
          fundingMaps(env), list<PlanNode>(env.DB, 'plannode'),
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
          // Monetary value, per currency (never converted) — committed and
          // matched are ledger-derived; volunteer time is declared hours ×
          // the cited ONS rate where the card places in GB. Aggregated per
          // card so rates stay local.
          ...(() => {
            const possByNeed = new Map(nodes.filter((n) => n.kind === 'need')
              .map((n) => [n.id, n.possibilityId]));
            const acc: Record<string, { committed: number; matched: number; inKind: number; volunteerTime: number; total: number; asked: number; riskAvoided: number; leverage: number; riskPerUnit: number }> = {};
            let hoursTotal = 0;
            for (const p of poss) {
              const mine = parts.filter((x) => x.possibilityId === p.id);
              const v = valueCoordinated({
                hours: mine.map((x) => x.hours ?? 0).filter((h) => h > 0),
                donations: dons.filter((d) => possByNeed.get(d.needNodeId) === p.id)
                  .map((d) => ({ amount: d.amount, currency: d.currency })),
                matched: [...matchByNeed.values()].filter((m) => possByNeed.get(m.needNodeId) === p.id)
                  .map((m) => ({ amount: m.amount, currency: m.currency })),
                inKind: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'offer' && n.budget != null)
                  .map((n) => ({ amount: n.budget!,
                    currency: n.budgetCurrency ?? (GB_PLACE.test(p.place ?? '') ? 'GBP' : 'USD') })),
                needsCost: nodes.filter((n) => n.possibilityId === p.id && n.kind === 'need' && n.budget != null)
                  .map((n) => ({ amount: n.budget!,
                    currency: n.budgetCurrency ?? (GB_PLACE.test(p.place ?? '') ? 'GBP' : 'USD') })),
                householdsProtected: p.householdsProtected,
                benchmark: GB_PLACE.test(p.place ?? '') ? VOLUNTEER_GB : undefined,
              });
              hoursTotal += v.hoursTotal;
              for (const [cur, cv] of Object.entries(v.byCurrency)) {
                const a = (acc[cur] ??= { committed: 0, matched: 0, inKind: 0, volunteerTime: 0, total: 0, asked: 0, riskAvoided: 0, leverage: 0, riskPerUnit: 0 });
                a.committed += cv.committed; a.matched += cv.matched;
                a.inKind += cv.inKind; a.volunteerTime += cv.volunteerTime; a.total += cv.total;
                a.asked += cv.asked; a.riskAvoided += cv.riskAvoided;
              }
            }
            // Ratios are derived post-sum — they must never be summed across cards.
            for (const a of Object.values(acc)) {
              a.leverage = a.committed > 0 ? Math.round(a.total / a.committed * 100) / 100 : 0;
              a.riskPerUnit = a.total > 0 && a.riskAvoided > 0 ? Math.round(a.riskAvoided / a.total * 100) / 100 : 0;
            }
            for (const a of Object.values(acc))
              for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = Math.round(a[k] * 100) / 100;
            return { valueByCurrency: acc, declaredHoursTotal: Math.round(hoursTotal * 100) / 100 };
          })(),
        });
      }
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
        if (req.method === 'GET' && seg.length === 1) {
          const rounds = await list<FundingRound>(env.DB, 'round');
          if (url.searchParams.get('format') === 'json') return json({ rounds });
          const [dons, pledges, rnodes] = await Promise.all([
            list<Donation>(env.DB, 'donation'), list<Pledge>(env.DB, 'pledge'),
            list<PlanNode>(env.DB, 'plannode'),
          ]);
          const needPoss = new Map(rnodes.filter((n) => n.possibilityId != null)
            .map((n) => [n.id, n.possibilityId!]));
          const gates = new Map(rounds.map((r) => [r.id, roundDemand(r, pledges, needPoss)]));
          const endow = endowmentAccrual(rounds, dons);
          return new Response(renderRoundsPage(rounds, dons, gates, endow),
            { headers: { 'content-type': 'text/html' } });
        }
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
          return new Response(renderRoundPage(round, donations, allocation, nodes),
            { headers: { 'content-type': 'text/html' } });
        }
        if (req.method === 'GET' && seg[2] === 'donors' && seg[3]) {
          const donor = decodeURIComponent(seg[3]);
          const ds = (await list<Donation>(env.DB, 'donation'))
            .filter((d) => d.roundId === round.id && d.donor === donor);
          const receipts = (await list<Attestation>(env.DB, 'attestation'))
            .filter((a) => a.schemaRef === 'springforth.donation.v1'
              && a.payload.includes(`"donor":"${donor}"`));
          return new Response(renderDonorPage({
            roundId: round.id, donor, donations: ds, receipts }),
            { headers: { 'content-type': 'text/html' } });
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
          return new Response(renderRoundAdmin(round, applications, nodes),
            { headers: { 'content-type': 'text/html' } });
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
            return new Response(renderClaimPage(claim, atts,
              { chainReady: !!chainCfg(env) }),
              { headers: { 'content-type': 'text/html' } });
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
        if (req.method === 'GET' && seg.length === 1) {
          const rounds = await list<RetroRound>(env.DB, 'retroround');
          const apps = await list<Appreciation>(env.DB, 'appreciation');
          return json({
            rounds,
            badgeholders: badgeholders(apps, 8),
            rule: 'badgeholders = top EigenTrust on the appreciation graph; quadratic ballot on attested claims',
          });
        }
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
        const b = await req.json() as Record<string, unknown>;
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
        return json(pledge, 201);
      }
      if (req.method === 'GET' && seg[0] === 'pledges') {
        return json({ pledges: await list<Pledge>(env.DB, 'pledge') });
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
        if (seg[1] === 'verify') return json(await ledgerVerify(env.DB));
        return json({ events: await ledgerEvents(env.DB) });
      }
      if ((req.headers.get('accept') ?? '').includes('text/html')) {
        return new Response(pageShell({ title: 'Not found — Springforth', htmx: false }, `<div class="page">
<h1>Nothing here</h1>
<p class="lede">That page doesn't exist — it may have moved, or the link is old.</p>
<p><a href="/possibilities">Explore the deck</a> · <a href="/">back home</a></p>
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
