# VahanaIQ — Brand Identity & Design System Guide

**Version:** 1.0  
**Domain:** [https://akila-w.github.io/vahanaiq/](https://akila-w.github.io/vahanaiq/)  
**Standard:** CBSL Directions No. 01 of 2026 Compliant  

---

## 1. Brand Philosophy & Origin

**VahanaIQ** bridges Sri Lankan automotive mobility with actuarial financial intelligence:
- **Vahana (වාහන):** Sanskrit & Sinhala for conveyance, mount, vehicle, and physical mobility.
- **IQ:** Actuarial precision, regulatory compliance, and debt-to-income (DTI) discernment.

### Brand Voice
- **Authoritative & Regulatory Grounded:** Transparent calculations directly derived from Central Bank of Sri Lanka (CBSL) Directions. No deceptive balloon payments or hidden balloon tenures.
- **Modern & Dynamic:** Clean, fast, and engineered with responsive ergonomics.
- **Financially Empowering:** Gives Sri Lankan vehicle buyers instant clarity on true monthly commitments and requisite gross/net income thresholds.

---

## 2. Logo System

The identity system introduces three distinct vector logo directions:

### Option 1: The Apex Monogram (Signature / Recommended)
- **Concept:** Aerodynamic faceted dual-chevron forming an architectural **V**, merging bonnet aerodynamics with upward financial trajectory, highlighted by an illuminated teal/cyan IQ precision spark.
- **Files:**
  - Full vector lockup: `assets/icons/logo-full-lockup.svg`
  - Standalone badge: `assets/icons/logo-option-1-apex.svg`
  - Transparent header mark: `assets/icons/logo-option-1-apex-transparent.svg`
- **Application:** App icon, favicon, main header lockup, social media avatars.

### Option 2: The Precision Speedometer Dial
- **Concept:** A 260° calibrated instrument arc with subtle tick marks, an embedded chevron **V**, and an actuarial indicator needle at the 40% optimal DTI mark.
- **File:** `assets/icons/logo-option-2-gauge.svg`
- **Application:** Actuarial reports, technical badges, data dashboards.

### Option 3: The Streamline Horizon
- **Concept:** An automotive fastback roofline silhouette transitioning into converging highway perspective lines.
- **File:** `assets/icons/logo-option-3-streamline.svg`
- **Application:** Hero banners, marketing collaterals, vehicle catalog headers.

### Clear Space & Minimum Sizing
- **Minimum Digital Size:** 16px × 16px (Favicon), 32px × 32px (Header navigation).
- **Small sizes:** the favicon, the header badge and the app icons use the same flat, centred monogram (wings `#2DD4BF` and `#5EEAD4`, spark `#A7F3D0` on the `#0F172A` tile). No gradients or glows, which blur at 16–36px.
- **Clear Space:** Maintain minimum clear space equal to 50% of the logo's height on all four sides.
- **Safari / WebKit Full-Bleed Tile Rule:** Favicon and touch-icon assets use a 100% full-bleed square background (no pre-rounded `rx` corners). Perimeter pixels maintain `alpha = 1.0` to short-circuit Safari's dark-mode contrast heuristic and prevent unwanted white boxes, allowing the OS to apply native squircle masks cleanly.
- **Unacceptable Usage:** Do not distort proportions, apply drop-shadows with opacity > 25%, or place against low-contrast busy photographic backgrounds without an underlay plate.

---

## 3. Colour System

Every colour below is a design token in [`design-system/tokens.json`](../design-system/tokens.json). Section 5 explains how it reaches the app. Contrast figures are WCAG 2 ratios measured against the token values.

### Palette A: "Forest Ink, Warm Bone & Ceylon Emerald" (Editorial)
Designed to convey financial health, Sri Lankan heritage, and warm editorial clarity matching the vehicle catalogue.

| Token | CSS Variable | Light | Dark | Role | Contrast |
|---|---|---|---|---|---|
| **Primary Forest** | `--accent` | `#103E36` | `#5EEAD4` | Brand core, primary actions, active tabs | 11.9:1 with white (light), 11.0:1 on panel (dark) |
| **Bright Interaction** | `--accent-bright` | `#168265` | `#5EEAD4` | Focus rings, hover states | 4.8:1 on panel (light) |
| **Forest Ink** | `--ink` | `#142A25` | `#E8F0EA` | Primary text | 15.1:1 on panel (light), 14.0:1 on panel (dark) |
| **Sage Mute** | `--mute` | `#586B62` | `#9BB0A5` | Labels, hints, captions, table headers | 5.7:1 on panel (light), 7.1:1 (dark) |
| **Pure White** | `--panel` | `#FFFFFF` | `#152320` | Card and panel surface | Surface |
| **Warm Bone** | `--bg` | `#F5F6F3` | `#0E1A16` | Page background, dialog ground | Surface |
| **Hairline Rule** | `--line` | `#DCE3DB` | `#253730` | Dividers, card and table borders | Decorative (1.25:1) |
| **Control Border** | `--control-border` | `#86968C` | `#5C7469` | Accessible 3:1+ edges of inputs, selects, outline buttons | 3.11:1 on panel (light), 3.2:1 (dark) |
| **On Accent** | `--on-accent` | `#FFFFFF` | `#0E1A16` | Text on an `--accent` fill | 11.9:1 / 11.0:1 |
| **Chip Fill** | `--chip` | `#F3F5F0` | `#1A2C26` | Fill of specs pills, category and status tags | Surface |
| **Chip Ink** | `--chip-ink` | `#142A25` | `#E8F0EA` | Text colour of specs pills and metadata chips | 14.2:1 on chip |
| **Brand Badge Fill** | `--badge-bg` | `#E5EBE2` | `#163B33` | Fill of the CBSL 2026 badge and theme switcher | Surface |
| **Brand Badge Ink** | `--badge-ink` | `#103E36` | `#99F6E4` | Text of the CBSL 2026 brand badge | 7.9:1 on badge-bg |

Fixed tints (`--callout-info-bg`, `--badge-official-bg`, `--badge-grey-bg`, `--ltv-warn-bg`, `--selected-bg`, `--scrim`) are translucent and the same in both themes. The studio plate (`--plate`, `#FFFFFF`) is white in every theme. The `--mark-*` tokens hold the logo colours and are not for UI.

### Actuarial & Affordability Status Tokens
In accordance with CBSL debt-to-income (DTI) ceilings. Status always carries its word as well as its colour.

| Status | Threshold | Bar fill | Text | Meaning |
|---|---|---|---|---|
| **Comfortable** | DTI &le; 40% | `--accent` | `--ok-ink` (`#047857` / `#34D399`) | Rental plus existing payments within the recommended limit. |
| **Stretching** | DTI 41%–50% | `--mid` (`#D97706` / `#FBBF24`) | `--mid-ink` (`#92400E` / `#FBBF24`) | Over 40%, up to the 50% absolute maximum. |
| **Out of reach** | DTI &gt; 50% | `--bad` (`#DC2626` / `#F87171`) | `--bad` | Fails the affordability check. |

`--ok` (`#059669`) and `--mid` are fills only. On a light panel they measure 3.77:1 and 3.19:1, so text uses the `-ink` tokens.

---

## 4. Typography & Numerical Formatting

### Font Stack
```css
font-family: var(--font-sans); /* system-ui, -apple-system, "Segoe UI", Roboto, sans-serif */
```
The product loads no web fonts.

### Scale & Hierarchy
- **Display H1:** `clamp(38px, 4.4vw, 60px)`, Weight 650, Letter spacing `-2.4px`, Line height `1.05`
- **Section H2:** `28px`, Weight 650, Letter spacing `-0.8px`, Line height `1.2`
- **Card H3:** `19px`, Weight 650, Letter spacing `-0.4px`, Line height `1.25`
- **Eyebrow:** `11px`, Weight 700, Letter spacing `2px`, Uppercase, `--accent`
- **Stat values:** `22px`, Weight 650, Letter spacing `-0.7px`, `--accent`, tabular figures
- **Input Labels:** `11px`, Weight 650, Colour `--mute`, Sentence case
- **Body Text:** `15px / 1.55`, Weight 400
- **Hints & Table Headers:** `12px / 11px`. Headers are Weight 700, Uppercase, letter spacing `1.2px` in `--mute`
- **Brand Badge:** `0.75rem` (12px), Weight 700, Letter spacing `+0.04em`, Uppercase

### Sri Lankan Currency Standards (LKR)
1. **Currency Prefix:** Use `Rs.` followed by a space in the interface. Catalogue prices and tabular exports use ISO `LKR`, or `From LKR` for a starting price.
2. **Thousands Separator:** Comma grouping (e.g., `Rs. 18,500,000.00`).
3. **Tabular Figures:** Always apply `font-variant-numeric: tabular-nums` to financial amounts, rental values, interest rates, and loan tenures to maintain neat vertical column alignment.
4. **Decimals:** Show rupee amounts with two decimal places (`Rs. 0.00`). Saved and shared values keep the decimals the buyer entered.

---

## Capitalisation
- **Title Case** for headings (sections, dialogs, cards, column headers) and for buttons, tabs and link buttons: capitalise each word except *a, an, the, and, but, or, nor, for, of, in, on, at, to, by, with, as, per, vs*, unless it is the first or last word ("Add a Vehicle", "Search with AI", "Loan Terms and Your Income").
- **Sentence case** for field labels, hints, messages, toasts and body text ("Interest rate (% a year)"). Links inside a sentence follow the sentence.

## 5. UI Components & Dark Mode Integration

### Design Tokens
[`design-system/tokens.json`](../design-system/tokens.json) is the single source for colours, shadows, spacing, radii, sizes, opacity, timings, layers and the font stack. `scripts/build-tokens.mjs` writes them to `css/tokens.css` as CSS custom properties. `index.html` loads that file before `css/style.css`, which only reads the variables.

```bash
node scripts/build-tokens.mjs           # after editing tokens.json
node scripts/build-tokens.mjs --check   # fails if css/tokens.css is out of date
```

Padding, margins and gaps use the spacing scale (`--space-2` to `--space-40`). The few off-scale values (1px, 5px, 7px, 11px, 72px) stay as written.

Disabled buttons (`.btn`, `.btn-outline`) drop to `--opacity-disabled` (0.6), show a not-allowed cursor and skip their hover change.

Motion uses `--duration-fast` (0.15s: modal fade, discovery hover), `--duration-base` (0.2s: toast) and `--duration-spin` (0.8s: spinner), eased with `--easing-standard`. `prefers-reduced-motion: reduce` switches all of it off.

The print quotation's own colours are Print-theme tokens too: `--print-head-ink` for table headers, `--print-rule` for row dividers and `--print-field-bg` for inputs. The brand badge and rental-bar track take their Print values of `--badge-bg`, `--badge-ink` and `--bar`.

Markup carries no inline styles. Every element is styled by a class in `css/style.css`, so a token change reaches it. The only exceptions are values computed at runtime: a rental bar's width and the position of its affordability tick.

`test/tokens.test.mjs` (run in CI) fails if `css/tokens.css` is stale, if `css/style.css` declares its own custom properties, if it reads a variable the tokens don't define, or if `index.html` or `js/` adds an inline style.

The generated themes:
- **Light** is the default on `:root`.
- **Dark** applies under `prefers-color-scheme: dark` unless the theme switch set `data-theme="light"`, and always under `data-theme="dark"`. The switch offers System (no `data-theme`, so the page follows the device live), Light and Dark.
- **Print** applies under `@media print` whatever the toggle says, giving a white A4 bank quotation.

A token without a dark or print value keeps its light value.

### Studio Vehicle Plate Standards
In keeping with the HTML5 Canvas Studio normaliser:
- Vehicle assets are staged on pure white (`#FFFFFF`) 8:5 aspect ratio plates with subtle contact shadows.
- In Dark Mode, cards maintain a crisp 1px border (`#1E293B`) to frame the white studio plate with high visual contrast.
