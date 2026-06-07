# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page wedding "Save the Date" site for **Shelley Shen & Patrick Tsui, May 29, 2027**.
The whole experience is one interaction: a wisteria-tunnel canvas animation that the visitor
clicks to fly through, revealing the date. React 19 + Vite + TypeScript + Tailwind v4,
deployed to GitHub Pages. It was ported from a vanilla HTML/CSS/JS prototype — the canvas
drawing math is a faithful port and is treated as the source of truth.

## Commands

```bash
npm run dev            # dev server at http://localhost:5173/save-the-date/
npm run build          # tsc -b (type-check) + vite build → dist/
npm run preview        # serve the production build
npm run lint           # eslint
npm test               # Vitest run (unit + integration)
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Vitest + coverage (text + coverage/index.html)
```

Run a single test file or test:

```bash
npx vitest run src/utils/rng.test.ts          # one file
npx vitest run -t "reveals immediately"       # tests matching a name
```

## Architecture

The app is a small **phase state machine** wrapped around a **self-contained canvas engine**.

- **`src/App.tsx`** owns the flow. State: enter screen visible → click → (150ms) zoom →
  (3900ms) reveal card fades in → (5900ms) enter screen unmounts. These timers are the
  contract; if you change the zoom duration, keep them in sync (see below). It also honors
  `prefers-reduced-motion`: that path skips the zoom and reveals immediately.

- **`src/hooks/useWisteriaTunnel.ts`** is the canvas engine and the most complex file. It
  exposes `{ canvasRef, triggerZoom }`. Key things to understand before editing:
  - **All mutable state lives in refs / effect-local closures** — never React state — so the
    `requestAnimationFrame` loop never triggers re-renders.
  - **Two offscreen caches** are built once per resize and blitted each frame: `baseCache`
    (background + floor + posts, fully static) and `canopyCache` (the 150–280 canopy
    gradient blobs). Only the swaying **strands** and the scaling canopy are drawn per-frame.
    This caching is a deliberate performance fix — don't move static layers back into the
    per-frame `draw()`.
  - **The zoom advances on wall-clock time** (`camZ = elapsed / ZOOM_MS`), not frame count,
    so it finishes in ~3.83s regardless of frame rate and stays locked to App's 3900ms reveal
    timer. `ZOOM_MS` and App's `REVEAL_DELAY` are coupled — changing one means revisiting the other.
  - **Scene geometry is seeded** via `sRng` (`src/utils/rng.ts`), so the scene is identical
    on every rebuild. `buildScene()` re-derives everything from `W`/`H`, including mobile
    tuning (`W < 768` → fewer strands/blobs, lower vanishing point, chunkier florets).

- **`src/components/`** are thin and presentational: `WisteriaTunnel` (the `<canvas>`),
  `FallingPetals` (CSS-animated overlay), `EnterScreen` (screen 1), `RevealCard` (screen 2,
  with the RSVP link). They toggle behavior via the `hidden`/`show` props, which add the
  `.hide`/`.show` classes the CSS animates.

- **`src/index.css`** holds the bespoke styling **ported verbatim from the prototype**
  (frosted panels, exact rgba/hsl, `clamp()` type scales, keyframes, the `.r.dN` staggered
  reveal delays). Tailwind v4 is imported here but only used for responsive scaffolding —
  **do not** rewrite the prototype styling as Tailwind utilities; pixel fidelity depends on it.

### Conventions worth knowing

- **Editable content lives in constants**, not scattered in markup: the RSVP form URL is
  `FORM_URL` in `RevealCard.tsx`; the names/date are literals in `RevealCard.tsx` and mirrored
  in `index.html` meta/OG tags (update both).
- **GitHub Pages base path**: `vite.config.ts` `base: '/save-the-date/'` must match the repo
  name, or built asset URLs 404. The favicon/OG paths in `index.html` and the dev/preview URLs
  all carry this prefix. If the repo is renamed, update all of these.
- Deploy is automatic: pushing to `main` runs `.github/workflows/deploy.yml` (GitHub Actions →
  Pages). Pages source must be set to "GitHub Actions" once in repo settings.

## Testing

Vitest + React Testing Library (jsdom); config in `vitest.config.ts`, setup in
`src/test/setup.ts` (registers jest-dom, stubs `matchMedia`). Tests cover the seeded RNG, the
presentational components, and App's state machine (with `matchMedia` and timers faked via
`vi.useFakeTimers()` + `fireEvent` inside `act()`).

- **`useWisteriaTunnel` and `WisteriaTunnel` are excluded from coverage** — jsdom has no
  `<canvas>` 2D context, so the engine is verified by running the app in a real browser, not
  unit tests. Coverage is enforced at an 80% threshold over everything else (currently 100%).
- When testing App, **mock the hook** (`vi.mock('./hooks/useWisteriaTunnel')`) rather than
  trying to run the canvas.
