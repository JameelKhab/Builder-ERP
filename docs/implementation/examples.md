# Builder ERP — feature examples

28 October 2026. Product name confirmed by the user: **Builder ERP**. JAKH Contracting LLC and JAKH International Ltd remain fictional sample legal companies; they are not the software name.

## How to explore

Open the local app and select **Examples** beside search. The guide lists every available feature, explains its purpose, shows example IDs and opens the relevant screen. Select Harbour Tower, Garden Residences or Creek Offices in the guide. Company features retain the selected legal company. Search also accepts example IDs.

The guide covers **24 feature destinations**: My Work, Tenders, 15 project categories and seven company destinations. Reports, findings/explanations, supporting items and export share the cost-report example. Company selection and the project picker expose the multiple-company/project examples. EUR and AED supplier quotes demonstrate vendor-dependent currency in the AED company; the USD company remains separate.

## What was added

**102 new sample records**: 78 project register records, 12 company register records and 12 purchase requests. Existing examples and local records are retained.

| Feature | Examples in each project |
| --- | --- |
| Programme & delays | At-risk concrete pour; resolved temporary-access constraint. |
| KPIs & performance | First-pass inspection acceptance below target; weekly plan completion on target, both with numerator/denominator. |
| Daily work | Draft concrete-preparation diary; reviewed access-route diary with quantities and resource hours. |
| Quality & safety / NCR | Concrete cover repair awaiting independent verification; closed edge-protection inspection. |
| Materials & waste | Rebar quantity balance with reuse/scrap; reconciled return of unused panels. |
| Plant & equipment | Owned telehandler approaching service; hired compactor returned with a cost example. |
| Purchase requests | Editable draft, submitted request for independent review, returned request with a reason, approved request with history. |
| Subcontracts | Waterproofing measurement/certificate calculation; mock-up joinery final review and retained amount. |
| Cost report | Existing scoped item budgets, commitments, incurred cost, cash, forecast, findings and source snapshots remain intact. |
| Changes & variations | Unapproved opening relocation with cost/time proposal; approved hardware change linked to the subcontract. |
| Payments & cash flow | Client certificate with partial receipt; subcontract certificate awaiting bill/payment review. |
| Drawings & revisions | Current construction revision C; explicitly superseded revision B. |
| RFIs & correspondence | Open service-opening clarification; answered mock-up finish query. |
| Snags & defects | Open door-clearance defect; accepted sealant repair. |
| Testing & commissioning | Emergency-lighting test with missing prerequisites; accepted mock-up water test with outstanding handover-pack records. |

Both companies also have two tender examples (estimating and bid/no-bid), two people examples (timesheet allocation and induction), and two store examples (count variance and project return). Company payment, buying, asset and report views use the same underlying project records rather than duplicate records.

## Follow connected records

For Harbour Tower, search **EX-HT-NCR-1**. Open the related drawing, daily diary or waste record. The drawing links onwards to its RFI and proposed variation. Each of the 78 new project register examples has substantive fields, a short clearly labelled example history and named links to related work within the same company/project.

Record prefixes identify the scope: **EX-HT** Harbour Tower, **EX-GR** Garden Residences, **EX-CO** Creek Offices; **EX-AE** and **EX-INT** are company-level examples. Purchase requests use **PR-EX** followed by project code and initial scenario stage. These identifiers remain stable if you progress a request to another state; the record's displayed status and version are authoritative.

Try **PR-EX-CO-RETURNED** to inspect an independent review by Maya Chen and the requester's edit/resubmit actions. No self-approval is permitted. Approved examples reserve only a sourcing allowance; they do not create purchase orders, accounting cost or cash payments.

## Preservation and limits

Before upgrading this laptop's sample workspace, a consistent SQLite backup was saved under ignored `.work/backups/`. The versioned `feature-examples-v1` pack installs transactionally once, inserts missing examples and preserves existing records, edits, request events and report opening snapshots. It does not reset the database. Its installation marker prevents duplicate events or replacement of later user changes on restart. Source Git bundles do not contain runtime databases.

The examples are fictional and clearly identified. Most registers remain **read-only**. Their histories are illustrative case narratives, distinct from the enforced purchase-request event history. Referenced drawings/photos/checklists are metadata examples; no actual files were attached. The full operating workflows, accounting and production authentication remain under development. Explain findings remains deterministic; no external AI model is connected.

## Validation

- **30 automated tests passed**, including new coverage for every feature in each company/project, resolvable related records, company/project isolation, request arithmetic/history and non-destructive repeat installation.
- The coverage snapshot in `docs/validation/examples/coverage.json` records actual authorised counts for all three projects. No guide destination was empty at installation.
- Browser checks opened the guide, selected Garden Residences, inspected its populated quality register, opened an NCR and followed its drawing link, switched to the USD company, inspected all four purchase-request stages and the returned request's history, and opened My Work from the mobile guide.
- Desktop/mobile captures verify the Builder ERP brand, examples launcher and guide. At 390 CSS pixels the document and dialog had no horizontal overflow. The browser's temporary pinch/pan capture scale was normalised for the final mobile capture; the user's 130% browser zoom was retained.
- Frontend build passed. No deployment, remote push or change to the old ERP was performed.

## Client certificate pack — 29 October 2026

`client-certificates-v1` is additive: three independently activated fictional contract finance policies, twelve measurements and nine invoices across all three supplied projects and both companies. One invoice is posted, one remains draft and one awaits AR review per project; the fourth measurement awaits independent technical review. Source BOQ/allocations are the immutable original commercial examples. No advance cash is inferred from their allowances. Six dedicated fictional staff have no credentials. Use Home → Client certificates or project Costs & Contracts → Client certificates, and expand policy/evidence/history for detail. The example guide and My Work/search use these canonical records.
