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
- **Clear Space:** Maintain minimum clear space equal to 50% of the logo's height on all four sides.
- **Safari / WebKit Full-Bleed Tile Rule:** Favicon and touch-icon assets use a 100% full-bleed square background (no pre-rounded `rx` corners). Perimeter pixels maintain `alpha = 1.0` to short-circuit Safari's dark-mode contrast heuristic and prevent unwanted white boxes, allowing the OS to apply native squircle masks cleanly.
- **Unacceptable Usage:** Do not distort proportions, apply drop-shadows with opacity > 25%, or place against low-contrast busy photographic backgrounds without an underlay plate.

---

## 3. Colour System

### Palette A: "Ceylon Emerald & Midnight Slate" (Signature)
Designed to convey financial health, Sri Lankan heritage, and executive stability.

| Token | CSS Variable | Hex | Role | Contrast vs White | Contrast vs Dark |
|---|---|---|---|---|---|
| **Primary Emerald** | `--accent` | `#0F766E` | Brand core, primary actions, links | 4.8:1 (AA) | 6.2:1 (AAA) |
| **Electric Mint** | `--accent-bright` | `#2DD4BF` | IQ spark, active states, highlights | 1.4:1 (UI only) | 11.2:1 (AAA) |
| **Midnight Slate** | `--ink` (Dark: `--bg`) | `#0F172A` | Deep text (Light) / Dark surface | 15.8:1 (AAA) | Surface |
| **Alabaster White** | `--panel` | `#FFFFFF` | Card surface & clean studio plates | Surface | 15.8:1 (AAA) |
| **Border Slate** | `--line` | `#E2E8F0` | Structural dividers & input borders | 1.3:1 (Border) | 8.9:1 |

### Actuarial & Affordability Status Tokens
In accordance with CBSL debt-to-income (DTI) ceilings:

| Status | Threshold | Hex | Variable | Meaning |
|---|---|---|---|---|
| **Comfortable** | DTI &le; 40% | `#059669` | `--ok` | Sustainable rental within recommended disposable income. |
| **Statutory Limit** | DTI 41%–50% | `#D97706` | `--mid` | Approaching statutory ceiling under CBSL Direction No. 01. |
| **Exceeded** | DTI &gt; 50% | `#DC2626` | `--bad` | Fails affordability check under CBSL statutory caps. |

---

## 4. Typography & Numerical Formatting

### Font Stack
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
```

### Scale & Hierarchy
- **Header H1:** `1.8rem` (28.8px), Weight 800, Letter spacing `-0.02em`
- **Section H2:** `1.2rem` (19.2px), Weight 700, Letter spacing `-0.01em`
- **Body Text:** `15px / 1.5`, Weight 400
- **Input Labels & Subtext:** `13px`, Weight 600, Color `--mute` (`#64748B`)
- **Badges & Tags:** `11px`, Weight 700, Letter spacing `+0.04em`, Uppercase

### Sri Lankan Currency Standards (LKR)
1. **Currency Prefix:** Use standard `Rs.` with non-breaking space (or ISO `LKR` in tabular exports).
2. **Thousands Separator:** Comma grouping (e.g., `Rs. 18,500,000`).
3. **Tabular Figures:** Always apply `font-variant-numeric: tabular-nums` to financial amounts, rental values, interest rates, and loan tenures to maintain neat vertical column alignment.
4. **Rounding Policy:** Show integer rupee amounts for monthly lease rentals and loan totals; avoid fractional cents.

---

## 5. UI Components & Dark Mode Integration

### CSS Custom Properties Mapping
```css
:root {
  --bg: #F8FAFC;
  --panel: #FFFFFF;
  --ink: #0F172A;
  --mute: #64748B;
  --line: #E2E8F0;
  --accent: #0F766E;
  --accent-glow: #2DD4BF;
  --ok: #059669;
  --mid: #D97706;
  --bad: #DC2626;
  --bar: #CBD5E1;
}

:root[data-theme="dark"],
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0B1120;
    --panel: #0F172A;
    --ink: #F1F5F9;
    --mute: #94A3B8;
    --line: #1E293B;
    --accent: #2DD4BF;
    --accent-glow: #5EEAD4;
    --ok: #34D399;
    --mid: #FBBF24;
    --bad: #F87171;
    --bar: #334155;
  }
}
```

### Studio Vehicle Plate Standards
In keeping with the HTML5 Canvas Studio normaliser:
- Vehicle assets are staged on pure white (`#FFFFFF`) 8:5 aspect ratio plates with subtle contact shadows.
- In Dark Mode, cards maintain a crisp 1px border (`#1E293B`) to frame the white studio plate with high visual contrast.
