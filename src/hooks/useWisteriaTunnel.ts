import { useCallback, useEffect, useRef } from 'react';
import { sRng } from '../utils/rng';

/**
 * useWisteriaTunnel — the canvas engine behind the page.
 *
 * The drawing math is ported directly from the vanilla prototype
 * (index.html); only the lifecycle is React-ified:
 *   - all mutable state lives in refs (no re-renders per frame)
 *   - the rAF loop + resize listener are torn down on unmount
 *   - the static canopy (280 radial gradients) is baked once into an
 *     offscreen canvas and blitted each frame (perf)
 *   - the zoom advances on wall-clock time, so it always finishes in
 *     ~3.83s and stays in sync with App's reveal timer, even when the
 *     frame rate is capped on low-power devices
 *   - geometry adapts on small screens (fewer strands/blobs, lower VP)
 *
 * Returns a `canvasRef` to attach to the <canvas>, and `triggerZoom()`
 * to start the fly-through when the user clicks "Enter the Forest".
 */

// --- Scene constants -------------------------------------------------------

// The prototype advanced the zoom by 1/230 per frame at 60fps, so it completed
// in 230 frames ≈ 3.83s. We drive it by wall-clock instead (see the loop) so
// the duration is identical on a 60fps machine but no longer drifts when the
// frame rate dips — keeping it in lockstep with App's 3900ms reveal timer.
const ZOOM_MS = (230 / 60) * 1000; // ≈ 3833ms

// Vanishing point X as a fraction of width (always centred). The Y fraction is
// dynamic (see `vpYFrac`) because mobile lowers it slightly.
const VP_X_FRAC = 0.5;

// Number of depth layers from the far vanishing point (depth 13) to nearest
// (depth 0). Everything — strand width, length, column count, post size — is
// scaled by the normalized depth `d = depth/(N_DEPTHS-1)` for perspective.
const N_DEPTHS = 14;

// Allowed wisteria hues (purple → mauve only — no blue, no pink). Every petal,
// blob, and post pulls from this palette so the colour stays in the brief's
// 272–308 hue band.
const WISTERIA_HUES = [272, 278, 284, 290, 296, 302, 308];

/** One hanging strand of florets at a given depth/column in the tunnel. */
interface Strand {
  worldX: number; // base X before sway/zoom push
  depth: number; // normalized 0 (near) … 1 (far)
  topY: number; // Y where the strand hangs from the canopy
  len: number; // vertical length in px
  w: number; // half-width of the floret spread
  hue: number; // base HSL hue (from WISTERIA_HUES)
  sat: number; // base HSL saturation %
  lit: number; // base HSL lightness %
  drops: number; // number of floret rows down the strand
  swing: number; // phase offset for the sway sine wave
  swingSpd: number; // angular speed of the sway
  litVar: number; // small per-strand lightness jitter
}

/** One soft radial-gradient blob in the dense canopy mass at the top. */
interface Blob {
  bx: number; // centre X
  by: number; // centre Y
  bSize: number; // radius
  hue: number;
  sat: number;
  lit: number;
  alpha: number; // peak opacity at the centre
  normY: number; // by / canopyH — used to fade/scale by height
}

/** One iron trellis post on the left/right at a given depth. */
interface Post {
  px: number; // X position
  postW: number; // width (shrinks with depth)
  postTop: number; // top Y
  postBot: number; // bottom Y
  depth: number; // normalized depth (drives alpha)
}

/**
 * Quartic ease-out: fast start, gentle settle. Maps linear zoom progress
 * (camZ, 0→1) to the eased value used for the camera push so the fly-through
 * decelerates as it arrives at the vanishing point.
 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function useWisteriaTunnel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomActiveRef = useRef(false);

  const triggerZoom = useCallback(() => {
    zoomActiveRef.current = true;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Typed non-null alias so the narrowing survives into the draw closures.
    const ctx: CanvasRenderingContext2D = context;

    let W = 0;
    let H = 0;
    let tick = 0;
    let camZ = 0;
    let zoomStart = 0;

    let STRANDS: Strand[] = [];
    let CANOPY_BLOBS: Blob[] = [];
    let POSTS: Post[] = [];
    let canopyCache: HTMLCanvasElement | null = null;
    let baseCache: HTMLCanvasElement | null = null;

    // Per-build responsive config (re-derived on every resize).
    let vpYFrac = 0.38;
    let minFloret = 1;

    const vpY = () => H * vpYFrac;
    const vpX = () => W * VP_X_FRAC;

    function buildScene() {
      STRANDS = [];
      CANOPY_BLOBS = [];
      POSTS = [];

      // Mobile improvement: smaller screens get fewer columns/blobs, a lower
      // vanishing point, and chunkier florets so the scene stays legible and
      // cheap to draw on phones. These are read fresh each build, so rotating
      // the device re-tunes the scene on the resize event.
      const isMobile = W < 768;
      const nColsBase = isMobile ? 12 : 22;
      const canopyCount = isMobile ? 150 : 280;
      vpYFrac = isMobile ? 0.42 : 0.38;
      minFloret = isMobile ? 1.6 : 1;

      const vx = vpX();
      const vy = vpY();

      // Build strands far-to-near. `d` is normalized depth: 0 = nearest the
      // camera, 1 = at the vanishing point. Far layers are narrower, shorter,
      // thinner, and have fewer columns — that's the perspective.
      for (let depth = N_DEPTHS - 1; depth >= 0; depth--) {
        const d = depth / (N_DEPTHS - 1);
        // Distinct but stable seed per depth → same scene every rebuild.
        const r = sRng(depth * 97 + 13);
        const tunnelHalfW = W * 0.5 * (1 - d * 0.85); // tunnel narrows with depth
        const tunnelTop = vy - H * 0.01 * (1 - d); // hang point near the VP
        const baseLen = H * (0.45 - d * 0.32); // strands shorten with depth
        const strandW = Math.max(2, W * 0.012 * (1 - d * 0.7)); // thinner far away
        const nCols = Math.max(4, Math.floor(nColsBase * (1 - d * 0.6))); // fewer far

        for (let col = 0; col < nCols; col++) {
          // t spreads columns evenly across the tunnel width (0 = left edge,
          // 1 = right edge); worldX places this column in tunnel space.
          const t = nCols > 1 ? col / (nCols - 1) : 0.5;
          const worldX = vx - tunnelHalfW + t * tunnelHalfW * 2;
          // Pick a hue across the palette by column, nudged randomly so
          // neighbouring strands aren't identical.
          const hue =
            WISTERIA_HUES[
              Math.floor(t * (WISTERIA_HUES.length - 1) + r() * 1.5) %
                WISTERIA_HUES.length
            ];
          const sat = 62 + r() * 18; // 62–80%
          const lit = 44 + d * 14 + r() * 10; // far layers a touch lighter (haze)
          const strandLen = baseLen * (0.65 + r() * 0.7); // vary length per strand
          // One floret row per ~2.2 strand-widths of length.
          const nDrops = Math.max(5, Math.floor(strandLen / (strandW * 2.2)));
          STRANDS.push({
            worldX,
            depth: d,
            topY: tunnelTop,
            len: strandLen,
            w: strandW,
            hue,
            sat,
            lit,
            drops: nDrops,
            swing: r() * Math.PI * 2,
            swingSpd: 0.0005 + r() * 0.0006,
            litVar: (r() - 0.5) * 10,
          });
        }
      }

      // Canopy: a dense mass of soft blobs filling the top ~half of the
      // screen. Single fixed seed so the canopy is identical every rebuild.
      // `bx` spreads slightly past both edges (×1.1, −0.05) so there's no gap.
      const r2 = sRng(555);
      const canopyH = H * 0.52;
      for (let i = 0; i < canopyCount; i++) {
        const bx = r2() * W * 1.1 - W * 0.05;
        const by = r2() * canopyH * 0.85;
        const normY = by / canopyH; // 0 at top … ~0.85 at canopy bottom
        const bSize = (W * 0.04 + r2() * W * 0.06) * (1 - normY * 0.4); // smaller lower down
        const hue = WISTERIA_HUES[Math.floor(r2() * WISTERIA_HUES.length)];
        const sat = 60 + r2() * 20;
        const lit = 42 + r2() * 16 + normY * 8; // lower blobs slightly lighter
        const alpha = 0.55 + r2() * 0.4;
        CANOPY_BLOBS.push({ bx, by, bSize, hue, sat, lit, alpha, normY });
      }

      // Posts: a thin trellis pole on each side at every depth, framing the
      // tunnel. Width/alpha shrink with depth like everything else.
      for (let depth = 0; depth < N_DEPTHS; depth++) {
        const d = depth / (N_DEPTHS - 1);
        const tunnelHalfW = W * 0.48 * (1 - d * 0.85);
        const postX = [vx - tunnelHalfW * 0.88, vx + tunnelHalfW * 0.88];
        const postW = Math.max(1, 3.5 * (1 - d * 0.75));
        const postTop = vy - H * 0.02 + d * H * 0.04;
        const postBot = vy + H * 0.25 * (1 - d * 0.7) + H * 0.02;
        postX.forEach((px) =>
          POSTS.push({ px, postW, postTop, postBot, depth: d }),
        );
      }

      // Draw far strands first so near ones paint on top (painter's algorithm).
      STRANDS.sort((a, b) => b.depth - a.depth);

      // Pre-render the two static layers so the per-frame loop only draws the
      // moving parts (strands) plus the scaled canopy blit.
      buildBaseCache();
      buildCanopyCache();
    }

    // Bake the static canopy once per resize — these 150-280 radial
    // gradients are the most expensive draw and never change per frame.
    function buildCanopyCache() {
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      if (!octx) {
        canopyCache = null;
        return;
      }
      CANOPY_BLOBS.forEach((b) => {
        if (
          !isFinite(b.bx) ||
          !isFinite(b.by) ||
          !isFinite(b.bSize) ||
          b.bSize <= 0
        )
          return;
        const g = octx.createRadialGradient(b.bx, b.by, 0, b.bx, b.by, b.bSize);
        g.addColorStop(0, `hsla(${b.hue},${b.sat + 6}%,${b.lit + 12}%,${b.alpha})`);
        g.addColorStop(
          0.42,
          `hsla(${b.hue},${b.sat}%,${b.lit + 5}%,${b.alpha * 0.55})`,
        );
        g.addColorStop(1, `hsla(${b.hue},${b.sat}%,${b.lit}%,0)`);
        octx.beginPath();
        octx.arc(b.bx, b.by, b.bSize, 0, Math.PI * 2);
        octx.fillStyle = g;
        octx.fill();
      });
      canopyCache = off;
    }

    // Background, floor, and posts are fully static (no tick/zoom dependence),
    // so they take a target context and get baked into baseCache once per
    // resize instead of being recomputed every frame.
    function drawBackground(c: CanvasRenderingContext2D) {
      c.fillStyle = '#0e0620';
      c.fillRect(0, 0, W, H);
      const vx = vpX();
      const vy = vpY();
      const gl = c.createRadialGradient(vx, vy, 0, vx, vy, W * 0.22);
      gl.addColorStop(0, 'rgba(230, 205, 255, 0.38)');
      gl.addColorStop(0.25, 'rgba(195, 155, 240, 0.18)');
      gl.addColorStop(0.55, 'rgba(140,  95, 210, 0.08)');
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gl;
      c.fillRect(0, 0, W, H);
      const amb = c.createRadialGradient(vx, H * 0.62, 0, vx, H * 0.62, W * 0.55);
      amb.addColorStop(0, 'rgba(160, 90, 200, 0.09)');
      amb.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = amb;
      c.fillRect(0, 0, W, H);
    }

    function drawFloor(c: CanvasRenderingContext2D) {
      const vx = vpX();
      const vy = vpY();
      const nearW = W * 0.72;
      const pg = c.createLinearGradient(0, vy + H * 0.05, 0, H);
      pg.addColorStop(0, 'rgba(55, 22, 88, 0.0)');
      pg.addColorStop(0.3, 'rgba(62, 25, 95, 0.3)');
      pg.addColorStop(1, 'rgba(35, 12, 58, 0.55)');
      c.fillStyle = pg;
      c.beginPath();
      c.moveTo(vx - W * 0.04, vy + H * 0.05);
      c.lineTo(vx + W * 0.04, vy + H * 0.05);
      c.lineTo(vx + nearW / 2, H);
      c.lineTo(vx - nearW / 2, H);
      c.closePath();
      c.fill();

      const rp = sRng(888);
      for (let i = 0; i < 140; i++) {
        const px = vx + (rp() - 0.5) * nearW * (0.2 + rp() * 0.8);
        const py = vy + H * 0.06 + rp() * (H - vy - H * 0.06) * 0.95;
        const ps = (py - vy) / Math.max(1, H - vy);
        const pr = Math.max(0.5, (2 + rp() * 4) * ps);
        const hue = 270 + rp() * 40;
        if (!isFinite(px) || !isFinite(py)) continue;
        c.save();
        c.translate(px, py);
        c.rotate(rp() * Math.PI * 2);
        c.scale(1, 0.5);
        c.beginPath();
        c.ellipse(0, 0, pr, pr * 1.3, 0, 0, Math.PI * 2);
        c.fillStyle = `hsla(${hue}, 60%, 72%, ${0.25 + rp() * 0.35})`;
        c.fill();
        c.restore();
      }
    }

    function drawPosts(c: CanvasRenderingContext2D) {
      POSTS.forEach((p) => {
        const alpha = (1 - p.depth) * 0.7 + 0.1;
        const pg = c.createLinearGradient(
          p.px - p.postW,
          0,
          p.px + p.postW * 2,
          0,
        );
        pg.addColorStop(0, 'rgba(10,4,22,0.95)');
        pg.addColorStop(0.45, 'rgba(50,22,80,0.85)');
        pg.addColorStop(1, 'rgba(10,4,22,0.95)');
        c.fillStyle = pg;
        c.globalAlpha = alpha;
        c.fillRect(p.px - p.postW / 2, p.postTop, p.postW, p.postBot - p.postTop);
      });
      c.globalAlpha = 1;
    }

    // Bake background + floor + posts into one static layer per resize.
    function buildBaseCache() {
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      if (!octx) {
        baseCache = null;
        return;
      }
      drawBackground(octx);
      drawFloor(octx);
      drawPosts(octx);
      baseCache = off;
    }

    // Blit the cached canopy, scaled up to 1.15× over the zoom about the top
    // centre — so it grows as the camera flies in. Then a dark band along the
    // very top edge to anchor the canopy and hide the upper seam.
    function drawCanopy(zoom: number) {
      const scale = 1 + zoom * 0.15;
      ctx.save();
      ctx.translate(W / 2, 0);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, 0);
      if (canopyCache) ctx.drawImage(canopyCache, 0, 0);
      ctx.restore();
      const topBand = ctx.createLinearGradient(0, 0, 0, H * 0.08);
      topBand.addColorStop(0, 'rgba(14,6,28,0.95)');
      topBand.addColorStop(1, 'rgba(14,6,28,0)');
      ctx.fillStyle = topBand;
      ctx.fillRect(0, 0, W, H * 0.08);
    }

    /**
     * Draw one hanging strand: a vertical run of floret rows that sways gently
     * and, during the zoom, sweeps outward toward its side of the screen (the
     * camera flying past it). This is the only per-frame dynamic draw, so it's
     * the hot path — `isFinite` guards keep a bad value from poisoning the canvas.
     */
    function drawStrand(st: Strand, zoom: number) {
      if (
        !isFinite(st.worldX) ||
        !isFinite(st.topY) ||
        !isFinite(st.len) ||
        st.len <= 0 ||
        st.w <= 0
      )
        return;
      // Gentle sway; nearer strands (low depth) sway more for parallax.
      const sway = Math.sin(tick * st.swingSpd + st.swing) * (2 + (1 - st.depth) * 5);
      let sx = st.worldX;
      // During the zoom, push each strand toward its nearest edge so the near
      // ones fly off-screen — stronger for near strands, scaled by eased zoom.
      const side = st.worldX < vpX() ? -1 : 1;
      if (zoom > 0) {
        const push = (1 - st.depth) * zoom * W * 0.38 * side;
        sx += push;
      }
      const ax = sx + sway; // anchored X for this frame
      const ay = st.topY;
      const len = st.len;
      const hw = st.w;
      const hue = st.hue;
      const sat = st.sat;
      const lit = st.lit + st.litVar;
      const den = st.drops;
      // Near strands are more opaque; far ones fade into the haze.
      const depthAlpha = 0.35 + (1 - st.depth) * 0.65;
      if (!isFinite(ax) || !isFinite(ay)) return;

      // Walk down the strand row by row.
      for (let row = 0; row < den; row++) {
        const prog = row / den; // 0 at top … ~1 at the tip
        // Envelope: a strand is fullest in the middle and tapers at both ends
        // (sin gives the bulge; +0.18 keeps the ends from vanishing entirely).
        const env = Math.sin(prog * Math.PI) * 0.8 + 0.18;
        const rowY = ay + len * (0.02 + prog * 0.98);
        const rowHW = hw * env; // row is wider where the strand is fuller
        const nFlorets = Math.max(1, Math.round(1 + env * 3.5)); // more florets mid-strand
        const a = depthAlpha * (0.55 + env * 0.38 * (1 - prog * 0.3));

        // Spread florets across the row width, with deterministic jitter so
        // the cluster looks organic rather than gridded.
        for (let f = 0; f < nFlorets; f++) {
          const frac = nFlorets > 1 ? f / (nFlorets - 1) : 0.5;
          const fx = ax - rowHW + frac * rowHW * 2 + sway * prog * 0.25;
          const jx = Math.sin(row * 3.7 + f * 2.2 + st.swing) * hw * 0.35; // x jitter
          const jy = Math.cos(row * 2.6 + f * 1.8) * hw * 0.22; // y jitter
          const px = fx + jx;
          const py = rowY + jy;
          const r =
            Math.max(minFloret, hw * (0.45 + env * 0.7) * (1 - prog * 0.18));
          const dHue = hue + Math.sin(row * 1.4 + f * 1.8) * 12; // hue shimmer
          const dLit = lit + Math.cos(row * 1.6 + f * 1.2) * 6; // lightness shimmer
          if (!isFinite(px) || !isFinite(py) || !isFinite(r)) continue;

          // 1) Soft glow halo — only for near strands (depth < 0.6), since the
          //    extra radial gradient is costly and invisible far away.
          if (st.depth < 0.6) {
            const gl = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6);
            gl.addColorStop(0, `hsla(${dHue},${sat + 8}%,${dLit + 14}%, 0.25)`);
            gl.addColorStop(1, `hsla(${dHue},${sat}%,${dLit}%, 0)`);
            ctx.beginPath();
            ctx.arc(px, py, r * 2.6, 0, Math.PI * 2);
            ctx.fillStyle = gl;
            ctx.globalAlpha = a * 0.45;
            ctx.fill();
          }
          // 2) The floret body — a tall ellipse (scale 0.74×1.28) tilted a
          //    little, giving each bloom a petal-like shape.
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.sin(row * 2 + f * 1.5) * 0.18);
          ctx.scale(0.74, 1.28);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${dHue}, ${sat + 5}%, ${dLit + 3}%)`;
          ctx.globalAlpha = a * 0.88;
          ctx.fill();
          ctx.restore();

          // 3) Tiny offset highlight for a hint of dimensionality.
          ctx.beginPath();
          ctx.arc(px - r * 0.18, py - r * 0.2, r * 0.32, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${dHue - 12},88%,${dLit + 26}%,0.28)`;
          ctx.globalAlpha = a * 0.38;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1; // reset for the next strand
    }

    // Cap to ~30fps on low-core devices; 0 = uncapped (every rAF frame).
    const frameInterval =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency <= 4
        ? 1000 / 30
        : 0;
    let lastFrame = 0;

    // Composite one frame: cached base → moving strands → scaled canopy →
    // side vignettes (drawn last, on top, to darken the left/right edges and
    // keep the eye on the centre). The `baseCache` fallback path only runs if
    // the offscreen context couldn't be created.
    function draw() {
      const zoom = easeOutQuart(camZ);
      ctx.clearRect(0, 0, W, H);
      if (baseCache) {
        ctx.drawImage(baseCache, 0, 0);
      } else {
        drawBackground(ctx);
        drawFloor(ctx);
        drawPosts(ctx);
      }
      STRANDS.forEach((st) => drawStrand(st, zoom));
      drawCanopy(zoom);
      // Left edge fades in from x=0; right edge fades in from x=W. Each covers
      // the outer 12% of the width.
      [
        [0, 0.12],
        [1, 0.12],
      ].forEach(([s, f]) => {
        const sv = ctx.createLinearGradient(
          s === 0 ? 0 : W,
          0,
          s === 0 ? W * f : W * (1 - f),
          0,
        );
        sv.addColorStop(0, 'rgba(10,4,22,0.88)');
        sv.addColorStop(1, 'rgba(10,4,22,0)');
        ctx.fillStyle = sv;
        ctx.fillRect(0, 0, W, H);
      });
    }

    // The animation loop. Always re-schedules itself; on a capped device it
    // bails early (without drawing) until `frameInterval` has elapsed, which
    // halves the work behind the heavily-blurred reveal card.
    let rafId = 0;
    function loop(ts: number) {
      rafId = requestAnimationFrame(loop);
      if (frameInterval && ts - lastFrame < frameInterval) return;
      lastFrame = ts;

      tick++; // drives the sway sine wave
      // Advance the zoom by elapsed wall-clock time (not frame count) so it
      // finishes in ZOOM_MS regardless of frame rate.
      if (zoomActiveRef.current && camZ < 1) {
        if (!zoomStart) zoomStart = ts;
        camZ = Math.min(1, (ts - zoomStart) / ZOOM_MS);
      }
      draw();
    }

    // Match the canvas pixel buffer to the viewport and rebuild the (size-
    // dependent) scene. Runs once up front and on every window resize.
    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      buildScene();
    }

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(loop);

    // Cleanup: stop the loop and drop the listener so nothing keeps running
    // after unmount (and so React 18/19 StrictMode's double-mount in dev
    // doesn't leave a second loop alive).
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // canvasRef → attach to <canvas>; triggerZoom → start the fly-through.
  return { canvasRef, triggerZoom };
}
