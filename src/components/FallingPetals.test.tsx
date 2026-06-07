import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import FallingPetals from './FallingPetals';

// FallingPetals has one real behaviour: it emits a fixed number of decorative
// petal <div>s, each carrying the inline style the shared `ptFall` CSS keyframe
// animates. There are no props, so tests go through the rendered DOM (its only
// public surface). Values are randomized, so we assert on ranges/shape — never
// exact values — to stay deterministic.
describe('FallingPetals', () => {
  it('renders the decorative #petals container hidden from assistive tech', () => {
    const { container } = render(<FallingPetals />);

    const petals = container.querySelector('#petals');
    expect(petals).toBeInTheDocument();
    expect(petals).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders exactly 28 petals', () => {
    const { container } = render(<FallingPetals />);

    expect(container.querySelectorAll('#petals .pt')).toHaveLength(28);
  });

  it('gives each petal the inline styles the ptFall animation needs', () => {
    const { container } = render(<FallingPetals />);
    const petal = container.querySelector<HTMLElement>('.pt')!;

    // Position + size are randomized but always carry vw/px units...
    expect(petal.style.left).toMatch(/vw$/);
    expect(petal.style.width).toMatch(/px$/);
    expect(petal.style.height).toMatch(/px$/);
    // ...and the per-petal animation timing the shared keyframe relies on.
    expect(petal.style.animationDuration).toMatch(/s$/);
    expect(petal.style.animationDelay).toMatch(/s$/);
  });

  it('backs each petal with an inline SVG data-URI', () => {
    const { container } = render(<FallingPetals />);
    const petal = container.querySelector<HTMLElement>('.pt')!;

    expect(petal.getAttribute('style')).toContain('data:image/svg+xml');
  });

  it('keeps every randomized value within its generation range', () => {
    const { container } = render(<FallingPetals />);
    const petals = Array.from(container.querySelectorAll<HTMLElement>('.pt'));

    petals.forEach((p) => {
      const left = parseFloat(p.style.left); // Math.random()*100 → [0,100)vw
      const width = parseFloat(p.style.width); // 4 + Math.random()*8 → [4,12)px
      const height = parseFloat(p.style.height); // width * 1.38
      const dur = parseFloat(p.style.animationDuration); // 10 + r*16 → [10,26)s
      const delay = parseFloat(p.style.animationDelay); // r*24 → [0,24)s

      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThan(100);
      expect(width).toBeGreaterThanOrEqual(4);
      expect(width).toBeLessThan(12);
      expect(height).toBeCloseTo(width * 1.38, 1);
      expect(dur).toBeGreaterThanOrEqual(10);
      expect(dur).toBeLessThan(26);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(24);
    });
  });

  it('memoizes the petals so re-rendering does not reshuffle them', () => {
    const { container, rerender } = render(<FallingPetals />);
    const before = container.querySelector<HTMLElement>('.pt')!.getAttribute('style');

    rerender(<FallingPetals />);
    const after = container.querySelector<HTMLElement>('.pt')!.getAttribute('style');

    expect(after).toBe(before);
  });
});
