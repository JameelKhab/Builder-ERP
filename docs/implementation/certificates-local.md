# Builder ERP — client certificates and invoices

29 October 2026. Local implementation progress, not full migration acceptance.

An awarded contract now continues through independently reviewed finance configuration, measured work, three separate certificate reviews and a separately prepared/posted client invoice. The Home, Company and project Costs & Contracts routes open the same records. The accepted offer links directly to finance and measurements; invoices link back to their certificate and posted journal.

## Working local behaviour

- Finance controllers propose and independently activate versioned company accounts and explicit exclusive tax treatment. Original commercial terms, retention ceilings and contract BOQ stay fixed. A changed account/policy requires fresh review for unapproved measurements.
- Quantity surveyors and commercial/project managers prepare cumulative installed quantities with measurement periods, explanation and original evidence. Previous approved quantities, current quantities, remaining work and exact current value are calculated from the original line amount. The final quantity exhausts the remaining cents exactly.
- Independent project-manager technical review, commercial review and finance approval retain each submission cycle. Separate certificate limits default to zero. A return requires author correction and a fresh cycle; cancelled/approved records and evidence cannot be erased. No certificate approval posts revenue, AR or cash.
- AR preparers explicitly create a draft invoice from an approved certificate. Dates and accounting FX are separate from measurement approval. Independent AR posting, with its own zero-default limit and an open accounting period, creates a balanced source journal once. A customer-only AR clerk has no supplier, general-ledger, people or posting authority. General-journal actions cannot reverse or edit the typed invoice.
- Retention and tax are visible deductions/components. The permitted advance ceiling never becomes cash. The connected client advance/receipt subledger is not implemented in this increment: eligible recovery is zero and cannot be manually fabricated.
- Every filtered report begins with complete-population findings: certified gross, pending measurement, held retention, certified amounts without a posted invoice and selected posted AR/retention reconciliation. Certificate filters use measurement period-end; invoice filters use accounting dates independently. Neither report calls posted charges received/cleared cash. CSV retains the same findings and full result.
- Same-currency forms require no repeated rate entry. Editing shows four meaningful BOQ columns; the review screen adds derived current/remaining quantities and value. Rich evidence, policy, accounting and history remain expandable.

## Examples and validation

Schema 14 adds six business tables. The additive fictional pack creates four measurements and three invoices in each of Harbour Tower, Garden Residences and Creek Offices, across both companies. Each project has certified work, a posted invoice, an invoice draft, an invoice awaiting posting and a measurement awaiting technical review. Dedicated fictional example staff have no configured credentials; existing users receive no new financial limit.

**221 automated tests pass** and the frontend build passes. Fourteen domain tests and an individual-identity HTTP journey cover source/cumulative ceilings, periods, policy revisions, separate/independent authority, revoked access, submission cycles, immutable evidence, scopes/search, foreign currency, final cents, invoice-to-ledger reconciliation, retries, export safety and example idempotence. A foreign USD invoice at 3.7 records the explicit -0.01 company rounding allocation and stays balanced. Initial incorrect expected rounded values and an outdated ledger example count were corrected; initial sandbox loopback denials were resolved by authorised local test execution.

Browser checks edited a fictional measurement from 44.8 to 45 m3, obtaining AED 5,145.89 current gross and AED 257.29 retention, then submitted it with no author approval action. An isolated AR clerk revised an invoice due date to 14 December and submitted it without a posting action. These edits used disposable in-memory workspaces. Saved business data was not changed by those form checks. Final persistent project findings/export, linked records and responsive checks are recorded under `validation/certificates`.

Before upgrading, backed up schema 13. All prior business/history rows and columns in 88 tables are retained; journal sequence counters advance only for the three added fictional client postings. Recovery matches all 94 current tables including evidence blobs; integrity and foreign keys pass. The saved workspace still has zero configured real identities.

## Still open in the complete ERP

This increment does not complete F077/F091/F092/F122 or M15/M16/M23. Approved variations/revised BOQ, other deductions, client advances and receipts, retention release, securities, final accounts, linked credits/negative measurement corrections, lost-author work reassignment, richer taxes/localisation/aging, full cash/stock/subcontract integration and original source export/import/reconciliation remain required. No reset-to-draft or fabricated balance is offered as a substitute. The full 267-function, 34-contract, 21-domain objective remains active.

Everything remains on this Mac. No GitHub push, production deployment, external invoice, JAKH mutation or real financial transaction occurred.
