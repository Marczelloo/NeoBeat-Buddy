---
name: MewBit
description: Self-hosted Discord music, operated from a near-black command surface.
colors:
  bg: "#050608"
  surface: "#0c0e12"
  raised: "#111318"
  high: "#161920"
  line: "rgba(255, 255, 255, 0.06)"
  line-strong: "rgba(255, 255, 255, 0.12)"
  text: "#f4f6f9"
  muted-strong: "#c3cbd7"
  muted: "#9ba4b2"
  faint: "#667081"
  accent: "#67e3f4"
  auto: "#a78bfa"
  live: "#ff6ec7"
  danger: "#ff8098"
  white-btn: "#f4f6f9"
  on-white: "#0a0c10"
typography:
  display:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.6vw, 52px)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.038em"
  headline:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(26px, 3.6vw, 40px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  stage-title:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(20px, 2.6vw, 27px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.028em"
  subtitle:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  command:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.012em"
  lead:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  lead-small:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "normal"
  body:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-small:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  control-label:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "normal"
    fontFeature: "tnum"
  mono-label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
  mono-micro:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.1em"
rounded:
  bar: "1.5px"
  key: "5px"
  chip: "8px"
  sm: "9px"
  md: "10px"
  control: "11px"
  tile: "12px"
  field: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  hair: "4px"
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "26px"
  xxl: "30px"
  gutter: "clamp(20px, 5vw, 56px)"
components:
  button-primary:
    backgroundColor: "{colors.white-btn}"
    textColor: "{colors.on-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
    typography: "{typography.control-label}"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.on-white}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-strong}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "33px"
  button-ghost-hover:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.text}"
  command-line:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "0 18px"
    height: "66px"
    typography: "{typography.command}"
  command-line-focus:
    backgroundColor: "{colors.high}"
  panel-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "18px"
  response-row:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "7px 8px"
  index-row:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "0px"
    padding: "14px 12px"
  index-row-active:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-white}"
  rail-item:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.tile}"
    size: "44px"
  rail-item-active:
    backgroundColor: "{colors.high}"
    textColor: "{colors.text}"
  section-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "9px 10px"
  section-link-active:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.text}"
  toggle:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
    typography: "{typography.control-label}"
  toggle-on:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.text}"
  select:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 34px 0 11px"
    height: "38px"
  slider:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted-strong}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "38px"
  save-bar:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted-strong}"
    rounded: "0px"
    padding: "12px clamp(20px, 3vw, 30px)"
---

# Design System: MewBit

> **Scope map.** MewBit ships two implementations of one dark world.
> - **Sections 1-8 below (`Overview` … `Do's and Don'ts`) describe the web surfaces only** — the landing page and the admin dashboard in `web/`, built from `web/src/tokens.css` against `activity/redesigns/obsidian-brandboard.html`. The frontmatter above is the web token layer.
> - **The Discord Activity in `activity/` is a separate implementation** with its own composition and its own record, preserved in the appendix at the foot of this file. Do not apply web composition rules to the Activity, or Activity composition rules to the web.
>
> Both surfaces share the Obsidian palette. They do not share layout, radii, or component vocabulary.

## Overview

**Creative North Star: "The Operator's Console"**

The web world is Obsidian: a near-black field that behaves like a terminal that learned typography. Nothing is decorated to look capable; things are shown working. The landing page is the bot's own command line, and the response canvas under it renders what a command actually returns — so reading the page is already using the product. The dashboard is the affordance this audience operates fluently every day (server rail, section list, settings column), executed at a craft level the familiar version never reaches. Both surfaces are built from the same fifteen colour tokens, and both hold their nerve about colour.

Density is high but never crowded. Structure is carried by hairlines and by tonal steps between four near-black greys — the ground never brightens to make a thing important, and nothing is boxed in a card just to give it edges. Type does the ranking: one 800-weight display voice with tight negative tracking against a monospace that owns every number, signature, key cap and provider tag. Where the interface has to say something is live, current, or focused, it says it with a 3px cyan mark or a hairline at 30-45% alpha, and then goes quiet again.

The surfaces refuse the arrangements their categories default to. The landing page refuses the stacked hero-then-three-feature-cards layout every Discord bot site ships; the instance statistics are one hairline data line, not a row of metric tiles. The dashboard refuses novelty in a surface people visit for thirty seconds. Example cover artwork is drawn SVG, achromatic by rule — a gradient tile with a letter on it would be the palette's argument admitting it has nothing to show.

**Key Characteristics:**
- Near-black four-step ground (`#050608` to `#161920`); elevation is tone, never colour
- Hairline separation at 6% white, strengthened to 12% only for outlines that must be found
- One display family at weight 800 with tight tracking; JetBrains Mono owns all data
- White is the primary action colour; cyan is a mark, not a fill
- Selection inverts a row outright rather than tinting it
- Every state-changing element uses `outline`, not `border`, so hairlines never shift layout

## Colors

Fifteen tokens, four of which are the ground. The palette is achromatic until something is live, focused, or generated — colour is information, and there is very little information.

### Primary
- **Signal Cyan** (`{colors.accent}`): The only interactive accent that appears at rest. It marks the active server on the rail (a 3px bar on the rail's inner edge), the command prompt glyph, the blinking caret, the source tags, the global focus ring, the caret colour of every input, and the "Saved" mark on a field that just wrote. Never a fill, never a button, never the colour of a paragraph.
- **Console White** (`{colors.white-btn}`): The primary action colour. Every commit-level action — the repository CTA, the toggle's on-track, the equalizer fill, the vote bar, the slider thumb — is white on near-black. Cyan is never promoted to a CTA.

### Secondary
- **Autoplay Violet** (`{colors.auto}`): Reserved for generated/automatic state. In the shipped build it appears once, on the autoplay tag, as text plus a 30%-alpha hairline. Its rarity is the point.

### Tertiary
- **Alert Rose** (`{colors.danger}`): Destructive consequence and error copy only — the dashboard's panel error and the danger-toned field note. Text and hairline, never a filled banner.

### Neutral
- **Obsidian Ground** (`{colors.bg}`): Page background and the well behind code blocks; also the 2px ring around slider thumbs, so they read as cut out of the field.
- **Panel** (`{colors.surface}`): Every raised container — the response canvas, the rail, the section nav, the settings panel, the state card.
- **Raised** (`{colors.raised}`): Inset controls and rows inside a panel: command line at rest, response rows, selects, sliders, the save bar, skeletons.
- **High** (`{colors.high}`): The one step above raised, used only for the focused command line and the active rail tile.
- **Hairline** (`{colors.line}`) / **Hairline Strong** (`{colors.line-strong}`): Structure. The default 6% rule separates rows, panels and sections; the 12% rule outlines things that must be findable without hovering (ghost buttons, selects, key caps, stat-line dividers).
- **Text** (`{colors.text}`) / **Muted Strong** (`{colors.muted-strong}`) / **Muted** (`{colors.muted}`): The three-step text ramp. Text for primary identity, muted-strong for secondary data that still has to be read cleanly (stat line, save bar, code blocks), muted for descriptions, blurbs and inactive nav.
- **Faint** (`{colors.faint}`): The dimmest legible grey, used twice — the de-emphasised word inside the display lede, and the vote-bar threshold tick.
- **On White** (`{colors.on-white}`): The text colour on every white surface; inverted rows carry their secondary copy at 60-72% alpha of it.

### Named Rules
**The Faint-Is-Not-Body Rule.** `--faint` measures **4.05:1** on the Obsidian ground. It is permitted only on large display text and non-text marks. Body-sized secondary copy uses `--muted` — no exceptions, and "it's only a caption" is not one.

**The Colour-At-The-Edges Rule.** Cyan, violet and rose exist as 1px hairlines at 0.30-0.45 alpha, as marks under ~21px, and as tag text. They never become a surface fill above a 6% wash (`rgba(103,227,244,0.06)` on the active mode chip is the ceiling). Large areas are always achromatic.

**The White-CTA Rule.** The primary action is white. If a screen appears to need a cyan button, that screen has more than one primary action.

**The Inversion Rule.** A selected row inverts — white ground, `{colors.on-white}` text — rather than taking a tint. Tinting a row is how the rest of the category signals selection; this system doesn't.

## Typography

**Display Font:** Hanken Grotesk (with Segoe UI, system-ui, sans-serif)
**Body Font:** Hanken Grotesk — the same family, carried at 400/1.55
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace), `font-feature-settings: "tnum"`

**Character:** One grotesque does all the speaking, pushed to 800 with tight negative tracking so headings read as machined rather than shouted, against a monospace that never speaks — it only reports. The pairing is the hierarchy: if it is a number, a command signature, a key cap, a duration or a provider, it is mono; everything else is Hanken.

### Hierarchy
- **Display** (800, `clamp(34px, 4.6vw, 52px)`, lh 1.04, ls -0.038em): The landing lede only. Capped at `19ch` so it breaks where it was written to break; the cap releases below 860px.
- **Headline** (800, `clamp(26px, 3.6vw, 40px)`, ls -0.03em): Section openers — the feature ledger and the closing panel.
- **Title** (800, 19px, ls -0.02em): Settings panel heads. The state card runs one step up at 23px / -0.025em; the guild name in the nav sits at 15px / -0.02em.
- **Command** (500, 19px, lh 1, ls -0.012em): The command input and its ghost text, which must share metrics exactly or the ghost will not sit under the typed characters. Drops to 16px below 860px to stay above the mobile zoom threshold.
- **Body** (400, 14px, lh 1.55): The document default. Secondary prose runs 13-14.5px at lh 1.6, capped at 62-68ch.
- **Control Label** (600, 12.5-13.5px): Field labels, toggles, selects, nav items, chips.
- **Data** (mono 500, 10-12.5px, tabular): Command signatures, durations, dB and Hz scales, version strings, the guild name in the save bar, code blocks at lh 1.85.
- **Mono Label** (mono 500/700, 9.5-11px, ls 0.06-0.14em, uppercase): Tags, canvas notes, ledger group heads, the `ENTER` hint, the "Saved" mark.

### Named Rules
**The Mono-Is-Data Rule.** JetBrains Mono is for values, not atmosphere. A word that could be re-typed as prose without loss is not a candidate for mono.

**The Two-Weight Rule.** Headings step by size and tracking, not by inventing weights. The build has exactly two display weights — 800 for headings, 600 for controls — plus 400/500 for prose and data.

**The Uppercase-Tracking Rule.** Any uppercased string carries at least 0.05em tracking and lives at 11px or smaller in mono. Uppercase never appears in the display family, and a tracked-out label never stands alone above a heading.

## Layout

Both surfaces run a single centred measure on a full-bleed near-black ground; neither uses a visible grid or a container border.

**Landing.** One 1060px column inside a `clamp(20px, 5vw, 56px)` gutter. The order is fixed by the thesis: a 68px top bar, the lede, the command line, the response canvas, the command index, then the pitch. Nothing stacks above the command line. The response canvas mounts every response stacked in one grid cell, so it is always as tall as its tallest member and switching commands never reflows the page under the pointer. Each layer carries `min-width: 0`, because a grid item defaults to `min-width: auto` and the shared cell would otherwise stretch to the widest layer's max-content. The index is a full-width three-track row grid (`minmax(150px,210px) / 1fr / auto`) that collapses to a two-line stack at 860px, where the blurb wraps to its own row. Vertical rhythm is fluid: `clamp(34px, 5vw, 52px)` within a region, `clamp(72px, 11vw, 128px)` between regions.

**Dashboard.** A three-track application grid — `68px / clamp(190px, 20vw, 236px) / 1fr` with a 14px gutter — under a 64px account bar, filling the viewport with the settings column as the only scroller. At 900px the grid collapses to one column: the rail becomes a horizontal scroller (its active marker rotating to the tile's bottom edge), the section list becomes a two-up grid, and the panel releases its internal scroll to the page.

**Settings measure.** Fields are a two-track grid (`1fr / max 320px`) capped at 780px, control right-aligned, description and consequence copy capped at 62ch. Below 700px the field linearises in a deliberate order — label, description, control, note — so the consequence still reads as the result of the control above it.

**Spacing rhythm.** Small values are dense and even (4 / 6 / 8 / 10 / 14); region-scale values are fluid clamps. There is no 4px-multiple dogma: the build uses half-steps (2.5px signal-bar gaps, 13px padding) where optical alignment beat arithmetic.

### Named Rules
**The Reserved-Canvas Rule.** Any region whose content swaps in place reserves its height. The response canvas is sized by its tallest member, which makes that member everyone's floor: when the filter response ran to 1074px on mobile, every other response inherited 500px of void. Keeping the tallest response honest is part of the rule, not a separate concern.

**The Measure Rule.** Prose is capped at 62-68ch and display at 19ch. A full-width paragraph at 1060px is a defect, not a layout.

## Elevation & Depth

The system is tonal first and shadowed once. Depth comes from four near-black steps (`bg`, `surface`, `raised`, `high`) plus a 6% hairline; every panel stays legible with its shadow removed. Exactly one shadow token exists, applied only to top-level panels — the response canvas, the rail, the section nav, the settings panel, the state card. Inset controls, rows, chips and buttons are flat and take an `outline` instead of a `border`, so hairlines never occupy layout space or shift a grid by a pixel.

### Shadow Vocabulary
- **Panel** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 4px rgba(0,0,0,0.35), 0 20px 56px rgba(0,0,0,0.35)`): The only elevation in the system. A 3%-white inset top edge catches the light, a tight contact shadow seats the panel, and a wide 56px ambient shadow separates it from the ground.
- **White-surface inset** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.55)`): Not elevation — the top-edge highlight that keeps white buttons and the CTA row from reading as flat paint.

### Named Rules
**The Tone-Before-Shadow Rule.** Elevation is a tonal step. The panel shadow is a finishing pass on top-level containers, never a way to rank two things on the same plane.

**The No-Glow Rule.** Colour never creates depth. No coloured shadows, no zero-offset glows, no accent-tinted surface standing in for elevation.

## Shapes

Rounded rectangles at a restrained scale, all corners equal, stepped by container size: 5px key caps; 9px inset controls (ghost button, select, slider, skeleton); 10-11px interactive rows and blocks (white button, section link, response row, toggle, code block); 12px square tiles (rail item, row artwork); 14px the command field; 16px panels. Fully circular and capsule forms use `999px` and only where the form genuinely is a pill or a knob: chips, toggle track, progress and vote bars, slider tracks, scrollbar thumbs.

Separation is a 1px rule at 6% white, drawn as `border-top`/`border-bottom` on lists (index rows, fields, ledger rows, save bar) and as `outline` on anything that must not change size when its state changes. Two shapes break the rectangle deliberately: the active rail marker, a 3px x 26px bar with `border-radius: 0 3px 3px 0` sitting outside the tile's left edge; and the drawn 48x48 cover artwork, whose geometry is authored per track rather than generated.

### Named Rules
**The Outline-Not-Border Rule.** State-changing elements use `outline: 1px solid` so hover and active never reflow. `border` is reserved for list separation, where the rule is structural.

**The Non-Clipping-Parent Rule.** A container whose active marker is drawn outside its own box must not clip. The rail tile clips its image, not itself.

## Components

### Buttons
- **Shape:** Softly rounded (10px primary, 9px ghost) at fixed heights of 36px and 33px, so they align on a shared baseline in a row.
- **Primary:** White ground (`{colors.white-btn}`) with `{colors.on-white}` text at 700/13px, 16px horizontal padding, plus the white-surface inset highlight. Hover goes to pure `#fff`; active scales to 0.98.
- **Ghost:** Transparent with a 12%-white outline and muted-strong text at 600/12.5px. Hover raises text to full and washes the ground 5% white. Ghost is the only secondary button; there is no outlined-accent variant.
- **Focus:** Global — a 2px cyan ring at 2px offset with a 4px radius, applied through `:focus-visible` on everything. Never removed, never restyled per component.

### Chips & Tags
- **Chip** (capsule, 24px, 10px padding): Hairline outline, muted text. The voted/selected state raises text to full, strengthens the outline to 12%, and adds a 5% white wash — never a coloured fill.
- **Source tag** (mono 700/9.5px, uppercase, 0.08em, 6px radius): Cyan text on transparent inside a 30%-alpha cyan outline. This is the canonical form of a coloured tag in this system.
- **Autoplay tag** (capsule, 22px): The same construction in violet.

### Cards / Containers
- **Corner Style:** 16px panel radius.
- **Background:** `{colors.surface}`, with inset content on `{colors.raised}`.
- **Shadow Strategy:** The single panel shadow (see Elevation & Depth).
- **Border:** A 1px 6%-white outline.
- **Internal Padding:** 18px on the response canvas, `clamp(20px, 3vw, 30px)` on the settings panel, 32px on state cards.

### Inputs / Fields
- **Command line:** A 66px, 14px-radius bar on `{colors.raised}` with a 12% outline, laid out prompt / field / hint. The prompt glyph and the 9x21px caret are cyan; the field itself stays achromatic. Focus swaps the ground to `{colors.high}` and the outline to cyan at 42%. The caret blinks on a 1.05s `steps(1)` cycle, and ghost text sits behind the input at identical metrics.
- **Select:** 38px, 9px radius, raised ground, 12% outline, with an inline SVG chevron tinted `{colors.muted}` as a data-URI background. Native menu options are themed to the raised ground rather than left at browser default.
- **Slider:** A 38px raised shell holding a 4px 10%-white track and a 13px white thumb ringed 2px in `{colors.bg}`; the numeric readout is right-aligned in a reserved 38px column so the value never shifts as it changes.
- **Toggle:** A full-width row, not a bare switch — 11px radius, hairline outline, label at 600/12.5px, and a 34x20px capsule track. Off is 12% white with a muted-strong knob; on fills the track white with an `{colors.on-white}` knob and washes the row 5%. Disabled drops to 0.45 opacity with `not-allowed`.
- **Consequence and error:** Interdependent settings state their consequence inline as a field note (danger-toned when it is a loss), at the control, before the change — never as post-hoc validation.

### Navigation
- **Server rail:** 44px tiles at 12px radius on `{colors.raised}`, with a monogram fallback at 700/13px. Hover raises text and strengthens the outline. The active server is marked by the cyan bar outside the tile's left edge plus a step to `{colors.high}` — never a coloured fill.
- **Section list:** Two-line rows (name at 600/13px over a muted 11px summary) at 10px radius. Hover washes 4% white; active washes 8% white and raises text to full. The section list's active state is achromatic: cyan marks the server, not the section.
- **Top bar links:** Muted 13px/600 pills at 9px radius, hovering to full text on a 5.5% wash.

### Command Index (signature component)
The landing page's list of commands, doubling as its navigation and its call to action. Each row is `signature / blurb / action` on a 6% rule: mono signature left, muted blurb centre, and a mono uppercase action word that fades in only on hover or selection. The active row inverts — white ground, `{colors.on-white}` text, secondary copy at 60% alpha. The final row is the repository CTA: the same grid, lifted out of the list by an 18px gap, with no bottom rule, an 11px radius and the white-button treatment, so it reads as the last command rather than as another selected row.

### Save State (signature component)
Writes land immediately; there is no dirty state and no submit button. The save bar at the foot of the settings column always carries a resting line ("Changes save as you make them") so the column always says where changes go, and moves through a spinner to a check as the write reaches the bot. The confirmation the user actually reads is on the field itself: a cyan uppercase mono "Saved" mark beside the label, entering on a 0.22s 3px settle.

### Response Canvas & Cover Art
The canvas renders a real command response — queue rows, a DJ vote, a fifteen-band equalizer, a deploy block — from one shared row vocabulary (40px artwork, two-line meta, mono duration, source tag). Cover artwork is real album art on the landing and authored SVG on a 48x48 viewBox elsewhere, drawn per track and achromatic by rule, using only greys between `#0b0e13` and `#c3cbd7`. Icons are drawn SVG at 12-16px in bold weight, inline with their label.

Every response body is a column that stretches to the shared canvas height, with its closing fact pinned to the foot. Two responses fill that height with an instrument rather than with padding:

- **Equalizer.** Fifteen full-height 5px tracks under a three-tick dB axis (`+6 / 0 / -6`), each carrying an 11px white handle and a bipolar fill that runs from the zero line to the handle, so a cut reads as a cut. The gain readout appears above the track on hover, drag or keyboard focus, in a fixed position that never moves with the handle. Below 860px the row folds to two rows of eight at a fixed 116px height and the shared axis is dropped, because folded sliders are no longer one scale.
- **DJ.** A mode switcher over a two-card grid: the skip on the left (vote bar, threshold, voters, and the proposal a non-DJ's `/play` actually becomes), the permission ladder on the right, spread to the card. Both cards answer to the same two controls, so the panel is a model of the setting rather than a picture of one.

### Exhibit (signature component)
The screenshot section is a twelve-column grid with deliberately uneven spans — 12, then 7+5, then 5+7, then a prose-and-frame close. Frames take their natural height (`align-items: start`); a uniform tile grid says every frame matters equally, which is never true, and stretching the short one pads its foot with dead panel. Each frame opens with a **plate**: name left, right-aligned mono surface tag, built on the same left-signature / right-note shape as the canvas head. The frames are not numbered — nobody cites a landing page by figure number, so an index is decoration wearing the costume of a reference. The narrow column carries one extra mono line of fact, which closes part of the height it gives up. The lead frame's media is its own positioning context so the voice-channel status can overlap its corner — where it sits in Discord — without ever landing on caption text.

### Drawn Plates
The landing's line artwork is drawn, not photographed, and it is one shape only: the symmetric waveform from the Discord avatar, magenta left and cyan right on near-black.

- **`HeroField`** — the opening plate. A 96-bar waveform under a cosine envelope on a 1440x620 viewBox at `preserveAspectRatio="slice"`, crossed by a full-height playhead. The page ground is painted back over it in a vertical ramp rather than masked, so the copy above it only ever sits on a darker surface. Above 860px the waveform is masked to die at 58% of the plate: it shares the hero with a photographic figure anchored right, and two motifs crossing in the one region where both carry detail is how a composition turns to noise. Below 860px the figure is dropped and the mask swaps back to full width.
- **`SectionRule`** — the same waveform at rule scale (150 bars, 34px tall), breaking the lower page into sections in the hero's own vocabulary rather than a second visual language. Three seeds, so no two rules repeat.

Every value is deterministic: a fixed-seed hash, never `Math.random`, so the silhouette is identical on every render and reload. Colour follows the split in the avatar, carried on 1-2.2px bars at 0.32-0.45 group alpha, which is the hairline range the Colour-At-The-Edges Rule already allows. These are marks at scale, not coloured surfaces; nothing here is a fill or a glow.

**The Measured-Ground Rule.** Artwork behind type is accepted on a measured peak, not on how dark it looks. The hero figure's left half peaks at 1/255, so the lede clears it at roughly 20:1; the same figure cropped to 375px puts a rim light through the lede band at 196/255, or 1.6:1, at every horizontal position available — so it is dropped there rather than dimmed, because an image averaging 8/255 has nothing left to give away. Measure in true RGB: `ffmpeg signalstats` reports limited-range luma where 16 is black, which reads as a lifted black level on an image that does not have one.

**The One-Motif Rule.** The drawn layer gets exactly one shape, and it is the waveform. A concentric-ring field was built alongside it — in the hero and again behind the ledger — and cut: a glowing circle behind a headline is the first thing every generator reaches for, and it read as one. Orbiting sparks went with the ring, because without it they were loose dots. If a second motif ever seems necessary, the honest reading is that the first one is not doing its job.

### Demo Typing (signature component)
The command line types itself until someone reaches for it: a real command, a pause on the finished line, a backspace run, the next one. Keystroke delays are jittered — 46-100ms with a longer beat after the slash and before an argument, and a 7% chance of a hesitation; deletion runs 26-56ms with a 10% hitch and a slower last few characters. A metronome reads as a marquee. The caret holds solid while characters are moving and blinks only on the finished line. The canvas follows the **completed** command, never the first keystroke, so the response answers the line rather than preceding it. Every line is a command the bot actually takes with arguments it accepts.

**The Yield Rule.** The first real interaction — a focus, a keystroke, a hover on the index — ends the demo permanently and the field falls back to naming the command the canvas is showing. A surface that keeps typing over you is a surface fighting you, and an empty prompt with a bare caret tells nobody what to type.

### Motion
One easing curve for the entire system (`cubic-bezier(0.32, 0.72, 0, 1)`), at 0.12-0.18s for state and 0.22s for entrances. Looping motion exists only where something is genuinely live: the wordmark's three signal bars, the equalizer chip, the caret blink, the save spinner, and — in the hero plate — sixteen breathing bars and one playhead sweeping the full height of the plate. The plate animates sixteen of its ninety-six bars on purpose: a hero that animates everything is a hero that drops frames. Sections settle in on arrival at 16px and 0.62s, paired frames a beat apart, once each — replaying an entrance on every scroll-up is motion for its own sake. The section rules answer the pointer: a second copy of the bars, scaled and revealed through a radial mask centred on the cursor, so a swell travels along the rule under the hand. One style write per pointer move, on the parent — animating 150 bars individually is a frame budget, not a detail. `prefers-reduced-motion: reduce` collapses every animation and transition to 0.01ms globally, and both the demo typing and the scroll reveal check the query directly and never start.

**The Script-Hides-Nothing Rule.** The reveal's hidden state is added by script, never by the stylesheet, and anything already at or above the fold is shown outright rather than observed. A page whose content is hidden in CSS and shown by JS is a page that breaks when the JS does — and an observer never reports an element that was already behind you, so a restored scroll position would leave blank sections above the reader.

## Do's and Don'ts

### Do:
- **Do** build depth from the four-step tonal ground, and reach for the single panel shadow only on top-level containers.
- **Do** keep `--faint` (`#667081`, 4.05:1) on large display text and non-text marks; body-sized secondary copy uses `--muted`.
- **Do** invert a selected row to a white ground with `{colors.on-white}` text.
- **Do** make the primary action white, and give a screen only one of them.
- **Do** use `outline` for anything whose state changes, and `border` only for structural list rules.
- **Do** set every number, signature, duration, provider and version in JetBrains Mono with `tnum`.
- **Do** reserve the height of any region whose content swaps in place.
- **Do** state an interdependent setting's consequence inline at the control, and confirm a write on the field it changed.
- **Do** draw example artwork and icons as SVG, achromatic, on a fixed viewBox.
- **Do** cap prose at 62-68ch and leave the global cyan `:focus-visible` ring intact.

### Don't:
- **Don't** fill a large surface with cyan, violet, magenta or rose; colour lives at hairlines (0.30-0.45 alpha), small marks and tag text, with a 6% wash as the absolute ceiling.
- **Don't** promote cyan to a button — the CTA is white.
- **Don't** tint a selected row instead of inverting it.
- **Don't** use a coloured or zero-offset glow to signal state; there is one shadow and it is black.
- **Don't** set body copy in `--faint`, and don't set a paragraph in mono.
- **Don't** uppercase display type, or stand a tracked-out label alone above a heading as a kicker.
- **Don't** add a third button variant; white and ghost are the whole set.
- **Don't** introduce a radius outside the 5 / 9 / 10-11 / 12 / 14 / 16 / 999 ramp.
- **Don't** clip a container whose active marker is drawn outside its own box.
- **Don't** present single-instance numbers as a board of metric tiles; the stat line is one hairline row, labelled as one deployment.

---

# Appendix: MewBit Discord Activity (`activity/`)

*Preserved record of the Discord Activity surface. It governs `activity/` only; the web sections above do not apply to it, and it does not apply to them. One drift observed in the shipped build and recorded here rather than rewritten: `activity/src/styles.css` now runs the Hanken Grotesk display stack and `--radius-panel: 16px`, where the text below records an Avenir Next / Segoe stack and an 18px panel radius. Reconcile on the Activity's own next documentation pass.*

### MewBit Activity Design

### Surface

Operate mode. This is a dense shared music cockpit inside a Discord Activity. The interface is designed for people already listening together, so state, controls, and recovery paths outrank decoration.

### World

MewBit extends the existing neon cyberpunk anime catgirl identity into dark interface chrome. The system uses a quiet near-black base, electric cyan for primary control and realtime state, hot magenta for media energy, and violet for secondary source emphasis. The palette stays consistent across the surface. There are no light-mode sections inside the Activity.

### Typography

The Activity uses an Avenir Next and Segoe system stack for readable UI copy. Monospace is reserved for measurements, provider labels, time, and connection state. Dynamic values use tabular numerals. Headings use tight tracking and balanced wrapping instead of decorative type effects.

### Shape and surfaces

Panels use an 18px radius. Controls use a 12px radius. Artwork uses a 12px radius for queue rows and an 18px radius for the main cover. Borders communicate structure and selected state. Shadows are soft, tinted by the dark surface, and never used as a zero-offset glow.

### Composition

The first viewport follows a Spotify-like player shell without a separate room header. A dynamic center is surrounded by a slide-out playlist library on the left and an always-ready queue on the right. Their icon-only toggles stay attached to the outer edge of each panel. The center opens on Home when nothing is playing and becomes the full player when a track is active. Search, sound, lyrics, and playlist editing replace the center content without leaving the room. A sticky bottom player bar keeps the current track, transport, seek, volume, provider, and expand-to-full-player action available across secondary views; Home/full player uses the whole viewport. The queue is open by default on desktop; the library is closed by default. Below 900px the sidebars become drawers, and on narrow/short Discord windows the dedicated compact player takes over.

### Discord compact mode

When the Activity viewport is both narrow and short, it switches composition instead of compressing the desktop cockpit. The compact surface keeps only the artwork banner, track identity, provider, progress and time, previous/play/skip/lyrics/mute controls, and volume when vertical space allows. Queue and secondary workspaces remain available in the full Activity view. The trigger is content-driven at `max-width: 620px` and `max-height: 420px`, matching Discord's minimized Activity panel rather than ordinary phone portrait use.

### Motion

Motion communicates live playback and feedback. The cover signal animates only while a track is playing. Search loading uses a restrained skeleton. Toasts enter with a short vertical settle. `prefers-reduced-motion` disables looping and transition-heavy effects.

### Interaction rules

- Every control has a visible label, tooltip, or accessible name.
- Queue rows support native drag-and-drop reordering and explicit remove actions.
- Search results show the resolved provider beside the track identity.
- Lyrics keep the active line separate from static text and expose a refresh action.
- EQ uses native range inputs for keyboard and pointer access.
- Empty, loading, error, offline preview, and live states are explicit.

### Implementation boundary

The Activity never becomes a second playback engine. It reads state from the bot gateway and sends authenticated actions back to the existing Poru and Lavalink helpers. The browser never receives the Discord bot token or client secret.
