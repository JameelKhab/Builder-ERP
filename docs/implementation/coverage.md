# Builder ERP implementation coverage — 29 October 2026

The full scope is retained: **267 functions, 34 data contracts, 21 domains**. This is a current implementation overlay on the historical comparison. No function is certified as migrated or full parity. “Partial” describes a tested subset; “foundation” describes shared models/controls, not a finished screen. The ERP goal remains active.

## Current work

The connected procurement increment implements unpriced demand → supplier quotes/FX → independent sourcing review → local orders → partial receipts/rejections → supplier returns/material consumption → operational cost facts. See `contracts/procurement-v1.md` and `procurement-local.md`.

## Remaining build sequence

1. Complete authenticated local multi-user identity, account provisioning, reference/master maintenance, WBS/budget revision and approval policy.
2. Connect purchases to supplier bills, tax/FX/rounding policies, original balanced journals, payment allocation, bank clearance and cash forecasts; expand warehouse/material operations.
3. Tender/estimating/BOQ-to-project handover; measured client and subcontract certification, advances, retention, variations, securities and final accounts.
4. Programme/progress/delay, site diaries and resources; NCR/quality/safety, controlled documents/RFIs, testing, snagging and handover.
5. People/HR/payroll, plant/assets/fleet, CRM/sales, collaboration and configuration/integration functions retained in the comparison.
6. All project/company reports and KPI populations, report findings and exports; governed contextual AI with evidence, permission checks and reviewable actions.
7. Source export mapping, idempotent staging/import, opening and transaction/attachment reconciliation, backup/restore drills, representative-user walkthroughs and local release verification.

This sequence is dependency driven. Source verification and migration contracts continue alongside each domain; financial/legal settings that are not supplied remain explicit configuration, never invented production policy. Local sample identity, illustrative balances and generic registers cannot satisfy these gates.

## Every recorded function

| ID | Source destination | Local status | Current implementation / remaining work |
|---|---|---|---|
| F001 | Dashboard | partial | Project/company cost report combines illustrative opening balances with local PO commitments and material-consumption facts; findings and source links. Other dashboard metrics remain open. |
| F002 | Reports > Ledger, trial balance & aging | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F003 | Reports > Company cash flow | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F004 | Reports > Cash-flow accounting policies | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F005 | Reports > BOQ & building cost control | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F006 | Reports > Approved unbilled certificates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F007 | Reports > Project exceptions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F008 | Reports > Project cost & forecast (CVR) | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F009 | Reports > Cost forecasts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F010 | Reports > Project cash forecasts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F011 | Reports > Project cash forecast | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F012 | Reports > Posted Ledger | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F013 | Reports > Quality / HSE Reporting | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F014 | Reports > Project-control audit | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F015 | Reports > Scheduled reports | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F016 | Reports > Document Lifecycle Reporting | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F017 | Reports > Saved Dashboards > Dashboards | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F018 | Reports > Saved Dashboards > Configuration > Dashboards | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F019 | Reports > Saved Dashboards > Configuration > Sections | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F020 | Reports > Saved Dashboards > Configuration > Share links | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F021 | My Approvals & Activities | partial | Legacy request review plus typed sourcing reviews; no general configurable workflow engine. |
| F022 | CRM > Sales > My Pipeline | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F023 | CRM > Sales > My Activities | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F024 | CRM > Sales > My Quotations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F025 | CRM > Sales > Teams | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F026 | CRM > Sales > Customers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
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
| F038 | Tender & BOQ > BOQ workbook intake | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F039 | Tender & BOQ > BOQ estimates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F040 | Tender & BOQ > Study versions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F041 | Tender & BOQ > Estimate analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F042 | Sales & Quotations > Orders > Quotations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F043 | Sales & Quotations > Orders > Orders | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F044 | Sales & Quotations > Orders > Customers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F045 | Sales & Quotations > Products > Products | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
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
| F056 | Projects > Projects | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F057 | Projects > Tasks > My Tasks | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F058 | Projects > Tasks > All Tasks | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F059 | Projects > Reporting > Tasks Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F060 | Projects > Reporting > Customer Ratings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F061 | Projects > Reporting > Margins | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F062 | Projects > Reporting > Forecast Margins | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F063 | Projects > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F064 | Projects > Configuration > Projects | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F065 | Projects > Configuration > Project Templates | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F066 | Projects > Configuration > Project Roles | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F067 | Projects > Configuration > Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F068 | Projects > Configuration > Activity Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F069 | Projects > Configuration > Activity Plans | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F070 | Project requisitions | partial | Typed multi-line unpriced demand, draft revision, submission, supplier quotations/allocation, independent approval and local orders. No requisition amendments after submission, partial-demand awards or source import. |
| F071 | Project set-up | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F072 | Material returns | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F073 | WBS & Budgets > Open WBS & Budgets | foundation | Typed WBS reference and released-allowance enforcement. Full WBS editor, hierarchical rollups and approved budget baseline/revisions remain open. |
| F074 | WBS & Budgets > Budget revisions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F075 | Site receipts | partial | PO-line receipts with accepted/rejected quantities, delivery reference, retry key and returns; no uploaded delivery evidence or invoice match. |
| F076 | Site diaries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F077 | Contracts & measured BOQ > Open Contracts & measured BOQ | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F078 | Contracts & measured BOQ > BOQ revisions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F079 | Contracts & measured BOQ > Variations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F080 | Site materials & issues | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F081 | Purchasing > Orders > Requests for Quotation | partial | Product-specific immutable supplier quotes, currency from vendor, dated FX and exact multi-vendor allocations. No outbound RFQ or supplier portal. |
| F082 | Purchasing > Orders > Purchase Orders | partial | Local orders grouped by supplier/currency, frozen rate snapshots, independent approval, commitment facts and connected deliveries. Bills, taxes, payment terms, closure and order amendments remain open. |
| F083 | Purchasing > Orders > Purchase Agreements | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F084 | Purchasing > Orders > Vendors | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F085 | Purchasing > Products > Products | foundation | Typed company-specific sample product/UOM masters used by requests and deliveries. Product maintenance, variants and valuation policies remain open. |
| F086 | Purchasing > Reporting > Purchase | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F087 | Purchasing > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F088 | Purchasing > Configuration > Vendor Pricelists | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F089 | Purchasing > Configuration > Products > Categories | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F090 | Purchasing > Configuration > Products > Units & Packagings | foundation | Explicit stock/request product unit. UOM registry, conversions and packaging remain open. |
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
| F108 | Stores & Receipts > Products > Products | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F109 | Stores & Receipts > Reporting > Stock | partial | Per-receipt available quantity/value after returns and consumption. Full warehouse/location stock reporting, count adjustments and valuation periods remain open. |
| F110 | Stores & Receipts > Reporting > Moves History | partial | Append-only receipt/return/consumption movement ledger, actor, reason, location and cost source. Search/export and all other movement types remain open. |
| F111 | Stores & Receipts > Reporting > Moves Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F112 | Stores & Receipts > Reporting > Returns | partial | Supplier return of available accepted goods reopens supply; consumed stock cannot be returned. Return-to-store, credits and intercompany returns remain open. |
| F113 | Stores & Receipts > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F114 | Stores & Receipts > Configuration > Warehouse Management > Warehouses | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F115 | Stores & Receipts > Configuration > Warehouse Management > Operations Types | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F116 | Stores & Receipts > Configuration > Products > Categories | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F117 | Stores & Receipts > Configuration > Products > Units & Packagings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F118 | Labour & plant allocation | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F119 | Labour & plant actual feeds | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F120 | P6 schedule progress | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F121 | Finance > Dashboard | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F122 | Finance > Customers > Invoices | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F123 | Finance > Customers > Credit Notes | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F124 | Finance > Customers > Payments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F125 | Finance > Customers > Products | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F126 | Finance > Customers > Customers | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F127 | Finance > Vendors > Bills | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F128 | Finance > Vendors > Refunds | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F129 | Finance > Vendors > Payments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F130 | Finance > Vendors > Products | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F131 | Finance > Vendors > Vendors | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F132 | Finance > Accounting > Transactions > Journal Entries | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F133 | Finance > Review > Control > Journal Items | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F134 | Finance > Review > Control > Audit Trail | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F135 | Finance > Reporting > Management > Invoice Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F136 | Finance > Reporting > Management > Cashflow Analysis | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F137 | Finance > Reporting > Management > Analytic Report | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F138 | Finance > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F139 | Finance > Configuration > Online Payments | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F140 | Finance > Configuration > Accounting > Chart of Accounts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F141 | Finance > Configuration > Accounting > Taxes | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F142 | Finance > Configuration > Accounting > Journals | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F143 | Finance > Configuration > Accounting > Currencies | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F144 | Finance > Configuration > Accounting > Fiscal Positions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F145 | Finance > Configuration > Accounting > Multi-Ledger | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F146 | Finance > Configuration > Invoicing > Payment Terms | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F147 | Finance > Configuration > Invoicing > Product Categories | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F148 | Quality, HSE & Specifications > Snags & defects | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F149 | Quality, HSE & Specifications > Quality & HSE Actions | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
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
| F222 | Contacts & Masters > Contacts | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
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
| F239 | Users & Access > Add User | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F240 | Users & Access > Manage Users | partial | Existing-user business grants, active status, reviewed changes, limits and access history. Production identity and provisioning remain open. |
| F241 | Users & Access > Access Presets | partial | 27 explicit role presets; 23 assignable. Per-domain capabilities and separate pricing/budget access. Source role-by-role acceptance remains open. |
| F242 | Users & Access > Advanced Native User Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F243 | Administration > Calendar > Calendar | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F244 | Administration > Calendar > Configuration > Settings | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F245 | Administration > Calendar > Configuration > Calendars | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F246 | Administration > Calendar > Configuration > Work Locations | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F247 | Administration > Calendar > Configuration > Reminders | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F248 | Administration > Calendar > Configuration > Tags | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F249 | Administration > Cost Codes | foundation | Existing cost-item references linked to typed WBS. Cost code administration remains open. |
| F250 | Administration > Buildings, floors & zones | foundation | Typed company/project building-floor-unit sample hierarchy used in requests and movements. Hierarchy maintenance and systems/location imports remain open. |
| F251 | Administration > Construction disciplines | open | Comparison requirement remains in scope. Existing sample register or navigation is not operational acceptance. |
| F252 | Administration > Business Audit | partial | Append-only access, request and procurement events. Full business audit query/export, external evidence and tamper-resistance operations remain open. |
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
| F266 | Administration > Settings > Users & Companies > Users | partial | Existing-user scope and status management. Account creation and authenticated multi-user sessions remain open. |
| F267 | Administration > Settings > Users & Companies > Companies | foundation | Separate seeded legal companies and currencies, current role scopes; no company policy/period/tax administration yet. |
