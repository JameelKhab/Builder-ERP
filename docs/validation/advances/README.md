# Advance foundation verification — 29 October 2026

This evidence supports the request/invoice/receipt backend foundation only. Certificate recovery, dedicated UI, complete reporting/examples and full F092/source parity remain unfinished. See [implementation and exact continuation](../../implementation/advances-local.md).

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
