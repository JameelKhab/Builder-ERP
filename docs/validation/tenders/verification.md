# Estimate validation — 29 October 2026

## Evidence

- `source/01`–`07`: fresh UI-only JAKH inspection. Saved handed-over estimate, assembly, resource and building override forms plus the current draft. Detail dialogs were discarded without edits. No source mutations or code copying.
- `test-results.txt`: 177 passing complete-suite tests. Initial sandbox-only run could not bind loopback; rerun with local networking passed. No product failures were hidden by that retry.
- `calculation-recheck.txt`: 13 estimate service/calculation tests after comparison reason refinement. The individual identity HTTP scenario is in the full suite.
- `build-results.txt`: successful client/static packaging build. The package's static worker does not supply the ERP database/API; this is not a deployment acceptance.
- `migration-recovery.json`: schema 10 backup → schema 11; 70 prior business tables retain all prior row/column values. Reopened copy matches 77 business tables, integrity/FK clean, zero identities.
- `browser-submitted.txt`, `browser-study-export.csv`: disposable browser draft EST-BA571E1D. Two buildings, default 3 m3, second override 4 m3, direct 100/unit, indirect 20, overhead 10%, profit 20%. Saved result quantity 7, cost 720, selling 950.40. Submitted author sees withdrawal only; no self-approval. Actual downloaded CSV retains the quantity exception and same totals. Disposable in-memory server, not the persistent database.
- `browser-project-export.csv`: actual Harbour project report download, three latest studies, no Garden data. CSV line endings normalised to LF for Git without changing values.
- `mobile-estimate.png`: 390px viewport/page width, no page overflow. Numeric table scroll is local. Desktop study/register and revision comparison inspected. Opening/saving now restores the start of the estimate workspace to keep the result findable.

## Important tested boundaries

Exact rational rounding and indirect-cent reconciliation; source numeric example; zero overrides; explicit foreign resource/estimate rates; hierarchy/units/cross-company inputs; duplicates; stale versions; independent amount authority; immutable approved evidence; retained cancelled revision numbering; customer snapshot changes; live preparer/reviewer permissions; scoped list/detail/search/export; idempotent atomic handover with zero budget release; invalid handover rollback; additive sample idempotence; authenticated route/preview restrictions.

The arithmetic and workflow tests do not certify cap/share formula parity, workbook migration, all sales/contract states or the full ERP. Those remain open in the comparison overlay. No browser credentials, access changes, external bids, contracts, real transfers, GitHub pushes or deployment were performed.

Final check: 177 tests pass after active-project handover guidance was added. The final build passes. The USD company browser view shows four latest studies, USD 102,094.40 estimated cost and USD 134,764.61 potential selling value, with only Creek/project and company records. `browser-usd-company.txt` retains the observation. `desktop-estimate.png` shows the saved local Harbour revision; the final browser console has no warning/error entries. The temporary authoring server was stopped; the persistent preview remains running.
