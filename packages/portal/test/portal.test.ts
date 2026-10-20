import { describe, expect, it } from 'vitest';
import { renderLandingPage } from '../src/landing.ts';
import { renderPossibilitiesPage } from '../src/possibilities.ts';
import { renderCoordinationPage } from '../src/coordination.ts';
import { renderPortfolioPage } from '../src/portfolio.ts';
import { renderOutcomesPage } from '../src/outcomes.ts';

const possibility = {
  id: 'p1', title: 'Plant mangroves at Mida Creek', description: 'Community planting day',
  declarerId: 'aisha', place: 'Mida Creek', deadline: '2026-11-01T00:00:00Z',
  minParticipants: 3, status: 'active' as const, createdAt: '2026-10-20T00:00:00Z',
};

describe('portal renderers', () => {
  it('landing renders how-it-works + cards', () => {
    const html = renderLandingPage({
      cards: [{ possibility, participants: 2 }],
      proposedOverlaps: 1, unmetNeeds: 2, actionNodes: [], planCount: 3,
    });
    expect(html).toContain('Plant mangroves');
    expect(html).toContain('/possibilities');
  });
  it('possibilities page renders a card', () => {
    const html = renderPossibilitiesPage([
      {
        ...possibility, score: 0.5,
        scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
        participantCount: 2, needs: [], bringing: [],
        quorum: { met: false, required: 3, requiredMet: 0 },
      },
    ] as never);
    expect(html).toContain('Plant mangroves');
  });
  it('coordination page renders with no overlaps', () => {
    expect(renderCoordinationPage([], [], [])).toContain('overlap');
  });
  it('portfolio + outcomes render empty states', () => {
    expect(renderPortfolioPage([], [], [])).toContain('portfolio');
    expect(renderOutcomesPage([], [], [])).toContain('outcome');
  });
});
