# Builder ERP

An original construction ERP for the journey from bidding and tendering through site delivery, snagging, handover and final settlement. Built from scratch without copying or depending on Odoo application code.

**Continuing on another laptop or ChatGPT account? [Start here](START-HERE.md).** The handover contains setup instructions, the current state, remaining scope, the exact next step and a prompt for a new coding assistant. This repository is the user-designated source of truth; the previous chat and original Mac are not required.

## Current status

The latest step is the **[customer-credit accounting foundation](docs/implementation/customer-credits-local.md)**. Customer-credit allocation/refund service/API now has independent zero-default authority, exact carrying/FX, cross-project balancing, reservations, retained evidence, bank matching and scoped AR findings/CSV (schema 19). Dedicated credit UI/examples, settlement reversals, ownership handover and full source parity remain open. All 279 automated tests and the frontend build pass. The saved database has 111 tables. This remains an incomplete ERP, not a production release or completed migration.

The full scope remains **267 functions, 34 data contracts and 21 domains**. [Implementation coverage](docs/implementation/coverage.md) records every function and its supporting evidence. No row is certified as full migration parity. Some visible registers still contain read-only synthetic examples, and no production source export/import/reconciliation has occurred.

The original implementation advanced before a sufficient functional comparison. The [comparison and migration correction](docs/migration/README.md) records that gap and the complete required scope. Keep it distinct from the later implementation overlay; menu coverage and examples do not prove business-workflow parity.

## Working local subsets

| Area | Implemented path and detailed limits |
|---|---|
| Access and identity | [Permission-based destinations](docs/implementation/access-and-destinations.md), [individual local accounts and reviewed access](docs/implementation/identity-local.md) |
| Project foundations | [Companies, projects, locations, WBS and independent budget control](docs/implementation/foundations-local.md) |
| Shared masters | [Contacts, reviewed supplier terms/currencies and catalogue/packs](docs/implementation/masters-local.md) |
| Procurement and materials | [Demand → supplier quotes/FX → review → orders → deliveries/returns/consumption](docs/implementation/procurement-local.md) |
| Quality | [NCR containment, investigation, corrective work and independent verification](docs/implementation/quality-local.md) |
| Accounting | [General ledger and controlled reversals](docs/implementation/ledger-local.md), [matched supplier bills and return credits](docs/implementation/payables-local.md) |
| Supplier settlement | [Payment/refund review, evidenced recording and independent bank matching](docs/implementation/payments-local.md) |
| Estimating | [BOQ/resources/building overrides and revisions](docs/implementation/estimates-local.md), [reviewed XLSX/CSV intake with source lineage](docs/implementation/boq-intake-local.md) |
| Offers and awards | [Approved estimate → offer → acceptance evidence → original contract BOQ](docs/implementation/commercial-local.md) |
| Client certification | [Finance policy → cumulative measurement → three reviews → separate AR invoicing](docs/implementation/certificates-local.md) |
| Client advances | [Request/invoice/receipt, protected recovery and reports](docs/implementation/advances-local.md) |
| Client corrections | [Full source withdrawal, independent review, exact credits and report findings](docs/implementation/correction-workspace-local.md) |
| Customer receipts | [Invoice allocation → independent approval → recording → bank match/correction](docs/implementation/receipts-local.md) |

These paths include service-enforced company/project permissions, exact currency calculations, independent financial authority, retained history, meaningful examples and report findings for their implemented populations. They do not complete the surrounding domains. See [validation evidence](docs/validation/) and [the project log](docs/project-log.md).

**Next:** customer-credit UI/examples, exact settlement reversals, partial/forward adjustments and ownership handover. The [handover](START-HERE.md#where-to-pick-up-next) identifies the evidence, files, controls and wider required work. Retention releases, variations, subcontracts, programme/site/handover, assets/people/supporting ERP, full reports/KPIs, governed AI and actual migration remain in scope.

## Run locally

Install Git and Node **24.x, at least 24.15** (`app/.nvmrc`), then:

```sh
git clone https://github.com/JameelKhab/Builder-ERP.git
cd Builder-ERP/app
npm ci
npm test
npm run build
npm run local
```

Open **http://127.0.0.1:4173/**. The launcher starts both frontend and API, on loopback ports 4173 and 4174. `npm run dev` alone does not run the API. No OpenAI key, previous ChatGPT account or Odoo installation is required for the current application.

An empty checkout creates the local SQLite database and adds fictional examples for both companies and all three projects. Data is saved under `.work/data/builder.sqlite` at the repository root; existing work is preserved on restart. The **Examples** button explains each available feature. Samples are not migrated production records.

Owner setup/sign-in is available from the profile or with `npm run local -- --secure`. The user chooses real credentials. Once owner setup is completed for a database, sample login remains disabled. Do not reset or replace a database to bypass sign-in. The private portable handover described in [START-HERE.md](START-HERE.md#what-moves-with-github-and-what-does-not) preserves the original saved demonstration workspace separately from source history.

Dependencies are pinned in `app/package-lock.json`. The original Mac used cached packages because its certificate gateway prevented the first online install; TLS verification was not disabled. A fresh install, dependency/security review, financial localisation, representative-user/accessibility acceptance and full migration reconciliation remain release gates. The retained Sites worker serves static assets only; the frontend build does not deploy the Express/SQLite ERP backend.

## Product and project rules

The user's priority is **easy to read, easy to operate, rich in information**. [Choice 2, Project briefing](docs/design/visual-directions.md) supplies the visual direction. Home shows permitted destinations; project work uses Overview, Plan, Site, Buying, Costs & Contracts, Documents and Handover. Keep one canonical record with clear next action and expandable evidence/history; avoid repetitive nested menus and tabs.

Every report begins with findings calculated from the complete authorised filtered result. Future AI must explain supported facts and prepare reviewable drafts; it must not silently approve, post, pay, close or make external commitments. No external AI provider is connected yet.

Read [AGENTS.md](AGENTS.md), [requirements](docs/requirements.md), [decisions](docs/decisions.md), [coverage](docs/implementation/coverage.md) and [original implementation contracts](docs/implementation/contracts/) before extending a domain. The [comparison PDF](docs/migration/Builder-ERP-Full-Comparison.pdf), [searchable 267-function register](docs/migration/Builder-ERP-Comparison-Register.html), [data contracts](docs/migration/Builder-ERP-Data-Contracts.csv) and [study history](docs/study/README.md) remain in Git.

**Verified work may now be synced to this GitHub repository. Development stays local. Do not deploy to JAKH or mutate its existing demo.** Runtime databases, credentials, private environment files, dependency directories and scratch tools stay outside Git. Earlier local-only sync entries are historical and superseded by the user's 29 October handover instruction.

Latest checkpoint (30 October): Client correction entry/detail/review, source links, My Work/search, scoped project/company findings/CSV and 27 additive examples across both companies/all three projects are now connected. Exact independent full source withdrawal preserves originals and retained cash. Customer-credit allocation/refunds, partial/forward adjustments, ownership handover and full source parity remain open. See [correction workspace progress](docs/implementation/correction-workspace-local.md).
