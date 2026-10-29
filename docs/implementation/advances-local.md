# Client advances — request and accounting foundation

29 October 2026. **Intermediate backend implementation, not an accepted end-to-end advance feature.** All 267 functions, 34 contracts and 21 domains remain in scope. F092's recovery acceptance has not passed because certificate recovery is still unfinished.

The [original contract](contracts/client-advances-v1.md) defines the full request → invoice → actual receipt → protected recovery journey from retained read-only source evidence. This checkpoint implements request approval, canonical invoice posting and receipt-derived paid-principal facts. It deliberately does not advertise a completed Client advances destination.

## Implemented and verified

- Typed, company/project/contract-scoped requests, dated principal/tax/FX/account snapshots, retained original file/hash and immutable decisions. Separate advance authority defaults to zero. Independent approval rechecks live author, finance policy/reviewer, accounts, version and aggregate approved principal against the original contract ceiling. Returns and cancellation retain history; approved records cannot reset.
- One canonical client invoice sourced from an approved advance or certificate. AR submission and independent posting retain their separate authority. Advance principal credits a dedicated liability control; explicit exclusive tax credits tax; no measured revenue, retention, cost or cash is manufactured. General journals cannot use the advance control.
- Existing receipt infrastructure allocates actual cash to the advance invoice. Paid principal/tax are derived from cumulative recorded receipts/corrections, with exact final cents and original invoice carrying values. Request FX, invoice FX and actual bank FX remain distinct. Source invoice reporting for measured work excludes advance invoices; shared AR/receipt reconciliation includes both.
- Authenticated local API routes for request preparation/revision/decisions/detail/evidence, alongside the existing canonical invoice/receipt endpoints. Client-supplied author/state/journal/amount cannot replace controlled values; scope and read-only preview apply. Access review and account setup support the new separate authority/control.
- Schema 16 preserves existing invoice IDs, all receipt foreign keys and account history. Three new tables: requests, evidence, events. Of the previous 99 tables including `schema_versions`, all 98 domain tables' original columns/rows are identical; the version table retains its 15 rows and adds 16. The upgraded count is 102 including the version table. No existing user receives advance approval authority and no new saved examples or real identities are installed.

## Current dependency and next required work

**Certificate recovery allocations are not implemented.** New measurement at a cutoff with paid advance principal is explicitly blocked rather than certifying a misleading zero deduction. Earlier certificates and periods with no paid advance remain valid. Replace this temporary dependency guard with the specified recovery allocation/reservation/posting/correction flow; do not remove the guard without implementing those controls.

Next: invoice-level principal/tax/original-carrying recovery allocations; exact current/cumulative cap; independent certification reservation; once-only liability clearing with evidenced FX; receipt-reversal protection before every financial transition; report/control reconciliation and scoped export; one simple Client advances destination, source links/My Work/search and meaningful additive examples in all supplied scopes; desktop/mobile browser acceptance and recovery rehearsal. Taxed/foreign recovery and post-recovery credits require explicit evidence-backed policies. Approved-request cancellation, credits, lost-author handover, retention release/securities/final accounts remain open.

The existing invoice viewer can display an advance invoice. No dedicated advance creation screen or complete advance report is provided yet. The frontend check in this checkpoint only verifies that the preserved receipt workspace still loads after upgrade, not advance usability acceptance.

## Verification

**241 tests pass; build passes.** Nine new domain tests and one individual-identity HTTP journey verify the connected foundation, partial/final cents, foreign FX, independent limits, competing allowance commitments, stale/revoked authority, periods, source integrity, evidence privacy, immutability, reversal and the temporary recovery guard. Earlier tests remain green. Initial loopback test failures were sandbox `EPERM`; the authorised local HTTP run passed. Early fixture call/amount/assertion errors were corrected; these were not source-parity failures.

[Validation](../validation/advances/README.md) includes full test/build output, per-table saved/scratch/rollback hashes and browser continuity evidence. A pre-upgrade consistent SQLite backup was retained. A mid-migration injected failure restored schema 15 and foreign-key enforcement with every original row unchanged. No deployment, JAKH mutation or real financial action occurred.
