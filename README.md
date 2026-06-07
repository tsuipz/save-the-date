# Save the Date — Shelley &amp; Patrick

A wedding "Save the Date" page: a wisteria-tunnel canvas animation (inspired by the
Kawachi Fuji Garden) that the visitor zooms through to reveal the date —
**Shelley Shen &amp; Patrick Tsui, May 29, 2027**.

Built with **React 19 + Vite + TypeScript + Tailwind v4**. Ported from a vanilla
HTML/CSS/JS prototype, then extended with mobile responsiveness, performance work,
accessibility, and an RSVP link to a Google Form.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173/save-the-date/)
npm run build    # type-check (tsc -b) + production build to dist/
npm run preview  # serve the production build locally
npm run lint     # eslint
npm test         # run the Vitest unit/integration suite
npm run test:watch    # Vitest in watch mode
npm run test:coverage # run with a coverage report (text + coverage/index.html)
```

## Testing

Vitest + React Testing Library (jsdom). The suite covers the seeded RNG, the three
presentational components, and App's phase/timing state machine (with `matchMedia` and
timers faked). Coverage is **100%** on every unit-tested file, with an 80% threshold
enforced in `vitest.config.ts`.

The canvas engine (`useWisteriaTunnel`) is **excluded from coverage**: it needs a real
`<canvas>` 2D context that jsdom doesn't provide, so it's verified by running the app in
a real browser rather than by unit tests.

## How it works

- **`src/hooks/useWisteriaTunnel.ts`** — the canvas engine. All scene/animation state
  lives in refs (no per-frame re-renders). Scene geometry (strands, canopy blobs, posts)
  is rebuilt only on resize; the static canopy is baked into an offscreen canvas and
  blitted each frame. The zoom advances on wall-clock time so it stays in sync with the
  reveal regardless of frame rate, and is capped to ~30fps on low-core devices. Exposes
  `canvasRef` + `triggerZoom()`.
- **`src/App.tsx`** — phase state machine: clicking "Enter the Forest" starts the zoom
  (150ms), fades in the reveal card (3900ms), then unmounts the enter screen. Honours
  `prefers-reduced-motion` by skipping the zoom and revealing the card immediately.
- **`src/components/`** — `WisteriaTunnel` (canvas), `FallingPetals` (drifting CSS petals),
  `EnterScreen`, `RevealCard` (+ the RSVP link to the Google Form; edit `FORM_URL` there).
- **`src/index.css`** — the bespoke wisteria styling, ported verbatim from the prototype.
  Tailwind is imported here but only used for responsive scaffolding.
- **`src/utils/`** — `rng.ts` (seeded RNG).

## Deployment — GitHub Pages

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes
`dist/` to GitHub Pages. Enable Pages once via **Settings → Pages → Source: GitHub Actions**.

> **Gotcha:** the Vite `base` in `vite.config.ts` must match the repo name
> (`/save-the-date/`) so asset URLs resolve under `https://<user>.github.io/save-the-date/`.
> If you rename the repo, update `base` and the favicon/OG paths in `index.html`.
