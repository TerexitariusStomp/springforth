// The Springforth whitepaper — rendered, not PDF'd. Every mechanism
// described here corresponds to a live route or a committed entity; nothing
// is aspirational without being marked as such.
import { pageShell } from './theme.ts';

export function renderWhitepaper(): string {
  return pageShell({ title: 'Whitepaper — Springforth', htmx: false,
    extraCss: `.paper{max-width:52rem;margin:0 auto}
.paper h2{margin-top:3rem}
.paper h2 .no{color:var(--sf-coral);font-family:var(--sf-body);font-size:.55em;
  font-weight:700;letter-spacing:.12em;display:block;margin-bottom:.3rem}
.paper h3{margin-top:1.8rem}
.paper .toc{columns:2;column-gap:2.5rem;padding-left:1.2rem}
.paper .toc li{break-inside:avoid;margin:.2rem 0}
.paper table{width:100%;font-size:.9rem}
.paper code{font-size:.85em}
.paper .abstract{border-left:3px solid var(--sf-lime);padding:.4rem 0 .4rem 1.2rem;
  font-size:1.05rem}
@media(max-width:700px){.paper .toc{columns:1}}` }, `<div class="page">
<article class="paper">
<span class="kicker">Whitepaper · v1 · live protocol</span>
<h1>Springforth</h1>
<p class="lede">A coordination and funding protocol for public goods —
declare what should happen, find the people and resources already around
you, bind commitments at quorum, prove outcomes on a public ledger, and
route funding to what worked.</p>

<div class="abstract"><strong>Abstract.</strong> Public-goods work fails twice:
first at coordination — the people, resources, and intent exist but never
find each other — and again at funding — money arrives before evidence or
never arrives at all. Springforth inverts both. Coordination starts with a
declared <em>possibility</em>: what you bring, what you need, how many it
takes, where, and by when. Commitments bind only at quorum, so nobody is
exposed until the conditions for success exist. Appreciation after the
event builds a pairwise trust graph that steers future surfacing. Funding
is quadratic, dominant-assurance, and retroactive — dollars follow attested
outcomes, not promises. Every state transition lands on an append-only,
hash-chained ledger anchored to Bitcoin via OpenTimestamps. The protocol
is non-custodial end to end: chain endpoints return unsigned calldata and
wallets sign.</div>

<h2>Contents</h2>
<ol class="toc">
<li><a href="#s1">The problem</a></li>
<li><a href="#s2">Possibilities and quorum</a></li>
<li><a href="#s3">Trust, appreciation, and surfacing</a></li>
<li><a href="#s4">The resource commons</a></li>
<li><a href="#s5">Funding mechanics</a></li>
<li><a href="#s6">Evidence and verification</a></li>
<li><a href="#s7">Value accounting</a></li>
<li><a href="#s8">Governance</a></li>
<li><a href="#s9">Architecture</a></li>
<li><a href="#s10">Channels and integrations</a></li>
<li><a href="#s11">Security model</a></li>
<li><a href="#s12">Roadmap</a></li>
</ol>

<h2 id="s1"><span class="no">01</span>The problem</h2>
<p>Every community already contains the ingredients for the work it needs:
skills, tools, venues, materials, time, and intent. What it lacks is a
mechanism for those ingredients to find each other. A tree-planting day
fails not because nobody cares but because the person with the seedlings
never met the person with the truck — and neither knew twelve others were
waiting to be asked.</p>
<p>The funding side is equally broken. Grants pay for promises and audit
paperwork. Donations pay for storytelling. The result is money allocated
to whoever writes the best application, not whoever did the most
verifiable good. Meanwhile small, real, local work — the kind that
compounds — is too small for any grant program to see.</p>
<p>Springforth treats these as one problem: <strong>a coordination layer that
produces fundable, verifiable outcomes</strong>. Coordinate first; fund what
the coordination actually delivered.</p>

<h2 id="s2"><span class="no">02</span>Possibilities and quorum</h2>
<p>A <strong>possibility</strong> is a declarative card: <em>"I want to..."</em> — what
the declarer brings, what is still needed, the participation threshold,
the place, and the deadline. It is not a fundraiser and not a promise; it
is a coordination offer waiting for conditions.</p>
<p>Others <strong>join</strong> by committing participation and optionally resources,
or <strong>pass</strong> — a pass is data too: it steers future surfacing. Needs can
be flagged on an open card as they are discovered.</p>
<p><strong>Quorum binds the commitment.</strong> When the declared threshold is met —
every required need covered, minimum participants reached — the card
activates and every commitment becomes binding. Until then, nobody is
exposed. This is the dominant-assurance pattern applied to coordination
itself: opting in is safe because you are only ever committed alongside
enough others to succeed.</p>
<table>
<tr><th>State</th><th>Meaning</th></tr>
<tr><td><code>draft</code></td><td>declared, gathering commitments</td></tr>
<tr><td><code>active</code></td><td>open for joins, passes, need flags</td></tr>
<tr><td><code>quorum</code></td><td>threshold met — commitments bound, event proceeds</td></tr>
<tr><td><code>done</code></td><td>completion report filed by the declarer</td></tr>
<tr><td><code>expired</code></td><td>deadline passed without quorum — commitments release</td></tr>
</table>
<p>After the event, participants <strong>appreciate</strong> one another — the single
act that feeds the trust graph. The declarer files a completion report,
which becomes evidence for claims, attestations, and funding.</p>
<p>Live: <a href="/possibilities">/possibilities</a> — the deck renders real
cards with tone-by-status pills, progress to quorum, and open needs.</p>

<h2 id="s3"><span class="no">03</span>Trust, appreciation, and surfacing</h2>
<p>Appreciation is pairwise: <em>a → b</em>. <strong>Mutual recognition</strong> between
two actors is <code>min(a→b, b→a)</code> — trust counts only where it runs
both ways, which makes it expensive to fake. The resulting directed,
weighted graph is public and derived entirely from post-event
appreciations, not self-asserted reputation.</p>
<p>Trust feeds surfacing. Cards rank by
<code>score = 0.5·trust + 0.3·urgency + 0.2·cover</code>: half trust
(does the network vouch for these people), half urgency and coverage (is
the deadline near, are needs met). A viewer who passes
<code>?viewer=actor-id</code> sees the deck sorted for their position in
the graph — trust earned on one card compounds into the next.</p>
<p>Live: <a href="/actors">/actors</a> profiles show appreciation given and
received; <a href="/coordination">/coordination</a> surfaces overlaps and
mutual-recognition pairs.</p>

<h2 id="s4"><span class="no">04</span>The resource commons</h2>
<p>Every <code>bring</code> on every card accumulates into a resource
commons — a queryable library of what the community has already offered.
<strong>Overlap detection</strong> finds where one card's surplus covers another's
need: a complement edge between plan nodes, confirmed or coordinated.
What one event over-provides becomes the next event's starting point —
the commons compounds the way the trust graph does.</p>
<p>External plans can be imported into the same node space, so overlaps run
across organizational boundaries, not just within the deck.</p>
<p>Live: <a href="/coordination">/coordination</a>,
<a href="/portfolio">/portfolio</a> — the commons view of committed
resources by category.</p>

<h2 id="s5"><span class="no">05</span>Funding mechanics</h2>
<p>Funding is deliberately inverted from pooled crowdfunding: no escrow
the protocol controls, no amount-proportional entitlement, no milestone
gatekeeping by an admin. Three mechanisms, all live:</p>
<h3>5.1 Quadratic funding rounds</h3>
<p>Sponsors commit matching pools; communities contribute small donations.
Matching weight follows <code>sqrt(contribution)</code> summed per project —
the breadth of support outweighs the depth of any single donor. Rounds
carry real demand gates (a target that must be met for activation) and
endowment badges where a permanent funding base exists. Stablecoin lanes
(Celo) give the matching pool a yield-bearing, low-volatility home.</p>
<h3>5.2 Dominant-assurance pledges</h3>
<p>Large commitments arrive as pledges that only bind if the campaign
succeeds — the same shape as quorum, applied to money. Funders are never
exposed to a failed raise; projects are never partially funded past the
point of viability.</p>
<h3>5.3 Retroactive allocation</h3>
<p>Funding follows attested outcomes rather than precedes promises. Work
that produced verified evidence competes for retroactive pools scored on
what happened, not what was proposed — the mechanism that most directly
rewards the small, real, local work grant programs cannot see.</p>
<h3>5.4 Recurring support streams</h3>
<p>Standing, per-period support — for a possibility, an actor, or a round —
plus yield streams that route protocol-owned liquidity returns back into
the commons. The endowment lane grows with the protocol instead of
draining it.</p>
<p>Live: <a href="/rounds">/rounds</a>,
<a href="/streams">/streams</a>. All chain endpoints are non-custodial:
they return unsigned calldata; wallets sign.</p>

<h2 id="s6"><span class="no">06</span>Evidence and verification</h2>
<p><strong>Claims</strong> state an outcome; <strong>attestations</strong> vouch for it.
Open-evidence readings — public data already in the world (satellite
observations, inspection registers, sensor feeds) — are pulled by oracle
checks and attached to claims as independent corroboration. A claim is
only as strong as its evidence panel, and the panel is public.</p>
<p>Every state transition — declaration, join, pass, quorum, appreciation,
donation, pledge, attestation — appends to a <strong>hash-chained ledger</strong>.
Each event commits to the hash of its predecessor; the chain tip is
anchored to Bitcoin via OpenTimestamps on a schedule. The chain cannot be
rewritten without breaking both the internal chain and the external
anchor. Anyone can verify integrity independently.</p>
<p>Live: <a href="/outcomes">/outcomes</a>,
<a href="/verify">/verify</a>,
<a href="/ledger">/ledger</a>,
<a href="/ledger/verify">/ledger/verify</a>.</p>

<h2 id="s7"><span class="no">07</span>Value accounting</h2>
<p>"Impact" is only legible to funders when it is denominated. Springforth
accounts for value in distinct, auditable categories — never a single
blended number:</p>
<table>
<tr><th>Category</th><th>What it measures</th></tr>
<tr><td>Money mobilized</td><td>donations, pledges, matching committed through the protocol</td></tr>
<tr><td>Direct costs</td><td>what the work actually consumed</td></tr>
<tr><td>Avoided losses</td><td>harm the outcome demonstrably prevented</td></tr>
<tr><td>Time saved / given</td><td>volunteer hours, valued at published rates (e.g. £14.43/h)</td></tr>
<tr><td>In-kind</td><td>materials, venues, equipment committed via the commons</td></tr>
<tr><td>Yield &amp; fees</td><td>revenue the protocol itself generates and routes to the commons</td></tr>
</table>
<p>Each figure links back to the ledger events and evidence that produce
it — a value claim with no backing events is a formatting error, not a
metric. Live: <a href="/datasets">/datasets</a> publishes signed,
anchored data releases; <a href="/verify">/verify</a> exposes the checks.</p>

<h2 id="s8"><span class="no">08</span>Governance</h2>
<p>Proposals move through a public lifecycle with a governance franchise
weighted by <em>standing</em> — trust earned through participation — not by
spending. The same trust graph that steers card surfacing steers who the
protocol listens to. Parameter changes, round schedules, and integration
approvals all resolve through proposals rather than admin keys.
Live: <a href="/governance">/governance</a>.</p>

<h2 id="s9"><span class="no">09</span>Architecture</h2>
<table>
<tr><th>Layer</th><th>Implementation</th></tr>
<tr><td>Edge</td><td>Cloudflare Workers — every route server-rendered at the edge</td></tr>
<tr><td>State</td><td>Cloudflare D1 — entity stores per type, queried at request time</td></tr>
<tr><td>Truth</td><td>append-only hash-chained ledger; OpenTimestamps anchor to Bitcoin</td></tr>
<tr><td>Chain</td><td>Celo lane — unsigned calldata out, wallet-signed transactions in</td></tr>
<tr><td>Identity</td><td>actor ids per channel (<code>tg:</code>, wallet, email) in one identity space; EIP-191 wallet binding</td></tr>
<tr><td>Client</td><td>typed <code>@springforth/client</code>; OpenAPI 3.1 at <a href="/docs.json">/docs.json</a></td></tr>
</table>
<p>The protocol is entity-simple: possibilities, participations,
appreciations, plan nodes, overlaps, claims, attestations, rounds,
donations, pledges, streams, proposals, ledger events — each a validated
record, each readable as JSON on the same route that renders HTML.</p>

<h2 id="s10"><span class="no">10</span>Channels and integrations</h2>
<p><strong>Telegram — <a href="https://t.me/springforth_bot" rel="noopener">@springforth_bot</a>.</strong>
The full possibility lifecycle in chat: <code>/cards</code>,
<code>/new</code>, <code>/join</code>, <code>/need</code>,
<code>/pass</code>, <code>/appreciate</code>, <code>/done</code>. Bot
actors are <code>tg:&lt;username&gt;</code> — the same identity space as the
ledger and trust graph, so Telegram activity is indistinguishable from
web activity. Quorum and lifecycle notifications push back via
subscriptions.</p>
<p><strong>Ecosystem adapters.</strong> Public integrations are live and read real
counterpart state: Silvi (stewardship attestations), Treegens (planting
records), Holons, OnePlanet, and Grassroots Economics (community
currencies). Each adapter normalizes external records into claims and
plan nodes so outside work becomes evidence and commons inventory.</p>
<p>Webhook subscriptions push lifecycle events to any endpoint —
Telegram, email, or a bare HTTP URL. Live:
<a href="/docs">/docs</a> → Integrations.</p>

<h2 id="s11"><span class="no">11</span>Security model</h2>
<ul>
<li><strong>Non-custodial by construction</strong> — the protocol never holds
funds; chain endpoints emit unsigned calldata for wallets to sign.</li>
<li><strong>Wallet binding</strong> — EIP-191 signature verification binds a chain
address to an actor; no custodial keys exist to leak.</li>
<li><strong>Webhook authentication</strong> — <code>/tg</code> validates
Telegram's secret-token header; subscription deliveries sign their origin.</li>
<li><strong>Rate limiting</strong> — write endpoints are throttled per actor;
bot webhook traffic is exempt by design.</li>
<li><strong>Secrets discipline</strong> — bot tokens and admin secrets live in
worker secrets, never in source, markup, or logs; deploys and pushes run
automated secret-scanning gates.</li>
<li><strong>Ledger integrity</strong> — hash-chaining plus periodic Bitcoin
anchoring makes retroactive tampering evident to any verifier.</li>
</ul>

<h2 id="s12"><span class="no">12</span>Roadmap</h2>
<table>
<tr><th>Phase</th><th>Status</th><th>Scope</th></tr>
<tr><td>A–C</td><td>shipped</td><td>coordination core — possibilities, quorum, trust graph, commons</td></tr>
<tr><td>D–F</td><td>shipped</td><td>funding — quadratic rounds, dominant-assurance pledges, retro pools, streams</td></tr>
<tr><td>G</td><td>shipped</td><td>evidence — claims, attestations, oracle checks, ledger anchoring</td></tr>
<tr><td>H</td><td>shipped</td><td>governance, datasets, developer surfaces, chain lanes</td></tr>
<tr><td>I</td><td>shipped</td><td>integrations — Telegram lane, ecosystem adapters, demo surfaces</td></tr>
<tr><td>Next</td><td>active</td><td>deepening on-chain settlement, oracle source breadth, mobile clients</td></tr>
</table>
<p class="muted">Springforth is open source and commercially usable. The
protocol, this paper, and the ledger it describes are public:
<a href="https://github.com/TerexitariusStomp/springforth" rel="noopener">github.com/TerexitariusStomp/springforth</a>.
Verify everything claimed here at <a href="/ledger/verify">/ledger/verify</a>.</p>
</article>
</div>`);
}
