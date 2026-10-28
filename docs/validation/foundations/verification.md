# Local foundation verification — 29 October 2026

- Full suite: 79 tests passed (retained `tests.txt`). Includes original baseline through an actual HTTP purchase order, immutable approvals, live scope and amount limits, double-count protection, stale/concurrent proposals, capacity/cost reductions, hierarchy cycles, wrong-company references, example idempotency and transaction rollback.
- Final browser warning/error log: empty.
- Frontend build passed. `git diff --check` passed.
- Before schema 4, backed up the runtime SQLite database with its backup API to ignored `.work/data/builder-before-foundations-20261029.sqlite`; integrity passed and all 13 earlier requests were present.
- After implementation, a separate restored copy matched every row/value in 17 checked tables, including budget lines/facts, setup events, grants, projects, locations and the earlier procurement history. Integrity/foreign-key checks passed. See `recovery.txt`.
- Read-only JAKH evidence: opened Budget revisions (empty sampled list), inspected a new unsaved form and discarded it. Retained source help/fields and screenshot. No source business mutation, save, approval, import or access change occurred. Visible help is not an executed source acceptance test.
- Browser desktop 1440×1000: Home → Contracts & costs → Budget control; approved example shows original, pre-proposal and approved targets, release delta, independent reviewer and history. Edited local fictional draft BUD-5A9E8AED to AED 18,022,000 proposed revised budget (AED 22,000 change); saved at version 2 and remained in the review detail. No budget approval or real financial commitment was made in browser QA.
- Browser project setup: added fictional floor A-L13 under Building A. Reload/server restart retained it and the edited budget. Parent-first ordering shows Site → Building → Floor → Unit, then the next floor.
- Browser mobile 390×844: budget table becomes labelled records. Document scroll width = viewport width = 390; no page overflow. Full-page screenshot retained.
- Read-only engineer preview: project/location/work structure remains available; budgets, monetary columns, setup mutations and administrative destinations are absent. Preview was exited; no browser grant was applied.
- Runtime remains loopback only at ports 4173/4174. Explicit sample identity, original source import/reconciliation, representative-user validation and full ERP parity remain open. These checks are not a production security or migration certification.
