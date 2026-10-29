# General ledger — local implementation

29 October 2026. Original code; full ERP goal active. Source evidence and controls: `contracts/ledger-v1.md`. No source parity or production accounting claim.

## Connected flow

**Home → Accounting**, **Company → Accounting**, or **Project → Costs & Contracts → General ledger** open the same scoped records. Accountants prepare a journal against an open company period; another controller with sufficient explicit journal authority posts it. Journals preserve reference, reason, project, account/description, accounting date, currency and rate evidence. Reversals are separate, dated and independently posted. The original remains immutable.

A controller maintains account availability and non-overlapping periods. Account code/type/purpose cannot be changed. Submitted entries become stale when an account definition changes; return and revise before posting. Archiving a used account cannot prevent a correctly linked reversal. Period closing blocks submitted journals; another controller must reopen with an audited reason. No existing purchase or budget approval limit becomes journal authority.

Company/project ledger and trial balance have deterministic findings above the complete authorised result. Opening + debit − credit = closing, with reversal cutoffs and pending exclusions. Account filters also apply to pending findings. CSV includes scope, findings, caveats, account balances, every posted line, rates and source/reversal references. Current-scope access applies to detail, My Work, search, reports and exports. Project-only users cannot see company-unallocated or other-project entries. Read-only preview cannot write.

## Arithmetic and recordkeeping

All monetary calculations use original exact-decimal arithmetic. Only AED/USD/EUR with two minor digits are supported. Foreign journal conversion rounds each side to the same functional total; residual cents are allocated to that side's largest line, with an explicit adjustment field. A line that rounds to zero is rejected. Functional currency requires rate 1. Reversals preserve original amounts/rate and switch sides, rather than using a later market rate.

Schema 8 adds company accounts/periods, journal headers, immutable posted lines, numbering and event snapshots. Posting/number allocation/history are one database transaction. Posted headers, lines and history cannot be rewritten or deleted through services or ordinary SQL updates. The database file remains locally controlled; these triggers are not a claim of tamper-proof external audit storage.

## Examples and verification

The additive `ledger-v1` pack provides an account chart/open period in both supplied companies, and a posted accrual, pending review, reversed original and linked posted reversal in every supplied project (12 journals total). Fictional accountant/controller identities have no login credentials; only the new fictional controller has a journal limit. Existing users receive zero journal authority. Operational cost/cash openings and procurement facts remain unchanged; the new ledger is explicitly synthetic.

The browser saved and revised **JRN-7B44130A**, an AED 123.45 example dated 27 October, in a separate in-memory test workspace, then submitted it. It rejected an unbalanced attempt, kept the corrected journal open after saving, retained the accounting date, and showed only withdrawal while awaiting an independent reviewer. That disposable server was stopped; the walkthrough record is evidence, not persistent business data. No browser posting, real financial action, password/security grant or JAKH edit occurred.

The authenticated HTTP test provisions disposable identities only in memory, prepares/submits/posts/reverses, checks independent authority, reconciles date/account/project reports and CSV, and rejects forbidden scope/preview writes. Service tests cover exact rounding, account-change staleness, period closure/reopening, immutable history, duplicate/stale decisions, reversal constraints, control-account rejection, current scope/revocation and idempotent examples. All prior feature tests remain required. See `../validation/ledger/` for final results and browser proof.

The pre-upgrade backup is `.work/data/builder-before-ledger-20261029.sqlite`. Recovery checks preserve all prior rows/columns in 51 tables and match all 57 restored tables, including evidence blobs; integrity/foreign keys pass. The persistent preview has zero configured credentials. All work stays local.

## Remaining finance and ERP scope

This is an operational general-ledger subset, not complete accounting. Manual journals cannot post to bank/AP/AR/tax/stock control accounts: typed bills/invoices, deductions, payment allocation, bank statements/clearance, tax policies and valuation integrations must own those postings. No production chart, tax regime, exchange feed, opening balance or accounting policy is inferred from the demo. General journal numbering is company/year scoped; configurable journals/series and multi-ledger remain open.

Additional gaps include source-linked attachments/retention, configurable routes/delegation, mixed-project analytic distributions and WBS cost integration, scheduled/accrual templates, end-of-year earnings close, historical snapshots by posting timestamp, fiscal localisation, currency precisions beyond AED/USD/EUR, revaluation/settlement FX, financial statements and production source import/reconciliation. A full-company balanced trial balance cannot be inferred from a project-only or account-filtered view. The earlier construction cost report stays separate to avoid double counting.

All 267 functions, 34 contracts and 21 domains remain tracked. Wider construction/commercial/site/support workflows, strategic AI, migration and representative-user acceptance remain active work.
