# Access and destination validation — 28 October 2026

This is developer verification of the local increment, not a migration or usability acceptance certificate.

## Source review

- `source/site-engineer.png` and `.txt`: JAKH's detailed Site Engineer preset, selected-project default and no-price intent.
- `source/manage-access.png` and `.txt`: project-manager demo user's access review form, including company/project boundaries and the warning about inherited native application permissions.
- The source form was cancelled. No permission, identity or business record was saved. No Odoo source code was accessed.

## Local browser checks

1. Open Home as Ahmed. Confirm nine role-permitted destinations grouped under delivery, operations and administration; company and next-project context remain visible.
2. Open Users & access, review Mohammed's current Harbour Tower / Site Engineer grant and zero approval limit. No local browser grant was applied.
3. Use read-only Preview. Confirm one company, one assigned project and four destinations; commercial/report/HR/admin routes are absent.
4. Open Buying → Purchase requests → PR-0264. Confirm quantity 40 tonnes, vendor identity/currency and event history; prices, rates and budget figures are withheld.
5. Return to Ahmed. Switch to JAKH International Ltd. Confirm Creek Offices context and the company cost report's USD 4.2m budget, USD 4.3m forecast, USD 100,000 overrun and USD 900,000 cash findings.
6. Inspect Home at 1440 × 1000 and 390 × 844 CSS pixels. Measured document widths equal viewport widths, without horizontal overflow. Phone company selector was moved to its own row so the legal company is readable. Cards remain usable in two columns. Restore the viewport override afterward.
7. Inspect the final browser error/warning log: no entries returned.

Screenshots are under `builder/`. `home-desktop.png` is the final full-page capture; `home-mobile.png`, `access-review.png`, `site-engineer-home.png` and `restricted-request.png` record the tested flow. The engineer capture precedes a small wording correction to the Buying card; its permission population is unchanged.

## Automated verification

- `test-results.txt`: 46 tests passed, 0 failed, 0 skipped.
- Frontend build: passed, Vite 6.4.2; built locally, never deployed.
- `git diff --check`: passed.
- Business data before/after migration: companies, projects, vendors, cost items, requests, request events and generic records match the consistent SQLite pre-access backup exactly. Schema versions are 1 and 2. Runtime access-event count remains zero, confirming browser QA did not apply access changes.
- Access changes, rejected grants, revocation, audit immutability, read-only preview and pricing/cost boundaries are exercised against disposable test databases. The policy checks are server-side; screenshots alone are not authorization evidence.

See `../../implementation/access-and-destinations.md` for F/M traceability and explicit outstanding production and migration gates.
