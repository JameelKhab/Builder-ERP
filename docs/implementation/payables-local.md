# Supplier bills and return credits — local implementation

29 October 2026. Original Builder ERP code, schema 9. This is the connected material-payables subset of F127/F128/M23, not complete finance, source migration or full ERP acceptance.

## The working flow

**Home → Supplier bills**, **Company → Supplier bills**, and **Project → Costs & Contracts → Supplier bills** open the same authorised documents. The page has a bill/credit register, findings/balances, and company AP/tax setup for controllers. Source details, accounting and history expand within a record. My Work, search, examples, order links and journal links use the canonical record.

An AP preparer chooses an issued supplier order and accepted receipt lots. Supplier/company/project/currency derive from the frozen order. Invoice quantity, explicit price basis, classification, configured tax, document/accounting/due dates, accounting FX and source explanation are reviewed in a draft. Price differences need an explanation. Another person with sufficient **separate AP authority** posts the submitted bill. No existing purchase, budget or manual-journal limit becomes AP authority.

The receipt ceiling is accepted minus returned minus posted net billed quantity, rechecked in the posting transaction. Rejected goods cannot be billed. Consumption does not remove the supplier liability. Drafts do not reserve receipt capacity. Duplicate supplier/company/document-kind references, stale revisions, foreign scopes and concurrent overbilling fail without partial postings or consumed journal numbers.

Posting creates one immutable typed journal: classified cost plus nonrecoverable tax, recoverable tax, and supplier payable. General-ledger edit/post/reversal APIs reject this source; corrections must preserve the AP subledger. Posting never makes a payment or a second construction-cost fact. A supplier blocked for new purchasing can still be billed against an existing issued order.

Physical returns remain separate. A supplier return credit references a posted bill and may correct only currently overbilled returned quantity, within the original remaining quantity. Original prices/tax/FX/account classification are retained. Partial credits allocate remaining original transaction and functional amounts, taking the residual cents on the final quantity. The service rechecks quantities and remaining values at posting. A return that already reduced the billable quantity cannot be claimed again as credit.

## Configuration, reporting and access

Company controllers select an AP liability control and explicit exclusive tax codes: percentage, recoverable percentage, tax asset account, effective dates and descriptive purpose. Zero tax requires an explicit treatment. Rates/date rules are fixed; new policy needs a new code. Prospective availability/name changes are versioned and invalidate prepared bills. No production jurisdiction or tax rate is inferred from the demo. Only the supported two-decimal AED/USD/EUR model is implemented.

An AP clerk can prepare supplier bills/credits without general-ledger, customer-accounting, HR, posting or payment rights. Scope is enforced in direct records, source pickers, search, reports, exports and reviews. Company-only configuration is separate from project access. Access changes use the existing independent review and session-revocation flow. Preview cannot write. Site orders expose net billed quantities without bill amounts; bill links require AP read access.

Company/project findings cover every authorised posted bill/credit through the accounting cutoff. They show original/credited/open balances, due exceptions, transaction-currency groups, functional totals, current review counts, unbilled receipt lots and returns needing credit. Linked AP control reconciles to the subledger. The report clearly distinguishes accounting dates, operational event dates and current pending workflow state. CSV starts with scope/findings/limitations, then every bill, credit source and receipt exception. No payment or bank-clearance result is implied.

## Examples and validation

The additive `payables-v1` pack creates one new labelled procurement/receipt chain per supplied project. Each includes a posted bill, posted partial return credit, remaining credit draft and a second bill awaiting review: **12 AP documents across three projects/two companies**. It adds six typed journals, fictional AP/tax accounts and two fictional users with zero credentials. Existing user authority stays at zero. The new synthetic POs add explicit commitment facts (AED 1,800 across JAKH projects and USD 360 for Creek); operational incurred cost and cash are unchanged by AP posting.

The full suite passes **148 tests**, including an individually authenticated HTTP bill/credit journey, exact price-basis/tax/FX arithmetic, partial-credit exhaustion, competing receipt claims, duplicate references, source-journal protection, closed periods, role/scope/limit controls, immutability, search/report/export and additive recovery. Build passes; the AP UI loads separately on demand.

Browser QA saved/submitted a disposable EUR 12.60 / AED 51.96 bill dated 29 October, due 28 November, in an isolated in-memory workspace. The preparer sees withdrawal, with no posting or general-ledger destination. Persistent report checks show Harbour original EUR 252, credit EUR 25.20, open EUR 226.80 / AED 935.20, zero control difference. Desktop, mobile, company switching, project filtering, journal/source links and real CSV download were checked. Mobile table overflow was corrected; tables scroll within their own region and the page width remains 390px. See `../validation/payables/`.

Before upgrade, the schema-8 database was backed up to `.work/data/builder-before-payables-20261029.sqlite`. Checks cover all 57 prior tables: prior business/history rows and columns stay unchanged, except the journal counters advance exactly by the new typed example postings. A reopened copy matches all 62 schema-9 tables, including evidence blobs; integrity and foreign keys pass. No persistent identities or credentials were configured. Local files/commits only.

## Remaining scope

Material receipt billing does not yet cover subcontract/service entry ceilings, measured certificates, retention, advances, non-PO charges, debit notes, price-only credits, full-document voids, invoice attachments/retention policies, tax-inclusive/compound/withholding/fiscal positions, statutory returns, payments/allocation, settlement FX, bank clearance, stock valuation/GRNI or landed costs. Detailed AP aging buckets, supplier statements, payment-term schedules and dated revaluation also remain open. The current explicit expense/asset classification does not replace those future controls.

JAKH bill 213 was re-read without changes. Its PO matching, service/certificate links, retention, dates, accounts and due amount reinforce these remaining dependencies; observed fields are not proof of source enforcement. No Odoo code was used. All 267 functions, 34 contracts and 21 domains stay in the coverage register with parity unverified. Full construction/supporting ERP, governed AI, production-source import/reconciliation and representative-user acceptance remain active work.
