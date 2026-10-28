# Project log

Dates use Asia/Dubai. This log records work and its limits; Git history records the file changes.

## 28 October 2026 - Discovery and study revisions

- User requested an original construction ERP without Odoo application code, prioritising simple navigation and the full tender-to-handover lifecycle.
- User authorised a read-only study of the existing JAKH demo before redesign/coding.
- Initial audit found 42 administrator primary entries, 363 navigation button controls (96 groups and 267 leaves), role-filtered menus and fragmented project context. Controls are not a count of unique functions.
- Follow-up study mapped NCR, assets, cash/payments, subcontracts, item costs, waste, changes, programme/delay, KPIs, records, approvals and transparency. Existence was distinguished from workflow completeness.
- Revision 3 proposed four starting points and seven stable project areas, mapped every primary entry and specified task-based validation. It was a desk review, not a user test.
- Revision 4 added multiple legal companies, vendor-based currencies, project/company/group reporting, summaries derived from report results and contextual AI strategy.
- The current 53-page report was rendered and reviewed. The invented FX and reporting examples were reconciled. The retained source archive contains 189 entries; no Odoo source or supplied credentials were included.

## 28 October 2026 - Builder-ERP repository setup

- User designated `JameelKhab/Builder-ERP` as the project record and instructed that development remain local, with no deployment to jakh.net until local work is complete and deployment is instructed.
- Cloned the repository's initial `main` commit, `d84db1b`, into `/Users/jameelkhabaze/Documents/Codex/Builder-ERP`.
- Added editable requirements, a decision register, repository working instructions and this log.
- Preserved the current study, three previous PDF revisions, navigation inventory, accepted screenshot, source evidence, report validation records and authoring history.
- Adapted the current report generator to repository-relative paths, configurable fonts/output and direct access to the evidence ZIP. Generated output defaults to ignored `.work/`.
- Kept the four navigation starting points unchanged while making company/currency/reporting/AI requirements explicit in the baseline.
- No ERP application implementation, Odoo code import, production configuration, CI deployment workflow or change to the existing site was performed.

### Repository validation

- Rebuilt the report with the repository-relative tools: all 53 pages have identical extracted text and rendered pixels to the reviewed report. All 53 bookmarks were retained.
- Verified preserved artifact checksums, ZIP integrity, local Markdown links and Python source syntax. A targeted secret-pattern scan found no matches; supplied credentials were not copied.
- Temporary rebuilt PDFs and renders are ignored under `.work/`. The original reviewed PDF remains unchanged.

### Next work within the study-led sequence

1. Resolve the highest-impact entity, role, accounting, location/work-item and programme inputs.
2. Validate labels and task routes with the user/representative staff; select an interface direction before application implementation.
3. Define the original data model, permissions, financial rules and local architecture around those validated workflows.
4. Implement and test locally in coherent workflow increments, recording decisions and meaningful checks here.

The current study is a requirements baseline, not evidence that implementation or user acceptance has already occurred.
