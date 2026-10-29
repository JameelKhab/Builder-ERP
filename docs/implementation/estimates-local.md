# Builder ERP — local estimating workflow

29 October 2026. Original code; local development only. Full ERP scope remains active and no migration parity is certified.

## Working locally

Tenders now opens an operational estimate register, with company/project filters and findings above the results. Each study has one latest revision in the register; previous versions remain accessible from its history. One work-item editor keeps resource pricing, building exceptions and secondary quantities together without repeating navigation tabs.

- Typed company/customer/project estimates, BOQ summary groups and priced items, company cost codes, units, default quantities, resource assemblies and building overrides. An explicit zero override omits work in one building.
- Exact rational resource quantities/rates/price bases/FX; indirect cents allocated proportionally with deterministic residuals; overhead, profit and item/header pricing order; separate cost, selling and margin. Company values retain dated FX evidence. Primary and secondary units cannot silently duplicate cost.
- Draft preparation → submission → independent review/return → immutable approval. Estimate authority is separate from purchasing, budgets, journals, AP and payments and defaults to zero. Live roles, scope, author/reviewer independence, customer versions and optimistic versions are checked.
- New revisions preserve the previous approved inputs and stable BOQ identities. Comparisons explain quantity/direct-cost changes and indirect-cost redistribution, including unchanged quantities whose allocated cost changes. Cancelled revisions do not reuse revision numbers.
- An approved study can create project setup, building locations, the WBS and a draft baseline atomically and once. The baseline uses estimated cost and starts with ZERO released spending capacity. Current reviewer authority is rechecked. This does not create a signed contract, approved spending, posted cost/revenue or cash.
- Project/company register findings and per-study CSV use complete authorised results. My Work, Home counts, search, role previews, access authority fields and the example guide use the same policy and records. Historical customer identity and decision evidence are retained.

The additive pack contains 14 versions across 11 studies: 3 current studies per existing project plus one approved pre-project study per company. It covers revised resource pricing, independent return, a zero building exception and foreign-currency resource quotes. Two fictional estimating users have no individual credentials. Existing users receive no estimate approval amount.

## Source fidelity and open work

Fresh read-only JAKH observations cover the handed-over villa estimate, its assembly/resource form, replacement quantity override and current draft controls. The tested source example reconciles: direct 23,520.00 + indirect 2,352.00 = budget 25,872.00; 10% overhead then 20% profit = selling 34,151.04; margin 8,279.04. This is arithmetic evidence, not full source workflow acceptance.

The comparison's workbook staging/intake, cap/share semantics, full take-off and resource catalogue, indirect pool breakdown, opportunity/bid management, quotations/orders/templates/pricelists, legal award/client contracts and their complete handover are still required. Source handover includes a draft quotation; this increment creates only project/WBS/draft-budget lineage. Exact legacy item/header markup combination and rounding edge cases remain unverified. Builder's current sequential pricing policy is explicitly recorded. Larger BOQs require staged intake beyond the bounded manual editor. Approved handovers cannot be edited into later project changes; controlled contract/variation/budget workflows remain required.

No source data export/import, historical approval migration, full parity reconciliation or representative-user usability acceptance has occurred. The full 267-function, 34-data-contract, 21-domain scope remains in `coverage.json`/`coverage.md`.

## Validation and preservation

177 automated tests pass, including independent individual HTTP identities preparing, approving and handing over a study; targeted estimate rechecks pass after the comparison explanation refinement. Frontend build passes. Browser verification saved/submitted a disposable two-building study (7 m3, direct 700.00, indirect 20.00, selling 950.40), observed author withdrawal without self-approval, and downloaded the matching study. The saved Harbour report exports exactly three authorised studies. Desktop and 390px mobile views have no horizontal page overflow; console checks are clean.

The persistent schema-10 database was backed up before the additive schema-11 upgrade. Every prior row/column in 70 business tables is retained. A reopened backup matches all 77 business tables, including blobs, with clean integrity and foreign-key checks; there are still zero configured individual credentials. No existing budget, journal, AP, payment, bank statement or cost fact was rewritten. See `docs/validation/tenders/` for test/build/source/browser/export/recovery evidence.
