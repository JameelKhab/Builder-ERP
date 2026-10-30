# Client corrections — local user journey

30 October 2026. The full-annulment preparation/review journey now connects to the schema-18 service. This is a working correction subset, not the whole client-credit lifecycle or accepted migration parity.

## User flow

Open an approved advance or certificate and choose **Request full correction**. A source with an existing request instead links to **Open correction**. The company/project **Client corrections** register offers the same canonical records. The form asks for source, date, reason and evidence; **Save & review impact** keeps a draft until its author submits it. Previously covered sources are excluded from the normal new-request selector.

The detail leads with next action, full invoice credit, cash retained in the review basis and original source. Blockers, reason and evidence precede the decision. Review/accounting history is progressive detail. Missing evidence, stale sources/reviewers, certified recovery and closed periods disable acceptance with the reason retained; a permitted reviewer may still return the request. Independent finance application requires an explicit impact acknowledgement in the UI. Unbilled source withdrawal clearly states that it posts no accounting credit.

My Work and search expose only authorised correction records. Project/company reports begin with full-population findings, separate currencies and effective-date cutoff. Original AR carrying credits reconcile to the selected ledger postings; CSV includes every selected row, findings and definitions with formula escaping. Operational statuses reflect current knowledge, not a historical reconstruction. Source references, journal links and evidence remain scoped.

The existing role and separate amount authorities remain unchanged. Source-write and AR-read permissions govern preparation; reviews retain the separate technical/commercial/finance route. No new capability is implied by a menu or administrator role. Correction options validate company/project ownership and source access. Read-only role preview cannot mutate.

## Examples and data preservation

An explicitly enabled versioned example pack creates nine correction scenarios in each of Harbour Tower, Garden Residences and Creek Offices: unbilled withdrawal, unpaid full credit, finance review, returned review, cancelled request, credited certificate/recovery, credited paid advance retaining cash, replacement certificate awaiting technical review, and a blocked recovery dependency. New contracts and two new synthetic users carry these examples; existing documents, users, policies and limits remain intact. The shared example contract builder is reused by advance/correction packs.

Saved workspace: schema 18, 106 tables including schema_versions, 27 corrections, 42 advances and nine raw recovery allocations. All original business rows remain unchanged; journal numbering advances only for newly posted fictional examples. A consistent pre-change backup, scratch installation and actual saved installation were checked; both separately restored copies match every table and sample installation is idempotent. No real identity, source migration or real transaction was added.

## Verification and remaining scope

269 tests and frontend build pass. Three new workspace/example/report cases and the extended individual HTTP journey cover source links, current authority, project isolation, My Work/search, cutoff/currency selection, complete CSV, preserved cash, idempotence and additive data. Fourteen affected service/API cases pass again after readiness wording changes. Browser checks used disposable data: create a draft, block missing evidence, revise and submit retained evidence, independently apply through My Work and follow the original source. Final company report reconciles AED 1,961.18 with zero difference. See [validation](../validation/correction-workspace/README.md).

Next: reviewed customer-credit allocation/refunds with original carrying values, independent cash recording and bank matching. Partial/forward adjustments and unavailable-author handover remain distinct required workflows, followed by retention/securities/final accounts, variations, the full construction/supporting ERP backlog, production migration/reconciliation and representative-user acceptance. No full function has migration-parity certification. Desktop browser evidence does not establish mobile/accessibility acceptance.
