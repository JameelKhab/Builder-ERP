# Customer-credit settlement contract v1

30 October 2026. Original Builder design for F091/F092/F122/F124/F133/F134/F136 and M15/M16/M23/M24/M32. Read with client-corrections-v1.md and receipts-v1.md. The retained 30 October source observations show paid invoices, credit preparation and separate payments; they do not prove source refund/allocation enforcement. No Odoo code. This contract describes the implementation target, not full acceptance.

## Workflow and authority

One posted source invoice with negative open AR; one company, customer and transaction currency. Kind is allocation or refund. Immutable source/kind/author/scope, dated basis, original instruction evidence, versioned preparation. Allocation selects 1–30 other posted invoices with that same company/customer/currency, including advance invoices. Cross-project operations require company-wide authority; project-only users cannot access combined documents or another project's details. Refunds select a bank, bank amount/rate/date/source and reviewed beneficiary instructions.

Draft → submitted → independently approved → recorded. Approval reserves balances but posts no cash/accounting. Recording requires someone other than the approver, current approval authority, unchanged accounts/balances/evidence and an open non-future accounting date. Refund recording additionally requires original remittance evidence and an actual reference unique across supplier payments, customer receipts and refunds. Nothing sends money. Independent bank matching follows recording. Return/withdraw releases reservations; revision starts fresh approval; cancellation retains history.

Scoped customer_receipts read/write/approve/record capabilities are used with a separate customer_credit_approval_limit defaulting to zero. Existing limits confer no new financial authority. Exposure is the maximum of source carrying, aggregate target carrying and bank functional value. Explicit transfer/gain/loss account snapshots are reviewed for allocations. The dedicated credit-transfer purpose is prohibited from manual journals.

## Exact amounts and connected controls

Keep original invoices, credits, actual receipts, noncash credit received/applied, refunds and net AR separate. Allocate remaining carrying proportionally; final application exhausts exact residual cents. A refund debits source AR carrying, credits bank functional amount and posts the exchange difference. Same transaction/bank currency must match; functional-currency bank rate is one.

Allocation debits source AR and credits transfer in its project. Each target project debits transfer at the source carrying share, credits its AR at its own carrying share, and posts the difference to gain/loss. Company transfer nets to zero; every project balances, including different historical FX. Applying credit to an active advance provides noncash funding for protected recovery, separately from actual cash. Annulled advances remain excluded.

Approved credits reserve source credit and target debit. Approved receipts compete for target debit. All checks occur atomically again at approval/recording. Receipt error reversal cannot remove credit already used/reserved; source correction cannot apply while an approved credit plan touches the invoice. Date follows every affected settlement/correction. Live author/reviewer rights, accounts and versions are rechecked. Stale work returns for revision; no inherited approval.

## Reports, exceptions and acceptance

Immutable recorded legs/journals, original evidence and append-only history. Complete scoped company/project/currency/cutoff findings and reconciliation; partial-project reports expose only authorised legs. Existing receipt reports include credit effects in AR while cash movements remain receipt-only. Refund bank matching/unmatching and statement void checks share existing controls.

Required acceptance: partial/final cents, different rates, project balancing/privacy, advance recovery, periods, competing reservations, revoked authority, retries, atomic failures, shared references, bank matching, authenticated HTTP, report/cutoff/export, UI/My Work/search, examples, upgrade and restore. Posted settlement reversals and unavailable-author handover remain required subsequent connections; no manual editing or receipt-reversal shortcut. Different transaction-currency offsets need an explicit agreement/rate contract. Partial source credits, unallocated cash/write-offs, forward adjustments, retention and wider ERP/migration remain open. The backend checkpoint alone is not a finished user feature.
