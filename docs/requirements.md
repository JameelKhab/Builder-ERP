# Builder ERP requirements baseline

This editable baseline accompanies the [53-page Revision 4 study](study/JAKH-ERP-Read-Only-Study.pdf). User requirements and proposals are distinguished in [decisions.md](decisions.md). The live demo was inspected read-only; this document does not assert that every required capability currently exists or is enforced.

## Objective and boundaries

Create an original construction ERP for the journey from tendering to handover, defect obligations and final settlement. Use no Odoo application code. Prioritise simple navigation, clear next actions and rich, source-linked information. Work and commit locally; the user has deferred GitHub syncing. Do not push until instructed, deploy to jakh.net or modify the demo.

The user clarified that this means a **full proper migration**, preserving the strong existing JAKH business logic. The first local increment does not meet that scope. The [267-destination comparison](migration/README.md) records the correction: original implementation must preserve functions, data relationships, approved versions, quantities/balances, histories, permissions, reports and exceptions. Simplifying navigation is not permission to reduce business capability. Exact source-export/schema mapping and reconciliation remain unfinished; proposed mappings are not executed migration work.

## Experience requirements

- Product name: **Builder ERP**.
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
