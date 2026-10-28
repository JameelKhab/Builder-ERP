# Builder ERP

An original construction ERP for the complete journey from opportunity and tender to site delivery, handover, snagging and final settlement.

The priority is a simple interface with rich, traceable information. The replacement must be built from scratch without copying, adapting or depending on Odoo application code.

## Current status

**The first working local increment is implemented**, following the user's selection of [choice 2, Project briefing](docs/design/visual-directions.md), refined into clearer information categories. Open the running development app at **http://127.0.0.1:4173/**.

Working features include persistent purchase requests, vendor quote repricing/currencies, independent approval, company/project scopes, cost reports with deterministic findings, source breakdown and CSV export. Other construction registers are read-only synthetic examples. **The complete ERP is still in development; this is not a production release.** See [implemented scope and next increments](docs/implementation/local-increment-1.md).

Discovery remains recorded in the 53-page Revision 4 study. The navigation has been reviewed in a browser, but has not been validated with representative users.

**Development, testing and Git commits stay local for now. Do not push to GitHub, deploy to jakh.net or change the existing demo.** GitHub is the intended remote project record, but the user has deferred syncing. Resume GitHub pushes only when instructed. A future deployment requires a separate explicit instruction after local work is complete.

## Start here

- [Requirements](docs/requirements.md): confirmed scope, proposed structure and acceptance criteria.
- [Decisions](docs/decisions.md): user requirements, proposals and unresolved choices.
- [Project log](docs/project-log.md): work completed, evidence and next steps.
- [Current study](docs/study/JAKH-ERP-Read-Only-Study.pdf): the complete report; new company/currency/reporting/AI requirements are on pages 44-53.
- [Study contents and history](docs/study/README.md): prior revisions, source evidence and authoring material.

## Selected experience

Four starting points: **My Work, Tenders, Projects, Company**.

Within a project: **Overview, Plan, Site, Buying, Costs & Contracts, Documents, Handover**.

Company and project scope remain visible. Different views open the same records. A user should see the next action immediately and be able to open quantities, costs, evidence, approvals and history without re-entering the same facts.

The user selected the visual direction. Representative-user validation of labels and task completion remains necessary; see the study's twelve walkthroughs and usability criteria.

## Project record

Keep requirements, decisions, code, meaningful validation results and deliverables in this repository. Record corrections and uncertainty explicitly. Do not commit credentials, real bank/payment instructions, private environment files, dependency directories or transient render caches.

The study sources are report-authoring tools, **not ERP application code**. No production deployment workflow is configured here.

## Local development

Use Node 24.15.x (see `app/.nvmrc`), then:

```sh
cd app
npm ci
npm run local
```

The launcher starts the frontend on `127.0.0.1:4173` and the API on `127.0.0.1:4174`. Both bind to loopback. Data is saved in `.work/data/builder.sqlite` at the repository root and seeded only when empty. Restarting preserves records. Do not delete that file to reset a workspace; archive a stopped development database first.

The explicit local-sample mode signs in a synthetic project manager. It is **not production authentication**. Do not put confidential business data into this sample or expose it to a network. Production identity, financial localisation, infrastructure and recovery are separate implementation gates.

```sh
npm test
npm run build
```

Validation on 28 October 2026: 25 tests passed; frontend build passed; primary workflows and responsive layouts checked in the browser with no warning/error console entries. See [design QA](app/design-qa.md) and [architecture](docs/implementation/architecture.md).

Dependencies are pinned in `app/package-lock.json`. This laptop's certificate gateway prevented an online install, so the first install used cached registry packages without disabling TLS. No vulnerability-audit result is claimed. A clean dependency/security review remains a release gate.

The retained Sites starter worker serves static assets only. `npm run build` does not package the SQLite/Express backend for deployment. No deployment pipeline has been added.
