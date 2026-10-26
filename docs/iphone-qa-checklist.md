# VahanaIQ — iPhone Safari Checklist

**Date:** 26/10/2026 · **Build:** v2.12.0, local working tree on `4402dc3` (v2.11.6 plus the UI/UX changes; see [uiux-improvements.md](uiux-improvements.md))

Use this on a real iPhone before or straight after the release. Three kinds of evidence are kept apart:

- **Automated**: Playwright in WebKit 27.2 (Safari's engine) with iPhone-style emulation. It has no on-screen keyboard, Safari toolbars, native pickers or camera housing.
- **iOS Simulator**: done by hand in Mobile Safari on iOS 27.0 in the Simulator, iPhone 18 Pro (402×874 points), by tapping, swiping, typing on the on-screen keypad and rotating. The Simulator runs real iOS Safari but not on real hardware: touch precision, performance and the hardware keyboard settings can differ.
- **Real iPhone**: not done. The last column is for whoever runs it.

Simulator screenshots are in `qa/2026-10-26-uiux/ios-sim/` (git-ignored). Other iPhone sizes were not tried by hand: a temporary iPhone SE (3rd generation) simulator was created, but its device-access request was not answered, so sizes from 320 to 430px wide are covered by WebKit emulation only.

Before starting, check the footer shows **VahanaIQ v2.12.0**. If it shows v2.11.6, the page is a cached copy: reload, or open it in a private tab.

| # | Area | Steps on the iPhone | Expected | Automated | iOS Simulator | Real iPhone |
|---|---|---|---|---|---|---|
| 1 | First screen | Open the calculator in portrait | Two-row header, compact hero with the 3-figure CBSL strip, section switcher, then the loan terms card; nothing wider than the screen | Pass (width at 320–430px; header 121px) | Pass | ☐ |
| 2 | Loan terms | Tap **Edit**, drag a slider, tap a preset chip and a stepper | Panel opens with a short reveal; slider follows the finger; figures update at once | Pass (44px targets on touch) | Pass | ☐ |
| 3 | Keyboard: income | With the terms open, scroll so **Net Monthly Income** is low on the screen, tap it and type 650000 | The field stays visible above the keyboard while typing; no page zoom; shows 650,000 | Guard pass (simulated resize, both engines); 16px fields pass | **Fixed and passing** (failed before the fix, also on the live site) | ☐ |
| 4 | Keyboard: next field | Use the keyboard's down arrow to move to the next field | The next field is shown above the keyboard; the income formats to 650,000.00 | — | Pass | ☐ |
| 5 | Keyboard: other fields | Tap Already Saved and Income Saved (%) in the savings planner, and a price edit in a comparison card | Each field stays visible; no zoom | 16px fields pass | Pass (planner fields) | ☐ |
| 6 | Section switcher | Tap Terms, Budget, Compare, Save | Smooth scroll to each section; the button for the section in view fills | Pass (`aria-current`) | Pass | ☐ |
| 7 | Add a Vehicle | Tap **Add**, scroll the sheet, search "Toyota", open Filter and Sort | Bottom sheet rises; **the whole sheet scrolls** with its header pinned; whole cards visible | Pass (UX-26 spec) | **Fixed and passing** (results box was a fraction of a card) | ☐ |
| 8 | Add from the sheet | Tap **Choose & Add**, then **Add to Comparison** | A second sheet stacks on top; both close; toast "Added … to your comparison." | Pass (bulk add) | Pass | ☐ |
| 9 | Comparison card | Look at the first card | Every figure inside the card; rental bar visible against the limit mark; Compare · Details · × row of 44px buttons | Pass (no clipping at 320–430px; UX-27 spec) | **Fixed and passing** (bar was 0px) | ☐ |
| 10 | Head-to-head | Pin three vehicles with **Compare**, open Head-to-Head | "At a Glance (LKR)" matrix with Lowest marked; finalist cards swipe sideways | Pass | Not tried | ☐ |
| 11 | Savings planner | Expand the planner, choose a goal vehicle from the menu | Native iOS menu lists the vehicles with prices; months-to-goal and completion date update | — | Pass (90 months, 26 Apr 2034 for LKR 11,700,000 at LKR 130,000 a month) | ☐ |
| 12 | Date picker | Tap the calendar button by Target Date and pick a day | 7-column month grid with 44px days; the chosen date fills the field; focus returns to the button | Pass (7 columns, under 450px tall) | Pass (27-11-2026) | ☐ |
| 13 | Dark and Light | Switch theme with the header switch, then reload | Whole page changes at once; saved choice kept after reload | Pass (144-state audit in both themes) | Pass; the strip behind the status bar keeps the old colour until reload (Safari behaviour, P3) | ☐ |
| 14 | Landscape | Rotate to landscape on the calculator and the catalogue | One-row header; nothing under the camera housing on either side | Header fit pass with simulated insets | **Fixed and passing** (headline was clipped by the camera housing) | ☐ |
| 15 | Catalogue | Open Catalogue, change a filter, scroll the cards | Menus 46px with their own chevron; cards scroll smoothly; no sideways panning | Pass (46px menus; width) | Pass | ☐ |
| 16 | Vehicle dialog | Tap a car photo in the catalogue, in Dark | Dialog opens; **Mark for Review** readable (light text on dark) | Pass (UX-29 spec) | **Fixed and passing** (was pale text on white) | ☐ |
| 17 | Photo Studio | Open Studio, tap an entry in the list | The editor scrolls into view; photo controls 44px | Pass | Pass | ☐ |
| 18 | Studio photo upload | Tap **Add Photos**, choose a picture from Photos | The photo is added to the strip and can be framed | — | Not tried (the Simulator has no personal photos; nothing uploaded) | ☐ |
| 19 | Reduced motion | Settings › Accessibility › Motion › Reduce Motion on; repeat 2, 7, 6 | Nothing slides or fades; state changes are instant | Pass | Not tried | ☐ |
| 20 | Text size | Settings › Display › Text Size at the largest standard size; reload | Text larger, no clipped figures | — | Not tried | ☐ |
| 21 | VoiceOver | Turn VoiceOver on; move through the terms, a comparison card and a dialog | Controls announced with their names; dialogs trap focus and return it | — | Not tried | ☐ |
| 22 | Offline | Load once, turn on Airplane Mode, reload | The calculator still opens (service worker) | — | Not tried | ☐ |

Not covered anywhere yet: Firefox (runs in CI only after a push), Android Chrome on a real device, and iPhone sizes other than 402×874 by hand.
