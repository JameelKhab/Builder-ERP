# Customer credits — local accounting foundation

30 October 2026. Schema 19 implements original service/API credit allocation and refunds. This is an intermediate foundation; the dedicated user workspace, permanent examples, posted settlement reversals and complete acceptance remain unfinished. It does not complete the full 267-function/34-contract/21-domain ERP.

A credit can be applied to other posted invoices of the same legal company/customer/currency, across projects with company-wide authority, or refunded through a reviewed bank plan. Draft, independent approval/reservation, actual recording and independent bank matching are separate. Original instruction evidence precedes submission; refunds also retain original remittance evidence and a shared unique bank reference. The system records offline transactions; it never sends money.

The separate `customer_credit_approval_limit` defaults to zero for every existing membership. It is maintained through reviewed access administration. Allocation uses an explicit reserved credit-transfer account plus explicit gain/loss accounts. Original carrying residuals and final cents are retained; every project balances and company transfer nets to zero. Refund bank FX remains separate. Manual journals cannot reverse these typed entries.

Shared AR queries distinguish original credit, cash receipts, credit received/applied, refund and net AR. Applying credit to an advance funds principal/tax for protected recovery without adding cash. Approved receipts/credits compete for remaining balances, corrections respect reserved settlements, and receipt reversals cannot remove credit already used. Stale balances/accounts/authority/dates fail closed. Pre-schema-19 review signatures stay compatible when no new financial facts exist; actual credit movements invalidate dependent preparations.

`/api/customer-credits` exposes options, documents, decisions, original evidence and company/project/currency/cutoff findings. Its CSV formatter exports the complete authorised report. Existing receipts reports reconcile the new AR movements while their cash totals remain receipt-only. Shared bank matching supports `credit_ids` alongside receipts/payments. Restricted project reports show permitted legs but cannot open combined records/evidence or reveal other-project titles.

Files: `app/server/customer-credits.mjs`, `customer-credits-schema.mjs`, `customer-credit-state.mjs`; shared receipt/advance/correction/bank services; `app/src/customer-credits-export.js`; tests `customer-credits.test.mjs`, `customer-credits-schema.test.mjs`, extended `advances.test.mjs`. See [contract](contracts/customer-credits-v1.md) and [validation](../validation/customer-credits/README.md).

## Next connected work

Build the simple canonical credit workspace from invoice/correction and Company/Project views, with exact impact, next decision, evidence/history, My Work/search, report/CSV and independent bank matching. Add meaningful examples in both companies/all projects without altering existing users, authority or records. Do not count the API as a finished UI feature.

Implement independently reviewed exact settlement reversals, dependency-aware advance recovery protection, and unavailable-author handover. Different transaction-currency offsets need an explicit reviewed agreement/rate basis; current same-currency matching must not silently relabel amounts. Continue partial/forward source adjustments, retention/security/final accounts and the full wider construction/supporting ERP backlog. Representative-user, security/accessibility, source migration and full parity remain open.
