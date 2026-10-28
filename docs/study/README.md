# Study record

The current report is [Revision 4](JAKH-ERP-Read-Only-Study.pdf), 53 pages, dated 28 October 2026. [Plain text](study-revision-4.txt) is provided for search and future implementation work. The PDF is the reviewed presentation.

## Reading guide

| Pages | Contents |
| --- | --- |
| 1-5 | Summary, proposed navigation and daily experience |
| 6 | Exact homes for the twelve requested areas |
| 7-8 | Construction lifecycle and difficult cross-team journeys |
| 9-11 | All 42 current primary menus mapped to proposed destinations |
| 12-13 | Findability checks and proposed usability validation |
| 14-22 | Earlier live UI findings, screenshots and construction coverage |
| 23-38 | Existence/need mapping and details for all twelve areas |
| 39-41 | Original-code scope, migration and validation scenarios |
| 42-43 | Live evidence index and inspection limits |
| 44-46 | Multiple companies, vendor currencies and worked FX example |
| 47-49 | Project/company/group reports and report-findings logic/examples |
| 50-53 | Strategic AI placement, controls, rollout and acceptance checks |

## History

- [Revision 1](archive/study-revision-1.pdf): initial read-only construction and navigation study.
- [Revision 2](archive/study-revision-2.pdf): 32 pages; deeper examination of the twelve requested areas.
- [Revision 3](archive/study-revision-3.pdf): 43 pages; revised mapping, complete primary-menu traceability and task walkthroughs.
- Revision 4: 53 pages; company, currency, reporting and AI requirements.

Revisions 3 and 4 reassess/extend the study; they do not constitute new live app tests. No staff usability test, functional state-transition test, security audit, migration or ERP implementation was performed.

## Evidence and provenance

- [Navigation inventory](Navigation-inventory.txt): observed structure, qualifications and revised mapping/addenda.
- [Project navigation screenshot](Project-navigation-evidence.png): accepted E33 screenshot.
- [Source evidence](Source-evidence.zip): 189 archive entries, including accepted screenshots/accessibility snapshots and the evidence manifest. Rejected visual captures and the full third-party NCR page reproduction are excluded as documented in the archive.
- [Validation records](validation/): report layout/content checks from prior revisions. These validate study artifacts, not the ERP's business controls.
- [Artifact manifest](manifest.json): sizes and SHA-256 checksums of the preserved study files.
- [Authoring history](archive/study-authoring-history.zip): historical report scripts and working analysis. Paths in those historical scripts refer to the original laptop workspace; use the portable current tools below for a fresh build.

The supplied login credentials are not part of this record. The audit used the demo's sample records; observations are limited to the selected role/company and saved date. Empty lists and repeated menu labels are not proof of missing or duplicate functionality.

## Current authoring tools

The current source is in [tools/study](../../tools/study/README.md). It reads the preserved evidence archive and generates a review copy under ignored `.work/study/output/` by default. It does not modify the ERP or contact the live site. Preserve reviewed report revisions before replacing the current PDF.
