import { describe, it, expect } from 'vitest';
import { checkFromReading, type SourceReading } from '../src/oracle/sources.ts';

const reading: SourceReading = {
  key: 'sentinel2', source: 'remote-sensing', domain: 'environmental',
  value: 0.31, unit: 'ndvi', at: '2026-10-20T00:00:00Z',
  methodologyRef: 'Sentinel-2 L2A NDVI', license: 'ESA open', attribution: 'ESA',
  detail: 'median NDVI',
};

describe('checkFromReading', () => {
  it('pending with no baseline', () => {
    const c = checkFromReading({
      reading, expectedDirection: 'increase', at: '2026-10-20T01:00:00Z', nodeId: 'n1',
    });
    expect(c.result).toBe('pending');
  });
  it('match when reading moves as expected vs baseline', () => {
    const c = checkFromReading({
      reading, baseline: { value: 0.2, at: '2026-09-01T00:00:00Z' },
      expectedDirection: 'increase', at: '2026-10-20T01:00:00Z', nodeId: 'n1',
    });
    expect(c.result).toBe('match');
  });
  it('mismatch when direction contradicts baseline', () => {
    const c = checkFromReading({
      reading, baseline: { value: 0.5, at: '2026-09-01T00:00:00Z' },
      expectedDirection: 'increase', at: '2026-10-20T01:00:00Z', nodeId: 'n1',
    });
    expect(c.result).toBe('mismatch');
  });
  it('null reading → pending check', () => {
    const c = checkFromReading({
      reading: null, expectedDirection: 'increase', at: '2026-10-20T01:00:00Z', nodeId: 'n1',
    });
    expect(c.result).toBe('pending');
  });
});
