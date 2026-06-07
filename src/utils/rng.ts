/**
 * Seeded linear-congruential RNG, copied verbatim from the prototype.
 * Same seed → same sequence, so the wisteria scene is deterministic per
 * (seed, viewport) and only changes when the geometry is rebuilt on resize.
 */
export function sRng(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280;
  if (s < 0) s += 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
