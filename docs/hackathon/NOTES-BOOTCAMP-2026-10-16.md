# SF Live Hackathon Bootcamp — 2026-10-16

Source: Teams meeting recording (77 min), `TRANSCRIPT-BOOTCAMP-2026-10-16.txt/.vtt`
(Whisper turbo transcription). Orientation call — Richard (organizer), Puran
(OnePlanet), Louisa + Liz (Satellite Applications Catapult / EO Data Hub),
Daniel (Cloudscaler), David (Microsoft). Grassroots Economics did not present —
Will/Muhammad/Njambi's material is posted in the Teams resources channel.

## What judges will score

Broad-spectrum rubric, stated explicitly on the call:

- Business / community idea
- Technical implementation achieved
- **Use of the different datasets** (explicit criterion)
- Presentation quality ("it matters to getting money and funding and customers")
- Feasibility — will it get traction in the market, will it scale
- Impact potential

Two judging classes: **established** (predefined idea / pre-existing team) vs
**formed at the hackathon**. Springforth competes in the established class.

Deliverables / tools they look for:
- ~8-minute pitch (drop-dead time)
- Business Model Canvas — a semi-populated template is in the resources folder
  (we already have `BMC.md` — check it against their template)
- Logical architecture diagram ("big picture view of how your system
  interacts" — briefing note provided in resources)
- Winners get Finextra editorial coverage, inclusion in the post-event report,
  a Finextra TV interview, and accelerator introductions (Geovation, SAC);
  Cloudscaler offers AWS funded days to winning teams.

## Speaker material relevant to Springforth

- **Richard — "marketplace of marketplaces"**: liquidity of opportunities,
  volunteers, assets, funding *and* ecological/well-being outcomes; stewardship
  "in perpetuity". Directly matches the coordination+funding+valuation
  composition — cite his framing in the pitch.
- **Puran (OnePlanet founder, co-designed the SDGs)**: outcomes/actions/
  indicators as the "atomic structure" of any plan; sandbox loaded with
  Brighton Resilience Partnership strategies. Their challenge: design and fund
  joined-up projects maximizing co-benefits (car park → community orchard
  example), **harvest avoided cost savings** (his verbal claim: £1 on community
  groups ≈ £10 saved by the NHS) to fund more community work — same shape as
  our `riskAvoided` lane. OnePlanet exposes an **MCP** for agent access;
  connect-to-MCP doc is in the resources channel (we have the PDF in
  `~/Documents/hackathon-resources/`).
- **EO Data Hub (SAC)**: Sentinel-2 + derived datasets, Jupyter notebook hub,
  QGIS/ESRI plugins; case studies in land-use change, shoreline detection,
  pollution — relevant to the Mida Creek/mangrove evidence lane.
- **Cloudscaler**: AWS sandbox accounts provisioned Monday; generative-AI access
  included.
- **John's open question** (paraphrased): attribution science → insurance
  industry. The reinsurance industry is under climate pressure; Anthony Hobbly
  (Howdens) closes the conference on exactly this. Supports the
  damage-avoidance/insurance framing in `VALUATION.md` (ABI source).
- **Commitment pooling was raised on the call** — John flagged Will Ruddick's
  absence and floated commitment pooling / internal vouchers for inter-team
  resource sharing. Grassroots material is in the resources channel and a
  deeper doc was promised.

## Platform logistics

- Teams site: lobby → signposting; **Resources channel** (datasets, APIs,
  BMC template, architecture notes, marketplace-design notes incl. a Microsoft
  marketplace architect's "community operating system" brief); **Help Desk**
  channel = public Q&A thread; per-team channels are locked/private with
  mentor access.
- Team formation is ongoing (storm/form/norm); Richard is the wayfinding
  agent — email him to switch teams or request skills.
- AI-agent access to the EO hub: APIs exist, details TBD ("try it and see");
  OnePlanet MCP instructions are in resources.

## Follow-up pull (2026-10-22) — verbatim from the slide deck + OneNote

**Timeline (hard):** submissions **Oct 27 14:00–15:00**; pitches **Oct 28
10:00–12:00** (8 min, drop-dead); judging 13:00–14:00; awards 15:00–16:00.

**Verbatim judging criteria (slide 38):** Demo · Business Idea · Technical
Implementation · Use of Datasets · Presentation · Feasibility · Scalability ·
Impact potential. Deliverables called out: Business Model Canvas + Logical
Architecture + clickable demo.

**Classes are officially 'Established' vs 'Emerging'** — we are Emerging
(team assembled at the hackathon).

**Problem statements (from the OneNote Resources page):**
1. Communities' overlapping plans in different systems — strategies conflict
   or duplicate, wasting time and resources *(our lane — PS1)*
2. OnePlanet agentic-AI on the Brighton Resilience knowledge graph
3. "From Satellite to Community Space" — geospatial/EO response coordination
4. "From Underbanked to Understood" — Sarafu community credit + commitment pools
5. Collaboration Reverse Challenge — established actor briefing at bootcamp

**The organizer's own model** — "A marketplace for community liquidity":
Surface → Match → Fund → Deliver → Measure → Steward, circular reinvestment.
Maps 1:1 to our lifecycle (declare → quorum → pledge → report → verify →
council/stewardship) — use this slide's vocabulary in the pitch.

**New resources discovered in OneNote (`vendor/onenote-Resources.txt`):**
- Alpha-Klima: free platform account + API for the event — email
  contacto@alpha-klima.com with team name; physrisk hazards to 2085,
  asset-impact + portfolio-loss metrics; `platform.alpha-klima.com/prapi/docs`;
  OS-Climate physrisk (OSS)
- Sarafu: curated Zenodo dataset (zenodo.org/records/20120190),
  viz.sarafu.network, sarafu.network/map, regenerative-bonds paper
  (arxiv.org/abs/2606.23922), Will Ruddick substack explainer;
  mentor Mohamed Sohail handles sandbox/API provisioning
- Planetary Computer notes (140+ datasets, STAC)
- Azure $200 free-credit note; Cloudscaler AWS walkthrough vendored

## Action checklist

- [x] Re-check `BMC.md` against the provided semi-populated template —
      template adds Benefits Dependency Network + GTM work-back (Phase R)
- [x] Produce a logical-architecture diagram artifact — exists
      (`demo-assets/architecture.svg`); refreshed for post-Phase-P reality
- [x] Confirm dataset-usage criterion is visible in the demo — strengthened
      with the endorsed-sources block on `/impact#data`
- [x] Pull the Grassroots commitment-pooling material — it was in OneNote,
      now extracted to `vendor/onenote-Resources.txt`
- [x] OnePlanet live — `opk_` key obtained, MCP verified, SFLive Sandbox
      plans imported to prod (flood strategy 37 OAIs, climate plan 146 OAIs)
- [x] Sarafu Zenodo field reports live — 42-record topical sample
      (APPROVED + GPS, mangrove/reforestation-first near Mida Creek) seeded
      as `sarafu:field-reports` action nodes; overlap records vs the Kwale
      mangrove project + `/map` evidence pins
- [ ] User: email contacto@alpha-klima.com with team name for physrisk API
- [ ] User: request EODATAHUB_KEY via Help Desk channel
- [ ] User: confirm pitch slot (Oct 28, 10:00–12:00) in calendar
- [ ] User: watch Anthony Hobbly's closing talk if the recording posts
