# Ledger verification — 29 October 2026

- Fresh read-only source: JAKH journal 456; posted number/reference/accounting date, bank/receivable equal amounts, reverse-entry and payment/reconciliation links. Source was not edited and source enforcement was not tested.
- Automated service tests cover exact functional/foreign balance and visible rounding, independent limit/author checks, optimistic versions, live account changes/period controls, snapshot immutability, reversal dates/duplicate handling, scope/search/report isolation, configuration authority and additive examples.
- Real individual-identity HTTP journey in a disposable in-memory database prepares EUR/USD-style conversion, independently posts USD 40.01 at fictional 3.6725 = AED 146.94, reverses next day, and reconciles project/account reports. It verifies forbidden author posting, other-company access and preview writes. No persistent credentials were created.
- Browser isolated draft: JRN-7B44130A, AED 123.45, Harbour Tower, 27 October. Unbalanced credit 120 was rejected; correction 123.45 saved; revision stayed on the same record; submission showed independent review with no author posting button. In-memory test server stopped afterward.
- Browser checked 1280 desktop and 390 mobile; no horizontal overflow at 390. Same-currency detail avoids duplicate amount columns. Saved screenshots and DOM evidence accompany this file.
- Persistent project report for Harbour Tower, 25–26 October: one reversal, three lines, AED 1,280.13 on each side; earlier account openings and closing balances reconcile. Scope excludes other projects and company-unallocated records. Source link opens original/reversal detail. CSV is checked against the full result.
- Frontend accounting is loaded on demand; final build has no chunk-size warning. 134 automated tests passed, with no failures; final build passed. Full results are in test-results.txt.
- Database recovery preserves every earlier row/column in 51 tables and matches 57 current tables, including blob evidence. Integrity/foreign keys pass and configured credentials remain 0.

This verifies the local general ledger subset, not complete finance, tax compliance, data migration or full ERP parity. No push, deployment, real payment, supplier communication or JAKH mutation.
