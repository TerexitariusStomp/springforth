// Hackathon demo seed — scripted lifecycle across every mechanic, via the
// live HTTP API (real routes, real ledger events). Idempotent: deterministic
// IDs where the API allows; skips records that already exist.
// Run: ADMIN_TOKEN=... node scripts/seed-demo.mjs [baseUrl]
const BASE = process.argv[2] ?? 'https://springforth.widespread.workers.dev';
const ADMIN = process.env.ADMIN_TOKEN;
if (!ADMIN) { console.error('ADMIN_TOKEN env required'); process.exit(1); }

const H = { 'content-type': 'application/json', authorization: `Bearer ${ADMIN}` };
const get = async (p) => (await fetch(`${BASE}${p}`, { headers: H })).json();
const post = async (p, b) => {
  const r = await fetch(`${BASE}${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.log(`  ✗ ${p} → ${r.status}: ${j.error ?? JSON.stringify(j).slice(0, 120)}`);
  return j;
};
const pub = async (p, b) => {         // public routes — no admin header
  const r = await fetch(`${BASE}${p}`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const NOW = new Date().toISOString();

// ── 1. Coordination arc — a second possibility + quorum + trust edges ──
console.log('1. coordination arc');
const poss = (await get('/possibilities?format=json')).possibilities ?? [];
let beach = poss.find((p) => p.title?.includes('Kikambala beach clean'));
if (!beach) {
  const r = await pub('/possibilities', {
    title: 'Kikambala beach clean + mangrove nursery day',
    description: 'Monthly shoreline clean with a mangrove propagule nursery stall — Kilifi coast, feeds the Mida Creek restoration corridor.',
    declarerId: 'demo-amina', place: 'kikambala kilifi',
    deadline: '2026-11-30T00:00:00Z', minParticipants: 3,
    needs: [{ label: 'Gloves and collection sacks', required: true },
            { label: 'Nursery troughs and potting mix', required: true }],
    bringing: [],
  });
  beach = r.body ?? {};
  console.log('  declared:', beach.id);
} else console.log('  exists:', beach.id);
const beachId = beach.id;

for (const [actor, bringing, hours] of [['demo-amina', '4 sacks + first aid kit', 3],
                                  ['demo-brian', 'wheelbarrow + troughs', 3],
                                  ['demo-christine', 'propagules from Kikambala group', 2]]) {
  const r = await pub(`/possibilities/${beachId}/join`, { actor, bringing, hours });
  console.log(`  join ${actor}:`, r.status);
}
// appreciations → mutual trust edges (needed for pairwise + governance cohort)
for (const [f, t] of [['demo-amina', 'demo-brian'], ['demo-brian', 'demo-amina'],
                      ['demo-christine', 'demo-amina'], ['demo-amina', 'demo-christine'],
                      ['demo-christine', 'demo-brian'], ['demo-brian', 'demo-christine'],
                      ['demo-daudi', 'demo-amina'], ['demo-amina', 'demo-daudi']]) {
  const r = await pub(`/possibilities/${beachId}/appreciate`, { from: f, to: t, note: 'showed up and delivered' });
  console.log(`  appreciate ${f}→${t}:`, r.status);
}

// ── 2. Funding arc — donations on Mida + pairwise round showing discount ──
console.log('2. funding arc');
const midasNeeds = ['poss-mida-creek-mangrove-need-0', 'poss-mida-creek-mangrove-need-1', 'poss-mida-creek-mangrove-need-2'];
// Kenya scene denominates in KES — the unit of the country.
const donors = [['demo-amina', 1600], ['demo-brian', 2600], ['demo-christine', 1000],
                ['demo-daudi', 5800], ['demo-elinah', 3900], ['demo-faiz', 650], ['demo-grace', 1900]];
const seededDons = (await get('/rounds/round-mida-creek?format=json')).donations ?? [];
for (const [i, [d, amt]] of donors.entries()) {
  if (seededDons.some((x) => x.donor === d)) { console.log(`  donate ${d}: exists`); continue; }
  const r = await post(`/rounds/round-mida-creek/donate`,
    { needNodeId: midasNeeds[i % 3], donor: d, amount: amt, currency: 'KES' });
  console.log(`  donate ${d} $${amt}:`, r.id ?? 'err');
}

const rounds = (await get('/rounds?format=json')).rounds ?? [];
let pwRound = rounds.find((r) => r.id === 'round-pairwise-demo');
if (!pwRound) {
  pwRound = await post('/rounds', {
    id: 'round-pairwise-demo', title: 'Kilifi coast pairwise round',
    description: 'Same needs, pairwise matching — the appreciation graph discounts coordinated donor rings.',
    sponsorIds: ['kilifi-regen-network'], matchingFund: { amount: 40000, currency: 'KES' },
    eligibleNeedIds: midasNeeds, matchingMode: 'pairwise', conviction: true,
    acceptedTokens: { USD: 'fiat-ledger', cUSD: '0x765de816845861e75a25fca122bb6898b8b1282a' },
    opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-12-31T00:00:00Z', state: 'open',
  });
  console.log('  pairwise round:', pwRound.id ?? 'err');
} else console.log('  pairwise round exists');
// clique donors all back need-0; independents spread — pairwise discounts the clique
const pwDons = (await get('/rounds/round-pairwise-demo?format=json')).donations ?? [];
for (const [d, need, amt] of [['demo-amina', 0, 5200], ['demo-brian', 0, 5200], ['demo-christine', 0, 5200],
                               ['demo-daudi', 1, 3200], ['demo-elinah', 2, 3200]]) {
  if (pwDons.some((x) => x.donor === d)) { console.log(`  pw donate ${d}: exists`); continue; }
  const r = await post(`/rounds/round-pairwise-demo/donate`, { needNodeId: midasNeeds[need], donor: d, amount: amt, currency: 'KES' });
  console.log(`  pw donate ${d} → need-${need}:`, r.id ?? 'err');
}
const app = await post(`/rounds/round-pairwise-demo/apply`,
  { needNodeId: 'poss-demo-beach-clean-need-0', applicant: 'demo-amina',
    statement: 'Gloves + sacks for the monthly beach clean — feeds the creek corridor.' });
if (app.id) await post(`/rounds/round-pairwise-demo/applications/${app.id}/review`, { approve: true });

// recurring support intent
const streams = (await get('/streams?format=json')).streams ?? [];
if (!streams.some((s) => s.id === 'rs-demo-pairwise')) {
  const s = await post('/rounds/round-pairwise-demo/stream', {
    id: 'rs-demo-pairwise', needNodeId: midasNeeds[1], supporter: 'demo-elinah',
    token: '0x62B8B11039fcfE5AB0C56E502b1C372A3D2a9C7A',
    receiver: '0x000000000000000000000000000000000000dEaD',
    flowRate: '3858024691' });
  console.log('  stream intent:', s.id ?? s);
}

// ── 3. Evidence arc — field report + claim on the Mida outcome ──
console.log('3. evidence arc');
await pub('/signals', { actor: 'demo-brian', targetId: 'poss-mida-creek-mangrove-action-0',
  intent: 'field-report', note: 'Planted 60 propagules on the creek edge Saturday — photos on the community drive, tide charts checked.' });
const claims = (await get('/claims')).claims ?? [];
let claim = claims.find((c) => c.possibilityId === 'poss-mida-creek-mangrove');
if (!claim) {
  claim = await post('/claims', { possibilityId: 'poss-mida-creek-mangrove' });
  console.log('  claim:', claim.id ?? 'err');
} else console.log('  claim exists:', claim.id);

// ── 4. Attestation arc ──
console.log('4. attestation arc');
if (claim?.id) {
  const att = await post(`/claims/${claim.id}/attest`, { attester: 'demo-elinah', evaluation: 'positive',
    note: 'Site visit 18 Oct — propagule survival visible at the channel edge.' });
  console.log('  attestation:', att.id ?? att.uid ?? 'recorded');
}

// ── 5. Governance arc — proposal + quadratic ballots + passed tally ──
console.log('5. governance arc');
const gov = await get('/governance?format=json');
console.log('  eligible voters:', gov.eligibleVoters);
let prop = (gov.proposals ?? []).find((p) => p.param === 'pairwise.alpha');
if (!prop) {
  prop = await post('/governance/proposals', { param: 'pairwise.alpha',
    title: 'Sharpen the discoordination discount', proposedValue: '3',
    proposer: gov.eligibleVoters?.[0] ?? 'demo-amina' });
  console.log('  proposal:', prop.id ?? 'err');
}
if (prop?.id) {
  for (const [i, v] of (gov.eligibleVoters ?? []).slice(0, 2).entries()) {
    const b = await post(`/governance/${prop.id}/vote`, { voter: v, points: i === 0 ? 4 : 1, support: true });
    console.log(`  vote ${v}:`, b.id ?? 'err');
  }
  const t = await post(`/governance/${prop.id}/tally`, {});
  console.log('  tally:', t.state, `for ${t.forWeight ?? '?'}`);
}

// ── 6. Retro arc ──
console.log('6. retro arc');
const retro = await get('/retro');
if (!(retro.rounds ?? []).some((r) => r.id === 'retro-q4-kilifi')) {
  const rr = await post('/retro', { id: 'retro-q4-kilifi',
    title: 'Kilifi coast retro round — Q4', fund: { amount: 19500, currency: 'KES' },
    claimIds: claim?.id ? [claim.id] : [], badgeholderCount: 4, pointsPerBallot: 9,
    ballotClose: '2026-11-01T00:00:00Z' });
  console.log('  retro round:', rr.id ?? 'err');
  const holders = retro.badgeholders ?? [];
  for (const h of holders.slice(0, 3))
    await post(`/retro/retro-q4-kilifi/vote`, { badgeholder: h, weights: { [claim?.id ?? 'claim-1']: 4 } });
  const t = await post('/retro/retro-q4-kilifi/tally', {});
  console.log('  retro tallied:', t.state);
} else console.log('  retro exists');

// ── 7. Data arc — releases + grant ──
console.log('7. data arc');
for (const name of ['plannodes', 'oracle-checks', 'donations']) {
  const rel = await post(`/datasets/${name}/release`, {});
  console.log(`  release ${name}:`, rel.id ?? 'err');
}
await post('/datasets/plannodes/grants', { grantee: 'demo-research-partner', paymentRef: 'grant-agreement-2026-10', days: 30 });

// ── 7b. UK parallel scene — Shrewsbury / River Severn flood response ──
// The endorsed-source lane: EA Flood Monitoring + Open-Meteo + EA Water
// Quality + FHRS + postcodes.io attach as live verified context; the h3'd
// action node joins the hourly oracle cycle. Mirrors the catalogue's own
// combination #3 (Community Climate-Resilience Lending).
console.log('7b. UK scene — Shrewsbury flood response');
const SEVERN_H3 = '87195c4a9ffffff';  // res-7 cell over the Welsh Bridge reach
const possUk = (await get('/possibilities?format=json')).possibilities ?? [];
let uk = possUk.find((p) => p.title?.includes('Shrewsbury riverside'));
if (!uk) {
  const r = await pub('/possibilities', {
    title: 'Shrewsbury riverside flood response — River Severn',
    description: 'When warnings go out on the Severn loop we stage sandbags, clear gullies, and check on riverside neighbours. Coordinated with the EA flood feed — live readings attach as verified context.',
    declarerId: 'demo-tom', place: 'shrewsbury', householdsProtected: 12,
    deadline: '2026-12-31T00:00:00Z', minParticipants: 3,
    needs: [{ title: 'Sandbag crew rota', required: false },
            { title: 'Pop-up flood barriers (EA depot loan)', required: false },
            { title: 'Flood consumables (sand, tape, gloves)', required: false,
              budget: 150, budgetCurrency: 'GBP' }],
    actions: [{ title: 'Riverside gully clearance + sandbag staging',
                h3: SEVERN_H3,
                description: 'Welsh Bridge reach — oracle reads EA warnings + Open-Meteo precip here hourly.' }],
    bringing: [{ title: '40 sandbags stored dry', budget: 120, budgetCurrency: 'GBP' }],
  });
  uk = r.body ?? {};
  console.log('  declared:', uk.id);
} else console.log('  exists:', uk.id);
const ukId = uk.id;
for (const [actor, bringing, hours] of [['demo-tom', 'pickup + trailer', 4],
                                 ['demo-sarah', 'gully-clearance kit', 3],
                                 ['demo-rhys', '40 sandbags stored dry', 2]]) {
  const r = await pub(`/possibilities/${ukId}/join`, { actor, bringing, hours });
  console.log(`  join ${actor}:`, r.status);
}
for (const [f, t] of [['demo-tom', 'demo-sarah'], ['demo-sarah', 'demo-tom'],
                      ['demo-rhys', 'demo-tom'], ['demo-tom', 'demo-rhys'],
                      ['demo-sarah', 'demo-rhys'], ['demo-rhys', 'demo-sarah']]) {
  await pub(`/possibilities/${ukId}/appreciate`, { from: f, to: t, note: 'reliable on every shout' });
}
// attach live endorsed-source context (EA floods, precip, FHRS, postcodes…)
const ctx = await post(`/possibilities/${ukId}/context/refresh`, { lat: 52.7069, lon: -2.75 });
console.log(`  context refresh: +${ctx.added ?? 0} datasets`);
// field report on the h3'd action node — next cron cycle corroborates
const ukAction = (await get(`/possibilities/${ukId}`)).nodes?.find((n) => n.kind === 'action');
if (ukAction) {
  await pub('/signals', { actor: 'demo-sarah', targetId: ukAction.id,
    intent: 'field-report', note: 'Gullies on the Welsh Bridge reach cleared Saturday; sandbag pallet staged at the depot.' });
}
// a UK matching round so data→funding reads in-place
const roundsNow = (await get('/rounds?format=json')).rounds ?? [];
const ukNeedIds = ((await get(`/possibilities/${ukId}`)).nodes ?? []).filter((n) => n.kind === 'need').map((n) => n.id);
if (!roundsNow.some((r) => r.id === 'round-severn-flood') && ukNeedIds.length) {
  await post('/rounds', {
    id: 'round-severn-flood', title: 'Severn catchment resilience round',
    description: 'Quadratic matching over flood-response needs — oracle-verified context on every card.',
    sponsorIds: ['severn-catchment-partnership'], matchingFund: { amount: 200, currency: 'GBP' },
    eligibleNeedIds: ukNeedIds, matchingMode: 'pairwise', conviction: true,
    // demand gate: match unlocks once £100 is pledged across ≥2 backers;
    // 0.5% of every donation skims to the permanent endowment
    pledgeGoal: 100, minBackers: 2, skimBps: 50,
    opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-12-31T00:00:00Z', state: 'open',
  });
  console.log('  severn round created');
  for (const [d, i, amt] of [['demo-tom', 0, 30], ['demo-sarah', 0, 30], ['demo-rhys', 0, 30],
                             ['demo-daudi', 1, 25], ['demo-elinah', 1, 20]]) {
    const r = await post('/rounds/round-severn-flood/donate',
      { needNodeId: ukNeedIds[i % ukNeedIds.length], donor: d, amount: amt });
    console.log(`  donate ${d}:`, r.id ?? 'err');
  }
}
// Demand-gate pledges on the Severn card — proves demand, unlocks match
if (ukNeedIds.length) {
  for (const [who, amt] of [['demo-amina', 60], ['demo-daudi', 60]]) {
    const r = await pub(`/possibilities/${ukId}/pledge`,
      { pledger: who, amount: amt, currency: 'GBP', needNodeId: ukNeedIds[0] });
    console.log(`  severn pledge ${who}:`, r.status ?? r.body?.id ?? 'ok');
  }
}
// A second round still short of its gate — shows matching locked
if (!roundsNow.some((r) => r.id === 'round-kenya-demand-gated') && midasNeeds?.length) {
  await post('/rounds', {
    id: 'round-kenya-demand-gated',
    title: 'Kilifi coastal round — demand-gated pilot',
    description: 'Match stays locked until pledged backing proves demand — the fund exists before it is promised.',
    sponsorIds: ['kilifi-county'], matchingFund: { amount: 10000, currency: 'KES' },
    eligibleNeedIds: midasNeeds.slice(0, 1), pledgeGoal: 5000, minBackers: 3,
    opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-12-31T00:00:00Z', state: 'open',
  });
  const r = await pub(`/possibilities/poss-mida-creek-mangrove/pledge`,
    { pledger: 'demo-kioko', amount: 500, currency: 'KES', needNodeId: midasNeeds[0] });
  console.log('  gated pledge:', r.status ?? 'ok');
}
// Permanent endowment — locked principal, spends accrued skim only
if (!roundsNow.some((r) => r.id === 'round-commons-endowment')) {
  await post('/rounds', {
    id: 'round-commons-endowment', title: 'Commons endowment (permanent)',
    description: 'Locked principal — only accrued activity fees are allocable. Never allocates match itself.',
    sponsorIds: ['springforth'], matchingFund: { amount: 250, currency: 'GBP' },
    eligibleNeedIds: [], endowment: true,
    opensAt: '2026-10-01T00:00:00Z', closesAt: '2030-12-31T00:00:00Z', state: 'open',
  });
  console.log('  endowment created');
}

// ── 8. Live-flip card — sits at quorum-1 for the audience beat ──
console.log('8. live-flip card');
const possNow = (await get('/possibilities?format=json')).possibilities ?? [];
let flip = possNow.find((p) => p.title?.includes('You, in this room'));
if (!flip) {
  const r = await pub('/possibilities', {
    title: 'You, in this room — join to activate',
    description: 'A live coordination card: scan the QR, join, and watch quorum activate on screen. What you bring: attention. What it needs: you.',
    declarerId: 'demo-amina', place: 'sustainable finance live',
    deadline: '2026-10-29T00:00:00Z', minParticipants: 3,
    needs: [{ label: 'One more person in the room', required: false }],
    bringing: [],
  });
  flip = r.body ?? {};
  console.log('  flip card:', flip.id);
}
const flipId = flip.id;
const parts = await get(`/possibilities/${flipId}`);
const joined = parts.participants?.length ?? parts.participantCount ?? 0;
for (const a of ['demo-amina', 'demo-brian']) {
  const r = await pub(`/possibilities/${flipId}/join`, { actor: a, bringing: 'attention' });
  console.log(`  flip join ${a}:`, r.status);
}

// ── 9. Subscription on the Mida possibility ──
console.log('9. subscription');
const subs = (await get('/subscriptions')).subscriptions ?? [];
if (!subs.some((s) => s.actor === 'demo-amina' && s.target === 'poss-mida-creek-mangrove'))
  await post('/subscriptions', { actor: 'demo-amina', target: 'poss-mida-creek-mangrove',
    channel: 'telegram', address: process.env.TELEGRAM_CHAT_ID ?? '' });

// ── verify ──
const v = await get('/ledger/verify');
const stats = await get('/?format=json');
console.log(`\ndone — ledger ${v.events} events ok=${v.ok} · ${stats.possibilities} possibilities · ${stats.nodes} nodes · ${stats.overlaps} overlaps`);
