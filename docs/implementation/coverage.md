# Builder ERP implementation coverage — 29 October 2026

The full scope is retained: **267 functions, 34 data contracts, 21 domains**. This is a current implementation overlay on the historical comparison. No function is certified as migrated or full parity. “Partial” describes a tested subset; “foundation” describes shared models/controls, not a finished screen. The ERP goal remains active.

## Current work

Reviewed XLSX/CSV workbook intake now stages original evidence, validates direct-item rows, reconciles all files, obtains independent review and appends once to an unchanged draft. Scope, current master/reviewer checks, findings/export and lineage across revisions are tested. See `boq-intake-local.md`. Parent caps/shares, assembly sheets and full source parity remain open.

Estimate studies now connect typed BOQ/resource pricing, repeated-building overrides, exact cost/selling calculations, independent version approval/comparison, scoped findings/CSV and controlled project/WBS/draft-budget handover with zero spending release. See `estimates-local.md` and `contracts/estimates-v1.md`. Broader workbook intake, cap/share and exact pricing parity, CRM/sales/contracts and full award handover remain open.

Supplier payments and refunds now connect independent approval, offline transaction recording, exact AP/bank/FX allocations, independent bank matching and retained corrections. Company/project cash findings and CSV reconcile to supplier balances and typed journals. See `payments-local.md` and `contracts/payments-v1.md`. Full cash classification/forecast, customer/subcontract settlement, bank integrations and source migration remain open.

Material receipt supplier bills now support exact price basis, configured exclusive tax/FX, independent AP authority, immutable source journals, quantity return credits and company/project findings/control reconciliation/CSV. See `payables-local.md` and `contracts/payables-v1.md`. Service/subcontract certificates, retention, stock valuation, broader bank integration and source parity remain open.

Original general ledger now supports company accounts/periods, exact-currency journals, independent posting/reversal, immutable history and scoped ledger/trial-balance findings. See `ledger-local.md` and `contracts/ledger-v1.md`. Customer invoices/receipts, broader tax, full bank/stock reconciliation and source accounting migration remain open.

NCRs now have a connected original lifecycle, local evidence files, independent plan/verification decisions, immediate containment, consequences and company/project findings. See `quality-local.md` and `contracts/quality-v1.md`. Broader quality/HSE/inspection/document/handover and downstream consequence resolution remain open.

Company contacts, independently reviewed supplier terms/currencies and typed catalogue/pack maintenance now connect to quotations, orders and historical snapshots. My Work/search and company examples are included. See `masters-local.md` and `contracts/masters-v1.md`. Full party/pricelist/configuration scope remains open.

Individual local sign-in now includes reviewed provisioning/activation, session/recovery controls and independent access administration. Real two-user budget/purchase approval is verified. See `identity-local.md` and `contracts/identity-v1.md`.

The company/project/budget increment adds legal company setup, project details, location/WBS hierarchies and independently approved budget facts connected to procurement and cost reports. See `foundations-local.md` and `contracts/foundations-v1.md`.

The connected procurement increment implements unpriced demand → supplier quotes/FX → independent sourcing review → local orders → partial receipts/rejections → supplier returns/material consumption → operational cost facts. See `contracts/procurement-v1.md` and `procurement-local.md`.

## Remaining build sequence

1. Complete identity hardening/preferences/delegation, reference/master maintenance, detailed budget build-ups, dated forecast versions and approval routing. The implemented project/budget subset remains short of full domain acceptance.
2. Extend material-payable accounting to service/certificate bills, customer settlement, bank import/fees/transfers, stock/GRNI reconciliation, complete tax/FX policies and cash forecasts; expand warehouse/material operations.
3. Complete workbook/BOQ cap-share/resource/pricing fidelity and opportunity/sales/award handover; measured client and subcontract certification, advances, retention, variations, securities and final accounts.
4. Programme/progress/delay, site diaries and resources; NCR/quality/safety, controlled documents/RFIs, testing, snagging and handover.
5. People/HR/payroll, plant/assets/fleet, CRM/sales, collaboration and configuration/integration functions retained in the comparison.
6. All project/company reports and KPI populations, report findings and exports; governed contextual AI with evidence, permission checks and reviewable actions.
7. Source export mapping, idempotent staging/import, opening and transaction/attachment reconciliation, backup/restore drills, representative-user walkthroughs and local release verification.

This sequence is dependency driven. Source verification and migration contracts continue alongside each domain; financial/legal settings that are not supplied remain explicit configuration, never invented production policy. Local sample identity, illustrative balances and generic registers cannot satisfy these gates.

## Every recorded function

| ID | Source destination | Local status | Current implementation / remaining work |
|---|---|---|---|
| F001 | Dashboard | partial | Project/company cost report combines illustrative opening balances with local PO commitments and material-consumption facts; findings and source links. Other dashboard metrics remain open. |
| F002 | Reports > Ledger, trial balance & aging | partial | Company/project ledger and AP balances now include exact recorded settlements, refunds and reversals with AP-control reconciliation, findings and CSV. Full aging, AR, period revaluation and imported source reconciliation remain open. |
| F003 | Reports > Company cash flow | partial | Supplier cash movement findings by company/project separate approved plans, recorded out/in/net and current bank clearance, with source allocations and CSV. Customer cash, opening balances, charges/transfers, classification, forecasting and full company cash flow remain open. |
| F004 | Reports > Cash-flow accounting policies | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F005 | Reports > BOQ & building cost control | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F006 | Reports > Approved unbilled certificates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F007 | Reports > Project exceptions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F008 | Reports > Project cost & forecast (CVR) | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F009 | Reports > Cost forecasts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F010 | Reports > Project cash forecasts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F011 | Reports > Project cash forecast | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F012 | Reports > Posted Ledger | partial | Immutable general, material-AP and supplier-settlement journals with canonical source/reversal links and accounting-date cutoffs. Broader subledgers and source migration remain open. |
| F013 | Reports > Quality / HSE Reporting | partial | Current NCR report by company/project/state/severity with full-population findings, source links and CSV; closed/reopened cases reconcile by current state. Full quality/HSE inspection KPIs, aging, period/cutoff history and source parity remain open. |
| F014 | Reports > Project-control audit | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F015 | Reports > Scheduled reports | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F016 | Reports > Document Lifecycle Reporting | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F017 | Reports > Saved Dashboards > Dashboards | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F018 | Reports > Saved Dashboards > Configuration > Dashboards | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F019 | Reports > Saved Dashboards > Configuration > Sections | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F020 | Reports > Saved Dashboards > Configuration > Share links | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F021 | My Approvals & Activities | partial | My Work and Home include independent purchase/budget/master/NCR/journal/AP/payment/estimate reviews, author drafts and authorised payment recording. Live scope, separate limits and maker/checker controls apply. Configurable routes, delegation/escalation, reassignment and broader workflow coverage remain open. |
| F022 | CRM > Sales > My Pipeline | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F023 | CRM > Sales > My Activities | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F024 | CRM > Sales > My Quotations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F025 | CRM > Sales > Teams | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F026 | CRM > Sales > Customers | foundation | Shared customer/supplier party roles and company-local contact/term foundation. Dedicated CRM/sales/accounting customer workflows, credit and sales pricing remain open. |
| F027 | CRM > Reporting > Forecast | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F028 | CRM > Reporting > Pipeline | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F029 | CRM > Reporting > Leads | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F030 | CRM > Reporting > Activities | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F031 | CRM > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F032 | CRM > Configuration > Sales Teams | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F033 | CRM > Configuration > Activities > Activity Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F034 | CRM > Configuration > Activities > Activity Plans | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F035 | CRM > Configuration > Pipeline > Stages | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F036 | CRM > Configuration > Pipeline > Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F037 | CRM > Configuration > Pipeline > Lost Reasons | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F038 | Tender & BOQ > BOQ workbook intake | partial | Original XLSX/CSV staging retains source bytes/hash, mapped sheet/row/cell, product/unit/company cost references, exact all-file reconciliation, independent data review and once-only append to an unchanged draft. Findings/export, scoped history/download and project examples work locally. Parent caps/shares, assembly/override sheets, source-specific migration and full parity remain open. |
| F039 | Tender & BOQ > BOQ estimates | partial | Typed estimate revisions, summary BOQ groups/items, resource assemblies with explicit currencies/price bases, repeated-building replacements including zero, secondary quantity explanation, proportional indirect cents and documented cost/selling pricing now work locally. Parent cap/share semantics, workbook/take-off mapping, resource/pool maintenance, exact legacy markup/rounding parity and full award/sales handover remain open. |
| F040 | Tender & BOQ > Study versions | partial | Independent estimate approval locks version inputs and calculations; new revisions preserve stable BOQ keys, decisions and predecessor links. Comparisons explain quantity/direct/indirect/pricing changes; cancelled revision numbers are retained. Source historical version import and full parity remain open. |
| F041 | Tender & BOQ > Estimate analysis | partial | Study cost/selling/margin findings, project/company latest-study reports and CSV reconcile to exact line calculations. Functional currency uses dated snapshots; scope and cancellation/revision population are explicit. Cap/share analysis, exact legacy pricing/rounding parity, pipeline forecasts and full reporting remain open. |
| F042 | Sales & Quotations > Orders > Quotations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F043 | Sales & Quotations > Orders > Orders | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F044 | Sales & Quotations > Orders > Customers | foundation | Shared customer/supplier party roles and company-local contact/term foundation. Dedicated CRM/sales/accounting customer workflows, credit and sales pricing remain open. |
| F045 | Sales & Quotations > Products > Products | foundation | Canonical company material/service catalogue with category, base unit, packs and historical identity. Dedicated sales/accounting pricing/tax workflows remain open. |
| F046 | Sales & Quotations > Products > Pricelists | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F047 | Sales & Quotations > Reporting > Sales | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F048 | Sales & Quotations > Reporting > Salespersons | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F049 | Sales & Quotations > Reporting > Products | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F050 | Sales & Quotations > Reporting > Customers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F051 | Sales & Quotations > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F052 | Sales & Quotations > Configuration > Teams | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F053 | Sales & Quotations > Configuration > Payments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F054 | Sales & Quotations > Configuration > Sales Orders > Templates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F055 | Sales & Quotations > Configuration > Sales Orders > Headers/Footers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F056 | Projects > Projects | partial | Typed project creation/editing, immutable company, manager scope, dates and direct-award setup basis. Templates, tasks, estimate/contract handover and source migration remain open. |
| F057 | Projects > Tasks > My Tasks | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F058 | Projects > Tasks > All Tasks | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F059 | Projects > Reporting > Tasks Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F060 | Projects > Reporting > Customer Ratings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F061 | Projects > Reporting > Margins | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F062 | Projects > Reporting > Forecast Margins | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F063 | Projects > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F064 | Projects > Configuration > Projects | partial | Company/project-scoped setup with versioned metadata and history. Full configuration, tags, templates, accounting dimensions and migrated records remain open. |
| F065 | Projects > Configuration > Project Templates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F066 | Projects > Configuration > Project Roles | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F067 | Projects > Configuration > Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F068 | Projects > Configuration > Activity Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F069 | Projects > Configuration > Activity Plans | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F070 | Project requisitions | partial | Typed multi-line unpriced demand, draft revision, submission, supplier quotations/allocation, independent approval and local orders. No requisition amendments after submission, partial-demand awards or source import. |
| F071 | Project set-up | partial | Project setup, locations, WBS and original budget workflow are connected to procurement. Source-estimate handover, cost centres, contract links and migration reconciliation remain open. |
| F072 | Material returns | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F073 | WBS & Budgets > Open WBS & Budgets | partial | Scoped item/group WBS, cost codes, cycle-safe hierarchy, child rollups, original baseline/revisions and released buying capacity. Resource build-ups, dated progress/forecasts and source reconciliation remain open. |
| F074 | WBS & Budgets > Budget revisions | partial | Draft/submit/independent approve/return/cancel; immutable approved deltas, separate budget limits, frozen revision, stale-proposal and live-exposure checks. Effective-date history, full policy routing and source parity remain open. |
| F075 | Site receipts | partial | PO-line receipts with accepted/rejected quantities, delivery reference, retry key and returns; no uploaded delivery evidence or invoice match. |
| F076 | Site diaries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F077 | Contracts & measured BOQ > Open Contracts & measured BOQ | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F078 | Contracts & measured BOQ > BOQ revisions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F079 | Contracts & measured BOQ > Variations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F080 | Site materials & issues | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F081 | Purchasing > Orders > Requests for Quotation | partial | Product-specific immutable quotations with approved supplier currencies/terms, pack conversions, dated FX and exact split allocations. Current supplier/product checks and frozen identity prevent stale commitments. RFQ communications and supplier portal remain open. |
| F082 | Purchasing > Orders > Purchase Orders | partial | Local supplier/currency orders with frozen identity, terms, pack/FX snapshots, independent approval, commitments, deliveries and linked bill/credit quantities/documents. Amendments, closure, distribution and full source migration remain open. |
| F083 | Purchasing > Orders > Purchase Agreements | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F084 | Purchasing > Orders > Vendors | partial | Canonical supplier/customer identity, company contact details, reviewed effective terms/currencies, block/archive/restore, scoped search and history. Supplier qualification, multiple contacts/addresses, tax/bank controls and source migration remain open. |
| F085 | Purchasing > Products > Products | partial | Typed company catalogue maintenance with material/service separation, fixed code/base unit/precision, category/description/archive and product-specific packs connected to purchasing. Variants, valuation/tax, full pricing and source migration remain open. |
| F086 | Purchasing > Reporting > Purchase | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F087 | Purchasing > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F088 | Purchasing > Configuration > Vendor Pricelists | foundation | Product-specific supplier quote/item code and pack reference, explicit quantity and currency/FX snapshots. Reusable supplier price lists, effective quantity tiers and item cross-reference administration remain open. |
| F089 | Purchasing > Configuration > Products > Categories | partial | Company product category create/rename/archive with stable IDs and retained product/history links. Hierarchy, accounting/valuation policies and source import remain open. |
| F090 | Purchasing > Configuration > Products > Units & Packagings | partial | Dimension-labelled base units and immutable product pack factors, exact pack quote/base quantity conversion, precision checks, retirement and historic snapshots. Full UOM administration/dimensional conversions remain open. |
| F091 | Payment certificates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F092 | Advances & retention releases | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F093 | Final accounts & closeout | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F094 | Guarantees & bonds | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F095 | Subcontract finance > Open Subcontract finance | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F096 | Subcontract finance > Supplier certificates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F097 | Subcontract finance > Supplier advances and retention releases | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F098 | Subcontract order amendments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F099 | Subcontractor applications | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F100 | Subcontract service entries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F101 | Subcontract work corrections | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F102 | Stores & Receipts > Overview | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F103 | Stores & Receipts > Operations > Transfers > Receipts | partial | Accepted/rejected PO receipt, immutable receipt evidence, no overreceipt, idempotency and revisions. Warehouse/operation-type administration remains open. |
| F104 | Stores & Receipts > Operations > Transfers > Deliveries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F105 | Stores & Receipts > Operations > Adjustments > Physical Inventory | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F106 | Stores & Receipts > Operations > Adjustments > Scrap | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F107 | Stores & Receipts > Operations > Procurement > Replenishment | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F108 | Stores & Receipts > Products > Products | partial | Typed company catalogue maintenance with material/service separation, fixed code/base unit/precision, category/description/archive and product-specific packs connected to purchasing. Variants, valuation/tax, full pricing and source migration remain open. |
| F109 | Stores & Receipts > Reporting > Stock | partial | Per-receipt available quantity/value after returns and consumption. Full warehouse/location stock reporting, count adjustments and valuation periods remain open. |
| F110 | Stores & Receipts > Reporting > Moves History | partial | Append-only receipt/return/consumption movement ledger, actor, reason, location and cost source. Search/export and all other movement types remain open. |
| F111 | Stores & Receipts > Reporting > Moves Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F112 | Stores & Receipts > Reporting > Returns | partial | Supplier return of available accepted goods reopens supply; consumed stock cannot be returned. Return-to-store, credits and intercompany returns remain open. |
| F113 | Stores & Receipts > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F114 | Stores & Receipts > Configuration > Warehouse Management > Warehouses | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F115 | Stores & Receipts > Configuration > Warehouse Management > Operations Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F116 | Stores & Receipts > Configuration > Products > Categories | partial | Company product category create/rename/archive with stable IDs and retained product/history links. Hierarchy, accounting/valuation policies and source import remain open. |
| F117 | Stores & Receipts > Configuration > Products > Units & Packagings | partial | Dimension-labelled base units and immutable product pack factors, exact pack quote/base quantity conversion, precision checks, retirement and historic snapshots. Full UOM administration/dimensional conversions remain open. |
| F118 | Labour & plant allocation | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F119 | Labour & plant actual feeds | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F120 | P6 schedule progress | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F121 | Finance > Dashboard | partial | Accounting destination exposes journal states and ledger/trial-balance findings. Full finance dashboard, AP/AR/cash/tax and reconciliation remain open. |
| F122 | Finance > Customers > Invoices | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F123 | Finance > Customers > Credit Notes | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F124 | Finance > Customers > Payments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F125 | Finance > Customers > Products | foundation | Canonical company material/service catalogue with category, base unit, packs and historical identity. Dedicated sales/accounting pricing/tax workflows remain open. |
| F126 | Finance > Customers > Customers | foundation | Shared customer/supplier party roles and company-local contact/term foundation. Dedicated CRM/sales/accounting customer workflows, credit and sales pricing remain open. |
| F127 | Finance > Vendors > Bills | partial | Material receipt supplier bills, exclusive configured tax/accounting FX, receipt/price checks and separate AP posting now connect to partial settlement and bank evidence. Service/subcontract certificates/retention, non-PO charges, attachments, richer tax and source parity remain open. |
| F128 | Finance > Vendors > Refunds | partial | Original-value material return credits preserve quantity/carrying residuals; credit after payment creates a negative supplier balance cleared by a separately approved refund. Price-only credits, debit notes, full AP voids and source migration remain open. |
| F129 | Finance > Vendors > Payments | partial | Original supplier payment/refund lifecycle: multi-bill/company-project allocations, zero-default independent amount approval, approved reservations, evidenced offline recording, exact AP/bank/FX journals and independent statement matching/unmatching/void-replacement. Reversals retain original values/accounts. No bank transfer integration. Beneficiary/payment-run controls, fees/transfers, broader settlement types and source parity remain open. |
| F130 | Finance > Vendors > Products | foundation | Canonical company material/service catalogue with category, base unit, packs and historical identity. Dedicated sales/accounting pricing/tax workflows remain open. |
| F131 | Finance > Vendors > Vendors | foundation | Shared customer/supplier party roles and company-local contact/term foundation. Dedicated CRM/sales/accounting customer workflows, credit and sales pricing remain open. |
| F132 | Finance > Accounting > Transactions > Journal Entries | partial | Typed general journals: exact currencies/rates, independent posting with separate authority, source references, stale-account checks, immutable numbered facts and linked full reversals. Typed finance sources, templates/delegation and parity remain open. |
| F133 | Finance > Review > Control > Journal Items | partial | Immutable general/AP/payment journal lines with frozen source/account/currency values and exact reversals. Project allocations balance independently. Full analytic/tax/party accounting and source parity remain open. |
| F134 | Finance > Review > Control > Audit Trail | partial | Append-only journal/AP/payment/configuration and statement-match evidence, live authority, original/reversal/source snapshots and non-destructive statement corrections. Full audit querying, external tamper resistance and historical reconciliation reconstruction remain open. |
| F135 | Finance > Reporting > Management > Invoice Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F136 | Finance > Reporting > Management > Cashflow Analysis | partial | Complete authorised supplier cash movement population and findings/CSV separate plans, recorded transactions and bank matches. Full cash policy/forecast/operating-investing-financing analysis and source migration remain open. |
| F137 | Finance > Reporting > Management > Analytic Report | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F138 | Finance > Configuration > Settings | partial | Company chart and non-overlapping periods; audited close/reopen, separate journal authority and supported accounting FX snapshots. Tax/fiscal localisation and broader settings remain open. |
| F139 | Finance > Configuration > Online Payments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F140 | Finance > Configuration > Accounting > Chart of Accounts | partial | Company chart maintenance, fixed code/type/purpose, prospective name/status changes, historical snapshots and reserved control accounts. Full hierarchy/tags/account mappings/opening migration remain open. |
| F141 | Finance > Configuration > Accounting > Taxes | partial | Explicit company exclusive-tax codes with percentage, recoverable percentage/account, effective dates, fixed rules, prospective availability/history and bill snapshots. Inclusive/compound/withholding, fiscal positions, returns/localisation and source configuration migration remain open. |
| F142 | Finance > Configuration > Accounting > Journals | foundation | Transactional company/year general-journal numbering and immutable entries. Configurable journal books, series, defaults, currencies and controls remain open. |
| F143 | Finance > Configuration > Accounting > Currencies | partial | Explicit procurement/accounting/settlement rate snapshots with exact AED/USD/EUR arithmetic, different invoice/bank currencies and realised settlement difference. Wider minor-unit policies, dated revaluation, bank remeasurement and configuration/source migration remain open. |
| F144 | Finance > Configuration > Accounting > Fiscal Positions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F145 | Finance > Configuration > Accounting > Multi-Ledger | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F146 | Finance > Configuration > Invoicing > Payment Terms | foundation | Independently approved company supplier payment days/effective dates freeze into quotations/orders. Full payment-term schedules, instalments, discounts, customer terms and invoice/accounting integration remain open. |
| F147 | Finance > Configuration > Invoicing > Product Categories | partial | Company product category create/rename/archive with stable IDs and retained product/history links. Hierarchy, accounting/valuation policies and source import remain open. |
| F148 | Quality, HSE & Specifications > Snags & defects | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F149 | Quality, HSE & Specifications > Quality & HSE Actions | partial | Typed NCR observation, containment, cause/disposition, independently reviewed plans, corrective actions, hashed local evidence, independent verification/failure/closure/reopening and history. Consequence follow-ups are explicit but downstream posting/resolution, broader HSE/inspection/ITP and source parity remain open. |
| F150 | Quality, HSE & Specifications > Document Control & Specifications | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F151 | Quality, HSE & Specifications > Reviews & Turnaround | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F152 | People & HR > Management | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F153 | People & HR > Directory | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F154 | People & HR > Departments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F155 | People & HR > Learning > Certifications | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F156 | People & HR > Learning > Training Attendances | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F157 | People & HR > Reporting > Skills Inventory | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F158 | People & HR > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F159 | People & HR > Configuration > Employee > Onboarding / Offboarding | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F160 | People & HR > Configuration > Employee > Employee Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F161 | People & HR > Configuration > Employee > Work Locations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F162 | People & HR > Configuration > Employee > Departure Reasons | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F163 | People & HR > Configuration > Employee > Skill Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F164 | People & HR > Configuration > Time Management > Working Schedules | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F165 | People & HR > Configuration > Time Management > Time Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F166 | People & HR > Configuration > Recruitment > Job Positions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F167 | People & HR > Configuration > Recruitment > Contract Templates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F168 | Time Off > My Time > Days Off | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F169 | Time Off > My Time > Requests | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F170 | Time Off > Overview | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F171 | Time Off > Management > Time Off | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F172 | Time Off > Management > Allocations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F173 | Time Off > Reporting > by Employee | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F174 | Time Off > Reporting > by Type | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F175 | Time Off > Reporting > Balance | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F176 | Time Off > Configuration > Time Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F177 | Time Off > Configuration > Accrual Plans | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F178 | Time Off > Configuration > Company Holidays | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F179 | Time Off > Configuration > Mandatory Days | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F180 | Time Off > Configuration > Automatic Rules | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F181 | Attendance > My Attendances | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F182 | Attendance > Management > Dashboard | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F183 | Attendance > Management > Employees | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F184 | Attendance > Management > Attendances | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F185 | Attendance > Kiosk Mode | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F186 | Attendance > Reporting > Attendances | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F187 | Attendance > Reporting > Time Off Ledger | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F188 | Attendance > Configuration > Time Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F189 | Attendance > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F190 | Attendance > Configuration > Automatic Rules | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F191 | Attendance > Configuration > Onboarding | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F192 | Timesheets > Timesheets > My Timesheets | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F193 | Timesheets > Timesheets > All Timesheets | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F194 | Timesheets > Reporting > Timesheets > By Employee | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F195 | Timesheets > Reporting > Timesheets > By Project | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F196 | Timesheets > Reporting > Timesheets > By Task | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F197 | Timesheets > Reporting > Timesheets > By Billing Type | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F198 | Timesheets > Reporting > Timesheets / Attendance Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F199 | Timesheets > Configuration | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F200 | Plant & Equipment > Dashboard | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F201 | Plant & Equipment > Maintenance > Maintenance Requests | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F202 | Plant & Equipment > Equipment | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F203 | Plant & Equipment > Reporting > Maintenance Requests Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F204 | Plant & Equipment > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F205 | Plant & Equipment > Configuration > Maintenance Teams | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F206 | Plant & Equipment > Configuration > Equipment Categories | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F207 | Fleet > Fleet > Fleet | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F208 | Fleet > Fleet > Contracts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F209 | Fleet > Fleet > Services | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F210 | Fleet > Fleet > Odometers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F211 | Fleet > Reporting > Costs | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F212 | Fleet > Reporting > Odometers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F213 | Fleet > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F214 | Fleet > Configuration > Models > Manufacturers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F215 | Fleet > Configuration > Models > Models | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F216 | Fleet > Configuration > Models > Categories | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F217 | Fleet > Configuration > Contracts > Contract Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F218 | Fleet > Configuration > Services > Service Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F219 | Fleet > Configuration > Vehicle > Status | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F220 | Fleet > Configuration > Vehicle > Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F221 | Fleet > Configuration > Activity Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F222 | Contacts & Masters > Contacts | partial | Shared party identity with company-specific roles/contact details/terms, explicit authorised linking, safe shared renames, archive and document snapshots. Contact hierarchy, tags, multiple addresses and full source migration remain open. |
| F223 | Contacts & Masters > Configuration > Contact Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F224 | Contacts & Masters > Configuration > Industries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F225 | Contacts & Masters > Configuration > Localization > Countries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F226 | Contacts & Masters > Configuration > Localization > Fed. States | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F227 | Contacts & Masters > Configuration > Localization > Cities | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F228 | Contacts & Masters > Configuration > Localization > Country Group | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F229 | Team Discussions > Discuss | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F230 | Team Discussions > Channels | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F231 | Team Discussions > Call History | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F232 | Team Discussions > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F233 | Team Discussions > Configuration > Categories | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F234 | Team Discussions > Configuration > Canned Responses | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F235 | Team Discussions > Configuration > Roles | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F236 | Team Discussions > Configuration > User Settings > Notifications | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F237 | Team Discussions > Configuration > User Settings > Voice & Video | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F238 | My Tasks | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F239 | Users & Access > Add User | partial | Reviewed individual local account creation, existing non-administrator identity binding and one-time manual activation; explicit scope/limits and audit. Contact/email/language/default-company preferences, invitation transport and exact source parity remain open. Supplier-only AP preparation, separately reviewed zero-default AP limits and immutable bill/credit decisions are now included. |
| F240 | Users & Access > Manage Users | partial | Individual sign-in, live role/company/project controls, independent access/administrative review, revocation, recovery and session management. Delegation, configurable approval routes and full source-role acceptance remain open. Supplier-only AP preparation, separately reviewed zero-default AP limits and immutable bill/credit decisions are now included. |
| F241 | Users & Access > Access Presets | partial | 27 explicit role presets; 23 assignable. Plain-language effective-access review, separate pricing/budget access and independent administrative authority. Source role-by-role acceptance and additional same-scope roles remain open. Supplier-only AP preparation, separately reviewed zero-default AP limits and immutable bill/credit decisions are now included. |
| F242 | Users & Access > Advanced Native User Settings | partial | Original local account/session/password/recovery controls; no Odoo dependency. Advanced authentication, MFA/passkeys/SSO, preferences and equivalent source settings remain open. Supplier-only AP preparation, separately reviewed zero-default AP limits and immutable bill/credit decisions are now included. |
| F243 | Administration > Calendar > Calendar | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F244 | Administration > Calendar > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F245 | Administration > Calendar > Configuration > Calendars | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F246 | Administration > Calendar > Configuration > Work Locations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F247 | Administration > Calendar > Configuration > Reminders | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F248 | Administration > Calendar > Configuration > Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F249 | Administration > Cost Codes | partial | Company-scoped cost-code creation and WBS association with audit evidence. Full code lifecycle, classification and migration remain open. |
| F250 | Administration > Buildings, floors & zones | partial | Create/edit stable site/building/floor/unit/zone/system hierarchy; scoped cycle checks, hierarchy ordering, reasons and versions. Archive/effective-date policy and source import remain open. |
| F251 | Administration > Construction disciplines | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F252 | Administration > Business Audit | partial | Append-only access, request, procurement, setup and budget history with before/after evidence. Full audit query/export, external evidence and tamper-resistance operations remain open. NCR cycle/plan/action/evidence snapshots and independent decisions are now also append-only. General-ledger journal/configuration snapshots, posting and reversal events are also retained. Supplier-only AP preparation, separately reviewed zero-default AP limits and immutable bill/credit decisions are now included. |
| F253 | Administration > Project threshold rules | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F254 | Administration > Implementation workbook | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F255 | Administration > CRM Data Import | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F256 | Administration > Site resources | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F257 | Administration > P6 / Jisr source mappings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F258 | Administration > Integration inbox | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F259 | Administration > Production readiness | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F260 | Administration > Form Designer | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F261 | Administration > Report Builder | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F262 | Administration > Automation Builder | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F263 | Administration > Screen Builder | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F264 | Administration > AI connections | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F265 | Administration > Settings > General Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F266 | Administration > Settings > Users & Companies > Users | partial | Original reviewed account provisioning, activation, authentication and session/recovery controls. Network-release hardening and full source identity migration remain open. |
| F267 | Administration > Settings > Users & Companies > Companies | partial | Legal company creation/details, fixed supported functional currency, separate organisation administration and no automatic business grants. Periods, numbering, tax/localisation and intercompany controls remain open. |
