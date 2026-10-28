# Procurement verification — 29 October 2026

- Automated verification: **65 tests passed, 0 failed**, including 19 new procurement/HTTP/arithmetic/coverage tests plus the existing suite. `npm test` uses disposable databases; loopback HTTP tests require local socket permission.
- Frontend build: passed (`npm run build`). Static packaging was generated locally only; no publish/deploy command was run.
- Source review: retained UI observations 19/21/22/25 and comparison D06–D09, not Odoo application code. Original full-parity acceptance examples remain unverified.
- Browser: default panel width, 1440 × 1000 and 390 × 844. Verified create/save/reopen/submit/quote/source-plan, own-approval absence, role preview, price restriction, delivery/stock display and mobile labelled tables. Viewport reset and preview exited afterward. Browser warning/error log was empty at final inspection.
- Browser test record: `MR-839E0650`, 25 blocks at EUR 10, rate 4 AED/EUR, total AED 1,000. Remains awaiting independent review. No order, cost or cash was created for this test request.
- Example workflow population after migration: 9 typed material requests, 4 purchase orders, 4 receipts, 12 stock movements and 8 cost facts. Browser test adds a tenth material request. The 13 earlier purchase requests and 29 earlier events are preserved.
- Consistent backup taken before schema/example migration. A later backup to a disposable restored database passed integrity and foreign-key checks; exact ordered table content matched for earlier requests/events, typed requests/orders/receipts/movements/cost facts and procurement events. The runtime source was unchanged by this recovery check.
- Not established: production identity/security release, JAKH equivalence, real source import, accounting reconciliation, multi-user load, all purchasing/stores features, representative-user usability or complete ERP acceptance.

Screenshots: `desktop-request-review.png`, `site-engineer-order.png`, `mobile-delivery.png`.
