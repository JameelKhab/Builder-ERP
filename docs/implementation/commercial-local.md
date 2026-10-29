# Builder ERP · local offers, awards and original contracts

29 October 2026. Partial operational increment against F042/F043/F047/F077, M09/M15, with cross-cutting M02/M32. The entire 267-function, 34-contract, 21-domain comparison remains in scope; no function is certified as full migration parity.

## Use it locally

Home → **Quotations & awards**, Company → **Quotations & awards**, or Project → Costs & Contracts → **Client contracts** open the same records. An approved estimate also offers **Prepare offer from this study**. My Work shows independent commercial/acceptance reviews; search resolves the same offer. Examples cover draft, review, approved offer and original awarded contract in each supplied project/company.

1. Select the current approved estimate. Its BOQ quantities, exact line selling amounts, source revision, customer, legal company and dated currency rate are retained.
2. Set validity, scope/exclusions, invoice-relative payment days, retention cap/percentage and advance ceiling/recovery. Save a draft, then submit for independent commercial review. Separate offer/award authority starts at zero for every existing member.
3. Record dated client acceptance with a retained original file, reference, named signatory and explicit BOQ→project work/location allocation. Evidence of acceptance after expiry is blocked; late recording of acceptance within validity is flagged for review.
4. Another authorised person verifies the exact offer and evidence. This creates an immutable original contract once. The contract is clearly **Finance setup required**. No budget release, invoice, revenue, receivable or cash is created.

The page leads with value, validity and next step. Findings precede the BOQ; scope/terms, evidence hashes/allocations and history open progressively. Company/project reports filter by offer date and current state and export the complete matching findings and rows. Potential offers and awarded original value are separate, in company currency at saved rates.

## Controls and evidence

Six typed tables form schema 13: sales_offers, sales_offer_lines, sales_acceptances, client_contracts, client_contract_lines, commercial_events. Independent commercial approval limits, optimistic revisions, current source/customer/company/authority checks, immutable snapshots and scoped raw-file downloads are enforced in services/API. Revision and cancellation retain history. Award retries cannot create another contract. Original acceptance files are SHA256 identified, up to 2 MiB and downloaded as attachments; they are not executed or transmitted elsewhere.

The original contract retains authoritative rounded line amounts and explanatory unit rates, preventing a rounded displayed rate from changing the agreed total. WBS/location snapshots are rechecked at award. The same estimate can create project/WBS/unreleased draft budget first; existing projects use explicit allocations. Source JAKH has different finance policy stages: those are preserved as a required next workflow, not implied by master creation.

Validation: 15 commercial service/contract tests plus the extended real-identity HTTP estimate→project→offer→evidence→award journey; full suite **206 passing**. Frontend build passes, commercial and Access screens load on demand. Browser saved a clearly fictional acceptance upload and three explicit WBS mappings, retained it pending independent review and exposed no self-verification action. Project/company scope, filters, report export and responsive layout are checked in validation/commercial.

Backup/recovery: pre-upgrade schema-12 backup is `.work/data/builder-before-commercial-20261029.sqlite`. Every prior row/column in 82 tables is preserved; the reopened schema-13 recovery copy matches all 88 business tables, including files. Integrity and foreign keys pass. No real identities were configured. Git/source bundle and database backup are distinct.

## Remaining connected work

Contract finance activation, typed measured certificates, client invoices/AR, advance settlement/recovery and retention balances/releases, BOQ revisions/variations/final settlement remain open. So do standalone quotation/pricelist/tax/discount/template/team rules, outbound issue and client portal, full source enforcement/mapping and actual migration/reconciliation. Retention/advance inputs here are reviewed commercial terms, not financial balances. No external AI provider is connected; findings use deterministic authorised data. The full ERP remains in progress locally.
