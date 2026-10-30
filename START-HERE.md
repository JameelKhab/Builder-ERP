# Resume Builder ERP on another laptop or account

Checkpoint: 30 October 2026. Latest application step: Client advances workspace, reports and examples (schema 17; see docs/implementation/advances-local.md). This file and the repository are the handover; the previous chat, ChatGPT account and original Mac are not required to continue development.

**Builder ERP is still being built. It is not yet a complete replacement or a production release.** The objective remains all **267 comparison functions, 34 data contracts and 21 domains**, preserving JAKH's business logic in original code. No function has been certified as full migration parity and no real source migration has occurred.

The user now authorises syncing verified work to **[JameelKhab/Builder-ERP](https://github.com/JameelKhab/Builder-ERP)** as the project source of truth. This supersedes earlier local-only Git instructions. Development stays local; deploying to JAKH or another host remains unauthorised. Historical logs describe the authority at their date and are not the current sync policy.

## Start the application

Install Git and Node.js **24.x, at least 24.15**. The current checkpoint was verified with Node 24.19.0 and npm 11.12.1. A Node version manager can use `app/.nvmrc`. Use a GitHub account with access to this repository; a different ChatGPT account does not change GitHub repository access.

```sh
git clone https://github.com/JameelKhab/Builder-ERP.git
cd Builder-ERP/app
npm ci
npm test
npm run build
npm run local
```

Open **http://127.0.0.1:4173/**. The launcher runs both the frontend (4173) and API (4174), bound to loopback. `npm run dev` alone does not run the API. No ChatGPT/OpenAI key, external AI account, Odoo installation or paid service is needed for the current local application.

On an empty checkout, the application creates a local SQLite database and installs fictional examples for both companies and all three projects. The sample profile has restricted roles; many financial actions deliberately require another authorised person. Use read-only role preview to inspect destinations. The account screen supports owner setup when the user chooses to create real local credentials. Never invent passwords for the user or reset a database to bypass sign-in. `npm run local -- --secure` starts the individual setup/sign-in route. Once real owner setup has completed, sample login remains disabled for that database.

If dependency installation reports a certificate error, correct the machine's trusted corporate CA configuration. Do not disable TLS verification. Node and dependencies are prerequisites to reinstall on a new laptop; generated `node_modules` and build caches are not source files.

## Read these records first

| Record | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md), [app/AGENTS.md](app/AGENTS.md) | Current development, access, financial and source-code boundaries |
| [Comparison PDF](docs/migration/Builder-ERP-Full-Comparison.pdf) | The user's full comparison, retained in the repository |
| [Implementation coverage](docs/implementation/coverage.md) and [JSON](docs/implementation/coverage.json) | Every F001–F267 item, status, remaining behaviour and evidence; all 34 contracts and 21 domains |
| [Migration correction](docs/migration/README.md) | Why navigation/examples cannot be treated as a proper migration |
| [Requirements](docs/requirements.md), [decisions](docs/decisions.md), [project log](docs/project-log.md) | User scope, design decisions and completed work |
| [Latest receipt increment](docs/implementation/receipts-local.md) | Working cash/AR flow and precise limits |
| [Original domain contracts](docs/implementation/contracts/) | Fields, state transitions, calculations, permissions and exceptions for implemented subsets |
| [Selected UI](docs/design/visual-directions.md) | Choice 2, Project briefing, with clearer categories |
| [Validation evidence](docs/validation/) | Tests, source observations, browser screenshots and database recovery results |

The repository PDF's SHA256 is `512702d7d8a5eb2762975562204f3be92d495541dd18e9e904a82f87cd7d1928`; it matches the PDF supplied by the user on the original laptop. The historical comparison baseline is commit `3d941a0`. Use the current coverage overlay for later implementation, rather than rewriting historical findings.

## What currently works

The code is original React/Vite + Express + SQLite, with exact decimal money and service-enforced company/project scope. See the implementation documents for limits; every entry below is an operational subset, not full domain acceptance.

- Permission-based Home and clear task destinations; local individual identity/provisioning/recovery, independently reviewed access and separate financial limits.
- Company/project/location/WBS setup and independently reviewed original/revised budgets with released purchasing capacity.
- Company contacts, reviewed supplier currencies/terms and catalogue/pack definitions; unpriced material demand → quotes/FX → sourcing review → orders → deliveries/returns/consumption.
- NCR containment → investigation/corrective plan → independent review → action evidence → independent verification/closure/reopening.
- Company ledger/account/period control, immutable postings/reversals; receipt-matched supplier bills/credits; supplier payment/refund approval, offline recording and independent bank matching.
- Estimate studies with BOQ/resources/building overrides, independent revisions and project/draft-budget handover; reviewed XLSX/CSV intake with retained source files and line provenance.
- Offers → independent commercial review → evidenced client acceptance → independent award → immutable original contract BOQ.
- Contract finance policy → cumulative measurement → three independent certificate reviews → separate client invoice preparation/posting.
- Customer invoice allocation → independent receipt approval → retained evidence/recording → exact AR/bank/FX journal → shared bank matching/full linked correction. Multiple invoices/projects retain their allocations and privacy.
- Client advances destination: request/evidence/independent approval → shared liability invoice → actual receipt-derived principal/tax → protected certificate recovery. Scoped findings and CSV reconcile principal and original advance-tax postings. My Work, search and examples connect to the canonical records.
- Deterministic findings and CSV for implemented reports; explicit project/company/currency scope; additive, discoverable examples.

Some visible registers still contain read-only synthetic records. The existing sample cost/cash openings are labelled examples and must not be confused with typed accounting. No external AI model is connected; deterministic report explanations are not a completed AI strategy.

## Where to pick up next

**Next connected step: finish controlled corrections and complete the client-finance lifecycle.** The dedicated Client advances destination, request form/evidence, invoice preparation, scoped report/export, source links, My Work/search and permanent examples are now implemented. Both companies and all three supplied projects have seven advance scenarios each, on separate new contracts. Existing finance policies and user authority remain unchanged.

1. Read F092 and M15/M16/M23/M32, [advance progress](docs/implementation/advances-local.md), [the full contract](docs/implementation/contracts/client-advances-v1.md) and the full coverage register.
2. Re-study the relevant JAKH correction/credit/retention paths read-only and complete an evidence-backed exception contract. Approved advance cancellation, client credits and correction of recovered certificates must not delete or reset existing allocations/journals or make protected receipt cash reversible without the matching correction.
3. Implement the connected reviewed correction, with exact original-carrying residuals, current independent authority, accounting periods, receipt/recovery dependencies, scoped reports and practical examples. Ownership handover for unavailable preparers also remains required. Keep zero-default financial authority.
4. Continue retention release, securities/final accounts, variations/revised BOQ and the remaining construction/supporting ERP domains below. The comparison scope is unchanged.
5. Keep project/company/currency findings, original evidence and audit history in every workflow. Validate service/individual HTTP, complete UI journeys, saved upgrade/restore and representative-user acceptance before claiming a domain is ready.

The saved database now has **21 fictional advances and 3 recovery allocations** (schema 17), with no real identities. No production migration/source parity has been accepted. Desktop invoice preparation and 390-CSS-pixel request entry/report layout were checked; complete user/accessibility acceptance and all correction journeys remain open.

Important files: `app/server/advances.mjs`, `advances-schema.mjs`, `advance-balances.mjs`, `advance-recovery-schema.mjs`, `certificates.mjs`, `certificates-schema.mjs`, `receipts.mjs`, `receivable-balance.mjs`, `payments.mjs`, `ledger.mjs`; `app/shared/access.mjs`; `app/src/Advances.jsx`, `Certificates.jsx`, `Receipts.jsx`, `Payments.jsx`; their tests under `app/tests/`. The database is schema **17**, with **103 tables including schema_versions (102 domain tables)** at this checkpoint.

Do not let that next step shrink the full scope. Remaining required work includes credits/unallocated receipts/write-offs; negative measurement and lost-author handover; retention releases/securities/final accounts; approved variations/revised BOQ; subcontract measurement/certification/settlement; programme/progress/delay; site diaries/labour/plant/waste; controlled documents/RFIs/testing/snagging/handover; assets/fleet/people/payroll/supporting ERP; full reports/KPIs/cash policy/forecasts; governed AI; exact legacy pricing/cap-share/assembly fidelity; production source export/import/openings/attachment reconciliation; representative-user, accessibility, security and release acceptance. The coverage register is the exhaustive work list.

## Product rules to preserve

The product is **Builder ERP**, not JAKH ERP. JAKH is a sample company and the read-only source. Do not copy, translate or depend on Odoo application code.

The user's priority is **easy to read, easy to operate, rich in information**. Keep original Builder styling, clear permission-based landing destinations, one canonical record, visible context and next action, and progressive evidence/history. Avoid repetitive nested menus/tabs and duplicated values. Preserve the actual contracting business logic rather than simplifying it away. Every provided feature needs meaningful examples.

Enforce legal-company/project/role permissions in services, reports, export, search and future AI, not only menus. Preserve vendor-specific purchase currency and explicit dated FX. Separate budget, commitments, incurred cost, cash and forecast. Money is decimal strings with exact arithmetic; current currencies assume two minor-unit decimals. Configurable financial/tax policy is not a claim of jurisdictional compliance.

Every report begins with findings calculated from its complete authorised filtered population. Future AI should explain evidenced facts and prepare reviewable drafts; it must not silently approve, post, pay, alter bank details, close records or make external commitments.

## Verification at this checkpoint

**256 automated tests pass; frontend build passes.** The advance foundation preserves all original rows through the saved upgrade and an injected failure rollback; connected recovery adds service/HTTP, exact tax/FX/reservation and receipt-correction checks; see [advance validation](docs/validation/advances/README.md). The earlier receipt checkpoint in a fresh clone from GitHub passed a clean lockfile install using the available package cache, all 231 tests, the build and restoration of the 99-table saved workspace. See [handover verification](docs/validation/handover/README.md). [Receipt evidence](docs/validation/receipts/verification.md) links tests, HTTP permissions, browser desktop/mobile/source navigation, exact foreign-currency settlement and recovery checks. The schema-17 advance example upgrade preserves original rows in all 103 tables except the expected journal-sequence increments for new fictional postings. A separate restored copy matches all 103 tables including evidence bytes; integrity/FKs pass and no real identities are configured. These results do not certify the whole ERP, full migration, full security or representative-user acceptance.

Run `npm test` and `npm run build` from `app/` after meaningful application changes. Financial mutations need meaningful service tests and real authenticated HTTP journeys. The static Sites output does not contain the Express/SQLite ERP backend. Do not deploy it as a completed application.

## What moves with GitHub, and what does not

GitHub holds committed application source, lockfile, schema migrations, example generators, tests, original studies/PDF/267-row comparison, source evidence, implementation contracts, design decisions, validation and this handover. The application is portable; there are no hard-coded original-Mac paths in runtime source.

The ignored runtime database is **`.work/data/builder.sqlite`**, not a Git file. A fresh clone recreates the fictional baseline; it does not recover every local demonstration edit. To preserve the exact saved workspace, keep the separately supplied **Builder-ERP-Portable-Handover.zip** before leaving the laptop. Its readme explains restoration from the consistent SQLite snapshot and Git bundle. It contains local workspace data and should be kept privately. Passwords, tokens, credential stores, sessions from the developer's GitHub account, dependency caches and scratch tools are not part of the project handover.

Never copy only a live WAL-mode SQLite main file. Use a consistent SQLite backup; stop the destination server before restoring, and never overwrite an existing destination database. Keep source recovery (Git) separate from business-data recovery (SQLite).

## Prompt for a new coding assistant

> Continue Builder ERP from this repository. Read START-HERE.md, AGENTS.md, app/AGENTS.md, requirements, decisions, the latest project log and complete coverage. Preserve all 267 functions, 34 data contracts and 21 domains. Build original code without Odoo. Work locally; sync verified commits to JameelKhab/Builder-ERP, but do not deploy or mutate JAKH. Client advances now has a dedicated UI/list/options/report/export, My Work/search and additive examples in every supplied scope. The request → invoice → receipt → certified recovery path retains original principal/tax carrying values and correction protection. Schema 17; 256 tests. Next study and implement approved cancellation/credit/recovered-certificate corrections and ownership handover, then retention release/securities/final accounts and the wider ERP. Full source migration and acceptance remain open. Do not depend on the previous chat/account.
