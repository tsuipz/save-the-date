import { describe, it, expect } from 'vitest';
import { sRng } from './rng';

// sRng is the deterministic seed for the whole scene, so its two guarantees
// — reproducibility per seed and a valid [0, 1) range — are what the canvas
// relies on. These are pure-logic unit tests (highest fidelity, no doubles).
describe('sRng', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = sRng(42);
    const b = sRng(42);

    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];

    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = sRng(1);
    const b = sRng(2);

    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];

    expect(seqA).not.toEqual(seqB);
  });

  it('returns every value within the [0, 1) range', () => {
    const next = sRng(123);

    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('returns in-range values for a seed of zero', () => {
    const next = sRng(0);

    for (let i = 0; i < 100; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('stays in range for a negative seed (exercises the negative guard)', () => {
    // seed * 9301 + 49297 is negative for seed <= -6, hitting the `s += 233280` branch.
    const next = sRng(-6);

    for (let i = 0; i < 100; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('advances state on each call rather than repeating one value', () => {
    const next = sRng(7);

    const first = next();
    const second = next();

    expect(first).not.toBe(second);
  });
});
