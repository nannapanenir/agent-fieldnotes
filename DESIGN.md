---
name: Agent Fieldnotes
description: Understand agents. Build them responsibly.
colors:
  paper: "#EAF0F2"
  paper-raised: "#F2F6F7"
  ink: "#12304A"
  ink-strong: "#0A1E30"
  ink-soft: "#2C4A62"
  muted: "#3F5A70"
  line: "#9DB3C4"
  grid: "#DCE5EA"
  boundary: "#B37A06"
  boundary-tag: "#F2C14E"
  boundary-bg: "#FFF6DC"
  boundary-ink: "#6B4A00"
  code-bg: "#0F2638"
  code-ink: "#E4ECF1"
  footer-ink: "#C9D6E0"
  footer-line: "#2E4F6B"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(40px, 5.4vw, 72px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 120"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 750
    lineHeight: 1.1
    fontVariation: "'wdth' 110"
  headline-article:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.2
    fontVariation: "'wdth' 110"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  lead:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  sheet: "2px"
spacing:
  gutter: "32px"
  gutter-mobile: "20px"
  section: "72px"
  measure: "680px"
  page-max: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.sheet}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "12.5px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-raised}"
  card-start:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "24px"
  card-start-security:
    backgroundColor: "{colors.boundary-bg}"
    textColor: "{colors.ink}"
    padding: "24px"
  sheet-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "18px 20px"
  code-tab-selected:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-ink}"
    padding: "10px 16px"
  code-block:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-ink}"
    typography: "{typography.code}"
    rounded: "{rounded.sheet}"
    padding: "20px"
  boundary-tag:
    backgroundColor: "{colors.boundary-tag}"
    textColor: "{colors.ink}"
    padding: "4px 10px"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
---

# Design System: Agent Fieldnotes

## Overview

**Creative North Star: "The Engineer's Drafting Sheet"**

Every page is a technical drawing on cool paper. Navy ink draws the type, the rules and the frames; a pale blue-grey line does the quiet structural work; and one amber colour marks the edge of what an agent is allowed to touch. The learning path is a set of numbered sheets ("Sheet 3 of 8"), figures carry numbered captions, and diagrams sit on a drafting grid. The look serves the site's argument: security is drawn into the picture from the start, and the boundary is always visible.

The system is flat and precise. There are no shadows, gradients or soft corners. Depth comes from paper tone (paper vs. raised paper), line weight (1px structural, 1.5px emphatic, 2px boundary) and dash style (solid means "exists", dashed means "boundary", "in progress" or "not yet"). Typography does the expressive work: a wide, heavy Archivo for headings against a calm Source Serif 4 reading text.

Reading comes first. Article pages hold a 680px column of serif text with a sticky table of contents. Long code samples sit in dark navy blocks with TypeScript/Python tabs, and diagrams sit in ruled frames.

**Key Characteristics:**
- Navy ink on cool blue-grey paper; a single amber accent reserved for security boundaries.
- Wide, heavy grotesk headings (Archivo, 110–120% width) over a serif reading face.
- Flat surfaces; hierarchy from tone, line weight and dash style.
- Near-square 2px corners everywhere.
- Drafting vocabulary in the copy and the forms: sheets, figures, grids, numbered steps.

## Colors

A restrained navy-and-paper palette where amber has exactly one meaning.

### Primary
- **Drafting Navy** (ink): Headings, body links, rules that carry meaning, the primary button, the footer background and the border of the current nav item. 11.8:1 on paper.
- **Deep Navy** (ink-strong): Hover state for links and the primary button only.

### Secondary
- **Boundary Amber** (boundary): Dashed boundary lines, the focus outline, and the security divider on the homepage. Non-text only (3.2:1 on paper, meets the 3:1 graphics minimum but not text contrast).
- **Boundary Tag Yellow** (boundary-tag): Fill behind boundary labels ("Permission boundary"), and the security link in the navy footer (8.1:1 on navy).
- **Boundary Wash** (boundary-bg): Background of security cards and the "Check" step.
- **Boundary Brown** (boundary-ink): Text on Boundary Wash, and security-coloured text links on paper (7.5:1 on the wash).

### Neutral
- **Cool Paper** (paper): Page background.
- **Raised Paper** (paper-raised): Alternate bands, figure sheets, table headers, inline code, the code-tab bar.
- **Soft Ink** (ink-soft): Lead paragraphs, summaries, blockquotes (8.1:1 on paper).
- **Muted Ink** (muted): Meta text, captions, breadcrumbs, sheet labels (6.3:1 on paper).
- **Rule Blue** (line): Structural borders, table cells, dividers, planned-item dashes. Decorative only (1.9:1); it never carries meaning alone.
- **Grid Blue** (grid): The drafting grid behind figures.
- **Code Navy** (code-bg) and **Code Paper** (code-ink): Code blocks and the selected code tab; syntax colours come from Shiki's `github-dark-high-contrast` palette.
- **Footer Ink** (footer-ink) and **Footer Rule** (footer-line): Secondary text and the divider inside the navy footer.

### Named Rules
**The One Meaning Rule.** Amber means "security boundary" and nothing else. It marks dashed boundary lines, boundary labels, security cards, security links and the focus ring. Never use it for emphasis, warnings, highlights or decoration. This applies to diagrams as well as pages.

**The Ink Carries Meaning Rule.** If a line or border is the only thing communicating a state or a grouping, draw it in ink or amber, never in Rule Blue.

## Typography

**Display Font:** Archivo (variable width and weight, with system-ui fallback)
**Body Font:** Source Serif 4 (with Georgia fallback)
**Label/Mono Font:** JetBrains Mono for code; labels use Archivo

**Character:** A wide, heavy engineering grotesk sets titles like the title block of a drawing; a calm, optical-size serif carries long explanations without fatigue.

### Hierarchy
- **Display** (800, clamp(40px, 5.4vw, 72px), 1.02, 120% width): Page titles: homepage hero, article and learning-path h1.
- **Headline** (750, 36px, 1.1, 110% width): Homepage and learning-path section headings. In articles, h2 is 30px with 1.2 line height (26px under 600px).
- **Title** (700, 20–24px, 1.2–1.3): Card titles, sheet names, stage note titles, article h3 (22px).
- **Lead** (400, 20–21px, 1.55–1.6, Soft Ink): Intro paragraphs and article summaries, max about 34–36em.
- **Body** (400, 19px, 1.75): Article text in a 680px column (about 70 characters). 18px under 600px.
- **Label** (400–700, 13–16px, Archivo): Nav, breadcrumbs, meta lines, sheet labels, table headers (700, 15px), code tabs (600, 14px).
- **Code** (400, 14px, 1.7, JetBrains Mono): Code blocks; inline code at 0.84em with a ruled chip.

### Named Rules
**The Two Voices Rule.** Archivo is the drawing's labelling (headings, navigation, meta, UI). Source Serif 4 is the explanation (body, leads, summaries, captions). Never set running prose in Archivo or UI controls in the serif.

**The Width Is the Weight Rule.** Display headings get their presence from width (`font-stretch` 110–120%) and weight 750–800, not from size beyond 72px or from colour.

## Layout

- **Page frame:** content max 1200px, centred, 32px gutters (20px under 600px). Sections are full-bleed bands separated by a 1px Rule Blue top border, alternating Cool Paper and Raised Paper, with 72px vertical padding (56px on mobile).
- **Article:** a three-column grid at up to 1400px: empty left, a 680px text column, and a sticky table of contents (max 240px) on the right, with a 56px column gap. Under 1040px the table of contents moves above the text in a single column.
- **Cards:** `auto-fit` grids (min 240–280px) that collapse to one column on phones. "Start here" cards share 1px Rule Blue seams inside a 1.5px ink frame instead of separate gaps.
- **Spacing rhythm:** mostly multiples of 4 and 8 (8, 12, 16, 20, 24, 32, 40, 48, 56, 72, 88, 96). Prose paragraphs are 24px apart; h2 gets 56px above it.
- **Breakpoints:** 600px (mobile type and padding) and 1040px (article table of contents). Minimum supported width 320px.

## Elevation & Depth

The system is flat. No element uses `box-shadow`. Depth comes from three things: paper tone (Raised Paper for figures, alternate bands, table headers and the code-tab bar), line weight (1px structural, 1.5px emphasis, 2px boundary), and dash style. The only layered element is the footer profile card, which overlaps by position and z-index with a 1.5px ink border and a drawn arrow, not a shadow.

### Named Rules
**The Line Weight Rule.** Hierarchy is drawn, not lifted. Use 1px Rule Blue for structure, 1.5px ink for emphasis and selection, and 2px for boundaries. Don't add shadows, glows or blur.

**The Dash Means Something Rule.** A solid line means "exists" or "published". A dashed amber line means "security boundary". A dashed ink or Rule Blue line means "in progress", "planned" or "blocked". Never use dashes as decoration.

## Shapes

Corners are nearly square (2px) on buttons, code blocks, inline code and the profile card; cards, sheets, steps and chips are fully square. Boundaries are dashed rectangles with a label tab sitting on the top edge. Arrows are thin 1.5px ink strokes. The only non-rectangular forms are the drawn arrowheads and the triangle on the footer profile card.

## Components

Character: **ruled and exact.** Components are flat, 2px-cornered and outlined in ink. State is shown by line weight, dash style and fill, never by shadow or glow.

### Buttons
- **Shape:** near-square (2px).
- **Primary:** Drafting Navy fill, Cool Paper text, Archivo 600 16px, 14px × 22px padding.
- **Secondary:** transparent with a 1.5px ink border, padding reduced to 12.5px vertically so both buttons are the same height.
- **Hover / Focus:** primary darkens to Deep Navy; secondary fills with Raised Paper. Focus is a 2px Boundary Amber outline with a 3px offset (amber on the navy footer is Boundary Tag Yellow).

### Chips (tool tags)
- **Style:** square, 1px Rule Blue border, Cool Paper fill, 14px Archivo.
- **State:** a blocked tool uses a dashed border, no fill, Muted Ink text and a strike-through.

### Cards / Containers
- **Corner Style:** square.
- **Background:** Cool Paper; security cards use Boundary Wash with Boundary Brown labels.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1.5px ink for published items; 1.5px dashed ink for in progress; 1px dashed Rule Blue for planned.
- **Internal Padding:** 18–24px.
- **Hover:** the title underlines (4px offset); the card itself doesn't move or change colour.

### Navigation
- **Header:** site name in Archivo 750 20px at 115% width; links in Archivo 16px with 28px gaps. Hover underlines with a 6px offset. The current page is bold with a 2px ink bottom border.
- **Footer:** a full navy band with link columns in Archivo 15px; the Security link is Boundary Tag Yellow. A Footer Rule divider separates the note row.
- **Table of contents:** a 1.5px Rule Blue left rail; the current section gets a 3px ink marker and bold text; security sections use Boundary Brown.
- **Breadcrumbs:** Muted Ink, underlined, separated by slashes.

### Code Tabs (signature)
A TypeScript/Python pair becomes tabs: a Raised Paper bar with a 1px ink frame (no bottom border). The selected tab fills with Code Navy so it joins the code block below. Without JavaScript, each block is labelled by a pseudo-element heading.

### Figure Sheet and Boundary (signature)
A Raised Paper sheet with a 24px Grid Blue drafting grid and a 1px Rule Blue frame. Inside, a 2px dashed amber rectangle is the permission boundary, labelled by a Boundary Tag Yellow tab on its top edge. Numbered step boxes have 1.5px ink borders; the "Check" step is the one amber box. A numbered serif caption sits below ("Figure 1. …").

### Learning-Path Sheet Card (signature)
A card labelled "Sheet N of 8, <status>" in 13px Muted Ink above a 20px title. Its border style shows the status (see Cards).

## Do's and Don'ts

### Do:
- **Do** use every colour through its `--af-*` custom property in `src/styles/tokens.css`; never hard-code hex values in components.
- **Do** keep article text at the 680px measure and 19px Source Serif 4 with 1.75 line height.
- **Do** draw every new diagram in the site palette: Cool Paper or Raised Paper ground, Drafting Navy lines and text, Grid Blue grid, and amber only for boundaries. Number markers so they match the table or steps in the text.
- **Do** give every diagram a text equivalent (a `<title>`/`<desc>`, plus a table or numbered list when the diagram carries steps).
- **Do** keep focus visible with the 2px amber outline, and honour `prefers-reduced-motion`.
- **Do** keep text at WCAG 2.2 AA contrast: use ink, Soft Ink or Muted Ink on paper, and Boundary Brown on Boundary Wash.

### Don't:
- **Don't** use amber for anything except security boundaries (The One Meaning Rule).
- **Don't** add shadows, gradients, glows, blur or rounded corners above 2px.
- **Don't** use Rule Blue or Boundary Amber for text; they fail text contrast.
- **Don't** set body prose in Archivo or headings in the serif.
- **Don't** copy the old diagram palette (near-black olive `#171a16`, off-white `#f0f0e8`, mint `#9ce6db`, lime `#c7f36b`) into new work. See Known Drift.

## Known Drift

All 42 SVG diagrams in `src/assets/diagrams/` use an older dark palette: near-black olive grounds (`#171a16`, `#1d211b`, `#232822`), off-white text (`#f0f0e8`), grey-green lines (`#a4a99f`) and mint/lime accents (`#9ce6db`, `#c7f36b`). None of them use the site's navy, paper or amber, so the amber-means-boundary rule doesn't hold inside them.

Decision (2026-11-18): the site palette is the standard, and amber means "boundary" in diagrams too. The existing 42 diagrams stay as they are for now and will be redrawn in a separate pull request. All new diagrams use the site palette. The `.diagram-frame` rule in `src/styles/global.css` ("Diagrams are drawn on their own dark background") describes the old diagrams and should be updated when they are redrawn.
