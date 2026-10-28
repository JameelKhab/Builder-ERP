# Builder ERP

An original construction ERP for the complete journey from opportunity and tender to site delivery, handover, snagging and final settlement.

The priority is a simple interface with rich, traceable information. The replacement must be built from scratch without copying, adapting or depending on Odoo application code.

## Current status

Discovery and requirements are recorded through **study Revision 4, 28 October 2026**. The report has 53 pages. The navigation proposal and requirements have not yet been validated with representative users, and no ERP implementation has started.

**Development and testing stay local. Do not deploy to jakh.net or change the existing demo.** GitHub is the versioned project record. A future deployment requires an explicit instruction after local work is complete.

## Start here

- [Requirements](docs/requirements.md): confirmed scope, proposed structure and acceptance criteria.
- [Decisions](docs/decisions.md): user requirements, proposals and unresolved choices.
- [Project log](docs/project-log.md): work completed, evidence and next steps.
- [Current study](docs/study/JAKH-ERP-Read-Only-Study.pdf): the complete report; new company/currency/reporting/AI requirements are on pages 44-53.
- [Study contents and history](docs/study/README.md): prior revisions, source evidence and authoring material.

## Proposed experience

Four starting points: **My Work, Tenders, Projects, Company**.

Within a project: **Overview, Plan, Site, Buying, Costs & Contracts, Documents, Handover**.

Company and project scope remain visible. Different views open the same records. A user should see the next action immediately and be able to open quantities, costs, evidence, approvals and history without re-entering the same facts.

This is a proposal to test, not an approved interface design. See the study's twelve task walkthroughs and usability criteria.

## Project record

Keep requirements, decisions, code, meaningful validation results and deliverables in this repository. Record corrections and uncertainty explicitly. Do not commit credentials, real bank/payment instructions, private environment files, dependency directories or transient render caches.

The study sources are report-authoring tools, **not ERP application code**. No production deployment workflow is configured here.
