---
name: PolicyTruth
description: Does your website do what your privacy policy says?
colors:
  ink: "#0b0c0c"
  ink-hover: "#2b2f30"
  paper: "#ffffff"
  wash: "#f3f4f4"
  rule: "#dcdedf"
  rule-strong: "#8f9496"
  muted: "#50585c"
  plate: "#ffd400"
  plate-ink: "#1a1a00"
  band: "#1d4fa8"
  pass: "#00703c"
  pass-wash: "#e5f2ea"
  fail: "#d4351c"
  fail-wash: "#fbe9e6"
  warn: "#8a4b00"
  warn-wash: "#fdf1df"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.2vw, 5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  verdict:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 125"
  score:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\""
  plate:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(0.95rem, 4.5vw, 1.875rem)"
    fontWeight: 800
    letterSpacing: "0.04em"
    fontVariation: "\"wdth\" 125"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  reading:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  evidence:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875em"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "6px"
  plate: "8px"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  row: "20px"
  block: "48px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.body-sm}"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.wash}"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.plate}"
    typography: "{typography.plate}"
  plate-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.paper}"
    width: "36px"
  tag-pass:
    backgroundColor: "{colors.pass-wash}"
    textColor: "{colors.pass}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tag-fail:
    backgroundColor: "{colors.fail-wash}"
    textColor: "{colors.fail}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tag-warn:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  certificate-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "10px 20px"
  evidence-code:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
    typography: "{typography.evidence}"
---

# Design System: PolicyTruth

## Overview

**Creative North Star: "The Test Certificate"**

Every audit is a roadworthiness test for a website, issued as a printed test certificate on a white sheet. The domain sits in a UK rear number plate, the result is stamped PASS, FAIL or REFUSED, and every defect is a numbered, ruled line backed by its evidence. The system refuses the KPI-card SaaS dashboard: there are no floating tiles, no gradients, no ambient glows. Structure comes from ink rules and bordered panels, the way an official form is laid out.

Density is that of a working document: tight ruled rows, generous section breaks, readings in a ruled grid rather than cards. The voice is plain and exact, never legal or bureaucratic. Colour is almost entirely ink on paper; meaning colours (pass green, fail red, warn amber) appear only where a test result is being reported, and plate yellow is held back for the plate itself.

Motion is reserved for the moments the certificate is issued: the verdict stamp lands, the score counts up, the plate decrypts the host, the inspection steps shimmer while a test runs. Everything else is a 150ms colour change. Reduced motion collapses all of it.

**Key Characteristics:**
- White sheet, ink type, ruled lines; depth by 2px ink border, not shadow.
- The domain is always shown as a UK number plate.
- Verdict grammar borrowed from the MOT: Dangerous, Major, Minor defects; FAIL, PASS, PASS with minor defects, REFUSED.
- Archivo variable font, expanded width for plate, verdict, wordmark and step titles.
- JetBrains Mono only for evidence, code and logs.

## Colors

Ink on paper, with four meaning colours that only ever report a result and one reserved plate yellow.

### Primary
- **Certificate Ink** (ink): All text, 2px structural borders, the primary button, the active tab pill, the certificate title band, the fixes code block. **Ink Lift** (ink-hover) is its hover state on the primary button only.

### Secondary
- **Rear-Plate Yellow** (plate): The domain number plate (display plate, example plates, the plate input), the GOV.UK-style focus ring, `::selection`, and the shield glyph in the logo tile. Nowhere else. **Plate Ink** (plate-ink) is the text colour on the plate.
- **UK Band Blue** (band): The "UK" band at the left edge of every plate. Never used outside the plate.

### Tertiary (result colours)
- **Pass Green** (pass) on **Pass Wash** (pass-wash): PASS and PASS with minor defects stamps, "Waits for consent" and "Found" tags, approved defect rows (wash only), good readings.
- **Fail Red** (fail) on **Fail Wash** (fail-wash): FAIL stamp, Dangerous and Major category headings and tallies, "Fires before consent" and "Missing" tags, the error alert, the strike-through on verifier-rejected claims, bad readings.
- **Warn Amber** (warn) on **Warn Wash** (warn-wash): advisories, "Not named" and missing-header tags, partial readings.

### Neutral
- **Paper** (paper): The page ground (pinned white), panels, sticky header, sticky approval bar.
- **Wash** (wash): Ghost-button hover, count badges, evidence code background, run log, history-row hover.
- **Rule** (rule): 1px hairlines between rows, readings, header and footer.
- **Rule Strong** (rule-strong): Ghost button border, link underlines, step numerals in How it works, scrollbar thumb.
- **Muted** (muted): Secondary text, notes, row numbers, the REFUSED stamp.

### Named Rules
**The Plate Yellow Rule.** Yellow belongs to the number plate. Its only other uses are the focus ring, text selection and the logo shield. Never use it for a highlight, badge, button, chart or background.

**The Results-Only Rule.** Green, red and amber report a test result and nothing else. They never decorate, never brand, and always pair with a word ("Fires before consent", "Missing"), so colour is never the only signal.

## Typography

**Display Font:** Archivo (variable, with `wdth` axis), fallback ui-sans-serif, system-ui
**Body Font:** Archivo
**Label/Mono Font:** JetBrains Mono, fallback ui-monospace

**Character:** One grotesque in two widths. Archivo at normal width carries the document; at expanded width (`wdth` 125) it becomes the stamped, embossed voice of the plate, the verdict, the wordmark and the step titles.

### Hierarchy
- **Display** (800, clamp 2.5rem to 5rem, 0.98): The landing question only, max 16ch.
- **Verdict** (900, 3.75rem, 1, expanded): The stamp word; 3rem at mobile for FAIL/PASS, smaller for the longer REFUSED.
- **Score** (900, 3.75rem, tabular): The /100 score beside the verdict.
- **Plate** (800, uppercase, expanded, 0.04em tracking): Domain text inside the plate only.
- **Headline** (800, 1.875rem to 2.25rem, -0.025em): Section headings such as "A test you can check line by line", "Test in progress".
- **Title** (700, 1.125rem, -0.01em): Section heads above ruled lists (category names, Tracker inventory, Pipeline).
- **Reading** (700, 1.25rem, tabular): Values in the certificate readings grid.
- **Body** (400, 16px, 1.55): Running text; measure 60 to 75ch.
- **Body small** (400, 14px): Notes, table cells, row metadata, buttons (at 600).
- **Evidence** (JetBrains Mono, 0.875em): Page-source evidence, tracker match strings, script hosts, agent tool names, run log, fix snippets.

### Named Rules
**The Mono Is Evidence Rule.** Monospace means "this is raw material from the site or the system". Never set UI labels, headings or numbers in mono; numbers use Archivo with tabular figures.

**The Wide Width Rule.** Expanded width (`wdth` 125) is for the plate, the verdict, the wordmark, the grade letter and numbered step titles. Body text stays at normal width.

## Layout

A single centred column, max 1240px, with a 16px side gutter that widens to 24px from 640px. The landing splits 8/4 on a 12-column grid at 1024px: the question, plate input and examples on the left, the inspection manual on the right; below 1024px they stack. The certificate places the verdict column to the right of the plate and summary at 1024px, and above it (separated by a hairline) on smaller screens.

Rhythm is ruled rows, not cards. List rows are separated by 1px rules with 10px to 20px vertical padding; groups within a view are 48px apart; views and landing sections are 56px apart. Readings sit in a ruled grid (2 columns, 3 from 640px, 6 from 1024px). Section tabs and the approval bar are sticky; the header is sticky with a 95% white backdrop. Tables scroll horizontally inside their own container rather than the page.

Print hides chrome (`no-print`) and drops body size to 12px so the certificate prints as a document.

## Elevation & Depth

The system is flat. Depth is declared once: a 2px ink border marks anything that is a document object (the certificate, the inspection manual, the sticky approval bar, the export menu, the policy addition block, the plate). Exactly one soft shadow exists, on the export menu, because it floats over content.

### Shadow Vocabulary
- **Menu lift** (`box-shadow: 0 8px 24px rgb(11 12 12 / 0.12)`): The export dropdown only.
- **Plate emboss** (`box-shadow: inset 0 0 0 3px #ffd400, inset 0 0 0 4px rgb(0 0 0 / 0.25)`): Part of the plate's form, not elevation; gives the inner pressed edge of a real plate.

### Named Rules
**The Ink Border Rule.** Raise an object with a 2px ink border, never a shadow. The export menu's soft shadow is the single exception; do not add a second.

## Shapes

Square by default: the certificate, panels, readings, tables and ruled rows have no radius. Small radii mark interactive or inline objects: 4px for tags, count badges and code chips; 6px for buttons, the logo tile, the tab pill, the run log and code blocks; 8px for the plate, matching a real number plate. Fully round only for the agent-mode toggle and the step dots. Section heads close with a 2px ink rule; rows divide with a 1px rule.

## Components

### Buttons
- **Shape:** Gently squared (6px), min height 40px; the Start test button grows to 56px beside the plate input.
- **Primary:** Ink fill, white 14px semibold text, 16px side padding; hover lifts to Ink Lift. One primary per region (Start test, Draft fixes).
- **Ghost:** White with a Rule Strong 1px border and ink text; hover darkens the border to ink and fills with wash.
- **Link:** No padding, underline in Rule Strong, darkening to ink on hover.
- **Focus:** The global focus ring: 3px plate-yellow outline with a 4px ink underline (GOV.UK convention). Disabled at 45% opacity with a not-allowed cursor.

### Chips (Tags)
- **Style:** 4px radius, 2px by 6px padding, 12px semibold, result colour text on its wash, usually with a 12px check or cross glyph.
- **State:** pass, fail, warn, and a neutral ink-on-wash variant.

### Cards / Containers
- **Corner Style:** Square.
- **Background:** Paper.
- **Shadow Strategy:** None; see The Ink Border Rule.
- **Border:** 2px ink.
- **Internal Padding:** 20px to 32px on the certificate body; 16px by 12px on manual rows.

### Inputs / Fields
- **Style:** The domain input is a number plate: plate fill, UK band, uppercase expanded plate type, placeholder at 55% plate ink.
- **Focus:** The plate keeps its yellow and gains a yellow halo with an ink underline (the focus ring drawn as a shadow on the plate wrapper).
- **Toggle:** 44 by 24px pill with a 2px ink border; fills ink when on, knob slides 20px with the expo ease.

### Navigation
- **Header:** Sticky, white at 95% with blur, 1px rule below. Wordmark in expanded extra-bold beside an ink logo tile carrying the yellow shield. The current host appears as a small plate from 768px.
- **Section tabs:** Sticky row under the header; the active tab is an ink pill with white text that slides between tabs on a spring; inactive tabs are muted, ink on hover. Counts sit in a small tabular badge.

### Number Plate (signature)
The domain is always a UK rear plate: yellow, 2px ink border, 8px radius, inset emboss, blue UK band on the left, uppercase expanded host. Large on the certificate and while testing, small in the header and as clickable examples (which lift 2px on hover). On the certificate the host decrypts into place.

### Verdict Stamp (signature)
A 3px bordered stamp rotated -4deg, word in verdict type. FAIL is fail red, PASS and PASS with minor defects are pass green, REFUSED is muted. A secondary line under the word names the qualifier ("with minor defects", "site could not be tested"). It lands with a blur-and-scale spring while the score counts up; REFUSED shows a dash instead of a score.

### Certificate
A 2px ink panel opened by an ink title band carrying the document name, date, test ID and mode in white. Below: plate, risk summary (first sentence at title weight, the rest at body), policy claims, Re-test and Export actions, and the verdict column with the defect tally (Dangerous, Major, Minor, Advisories, Not reported). The readings grid closes the panel.

### Numbered Ruled Lines
Defects, agent trace steps and the inspection manual are ordered lists where each row carries its sequence number as two-digit, zero-padded, tabular, bold muted figures in a fixed left column. Defect numbers run continuously across categories. Approved defect rows fill with pass wash.

### Defect Categories
Verified findings map severity to MOT categories: high is **Dangerous**, medium is **Major**, low is **Minor**. The verdict is **FAIL** if any Dangerous or Major defect exists, **PASS with minor defects** if only Minor defects exist, **PASS** if none, and **REFUSED** when the site could not be fetched (a clean result would be a false pass). Dangerous and Major headings are fail red; Minor is ink. Verifier-rejected claims are listed separately as "Not reported", struck through in fail red.

## Do's and Don'ts

### Do:
- **Do** show every domain as a number plate, with the UK band and uppercase expanded type.
- **Do** raise objects with a 2px ink border; keep the menu-lift shadow on the export menu only.
- **Do** report results in words first, colour second: Dangerous, Major, Minor; FAIL, PASS, REFUSED.
- **Do** separate list items with 1px rules and close section heads with a 2px ink rule.
- **Do** number ordered rows with two-digit tabular figures when the order is real (defects, trace steps, the inspection manual).
- **Do** set evidence, code and logs in JetBrains Mono, and everything else in Archivo.
- **Do** use the yellow-and-ink focus ring on every focusable element.

### Don't:
- **Don't** use plate yellow for anything except the plate, the focus ring, `::selection` and the logo shield.
- **Don't** build KPI cards, floating tiles or a dashboard grid; readings live in a ruled grid inside the certificate.
- **Don't** add drop shadows, gradients or glows to panels.
- **Don't** use pass green, fail red or warn amber decoratively, or without a word beside them.
- **Don't** show a score for a REFUSED test.
- **Don't** change the white ground.
