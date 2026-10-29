# First working local increment

28 October 2026. User-selected direction: **choice 2, Project briefing**, with clearer categories. The full original ERP remains in progress. All displayed companies, people, rates, quotes and transactions are synthetic; the illustrative business date is 28 October 2026.

## Current continuation — 29 October 2026

This document preserves the first increment baseline below. Later operational subsets cover access/destinations, procurement, company/project/budget control, individual identity, masters, NCRs, ledger, material AP [supplier settlements/bank evidence](payments-local.md) and [estimate studies/project setup](estimates-local.md). Current validation: 177 tests, frontend build and additive schema-11 recovery across 77 business tables. Full parity remains unverified in the [267-function overlay](coverage.md).

## Read, decide, then open detail

The project overview answers three questions in order:

| Group | User question | Detail available |
| --- | --- | --- |
| Decisions needed | What needs my decision? | Request, vendor/company values, current revision, owner, sourcing allowance and history. |
| Site & programme | What needs attention on site? | Work, location, owner, due date, status and the original record. |
| Cost & cash | What do the figures mean? | Findings first, then budget/forecast/cash, full cost report and supporting items. |

Four global destinations remain **My Work, Tenders, Projects, Company**. Seven stable project areas remain **Overview, Plan, Site, Buying, Costs & Contracts, Documents, Handover**. There is one category directory per area, then a register and a record. Company/project selection stays visible. A record is opened in place, with keyboard focus returned on close. Search and browse provide complementary routes.

## Coverage: present implementation versus required work

“Sample register” below means a read-only synthetic record view, not a working lifecycle. The original requirements remain binding.

| Requirement | Clear route | Implemented now | Still required |
| --- | --- | --- | --- |
| Tender to mobilisation | Tenders | Sample tender record | Opportunity, bid/no-bid, BOQ/take-off, estimate revisions, bid comparison, award and baseline transfer. |
| NCR | Projects → Site → Quality & safety | Sample NCR detail, owner, next action and evidence description | Inspection, containment, cause/disposition, authorised remedy, evidence upload, verification, closure/reopening and linked cost/delay/waste consequences. |
| Assets | Projects → Site → Plant & equipment; Company → Resources & operations → Assets & fleet | Sample plant record | Custody, transfers, hire/owned treatment, availability, maintenance, utilisation and cost posting; installed-asset handover history. |
| Payments & cash flow | Projects → Costs & Contracts → Payments & cash flow; Company → Money & reporting | Sample certificate/payment record; cash shown separately in cost report | Claims, certificates, invoices, advances, retention, due schedules, receipts/payments, reconciliation and cash forecasts. |
| Subcontracting | Projects → Buying → Subcontracts | Sample package record | Package bids/award, measurement, amendments, certificates, deductions, bills and final settlement. |
| Item cost analysis | Projects → Costs & Contracts → Cost report; Company → Money & reporting → Project & company reports | Original/revised budget, committed, incurred, cash and forecast by cost item/location; deterministic findings and source snapshot references | Operational transaction postings, resource/period breakdown, remaining-cost build-up, ledger reconciliation and controlled budget revisions. |
| Waste | Projects → Site → Materials & waste | Sample disposal record | Quantity movements, reuse/loss/disposal, authorisation, carrier/destination evidence and cost allocation. |
| Variations & changes | Projects → Costs & Contracts → Changes & variations | Sample change record | Originating event, instruction, notices, scope/cost/time versions, disputes, approval and downstream effects. |
| Programme & delay | Projects → Plan → Programme & delays | Sample constraint record and overview activities | Programme baseline/import/edit, progress, dependencies, mitigation, notices and evidenced EOT assessment. |
| KPIs | Projects → Plan → KPIs & performance | Sample KPI definition/detail | Governed definitions, population/denominator, thresholds, recomputation, source freshness and follow-up. |
| Keeping records | Projects → Documents → Drawings & revisions / RFIs & correspondence | Scoped record lookup/search and sample revision information | File storage, controlled revisions, transmittals, reviews, correspondence, retention and historic reconstruction. |
| Approvals | My Work; Projects → Buying → Purchase requests | Draft/edit/reprice/submit/approve/return; independent reviewer, limits, revision checks, transactional sourcing allowance and event history | Configurable policy, delegation, deadlines/escalations, multi-stage decisions and authority for every other workflow. |
| Tracking & transparency | Record detail and report findings/source items | Request events, visible next owner/status, controlled report snapshot and scope | Immutable full revision payloads, all-domain audit, linked event consequences and production audit/retention controls. |
| Handover | Projects → Handover → Snags & defects / Testing & commissioning | Sample snag and commissioning records | Partial location/system handover, testing evidence, as-builts/O&M, training, warranties, client acceptance, defect obligations and final settlement. |
| Supporting ERP | Company → Resources & operations / Shared information | Read-only people/stores/vendor examples | Original accounting, tax, periods, reconciliations, HR, recruitment, leave, attendance, payroll scope, stores/fleet, master-data administration and integrations. |

## Working purchase-request flow

1. Pick a company/project and cost item, describe the need/location, quantity, unit and site-needed date.
2. Save an unsourced company-currency estimate, or select a company-approved sample vendor quote. The server derives the quote price, currency and FX snapshot. Changing vendor reprices the request.
3. Save a draft and edit it, then submit. The service chooses an eligible independent reviewer within that company/project and their converted-amount limit; submission fails if none exists.
4. An authorised reviewer can return it with a reason or approve sourcing. The current revision, quote validity, FX freshness, authority and available sourcing allowance are rechecked in the transaction.
5. The record retains versioned events. Approval reserves a sourcing allowance; it does **not** issue a PO, incur an expense, pay money or add the same amount to report costs.

Browser testing approved sample PR-0264 and created, repriced and submitted another request. Those agent-created test records were archived in an ignored test database before opening a fresh illustrative preview. Future user-created records persist and must not be reset casually.

## Companies, currencies and reports

- Two legal sample companies (AED and USD), three projects, and company-specific vendor terms exercise visible scope and service permissions. Cross-company/project references are rejected at the service boundary.
- Quantity, price, rate and money are decimal strings with exact fixed-decimal arithmetic. The current supported sample currencies AED/EUR/USD use two decimal minor units; other currency policies and a managed FX provider remain to build.
- Vendor quotation has priority in this increment. Agreement/preference fallback, supplier master maintenance and commercial sourcing comparisons remain pending.
- Project reports include that authorised project. Company reports include authorised project cost items plus company overheads where allowed. Permission-limited populations are labelled. Unlike company currencies are never summed.
- Findings use the full authorised result, independent of table pagination, and carry rule/definition/snapshot/source identifiers. Missing forecast values remain unknown. CSV begins with the same scope and findings, followed by every result row.
- Cost values currently come from explicit opening snapshots. The supporting source references are illustrative IDs; this is not a reconciled live general ledger or proof of underlying invoices.
- Financial consolidation, intercompany accounting, multi-period/as-of reconstruction, currency translation and elimination remain required beyond these single-company/project reports.

## AI placement now and later

“Explain findings” currently explains deterministic facts and their supporting cost items locally. It works without a model and makes no external AI calls. This is the evidence foundation for later contextual AI, not a claim that AI integration is complete.

The next AI increment should take verified scoped report findings or authorised documents as input, return cited explanations or reviewable drafts, and validate the output against the same snapshot. Tenders, RFIs, diaries, NCR evidence, variations and handover checks follow the placements in the requirements baseline. AI must not approve, post, pay, close a case or send externally without the applicable human authority. Provider, data region, retention, evaluation and fallback controls must be decided before restricted business data is connected.

## Validation and limits

- `npm test`: **25 passed**, including exact money/rounding, direct access isolation, quote repricing, stale FX/quotes, independence/limits, current-revision decisions, transactional allowance, append-only events, persistence, report scope/missing data and full-population export.
- `npm run build`: passed. This verifies frontend compilation, not production readiness or backend deployment packaging.
- Browser: draft/reprice/submit, independent approval, company/project report switch, pagination/export, record search, modal focus restoration, mobile navigation and desktop/tablet/mobile layout checked. Warning/error console entries: none in the inspected session.
- Project report: 4 cost items, AED 48m revised budget, AED 48.6m forecast, AED 19.4m cash. Company report: 6 items including other project/overhead, AED 50.8m / 51.5m / 20.1m. USD company remains separate.
- Representative-user task testing, full accessibility conformance, production security assessment, load/backup/recovery, dependency vulnerability review and accounting validation have **not** been completed.

## Next coherent build increments

1. Production-grade foundations locally: managed identities and roles, company/project administration, policy configuration, database migrations, attachments/revisions, backup/restore verification and expanded audit payloads. Confirm real entity/role/accounting inputs before incorporating business data.
2. Complete request → quote comparison → purchase order → partial receipt/inspection → bill → authorised payment/reconciliation, preserving budget/commitment/incurred/cash distinctions.
3. Complete NCR and materials/waste/site-diary lifecycles, linking the same cost items, locations, attachments and responsibility.
4. Complete subcontract measurement/certification, changes and programme/delay links, then tender/award, supporting ERP and handover/defects/settlement.
5. Introduce evaluated contextual AI on governed records; validate usability with representative staff throughout, not only at the end.

This sequence is a working delivery proposal, not removal or postponement without record of any requested capability. No push, hosting handoff or deployment has occurred.

## 29 October — Contacts, supplier terms and catalogue

The latest operational subset adds shared party identity with separate company terms, independent supplier currency/payment-day approval, purchasing blocks, product/category maintenance, fixed units/precision and explicit purchase packs. Quotations/orders preserve identity, terms and conversion snapshots. My Work/search and both-company examples are connected. See [master implementation](masters-local.md); every full-comparison domain remains tracked and no parity/migration completion is claimed.

## NCR continuation · schema 7

A connected original NCR workflow now adds immediate containment, independent plan review, assigned corrective actions, hashed local evidence, verification/failure/closure/reopening, search/My Work and project/company findings/export. Five synthetic scenarios per project preserve earlier data. See [quality-local.md](quality-local.md); this is a partial operational domain, not full quality/HSE or migration acceptance.

## 29 October 2026 — General ledger continuation

Added an operational general-ledger subset: company accounts/periods, exact-currency journals, independent authority and posting, immutable facts, reversal links, project/company findings and CSV. Home → Accounting and the project General ledger view open canonical records. See ledger-local.md and contracts/ledger-v1.md. Full finance and ERP remain open against 267 functions/34 contracts/21 domains.

## 29 October 2026 — Material supplier accounting continuation

Added receipt-matched supplier bills, configured exclusive tax, independent separate AP authority, immutable source journals, physical-return credits and project/company payable findings/CSV. Supplier-specific clerk permissions, My Work, search, source links and three-project examples are connected. See payables-local.md and contracts/payables-v1.md. This is an operational subset; payment, bank/stock, subcontract certificates/deductions and the full comparison/migration scope remain open.

## 29 October 2026 — BOQ workbook intake continuation

Original reviewed XLSX/CSV staging now connects source-row validation, exact all-file reconciliation, independent review and atomic once-only draft append. Company/product/unit controls, saved check history, findings/export and project examples are included. See [BOQ intake implementation](boq-intake-local.md). Parent caps/shares, richer workbook payloads and the full ERP/migration scope remain open.

## 29 October 2026 — Reviewed offers and original awards

Approved estimate scope now connects to versioned commercial offers, separate independent authority, dated client acceptance evidence and once-only creation of immutable original contract BOQ allocated to project work. Company/project findings, CSV, My Work/search, canonical links and examples are included. See [commercial implementation](commercial-local.md). Contracts await finance configuration; certification, AR, advance/retention accounting, changes and full ERP/migration acceptance remain open.

## 29 October 2026 — Client certificates and invoices

Original contracts now continue through independently activated finance policies, cumulative measured work, technical/commercial/finance review and separate AR invoice preparation/posting. Exact quantity/retention/tax/FX rules, immutable evidence and journals, zero-default authority, project/company findings/export and three-project examples are connected. See [certificate implementation](certificates-local.md). All 221 tests and the build pass; recovery matches 94 business tables. Actual customer advances/receipts, credits/corrections, retention release, changed BOQ and full ERP/migration acceptance remain open.

## 29 October 2026 — Customer receipts and bank evidence

Posted client invoices now connect to multi-invoice/project receipts, separate independent approval, retained remittance evidence, exact AR/bank/FX posting, shared customer/supplier statement matching and immutable full reversals. Reports/findings/CSV, source links, scoped queues/search and examples are connected. See [receipt implementation](receipts-local.md). 231 tests and the frontend build pass; the recovery copy matches 99 business tables. Advances/recovery, credits/unallocated money, retention release and the entire wider comparison/migration scope remain open.

## 29 October 2026 — Client advance accounting foundation

Typed advance requests/independent approval, canonical liability invoices and receipt-derived principal/tax now have service/HTTP verification, with schema-16 preservation and 241 passing tests/build. This is an intermediate backend checkpoint. Recovery allocations, the dedicated UI, reports/export and examples remain required; a temporary guard blocks measurement with paid advances. See [advance progress](advances-local.md) for the exact remaining work.


29 October continuity checkpoint: schema 17 adds recovery table/policy groundwork and conservative partial-principal cents; recovery services remain unimplemented and the paid-advance guard remains active. All 246 tests/build pass; all 102 prior tables are preserved and all 103 restored tables match. See [recovery continuation](advance-recovery-next-step.md).

Connected recovery checkpoint: protected allocations, original-tax/historical-consideration posting, reversal reservations, certificate UI/findings/export and authenticated HTTP journeys now pass 253 tests. Schema remains 17. Dedicated advance UI/full report/examples remain next; see advances-local.md.
