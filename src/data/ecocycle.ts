// The ecocycle — the transcript's lifecycle frame (Liberating
// Structures "Ecocycle Planning"; the method name is public art, this
// diagram is drawn original). A possibility's stage is *derived* from
// its status — never stored — so the cycle can't drift from the ledger:
//
//   draft     → seed      — potentiality; an "I want to…" not yet open
//   active    → sprout    — gathering resources/people (the MVP stage)
//   quorum    → maturity  — the constellation completed; value creation
//   completed → compost   — event happened; report + nextNeeds return
//   expired   → compost   — demurrage released it ("delete it, don't
//                           clog the landscape") — nutrients feed the
//                           next cycle via the audit ledger
//
// The two traps are likewise derived, not stored:
//   scarcity (seed→sprout valley): deadline closing while quorum is
//     still unmet — the seed can't gather resources in time. Same 3-day
//     window as the expiringSoon metric.
//   rigidity (maturity→compost valley): completed with no filed report
//     — value realized but the learnings never returned to the commons.
//
// ecocycleSvg renders the ∞ loop server-side (no client JS — same rule
// as /map). Labels are caller-supplied so both the portal strings and
// React i18next feed it; only --sf-* tokens are used so dark mode works.
// The trap marker reuses lucide's triangle-alert path (ISC) scaled down.

import type { PossibilityStatus } from '../core';

export const ECOCYCLE_STAGES = ['seed', 'sprout', 'maturity', 'compost'] as const;
export type EcocycleStage = typeof ECOCYCLE_STAGES[number];

export const ecocycleStage = (s: PossibilityStatus): EcocycleStage =>
  s === 'draft' ? 'seed'
    : s === 'active' ? 'sprout'
      : s === 'quorum' ? 'maturity' : 'compost';

const SCARCITY_WINDOW = 3 * 86_400_000;   // same as expiringSoon
export function ecocycleTraps(a: {
  status: PossibilityStatus; quorumMet: boolean;
  deadline?: string; hasReport: boolean; now?: number;
}): { scarcity: boolean; rigidity: boolean } {
  const now = a.now ?? Date.now();
  return {
    scarcity: (a.status === 'draft' || a.status === 'active')
      && !a.quorumMet && !!a.deadline
      && Date.parse(a.deadline) - now < SCARCITY_WINDOW,
    rigidity: a.status === 'completed' && !a.hasReport,
  };
}

// Node positions on the ∞ (viewBox 0 0 240 120). Left loop = the
// generative half (seed low, sprout high); right loop = the release
// half (maturity high, compost low). Traps sit in the two valleys:
// scarcity in the left loop's inner bowl (renewal→birth), rigidity on
// the right loop's peak (maturity→destruction).
const NODE: Record<EcocycleStage, { x: number; y: number; labelBelow: boolean }> = {
  seed: { x: 52, y: 97, labelBelow: true },
  sprout: { x: 58, y: 22, labelBelow: false },
  maturity: { x: 182, y: 22, labelBelow: false },
  compost: { x: 186, y: 97, labelBelow: true },
};
const TRAP = {
  scarcity: { x: 96, y: 80 },
  rigidity: { x: 150, y: 34 },
} as const;

// lucide triangle-alert (ISC), 24×24 viewBox markup.
const ALERT = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ecocycleSvg(args: {
  stage?: EcocycleStage;                // omit for aggregate/portfolio —
                                        // no single current stage
  scarcity: boolean;
  rigidity: boolean;
  labels: Record<string, string>;       // {title, seed, sprout, maturity,
                                        //  compost, trapScarcity, trapRigidity}
  counts?: Record<string, number>;      // portfolio variant: per-stage n
  variant?: 'card' | 'portfolio';
}): string {
  const { stage, scarcity, rigidity, labels } = args;
  const big = args.variant === 'portfolio';
  const w = big ? 280 : 240, h = big ? 128 : 120;
  const sx = w / 240;
  const node = (s: EcocycleStage) => {
    const p = NODE[s];
    const on = s === stage;
    const n = args.counts?.[s];
    return `<g>
<circle cx="${p.x * sx}" cy="${p.y}" r="${on ? 11 : 8}"
  fill="${on ? 'var(--sf-lime)' : 'var(--sf-card)'}"
  stroke="${on ? 'var(--sf-coral)' : 'var(--sf-line)'}" stroke-width="${on ? 2 : 1}"/>
<circle cx="${p.x * sx}" cy="${p.y}" r="3" fill="${on ? 'var(--sf-ink-fixed)' : 'var(--sf-muted)'}"/>
<text x="${p.x * sx}" y="${p.y + (p.labelBelow ? 24 : -16)}" text-anchor="middle"
  font-size="${big ? 10 : 9}" font-weight="${on ? 700 : 400}"
  fill="${on ? 'var(--sf-ink)' : 'var(--sf-muted)'}">${esc(labels[s] ?? s)}${n != null ? ` (${n})` : ''}</text>
</g>`;
  };
  const trap = (t: { x: number; y: number }, active: boolean, label: string, count?: number) => `
<g transform="translate(${t.x * sx},${t.y}) scale(.45)"
   fill="${active ? 'var(--sf-gold-soft)' : 'none'}"
   stroke="${active ? 'var(--sf-gold)' : 'var(--sf-line)'}"
   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ALERT}</g>
<text x="${t.x * sx}" y="${t.y + 16}" text-anchor="middle" font-size="8"
  fill="${active ? 'var(--sf-gold)' : 'var(--sf-line)'}">${esc(label)}${count != null ? ` (${count})` : ''}</text>`;
  const stageLabel = stage ? `${labels.title ?? 'ecocycle'}: ${labels[stage] ?? stage}`
    : (labels.title ?? 'ecocycle');
  return `<svg viewBox="0 0 ${w} ${h}" role="img"
  aria-label="${esc(stageLabel)}"
  style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">
<title>${esc(stageLabel)}</title>
<path d="M120,61 C100,18 38,16 28,52 C18,84 66,112 120,61" fill="none"
  stroke="var(--sf-line)" stroke-width="1.5" transform="scale(${sx},1)"/>
<path d="M120,61 C140,104 202,106 212,70 C222,38 174,10 120,61" fill="none"
  stroke="var(--sf-line)" stroke-width="1.5" transform="scale(${sx},1)"/>
${ECOCYCLE_STAGES.map(node).join('\n')}
${trap(TRAP.scarcity, scarcity, labels.trapScarcity ?? 'scarcity', args.counts?.scarcity)}
${trap(TRAP.rigidity, rigidity, labels.trapRigidity ?? 'rigidity', args.counts?.rigidity)}
</svg>`;
}
