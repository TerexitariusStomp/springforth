# Draft — to Pooran Desai (pooran.desai@oneplanet.com)

**Subject:** SF.Live PS1 team — OnePlanet MCP key for a live adapter

Hi Pooran,

We're Team Two on PS1 (Collaboration Reverse) at the Sustainable Finance
Live hackathon. We've built a coordination layer that imports plans from
external systems into a shared graph — overlapping efforts surface as
verifiable, human-validated overlaps, then become coordinated, funded
action.

Our OnePlanet adapter is already written against your MCP quickstart —
Streamable HTTP to `https://mcp.oneplanet.com/mcp`, Bearer auth, adaptive
tool discovery, JSON + SSE responses. A fixture import path works today;
we'd like to point it at a live workspace for the demo.

Could you help us get an API key (`opk_…`)? Per the guide we need:

1. **AI Connector enabled** for our hackathon OnePlanet account — if that
   needs an admin flag, we'd appreciate you enabling it (or telling us
   which account to sign in with).
2. Guidance on **which workspace(s)** the key should scope — whichever
   shows PS1-relevant plan data would be ideal; read-only capability is
   all we need.

Once the key lands we'll store it as a Cloudflare secret
(`ONEPLANET_API_KEY`) — it never touches the repo — and the same call
that powers our demo will pull a real OnePlanet plan live on stage.

Public repo: github.com/TerexitariusStomp/springforth
Live demo: https://springforth.widespread.workers.dev (the `/tour` path
shows the flow in ~5 minutes).

Thanks — happy to jump on a quick call if easier.

— Team Two
