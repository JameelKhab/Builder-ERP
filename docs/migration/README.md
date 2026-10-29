# Functional comparison and migration correction

The user expected a full proper migration preserving JAKH ERP's strong business logic in original code. The initial implementation did not satisfy that expectation. It advanced before the detailed functional/data mapping was complete. This package records that gap and the corrective scope; it does not certify a completed migration.

## Deliverables

- [Comparison report](Builder-ERP-Full-Comparison.pdf): findings, all 42 area mappings, 21 connected workstream comparisons, company/currency/report/AI requirements, original data architecture, migration/reconciliation sequence and twelve acceptance journeys.
- [Searchable offline register](Builder-ERP-Comparison-Register.html): all 267 recorded destination controls, each with exact old path, proposed home, current Builder gap, required behaviour, specific acceptance example and source confidence.
- [267-row CSV](Builder-ERP-267-Function-Comparison.csv) and [42-area CSV](Builder-ERP-42-Area-Map.csv): reviewable mapping records.
- [34 proposed data contracts](Builder-ERP-Data-Contracts.csv): source-visible labels/concepts, proposed target entities/fields, present gaps and invariants. Exact export schema is still needed; these are not executable import mappings.
- [User requirements coverage](Builder-ERP-User-Requirements-Coverage.csv): all twelve requested operational areas, company/currency/report/AI requirements, full migration, naming and examples linked to the comparison.
- [Structured comparison](comparison.json) and [evidence manifest](Evidence-manifest.json): reproducible records and source hashes.
- [Fresh evidence](evidence/): dashboard and project-control report captures from this review. Original source observations remain in `../study/Source-evidence.zip`.

## What is and is not complete

The retained expanded navigation parses into 42 primary areas, 96 groups and 267 leaf controls. Every leaf has one stable F-number, a required behaviour and an acceptance example. Repeated labels remain separate until identical targets, permissions and semantics are proven. A leaf is not necessarily a unique business feature.

The application compared is commit `3d941a0`. Seven destinations have a relevant executable subset, 27 have related illustrative examples only, and 233 have no corresponding operational implementation. These labels are conservative inventory classifications, **not a completion percentage**. No destination is certified as full parity. Domain descriptions explain both implemented subsets and missing depth. Related examples do not imply a dedicated screen or service for every source destination.

Every parity acceptance example is **NOT RUN**. The previously passing 30 application tests verify the narrow current implementation, not source equivalence. The sample-pack upgrade is not a JAKH data migration. No production export, full source data dictionary, importer, financial reconciliation or cutover rehearsal exists yet.

Source confidence is per row: navigation only; linked record only; recorded form/screen; or a screen rechecked this review. Stated screen rules are evidence of intended behaviour, not proof of enforcement. Domain-level evidence must not be attributed to a specific leaf without inspection. Payroll depth and some integration/custom-builder behaviour remain explicit verification questions, not silently excluded scope.

## Method and provenance

The source baseline is the 28 October 2026 Revision 4 study and its evidence archive. Fresh read-only review reopened the source dashboards for two companies and the Marina Gate construction control report. The same 42 primary areas were visible. Opening the control report generated a report-view record; no business transaction was edited, approved, posted, paid, closed or deleted. Not all 267 destinations were revisited live in this correction review.

The source demo resets nightly and is not a substitute for a controlled production data export. No Odoo application code was read into or copied into the new application. Visible labels, rules and relationships inform original requirements and services.

Rebuild the package using `tools/migration/build_comparison.py` with Python and ReportLab. Authored comparison content is in `comparison_content.py` and `report_sections.py`. Rebuild is deterministic apart from PDF metadata. Validation results are in `validation.json`; rendering caches are ignored under `.work/parity/`.

## How implementation proceeds

Before accepting a domain, connect its F-numbers and M-numbers to verified forms/fields, state transitions, calculations, permissions, exceptions, original schema/services, UI routes, tests and reconciliation evidence. Resolve unknown source behaviour through further read-only inspection and controlled exports; do not ask the user to enumerate the entire missing scope.

The latest user direction adds a permission-dependent Home with an original Builder appearance. Retain the existing work areas beneath it and add discoverable named destinations for all meaningful work. See [the access/destination progress overlay](../implementation/access-and-destinations.md); this historical comparison remains frozen to its stated application baseline. Use typed entities and canonical linked transactions rather than generic JSON cards. Maintain full supporting ERP and administration scope. Complete connected operational journeys and migration/recovery rehearsal before claiming replacement readiness.

Development remains local. The user’s 29 October instruction authorises verified GitHub sync to JameelKhab/Builder-ERP; deployment remains unauthorised. Source bundles do not contain the ignored runtime SQLite database.
