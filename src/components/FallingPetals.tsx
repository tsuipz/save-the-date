import { useMemo } from 'react';
import type { CSSProperties } from 'react';

/**
 * 28 drifting petals overlaid on the canvas — ported from the prototype's
 * petal IIFE. Each is a <div> with an inline SVG ellipse background and a
 * randomized position/size/timing for the shared `ptFall` CSS animation.
 * Randomized once at mount via useMemo (purely decorative).
 */
const COUNT = 28;

function buildPetals(): CSSProperties[] {
  const petals: CSSProperties[] = [];
  for (let i = 0; i < COUNT; i++) {
    const hue = 268 + Math.random() * 44;
    const sz = 4 + Math.random() * 8;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='16' viewBox='0 0 12 16'>
      <ellipse cx='6' cy='8.5' rx='4.8' ry='7' fill='hsl(${hue},68%,74%)' opacity='.88'/>
      <ellipse cx='4.8' cy='6.5' rx='1.9' ry='2.8' fill='hsl(${hue - 12},80%,84%)' opacity='.36'/></svg>`;
    petals.push({
      left: `${Math.random() * 100}vw`,
      width: `${sz}px`,
      height: `${sz * 1.38}px`,
      background: `url("data:image/svg+xml,${encodeURIComponent(svg)}") center/contain no-repeat`,
      animationDuration: `${10 + Math.random() * 16}s`,
      animationDelay: `${Math.random() * 24}s`,
    });
  }
  return petals;
}

export default function FallingPetals() {
  const petals = useMemo(() => buildPetals(), []);
  return (
    <div id="petals" aria-hidden="true">
      {petals.map((style, i) => (
        <div key={i} className="pt" style={style} />
      ))}
    </div>
  );
}
