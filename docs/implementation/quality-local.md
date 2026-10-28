# NCR management · local implementation · 29 October 2026

Original schema 7 and a connected NCR workflow now replace the earlier read-only NCR-only experience. Home → **Quality & NCRs**, Company → Resources & operations → Quality & NCRs, and Project → Site → Quality & safety open the same scoped cases. Historical generic quality/HSE examples remain clearly separate. The full ERP goal remains active.

## Working lifecycle

A draft records the requirement, observation, severity, location, work item, owner, independent reviewer, dates and optional receipt reference. Submission requires observation evidence. Immediate containment can be recorded before the root cause is known. The responsible owner then prepares cause, disposition, corrective/preventive actions, acceptance criteria and consequences. A revised plan or containment needs matching current evidence before submission. Use-as-is also requires an external authority reference and authority evidence; Builder does not certify that external authority.

The assigned independent reviewer accepts or returns the plan. Action owners attach their own evidence and record completion. After all actions are complete, the owner requests verification. The reviewer records fresh verification evidence and the result against the stated criteria. Failure returns a selected action for further work and requires new completion evidence. Closure is separate from completion. Reopening creates a new cycle without deleting earlier plans, actions, files or decisions.

Independence includes reporter, current owner, plan authors and historical action completers within the cycle. Reassignment cannot erase a past contributor’s conflict. Active access and case version are rechecked on every operation; pending review can be withdrawn, and authorised reassignment handles a departing owner. No browser security grants or real credentials were changed.

## Evidence, company control and reporting

Files are stored as append-only database blobs with original bytes, SHA-256, name/type/size, description, purpose, cycle, author and time. Supported PDF/PNG/JPEG/plain text files have signature checks and a 2 MiB limit; downloads require case access and use attachment-only responses. This is local NCR evidence storage, not a completed document-control, retention or malware-scanning system.

Company/project scope applies to cases, assignments, options, files, search, My Work, reports and exports. Project managers and QA officers have distinct preparation/review capabilities; site and technical engineers can prepare but cannot independently approve. Role preset changes are explicitly versioned and add no financial approval limit. A role preview cannot write. Project readers receive no cost or price payloads from the NCR model.

Each case assesses cost, waste, change and delay consequences. A follow-up has an owner, due date and reason and remains visible after quality closure. These are obligations to assess downstream work, not automatic costs, cash, scrap movements, approved variations or delay claims. Their typed operational resolution remains open with those domains.

The current-state NCR report supports project/company, state and severity filters. Findings use the full authorised result and link to supporting cases. CSV begins with matching scope, findings and limitations, then all rows; text cells are protected against spreadsheet formulas. Reopened cases count once by current state. Dates used for overdue findings currently follow the server’s UTC operational day; company fiscal/timezone configuration remains open. This report is not historical as-of reconstruction, an inspection first-pass KPI or HSE incident reporting.

## Examples and checks

Five additive examples in each supplied project demonstrate draft, corrective work, reopened history, plan review and verification. A fictional QA reviewer has scoped quality capabilities and no purchase/budget authority or configured credentials. Sample facts do not certify actual site work. The pack preserves earlier records and financial openings.

Browser QA saved **NCR-50DE1F1E**, “Example · Level 12 finish inspection”, at Harbour Tower / Level 12 / Finishes & façade. Missing observation evidence blocked submission with clear feedback. A synthetic text attachment was saved, the case submitted, and immediate containment recorded. Revision 5 remains **Investigate & plan**, due 4 November 2026; no physical instruction, independent approval or closure was performed in the browser. Persistence after restart, search and desktop/mobile layout were checked. A date-input persistence issue found in this walkthrough was corrected and rechecked.

Validation: see `../validation/quality/verification.md`. Recovery preserves all earlier rows/columns in 46 tables and matches 51 restored tables, including attachment bytes. Zero real individual credentials are configured in the persistent sample workspace.

## Retained work

F149 and M28 are partial, not full source parity. Full inspection/ITP and hold-point controls, restricted HSE incident handling, snag/handover workflows, controlled document versions/distribution, configurable review routes/delegation, approved-plan amendments during work, downstream consequence resolution, advanced quality/KPI/aging analysis, source import/reconciliation and representative-user acceptance remain open. The unchanged full scope still contains 267 functions, 34 contracts and 21 domains. All work is original, local and unpushed; the source demo was inspected read-only.
