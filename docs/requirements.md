# Builder ERP requirements baseline

This editable baseline accompanies the [53-page Revision 4 study](study/JAKH-ERP-Read-Only-Study.pdf). User requirements and proposals are distinguished in [decisions.md](decisions.md). The live demo was inspected read-only; this document does not assert that every required capability currently exists or is enforced.

## Objective and boundaries

Create an original construction ERP for the journey from tendering to handover, defect obligations and final settlement. Use no Odoo application code. Prioritise simple navigation, clear next actions and rich, source-linked information. Develop locally and sync verified work to JameelKhab/Builder-ERP under the user’s 29 October continuity instruction. Do not deploy to jakh.net or modify the demo.

The user clarified that this means a **full proper migration**, preserving the strong existing JAKH business logic. The first local increment does not meet that scope. The [267-destination comparison](migration/README.md) records the correction: original implementation must preserve functions, data relationships, approved versions, quantities/balances, histories, permissions, reports and exceptions. Simplifying navigation is not permission to reduce business capability. Exact source-export/schema mapping and reconciliation remain unfinished; proposed mappings are not executed migration work.

## Experience requirements

- Product name: **Builder ERP**.
- BOQ workbook intake retains original files and row provenance, requires all-file reconciliation and independent review before modifying a draft, and does not silently discard unsupported caps, shares, formulas or units. See the original intake contract for the current implemented subset.
- Include a meaningful, accessible example for each provided feature, with sufficient detail to explain its use. Populated company/project examples should show different states and related records. Clearly identify read-only examples and unfinished workflows.

- Selected direction uses global navigation: My Work, Tenders, Projects, Company.
- Selected direction uses project areas: Overview, Plan, Site, Buying, Costs & Contracts, Documents, Handover.
- Preserve company/project/location/work-item context across records and handoffs.
- Show current state, owner, next action, due date and material blockers plainly.
- A case evolves through its lifecycle; do not repeat the same tabs and fields in successive modules.
- Put frequent tasks and necessary evidence first; keep named, discoverable sections for rich detail.
- Search by record ID, title, party, floor/unit, asset tag and familiar synonyms, with visible scope and authoritative document revision.
- Provide browse routes as well as search; keep filters and return context.
- Role defaults prioritise work without granting permission or changing the meaning/order of navigation.
- Do not confuse an empty list, access restriction, filtered result, missing allocation, stale data or error with a valid zero.

The user selected Project briefing (choice 2) with clearer categories. The first local increment uses three overview groups: **Decisions needed**, **Site & programme**, **Cost & cash**. Purpose-labelled directories lead to focused records; these replace recursive module browsing. This is an implementation baseline, not proof that every requirement below is complete. See [coverage](implementation/local-increment-1.md).

## Construction lifecycle

1. Opportunity and bid/no-bid: deadlines, qualifications, scope, risk and accountable decisions.
2. Tender and estimate: documents, take-off/BOQ, resource rates, vendor comparison, exclusions, revisions and approvals.
3. Award and mobilisation: accepted contract, work/location structure, budget/programme baseline, authorities and obligations; support direct awards.
4. Design and preparation: current drawings, RFIs, submittals, specifications, methods, ITPs, notices and correspondence.
5. Procurement and subcontracting: demand, sourcing, award, commitment, delivery/measurement, amendments, deductions and settlement.
6. Site delivery: daily work, labour/plant, material movements, progress, inspection, quality/safety issues, waste and evidence.
7. Commercial and finance: changes, measured claims, certificates, invoices/bills, advances, retention, payments, securities and forecasts.
8. Completion: tests/commissioning, snags, partial location/system handover, as-builts, O&M, training, warranties and client acceptance.
9. Defects and final settlement: outstanding obligations, defect liability, final accounts and authorised security/retention release.

These workstreams overlap. Technical readiness, client acceptance and financial closeout remain distinct.

## Twelve mandatory capability areas

| ID | Capability | Minimum required continuity |
| --- | --- | --- |
| R-01 | NCR operations | Inspection/requirement -> containment -> cause/disposition -> authorised remedy -> evidence -> verification/closure or reopening; link cost, waste, change and delay consequences. |
| R-02 | Asset management | Owned/hired plant identity, custody, location, availability, maintenance, utilisation and costs; separate installed assets' commissioning/warranty/handover evidence. |
| R-03 | Payments and cash flow | Expected receipts/outflows, due dates, partial settlements, advances, retention and bank reconciliation; distinguish certified, invoiced, due, paid and cleared. |
| R-04 | Subcontract management | One package links scope/BOQ, bids, award, obligations, measured work, changes, certificates, deductions, bills, payment and settlement. |
| R-05 | Item cost breakdown | Analyse by item, location, resource type and period; original/revised budget, commitment, incurred cost, cash spent, remaining cost and forecast final cost with source drill-down. |
| R-06 | Waste management | Material loss/reuse and disposal movements; quantity balance, authorisation, destination/carrier/evidence and cost allocation without double counting. |
| R-07 | Variations and changes | One originating event with instruction, notices, scope, cost/time assessment, versions, authority/dispute and downstream budget/order/programme effects. |
| R-08 | Programme and delay | Baseline/current programme, look-ahead, constraints, dated progress, mitigation and evidenced delay/EOT assessments; explicit schedule master. |
| R-09 | KPI management | Definition, denominator/population, owner, target, cutoff, freshness, source and accountable follow-up; recalculate aggregate ratios correctly. |
| R-10 | Keeping records | Controlled IDs/revisions, issue/review purpose, correspondence, attachments, search, distribution, retention, export and historical reconstruction. |
| R-11 | Approvals | Policy-based routing, visible next owner/deadline, limits, delegation, rejection/resubmission, version-aware decisions and enforcement. |
| R-12 | Tracking and transparency | Source-linked totals, state/ownership/blockers and who-did-what history within permissions; a financial fact list alone is not a complete audit log. |

Full supporting ERP scope includes original accounting/reconciliation, HR/people, recruitment, leave, attendance, timesheets, stores, fleet, shared parties/catalogue, administration, access and integrations. Depth requires validation; do not silently drop it.

## Companies and currencies

- Each legal company owns its ledger, accounting currency, periods, tax/localisation, numbering, bank accounts, permissions and approval authority.
- Keep the selected company visible. A selector is not an access-control boundary. Cross-company queues label every record.
- Projects normally have one legal owner; a shared-project/venture umbrella retains entity-specific contracts, transactions and explicit allocations.
- Shared vendor identities may have company-specific approval status, terms, currencies and payment instructions.
- Central procurement and shared resources require linked, reconciled intercompany documents; do not mix obligations between entities.
- An unsourced purchase request can use a provisional company-currency estimate. Vendor selection is optional at that early stage.
- Currency default priority: selected valid quotation, then applicable agreement, then the vendor's permitted preference for that company. Never infer currency only from country.
- Show vendor-currency values and company-currency equivalents; make rate source/date/direction/provisional status available and surface stale/missing-rate exceptions.
- Changing a vendor/currency must not relabel an old amount. Reprice, compare and recheck budget/authority; reapprove according to policy.
- One PO has one legal purchasing company, vendor and transaction currency. Split incompatible selections into linked orders.
- Preserve original amounts and rate snapshots at budget/request, commitment, recognition, settlement and reporting stages; use decimal arithmetic and correct currency rounding.
- Separate transaction, company accounting/functional, optional project-control and report-presentation currencies.
- Finance owns exchange-rate overrides, remeasurement, realised/unrealised FX treatment and period locks under the applicable accounting policy.

## Reports and findings summaries

- Reports support project and company scope using consistent definitions. Company reports include non-project and unallocated activity.
- Authorised selected-project/company and group views explicitly declare their population. Financial consolidation requires translation, mappings, policy/period alignment and intercompany elimination; it is not a simple sum.
- Headers show scope, period/cutoff, currency/tax basis, filters, document states, freshness and any permission-limited population.
- Every report and export starts with a short findings summary: main variances/exceptions, material data limitations, supporting links and relevant follow-ups/owners.
- Compute findings from the full filtered result, not the visible page. Separate facts, forecasts, assumptions and suggestions.
- Version the report definition, metrics/rules, snapshot and rates. Filter or data changes regenerate matching findings; never pair a stale summary with new totals.
- Deterministic rules calculate metrics, rank exceptions and produce structured findings. Optional AI explains those verified findings; validate claims and fall back to deterministic text on failure.
- Missing data is not zero. Do not average incompatible percentages or sum unlike currencies/units. Reconcile project -> company -> group with explicit adjustment/allocation/elimination bridges.
- Drill down from a finding to rows and source records without losing scope, cutoff or permissions.

## Strategic AI placement

- Tenders: extract cited obligations, compare revisions and draft checklists/assumptions.
- Documents: find the correct revision, explain source-backed information and draft RFIs.
- Site: draft diaries from notes/voice/photos, propose coding and flag missing evidence for review.
- Quality/NCR: retrieve similar permitted cases and organise evidence; QA owns cause, remedy and verification.
- Plan/delay: explain blockers and build evidence timelines; planners own scheduling/time assessments.
- Changes: assemble instructions and cost/time evidence; authorised people decide notices, entitlement and value.
- Buying/subcontracts: extract/compare quotes and support package reviews; deterministic services handle FX and arithmetic.
- Cost/finance: source-backed variance explanations, scenarios, matching suggestions and exception signals; no autonomous posting/payment or unsupported causal claims.
- Assets/stores/waste: improve capture, retrieval and evidence checks; predictive maintenance/loss signals require sufficient history and evaluation.
- People: scoped policy/self-service assistance; no autonomous employment decisions or worker scoring.
- Handover: check deliverable completeness; document presence is not technical acceptance.
- Reports/My Work: explain verified findings and case histories; avoid duplicate tasks and automatic external messages.

AI stays contextual and optional for core workflows. Enforce the requesting user's permissions across retrieval, tools, logs/caches and exports. Treat uploaded material as untrusted data. Preserve source/revision links, review drafts, revalidate authority at execution and log decisions appropriately. Define provider/region/retention/training-use policy before integrating restricted business data.

Start with governed data, rules-based summaries, search and explanations; then reviewable extraction/drafts; add prediction only when measured benefit and representative history justify it. Measure accuracy, evidence support, correction burden, task time, false alarms, latency and cost.

## Validation and release gates

- Map all 42 existing primary entries; inventory leaf functions/permissions and data before implementation/migration. Repeated labels are not automatically duplicate functions.
- Test navigation and task comprehension with representative users. Proposed targets: 90% correct first destinations, 90% unassisted core-task completion, median information finding under 60 seconds. Agree targets and obtain a baseline before testing; these are not achieved results.
- Walk partial delivery, NCR repair, disputed change, subcontract rejection/certification, item-cost reconciliation, partial payment and partial handover scenarios.
- Prove legal company isolation, shared-project/intercompany reconciliation, vendor-currency changes and missing/stale-FX behaviour.
- Verify complete-population summaries, numerical examples, evidence links, filter/currency/version changes and zero-versus-missing handling.
- Test AI hallucination, fabricated citations, malicious document instructions, restricted data requests and attempted unauthorised actions; core workflows and calculated summaries must work during outages.
- Verify accessibility, keyboard/focus, zoom, mobile/poor connectivity where required, roles, accounting controls, migration, backups and recovery before replacement.
- No production deployment until local completion and a later explicit deployment instruction.

## 28 October 2026 — Destination landing page and access migration

Confirmed user instruction: begin building from the supplied full comparison. Re-study JAKH access before enhancing it. Use the idea of clear permission-dependent landing destinations, with an original Builder visual identity rather than an Odoo look. This supersedes the earlier requirement to keep exactly four global starting points; those work areas remain available beneath Home.

Implemented scope and verified boundaries: `implementation/access-and-destinations.md`. Every role/company/project restriction must apply to the service, field projection, report, search, related links, export and future AI context. Menu visibility is not authorization. Preserve source distinctions between role presets, company/project assignments, commercial pricing, business read-only access and approval authority. Unknown or unsupported permissions fail closed.

## 29 October implementation status

Company/project/location/WBS and original/revised budget controls now have typed services, local screens, examples and tests. See [foundation implementation](implementation/foundations-local.md). This does not reduce the remaining comparison, reporting, financial, identity, AI or migration scope. Every source function remains unverified for full parity.

## 29 October — Master maintenance progress

Original company party/contact records, independent supplier terms/currency review and material/service catalogue/pack definitions now connect to procurement. Quote/order snapshots preserve historic identity and currency/unit meaning; controls apply in services and local HTTP. Full party, pricing, configuration, accounting and migration requirements remain in scope. See `implementation/masters-local.md`.

## NCR implementation continuation

The local original NCR subset now connects requirement/location/WBS, immediate containment, root-cause/disposition/actions, independent plan and verification decisions, original evidence bytes and closure/reopen history. Cost/waste/change/delay follow-ups remain distinct obligations; no automatic downstream posting is claimed. F013/F149/M28 remain partial; full quality/HSE, controlled-document, handover, migration and usability acceptance remain required.

## 29 October 2026 — Original general ledger

Implemented company accounts/periods, original exact-currency journal preparation and independent posting/reversal, immutable source snapshots, scoped ledger/trial-balance findings and export. Explicit separate journal authority defaults to zero. Tax, bills/invoices, AP/AR/payments, bank/stock reconciliation, WBS accounting allocation and full source migration remain required; no illustrative balance counts as posted accounting.

Implementation progress (29 October 2026): commercial offers and independently verified awards now retain approved-estimate scope, exact values, company/currency identity, validity/payment/retention/advance terms and original acceptance evidence. Original contracts remain pending finance configuration. This implements a subset of M09/M15; the full construction, supporting ERP and migration acceptance requirements above remain unchanged. See implementation/commercial-local.md.

## 29 October 2026 — Client measurement and accounting continuation

Original contract finance activation, cumulative measured certificates and separate typed client invoices are implemented for the subset in `implementation/certificates-local.md`. Approval authority, actual advance balance, retention, invoice posting and cash remain separate facts. The entire comparison scope, including corrections, client receipts/advances, variations, retention releases, broader ERP and source migration, remains required.

## 29 October 2026 — Customer settlement continuation

Original customer receipt allocation, independent approval, evidenced recording, shared bank matching and immutable full corrections now connect posted certificate invoices to actual open receivables. Company/project findings and CSV retain the same scoped population. Actual advance request/invoicing/recovery, credits/unallocated cash, retention release and full company cash-flow/migration requirements remain open. See `implementation/receipts-local.md`.

## 29 October 2026 — Portability and repository continuity

The user requires GitHub (JameelKhab/Builder-ERP) to hold the project source of truth and a self-contained resumption summary. Another laptop or ChatGPT account must be able to continue using the repository alone. Verified commits may now be pushed; deployment remains unauthorised. START-HERE.md covers setup, exact current state and remaining scope. A separate private portable archive preserves the saved runtime workspace; no credential is committed.

## 29 October 2026 — Client advance foundation continuation

Request approval, canonical advance-liability invoicing and receipt-derived principal/tax now have service and authenticated HTTP verification. The full advance requirement still includes protected certificate recovery, original carrying values, tax/FX, correction handling, simple UI, scoped findings/export and complete examples. A temporary measurement guard prevents silently omitting recovery while that connection is unfinished. See `implementation/advances-local.md`; F092 and all wider requirements remain partial/unverified.
