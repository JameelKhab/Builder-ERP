# Estimate studies, revisions and budget handover — original contract

Status: implementation contract, 29 October 2026. F039–F041, partial M07–M09/M02/M05; F038 intake and F042–F062 sales remain required. This is not parity acceptance or a complete tender domain.

## Read-only source evidence

Fresh JAKH UI evidence is in `docs/validation/tenders/source/`. EST/2026/00004 shows 11 buildings; Structure default quantity 10 and building 11 override 12 produce 112. Resources have type, description, quantity per primary unit, resource unit and rate. Structure effective unit cost 80 gives direct 8,960; indirect 896; budget 9,856; selling 13,009.92 with 10% overhead then 20% profit. Whole estimate: direct 23,520, indirect 2,352, budget 25,872, selling 34,151.04, margin 8,279.04. Unlisted buildings keep default quantities; zero overrides omit an item. Approved versions lock. Source handover creates a draft quotation and project with draft WBS budgets. The draft 00009 exposes submit/import controls. No source records were saved or submitted.

The UI also exposes parent value caps, percentage shares, workbook lineage and secondary units. The exact cap/share and legacy item/header combination behaviour has not been demonstrated by a saved example. Retain this as an explicit acceptance gap; never silently reinterpret imported cap/share rows. No Odoo source is used.

## Entities and scope

An estimate version belongs to one immutable company and optional existing project, a study ID, sequential revision and predecessor. Each version snapshots customer identity from an active company customer, title, tender reference, deadline, currency, dated currency-to-company rate/source, repeated building count, indirect pool and pricing percentages, basis and exclusions. Typed BOQ lines have stable line keys across revisions, code, group parent, company cost code, primary unit, default quantity, direct fallback rate OR resource components, item markup and optional secondary unit/conversion. Typed resources snapshot kind (material, labour, plant, subcontract, other), description, consumption per primary unit, resource unit, rate/price basis and currency-to-estimate rate evidence. Typed quantity overrides have one building number/line pair, replacement quantity and explanation. Group rows are summaries; they are never counted twice.

Reads, search, exports and findings apply the live company/project policy. A company-wide estimator can create pre-project studies; a project-scoped estimator can only create/read estimates attached to assigned projects. No unrestricted project/customer details are exposed. Customer edits never rewrite previous versions. No author can change another author's draft. No new user/grant is created during handover.

## Exact calculations

All numeric inputs are decimal strings. Six input decimal places; two-decimal supported currency amounts; dated explicit FX, same currency rate exactly 1. No binary floating-point money. Total quantity is default × building count plus each (override − default). Resource total = quantity × consumption × resource rate × FX / price basis, rounded once to cents. Direct amount is the sum of resource totals, or quantity × fallback rate. Resource and fallback modes cannot both contribute. Secondary quantities explain quantity conversion only and never multiply cost again.

Indirect pool is distributed by direct-cost weights using largest-remainder cents and stable line-code tie breaks, so allocation reconciles exactly, with no negative residual. A nonzero pool requires positive total direct cost. Budget = direct + indirect. Selling = budget × (1+overhead/100) × (1+profit/100) × (1+item markup/100) × (1+header markup/100), rounded once per line. Sequential item/header factors are the original Builder policy; exact legacy combination remains unverified. Margin = selling − budget; margin percent uses selling as denominator. Company line amounts use the estimate FX snapshot; header totals sum converted lines. Functional indirect cost is converted budget minus converted direct cost, preserving their cent reconciliation. Group summaries are excluded from totals. No taxes are silently inferred.

## States, permissions and exceptions

Draft → submitted → approved, or submitted → returned → revised draft. Author may withdraw submission, cancel an unapproved draft/returned version; reviewer may request changes. Approved versions and children are immutable. A new revision copies stable line keys, resources, overrides and provenance and requires another review. One current noncancelled draft/review version per study. Compare any two authorised revisions from the same study, identifying added/removed/changed lines and amount deltas. Concurrent saves and decisions require expected version.

`tenders.write` prepares, `tenders.approve` independently approves; zero-default `estimate_approval_limit` in functional currency must cover max(budget, selling). Reviewer must not be author. Revisions retain predecessor and approved evidence. Current author/reviewer access is checked; review cannot bypass project/company scope. Parent caps/shares and workbook ingestion are rejected/kept open until their contract is verified, not dropped from migrated data. Limits: 200 BOQ rows, 20 components/line, 500 overrides, 1–1,000 buildings per version, bounded dedicated HTTP body. Larger workbook intake remains a separate staged/import workflow.

## Controlled project handover

An approved latest revision can create a new project, explicit location/work hierarchy and a draft baseline in one transaction, or populate its attached empty, unapproved project. Requires live tender read/handover plus project, location, WBS and budget preparation capabilities in the destination scope. Recheck independent approver's current authority before first handover. Store immutable estimate → project → WBS → budget lineage and quantity/resource snapshot; retry returns the existing authorised result without duplication. New WBS cost amounts come from estimate budget, not sales value; proposed released capacity is ZERO. No budget approval, purchasing authority, cost actual, revenue, cash, customer acceptance or contract is invented. The full source draft quotation/client contract handover remains open for the sales domain.

## Reports, examples and acceptance

Every estimate report explains scope, currency, revision/state, cost/price calculation, largest cost contributors and override count. Company/project register findings count latest noncancelled revisions once and separate drafts/approved studies; converted amounts use recorded rates, not assumed current rates. CSV exports use the identical authorised result and spreadsheet-safe text. Examples cover default/override/zero quantities, assemblies, foreign resources, indirect rounding, returned/approved/revised studies, comparisons, group totals and draft budget lineage without altering older examples.

Required tests: known source arithmetic; tiny/large quantities and exact residuals; invalid units/rates/groups/duplicates; foreign-currency authority; author/reviewer separation; stale saves; immutable approved children; revision comparisons and rollback; scope/search/export denial; idempotent handover with zero release; live authority revocation; additive schema/recovery; browser desktop/mobile forms and review routing.
