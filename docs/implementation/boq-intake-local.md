# Builder ERP — local BOQ workbook intake

29 October 2026. Local implementation against **F038**, related F021/F039/F040 and M07–M08. The complete ERP remains in development against 267 functions, 34 data contracts and 21 domains; no migration parity is certified.

## What now works

Open **Tenders → an estimate → BOQ workbook intake**. The author uploads XLSX or UTF-8 CSV, checks the suggested headings and an explicit expected total, then sends clean results through independent tender review before adding all rows to the draft. File intake does not approve the estimate or release budget. Both the register and My Work identify pending file review; search opens the same estimate.

The original workbook, SHA-256, company/project context, sheet/row/cell, product reference, cost code, exact rate and quantity remain traceable. Every saved check and decision is retained. Errors point to the exact source cell. The findings export includes the full file reconciliation, issues and candidate rows; the original file can be downloaded within the same permissions. Imported source links survive estimate revisions.

Automatic English/Arabic heading recognition and column mappings sit behind one expandable section. The main view shows the next action, findings, corrections and totals. Rates are in the estimate currency; quantities are per building. Different units are reported separately. A missing unit-cost column explicitly means zero; a blank value in a mapped rate column requires correction.

The check rejects unknown/ambiguous units, inactive or foreign-company products, product/unit mismatches, unknown cost codes, duplicate BOQ codes, formula/error/date/percentage cells, hidden/merged data and unmapped populated columns. Parent caps/shares are quarantined pending verification. ZIP/XML/CSV parsing is bounded; macros, external workbook links, unsafe ZIP paths, damaged checksums and XML DTDs are rejected. There is no formula execution or external fetch.

All files must reconcile before any append. The service rechecks the estimate version, master snapshots, calculation and reviewer authority at commitment. Changes require a new check and review. A retry returns the existing commitment; already imported files and existing codes cannot create duplicates. Existing assemblies, building overrides and prior rows remain intact. A submitted or approved estimate is never changed by intake.

## Examples and verification

Each supplied project has three intake examples: a rejected unit with cell evidence, a clean intake awaiting independent review, and an already imported item with retained source lineage. The file-format help also downloads working and unit-error examples using that company's product/cost references. Three new synthetic estimates and nine intakes were added without changing prior records or credentials.

**191 automated tests pass.** Authenticated individual HTTP users upload/check/review/commit, while author self-review, restricted scope and access-preview writes are rejected. Tests exercise multiple files, atomic failure, stale checks, master/reviewer revocation, exact totals, duplicate retries, source history across revisions, XLSX/CSV parsing, unsafe payloads and findings export. Build passes; tender UI loads separately from the main application.

Browser verification uploaded the working example into an isolated in-memory workspace: two items × two buildings reconcile to **AED 110.00**, previewing **AED 4,460.00 estimated cost / AED 5,887.20 selling**, while the actual estimate stays at **AED 4,350.00 / AED 5,742.00** until independent review and commitment. The browser never granted access, approved an estimate or posted financial facts. Correction guidance, downloaded findings, original source links, desktop and 390px layout were inspected. Representative-user acceptance remains open.

The schema-11 database was backed up before schema 12. All prior row/column values across 77 business tables are retained; reopened recovery matches all 82 tables including evidence bytes, with clean integrity/foreign keys and zero configured identities. Evidence is in `docs/validation/boq-intake/`.

## Remaining scope

Parent value caps and share distribution, assembly/override workbook sheets, larger BOQ scale, XLS/ODS, complete source-specific export mapping, exact legacy pricing parity, sales/client contracts and full award handover remain open. This is a tested direct-item intake subset, not a production JAKH migration. The source study describes richer functionality that is still tracked.

All work and commits stay on this Mac. No push, deployment, JAKH mutation, supplier communication, credential change or real financial transaction occurred.
