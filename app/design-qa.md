# Selected Project briefing — design QA

Date: 28 October 2026. Scope: first local increment, not complete-ERP acceptance.

final result: passed

## Comparison target and evidence

- Source visual truth: `../docs/design/directions/02-project-briefing-refined.png` (1487 × 1058 pixels), selected from display choice 2 and refined for clearer categories.
- Local implementation: `http://127.0.0.1:4173/#section=Projects&area=Overview`, JAKH Contracting LLC / Harbour Tower / sample manager Ahmed; sample request PR-0264 awaiting independent review; light theme.
- Screenshot: `../docs/validation/local-increment-1/overview-desktop.png`.
- Desktop CSS viewport: **1440 × 1024**. The browser retained the user's existing 130% zoom; the capture surface was set to 1872 × 1332 to obtain this CSS size. Device scale was not changed for the final captures.
- Native screenshot canvas: 1440 × 1025 pixels. The browser compositor placed the complete uniformly scaled viewport in its upper-left 1108 × 788 content region, with blank right/bottom padding. Normalisation cropped only that padding and rescaled the content to 1440 × 1024. The reference was resized to the same dimensions. No UI content was removed or rearranged. This extra scaling softens text in stored screenshots; it is not a source font blur.
- Full comparison, inspected side by side: `../docs/validation/local-increment-1/comparison-final.png` (2880 × 1060 with labels).
- Focused decision/table comparison, inspected side by side: `../docs/validation/local-increment-1/comparison-detail.png` (2320 × 550). This was required to judge row labels, ownership, currency and typography beyond the reduced full-frame comparison.
- Responsive evidence: `overview-tablet.png` (1024 × 767 CSS), `overview-mobile.png` and `site-mobile.png` (390 × 844 CSS) in that same folder. These captures had the same compositor padding and were normalised uniformly. Mobile is a responsive adaptation; there was no separate selected mobile reference.
- Desktop document width equalled viewport width (1440); tablet 1024; mobile 390. No horizontal page overflow. Desktop document height was 1032, with a small ordinary vertical scroll. Mobile project areas scroll horizontally within their own navigation strip; the page itself does not.

## Findings and comparison history

### Pass 1 — blocked pending fixes

Evidence: `../docs/validation/local-increment-1/comparison-before.png`, plus mobile/keyboard browser inspection.

1. **[P2] Work table typography and vertical rhythm.** The first implementation made row labels/IDs harder to scan than the selected reference and pushed cost/footer content too low. Increased work-table body/status/ID sizes to 15/14/13px, reduced excess cell padding and tightened header/section spacing. The final focused comparison shows readable titles and stable columns without overlap.
2. **[P2] Search disappeared on mobile.** Hiding the search control removed a core find route. The narrow header now shows company selection and search on separate rows. Post-fix `overview-mobile.png` verifies both controls.
3. **[P2] Mobile work rows obscured context.** Desktop table columns did not fit usefully on a phone. Work rows now stack with visible Location, Owner, Due and Status labels. `site-mobile.png` verifies the populated layout, with no page overflow.
4. **[P2] Modal close did not restore keyboard focus.** Escape closed a record but left focus at the document. Added explicit opener capture/restoration and controlled native-dialog cancellation. Reopened NCR-018 and pressed Escape: the dialog closed and focus returned to the “Verify concrete finish / NCR-018” button. The focused outline is visible in `site-mobile.png`.

### Pass 2 — passed

Captured the revised app at the same desktop company/project/state, inspected the full combined comparison and focused decision/table regions, then reviewed tablet and mobile captures. No actionable P0/P1/P2 visual or core-interaction issues remain within the implemented scope. This is a design implementation gate, not evidence that all ERP requirements or release gates have passed.

## Required fidelity surfaces

| Surface | Assessment |
| --- | --- |
| Fonts and typography | Georgia preserves the serif project/section hierarchy; self-hosted Inter supplies legible UI text. These are close available substitutes, not claims of exact generated-image typeface identity. Body rows use 15px, secondary IDs 13px, status 14px. Headings wrap without overlap. Source mock text is somewhat larger/looser; final implementation retains clear hierarchy with operational detail. Minor font-shape differences are acceptable here. |
| Spacing and layout rhythm | Slim navy rail, persistent company/search header, project context, stable seven-area navigation, one decision surface, flat site rows and three financial columns match the selected composition. Fine dividers and restrained radii avoid nested card clutter. Phone fields stack; tablet decision values wrap intentionally. |
| Colours and tokens | Navy rail, warm white canvas, subdued grey labels and copper actions preserve the reference. Status is communicated in text as well as colour. Focus has a visible outline. Informal visual contrast review was performed; no full WCAG audit is claimed. |
| Image quality and assets | The selected screen has no photographic/illustrative assets. JAKH ERP is editable text branding and AA is a real text-initial identity treatment, matching the reference's UI anatomy. Standard icons use Phosphor. No invented illustration, rasterised UI, custom SVG art, decorative CSS asset or Odoo asset substitutes were introduced. Screenshot softness comes from documented capture normalisation. |
| Copy and content | Standalone business labels describe purpose. Findings precede the figures; budget, forecast and cash remain distinct. “Review pending” intentionally replaces unsupported “Due today”; a site-needed date is not an approval deadline. Sample mode is visibly labelled. Source details distinguish illustrative opening snapshots from real document evidence. No user instruction text leaks into product copy. |

## Functional checks observed in the browser

- Approved a permitted independent sample request; updated status and event appeared, without creating an order/payment.
- Created a draft, changed EUR vendor to AED vendor, observed a new price/company equivalent, saved and submitted to an independent reviewer. Self-approval was not offered.
- Opened request history, NCR detail, category directories, scoped search and contextual report explanation.
- Switched project/company report scope; company report included six items including overheads. Paginated to rows 5–6 while findings still described the whole six-item population. Exported and inspected a CSV containing the summary before all rows.
- Switched to the USD company and observed its own project and USD report, separate from the AED company.
- Checked mobile menu and company/search visibility; verified modal Escape/focus restoration.
- Inspected browser warning/error logs after the final changes: **no entries**.
- Automated checks: **25 passed**; frontend production build passed. These supplement rather than replace browser evidence.

## Open questions and residual test gaps

- Representative construction users have not yet completed the study's navigation/task tests. The user selected the design direction, not a measured usability score.
- Other workflow registers are read-only samples and have not passed operational acceptance. Production identity, accounting and security are not complete.
- Full screen-reader, high zoom, long real-world text, offline, accessibility conformance and device-matrix testing remain release work.

## Follow-up polish (P3)

- Refine exact serif/UI font matching if an approved brand typography system becomes available.
- Broaden density and long-label testing with realistic role-specific datasets; preserve progressive disclosure rather than adding dashboard widgets.

## Implementation checklist

- [x] Confirm exact selected/refined image.
- [x] Compare combined full and focused rendered evidence.
- [x] Fix all identified P2 issues and recapture.
- [x] Verify core working interactions, responsive states and console.
- [x] Record intentional differences, scope limits and remaining release tests.
- [x] Keep the local preview running; no remote publish or deployment.

## Follow-up: Builder ERP name and examples (28 October 2026)

The user explicitly replaced the software name with **Builder ERP** and requested examples for every provided feature. This authorised branding/copy change supersedes JAKH ERP text in the historical mock. Legal-company names remain unchanged. The existing composition, type system, colours and seven project areas remain the visual baseline.

Added a quiet Examples launcher beside search, a grouped examples guide with project picker, related-work links and example histories. The guide is optional; it does not add modules to the main navigation. Each of its 24 feature destinations is populated in every supplied project/company scope. Overview offers View all reviews when more than one review is pending.

Evidence: `../docs/validation/examples/builder-overview.png`, `examples-guide.png` and `examples-mobile.png`. Desktop overview capture is 1872 × 1332 pixels; guide capture uses the browser's 1440 × 1025 canvas with content in 1108 × 788, normalised to 1440 × 1024. Mobile CSS viewport was 390 × 844; its native 390 × 844 canvas had content in 300 × 650, normalised to the CSS size. An intermediate browser pinch/pan offset caused clipped captures and inaccurate pointer targets; it was cleared with temporary page-scale emulation. Final native capture and DOM metrics showed the complete mobile dialog (370px wide), no document overflow and readable controls. Browser zoom remained 130%. Intermediate clipped captures are not acceptance evidence.

Browser checks verified the guide route/project switch, the Garden Residences quality register, NCR detail and related drawing, USD company examples, four request stages and returned-request history. Keyboard activation worked on the tested record/related-work controls. Mobile guide navigation opened My Work. The detailed source/permission/persistence checks are in the 30-test suite. This update does not claim full accessibility conformance or completion of the wider ERP.

Follow-up result: passed for the requested branding, content coverage and guide; prior broader release gaps remain.

## 29 October — Company contacts and catalogue

Retained the selected Builder briefing typography, colours and descriptive Home destinations. Added Contacts & catalogue with three purpose-labelled categories and progressive record/history detail; no Odoo icon wall. Terms review shows current versus proposed payment terms, permitted currencies, author, dates and required reason.

Browser verified desktop 1280×900 and mobile 390×844; mobile document width equals viewport with no horizontal overflow. Checked real local catalogue creation, visible rejection of a fractional whole-unit pack, valid pack save, history, company switching and distinct EUR/30-day versus USD/45-day terms. Corrected a React numeric-condition artefact in review and made error feedback visible. Evidence in `../docs/validation/masters/`. Source review remained read-only; no source mutations, permissions, passwords, supplier communications or deployments were performed. Full representative-user and accessibility acceptance remains open.

## 29 October 2026 · NCR workflow

Checked original Home/Company/Project routes, focused case stages and evidence/history, saved case creation, visible missing-evidence feedback, attachment upload, date persistence, containment before cause, restart/search and responsive 1280px/390px layouts. Fixed controlled date-input persistence and removed repeated list filters from the creation form. Broad quality/HSE registers remain separate illustrative records. Backend/HTTP tests exercise independent review, failed verification and reopening.

## 29 October 2026 — General ledger

Checked persistent Accounting destination, project/company report filters and source/reversal navigation; isolated accountant draft creation/edit/submission; 1280 desktop and 390 mobile. Fixed save-navigation loss, same-currency duplicate amounts, report filter layout and scope wording. Browser rejected unbalanced entry, preserved date 27 October, kept saved record open and withheld self-posting. Report/export reconciles three scoped reversal lines and AED 1,280.13 on each side. Both final warning/error logs are empty. Evidence: ../docs/validation/ledger/. This is local subset verification; broader finance and representative-user usability remain open.

## 29 October 2026 — Supplier bills and payable findings

Retained original briefing style, descriptive Home destination and canonical company/project supplier records. Verified isolated receipt selection, supplier EUR currency, explicit accounting FX/tax, persisted due date, draft/save/submission and absence of self-posting/general-ledger access for an AP clerk. Persistent project/company report filtering, source journal navigation and downloaded full CSV reconcile. Corrected mobile table overflow with a labelled local scroll region, made applied report scope explicit and withheld duplicate functional-currency columns in same-currency reports. Mobile width is 390px with no page overflow. Evidence: ../docs/validation/payables/. Full usability/accessibility and wider finance acceptance remain open.

## 29 October 2026 — Supplier payments and bank evidence

Focused canonical register with project/status filters, record next action, cash findings, conditional bank evidence/setup. Browser prepared/submitted a disposable EUR 12.60 allocation (AED 51.95 carrying / AED 52.92 bank), with no author approval action. Report project filter and actual CSV agree at six Harbour rows, AED 657.30 net; USD company stays separate. At 390px the document width is 390px; fields/findings stack and table records remain readable. Scoped project reports omit repeated project columns. Bank statement evidence, match history and entry fields inspected; no browser posting or transfer. 162 tests, build and 62→70 table recovery pass. Evidence in ../docs/validation/payments/. Full domain/source parity and representative-user UX acceptance remain open.
