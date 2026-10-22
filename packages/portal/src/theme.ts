// Shared design system — Springforth's theme layer.
//
// Visual language ported from the Figma Make export (redesignwebsite):
// forest-green hero on pale cream, lime + coral accents, DM Serif Display
// headings over Figtree body. The base element stylesheet is vendored
// Pico CSS (MIT) served same-origin; everything below is the token layer
// + shared components on top of it. Every page renders through pageShell()
// so chrome, meta, fonts, and a11y features stay uniform.

import type { Lang } from './i18n.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const SPARK = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2v5m0 10v5M2 12h5m10 0h5M5.6 5.6l3.2 3.2m6.4 6.4l3.2 3.2M5.6 18.4l3.2-3.2m6.4-6.4l3.2-3.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

// Design tokens + shared components (Figma port). Pico provides the
// element baseline; these classes carry the product look.
export const SF_CSS = `
:root{
  --sf-green:#123b2c; --sf-green-2:#153c2d; --sf-green-3:#173d2e;
  --sf-ink:#123629; --sf-ink-2:#18382b; --sf-ink-3:#254331;
  --sf-cream:#f4f6ef; --sf-cream-2:#f6f7f2; --sf-cream-3:#edf0e8;
  --sf-lime:#c8f36d; --sf-lime-2:#d2efa1; --sf-lime-3:#d9efa9;
  --sf-coral:#f17e64; --sf-coral-2:#f19478; --sf-coral-a11y:#b5502f;
  --sf-sage:#629876; --sf-mist:rgba(255,255,255,.65);
  --sf-line:#d5dbd1; --sf-line-2:#e3e7de;
  --sf-card:#ffffff;
  --sf-muted:#616761; --sf-ink-mute:#5a6a60;
  --sf-ok:#4a7a4a; --sf-ok-bright:#8fd18f; --sf-ok-soft:#cfe9cf;
  --sf-warn:#f6c344; --sf-warn-soft:#f0d78a;
  --sf-gold:#7a5a00; --sf-gold-soft:#ffeecc;
  --sf-danger:#e88f8f; --sf-danger-ink:#aa3333;
  --sf-info:#2f5c67; --sf-info-bright:#7fb3e8;
  --sf-pale:#f7f8f2; --sf-green-0:#102c22; --sf-green-4:#315c4a;
  --sf-faint:#5f6b64; --sf-peach:#efaf7f; --sf-teal:#94c8c0;
  --sf-lime-deep:#9bc759; --sf-blue:#79aebb; --sf-gold-mid:#e4b34d;
  --sf-gold-tint:#fffdf6; --sf-gold-line:#e8e0c8; --sf-gold-ink:#8a6d1f;
  --sf-ok-ink:#3c5c1a; --sf-coral-ink:#8a3c22;
  --sf-danger-deep:#7a2828; --sf-danger-soft:#fdecea;
  --sf-serif:'DM Serif Display',Georgia,serif;
  --sf-sans:'Figtree','Manrope',system-ui,-apple-system,sans-serif;
font-family:var(--sf-sans); color:var(--sf-ink); background:var(--sf-cream);
  font-synthesis:none;
}
html{scroll-behavior:smooth}
body{margin:0;min-width:320px;background:var(--sf-cream);color:var(--sf-ink)}
/* Full-bleed layout — Pico classless wraps main in a max-width container;
   our sections control their own inner measure. */
body>header{padding:0;max-width:none;margin:0}
body>main{padding:0;max-width:none;margin:0}
body>footer{padding:0;max-width:none;margin:0}
a{color:var(--sf-sage)}
.skip-link{position:absolute;left:-999px;top:0;background:var(--sf-lime);color:var(--sf-ink);padding:.6rem 1rem;z-index:99;font-weight:800;font-size:12px}
.skip-link:focus{left:8px;top:8px}
:focus-visible{outline:2px solid var(--sf-coral);outline-offset:2px}

/* ── topbar ─────────────────────────────────────────── */
.topbar{min-height:72px;padding:.6rem clamp(20px,5vw,80px);display:flex;align-items:center;justify-content:space-between;gap:1rem;background:var(--sf-green);color:var(--sf-pale);border-bottom:1px solid rgba(255,255,255,.12)}
.brand{color:inherit;display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-size:20px;font-weight:800;letter-spacing:-.7px}
.brand-mark{width:31px;height:31px;display:grid;place-items:center;border-radius:50%;color:var(--sf-ink);background:var(--sf-lime);flex:none}
.nav-links{display:flex;gap:clamp(18px,2.6vw,40px);align-items:center}
.nav-links a{color:inherit;text-decoration:none;font-size:13px;font-weight:600;opacity:.76;transition:opacity .2s}
.nav-links a:hover{opacity:1}
.nav-cta{display:inline-flex;align-items:center;gap:8px;padding:11px 17px;border-radius:99px;background:var(--sf-coral);color:var(--sf-ink)!important;text-decoration:none;font-weight:800;font-size:12px;white-space:nowrap;opacity:1}
.nav-toggle{display:none}
.nav-toggle summary{list-style:none;cursor:pointer;display:grid;place-items:center;width:40px;height:40px;border-radius:8px;color:var(--sf-pale)}
.nav-toggle summary::-webkit-details-marker{display:none}
.nav-toggle summary::after,.nav-toggle summary::before{display:none!important}
.nav-toggle[open] summary{background:rgba(255,255,255,.1)}
.nav-menu{position:absolute;top:72px;left:0;right:0;z-index:30;display:flex;flex-direction:column;gap:4px;padding:16px 24px 22px;background:var(--sf-green);border-bottom:1px solid rgba(255,255,255,.14)}
.nav-menu a{color:var(--sf-pale);text-decoration:none;font-size:14px;font-weight:700;padding:8px 0}

/* ── buttons / pills ────────────────────────────────── */
.primary-button,.secondary-button,.lime-button{border:0;display:inline-flex;align-items:center;justify-content:center;gap:12px;border-radius:99px;text-decoration:none;font-weight:800;transition:transform .2s,box-shadow .2s}
.primary-button{background:var(--sf-coral);color:var(--sf-ink);padding:15px 23px;box-shadow:0 12px 30px rgba(31,18,12,.16)}
.primary-button:hover,.lime-button:hover{transform:translateY(-2px)}
.secondary-button{color:var(--sf-pale);padding:15px 6px;border-bottom:1px solid rgba(255,255,255,.45);border-radius:0}
.lime-button{padding:16px 26px;color:var(--sf-ink-2);background:var(--sf-lime)}
.eyebrow,.kicker{color:var(--sf-sage);font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:2px}
.eyebrow{display:flex;align-items:center;gap:9px;color:var(--sf-lime-2);margin-bottom:24px}
.kicker.light{color:var(--sf-lime)}
.live-dot{width:7px;height:7px;background:var(--sf-lime);border-radius:50%;box-shadow:0 0 0 5px rgba(200,243,109,.12);flex:none}

/* ── hero ───────────────────────────────────────────── */
.hero{min-height:640px;background:var(--sf-green);color:var(--sf-pale);padding:96px clamp(24px,8vw,130px) 100px;position:relative;isolation:isolate}
.hero::before{content:'';position:absolute;inset:0;opacity:.13;z-index:-1;background-image:radial-gradient(rgba(255,255,255,.8) .65px,transparent .65px);background-size:9px 9px;mask-image:linear-gradient(to right,black,transparent 60%)}
.hero-glow{position:absolute;border-radius:50%;z-index:-1}
.glow-one{width:500px;height:500px;right:3%;top:11%;background:rgba(89,139,95,.2);box-shadow:0 0 140px rgba(172,235,120,.1)}
.glow-two{width:300px;height:300px;left:-10%;bottom:-15%;background:rgba(241,126,100,.09)}
.hero h1,.section-heading h2,.how h2,.impact h2,.cta h2{font-family:var(--sf-serif);font-weight:400;letter-spacing:-2.8px;line-height:.99}
.hero h1{font-size:clamp(52px,5.5vw,71px);max-width:700px;margin:0;color:var(--sf-pale)}
.hero h1 em,.section-heading h2 em,.how h2 em,.impact h2 em,.cta h2 em{color:var(--sf-coral-2);font-weight:inherit;font-style:italic}
.hero-copy{max-width:610px;font-size:18px;line-height:1.7;color:rgba(245,248,240,.72);margin:30px 0}
.hero-actions{display:flex;gap:26px;align-items:center;flex-wrap:wrap}
.trust-line{margin-top:50px;display:flex;align-items:center;gap:16px;font-size:12px;color:rgba(255,255,255,.78)}
.trust-line p{margin:0;color:rgba(255,255,255,.78)}
.trust-line strong{color:var(--sf-pale)}
.avatar-stack{display:flex}
.avatar-stack span{width:29px;height:29px;display:grid;place-items:center;border-radius:50%;border:2px solid var(--sf-green-3);margin-left:-7px;color:var(--sf-pale);background:var(--sf-green-4)}
.avatar-stack span svg{width:13px;height:13px}
.avatar-stack span:first-child{margin-left:0}
.avatar-stack span:last-child{color:var(--sf-ink);background:var(--sf-lime);font-size:9px;font-weight:800}

/* ── orbit card (hero) ──────────────────────────────── */
.orbit-card{position:absolute;right:clamp(28px,8vw,140px);top:150px;width:min(28vw,390px);padding:26px;border:1px solid rgba(255,255,255,.14);background:rgba(31,77,58,.75);box-shadow:0 30px 80px rgba(2,18,11,.33);border-radius:19px;backdrop-filter:blur(16px);transform:rotate(2deg)}
.orbit-topline,.orbit-footer,.progress-label{display:flex;justify-content:space-between;align-items:center}
.orbit-topline{color:rgba(255,255,255,.55);font-size:10px}
.status-pill{display:inline-flex;align-items:center;gap:7px;color:var(--sf-lime-3);padding:6px 9px;border-radius:99px;background:rgba(200,243,109,.1);font-size:10px;font-weight:700}
.status-pill span{width:6px;height:6px;border-radius:50%;background:var(--sf-lime)}
.orbit-card h3{font-family:var(--sf-serif);font-size:27px;line-height:1.12;font-weight:400;margin:30px 0 11px;color:var(--sf-pale)}
.orbit-card>p{display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.55);font-size:11px;margin:0}
.progress-label{margin-top:32px;font-size:10px;color:rgba(255,255,255,.6)}
.progress-label strong{color:var(--sf-lime-3)}
.progress,.card-progress{height:5px;background:rgba(255,255,255,.09);overflow:hidden;border-radius:99px;margin:10px 0 24px}
.progress span,.card-progress span{display:block;height:100%;background:var(--sf-lime);border-radius:inherit}
.orbit-footer a{display:inline-flex;align-items:center;gap:7px;color:var(--sf-lime-3);text-decoration:none;font-weight:800;font-size:11px}
.mini-avatars{display:flex}
.mini-avatars i{width:21px;height:21px;border-radius:50%;margin-left:-6px;background:var(--sf-peach);border:2px solid var(--sf-green-4)}
.mini-avatars i:first-child{margin:0;background:var(--sf-teal)}
.mini-avatars i:last-child{background:var(--sf-lime-2)}
.float-badge{position:absolute;display:flex;align-items:center;gap:10px;padding:11px 15px;border-radius:12px;color:var(--sf-ink);background:var(--sf-pale);font-size:11px;box-shadow:0 20px 50px rgba(4,23,14,.28);text-decoration:none}
.float-badge strong{display:block;font-size:15px;color:var(--sf-ink)}
.badge-one{right:clamp(340px,30vw,480px);top:480px;transform:rotate(-4deg)}
.badge-two{right:clamp(30px,6vw,100px);top:560px;transform:rotate(3deg)}

/* ── ticker ─────────────────────────────────────────── */
.ticker{min-height:64px;padding:0 clamp(24px,6vw,90px);display:flex;align-items:center;gap:38px;border-bottom:1px solid var(--sf-line-2);background:var(--sf-cream-3);overflow:hidden;white-space:nowrap}
.ticker-label{color:var(--sf-green-3);font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:1.5px;flex:none}
.ticker-track{display:flex;gap:45px;color:var(--sf-ink-3);font-size:11px;overflow:hidden}
.ticker-track span{display:flex;align-items:center;gap:10px;flex:none}
.ticker-track b{width:5px;height:5px;border-radius:50%;background:var(--sf-coral);flex:none}

/* ── sections / headings ────────────────────────────── */
.section{padding:100px clamp(24px,7vw,110px)}
.section-inner{max-width:1250px;margin:auto}
.possibilities{background:var(--sf-cream-2)}
.section-heading{display:flex;justify-content:space-between;align-items:end;gap:40px;max-width:1250px;margin:auto}
.section-heading h2,.how h2,.impact h2,.cta h2{font-size:clamp(44px,5vw,72px);margin:16px 0 0;color:var(--sf-ink-2)}
.section-heading p{max-width:390px;color:var(--sf-muted);line-height:1.7;font-size:14px}

/* ── deck controls + card grid ──────────────────────── */
.deck-controls{max-width:1250px;margin:56px auto 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--sf-line);gap:20px;flex-wrap:wrap}
.filters{display:flex;gap:26px;flex-wrap:wrap}
.filters a{padding:0 0 15px;border:0;border-bottom:2px solid transparent;color:var(--sf-muted);font-size:12px;font-weight:700;text-decoration:none}
.filters a.active{color:var(--sf-green-3);border-color:var(--sf-coral)}
.search-field{min-width:220px;display:flex;align-items:center;gap:9px;color:var(--sf-faint);padding-bottom:12px}
.search-field input{width:100%;border:0;outline:0;background:transparent;color:var(--sf-ink);font-size:13px;font-family:inherit}
.card-grid{max-width:1250px;margin:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px}
.possibility-card{--accent:var(--sf-lime-deep);min-height:400px;border-radius:12px;padding:24px;display:flex;flex-direction:column;background:var(--sf-card);border:1px solid var(--sf-line-2);box-shadow:0 16px 45px rgba(34,53,42,.05);transition:transform .25s,box-shadow .25s}
.possibility-card:hover{transform:translateY(-7px);box-shadow:0 25px 55px rgba(34,53,42,.11)}
.possibility-card.blue{--accent:var(--sf-blue)}.possibility-card.coral{--accent:var(--sf-coral-2)}
.possibility-card.gold{--accent:var(--sf-gold-mid)}.possibility-card.muted{--accent:var(--sf-faint)}
.card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.category{padding:6px 9px;border-radius:4px;color:var(--sf-ink-3);background:color-mix(in srgb,var(--accent) 22%,white);font-size:10px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800}
.card-status{display:flex;align-items:center;gap:6px;color:var(--sf-muted);font-size:10px}
.card-status i{width:5px;height:5px;border-radius:50%;background:var(--accent)}
.possibility-card h3{margin:24px 0 10px;font-family:var(--sf-serif);font-weight:400;color:var(--sf-ink-2);font-size:23px;line-height:1.16}
.location{display:flex;align-items:center;gap:6px;margin:0;color:var(--sf-faint);font-size:11px}
.card-metric{display:grid;grid-template-columns:repeat(3,1fr);margin-top:28px}
.card-metric div{border-right:1px solid var(--sf-line-2)}
.card-metric div:last-child{border:0;padding-left:12px}
.card-metric div:nth-child(2){padding-left:12px}
.card-metric strong,.card-metric span{display:block}
.card-metric strong{font-size:17px}
.card-metric span{color:var(--sf-faint);font-size:10px;margin-top:2px}
.card-progress{background:var(--sf-cream-3);margin:17px 0 21px}
.card-progress span{background:var(--accent)}
.needs{display:flex;flex-wrap:wrap;align-items:center;gap:5px;color:var(--sf-faint);font-size:10px}
.needs>span{margin-right:3px;text-transform:uppercase;font-weight:800;letter-spacing:1px}
.needs b{font-weight:600;padding:5px 7px;color:var(--sf-ink-mute);background:var(--sf-cream-3);border-radius:4px}
.join-button{margin-top:auto;padding:13px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--sf-line-2);background:transparent;color:var(--sf-ink-3);border-radius:7px;font-weight:800;font-size:11px;transition:background-color .2s,color .2s,border-color .2s;text-decoration:none}
.join-button:hover{background:var(--sf-green-3);color:var(--sf-pale);border-color:var(--sf-green-3)}
.empty-state{text-align:center;padding:70px;color:var(--sf-muted);grid-column:1/-1}

/* ── attention strip ────────────────────────────────── */
.attention{background:var(--sf-gold-tint);border-block:1px solid var(--sf-gold-line);padding:26px clamp(24px,6vw,90px)}
.attention h2{font-family:var(--sf-sans);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--sf-gold-ink);margin:0 0 12px}
.att{display:inline-block;border:1px solid var(--sf-gold-line);border-radius:.4rem;padding:.9rem;background:var(--sf-card);margin:0 .8rem .8rem 0;font-size:13px;vertical-align:top;max-width:22rem}
.att strong::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--sf-sage);margin-right:.45rem;vertical-align:middle}
.att a{color:var(--sf-coral-a11y);font-weight:700}

/* ── how it works ───────────────────────────────────── */
.how{display:grid;grid-template-columns:.85fr 1.15fr;gap:80px;color:var(--sf-pale);background:var(--sf-green-3)}
.how h2,.cta h2{color:var(--sf-pale)}
.how-intro>p{margin:30px 0;max-width:430px;line-height:1.7;color:rgba(255,255,255,.6);font-size:14px}
.how-intro>a{color:var(--sf-lime-3);display:inline-flex;align-items:center;gap:10px;font-size:12px;font-weight:800;text-decoration:none}
.steps{border-top:1px solid rgba(255,255,255,.15)}
.step{display:grid;grid-template-columns:50px 1fr;gap:15px;padding:27px 18px;border-bottom:1px solid rgba(255,255,255,.13);opacity:.55;transition:opacity .2s,background-color .2s}
.step:hover{opacity:1;background:rgba(255,255,255,.035)}
.step>span{color:var(--sf-lime);font-size:10px;font-weight:800}
.step h3{margin:0 0 8px;font-family:var(--sf-serif);font-size:26px;font-weight:400;color:var(--sf-pale)}
.step p{max-width:480px;margin:0;color:rgba(255,255,255,.58);font-size:12px;line-height:1.65}

/* ── impact panel ───────────────────────────────────── */
.impact{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:100px;background:var(--sf-cream-3)}
.impact-copy>p{max-width:550px;color:var(--sf-muted);line-height:1.8}
.impact-points{margin-top:30px;display:grid;gap:12px}
.impact-points span{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700}
.impact-points svg{color:var(--sf-sage);flex:none}
.impact-panel{padding:35px;border-radius:13px;color:var(--sf-pale);background:var(--sf-green-2);box-shadow:0 35px 70px rgba(19,49,37,.18)}
.panel-header{display:flex;justify-content:space-between;align-items:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.55)}
.live-pill{color:var(--sf-lime)}
.big-stat{margin:45px 0 25px}
.big-stat strong,.big-stat span{display:block}
.big-stat strong{font-family:var(--sf-serif);font-size:60px;font-weight:400;letter-spacing:-2px}
.big-stat span{font-size:10px;color:rgba(255,255,255,.5)}
.panel-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:28px}
.panel-stats strong,.panel-stats span{display:block}
.panel-stats strong{font-size:20px}
.panel-stats span{color:rgba(255,255,255,.5);font-size:9px;margin-top:4px}

/* ── CTA band ───────────────────────────────────────── */
.cta{text-align:center;color:var(--sf-pale);background:var(--sf-coral);position:relative}
.cta-mark{width:58px;height:58px;display:grid;place-items:center;margin:0 auto 28px;border-radius:50%;color:var(--sf-ink);background:var(--sf-lime)}
.cta .kicker{color:var(--sf-green-3)}
.cta h2{margin:16px auto 24px}
.cta h2 em{color:var(--sf-green-3)}
.cta p{color:rgba(255,255,255,.85);font-size:14px}

/* ── footer ─────────────────────────────────────────── */
body>footer{min-height:150px;padding:45px clamp(24px,6vw,90px);display:grid;grid-template-columns:1fr 1fr 2fr 1fr;align-items:center;gap:30px;color:rgba(255,255,255,.72);background:var(--sf-green-0);font-size:11px}
.footer-brand{color:var(--sf-pale);display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px;text-decoration:none}
body>footer>div{display:flex;justify-content:center;gap:22px;color:rgba(255,255,255,.7);flex-wrap:wrap}
body>footer>div a{color:rgba(255,255,255,.7);text-decoration:none}
body>footer>div a:hover{color:var(--sf-pale)}
body>footer>span{text-align:right;line-height:1.7}

/* ── generic content pages ──────────────────────────── */
.page{max-width:1250px;margin:auto;padding:56px clamp(24px,6vw,90px) 100px}
.page h1{font-family:var(--sf-serif);font-weight:400;font-size:clamp(36px,4vw,56px);letter-spacing:-1.5px;color:var(--sf-ink-2);margin:10px 0 18px}
.page h2{font-family:var(--sf-serif);font-weight:400;font-size:30px;color:var(--sf-ink-2);margin-top:2.4rem}
.page h3{color:var(--sf-ink-2)}
.page .lede{max-width:46rem;color:var(--sf-muted);line-height:1.75;font-size:15px}
.page table{border-collapse:collapse;width:100%;background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:10px;overflow:hidden;font-size:13px}
.page th,.page td{border-bottom:1px solid var(--sf-line-2);padding:.65rem .8rem;text-align:left}
.page th{background:var(--sf-cream-3);font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--sf-ink-mute)}
.page input,.page select,.page textarea{border:1px solid var(--sf-line);border-radius:8px;padding:.55rem .7rem;font:inherit;font-size:13px;background:var(--sf-card)}
.page button,.page input[type=submit]{background:var(--sf-green-3);color:var(--sf-card);border:0;border-radius:99px;padding:.6rem 1.2rem;font-weight:800;font-size:12px;cursor:pointer}
.page button:hover,.page input[type=submit]:hover{background:var(--sf-green-0)}
.badge{display:inline-block;padding:.25rem .6rem;border-radius:99px;background:var(--sf-cream-3);font-size:11px;font-weight:700;color:var(--sf-ink-3)}
.badge.lime{background:rgba(200,243,109,.35);color:var(--sf-ok-ink)}
.badge.coral{background:rgba(241,126,100,.2);color:var(--sf-coral-ink)}
.badge.gold{background:rgba(228,179,77,.22);color:var(--sf-gold-ink)}
.badge.blue{background:rgba(121,174,187,.22);color:var(--sf-info)}
.muted{color:var(--sf-muted);font-size:12px}
.page .card{background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:12px;padding:1.2rem;margin:1rem 0;box-shadow:0 8px 25px rgba(34,53,42,.04)}
.page .card h3{font-family:var(--sf-serif);font-weight:400;font-size:22px;margin:.2rem 0 .6rem;color:var(--sf-ink-2)}
.page .val{display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap}
.page .val input{padding:.5rem .7rem;flex:1;min-width:8rem}
.page .val select{padding:.5rem}
.page details{margin:.4rem 0}
.page summary{cursor:pointer;font-weight:700;font-size:13px}
.page .res{background:rgba(200,243,109,.25);padding:.55rem .75rem;border-radius:.5rem;font-size:13px}
.page .dir{color:var(--sf-ok);font-size:.85rem;font-style:italic}
.page .meta{font-size:.8rem;color:var(--sf-muted)}
.page .req{color:var(--sf-danger-ink);font-size:.8rem}
.page .nice{color:var(--sf-muted);font-size:.8rem}
.page .met{color:var(--sf-ok);font-size:.8rem}
.page .bar{background:var(--sf-cream-3);border-radius:99px;min-height:6px;margin:.4rem 0;overflow:hidden;padding:.15rem .5rem;display:inline-block}
.page .fill{background:var(--sf-lime);height:100%}
.page tr.con td{background:var(--sf-danger-soft);color:var(--sf-danger-deep)}
.page blockquote{border-left:3px solid var(--sf-line);margin:.5rem 0;padding:.2rem 1rem;color:var(--sf-muted)}
.page code{background:var(--sf-cream-3);padding:.1em .35em;border-radius:.25em;font-size:.9em}
.stat-row{display:flex;gap:1rem;flex-wrap:wrap;margin:1.5rem 0}
.stat-chip{background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:10px;padding:.8rem 1.1rem;font-size:12px;min-width:9rem}
.stat-chip strong{display:block;font-size:20px;font-family:var(--sf-serif);font-weight:400;color:var(--sf-ink-2)}
.stat-chip span{color:var(--sf-faint);font-size:11px;text-transform:uppercase;letter-spacing:1px}

/* ── modal (declare form etc.) ──────────────────────── */
.modal-backdrop{position:fixed;inset:0;z-index:50;padding:20px;display:grid;place-items:center;background:rgba(8,28,20,.7);backdrop-filter:blur(8px)}
.modal{width:min(560px,100%);padding:42px;position:relative;border-radius:18px;background:var(--sf-cream-2);box-shadow:0 30px 100px rgba(0,0,0,.3)}
.modal-close{position:absolute;top:20px;right:20px;display:grid;place-items:center;border:0;background:transparent;color:var(--sf-ink-mute);text-decoration:none;font-size:18px;line-height:1}
.modal h2{margin:14px 0 8px;font-family:var(--sf-serif);color:var(--sf-ink);font-weight:400;font-size:39px;line-height:1.06}
.modal>p{color:var(--sf-muted);font-size:12px;margin-bottom:28px}
.modal label{display:grid;gap:8px;color:var(--sf-ink-3);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800;margin-bottom:14px}
.modal input,.modal textarea{width:100%;border:1px solid var(--sf-line);border-radius:8px;color:var(--sf-ink-2);background:var(--sf-card);outline:none;padding:13px;text-transform:none;letter-spacing:0;font-weight:500;font-size:13px;box-sizing:border-box}
.modal input:focus,.modal textarea:focus{border-color:var(--sf-sage);box-shadow:0 0 0 3px rgba(103,152,93,.12)}
.modal textarea{min-height:100px;resize:vertical}
.modal-row{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.modal-submit{width:100%;margin-top:10px;padding:15px;border:0;border-radius:99px;background:var(--sf-coral);color:var(--sf-ink);font-weight:800;font-size:14px;cursor:pointer}
/* no-JS modal: #declare dialog opens via :target */
dialog.sf-dialog,.modal-anchor:not(:target) .modal-backdrop{display:none}
.modal-anchor:target .modal-backdrop{display:grid}

@media (max-width:1050px){
  .nav-links,.nav-cta{display:none}
  .nav-toggle{display:block;position:relative}
  .topbar{position:relative}
  .hero{min-height:auto;padding:70px 24px 60px}
  .orbit-card{position:static;width:auto;transform:none;margin-top:44px}
  .float-badge{position:static;transform:none;display:inline-flex;margin:12px 12px 0 0}
  .card-grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
  .how{gap:50px}
  .impact{gap:60px}
  body>footer{grid-template-columns:1fr 1fr}
  body>footer>div{justify-content:flex-start}
  body>footer>span{text-align:left}
}
@media (max-width:720px){
  .hero h1{font-size:46px;letter-spacing:-1.8px}
  .hero-copy{font-size:15px}
  .hero-actions{flex-direction:column;align-items:stretch;gap:14px}
  .ticker-track span:nth-child(n+2){display:none}
  .section{padding:70px 20px}
  .section-heading{display:block}
  .section-heading h2,.how h2,.impact h2,.cta h2{font-size:42px;letter-spacing:-1.8px}
  .section-heading p{margin-top:24px}
  .filters{gap:18px;overflow-x:auto}
  .search-field{width:100%}
  .how,.impact{grid-template-columns:1fr;gap:50px}
  .impact-panel{padding:25px}
  .big-stat strong{font-size:50px}
  body>footer{grid-template-columns:1fr;padding:45px 24px}
  .modal{padding:35px 22px 24px}
  .modal h2{font-size:34px}
  .modal-row{grid-template-columns:1fr}
  .page table{display:block;overflow-x:auto;max-width:100%}
  .page table td,.page table th{min-width:7rem}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
}
`;

const NAV_ITEMS: Array<[string, string]> = [
  ['/possibilities', 'Deck'],
  ['/rounds', 'Rounds'],
  ['/outcomes', 'Outcomes'],
  ['/coordination', 'Coordination'],
  ['/docs', 'API'],
  ['/all', 'All'],
];

export const topbar = (): string => `
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <a class="brand" href="/"><span class="brand-mark">${SPARK}</span>Springforth</a>
  <nav class="nav-links" aria-label="Primary">
    ${NAV_ITEMS.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}
  </nav>
  <a class="nav-cta" href="/possibilities#declare">Start a possibility</a>
  <details class="nav-toggle">
    <summary aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
    <nav class="nav-menu" aria-label="Mobile">
      ${NAV_ITEMS.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}
      <a href="/possibilities#declare">Start a possibility</a>
    </nav>
  </details>
</header>`;

export const siteFooter = (gen = new Date().toISOString()): string => `
<footer>
  <a class="footer-brand" href="/"><span class="brand-mark">${SPARK}</span>Springforth</a>
  <span>Open source · built for the commons.<br>Coordinate first.</span>
  <div>
    <a href="/possibilities">Deck</a><a href="/rounds">Rounds</a>
    <a href="/outcomes">Outcomes</a><a href="/coordination">Coordination</a>
    <a href="/ledger">Ledger</a><a href="/docs">API</a>
  </div>
  <span>generated ${esc(gen)} · <a href="/ledger/verify" style="color:rgba(255,255,255,.7)">verify the ledger</a></span>
</footer>`;

export interface ShellOpts {
  title: string;                 // <title> + og:title
  desc?: string;                 // meta description + og:description
  lang?: Lang;
  extraCss?: string;             // page-specific CSS appended after SF_CSS
  body?: string;                 // extra classes on <body>
  htmx?: boolean;                // include htmx script (default true)
}

export function pageShell(o: ShellOpts, bodyHtml: string): string {
  const desc = o.desc ?? 'Declare what you want to make happen. Find the people and resources already around you. When enough commit, coordination activates.';
  const lang = o.lang ?? 'en';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="https://springforth.widespread.workers.dev/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://springforth.widespread.workers.dev/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap">
<link rel="stylesheet" href="/vendor/pico.css">
<style>${SF_CSS}${o.extraCss ?? ''}</style></head>
<body${o.body ? ` class="${esc(o.body)}"` : ''}>
${topbar()}
<main id="main">
${bodyHtml}
</main>
${siteFooter()}
${o.htmx === false ? '' : '<script src="/vendor/htmx.js" defer></script>'}
</body></html>`;
}
