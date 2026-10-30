# Squeek Beat: Hamster Tour

Tiny paws. Big beats. A free, playable two-lane rhythm arcade with original hamster-in-wheel artwork, three acts, sunflower notes, FEVER, and local personal bests.

**Independent Squeekchain community fan project. Not an official product.** No wallet connection, token creation, transaction authorization, wagers, paid play, or prizes of monetary value. No global leaderboard, backend, account, analytics, or remote score submission.

## Play and delivery

The complete production website is included in **`dist/`**, alongside its source and lockfile. It uses relative asset URLs and was exercised under `/preview/`, a gateway-style subpath. The assignment's publishing service pins this export to public IPFS after submission; a public URL is not available during this build. No publication URL or network approval is invented here.

Serve `dist/` over HTTP(S); opening `index.html` as a local `file:` URL does not provide a module-capable web origin. Practice and Daily need no API after the site assets load. Live wheel requires access to the status API and its browser CORS policy. There is no service worker or offline-install claim.

## Install, launch, preview, rebuild

Use Node.js 22 or newer and npm. All runtime code and assets are local; dependencies are build/test tools.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. For the delivered production version:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` recreates `dist/`. Vite's `base` is `./`, so the export can be served from an IPFS gateway subpath. No environment variables or secrets are required. The public PNG share card, SVG favicon, local font and font license are copied into the export. The original share-card SVG remains in `public/`.

For reproducible browser checks, after the build and engine tests:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite serves the real export at a temporary `/preview/` path, owns and closes its HTTP server and browsers, advances a virtual browser clock through a full run, and writes its report and screenshots to `artifacts/`. It attempts WebKit too; install it with `npx playwright install webkit` on a system with the required runtime libraries. No persistent preview daemon is needed. `npm test` compiles engine modules into `test/scratch/`; that directory is disposable and never required to launch or build.

## Controls and accessibility

- **A**: left lane. **L**: right lane. Or tap either large touch pad. Enter/Space also activate a focused pad. Repeated keys and touch compatibility clicks do not produce extra hits.
- Match each note to the horizontal hit line. Sunflowers have eight petals; ordinary notes are rounded bars, so color is not their only difference.
- Sound starts **off**. Enable it with the header button or the tutorial's calibration control. Synthesized backing pulses and successful-hit tones are optional; every rule works muted.
- Play opens a skippable interactive warm-up. Sound calibration measures the median of eight beat taps; a manual slider permits −200 to +200 ms. Positive offsets compensate for later taps. Settings apply to the next run (including a restart), and are stored locally.
- Pause with the pause button or Escape. Backgrounding the tab, losing window focus, or a gap over one second pauses active play. Resume always has a three-beat countdown. Notes, FEVER and run time remain frozen during pauses, countdowns and upgrade breaks.
- Restart creates a clean run. Quit returns to the mode menu. Live restarts fetch a fresh reading.
- Menus use semantic buttons, labels and native dialogs with Escape, focus containment and restoration. Game keys ignore controls, typing fields, modified keys and key repeat. Scrolling is prevented only on the lane controls.
- The settings button offers high contrast. `prefers-contrast`, forced colors and `prefers-reduced-motion` have explicit styles. Reduced motion removes decorative animation; approaching notes are essential to the rhythm mechanic and continue to move. No full-screen strobe is used.

A fast visual rhythm game is not made screen-reader playable merely by adding labels. Manual screen-reader, physical-device and native zoom testing have not been performed.

## Run, scoring and FEVER

A run contains **60 seconds of active play**, divided into three 20-second acts: Garden groove, Sunset sprint, Starlight finale. Each break pauses the timer and offers two shuffled upgrades; choose one. The authored pattern families are alternating steps, repeated-lane pulses and short alternating bursts. Act one teaches, act two varies and act three combines. Phrase starts align with the act’s backing pulse; bursts use half-beat spacing up to 120 BPM and two-thirds-beat spacing above it. Notes have at least a 250 ms global gap, no chords, at least 1.8 seconds of lead-in and at least 1.2 seconds of clear-out in each act.

| Judgement | Standard | Relaxed Practice | Ordinary base points |
| --- | --- | --- | --- |
| Perfect | within ±85 ms | within ±120 ms | 100 |
| Good | outside Perfect, within ±170 ms | outside Perfect, within ±230 ms | 50 |
| Miss | outside the Good window | outside the Good window | 0 |

Timing edges are inclusive. Each tap judges only the nearest unconsumed note in that lane, once. Empty taps cost 10 points with a score floor of zero. Misses and empty taps break combo. Successful notes increase combo; there is no combo score multiplier.

Every ninth chart position, with a deterministic phase, is a **golden sunflower**: roughly one per eight ordinary notes. Either successful judgement gives 250 base points plus 18 extra FEVER energy. A missed sunflower is a normal miss.

Perfect hits charge 12 energy; Good hits charge 7. Energy caps at 100. **The next valid hit after the meter fills starts six active seconds of double score, including the triggering hit.** Hits strictly before the FEVER expiry are doubled; a hit at expiry is normal. Energy does not charge during FEVER and begins charging again after expiry. The meter, countdown, gold styling and wheel celebration show its state.

Between acts, choose one of:

| Upgrade | Effect |
| --- | --- |
| Pocket shield | Absorbs one missed/empty-tap combo break. The miss still counts against accuracy and empty taps still cost points. It never creates a successful hit. |
| Sunflower boost | +25% golden-note points for the rest of the run. Two selections stack to +50%. |
| Wheel power | +20% FEVER charge for the rest of the run. Two selections stack to +40%. |

Gold and charge bonuses stack additively. Golden points round to the nearest whole point before any FEVER doubling (312.5 → 313, or 626 in FEVER). Shields are consumed once; unused shields carry into the next act. Chosen upgrades stay visible.

**Accuracy** = `(Perfect + 0.5 × Good) / (all judged notes + empty taps) × 100`.

**Ratings** use accuracy: S ≥95%, A ≥90%, B ≥75%, C ≥50%, D below 50%. Results show ordinary points, golden points including boosts, the FEVER bonus, actual deducted penalties, all judgement counts, max combo and gold collected. Copying a plain-text result is always initiated by the player; if browser clipboard access fails, a selectable text field appears.

## Modes and fixed seed rules

**Practice:** stable 90 BPM, with Standard or clearly labelled Relaxed timing. Charts are stable for a given difficulty. The two difficulties have separate records.

**Daily:** fixed 108 BPM, Standard timing. Seed text is `squeek-v1:YYYY-MM-DD:standard`, using the UTC date locked at run start. FNV-1a hashes the text to an unsigned 32-bit integer; Mulberry32 chooses pattern mirrors, phrase rotations and sunflower phase. Each upgrade break independently shuffles the three-item pool using `seedText + ':choice:' + actIndex`; the first two are offered. Picks do not change later opportunities. All players receive identical charts and opportunities for the same date. Replay retains the run's date, including after UTC midnight; returning to the menu selects today's date. Calibration never changes the generated chart. Chart versioning belongs in the seed if generation rules change.

**Live wheel:** starting or restarting requests [the public status endpoint](https://api.squeekchain.com/v1/status) with a seven-second abort timeout and no cache. It validates numeric, finite, nonnegative integer `measurement.rpmMilli`, an uppercase state string in `measurement.coreStatus`, and a valid `measurement.observedAt`. Future observations more than five seconds ahead are rejected. Observation time, rather than response generation time, controls freshness. Readings over 60 seconds old cannot start a run and are checked again after the warm-up.

`RPM = rpmMilli / 1000`; `BPM = clamp(80 + RPM, 75, 140)`. BPM is fixed for the whole run. The interface shows the source, observation timestamp, wheel state, RPM and mapped BPM. IDLE at zero RPM maps to a gentle 80 BPM. A sleeping/idle hamster should rest at its own pace; this game never asks anyone to make it run. Timeout, network failure, stale data or bad schema offers retry and an explicit switch to Practice. No substitute live readings are generated.

## Local-only records and privacy

Personal bests use localStorage keys `squeek-beat:v1:<mode>:<difficulty>`; Daily appends `:<UTC date>`. Live scores are local bests for that mode and timing difficulty, not comparable global rankings across wheel paces. Settings and the three achievements use separate versioned keys. Clearing browser data removes them; records do not follow you to another browser or a different IPFS origin.

Achievements: **First lap** (complete one run), **On a roll** (20 combo), **Golden ears** (finish at ≥90% accuracy). They have no monetary value. Storage errors are caught and results explicitly say when saving failed. No gameplay or record data is sent to the API. The only application network call is the player-initiated status request in Live wheel; fonts and other assets are bundled locally.

## Implementation

Vite + strict TypeScript with native DOM, Canvas 2D and Web Audio. A small native renderer keeps the timing engine independent from per-frame UI work; no runtime framework or wallet dependencies are needed.

- `src/engine.ts`: pure chart, seeded choices, judgement, combo, shields, upgrades, score and active time.
- `src/main.ts`: semantic menus, tutorial/calibration, RAF clock, pause/countdown, touch/keyboard handling, canvas rendering and results.
- `src/live.ts`: API validation, freshness and abort cleanup.
- `src/records.ts`: local record partitions, best comparisons, achievements and storage recovery.
- `src/art.ts`, `src/style.css`, `src/audio.ts`: original artwork, tokens/responsive behavior and gesture-enabled synthesized audio.
- `tests/`: engine regression tests and production browser interaction suite.
- `DESIGN.md`, `artifacts/validation.md`: final design system, review coverage, corrections, actual results and limitations.

## Checks run for this delivery

Production build and strict typecheck passed. **32 engine tests passed.** The Chromium production-browser suite passed 15 groups, including a full three-act 100%-accuracy run, touch/keyboard input, eight-tap calibration, pauses, upgrades, result copying, restart/quit cleanup and mocked API failures. All **16 taste@1 checks passed** in the pinned probe. Actual screenshots and the structured browser report are in `artifacts/`.

WebKit was attempted but could not launch because required browser runtime libraries were unavailable. No Safari, physical-device, screen-reader, audible listening or native 200% zoom result is claimed. Browser API error cases use explicit test fixtures; production code never fabricates live telemetry. A real status fetch returned the expected field schema during implementation, but future API uptime, CORS and freshness are outside this static site's control. These are worker-run checks, not independent certification, badge approval or a Genesis approval claim. See `artifacts/validation.md` for the precise coverage and final command record.

## Submission budget and attribution

The addition budget is 8,388,608 bytes. The explicit `.gitignore` path budget is **0 submitted bytes** for `**/node_modules/`, `**/.vite/`, `**/.cache/`, `**/.npm/`, `**/.playwright/`, `**/playwright-report/`, `**/test-results/`, and `test/scratch/`. These are generated dependencies/caches/test scratch only. `dist/`, source, lockfile, runtime assets and requested documentation remain included. No dependency archive, registry mirror or submodule is needed.

Outfit is bundled under the SIL Open Font License. Original artwork and source are included. See `NOTICE.md`, `public/FONT-LICENSE.txt` and `DESIGN-GUIDANCE-LICENSE.txt` for font and design-guidance attribution.
