# Squeek Beat design system

## Overview

A warm, dark community arcade for short, two-lane rhythm runs. The single visual idea is a little hamster touring three worlds inside an arcade cabinet. Original SVG art carries the personality; the game canvas and touch pads carry the interaction. Introductory copy stays compact so Play appears on the first 390 px screen.

The implementation is in `src/style.css`, `src/art.ts` and the render functions in `src/main.ts`. Menus use native elements; gameplay uses Canvas 2D. This describes the final source, not a proposed redesign.

## Colors

The canonical format is hex. Primitive values live on `:root` and semantic aliases are used for interface roles.

| Semantic token | Primitive / value | Job |
| --- | --- | --- |
| `--color-bg` | `--olive-950` / `#141710` | Page, dark primary-button text |
| `--color-surface` | `--olive-900` / `#191d15` | Cabinet, unselected modes, dialogs |
| `--color-raised` | `--olive-850` / `#20261a` | Selected mode, inset controls |
| `--color-hover` | `--olive-800` / `#283021` | Hover and secondary actions |
| `--color-border` | `--olive-700` / `#3d4931` | Structure and dividers |
| `--color-muted` | `--olive-400` / `#adb6a0` | Supporting copy and labels |
| `--color-text` | `--cream-100` / `#f5eedc` | Main copy and values |
| `--color-accent` | `--lime-300` / `#c6ed89` | Primary action, selection, note bars, progress |
| `--color-gold` | `--gold-300` / `#efc56a` | Sunflowers, FEVER, achievement status |
| `--color-error` | `--rose-300` / `#efad96` | Miss/empty feedback and API errors |
| `--color-focus` | `--cream-100` / `#f5eedc` | Two-pixel keyboard focus perimeter |

Canvas lane backgrounds (`#141b12`, `#1b2318`) and SVG fur, plants and wheel colors are artwork values, not extra interface themes. Their shapes supply redundant cues: rounded bar notes versus eight-petal flowers, labelled judgements, checked mode indicators and explicit error text.

Rendered solid pairs measured in Chromium: main text/page **15.65:1**, muted/page **8.60:1**, muted/surface **8.12:1**, muted/raised **7.37:1**, primary button text/fill **13.69:1**. These are measured pairs, not a claim about every illustrated/gradient pixel. The pinned probe passed its rendered text contrast check.

The `.high-contrast` setting changes muted text to `#d0d8c7`, borders to `#7e9168`, page to `#0b0e09`, surface to `#141910`, and raised surface to `#20291a`. `prefers-contrast: more` strengthens muted text and borders. Forced-colors styles retain system control outlines/borders. There is one dark visual system; no invented light theme.

## Typography

**Outfit**, a local variable WOFF2 (`public/outfit-latin.woff2`), with `Trebuchet MS, sans-serif` fallbacks. The file supplies weights 400–800; interface text uses 400 and 600. The font license ships with the assets. No remote font request occurs.

| Token | Size | Use |
| --- | --- | --- |
| `--text-sm` | 14 px | Secondary copy, labels, utility controls |
| `--text-body` | 16 px | Body, buttons, form controls |
| `--text-lg` | 20 px | Brand, mobile section/game titles |
| `--text-title` | 28 px | Section headings and desktop HUD values |
| `--text-score` | 40 px | Mobile intro and desktop result heading |
| `--text-display` | 64 px | Desktop intro, final score, countdown |

Body line height is 1.5; paragraphs in dialogs use 1.55. Headings use 1.15 with negative tracking (−0.045em for the large intro, −0.025em for section headings, smaller adjustments by role). Long supporting text is limited around 65 characters where appropriate. Headings balance; paragraphs use pretty wrapping. Timers, counters and scores use tabular numerals. Form controls stay at 16 px on phone widths except the compact 320 px difficulty selector, which is a native select rather than a text-entry field. No prose uses monospace or tracked capital kickers.

## Layout

Spacing tokens are 4, 8, 12, 16, 24, 32 and 48 px. Major groups have at least twice their internal gaps. Page content is centered with a maximum width of 1184 px; gameplay narrows to 1040 px and results to 900 px.

At desktop widths the launch view pairs the large illustrated scene with mode selection and Play, using a `1.55fr / 1fr` grid and 32 px gap. The game pairs the cabinet with a 280 px companion/sidebar. HUD values sit together above the note field, then touch pads, then act progress. Telemetry stays in the sidebar.

Content-driven breakpoints:

- **1040 px:** page margins reduce; launch/game columns tighten.
- **799 px:** launch becomes one column and modes become three compact choices. Gameplay becomes one column. The hamster companion remains in a 112 px column beside the local run summary below the pads.
- **440 px:** 16 px page gutters, 200 px home scene, 76 px header, compact HUD and 72 px touch pads. The intro is 40 px and Play remains visible at 390 × 844.
- **350 px:** brand, difficulty row and utility controls tighten; text wraps without clipping.
- A desktop height query below 800 px reduces scene/canvas height and vertical spacing.

The playfield uses viewport-aware clamped heights and a 250 px mobile minimum. At 350 px and below, the paused upgrade playfield grows to 380 px so both complete upgrade descriptions and actions remain visible. Controls stay in normal flow, rather than obscuring play as sticky chrome. Dialogs use at most `100dvh - 24px` on phones, scroll internally, and have contained overscroll. Only the touch pads suppress scroll gestures. Main content receives programmatic focus without a decorative box around the whole page; interactive controls retain visible focus rings.

Browser checks covered 320, 390, 800 and 1440 px. Upgrade/result reflow was also checked at 320 px. Native browser zoom, localization expansion and RTL layouts were not exercised.

## Elevation & Depth

The interface mostly uses flat tonal layers and structural borders. There are no decorative card shadows. Mode borders communicate selection; canvas lane boundaries and the hit line communicate timing. The home scene has a quiet CSS dot texture. The modal alone uses `0 24px 100px #0008`, with a dark translucent backdrop and 5 px backdrop blur. Gameplay overlays occupy only the playfield and leave HUD/pads visible.

No text is rendered as a gradient. SVG gradients describe fur, a wheel rim and a subdued halo, separate from interface copy.

## Shapes

The main scene/cabinet uses a 20 px radius. Phone cabinets and companion scenes use 16/12 px. Controls and pads use 12 px. Native dialogs use 24 px with 28 px padding on desktop; 20 px with 20 px padding on phones. The wheel and brand mark are circular. Ordinary notes are rounded bars, sunflower notes have eight petals, and targets are outlined rounded rectangles. Consistent radii and inset spacing make the canvas and pads read as one cabinet.

## Components

| Pattern / source | Intended use and states |
| --- | --- |
| `.brand`, `.utility` / `shell()` | Left-aligned identity, right-side sound/help/settings. Native buttons with hover, 44 px utility targets and visible focus. Sound has an accessible pressed state. |
| `.button.primary`, `.button.secondary`, `.text-button` | One lime primary action per decision area. Neutral secondary actions and underlined tertiary actions. Explicit hover, active, disabled/loading, focus and pressed states. |
| `.mode-choice` / `renderHome()` | Three semantic toggle buttons in a labelled group; checked indicator, text and border show selection. A labelled native select offers Practice timing. |
| `.tour-scene`, `hamsterScene()` / `src/art.ts` | Original wheel illustration, with garden, sunset and stars. A small companion survives mobile reflow. FEVER adds a gold celebration and wheel rotation. |
| `.scoreboard`, `.fever-row`, `.act-progress` / `renderGame()` | Stable numeric alignment, labelled energy progressbar, explicit ready/active FEVER state and remaining seconds. The run remains 60 active seconds. |
| `.playfield`, `drawLanes()`, `drawNote()` | Two lanes, horizontal targets, gold flower shapes, immediate text/score feedback. Canvas rendering is independent from the scoring engine. Authored phrase starts align to the backing pulse, with half-beat or two-thirds-beat bursts constrained to at least 250 ms. |
| `.pad` | Large touch controls with A/L labels; pointerdown judges once, touch compatibility clicks are filtered, keyboard/assistive clicks still work. Default, hover, press and focus states. |
| `.game-overlay` | Three-beat countdown, paused state or upgrade decision. Pauses freeze the clock and decorative celebration. Upgrade buttons give exact effects and retain focus within the current choice area. |
| Native `dialog` / `openDialog()` | Tutorial, settings, seed rule and project rules. Native focus containment, Escape dismissal and trigger restoration; background is inert while open. |
| `.live-note` / `loadLive()` | Pending, validated data, stale, timeout, schema/network error and retry/switch-to-Practice states. No fake measurements. |
| `.achievement`, `.breakdown`, `.result-actions` / `renderResults()` | Local earned/unearned milestones, additive score breakdown, rating thresholds, PB comparison and user-triggered copy with selectable fallback. |

Motion is opt-in through `prefers-reduced-motion: no-preference`. Hover/press transitions name only background, color, border and transform and last 150 ms; primary/button press scales to 0.96. Home wheel/music motion is decorative and disabled for reduced motion. FEVER rotation pauses during pause/countdown/intermission. Note motion remains essential, with shape/text cues; no whole-screen flashing effect exists.

## Do's and Don'ts

Reuse the spacing, six-size scale, button styles and semantic tokens. Place the most useful action beside the thing it controls. Keep ordinary notes and sunflower notes distinct in both shape and color. Keep all score, daily and live claims tied to actual state. Show local-only scope beside record explanations.

For another menu view, start with the centered main width, a plain heading, one primary button, and native fields/dialog patterns. Keep auxiliary content below the main task on phones. Preserve source-relative assets for gateway hosting.

Do not add remote fonts, another palette, full-screen strobes, wallet controls, a pretend global leaderboard, or fabricated live readings. Do not use interface motion as the only status cue. New chart rules need a new versioned seed and appropriate timing/transition tests.

Design guidance attribution and licenses are in `NOTICE.md` and `DESIGN-GUIDANCE-LICENSE.txt`. Review evidence and limitations are in `artifacts/validation.md`.
