# Client corrections — connected service checkpoint

30 October 2026. **Backend/API and existing balance/report views are implemented; the dedicated correction preparation/review UI, My Work/search and permanent examples are next.** This is not a completed correction feature, full credit lifecycle or source-parity acceptance. The complete 267-function/34-contract/21-domain objective remains open.

## What now works

- Schema 18 adds linked correction requests, immutable evidence and audit events without changing original approved/posted rows. Exactly one advance or certificate is corrected; its invoice is retained.
- Full approved-advance annulment uses independent advance authority. Certified-period annulment requires separate technical, commercial and finance reviewers. A posted credit additionally requires the separate AR limit. Current scope/limits are rechecked; no existing user receives new authority.
- Finance application atomically reverses the original invoice journal and withdraws effective approval/measurement/recovery. Every original transaction/functional line, tax, retention, historical advance consideration and tax FX is reversed exactly. Cash and its bank FX are unchanged. Unposted invoices remain as history and cannot post after source annulment.
- Later effective certificates and pending measurements block earlier full annulment. Approved receipt plans block credit. Changed cash, invoice or dependency facts require return/revision. Returning stale work remains possible. Replacement measurements get new IDs and reviews; invoice accounting cannot precede the related correction.
- Paid/partially paid invoices retain a customer credit after annulment. Reports distinguish original charges, credits, net cash, debit outstanding and customer credit. Negative customer balances are not labelled overdue debt. Principal, original advance tax, AR, retention and recovery reports/CSV include the applicable dated credit journals.
- Existing invoice detail, customer receipts and certificate reports display credited status, original versus current amounts, customer credits and credit journal/source links. No correction entry button is presented before its complete UI is built.

The explicit contract is [client-corrections-v1.md](contracts/client-corrections-v1.md). Source observation is separate from proposed Builder controls. JAKH's credit wizard was inspected and discarded; its paid advance cancellation and certificate acknowledgment controls were only read.

## Verification

**266 tests pass and the frontend build passes.** Ten new correction-domain cases plus extensions to the individual HTTP journey and foreign-currency recovery test cover unbilled/unpaid/paid corrections, dependent certificates, replacement measurement, cash-plan blocking, changed settlement, current/revoked/overlapping reviewers, zero-default AR authority, original-author departure, scoped files/reports, periods, exact original reversals, cutoff accounting and injected posting rollback. The complete suite also exposed old wall-clock fixture drift and an actual same-timestamp sales-acceptance ordering bug; both were repaired without weakening date controls. `npm test` loads a test-only fixed Date clock; runtime launchers use the real clock.

A schema-17 saved-workspace backup was upgraded in a separate copy. All original rows in 103 tables remain (plus schema version 18); the resulting 106 tables match a separately restored copy. An injected migration-finalisation failure rolls the entire change back, with FK enforcement retained. No saved correction transactions or real identities are introduced. Evidence: [validation/client-corrections](../validation/client-corrections/README.md).

Browser evidence uses a disposable in-memory fixture: the credited advance invoice shows original AED 315, recorded cash AED 210, zero debit outstanding and AED 210 customer credit. This verifies the existing balance display, not the unfinished full correction entry/review journey. Full mobile/accessibility and representative-user acceptance remain open.

## Continue here

1. Build one correction preparation/detail/review destination from canonical advances/certificates/invoices, with impact, blockers, next reviewer, evidence and history. Add scoped My Work/search, report/export and additive meaningful examples in both companies/all projects. Use the existing service/API; do not duplicate its accounting logic in React.
2. Complete customer-credit reallocation and evidenced refund, preserving allocations, periods, exact residual carrying values, current independent authority and shared bank reconciliation. Credit is never cash movement; receipt-error reversal is not a refund substitute.
3. Complete partial/forward signed measurement/price/tax corrections, descendant handling and ownership handover. Full annulment does not replace those required workflows. Then retention release, securities/final accounts, variations, subcontracting and the wider comparison backlog.
4. Continue source verification, actual production export/import and reconciliation, full usability/accessibility/security and release acceptance. None is implied by this checkpoint.

Key files: `app/server/client-corrections.mjs`, `client-corrections-schema.mjs`, `client-correction-state.mjs`, existing certificates/advances/receipts balance and report modules; `app/tests/client-corrections.test.mjs`, extended `advances-api.test.mjs` and `advances.test.mjs`. Endpoints are under `/api/client-corrections/{documents,report,evidence}`. The service exports save/decide/detail/list/download/report. Applied corrections use `CCR-` IDs; original source rows stay immutable. No forward-adjustment or refund endpoint exists yet.
