---
name: Safarnama
description: Indian Railways enamel signs, refined into a premium booking interface.
colors:
  brand: "#04056f"
  brand-dark: "#020240"
  brand-light: "#e4e6f8"
  accent: "#fcb831"
  accent-dark: "#f2a713"
  accent-light: "#fff1cf"
  ground: "#eef0fa"
  plate: "#ffffff"
  ink: "#10122b"
  rule: "#cfd3ea"
  slate-600: "#434c60"
  slate-500: "#555f75"
  slate-400: "#6b7489"
  ok: "#0e6b47"
  warn: "#8a5300"
  bad: "#c4321d"
typography:
  display:
    fontFamily: "Poppins, Hind, sans-serif"
    fontSize: "4.2rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Poppins, Hind, sans-serif"
    fontSize: "2.16rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  section:
    fontFamily: "Poppins, Hind, sans-serif"
    fontSize: "1.58rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Poppins, Hind, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, Hind, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  body-small:
    fontFamily: "Inter, Hind, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Poppins, Hind, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.01em"
  readable:
    fontFamily: "Atkinson Hyperlegible, Hind, system-ui, sans-serif"
    fontWeight: 400
    letterSpacing: "0.01em"
rounded:
  tick: "3px"
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  plate: "0.75rem"
  dialog: "1rem"
  shell: "1.75rem"
  pill: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  plate-sm: "1.25rem"
  gap: "1.5rem"
  plate: "1.75rem"
  gutter: "2rem"
  section: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
  button-brand:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.accent}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-brand-hover:
    backgroundColor: "{colors.brand-dark}"
  button-secondary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.brand}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-secondary-hover:
    backgroundColor: "{colors.brand-light}"
  card:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "{spacing.plate}"
  plate-indigo:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.plate}"
    rounded: "{rounded.plate}"
    padding: "{spacing.plate}"
  plate-yellow:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "{spacing.plate}"
  input:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  field-label:
    textColor: "{colors.brand}"
    typography: "{typography.label}"
  coach-board:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    padding: "0.75rem 1.25rem"
  class-chip:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.375rem 0.125rem"
  header-bar:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.plate}"
    rounded: "{rounded.shell}"
    padding: "1.25rem 2rem"
  nav-link:
    textColor: "{colors.plate}"
    typography: "{typography.title}"
  nav-link-active:
    textColor: "{colors.accent}"
  wallet-plate:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.accent}"
    rounded: "{rounded.dialog}"
    padding: "2rem"
---

# Design System: Safarnama

## Overview

**Creative North Star: "The Enamel Station Sign"**

Safarnama is lettered the way Indian Railways letters its platforms: royal-blue and marigold enamel plates, white task plates hung on a pale indigo ground, bilingual names set side by side. Every surface is a sign. The coach destination board, the marigold plate every coach carries beside its door, heads each train, ticket, plan and payment, and it is the one component that makes a screen recognisably this product.

The interface is built for a 1920-wide board screen read from across a room. The root size is 120% (one rem is 19.2px) and everything is sized in rem, so the accessibility text setting scales the whole site. Colour does the separating: there are no shadows, no gradients on content, no ornament. Plates are flat, sit apart from the ground by tone alone, and settle into place once with a short drop when they appear.

The world refuses the generic blue-header travel-app grid, truck-art ornament, and anything that reads as a government website.

**Key Characteristics:**
- Royal blue and marigold at full strength; white plates on an indigo-mist ground.
- Poppins for every heading, number, board and label; Inter for reading text; Hind for Devanagari in both.
- Flat enamel: depth comes from colour, never from shadow.
- The coach destination board as the recurring signature.
- Painted native controls: indigo checkboxes with marigold ticks, drawn chevrons, a drawn calendar mark.
- Large, legible type sized for a classroom board screen.

## Colors

Two enamels at full strength (royal blue and marigold), a near-white indigo ground, and an ink that carries a trace of the blue.

### Primary
- **Royal Enamel** (brand): the brand. Section plates, the home station board, the wallet plate, class-code chips, field labels, focus outlines, link text, the painted track on train cards. Money and the wallet live on this blue.
- **Night Enamel** (brand-dark): the deeper shade for the header bar, the footer, dialog scrims (at 70 to 75% opacity) and the hover state of royal-blue plates and buttons.
- **Indigo Wash** (brand-light): selected rows, the open availability panel, hover on white link plates, the inline voice hint.

### Secondary
- **Marigold** (accent): the primary action colour and the coach board. Fills primary buttons, yellow plates, the brand wordmark, the active nav bar, and lettering on blue (headings, figures, chip text). Also the text selection colour.
- **Marigold Deep** (accent-dark): hover on every marigold fill.
- **Marigold Cream** (accent-light): notes inside a royal-blue plate (the planner's "what was understood" notes).

### Neutral
- **Indigo Mist** (ground): the page ground, and the 2px dividers inside white plates (dividers are drawn in the ground colour, so a plate looks cut into segments).
- **White Plate** (plate): cards, inputs, dialogs.
- **Ink** (ink): all body text and lettering on marigold.
- **Rule** (rule): input borders at rest.
- **Slate 600 / 500 / 400** (slate-600, slate-500, slate-400): secondary text, placeholders and station codes, each chosen to pass WCAG AA on white and on the ground.

### Tertiary
- **Status Green** (ok): availability ("Available"), refunds, CO2 saved. Text only.
- **Status Amber** (warn): RAC and caution text.
- **Vermilion** (bad): attention only: waitlists, cancellations, errors.

### Named Rules
**The Marigold-On-Blue Rule.** Marigold is a fill, or lettering on royal or night blue. It is never text on white or on the ground.

**The Blue Money Rule.** Money and the wallet sit on royal blue with marigold or white figures. Green never fills behind money; green is status text only.

**The Vermilion Means Attention Rule.** Vermilion appears only for waitlists, cancellations and errors, never as decoration or emphasis.

## Typography

**Display Font:** Poppins 500 to 700 (with Hind, sans-serif), loaded for Latin and Devanagari
**Body Font:** Inter (with Hind for Devanagari, system-ui)
**Readable mode:** Atkinson Hyperlegible replaces both when "Easy to read" is chosen, with 0.01em tracking

**Character:** Poppins is the sign painter: geometric, rounded, set slightly tight (-0.01em, line height 1.15) the way display lettering is. Inter is the timetable footnote, plain and highly legible at line height 1.55. All numerals are tabular.

### Hierarchy
- **Display** (700, 4.2rem, 1.05, -0.02em): the home station board only; "Safarnama" in marigold with सफ़रनामा beside it in white at 3.1rem.
- **Headline** (600, 2.16rem, 1.15): page titles, and the departure and arrival times on train cards.
- **Section** (600, 1.58rem to 1.87rem, 1.15): section headings in royal blue; home plate titles at 1.87rem.
- **Title** (600, 1.15rem to 1.37rem, 1.15): card and plate titles, totals, coach board names.
- **Body** (400, 1rem, 1.55): reading text; 0.95rem for secondary lines and metadata. Measure is held to 34 to 48ch on plates.
- **Label** (600, 0.85rem, 0.01em): field labels, in royal blue Poppins, sentence case.

### Named Rules
**The Sign-Painter Rule.** Anything that is a name, a number or a heading is set in Poppins; anything you read as a sentence is Inter. Fares, times, PNRs, train numbers and class codes are always Poppins.

**The Equal Scripts Rule.** Every face in use carries Devanagari (Poppins and Hind directly; Inter falls through to Hind), so Hindi is never a system fallback.

## Layout

Desktop only, composed for 1920 by 1080. Pages sit in a centred 80rem container with a 2rem gutter; the header row runs slightly wider at 86rem; narrow task pages (wallet, forms) use 64rem or less. Spacing follows the 0.25rem step: plates pad at 1.75rem (1.25rem for compact plates), grids gap at 1.5rem (1rem for board rows), and sections are separated by 3rem.

The shell is two rounded night-blue bars. The header has 1.75rem lower corners; on pages that open with a royal-blue board, the board is pulled up 1.75rem beneath the header so its corners sit on blue. The footer mirrors it with 1.75rem upper corners. On the home page, the white search plate hangs across the board's lower edge (pulled up 6rem). Rows of related plates (popular routes, plan options) sit in fixed column grids; plan options are separated by 0.25rem gaps of ground colour inside one rounded clip.

## Elevation & Depth

Flat. No surface uses a shadow. Depth is tonal: white plates on indigo mist, royal-blue plates on either, marigold plates on anything. Dialogs float over a night-blue scrim at 70 to 75% opacity rather than casting a shadow. The only `box-shadow` in the system is the inset white ring that draws the dot inside a checked radio button.

### Named Rules
**The Flat Enamel Rule.** A plate stands out by its colour, never by a shadow. If a surface needs separation, change its enamel or cut it with a 2px ground-colour divider.

## Shapes

Soft enamel corners. Plates and cards round at 0.75rem; buttons and inputs at 0.5rem; small header controls, inline notes and the coach-board's inner chips at 0.375rem or 0.25rem; dialogs at 1rem; the header and footer at 1.75rem. Checkboxes keep a 3px corner and radios are full circles. Lines are thick: inputs carry a 2px border, secondary buttons a 2px inset ring, dividers are 2px, focus outlines 3px, the active nav bar 3px with rounded ends. The coach board itself is square-cornered and takes its rounding from the plate or dialog that clips it.

## Components

### Buttons
Painted platform signs: solid enamel, semibold, nothing raised.
- **Shape:** gently rounded (0.5rem).
- **Primary:** marigold with ink lettering, 0.625rem by 1.25rem padding, 0.95rem semibold. The main action on every screen (Search, Book, Confirm payment).
- **Brand:** royal blue with marigold lettering; the strong secondary (the planner's submit, the "Plan" chip inside the home plate).
- **Secondary:** white with royal-blue lettering and a 2px royal-blue inset ring.
- **Hover / Focus:** colour shifts only (marigold to marigold deep, royal to night, white to indigo wash). Keyboard focus is a 3px royal-blue outline offset 2px, switched to marigold inside the header and on blue plates. Disabled at 50% opacity.
- **Large actions** (payment confirm, language choice) set the label in Poppins at 1.1rem to 1.73rem.

### Chips
- **Class-code chip:** royal blue with marigold Poppins lettering, 0.25rem corners, tight padding (1A, 3A, SL). The train-type chip on the coach board uses the same treatment.
- **Plan tags:** words first, colour second: cheapest on royal blue, fastest on indigo wash, surest on marigold, comfort on ink.

### Cards / Containers
- **Corner Style:** 0.75rem (plate); dialogs 1rem.
- **Background:** white plate; royal-blue or marigold plates for signs that carry a section.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; internal divisions are 2px dividers in the ground colour.
- **Internal Padding:** 1.75rem, or 1.25rem for compact plates.

### Inputs / Fields
- **Style:** white, 2px rule-colour border, 0.5rem corners, 0.5rem by 0.75rem padding, 1rem text, slate-500 placeholder.
- **Focus:** the border turns royal blue.
- **Labels:** royal-blue Poppins at 0.85rem, sentence case, above the field.
- **Painted controls:** checkboxes and radios are 1.25rem with a 2px royal-blue edge; checked, they fill royal blue with a drawn marigold tick (or a white-ringed dot). Selects carry a drawn royal-blue chevron; date fields a drawn royal-blue calendar mark. Range sliders take the brand blue.

### Navigation
- **Header:** a night-blue bar (gradient from night enamel to a slightly lighter night) with 1.75rem lower corners. Wordmark in marigold Poppins Bold 1.55rem with सफ़रनामा at 1.1rem beside it.
- **Links:** Poppins 500, 0.92rem, white at 80%; hover to full white. The current section is lettered marigold with a 3px rounded marigold bar beneath, like a platform marking.
- **Utility controls:** language toggle with a marigold inset ring, login with a white inset ring, register as a small marigold button.
- **Footer:** night blue with 1.75rem upper corners, marigold wordmark, white text at 80%.

### Coach Destination Board (signature)
The marigold plate a coach carries by its door. A full-width marigold band, ink Poppins lettering: the train number (bold, 0.02em tracking), the name (semibold), then FROM → TO (medium, ink at 75%). Three sizes: small (1.2rem number, 1rem by 0.5rem padding), medium (1.55rem, 1.25rem by 0.75rem), large (2.1rem, 1.75rem by 1rem). Chips and links sit at its right edge. It heads every train card, ticket, plan leg and payment confirmation; it has no corners of its own and is clipped by its container.

### Wallet Plate
The balance is a royal-blue plate with 1rem corners and 2rem padding; the figure is marigold Poppins Bold at 3.6rem. The pay-from-wallet block is the same blue with a full-width marigold button; its confirmation dialog leads with coach boards, lists every fact the payment covers, and ends in a secondary Cancel beside a wider primary Confirm.

### Motion
Plates settle into place once: a 6px drop from 40% opacity over 420ms on cubic-bezier(0.16, 1, 0.3, 1). Content is visible by default. All motion collapses under reduced motion, whether requested in the menu or by the device.

## Do's and Don'ts

### Do:
- **Do** letter every name, number and heading in Poppins and every sentence in Inter.
- **Do** separate surfaces by enamel colour: white plates (0.75rem corners) on the indigo-mist ground, royal-blue and marigold plates for section signs.
- **Do** head every train, ticket, plan leg and payment with a coach destination board.
- **Do** put money on royal blue, with marigold or white figures.
- **Do** spell availability out in words with a drawn mark beside it; colour only helps.
- **Do** size in rem so the 120% root and the text-size setting scale everything together.
- **Do** keep keyboard focus as a 3px royal-blue outline, marigold on blue.

### Don't:
- **Don't** add shadows to plates, cards, buttons or dialogs.
- **Don't** set marigold text on white or on the ground.
- **Don't** fill green behind money or the wallet; green is status text only.
- **Don't** use vermilion for anything but waitlists, cancellations and errors.
- **Don't** fall back to operating-system checkboxes, chevrons or calendar icons; paint them in the brand blue.
- **Don't** let the interface drift toward a government website or a generic blue-header travel-app grid.
