# Builder ERP — customer receipts and bank evidence

29 October 2026. Local implementation progress against the complete comparison; this is not full ERP or migration acceptance.

Posted client invoices now continue into customer receipts, independent approval, evidenced recording, bank reconciliation and retained corrections. Home, Company and project Costs & Contracts open the same records. Invoice → receipt → journal and receipt → bank evidence → original receipt are direct routes. One remittance can cover several invoices; each allocation keeps its project.

## Working behaviour

- A receipt belongs to one legal company, customer, invoice currency and bank. Multiple project allocations require company-wide authority; project users see only their allocated amounts, with combined titles, files and detail restricted. Reports, search, queues and downloads enforce the same service permissions.
- Draft → submission → independent approval → recording are separate stages. Approval reserves the selected receivables but creates no cash or journal. Recording requires another person, an actual bank reference and retained PDF/image/text evidence with its SHA256 hash. The AR preparer cannot record money. Receipt approval has its own reviewed, zero-default limit.
- Exact remaining invoice and carrying balances determine partial settlement; the last allocation exhausts residual cents. Actual bank amount and FX remain explicit. The source journal debits bank, credits AR and records any FX difference, balancing each project independently. No revenue, cost or retention release is posted again.
- Current author/reviewer access, limits, source balances, versions, accounts, bank configuration, periods and reservations are checked before financial continuation. Shared bank references cannot be reused across customer receipts and supplier payments. Recording retries cannot create duplicate accounting.
- The same bank statement can match customer and supplier transactions, including a combined inflow, only when the exact bank amount, currency, direction and dates agree. The reconciler must differ from every transaction recorder. Matched evidence must be independently unmatched before a full linked reversal; the original and all match decisions remain retained.
- Reports begin with findings for the complete authorised project/company population: received, reversed, net, current bank clearance, unpaid/overdue invoices and selected AR-to-ledger reconciliation. Approved plans remain outside cash. CSV includes the same findings and all result rows. Invalid cutoffs hide stale findings and disable export while correction controls remain available.
- Same-currency entry derives the bank amount from invoice allocations and omits repeated rate fields. Detail shows invoice count instead of duplicating the same bank amount. Conversion, original evidence and history remain expandable. Mobile filters stack for readable labels.

## Examples and verification

Schema 15 adds five tables and a separate receipt-authority field. The additive `customer-receipts-v1` pack supplies five scenarios per project: draft, awaiting review, approved but unrecorded, recorded receipt and recorded full reversal. Its fifteen receipts, six source journals, six original evidence files and two independently matched statements cover all three projects and both companies. The paired corrections leave net AR unchanged. Three fictional example staff have no credentials; existing people gain no receipt approval limit.

**231 automated tests pass**, including nine receipt domain tests and an individual-identity HTTP journey. These cover multi-invoice/project allocation, partial/final cents, foreign bank FX, live authority/revocation, closed periods, stale reservations/balances, over-allocation, duplicate references, idempotence, immutable evidence/postings, correction, mixed customer/supplier matching, scoped report/search/download, safe CSV and additive examples. A USD 1,000 invoice settled by EUR 900 at 1.12 records USD 1,008 bank and USD 8 FX gain, with exact linked reversal. The frontend build passes.

Browser checks saved/submitted a disposable AED 300.30 remittance across two invoices/projects (100.10 + 200.20), with no self-approval or recording action. Project CSV agrees with the visible AED 3,415.10 receivable and zero control difference; the separate USD company exposes only Creek Offices. Invalid-date recovery, bank navigation/source links and responsive layout are checked. Evidence and qualifications are in `docs/validation/receipts/verification.md`. These checks do not replace representative-user or accessibility acceptance.

Before migration, a schema-14 backup was retained. All prior rows/columns in 94 tables remain, apart from explained sequence increments for six added fictional journals. The reopened recovery copy matches all 99 current business tables, including evidence bytes; integrity and foreign keys pass. The saved workspace has zero configured real identities. Git bundles do not include the ignored runtime database.

## Remaining connected work

Fresh source evidence shows customer advance request → advance invoice → receipt → reconciled receivable. This increment implements receipt settlement for certificate invoices. Advance requests/invoices, settlement-derived recovery and retention release remain required next work; an advance allowance never creates cash. Standalone invoices, credits/commercial refunds, unallocated receipts, write-offs, negative certificates, lost-author reassignment, revaluation, bank imports/fees/transfers, complete company cash classifications/forecasts and source export/import/reconciliation remain open.

All 267 functions, 34 contracts and 21 domains remain tracked. Everything stays on this Mac, committed locally; no push, deployment, JAKH mutation, external invoice or real money transfer occurred.
