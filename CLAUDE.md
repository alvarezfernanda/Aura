# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What Aura is

Aura is a personal wellness PWA ("Bienestar con contexto total") built as a
single-page React app. It tracks gym workouts, the menstrual cycle, Pilates,
neck-posture rehab, body metrics, nutrition, daily rituals, and gamified
challenges/achievements — all cross-referenced so guidance adapts to the user's
energy, cycle phase, weather, and history. The UI is in **Spanish** and the app
is designed for a single user ("Fer").

It is installable as a mobile app (PWA, `manifest.json` + `sw.js`) and ships as
static files — there is no backend in this repo.

## Tech stack

- **React 18** (function components + hooks only; no class components)
- **Vite 5** as dev server / bundler (`@vitejs/plugin-react`)
- **No TypeScript**, no CSS framework, no component library, no router
- **No test framework** and **no linter** are configured
- Styling is done entirely with **inline `style={{}}` objects** (no CSS files;
  global CSS lives in a single `<style>` block inside the root component and in
  `index.html`)
- Persistence is **client-side only** (`localStorage`, with a `window.storage`
  fallback for the Claude.ai artifact environment)

## Commands

```bash
npm install      # install deps
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve the production build locally
```

There is no lint/test/format command. Do not invent one or assume CI runs it.

## Repository layout

The codebase is intentionally tiny in file count — almost everything lives in
one file.

```
App.jsx          # THE app — ~8.7k lines, every component, screen, hook & data table
main.jsx         # React entry point; mounts <Aura/> into #root
index.html       # HTML shell, PWA meta tags, SW registration, global <style>
vite.config.js   # Vite + react plugin config
manifest.json    # PWA manifest
sw.js            # Service worker (cache-first assets, network-first navigation)
icon.svg / icon-192.png / icon-512.png   # app icons
package.json     # deps + scripts
README.md        # short Spanish quick-start + Vercel/Android deploy notes
```

> Note: `vite.config.js` scopes its custom esbuild JSX loader to `src/**`, but
> the source files actually live at the repo root. The React plugin already
> handles `.jsx`, so this config block is effectively inert — keep it in mind if
> you ever add a `src/` directory.

## Architecture of `App.jsx`

`App.jsx` is one large module organized top-to-bottom into rough sections.
Knowing the layout matters more than reading it linearly:

1. **Theme & design tokens** (top of file): `T_DAY` / `T_NIGHT` palettes,
   `GRADIENTS`, `FONT_SERIF` / `FONT_SANS`, `SHADOW_*`, `TX_*` transitions.
   `isNightTime()` decides the active theme `T` at module load (it does **not**
   re-render on a clock change — theme is fixed per session load).
2. **Static data tables** (plain `const` objects/arrays), e.g. `WORKOUT_DAYS`,
   `NECK_PROTOCOL`, `PILATES_ROUTINES`, `CYCLE_PHASES`, `ACHIEVEMENTS`,
   `MONTHLY_CHALLENGES`, `CONTEXTUAL_REMINDERS`, `NARRATIVE_SEASONS`,
   `DAILY_MANTRAS`, `NUTRITION_PRINCIPLES`, `BODY_METRICS`, `PAIN_ZONES`.
   These encode the app's domain knowledge (exercises, cues, weights, symptoms).
3. **Hooks**: `useStorage` (persistence), `useClaudeCoach` (AI calls),
   `useAchievements`, `useNarrativeSeason`, `useContextualReminders`,
   `useWeather`, `useSpring`, `useParallax`, `useHasHover`.
4. **Primitive UI components**: `Card`, `GradientCard`, `Button`, `H2`, `H3`,
   `Pill`, `Label`, `ProgressBar`, `FadeIn`, plus editorial/typographic pieces
   (`DropCap`, `PullQuote`, `SmallCaps`, `EditorialTitle`, `Ornament`,
   `SpringButton`, `TiltCard`, etc.) and SVG art (`Illustration`, `MoonPhase`,
   `AchievementGlyph`, `CycleArtPortrait`).
5. **Pure helpers**: `calcCyclePhase`, `suggestWeight`, `calcStreak`-style
   logic, `detectFertileWindow`, `detectPatterns`, date keys (`todayStr`,
   `weekKey`, `monthKey`), `haptic`.
6. **Screens** — top-level `Page*` components: `PageHome`, `PageGym`,
   `PageCycle`, `PageBody`, `PagePilates`, `PageNeck`, `PageChallenges`,
   `PageNutrition`, `PageRituals`. Plus flows: `Onboarding`, `DailyRitual`.
7. **Root component** `export default function Aura()` (near the end): owns all
   persisted state, the `page` router state, the splash screen, onboarding /
   daily-ritual gating, and the fixed bottom nav.

### Navigation

There is **no router library**. The root `Aura` component holds
`const [page, setPage] = useState("home")` and renders from a `pages` object
map keyed by page id. Navigation is done by calling `setPage(id)`, passed down
to screens as a `goTo` prop. The bottom nav array (`nav`) lists the 5 primary
tabs: `home`, `gym`, `cycle`, `body`, `challenges`. Secondary screens
(`pilates`, `neck`, `nutrition`, `rituals`) are reached via `goTo` from within
other screens, not from the nav bar.

### State & persistence

All persistent state lives in the root `Aura` component via the `useStorage`
hook and is threaded down as props (there is no Context or external store).
Keys are namespaced `aura-*`:

| Key | Holds |
|-----|-------|
| `aura-historial` | per-exercise set history (object keyed by exercise id) |
| `aura-gym` | gym session dates |
| `aura-pilates` | Pilates session dates/routines |
| `aura-cuello` | neck-protocol session dates (drives the streak) |
| `aura-rewards` | unlocked rewards |
| `aura-last-period` | last period start date |
| `aura-cycle-history` | period history |
| `aura-cycle-type` | cycle regularity type |
| `aura-cycle-symptoms` | per-day symptom log |
| `aura-body-metrics` | weight/measurements time series |
| `aura-pain-log` | pain tracker entries |
| `aura-user-profile` | onboarding profile (presence gates onboarding) |
| `aura-daily-rituals` | per-day ritual completion |

`useStorage(key, initial)` returns `[value, save]` like `useState`, but `save`
also writes to `window.storage` (Claude.ai artifact host) if present, otherwise
`window.localStorage`. It reads back on mount. Because the initial render uses
`initial` before the async read resolves, **defensive guards are everywhere**
(`Array.isArray(x) ? x : []`, `x && typeof x === "object" ? x : {}`) — preserve
this pattern when touching persisted state; data may briefly be the initial
value or a legacy shape.

### The "context total" idea

The app's selling point is cross-referencing signals. Key derived logic:

- `calcCyclePhase()` → current cycle phase (menstrual/folicular/ovulatoria/lútea)
- `suggestWeight(exercise, history, energy, cyclePhase)` adjusts recommended
  workout weights by recent RIR, the user's selected `energy`, and cycle phase
- `useContextualReminders` / `CONTEXTUAL_REMINDERS` surface time/context-aware
  nudges; `useWeather` pulls Open-Meteo data to flavor suggestions
- `useNarrativeSeason` / `NARRATIVE_SEASONS` give the app a slow "seasonal"
  narrative arc based on days since first use

### AI coach integration

`useClaudeCoach()` POSTs to **`/api/claude`** with `{ system, messages }` and
expects an Anthropic-style `{ content: [{type, text}] }` response. **That
endpoint does not exist in this repo** — it must be provided by the host (a
serverless function on deploy, or the Claude.ai artifact runtime). Coach calls
fail gracefully (return `null`) when the endpoint is absent, so the app still
works offline; UI should keep handling the `null`/loading cases.

If you build the backend, it needs to proxy to the Anthropic Messages API.
Default to the latest Claude models (e.g. `claude-opus-4-8` for quality or
`claude-haiku-4-5` for cheap/fast coach replies). Never ship an API key in
client code — the coach must call through a server endpoint.

## Conventions

- **Language**: all user-facing copy is in **Spanish**. Match the existing
  warm, editorial, no-emoji voice (see `COACH_SYSTEM`). Code identifiers are a
  mix of Spanish (`registrarSesion`, `sesionesGym`, `historialEj`) and English
  — follow the surrounding names rather than imposing one language.
- **Styling**: inline style objects using the `T` theme tokens and `GRADIENTS`,
  `SHADOW_*`, `FONT_*`, `TX_*` constants. Do **not** introduce CSS files, CSS
  modules, Tailwind, or styled-components. Reuse the primitive components
  (`Card`, `Button`, `H2`, etc.) instead of re-styling from scratch.
- **Components**: function components with hooks. Keep new components in
  `App.jsx` alongside their peers unless there's a strong reason to split the
  file (the project has deliberately stayed single-file).
- **Data tables**: encode domain content (exercises, routines, symptoms,
  achievements) as top-level `const` tables, mirroring the existing ones.
- **Dates**: use the `todayStr()` / `weekKey()` / `monthKey()` helpers and
  ISO `YYYY-MM-DD` strings for keys — don't hand-roll date math.
- **Haptics**: use the `haptic()` helper (guards `navigator.vibrate`).
- **Defensive reads**: always guard persisted values for type/shape before use.

## Deploy

Static build → any static host. README documents Vercel (auto-detects Vite) and
"Add to home screen" install on Android. `npm run build` emits `dist/`. The
service worker (`sw.js`, cache `aura-v1`) is network-first for navigations and
cache-first for `/assets/`, `.svg`, `.png`; bump the `CACHE` version constant if
you need to force-invalidate cached assets.

## Working in this repo

- This is a personal, single-user app — there is no test suite to run; verify
  changes by running `npm run dev` and exercising the affected screen.
- The single huge `App.jsx` is intentional. When editing, locate the relevant
  section (theme / data / hooks / primitives / helpers / screens / root) rather
  than reading the whole file. Use search to jump to a `function PageX` or a
  named `const` table.
- Keep diffs surgical and consistent with surrounding style; the codebase
  prizes a cohesive editorial aesthetic over abstraction.
</content>
</invoke>
