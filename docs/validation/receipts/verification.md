# Customer receipt verification — 29 October 2026

Scope: original invoice receipts, retained correction and shared bank matching. Contract: `../../implementation/contracts/receipts-v1.md`. No full source parity, live migration, representative-user acceptance or production release is asserted.

## Automated evidence

- `tests.txt`: 231 passed, zero failures. `domain-tests.txt`: nine receipt domain cases, including multi-project title/amount privacy and mixed bank matching. `build.txt`: successful frontend/Sites-static packaging; the latter does not host the ERP API.
- `receipts-api.test.mjs` uses disposable real authenticated local identities for preparation, approval, recording, retained-file download and scoped denial. Caller-provided actor values do not override the session. Preview cannot mutate. No real credentials were configured in the saved workspace.
- `domain-tests-initial.txt` retains the initial missing CSV-title assertion; export now includes and safely escapes source titles. `tests-initial.txt` records sandbox loopback denials and outdated ledger example counts; authorised local execution and updated exact expected counts resolve them. No known test failure remains.
- `migration-recovery.json`: 94 old tables retain prior rows/columns; only journal counters advance for six new synthetic receipt/reversal postings. Reopened recovery matches 99 tables, including BLOB evidence; integrity `ok`, no foreign-key errors, zero identities.

## Browser evidence

- `browser-author-submitted.txt/png`: isolated in-memory AR preparer saved and submitted AED 100.10 + AED 200.20 across Harbour and Garden invoices as one AED 300.30 receipt. Same-currency bank amount is derived, invoice count is two, and author approval/recording are absent. The fixture was restarted after capture; this synthetic receipt was never written to the persistent database.
- `browser-project.csv` and `browser-project.png`: persistent Harbour report/export contain exactly two recorded receipt/correction allocations, 1,000 incoming and 1,000 reversal, net zero and 3,415.10 AR with zero source-to-ledger difference. The approved 500 plan is excluded from cash.
- `browser-invalid-date.txt`: future cutoff displays an error, removes findings and disables export. A valid date restores the report without reloading the application.
- `browser-usd.txt`: USD company shows only Creek Offices and USD 3,415.10 receivable; AED projects are absent.
- `browser-mobile-metrics.json/png`: actual 390px layout and document width match. The browser-level viewport setter initially left the tab at 1280px; a tab-specific developer viewport and direct browser screenshot captured the actual mobile layout. Temporary emulation is cleared after inspection. A narrow project selector was corrected by stacking report filters.
- `browser-bank.txt/png`: receipt destination opens bank statements directly. The fictional reconciler sees matched customer inflows/corrections and their retained source history. Source buttons open the original receipt. No bank match, payment, approval, access grant or real account change was performed through this browser check. A disposable page open during static-asset rebuild briefly referenced a removed hashed module; reloading the newly built page resolved it. This diagnostic is retained with the final console check.

Source captures and SHA256 manifest are in `source/`: JAKH advance request 4, invoice 31, receipt 13 and journal 32 observed read-only. A displayed paid/reconciled status is not proof of the source's enforcement or a full bank statement match. No Odoo application code was inspected or copied.

Text browser captures and diagnostic logs remove trailing whitespace for review; downloaded CSV is stored with LF line endings for Git. Content and numbers are unchanged. Original source manifest hashes apply to the retained normalised source text files. Broader ERP, financial localisation, dependency/security review, real source-data reconciliation and user acceptance remain open.
