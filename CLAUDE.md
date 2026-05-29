# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Aura — *Bienestar con contexto total* — is a single-user wellness PWA built in React + Vite.
The UI and all identifiers are in Spanish (the target user is "Fer"). It tracks gym
training, the menstrual cycle, Pilates, a neck-rehab protocol, body metrics, pain, nutrition,
daily rituals, challenges/achievements, and an optional AI coach. It is designed to be
installed to a phone home screen and to work offline.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
```

There is no test runner, linter, or formatter configured. `package.json` declares only the
three Vite scripts above. Deployment target is Vercel (auto-detects Vite); see `README.md`.

## Architecture

**Almost the entire app lives in one file: `App.jsx` (~8,700 lines).** `main.jsx` only mounts
`<App/>` into `#root`, and `index.html` registers the service worker. There is no `src/`
directory and no component-per-file structure — everything (theme, design-system primitives,
~30 feature "pages", helpers, and the root component) is in `App.jsx`, divided by banner
comments like `// ==================== GYM ====================`. Use these banners to navigate.

Key cross-cutting systems (understanding these unlocks the rest of the file):

- **Theme tokens (`T`, `GRADIENTS`, `getAtmosphere`)** — top of the file. `T` is resolved
  **once at module load** from `T_DAY`/`T_NIGHT` via `isNightTime()` (hour-based: night is
  20:00–06:00). It is *not* reactive — it won't switch if the clock crosses the boundary
  during a session. Nearly all styling is **inline styles that read from `T`**; there are no
  CSS files (only a small `<style>` block injected in the root component that `@import`s Google
  Fonts and sets OpenType features). Fonts: `FONT_SERIF` (Playfair Display) for headings,
  `FONT_SANS` (DM Sans) for body.

- **Persistence (`useStorage(key, initialValue)`)** — the single source of all persisted
  state. It is **dual-backend**: it prefers `window.storage` (the async key/value store present
  in the Claude.ai artifact runtime) and falls back to the browser's synchronous
  `localStorage`. All keys are prefixed `aura-` (e.g. `aura-historial`, `aura-gym`,
  `aura-cycle-history`, `aura-user-profile`, `aura-daily-rituals`). When adding persisted
  state, always go through `useStorage`, never raw `localStorage`.

- **Root component `Aura()` (the `// ==================== APP ====================` section)** —
  holds *all* `useStorage` state at the top and **prop-drills** it down to pages. Routing is a
  plain `page` string in `useState`, a `pages` object mapping ids to elements, and a bottom
  `nav` array. To add a screen: create its `PageX` component, add it to `pages`, and (if it
  should be in the bottom bar) to `nav`. Registration helpers (`registrarSesion`,
  `registrarPilatesSesion`, etc.) live here and own the write logic for their stores.

- **AI coach (`useClaudeCoach`)** — `ask(prompt, system)` POSTs to **`/api/claude`**, a
  serverless endpoint that is **not in this repo** (must be provided by the deployment, e.g. a
  Vercel function proxying the Anthropic API). It returns `null` on any failure, so all callers
  must handle a null/absent response gracefully. `COACH_SYSTEM` is the default persona prompt.

- **Domain logic worth knowing**: `suggestWeight()` computes gym weight recommendations from
  training history, current `energy`, and menstrual `cyclePhase`. Cycle phase / fertility
  detection drive several screens. `useWeather()` pulls live weather from the open-meteo API
  (hardcoded lat/lon, Santa Cruz, Bolivia) to render `WeatherParticles`/atmosphere.

- **Date helpers**: `todayStr()` (`YYYY-MM-DD`), `weekKey()`, `monthKey()` are the canonical
  keys used throughout for grouping sessions by day/week/month. Reuse them rather than
  formatting dates ad hoc.

- **Design system**: low-level primitives `Card`, `GradientCard`, `Button` (variants
  `primary|soft|ghost|subtle`), `Pill`, `H2`/`H3`, `Label`, `ProgressBar`, `FadeIn`, plus an
  "editorial" set (`DropCap`, `PullQuote`, `EditorialTitle`, `SmallCaps`, …) and spring-physics
  animation helpers (`SpringButton`, `SpringNumber`, `SpringScale`, `TiltCard`). Prefer these
  over hand-rolling styled `<div>`s.

## PWA

`manifest.json` + `sw.js` make the app installable and offline-capable. `sw.js` uses a cache
named `aura-v1` (`CACHE` constant): **network-first for navigations** (so HTML updates show
immediately) and **cache-first for static assets**. Bump the `CACHE` version when you need to
invalidate cached assets.

## Conventions & gotchas

- Match the existing style: large single-file React, inline styles from the `T` palette,
  Spanish identifiers/UI strings (often mixed with English in code). React only — no other
  runtime dependencies are installed.
- **Path discrepancy to verify before relying on the build**: `index.html` loads
  `/src/main.jsx` and `vite.config.js`'s esbuild rule includes `/src/.*\.jsx?$/`, but
  `main.jsx` and `App.jsx` actually live at the **repo root** (no `src/` directory exists).
  Confirm `npm run dev`/`npm run build` resolve correctly — you may need to fix the
  `index.html` script path (or move the files into `src/`) before the build works.
