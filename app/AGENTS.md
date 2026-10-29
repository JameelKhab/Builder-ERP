# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Builder ERP direction and boundaries

- User selected choice 2, Project briefing, on 28 October 2026. Use `../docs/design/directions/02-project-briefing-refined.png` as the selected visual target. The refinement incorporates their request: easy to read, easy to operate, rich in information, with clearer categories.
- Keep four global destinations, seven stable project areas and three overview groups: Decisions needed, Site & programme, Cost & cash. Category directories describe purpose; record detail carries evidence and history. Avoid recursive module menus and repeated nested tab bars.
- Use `npm run local` to start BOTH the loopback API and Vite. `npm run dev` alone starts only the frontend. This is an original, persistent local ERP increment, not merely a static Sites prototype.
- User explicitly requires local work and local Git commits. Do not push, share, deploy, modify the old demo or invoke a hosting handoff without a later user instruction.
- The Sites starter files are retained, but its static worker does NOT run this app's database/API. A successful frontend build is not a deployable ERP or production readiness.
- Keep sample-mode identity and synthetic records clearly labelled. Operational subsets now include scoped access, local individual identity/provisioning, company/project/hierarchy/budget control and procurement through material movements. Read the current implementation coverage before describing any domain as complete. Other registers remain read-only samples. Setting up the first owner permanently disables the sample adapter for that database; never reset user credentials or create real passwords on the user’s behalf.
- Run `npm test` and `npm run build` for meaningful application changes. Financial state changes require service tests; do not replace exact arithmetic with JavaScript floating-point money.
- Follow the root AGENTS.md and update `../docs/implementation/local-increment-1.md` and the project log when scope changes.

- Product name: **Builder ERP**. Keep it consistent in the brand, tab title, exports and runtime metadata. Preserve legal-company identities separately.
- Every visible feature needs meaningful examples. `server/examples.mjs` installs an additive, versioned sample pack in explicit local mode; never reset user work. `src/Examples.jsx` and `example-guide.js` expose the same authorised catalogue. The coverage tests must pass when adding or renaming features.

- Company masters now include contact/party maintenance, independent supplier terms/currency review and material/service catalogue/packs. Keep company terms separate, company-wide master authority explicit, and historic document identity/unit snapshots immutable. A unit or pack must never be inferred from a product name. Supplier/pricelist/configuration and accounting scope remains incomplete; consult masters-local.md.

- NCRs are a typed operational subset. Keep immediate containment separate from completed investigation, closure independent from corrective work, historical contributors excluded from verification, and evidence/cycle decisions immutable. Follow-ups never silently post cost, waste, variations or delay. Preserve read-only legacy quality/HSE examples and the open broader domain scope.

- General ledger is an operational subset. Posted entries/lines stay immutable, corrections use independently approved reversals, and journal authority is separate from purchase/budget limits. Keep bank/AP/AR/tax/stock controls out of manual journals; typed subledgers own those postings. Do not merge this ledger with illustrative cost/cash openings. Account changes after journal preparation require renewed review. Follow contracts/ledger-v1.md and the coverage register.

- Material supplier bills and return credits now own their typed AP/tax journal postings. Manual general journals cannot edit/post/reverse them. AP posting uses its own zero-default authority, independent from author, purchasing, budget and manual journals. Receipt matching, source price basis, configured exclusive tax and original-value credit residuals must remain exact. Subcontract certificates/deductions, stock valuation/GRNI and wider finance remain open; follow contracts/payables-v1.md and the current coverage register.

- Supplier payment/refund settlement now owns its AP/bank/FX postings. Approval never posts cash; offline recording and independent bank matching are separate. Keep payment limits zero by default, project allocations private, corrections immutable, and statement voids/non-destructive replacements audited. Cash movement reports do not replace full company cash-flow classification or bank balances. Follow contracts/payments-v1.md.

- Estimate studies now have typed BOQ/resources/building overrides, separate zero-default review authority, immutable approved revisions and scoped findings/export. Project handover creates an unreleased draft baseline, never a customer contract or spending approval. Keep cancelled revision numbers, stable line keys and proportional indirect-cost explanations. Workbook/cap-share and legacy pricing parity remain open; follow contracts/estimates-v1.md.
