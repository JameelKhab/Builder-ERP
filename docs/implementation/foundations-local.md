# Company, project and budget implementation — 29 October 2026

This original local increment connects legal companies, project setup, scoped location/WBS hierarchies, original budgets and approved budget revisions to procurement and cost reports. It extends the existing local sample; it is not full ERP parity, production authentication or a real data migration.

## Where to find it

- Home → Companies: legal company creation/details. Functional currency is fixed; creating a company does not grant business access. Access administrators assign business roles separately.
- Company → Shared information → Project setup: create a project or work across accessible projects.
- Projects → Plan → Project setup: project details, locations, work packages and budgets. The same records are used by requests, deliveries and reports.
- Projects → Costs & Contracts → Budget control: draft, submit, independently approve/return/cancel, original/revised values, released capacity and history.
- Users & access: separate purchase and budget approval limits. My Work and search include permitted budget proposals; cost-report sources open approved budgets.

## Rules implemented

Schema 4 adds typed company/project metadata, cost codes, stable location/work hierarchy versions, budget documents/lines/facts and append-only setup evidence. Groups roll up item budgets but cannot receive procurement and are excluded from financial row totals. Parent references cannot cross a project or form a cycle. A project manager must already have the appropriate management scope; assignment does not create access.

A new project starts without an approved budget. Its financial budget totals remain unknown until a complete original baseline is approved. Existing illustrative openings retain their provenance. Original budget remains fixed after baseline; approved revisions add immutable deltas. New work items require funding before release. Source total and local additions remain visible in reports.

A submitted proposal freezes its budget/work revision and balances. A reviewer requires a separate budget limit and cannot be the author. Authority uses gross movements, preventing an offsetting transfer from appearing to have zero value. Approval checks current cost/reservation exposure again, applies all lines in one transaction and cannot be replayed. A parallel proposal becomes stale after another approval or new work item; return and refreshed draft are required. Reductions cannot underfund incurred costs, commitments or reserved capacity. Currency conversion, cash and forecasts are not changed by budget decisions.

Read-only engineers can see project/location/work structure without money, budget records or commercial history. Company reports, search, direct endpoints and read-only access previews apply the same live scope rules. Project and company metadata writes, structural changes and budget decisions retain reasons and before/after evidence.

## Examples and verification

An additive `project-budget-v1` pack provides an approved release, submitted scope proposal and editable draft in each of the three existing example projects. It completes previously blank synthetic project metadata only if that example remains at its initial version. It never replaces transaction records or financial openings. A new fictional budget reviewer has explicit example-only authority; existing people retain zero new budget authority until separately reviewed. This remains the explicit local sample identity model.

Automated coverage includes company currency and scope, project provenance/dates/manager access, hierarchy cycles, cross-company references, group exclusion, original baseline coverage, unknown values, independent limits, immutable submissions/facts, competing proposals, live exposure checks, gross transfer authority, rollback, example idempotency, API/preview restrictions and a real new-project → baseline → request → independent sourcing approval → supplier-order journey. See `docs/validation/foundations/` for retained test/build and browser evidence.

Browser checks saved draft BUD-5A9E8AED at version 2 with a fictional AED 22,000 proposed change; it remains a draft. Added fictional Harbour floor A-L13 through the UI. Both survive restart. No JAKH business record, real supplier communication or browser access grant was changed. The source's unsaved budget form was discarded.

## Remaining acceptance work

The source revision form and retained project/WBS/forecast captures inform the contract in `contracts/foundations-v1.md`. Visible help is not proof of every source enforcement rule. All 267 function IDs and 34 migration contracts remain tracked, with parity unverified.

Still open in this area: authenticated multi-user sign-in/provisioning; company periods/numbering/tax/intercompany policy; canonical customer/party records; estimate/contract handover; project templates/roles/tags/tasks; resource-rate budget build-ups; effective/historic budget cutoffs and period locks; approved forecast versions; independent reviewer routing/delegation/escalation; full audit query/export; WBS/location migration and reconciliation. Dates of budget approval are server recorded, with no user backdating/future-effective funding in this increment. Only AED/USD/EUR/GBP/SAR/QAR functional currencies are currently supported by the two-decimal money policy.

The full ERP goal remains active. No push or deployment.
