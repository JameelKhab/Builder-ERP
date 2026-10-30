# Resume Builder ERP on another laptop or account

Checkpoint: 30 October 2026. Latest application step: connected full client corrections service/API and balance/report displays (schema 18; see docs/implementation/client-corrections-local.md). The dedicated correction UI and full customer-credit settlement remain next. This file and the repository are the handover; the previous chat, ChatGPT account and original Mac are not required to continue development.

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
- Full-annulment correction service/API: independently reviewed exact credits, linked effective measurement/recovery withdrawal, unchanged cash and dated reconciled balances. Entry/review UI and full credit settlement remain unfinished.
- Deterministic findings and CSV for implemented reports; explicit project/company/currency scope; additive, discoverable examples.

Some visible registers still contain read-only synthetic records. The existing sample cost/cash openings are labelled examples and must not be confused with typed accounting. No external AI model is connected; deterministic report explanations are not a completed AI strategy.

## Where to pick up next

**Next connected step: complete the correction user journey and customer-credit settlement.** Full annulment services/API now connect independent advance or technical/commercial/finance review to exact original invoice reversal, effective measurement/recovery release and retained cash. The existing invoice/receipt/certificate report displays and CSV include dated credits and separate customer-credit balances. The dedicated entry/review screen, scoped My Work/search and permanent correction examples are not yet built.

1. Read F091/F092/F122/F124/F133/F134/F136 and M15/M16/M23/M24/M32, [correction progress](docs/implementation/client-corrections-local.md), [the exception contract](docs/implementation/contracts/client-corrections-v1.md) and the full coverage register.
2. Build one clear correction form/detail/review route from canonical sources, showing impact, blockers, evidence, reviewer and history. Reuse `/api/client-corrections` and its service; connect My Work/search, project/company findings/export and additive examples in both companies/all three projects. No new authority should be granted to existing users.
3. Implement reviewed customer-credit allocation and evidenced refunds with original carrying residuals and bank matching. A full credit leaves recorded cash as a customer credit; receipt-error reversal must not substitute for a refund. Complete partial/forward adjustments and unavailable-author handover as distinct workflows.
4. Continue retention release, securities/final accounts, variations/revised BOQ and the wider construction/supporting ERP domains. A last-period full annulment does not replace forward signed adjustments or descendant handling.
5. Keep all source evidence, dated report findings, company/project/currency scope and independent authority. Complete UI journeys, saved upgrade/restore and representative-user acceptance before claiming a domain is ready.

The saved database is schema **18**, with **106 tables including schema_versions (105 domain tables)**, 21 fictional advances, three recovery allocations, zero correction transactions and no real identities. All original rows survived the upgrade; a separate restore matches every table. The disposable browser fixture verified a paid credit display only. No source import/parity or full correction workflow has been accepted.

Important files: `app/server/client-corrections.mjs`, `client-corrections-schema.mjs`, `client-correction-state.mjs`, `certificates.mjs`, `advances.mjs`, `advance-balances.mjs`, `advance-recovery.mjs`, `advance-report.mjs`, `receipts.mjs`, `receivable-balance.mjs`; existing `app/src/Certificates.jsx`, `Receipts.jsx`, `Advances.jsx` and export helpers. Ten new service cases are in `app/tests/client-corrections.test.mjs`; the individual HTTP and foreign-currency journeys extend advances tests. `npm test` now uses the explicit test-only Date calendar in `tests/helpers/test-clock.mjs`; runtime dates remain real. A same-timestamp sales-acceptance ordering bug found by the deterministic clock is fixed.

Do not let this sequence shrink the full scope. Remaining required work includes complete correction UI and examples; customer-credit allocation/refunds, partial credits, unallocated receipts/write-offs; negative/forward measurement and lost-author handover; retention releases/securities/final accounts; approved variations/revised BOQ; subcontract measurement/certification/settlement; programme/progress/delay; site diaries/labour/plant/waste; controlled documents/RFIs/testing/snagging/handover; assets/fleet/people/payroll/supporting ERP; full reports/KPIs/cash policy/forecasts; governed AI; exact legacy pricing/cap-share/assembly fidelity; production source export/import/openings/attachment reconciliation; representative-user, accessibility, security and release acceptance. The coverage register is exhaustive.

## Product rules to preserve

The product is **Builder ERP**, not JAKH ERP. JAKH is a sample company and the read-only source. Do not copy, translate or depend on Odoo application code.

The user's priority is **easy to read, easy to operate, rich in information**. Keep original Builder styling, clear permission-based landing destinations, one canonical record, visible context and next action, and progressive evidence/history. Avoid repetitive nested menus/tabs and duplicated values. Preserve the actual contracting business logic rather than simplifying it away. Every provided feature needs meaningful examples.

Enforce legal-company/project/role permissions in services, reports, export, search and future AI, not only menus. Preserve vendor-specific purchase currency and explicit dated FX. Separate budget, commitments, incurred cost, cash and forecast. Money is decimal strings with exact arithmetic; current currencies assume two minor-unit decimals. Configurable financial/tax policy is not a claim of jurisdictional compliance.

Every report begins with findings calculated from its complete authorised filtered population. Future AI should explain evidenced facts and prepare reviewable drafts; it must not silently approve, post, pay, alter bank details, close records or make external commitments.

## Verification at this checkpoint

**266 automated tests pass; frontend build passes.** [Correction validation](docs/validation/client-corrections/README.md) records full-annulment service/individual HTTP, exact tax/FX reversals, current authority, dependent periods, stale cash plans, accounting cutoffs, injected posting rollback and read-only balance displays. The schema-18 scratch and saved upgrades preserve all original rows; separately restored copies match all 106 tables, including evidence, with clean integrity/FKs and no real identities or saved correction transactions. The test calendar now stays consistent across laptops/dates; runtime controls still use actual dates. Earlier [advance validation](docs/validation/advances/README.md), [receipt evidence](docs/validation/receipts/verification.md) and [fresh-clone handover verification](docs/validation/handover/README.md) remain available. These checks do not certify the full correction UI, customer refunds, whole ERP, full migration, security or representative-user acceptance.

Run `npm test` and `npm run build` from `app/` after meaningful application changes. Financial mutations need meaningful service tests and real authenticated HTTP journeys. The static Sites output does not contain the Express/SQLite ERP backend. Do not deploy it as a completed application.

## What moves with GitHub, and what does not

GitHub holds committed application source, lockfile, schema migrations, example generators, tests, original studies/PDF/267-row comparison, source evidence, implementation contracts, design decisions, validation and this handover. The application is portable; there are no hard-coded original-Mac paths in runtime source.

The ignored runtime database is **`.work/data/builder.sqlite`**, not a Git file. A fresh clone recreates the fictional baseline; it does not recover every local demonstration edit. To preserve the exact saved workspace, keep the separately supplied **Builder-ERP-Portable-Handover.zip** before leaving the laptop. Its readme explains restoration from the consistent SQLite snapshot and Git bundle. It contains local workspace data and should be kept privately. Passwords, tokens, credential stores, sessions from the developer's GitHub account, dependency caches and scratch tools are not part of the project handover.

Never copy only a live WAL-mode SQLite main file. Use a consistent SQLite backup; stop the destination server before restoring, and never overwrite an existing destination database. Keep source recovery (Git) separate from business-data recovery (SQLite).

## Prompt for a new coding assistant

> Continue Builder ERP from this repository. Read START-HERE.md, AGENTS.md, app/AGENTS.md, requirements, decisions, latest project log and complete coverage. Preserve all 267 functions, 34 data contracts and 21 domains. Build original code without Odoo. Work locally; sync verified commits to JameelKhab/Builder-ERP, but do not deploy or mutate JAKH. Schema 18; 266 tests. Full client-source annulment service/API now posts exact original invoice credits and releases effective measurement/recovery atomically, retaining cash as customer credit. Next complete its entry/detail/review UI, My Work/search and additive examples, then customer-credit allocation/refunds, partial/forward adjustments and ownership handover. Continue retention/securities/final accounts and the entire wider ERP. Full source migration and acceptance remain open. Do not depend on the previous chat/account.
