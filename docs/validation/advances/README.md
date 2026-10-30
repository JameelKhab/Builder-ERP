# Advance foundation verification — 29 October 2026

The foundation sections below are historical. The latest connected-recovery section supports request/invoice/receipt through protected certificate recovery. Dedicated advance UI, complete subledger reporting/examples and full F092/source parity remain unfinished. See [implementation and exact continuation](../../implementation/advances-local.md).

- `tests-foundation.txt`: 241 passing tests, including nine advance domain journeys and one authenticated HTTP journey.
- `build-foundation.txt`: successful frontend/static packaging build; not a backend deployment.
- `migration-foundation.json`: saved schema 15 → 16 upgrade, scratch upgrade and injected rollback. Every original domain row/column and evidence byte is preserved; original schema-version rows remain. Both constraints and immutability objects survive replacement of the account/invoice tables. All integrity/FK checks pass. Counts include `schema_versions`: 99 → 102; domain tables alone: 98 → 101.
- `recovery-foundation.json`: consistent schema-16 saved snapshot restored into a separate file and reopened through current migrations/examples. All 102 tables, including evidence bytes, match; integrity/FKs pass and real identities/sessions remain zero.
- `workspace-after-upgrade.txt` and `workspace-after-upgrade.png`: existing receipt workspace after local server restart. This is a continuity check, not an advance usability test.

The private pre-upgrade backup remains outside Git. The migration check injects a failure immediately before creation of the replacement invoice table, after the account-table replacement and new request tables; rollback restores the old schema and every checked original row, and restores FK enforcement.

Source observations remain in `../receipts/source/` and `../certificates/source/`. This checkpoint does not add source-enforcement evidence or a production migration. No private runtime database, credential, actual bank transaction or source application code is committed.

## Recovery groundwork and continuity checkpoint

- `tests-recovery-foundation.txt`: all 246 tests pass, including five new arithmetic/schema tests. A placeholder-count error in the new test fixture was corrected before the passing run.
- `build-recovery-foundation.txt`: frontend/static build passes.
- `migration-recovery-groundwork.json`: scratch upgrade verified before upgrading the saved schema-16 database. Every original row/column across 102 tables remains; a separate restored schema-17 snapshot matches all 103 tables. Integrity/FKs pass; saved identities, sessions, advance requests and recovery rows remain zero.
- Recovery service/UI/posting/reporting are still unfinished. The new allocation table is empty, future policy fields remain unconfigured, and the existing paid-advance certificate guard is retained. The continuation notes distinguish implemented groundwork from planned accounting.

## Connected recovery — current checkpoint

- `tests-connected-recovery.txt`: all 253 tests pass. Sixteen advance domain tests, five arithmetic/schema tests and one expanded authenticated HTTP journey cover the current advance/recovery subset alongside the broader suite. The HTTP journey uses separate individual roles for preparation, receipt approval/recording, measurement and three reviews, AR posting, and a denied protected-receipt reversal.
- `build-connected-recovery.txt`: frontend/static build passes; local backend remains required.
- `connected-recovery-data.json`: schema remains 17. All 103 saved tables are unchanged after reopening the current implementation. A separate consistent backup restored/reopened through examples matches all 103 tables, with clean integrity/FKs. Saved identities/sessions/advances/recoveries remain zero. No fictional recovery fixture was inserted into the saved workspace.
- `recovery-certificate.png` / `.txt`: disposable browser example with 100.00 principal recovery, 5.00 original-tax release, 251.13 net work tax and 5,017.66 receivable. Source invoice navigation was verified. The initial ambiguous percentage/net-tax label was corrected before final capture.
- `recovery-policy-form.txt`, `recovery-policy-saved.txt` / `.png`: selected original-tax policy changes the net-basis explanation; a draft saved with the selected accounts and treatment, while independent activation remains required. This was an isolated in-memory fixture, closed after verification. Browser label selectors were narrowed to resolve option-text ambiguity; an accidental empty-form submission was blocked by required fields and changed no data.
- A 390-device-pixel viewport at the browser's existing zoom produced a 300-CSS-pixel document, with equal document/viewport widths and 16px body text. Browser capture scaling was inconsistent after emulation; no claim of complete mobile visual acceptance is made, and misleading mobile captures were discarded. Device overrides were cleared and the disposable tab/server closed.

Core verification covers certified-but-unposted reservations, pending approved and draft reversal interaction, original carrying values and explicit tax/foreign policies, independent bank FX, tax-inclusive invoice caps, atomic certification rollback, stale/revoked authority, cutoff exclusions, multiple invoice sources, final residual cents, selected-invoice control reconciliation and matching CSV. Full advance entry/report/examples, credits/cancellation and source acceptance remain open.

## Client advances UI/report/examples — current checkpoint

- `tests-ui-workspace.txt`: 256 tests pass, including 18 advance service tests, extended authenticated HTTP report/list/options permission checks and additive example preservation. Cutoff tests retain a currently certified request before its accounting date while excluding later financial values. Foreign original principal/tax carrying and selected tax-ledger reconciliation are checked.
- `build-ui-workspace.txt`: current frontend/static build passes; the backend remains local.
- `ui-data-check.json`: upgrade of a consistent scratch copy preserves original rows in all 103 tables except the required company journal sequence increments; all 103 tables match a separate restore.
- `ui-saved-data.json`: the same checks on the saved workspace and separate restore, with clean integrity/FKs, 21 fictional advances, three recovery allocations and zero real identities. Before-install backup retained privately.
- `ui-invoice-draft.png/.txt`: disposable browser prepared AED 100 principal + 5 tax through the shared invoice form and opened its canonical draft. No cash/posting implied.
- `ui-report.png/.txt`: company findings and principal control reconciliation. Later original-tax reconciliation is additionally covered in the current service/HTTP test run and saved-workspace preview.
- `ui-narrow-draft.png/.txt`: a fictional request saved from the phone-sized form and remained in its detail view. This draft exists only in the disposable browser fixture.
- `ui-narrow-report.png`, `ui-narrow-metrics.json`: readable full 390-CSS-pixel report, 16px body text, equal document/viewport width and full-width vertically stacked filters. The monetary table scrolls within its own container. Default browser screenshot scaling was inconsistent; explicit CSS-dimension CDP clipping produced the verified image. Device emulation was cleared afterward.

The new pack is enabled by the real local launcher and complete-feature example test; earlier isolated accounting fixtures keep their previous baseline. All saved original users, policies and accounting documents remain intact. Full credit/cancellation/reassignment/retention/source migration and user acceptance are still open.

- `ui-saved-report.png/.txt` and `ui-export-check.json`: refreshed saved-workspace report on 30 October shows AED 626.80 remaining principal and AED 31.34 unreleased original advance tax, both with zero ledger differences. The browser CSV download contains the same complete 14-request company population. The local sample session was refreshed after expiry; no identity or business-data reset.
