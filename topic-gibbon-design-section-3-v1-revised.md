## 3\. Type and Colour

**Version:** V1, revised canopy & Gibbon composition. This replaces the earlier Section 3 file and its off-white-page specimens. The earlier generated design boards are not implementation references: they changed approved copy, styling and proportions.

**Status:** Implementation baseline for the agreed V1 direction. The supplied PNGs are measured landing-layout specimens, not a completed application or a final Gibbon-artwork approval.

**Scope:** Typography, colour, surfaces, spacing & control appearance across the product. Preserve the overall design direction from Section 1, each screen/state and its behaviour from Section 4, and the exact approved words from Section 5\. Do not redesign the product flow or rewrite the copy to make the layout fit.

### 3.1 Composition Comes First: Protect the Gibbon Area

**Non-negotiable landing rule: reserve the top one-third of the initial landing viewport for the Gibbon. The frosted working panel begins below that area.**

This is one-third of the screen height, not one-third of the document after content makes the page longer. It is a dedicated scene/canvas region, not spare padding above a headline. Do not reduce it to the height of a small logo or place marketing copy, input fields, payment reassurance or information controls inside it.

The landing composition has three layers:

1. **Scene:** A green forest/canopy background covering the landing canvas and continuing behind any vertical overflow.  
2. **Gibbon area:** The reserved upper third, with the Gibbon positioned within the scene according to Section 4\. This area remains present even before its artwork or animation has loaded.  
3. **Working surface:** A horizontally centred, bounded, pale frosted panel below the reserved area, containing the landing copy, form, reassurance & quiet information triggers.

**Other screens:** The Gibbon/working-canvas allocation changes according to Section 4\. Do not apply the landing one-third ratio globally. Do not invent the mapping of later states to a half-screen or any other proportion. Use the actual state definitions.

**Composition dependency:** Apply this visual system to the canopy, Gibbon area & working-canvas arrangement defined in Section 4\. Preserve the reserved Gibbon space and each state's specified proportions. Do not replace the canopy with a solid off-white page or allow landing content into the Gibbon's reserved area. Section 3 supplies appearance, Section 4 supplies screen/state geometry & behaviour, and Section 5 supplies the words. Resolve any discrepancy against the explicit landing rule above and the actual state map; do not silently create a second state map.

**Small-screen rule:** Preserve the upper third even when the content below needs more than the remaining two-thirds. Allow vertical scrolling. Do not force all the content into a fixed-height lower panel, hide content, overlap the Gibbon, or shrink the text to avoid scrolling.

#### Implementation Anchor

Scope the height to the landing state. Use a real layout region before the working panel, not a removable margin, an absolutely positioned caption, or empty space inside the form card.

```css
body[data-screen="landing"] {
  --gibbon-stage-height: calc(100vh / 3);
}

@supports (height: 1svh) {
  body[data-screen="landing"] {
    --gibbon-stage-height: calc(100svh / 3);
  }
}

body[data-screen="landing"] .gibbon-stage {
  height: var(--gibbon-stage-height);
  flex-shrink: 0;
}

/* The working area is the next block in normal document flow.
   Do not translate it upward, use a negative top margin, or overlap
   the reserved stage. Do not use height: 66.667vh with hidden overflow. */

/* Later states must use the actual Section 4 allocation.
   Their values are intentionally not invented in this section. */
```

&nbsp;

The small-viewport unit is the implementation baseline for keeping the initial mobile allocation stable as browser chrome changes. A virtual keyboard must not cause the app to reclaim the Gibbon area or shrink the text. Check actual mobile behaviour during integration.

### 3.2 Core Visual Direction

A clear research workspace inside a green canopy. The scene supplies the setting; a pale frosted surface provides a calm reading area. The headline, input & primary action carry the interface hierarchy.

**Font:** Inter throughout. No second heading font, decorative wordmark typeface or separate button font. Use weights 400, 600 & 700\.

**Sizes:** Display 28–48px responsive · Heading 20px · Body 16px · Small 14px, at the default 16px root size.

**Text:** Fully opaque dark ink. The surface behind the words is frosted, not the letters. Do not blur, fade or render the headline as translucent text.

**Main action:** Solid deep green with solid white text. The working panel is translucent; the primary button is not.

**Errors:** Red paired with explanatory text and the relevant indicator, never used as decoration.

**Restraint:** No added colourful headline words, neon effects, decorative UI gradients, unapproved mascot logos, navigation menus, badges or new marketing claims. The forest is not an instruction to make every interface element green. Do not copy altered wording or promises from earlier generated images.

### 3.3 Named Type Scale

Use exactly these four size tokens. A fluid Display value is still one token, not permission to introduce extra arbitrary sizes.

| Token | Size | Weight | Line Height | Letter Spacing | Use |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Display | `clamp(1.75rem, calc(1.25rem + 2.5vw), 3rem)` | 700 | 1.12 | `-0.03em` | Main headline or the one primary result on a screen |
| Heading | `1.25rem` | 600 | 1.30 | `-0.01em` | Screen sections, explainer title & text wordmark |
| Body | `1rem` | 400; 600 for labels/primary controls | 1.50 | Normal | Description, input, placeholder, explanatory text, input label & primary button |
| Small | `0.875rem` | 400; 600 only where emphasis is needed | 1.50 | Normal | Payment reassurance, metadata & quiet information triggers |

&nbsp;

- Keep body, input & primary-button text at the Body token on phones. Do not reduce them to fit the screen.  
- Use Body/600 for minor subheadings instead of introducing a fifth size.  
- Preserve the exact casing in Section 5\. Do not add uppercase eyebrow labels. Any already-approved uppercase label elsewhere uses Small/600 with `0.04em` tracking.  
- Use Inter for numbers too, with tabular figures where numeric comparison needs alignment.  
- Use relative units and retain the user's root font-size preference.  
- Font stack: `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`.  
- Load the intended Inter weights before judging wrapping. Do not approve a fallback-font screenshot as an Inter check.

### 3.4 Headline Spacing, Line Breaks & Alignment

The approved headline is unchanged:

> Plan your website around what customers search for.

**Normal narrow-phone presentation:**

```
Plan your website
around what
customers search for.
```

&nbsp;

**Wider presentation, when the heading container permits it:**

```
Plan your website around
what customers search for.
```

&nbsp;

Start the change at 40rem viewport width and verify against the actual container. Cap the heading width at 44rem, or 704px at the default root size.

Use one accessible heading with responsive break opportunities after “website” & “what” on phones, and after “around” on wider screens. Do not duplicate mobile/desktop heading content or change its words.

Allow three lines on narrow phones. The two-line example in the chapter must not force smaller type, excessive negative tracking or rewritten copy. With text enlargement or exceptional widths, additional natural wrapping is acceptable.

Use `text-wrap: balance` for other short headings where appropriate. It does not replace the specified editorial breaks in the main headline. Do not balance long paragraphs, inputs, placeholders or primary-button labels.

Do not use fixed headline heights, line clamping, hidden overflow or `white-space: nowrap` to force a screenshot to look right.

**Common central axis:** Centre the working panel, text wordmark, headline, description, form block, reassurance & information group on the same horizontal axis. A narrower form must be centred under the wider heading, not aligned to its left edge. Centre the headline, description & reassurance text. Keep the label, placeholder, typed input & longer explainer paragraphs left-aligned within their centred containers.

### 3.5 Background, Frosted Surface & Colour Roles

| Role | Value | Application |
| :---- | :---- | :---- |
| Scene | Existing green forest/canopy artwork | Full landing canvas, including the Gibbon region and outer gutters |
| Scene fallback | `#102E24` | Forest-coloured backing while artwork is unavailable; not a new primary action colour |
| Frosted working surface | `rgb(247 248 245 / 0.90)` | Pale warm-off-white tint over the canopy |
| Frost blur | `blur(16px)` | Applied behind the working surface, not to its children |
| Solid surface fallback | `#F7F8F5` | Readable panel when blur/transparency is unavailable or reduced |
| Input surface | `#FFFFFF` | Opaque working field, providing a stable text/background pair |
| Primary text | `#1D2723` | Headings, labels, entered text & information triggers |
| Secondary text | `#55605A` | Description, reassurance & supporting information |
| Placeholder | `#68726C` | Example text on the white input; keep opacity at 1 |
| Main action | `#21634A` | Solid fill for “Plan my website” and the main action on later screens |
| Action hover/pressed | `#194D39` | Darker state of the same primary action |
| On action | `#FFFFFF` | Fully opaque primary-button text/icon |
| Control border | `#818A84` | Input boundary and neutral boundaries when needed |
| Neutral selected surface | `#EDF0EB` | Audience-tab selection, with a non-colour selection cue |
| Error | `#B42318` | Error text, indicator & relevant field border |

&nbsp;

`#F7F8F5` is the working surface's tint/fallback, **not the whole page background**.

**Frosting rule:** Put the alpha value on the surface background colour. Never set `opacity: 0.9` on the entire panel; that would also fade its text and controls. Start at 90% tint opacity with 16px backdrop blur. Do not lower the tint opacity without checking contrast against the real canopy, including dark patches or animation frames.

```css
.frosted-panel {
  background: #F7F8F5; /* Solid fallback first. */
}

@supports ((backdrop-filter: blur(16px)) or
           (-webkit-backdrop-filter: blur(16px))) {
  .frosted-panel {
    background: rgb(247 248 245 / 0.90);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
}

.primary-action {
  background: #21634A;
  color: #FFFFFF;
  /* Opaque: do not blend the action into the canopy. */
}
```

&nbsp;

Provide the solid fallback when the effect is unavailable, when transparency is reduced, or if device performance calls for it. The fallback changes the panel treatment, not the Gibbon allocation or screen flow. Use forced-colour system values where applicable.

**Green-on-green separation:** The action sits on the pale frosted panel, not directly on the forest. Keep the button solid. Green is reserved for the primary action among interface controls; green scenery is expected and does not violate that rule.

#### Contrast Baseline

These are colour calculations, not a full accessibility certification. The conservative frosted calculation uses the 90% surface tint composited over black, rather than assuming the canopy is always light.

| Pair | Calculated Contrast |
| :---- | ----: |
| White primary-button text / solid green button | 7.12:1 |
| Dark ink / 90% frost over black | 11.51:1 |
| Secondary text / 90% frost over black | 4.91:1 |
| Placeholder / opaque white input | 4.99:1 |
| Solid green action / 90% frost over black | 5.34:1 |
| Input border / white input interior | 3.56:1 |
| Error text / 90% frost over black | 4.92:1 |

&nbsp;

Check final rendered text, controls, focus & error states against their actual adjacent colours. For this implementation, use at least 4.5:1 for normal text and 3:1 for meaningful non-text control indicators. Do not rely on the blur alone to create contrast. Do not introduce additional fading or blending after checking the palette.

Use a visible 2px ink keyboard-focus outline with a 2px offset on the pale surface. Do not clip it or suppress it. Selected and error states need a text, shape, border or icon cue as well as colour. State meanings remain in Section 4\.

### 3.6 Space, Panel Width & Shape

**Emphasis:** Use weight & contrast before adding size. Keep the headline dominant. Input labels & the primary button use Body/600. The description and quiet information triggers remain regular-weight. Payment reassurance stays readable without competing with the action.

**Spacing scale:** 4, 8, 12, 16, 24, 32, 48 & 64px, using rem equivalents in implementation. The one-third viewport reservation is structural geometry, not an extra spacing token.

| Relationship | Baseline |
| :---- | :---- |
| Outer panel gutter on the narrowest phone, below 375px | 8px |
| Outer panel gutter from 375px | 16px |
| Outer panel gutter from 480px | 24px |
| Minimum outer gutter on desktop | 32px; centred max-width panel creates more where available |
| Maximum landing panel width | 56rem / 896px |
| Maximum headline width | 44rem / 704px |
| Maximum description, form & reassurance width | 35rem / 560px |
| Panel horizontal inset below 375px | 8px |
| Panel horizontal inset from 375px | 16px |
| Panel horizontal inset from 480px | 24px |
| Panel horizontal inset on desktop | 32px |
| Panel vertical padding | 24px; 32px at intermediate wider layouts where space permits |
| Text wordmark to headline | 16px |
| Headline to description | 16px |
| Description to form | 24px |
| Input label to field | 8px |
| Input inner padding | 16px |
| Input to primary action | 16px |
| Action to reassurance | 12px |
| Reassurance to information group | 16px |
| Information label to icon | 4px |
| Information-control gap, one-row layout | 8px |
| Information-control column gap, two-row layout | 16px |
| Explainer inner padding | 24px; 16px when narrow width requires it |

&nbsp;

The 8px outer gutter plus 8px inner inset at 320px is an explicit narrow-screen adjustment to the former flat-page specimen. It retains approximately the same 16px text-edge allowance while introducing a visible frosted panel and preserving the agreed three-line headline. Do not use this as permission to reduce body text or squeeze letter spacing further.

**Corner radius:** One 10px token for the working panel, input, primary button, cards & the exposed corners of the shared explainer. Do not mix large pills, square cards and several different rounding styles. Information triggers have no visible enclosing shape at rest; the same token may be used for their temporary hover/focus hit region.

**Borders:** 1px where a control boundary is required. The frosted panel may have a subtle pale 1px edge. Do not draw boxes around every content block.

**Shadow:** One restrained panel-separation treatment, such as `0 8px 32px rgb(6 25 17 / 0.14)`. Do not add decorative shadows to each control.

**Tap areas:** Primary action minimum height 48px. Information triggers and close control minimum height 44px, with a minimum 44px target width. Invisible padding can provide a usable target without creating a visually large button. Use minimums, not fixed heights that cut off larger text.

**Input example:** Keep the approved placeholder and visible label. The example is not a prefilled answer. Use the Body token, normal style, full opacity and wrapping. Allow the multiline input to grow enough to show the example or entered content; do not truncate it to mimic a single-line search box.

### 3.7 Quiet Information Triggers & Shared Explainer

The labels remain exactly:

**What? · Why? · How? · For me?**

**Appearance:** Regular Small text plus a compact outlined information icon. No persistent enclosing border, filled background, large card, accent colour or underlined navigation-link styling. The main form and primary action must remain more prominent.

Make the whole label-plus-icon area tappable, not just the small icon. Use keyboard-operable button semantics without button-box styling. These controls open an explanation; they do not navigate to another page. The information icon is decorative when the visible label already names the control.

**Layout:** Use one centred row when the available width allows it. On narrow phones, use a centred two-by-two group in this reading order:

```
What? ⓘ      Why? ⓘ
How?  ⓘ      For me? ⓘ
```

&nbsp;

Do not force a single row by reducing font size or target size. Do not use an awkward three-plus-one wrap. In the supplied normal-size specimens, 320px uses two rows, while 390px & 1280px use one row. Reassess against available container width when text is enlarged. A container-width threshold of about 20rem is a tested starting point, not a reason to crop labels.

**Interaction:** Tap/click opens the shared dismissible explainer specified in Section 4\. Preserve its opening, closing, focus and audience-tab behaviour. Do not turn it into a hover-only tooltip. The exact content, including the two audience options and Close label, remains in Section 5\.

**Shared surface:** Use a pale readable working surface, compatible with the main panel. A more opaque or solid `#F7F8F5` surface is acceptable for longer explainer text. Use Heading for the title, Body for paragraphs and neutral audience-tab selection. Do not give the tabs primary-action green fills.

**Implementation note:** Use the Section 5 explainer copy inside the shared explainer sheet defined in Section 4\. The bottom-strip labels are tap/click controls, not page-navigation links. Follow Section 4 for opening, closing & audience-tab behaviour. Do not display the expanded answers as permanent landing-page content.

### 3.8 What the Revised PNGs Show

The landing PNGs are rendered from HTML/CSS, with the approved copy and installed Inter, rather than generated as pictures of text. Their geometry was measured in Chromium.

| Initial Viewport | Gibbon Reservation | Working Panel Starts At | Headline Lines | Information Rows | Full Document Height |
| :---- | ----: | ----: | ----: | ----: | ----: |
| 320 × 800px | 266.66px | y \= 266.66px | 3 | 2 | 1042px |
| 390 × 844px | 281.33px | y \= 281.33px | 3 | 1 | 970px |
| 1280 × 960px | 320px | y \= 320px | 2 | 1 | 960px |

&nbsp;

The panel and narrower form are centred on the same axis in all three specimens. There is no horizontal page overflow in those default-size captures. The two phone specimens require vertical scrolling to retain all the copy and the full Gibbon area.

**Viewport versus full-page PNGs:** A viewport capture shows the initial screen and its exact one-third reservation. A full-page capture additionally shows content below the fold. Do not calculate the Gibbon allocation as a third of that longer exported image.

**Guides versus clean PNGs:** Guide versions show a dimension bracket and a “Gibbon area · reserved” annotation. These are review annotations, not website copy. Clean versions omit them but preserve exactly the same empty region. Remove diagnostic guides from production; never remove the reserved region with them.

**Artwork limitation:** No approved production Gibbon asset was available for this revision, so its region is intentionally reserved rather than filled with a guessed mascot or a small substitute logo. The canopy is an illustrative texture study using text-free foliage from the existing preview. Replace it with the approved scene asset during integration without changing the layout. No new final illustration is being approved here.

### 3.9 Build Checks & Handoff Rules

**Completed in the revised landing specimen:**

- Measured the top-third region and verified that the working panel does not enter it at 320 × 800, 390 × 844 & 1280 × 960\.  
- Verified the panel and form share the horizontal centre of the viewport.  
- Verified actual Inter Regular, SemiBold & Bold rendering; Display measured 28px, 29.75px & 48px respectively. Other text roles remain 14px, 16px & 20px at the default root size.  
- Checked headline breaks, unchanged headline/button text, an empty input with the full approved example, information-row count and absence of horizontal page overflow.  
- Checked root text enlargement to 200% and increased text spacing at all three widths. The specimen retained its Gibbon reservation without horizontal page overflow. This is not a complete zoom, browser or accessibility audit.  
- Checked an illustrative explainer opening, audience-tab switch and close. That smoke check does not establish compliance with the full Section 4 state map.  
- Calculated the colour pairs above, including a conservative dark backdrop under the frosted surface.

**Required when integrated into the actual product:** Inspect the real canopy & Gibbon assets, every Section 4 screen/state allocation, production font loading, mobile keyboard/browser-chrome behaviour, responsive wrapping, longer content, overlay focus & dismissal, contrast over scene/animation variations, text enlargement, text-spacing overrides, reduced-transparency fallback and device performance. Later-state screenshots are not fabricated in this handoff.

**Agent rule:** Keep the approved font family, four named type sizes, spacing system, single radius and Section 5 copy. Preserve the dedicated Gibbon region before fitting the content. Do not use the earlier inaccurate generated boards as copy or layout sources. Any conflict with the actual state map must be surfaced, not silently resolved by deleting the reserved area.

**Implementation references:** These support the CSS/accessibility mechanisms; they do not supply the product's design direction or state definitions.

- [MDN: CSS length units, including small viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)  
- [MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)  
- [W3C: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)  
- [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)