# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Aura** — "Bienestar con contexto total". A Spanish-language (es-AR) personal wellness PWA that tracks gym, pilates, neck rehab, menstrual cycle, body metrics, pain log, and contextual rituals. Single-user app (the user's name defaults to "Fer"). All UI copy is in Spanish; preserve that voice when editing strings.

## Commands

```bash
npm install         # install deps
npm run dev         # Vite dev server at http://localhost:5173
npm run build       # production build → dist/
npm run preview     # serve the built dist/
```

There are **no tests, no linter, and no type-checker** configured. `npm run build` is the only static check available — run it after non-trivial changes.

## Stack & layout

- React 18 + Vite 5, plain JSX (no TypeScript), ES modules.
- Files live **at the repo root**, not in `src/`. Entry is `main.jsx` → `App.jsx`. `index.html` and `vite.config.js` both contain `src/...` references that don't match the actual layout; Vite still resolves `main.jsx` because it's in the project root, but be aware of this mismatch if you touch the build config or move files.
- PWA: `manifest.json` + `sw.js` (registered inline in `index.html`). The service worker is network-first for navigations, cache-first for `/assets/`, `.svg`, `.png`. Bump `CACHE = 'aura-v1'` in `sw.js` when shipping changes that must invalidate clients.

## Architecture: it's one file

**Almost the entire app is in `App.jsx` (~8,700 lines).** There are no per-component files. When asked to change anything, search inside `App.jsx` first; don't create new files unless the change is genuinely large and self-contained. Section banners (`/* ===== ... ===== */`) divide the file into logical groups; keep new code near related sections.

`export default function Aura()` near the bottom is the root. It owns all persisted state and renders one of the `Page*` components based on a `page` string (`home`, `gym`, `cycle`, `body`, `pilates`, `neck`, `challenges`, `nutrition`, `rituals`). There is no router — navigation is just `setPage(...)`.

### State & persistence

All durable state goes through the `useStorage(key, initial)` hook. It transparently uses `window.storage` (Claude.ai's async sandbox API) when present and falls back to `localStorage`. **Always use `useStorage` for new persisted state — never call `localStorage` directly**, otherwise the app breaks inside the Claude.ai sandbox. Existing keys are all prefixed `aura-` (e.g. `aura-historial`, `aura-gym`, `aura-cycle-history`, `aura-body-metrics`). Reuse the prefix.

Values can arrive as `null` or with the wrong shape after a schema change; existing code defends with patterns like `Array.isArray(x) ? x : []` and `x && typeof x === "object" ? x : {}`. Match that style — assume stored values may be stale.

### Claude integration

`useClaudeCoach()` POSTs to `/api/claude` with `{ system, messages: [...] }` and expects an Anthropic-style response (`data.content[].text`). The server endpoint is **not in this repo** (it's expected to exist in the hosting environment, e.g. a Vercel function). On failure it returns `null` — call sites must handle that.

### Theming & "atmosphere"

`T_DAY` / `T_NIGHT` palettes are picked **once at module load** via `isNightTime()`. The exported `T` constant therefore won't update if the user crosses 8pm/6am without reloading — keep that in mind before adding "live" theme switches. `getAtmosphere()` returns the page background gradient by hour and *is* called per render, so it does change live.

Typography depends on Google Fonts (`Playfair Display`, `DM Sans`) loaded via an inline `@import` inside the App's `<style>` block. Tabular numerics, smallcaps, ligatures etc. are wired through OpenType `font-feature-settings` classes (`.tabular-nums`, `.smallcaps`, `.oldstyle-nums`) — prefer these over re-implementing.

### Narrative seasons

`calcNarrativeSeason(firstUseDate)` maps days-since-first-use into a 120-day cycle: **Raíz** (1–30) → **Bloom** (31–75) → **Quietud** (76–120), then repeats with an incremented `cycleNumber`. Several components (`SeasonBadge`, mantras, tints) read from this. Don't hard-code season logic elsewhere — call `useNarrativeSeason()` / `calcNarrativeSeason()`.

### Cycle phases (separate from seasons)

`calcCyclePhase(lastPeriodDate, avgCycleLen, cycleType)` returns `menstrual | folicular | ovulatoria | lutea`. This is the **menstrual** cycle and is unrelated to narrative seasons above — don't conflate them.

### UI primitives to reuse

Editorial/typographic helpers already exist; prefer them over ad-hoc styling:

- Layout: `Card`, `GradientCard`, `EditorialGrid`, `AsymmetricRow`, `GoldenSection`, `PullOutside`, `Sidenote`
- Type: `EditorialTitle`, `EditorialHero`, `EditorialKicker`, `SectionHeader`, `DropCap`, `PullQuote`, `SmallCaps`, `EditorialProse`
- Motion: `useSpring`, `SpringButton`, `SpringScale`, `SpringNumber`, `useParallax`, `TiltCard`, `MagneticHover`, `CursorGlow`, `FadeIn`
- Decoration: `Ornament`, `OrnamentTrio`, `BotanicalConfetti`, `Illustration`, `MoonPhase`, `AchievementGlyph`

### External APIs

`useWeather(lat, lon)` calls `api.open-meteo.com` (no key). Defaults are Santa Cruz, Bolivia (`-17.783, -63.182`). The result feeds `WeatherParticles`, `WeatherBadge`, `WeatherCard`.

## Conventions

- Spanish identifiers and copy are intentional (`registrarSesion`, `historialEj`, `recompensas`, `sesionesGym`). Don't anglicize them. New user-facing strings should be Spanish in the same warm/literary register as existing copy (mantras, season descriptions).
- Inline-styles-only — there is no CSS framework, no CSS modules, no styled-components. Global CSS is the one `<style>` block inside the root component.
- Date keys use `todayStr()` (`YYYY-MM-DD`), `weekKey()` (`YYYY-Www`), `monthKey()` (`YYYY-MM`). Use these helpers, not ad-hoc formatting, so persisted aggregates stay comparable.

## Branch & deploy

- Active development branch for this work: `claude/add-claude-documentation-7vJi4`.
- Production deploys via Vercel (auto-detected Vite project per `README.md`). No CI config in repo.
