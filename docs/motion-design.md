# VahanaIQ Motion Design

**Date:** 26/10/2026 · **Applies to:** `index.html`, `catalogue.html`, `studio.html`, the information pages

Motion in VahanaIQ explains a change; it never decorates a financial figure. The rules below are what the code does today. Tokens live in [`design-system/tokens.json`](../design-system/tokens.json) and reach the stylesheets through `css/tokens.css`.

## Principles

1. **Figures are final at once.** A recalculated rental, deposit, DTI or total is written in full in the same frame as the input change. Numbers never count up or down, and no intermediate value is ever shown. Only graphics move, and only from their previous value to the new one.
2. **No springs on money.** Value changes use a decelerating curve with no overshoot (`--easing-out`), so a bar or needle never passes the true value.
3. **Short.** Nothing interactive waits for an animation: inputs, buttons and dialogs are usable from the first frame.
4. **Compositor first.** Entrances, dialogs and press feedback animate `transform` and `opacity`. The only width animations are the small rental, cashflow and LTV bars, whose boxes are absolutely positioned or a few flex items.
5. **Reduced motion is complete.** Under `prefers-reduced-motion: reduce` nothing moves; state changes (open, closed, selected, updated) stay instant and every piece of information is the same.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 0.1s | Press feedback (scale 0.97 while held) |
| `--duration-fast` | 0.15s | Hover, colour and border changes |
| `--duration-base` | 0.2s | Exits: dialog panel, scrim, toast |
| `--duration-moderate` | 0.26s | Drawers, chips, trays, section indicator |
| `--duration-slow` | 0.32s | Dialogs and phone bottom sheets entering |
| `--duration-chart` | 0.45s | Gauge needle and bars easing to a new value |
| `--duration-enter` | 0.42s | One-time entrance of panels and catalogue cards |
| `--duration-spin` | 0.8s | Spinner (linear) |
| `--easing-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances and value changes |
| `--easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `--easing-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Between two resting states |
| `--easing-standard` | `ease` | Colour changes |

`js/app.js` drives the needle, bar and tint animations with the Web Animations API and uses the same values as literals (450ms and `cubic-bezier(0.16, 1, 0.3, 1)`), with a comment pointing here; keep the two in step when a token changes.

## Inventory

| Animation | Component | Trigger | Duration | Easing | Behaviour | Accessibility | Reduced-motion fallback | Performance |
|---|---|---|---|---|---|---|---|---|
| Panel entrance | Calculator hero figures and the four panels | First paint only | 0.42s, 40–180ms stagger | out | Opacity 0→1, rise 10px; fill `backwards`, so nothing lingers after it ends | The headline (the LCP element) is not animated; content is interactive throughout | None | Transform/opacity only |
| Card entrance | Catalogue result cards | First load of the catalogue (filtering and paging do not replay it) | 0.42s, 0–150ms stagger | out | Opacity and 8px rise | Cards are focusable from the first frame | None | Transform/opacity |
| Dialog rise | `.modal` panels (catalogue, lease details, head-to-head, AI search, account, share, credits) | Open / close | 0.32s in, 0.2s out | out / in | Panel rises 12px from 98.5% scale while the scrim fades; reverses on close | Focus moves on open and returns to the opener on close as before (`js/modal.js`); rapid open/close is safe because CSS transitions reverse in place | Panel appears and disappears with the scrim, no movement | Transform/opacity |
| Bottom sheet | The same dialogs at ≤640px | Open / close | 0.32s in, 0.2s out | out / in | Slides up from the bottom edge; rounded top corners; height capped at 92dvh; padding clears the home indicator | As above | Appears in place | Transform |
| Native dialog rise | `<dialog>` (catalogue details, Source Guide) | Open | 0.32s | out | Opacity and 12px rise; the backdrop fades in | Native focus handling unchanged | None | Transform/opacity |
| Drawer reveal | Optional costs, LTV structure, savings planner, filters, saved goals, calculation basis, phone "Edit" terms | Becomes visible | 0.26s | out | Opacity and 8px drop | `aria-expanded` is unchanged and set at once | None | Transform/opacity |
| Tray reveal | Head-to-head tray | First finalist pinned | 0.26s | out | As drawer reveal | Region label unchanged | None | Transform/opacity |
| Gauge needle | Budget dial | Any change to DTI | 0.45s | out | The `rotate()` attribute is set to the final angle immediately (tests and assistive tech read it); an inner group eases from the previous angle about the hub (160, 150) | The DTI text beside it is final at once | Needle jumps to the reading | One SVG group transform |
| Bar easing | Rental bars in the comparison, cashflow spectrum, LTV split | Recalculation | 0.45s | out | New markup is written with the final widths; each bar animates from its previous width (Web Animations API) | Bars carry `role="img"` labels or adjacent text with the exact figures | Bars show the new width at once | Width of small boxes only |
| Figure tint | Price, down payment and rental in each row; DTI, monthly total and cashflow total | Text changes after first render | 0.7s | out | Background fades from `--callout-info-bg` to transparent; the figure itself is final | Change is also announced by the existing `#budgetLive` region; colour is never the only signal | No tint | Background colour only |
| Section indicator | Phone/tablet section switcher | Section scrolls into view | 0.26s | in-out | The current section's button fills with the accent; `aria-current="location"` | Current section exposed to assistive tech | Instant | Colour only |
| Press feedback | Buttons, chips, segments, steppers, section links, row actions, catalogue card actions | `:active` | 0.1s | standard | Scale 0.97; works on touch, not only hover | No information conveyed by motion | None | Transform |
| Card hover | Catalogue cards | Hover (fine pointers only) | 0.26s | out | Lift 2px | — | None | Transform |
| Photo zoom | Catalogue card photo | Hover | 0.32s | out | Scale 1.025 | — | None | Transform |
| Toast | Undo toast | Show / hide | 0.26s in, 0.2s out | out / in | Slides up from below | `role="status"`, paused on hover/focus as before | Appears in place | Transform |
| Page exit | Internal page links on every page (the catalogue and Studio use the same handler) | Click | 140ms | ease-in | Fades `main` out before navigating. Skipped entirely where the browser cross-fades documents itself (`@view-transition`), and under reduced motion | Link behaviour unchanged | Navigates immediately | Opacity/transform |
| Section scroll | Calculator section switcher (Terms, Budget, Compare, Save) | Click | Browser smooth scroll | — | Scrolls to the section and moves focus to it | Focus moves without a second scroll (`preventScroll`) | Jumps to the section | Scroll only |
| Spinner | AI search | Request in flight | 0.8s loop | linear | Unchanged | Paired with a status message | Stopped | Transform |

## Removed or changed from v2.11.6

- The needle's CSS `transition: transform 0.4s` interpolated the SVG matrix, so the needle drifted off the hub mid-move. It is replaced by the hub-centred inner rotation above.
- Internal navigation always waited 180ms (the catalogue and Studio had their own fixed 180ms delay); every page now waits 140ms only in browsers without native cross-document view transitions, and never under reduced motion.
- The section switcher's smooth scroll is instant under reduced motion.
- Hard-coded `.12s`, `.15s`, `.28s` and `.35s` timings in the new catalogue rules use the tokens; older rules keep their literal values until they are next touched.

## Checking it

- `test/browser/ui-responsive.spec.mjs` asserts that no animation runs under reduced motion and that the needle's attribute holds the final reading immediately.
- The phone bottom sheets and dialogs were also checked by hand in iOS Safari (iOS 27 Simulator): they rise into place, stack correctly when one opens another, and close back to the page.
- The QA evidence in `qa/2026-10-26-uiux/` (git-ignored) includes `behaviour.log` with timings for the dialog transition and rapid open/close.
