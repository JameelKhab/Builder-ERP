# Project log

Dates use Asia/Dubai. This log records work and its limits; Git history records the file changes.

## 28 October 2026 - Discovery and study revisions

- User requested an original construction ERP without Odoo application code, prioritising simple navigation and the full tender-to-handover lifecycle.
- User authorised a read-only study of the existing JAKH demo before redesign/coding.
- Initial audit found 42 administrator primary entries, 363 navigation button controls (96 groups and 267 leaves), role-filtered menus and fragmented project context. Controls are not a count of unique functions.
- Follow-up study mapped NCR, assets, cash/payments, subcontracts, item costs, waste, changes, programme/delay, KPIs, records, approvals and transparency. Existence was distinguished from workflow completeness.
- Revision 3 proposed four starting points and seven stable project areas, mapped every primary entry and specified task-based validation. It was a desk review, not a user test.
- Revision 4 added multiple legal companies, vendor-based currencies, project/company/group reporting, summaries derived from report results and contextual AI strategy.
- The current 53-page report was rendered and reviewed. The invented FX and reporting examples were reconciled. The retained source archive contains 189 entries; no Odoo source or supplied credentials were included.

## 28 October 2026 - Builder-ERP repository setup

- User designated `JameelKhab/Builder-ERP` as the project record and instructed that development remain local, with no deployment to jakh.net until local work is complete and deployment is instructed.
- Cloned the repository's initial `main` commit, `d84db1b`, into `/Users/jameelkhabaze/Documents/Codex/Builder-ERP`.
- Added editable requirements, a decision register, repository working instructions and this log.
- Preserved the current study, three previous PDF revisions, navigation inventory, accepted screenshot, source evidence, report validation records and authoring history.
- Adapted the current report generator to repository-relative paths, configurable fonts/output and direct access to the evidence ZIP. Generated output defaults to ignored `.work/`.
- Kept the four navigation starting points unchanged while making company/currency/reporting/AI requirements explicit in the baseline.
- No ERP application implementation, Odoo code import, production configuration, CI deployment workflow or change to the existing site was performed.

### Repository validation

- Rebuilt the report with the repository-relative tools: all 53 pages have identical extracted text and rendered pixels to the reviewed report. All 53 bookmarks were retained.
- Verified preserved artifact checksums, ZIP integrity, local Markdown links and Python source syntax. A targeted secret-pattern scan found no matches; supplied credentials were not copied.
- Temporary rebuilt PDFs and renders are ignored under `.work/`. The original reviewed PDF remains unchanged.

### GitHub sync blocker

The first push was rejected with HTTP 403: the laptop's cached Git authentication identified `jame17291-sys`, which lacks write access to `JameelKhab/Builder-ERP`. The prepared work is committed locally. No credentials were changed and no alternate identity was used. Resume the push after the user signs Git into an authorised account or grants the intended account write access. This is a GitHub permission issue, not a deployment attempt or a failed local validation.

**User direction after that attempt:** "Keep everything committed locally for now." Remote syncing is now deliberately deferred. Do not retry a push merely because authentication changes; wait for the user to resume syncing. Continue local development and local commits under the separate no-deployment boundary.

### Next work within the study-led sequence

1. Resolve the highest-impact entity, role, accounting, location/work-item and programme inputs.
2. Validate labels and task routes with the user/representative staff; select an interface direction before application implementation.
3. Define the original data model, permissions, financial rules and local architecture around those validated workflows.
4. Implement and test locally in coherent workflow increments, recording decisions and meaningful checks here.

The current study is a requirements baseline, not evidence that implementation or user acceptance has already occurred.

## 28 October 2026 - Implementation authorised; initial visual directions

- User instructed: "start building, make sure to build with quality". This authorises implementation; the earlier study-only gate no longer applies. Local-only commits, no remote sync, no deployment, and no Odoo code remain binding.
- Read repository requirements and reviewed the relevant Product Design workflow. It requires three visual concepts and user selection before application scaffolding when no desired visual target has been selected.
- Inspected two previously captured demo screenshots and attached them to three independent image generations as problem/context evidence. No further changes or sign-in to the live demo were made.
- Produced and retained three independent UI concepts, in conversation display order: Clear desk, Project briefing, Work in context. Saved exact prompts and source references under `docs/design/`.
- Visually inspected all three generated results. Reviewed navigation and illustrative arithmetic (EUR 36,000 × 4 = AED 144,000; AED 200,000 − AED 144,000 = AED 56,000; AED 48.6m − AED 48.0m = AED 0.6m). These are mocked examples, not application test results.
- Flagged a generated self-approval identity inconsistency in direction 3 for correction before implementation. Runtime authority, financial controls, accessibility and responsiveness are not proven by the images.
- Next step: resolve the user's visual selection and begin original application implementation with connected workflow tests. No application code or server was created in this design step; the ERP is not complete.

## 28 October 2026 - Choice 2 selected; first working local increment

- User selected choice 2 as the friendliest and requested clearer categories, easy reading/operation and rich information. Generated one refinement of that exact direction before building; retained its image and exact prompt. No new permission gate was added.
- Implemented an original React/Vite frontend and Express/SQLite local service in `app/`. No Odoo code, models or runtime were imported. Four global destinations and seven stable project areas lead through purpose-labelled categories; the overview has Decisions needed, Site & programme, Cost & cash.
- Added a complete local purchase-request draft/edit/reprice/submit/approve/return flow, exact decimal money, vendor quote/currency snapshots, service-enforced company/project scope, independent reviewer routing, approval limits, optimistic revision checks, transactional sourcing allowance and append-only request events.
- Added project/company cost reports with deterministic findings above the data, complete-population calculation, missing-data handling, snapshot/source identifiers, supporting-item views and full CSV export. Contextual Explain findings is deterministic and local; no AI model or external service is connected.
- Added read-only synthetic registers for the wider mapped construction scope. These are navigation/detail examples, not completed operational modules. Preserved every requested capability and its remaining work in `docs/implementation/local-increment-1.md`.
- Initial dependency retrieval failed because of network/certificate gateway restrictions. Installed pinned cached registry packages offline without disabling certificate verification or changing OS trust. Recorded the dependency override and outstanding vulnerability review. No private data or credentials were transmitted.
- Automated verification: **25 tests passed** and frontend build passed. Tests cover arithmetic, company/project isolation, cross-company references, quote derivation, stale data, self-approval, reviewer routing, limits, revisions, allowance transactions, persistence, event integrity, report populations, missing data and exports.
- Browser verification: approved PR-0264; created/repriced/submitted a sample request; checked project/company reporting, pagination/export, scoped search, USD company switch and record detail. Preserved the agent-created test database under ignored `.work/qa/` before opening a fresh synthetic preview. Future user records must remain intact.
- Visual QA compared the selected image and app at the same desktop state. Fixed table readability/spacing, mobile search, labelled mobile work rows and modal focus restoration. Inspected full/focused comparisons and 1440/1024/390 CSS-width layouts. Browser warning/error logs had no entries. `app/design-qa.md` records a passed design implementation gate, not complete ERP acceptance.
- Preview is running on `http://127.0.0.1:4173/`; API is loopback port 4174. Local sample identity is not production authentication. SQLite persists under `.work/data/` and is not included in source Git bundles.
- Saved source, decisions, scope/architecture documentation and visual evidence locally. No GitHub push, hosting handoff, deployment or change to the old demo occurred.
- Next work follows the explicit coverage/sequence document: production foundations locally, end-to-end buying/receipt/finance, then connected construction lifecycles and governed AI. Representative-user validation and release controls remain open.

## 28 October 2026 - Builder ERP name and examples for every provided feature

- User requested more examples, one for each provided feature, and named the software **Builder ERP**. Updated brand, browser title, report heading/download filenames, package identity, local-session names and runtime configuration. Kept JAKH legal-company identities and historical study evidence separate.
- Added a versioned, additive local sample pack with **102 new records**: 78 detailed project register examples (two per category across all three projects), 12 company tender/people/store examples, and 12 purchase requests covering draft/submitted/returned/approved states. Existing cost-report snapshots remain unchanged.
- Added **Examples** beside search. The guide uses authorised workspace data, offers a project picker and routes to all 24 available feature destinations, showing counts and example IDs. Added a visible View all reviews route when multiple reviews are pending.
- Added example histories and named links between related project records; service lookups filter related records through company/project permissions. Most registers remain read-only; synthetic examples are not claimed as operational workflow completion.
- Backed up the existing SQLite database consistently before the sample upgrade. Existing rows and user edits are preserved; installation/restart is idempotent and does not repeat example events. The running local database now contains the pack.
- Validation: **30 tests passed**, including feature coverage, source relationships, scoped access, currency arithmetic, independent history and upgrade preservation. Frontend build passed. Browser verified the guide, Garden Residences quality records, NCR-to-drawing navigation, populated USD purchases, returned-request history, and the mobile guide. Captured evidence and coverage are under `docs/validation/examples/`.
- Detailed map and limitations are in `docs/implementation/examples.md`. No GitHub push, hosting handoff, deployment or old-demo change occurred. Work remains committed locally.

## 28 October 2026 - Full comparison after migration scope correction

- User rejected the shallow functional coverage, clarified that a full proper migration was expected and requested a full comparison without supplying their own missing-feature list. Acknowledged that implementation advanced before the study's required business-rule/data/exception mapping; the UI/sample increment does not satisfy the migration objective.
- Compared current application commit `3d941a0` against the retained source study, navigation and form/report evidence. Reopened the live dashboards for two company scopes and the Marina Gate control report; saved fresh screenshots/accessibility text. Opening the control report generated a report-view record. No business transaction was edited, approved, posted, paid, closed or deleted; not all 267 destinations were revisited live.
- Added `docs/migration/`: a 39-page report, searchable offline register, all 42 primary-area mappings, 267 destination rows, 21 workstream comparisons, 34 proposed data contracts, 18 user-requirement coverage rows, evidence hashes and validation. Each destination has an exact source path, proposed home, actual Builder gap, specific requirement and acceptance example. Every parity acceptance remains NOT RUN; no row is certified as full parity.
- Recorded major missing logic: estimate assemblies/building quantities/pricing/handover; structured projects/WBS/budget revisions and reservations; full procurement and stock; measured client/subcontract certificates and deductions; original accounting/cash reconciliation; schedule, document/NCR/closeout, people/assets, configuration and integration workflows.
- Defined original typed data architecture, per-domain evidence gates, twelve connected acceptance journeys, source-export/mapping requirements, import sequencing, quantity/financial/attachment reconciliation, idempotency, recovery and later cutover boundaries. Preserved all supporting ERP functions and the user's company/currency/report-findings/AI requirements. The initial synthetic-pack upgrade is explicitly distinguished from real migration.
- Validation: exact 42/267/96 inventory counts; unique source paths/IDs; CSV/JSON/HTML agreement; all 18 requirement rows present; hashes verified; 39 PDF pages rendered and visually inspected with detailed spot checks; no clipping or replacement glyphs. Browser checked area/status filtering, exact search, expanded details, empty result/reset and 1280px layout. Final PDF text matches the rendered version. No application code changed, so application tests were not repeated or presented as migration proof.
- Updated requirements, decisions, README and working instructions to make this correction explicit. Kept files and Git commits local; no GitHub push or deployment. The full migration, exact source export schema, many menu-only functional behaviours and representative-user validation remain unfinished, with concrete verification work recorded.

## 28 October 2026 — Permission-dependent Home and access foundation

- User supplied the full comparison PDF and an Odoo launcher screenshot, authorised implementation and requested a fresh JAKH access review with an original Builder appearance. PDF checksum matches the existing comparison. No Odoo source code was used.
- Reopened JAKH Access Presets (27 roles), the detailed Site Engineer preset, and Manage Users → Manage Access for the project-manager demonstration account. Captured source screenshots/text. Observed pricing restrictions, preset scope, company/project selection, reviewed access changes and warnings about menu visibility/native application scope. Cancelled the form without applying changes.
- Built original Home with grouped descriptive destinations, next-work summary, company/project context and permission-aware navigation. Added original shared capability vocabulary, 27 role definitions (23 assignable), additive schema version 2, current server policy, role/record/field restrictions, separate request price/budget access, scoped report/explanation/export data and filtered example/related-record views.
- Added working existing-user access review/editor, account activation status, project/company grants, approval limits, reasons, optimistic versions, transactional before/after audit history and session invalidation. Added administrator-only read-only preview and logout. Identity remains the explicit server-selected local sample; production identity/account provisioning is not implemented.
- Backed up SQLite through its backup API before migration. Existing user work and synthetic records were preserved. Access write tests used disposable databases; browser QA did not apply a permission grant.
- Verification: **46 automated tests passed** and frontend build passed. Expanded coverage includes role contracts, fail-closed unknown permissions, HR/finance separation, price versus budget projection, mixed-role project scope, invalid grants, audit immutability, current revision/status checks, session revocation and API-enforced read-only preview. Browser checked manager/site-engineer destinations, access scope review, quantity-only request detail, preview exit and responsive layouts. Additional evidence is in `docs/validation/access/`.
- `docs/implementation/access-and-destinations.md` maps implemented changes and remaining acceptance work to comparison IDs. Full migration and role-by-role source equivalence remain unaccepted. Typed construction/financial workflows and production data migration still require the comparison's original services and connected acceptance journeys. No GitHub push, deployment or old-demo change occurred.

## 29 October 2026 — Connected procurement and material cost

- User directed completion of the entire comparison scope on the local Mac. Kept the full ERP goal active; no reduction of scope or claim that a sample register completes a function. Added a current implementation overlay preserving all 267 functions, 34 data contracts and 21 domains; historical comparison remains unchanged.
- Re-read the comparison's procurement/WBS/store contracts and retained source UI evidence 19, 21, 22 and 25. Defined original fields, states, quantity/FX/approval/budget/stock rules and conservative exceptions before implementation. These observations do not establish tested source enforcement. No Odoo application code or source export was used.
- Added schema 3, typed product/UOM, location hierarchy, WBS references, multi-line unpriced material requests, immutable product-specific supplier quotes, balanced split allocations, independent approval, vendor/currency orders, accepted/rejected partial receipts, supplier returns, consumed-stock cost and append-only movement/cost/history evidence. Unified sourcing capacity between earlier requests and new allocations/orders.
- Added one connected request/order interface with clear next steps, progressive pricing/history, vendor-derived currency, current role controls, company/project scope, My Work/search integration and cost-source links. Mobile tables become labelled records so outstanding quantities remain visible. Added deterministic procurement findings and separate local-transaction findings to cost reports; forecasts and cash remain separate.
- Added three typed request examples per project and four issued example orders with delivery, return and consumption history. Installation is transactional/idempotent and does not rewrite existing user records or opening balances. Example transaction additions are explicit in reports.
- Backed up the local SQLite database consistently to ignored `.work/data/builder-before-procurement-20261029.sqlite` before migration; integrity check passed and the 13 earlier requests were retained. Local browser verification created MR-839E0650 and left its fictional AED 1,000 sourcing plan awaiting independent review. It survived server restart. No access grants, real supplier communications or existing JAKH transactions were changed.
- Browser checked desktop/mobile and engineer redaction, caught and fixed controlled date-input persistence, heading positioning and narrow-screen quantity presentation. Browser error/warning log was empty at the final inspection. Validation evidence and exact limitations are in `docs/implementation/procurement-local.md` and `docs/validation/procurement/`.
- Procurement is a tested operational subset, not full purchasing/stock/accounting or migration parity. Identity/provisioning, master data, WBS/budget revisions, full accounting/cash/bill matching, remaining construction/people/assets/configuration/report/AI workflows and real import/reconciliation remain open in the coverage register. Local commits only; no push or deployment.

Final checkpoint verification: **65 tests passed**, frontend build and `git diff --check` passed. Backup/recovery comparison matched all eight checked transaction/history tables and passed integrity/foreign-key checks. See `docs/validation/procurement/verification.md`.

## 29 October 2026 — Company/project structure and budget control

- Continued the complete local ERP objective. Revisited the read-only JAKH budget revision form, captured proposed budget/WBS/date/reason/state/approver fields and its immutable-fact/cost-exposure rule. Discarded the unsaved form. Retained project/WBS/forecast evidence informed the original contract; source enforcement remains unverified.
- Added schema 4 and typed company identity, project metadata, cost codes, scoped location/WBS hierarchy, original baseline/revision documents, immutable approval facts and setup audit history. Original budgets, revised budgets and released buying capacity remain separate. Groups roll up children and cannot be procured or counted twice. New budgets remain unknown before baseline approval.
- Added company/project/setup and budget screens, parent-first locations, separate budget approval limits, independent reviewer controls, stale-budget and live-exposure checks, author return/refresh/cancel, source links, search and My Work entries. New company creation grants no business access. A manager must have existing scope; account/access administration remains separate. Existing users receive no new budget limit automatically.
- Added three budget examples per supplied project, a separate fictional budget reviewer and previously blank synthetic project metadata. The pack is atomic/idempotent and preserves transaction work and financial openings. It adds a controlled AED/USD 1,000 release to each relevant opening allowance without changing original or revised budget totals.
- Browser saved draft BUD-5A9E8AED version 2 (fictional AED 22,000 proposed change, still unapproved) and created Harbour floor A-L13. Checked desktop/mobile layout, hierarchy order, persistence after restart and engineer redaction. No browser permission change, external supplier communication, JAKH mutation, GitHub push or deployment occurred.
- Verification: 79 tests passed, frontend build passed, diff whitespace check passed. Full HTTP journey creates a project/work item, independently approves its baseline, sources and independently approves demand, issues a local order and reconciles unchanged original budget/cash with the new commitment. Backup/restore drill matched 17 tables and passed integrity/foreign-key checks. Evidence and limits: `docs/validation/foundations/` and `docs/implementation/foundations-local.md`.
- Updated all relevant implementation coverage rows while retaining 267 functions, 34 contracts and 21 domains with parity unverified. Company periods/tax/numbering, authenticated multi-user identity, masters, detailed estimating/budget build-ups, dated forecasts, full accounting/commercial/site/support workflows, reporting/AI and real migration remain open. Full ERP goal stays active.
