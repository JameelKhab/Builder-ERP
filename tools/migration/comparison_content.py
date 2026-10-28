"""Original requirements analysis. Source screens are evidence, never application code.

The leaf specifications below are proposed preservation/acceptance requirements.
They do not assert that menu-only source destinations have verified behaviour.
"""

DOMAINS = [
dict(id='D01', title='Dashboards, reports and KPIs', roots=['Dashboard','Reports'], route='Project Overview / Costs & Contracts > Reports; Company > Reports', evidence='02, 40, 65-69, 73-76, 81-84, 87-92; fresh company dashboard',
 observed='JAKH separates approved commitments, posted cost, certified gross and posted billing. The dashboard states physical progress is weighted by original WBS budget; financial progress uses certified gross / revised contract value; CPI/SPI use earned value. Reports expose source records, unallocated cost and approved forecasts. Company cash-flow policy and forecast registers were empty in the sample; that does not prove the feature is absent.',
 current='Partial: Builder has a deterministic cost report with project/company scope, findings and CSV export. Its amounts come from seeded cost_items snapshots. It has no transaction-derived ledger, approved forecast versions, scheduling, configurable dashboards, earned-value engine or the other JAKH reports.',
 preserve='Keep metric definitions, cutoff, company/currency, record states, cost allocation and source drill-down. Recompute ratios from numerator/denominator populations. Distinguish posted cash from bank clearance. Use the latest approved forecast at the cutoff, retaining earlier versions. Each report needs its own findings rules and export.',
 data='Report definitions; source fact type/ID/date; metric versions; approved forecasts and snapshots; WBS/location allocation; cash-flow policies; saved filters and dashboard definitions; subscriptions and share permissions.',
 verify='Report joins, permission filters, reversal handling, snapshot dates, policy approval, scheduler and share-token behaviour remain untested in JAKH. No full report-result reconciliation or JAKH data import has occurred.',
 example='For one work item: revised budget 110,000; incurred 60,000; cash 45,000; remaining work 48,000; forecast 108,000; headroom 2,000. The report must explain the 15,000 cost/cash difference and never add total commitments to incurred cost. This is a proposed acceptance fixture, not a JAKH transaction.'),
dict(id='D02', title='Approvals and personal work', roots=['My Approvals & Activities','My Tasks'], route='My Work > Approvals / Tasks; context on every record', evidence='15-16, 30, 50, 53-54; navigation 41',
 observed='JAKH records technical, commercial and finance certificate review stages, submission cycles, reviewer/time/decision/note, and frozen quantities at finance approval. Contract policy describes optional independent people; role-based stages alone may allow one person with several roles. Role previews change menu access.',
 current='Partial: purchase-request draft/submit/return/approve, independent approver, membership limit, optimistic version check and append-only request events. My Work also displays synthetic records. No configurable cross-module approval policy, delegation, escalations or general task service.',
 preserve='Route by company, document type, value, risk and role; show current owner, stage, deadline and reason. Snapshot policies per submission. Changing the approved version invalidates downstream authority as policy requires. Separate queue visibility from permission to decide.',
 data='Policies/versions; stages; approvers; limits/currency basis; substitutes; submission cycles; decisions; task links; reminders; audit actors and timestamps.',
 verify='Verify each source workflow separately: required roles, independence setting, returns, cancellation, delegation and locked-state edits. Do not generalise request approval into certificate or financial posting approval.',
 example='A returned certificate keeps cycle 1. Correcting quantity starts cycle 2; only its current version can be approved. An authorised substitute can act with a recorded delegation, while the original requester cannot self-approve where independence is required.'),
dict(id='D03', title='CRM and bid decisions', roots=['CRM'], route='Tenders > Opportunities / Bid decisions; Company > Customers', evidence='51; navigation 41',
 observed='Pipeline was inspected; navigation includes opportunities, activities, quotations, teams, customers, forecasts, lead/pipeline/activity reports and stage/lost-reason configuration. The full conversion and forecast rules were not tested.',
 current='Synthetic tender/opportunity records only. No opportunity CRUD, bid/no-bid workflow, sales-team setup or CRM reporting.',
 preserve='Preserve customer/opportunity identity, bid deadlines, activities, ownership, stage history, probability definitions, lost reasons and quotation/estimate links. Bid/no-bid decision records risks, authority and rationale.',
 data='Leads/opportunities; customer contacts; teams; stage histories; activities; qualification documents; lost reasons; quotations and tender links.',
 verify='Confirm duplicate lead handling, currencies, weighted forecast method, stage gates and opportunity-to-estimate-to-quotation mapping.',
 example='A tower invitation closes on 15 November. The estimator sees one bid case with deadline, client, risk decision, documents and estimates; losing the bid preserves its priced versions and reason.'),
dict(id='D04', title='Estimating, BOQ and tender handover', roots=['Tender & BOQ'], route='Tenders > Estimate > BOQ / Pricing / Versions / Handover', evidence='05-07, 52',
 observed='Estimate EST/2026/00004 has BOQ/assemblies, building quantities, study versions, parent BOQ/share fields, direct cost, indirect allocation, overhead, profit, item/header markup, currency and approval history. Its visible pricing basis is direct plus proportional indirect, then overhead, profit and legacy markup. Handover links quotation and project; WBS budgets remain draft.',
 current='Synthetic tender examples; no workbook intake, assembly/resource model, repeated-building quantity engine, version lock, pricing calculation or award handover.',
 preserve='Preserve source workbook provenance, row codes, parent/child BOQ, units, assembly resources, building-specific quantities and variants, pricing sequence and precision. Approved studies lock; revisions remain distinct. Award produces linked draft commercial and budget records without silently releasing them.',
 data='Workbook/row mappings; estimate headers; BOQ groups/lines; assembly components; rates and dates; location quantities; indirect pools; pricing order; versions; approvals; quotation/project/WBS crosswalk.',
 verify='Verify import validation, parent caps/shares, repeated-building exceptions, resource conversion, rounding and exact markup order with saved examples. Inspect hidden detail forms before implementing formulas.',
 example='Ten typical floors and two modified floors share an assembly. Reprice steel without overwriting the accepted tender; compare the new version, approve it, and hand over exact location quantities and the approved budget basis.'),
dict(id='D05', title='Sales quotations and orders', roots=['Sales & Quotations'], route='Tenders > Quotations / Awards; Company > Sales administration', evidence='05-07, 16; navigation 41',
 observed='Approved estimate links a quotation; client contract links a sales order. Navigation includes quotations/orders, customer/product/pricelist records, sales reports, payment settings and templates. Full sales order transitions were not tested.',
 current='No sales quote/order model, pricing catalogue, acceptance workflow or invoice linkage. Tender examples do not implement these functions.',
 preserve='Carry estimate version, exclusions, quantities, currency, validity, tax basis, terms and acceptance into an order and client contract. Templates, price rules, customer history and amendment authority remain accessible.',
 data='Quotes/orders/lines; estimate revision; customers; products/pricelists; validity/terms/taxes; acceptance; templates; invoice and contract links.',
 verify='Confirm quotation revision policy, order confirmation, cancellation, invoicing basis, payment settings and whether repeated product/customer menus open the same records.',
 example='The accepted tower quote creates one linked order and contract. A revised offer remains visibly separate until accepted; the original approved estimate and offer remain readable.'),
dict(id='D06', title='Projects, mobilisation and location structure', roots=['Projects','Project set-up'], route='Projects > Overview / Plan > Set-up; Company > Project administration', evidence='06-07, 26, 31-33',
 observed='Project links budgets, contracts, requisitions, site materials, service entries, certificates, variations, final accounts and award estimate. Construction setup has an accounting cost centre and structured buildings/floors/zones with code, kind and parent. Direct-award and completed projects exist.',
 current='Partial read scope: projects have ID, company, name, code, a flat location string and phase. No project creation/setup workflow, hierarchy, accounting cost centre, templates, task lifecycle or role administration.',
 preserve='Create a project from award or direct award; one owning company, stable WBS/BOQ/location/system dimensions, responsible team, baseline approvals and readiness checks. Location hierarchy must support tower > floor > unit and cross-location systems without repeated free text.',
 data='Projects; customer/contract links; location tree; WBS; cost centre; phase/history; roles; templates; tasks/dependencies; tags; setup checklist and baseline approvals.',
 verify='Inspect set-up gates, task billing/margin rules, project closure/reopening, hierarchy changes and project-specific access. Preserve linked records when moving or renaming locations.',
 example='Open Tower A > Floor 12 > Unit 1204 once. Its drawings, work quantities, NCRs, material issues, costs and snags resolve to the same structured location.'),
dict(id='D07', title='Requisition, sourcing and purchase orders', roots=['Project requisitions','Purchasing'], route='Project > Buying > Requests / Sourcing / Orders & deliveries; Company > Buying', evidence='19-22; navigation 41',
 observed='JAKH requisition has requested lines, restricted pricing, project/WBS, contract line, location, material-demand reference, required date and reservation/cancellation. Visible text says approved tax-exclusive company-currency prices reserve released WBS budget. Linked PO P00005 exposes received/billed quantities and receipt/bill links.',
 current='Partial only at request: one line per request; vendor holds one price/quote/currency rather than product-specific quote lines; decimal arithmetic, repricing and approval work. There are no RFQs, supplier offers, agreements, PO lines, receipts/bills or reservation ledger. No completed procurement chain.',
 preserve='Capture multi-line demand without forcing a vendor; compare product/quantity/UOM-specific quotes, lead time, tax/freight and validity. Use approved company-currency reservations with release/replacement rules. Split orders by legal company/vendor/currency. Track partial receipt, rejection, returns, billing and cancellation separately.',
 data='Demand; requisitions/lines; reservations; products/UOM; RFQs/offers/lines; agreement terms; approved quote/rate snapshots; PO versions/lines; receipt/bill links and source quantities.',
 verify='JAKH procurement sample is company-currency based; vendor-currency defaults are a requested enhancement, not proven parity. Verify overspend policy, reserved-to-committed handoff, partial cancellation, overreceipt and 3-way matching.',
 example='Request 100 units; award 60 in USD and 40 in AED to different vendors; create linked orders. Receive 30 and reject 5. Only accepted receipts can support the appropriate bill; remaining demand, reservations and FX snapshots stay traceable.'),
dict(id='D08', title='WBS, budgets and cost control', roots=['WBS & Budgets'], route='Project > Plan > Work & budget; Costs & Contracts > Cost control / Forecasts', evidence='25, 65-69, 87-90',
 observed='WBS has parent, code, project/company/currency, cost code, budget and release state. Budget revisions have a separate destination. An editable WBS Forecast Amount of zero was not authoritative: an approved dated forecast of AED 8,428,000 existed with actual snapshot 6,324,447 and remaining uncommitted 2,103,553.',
 current='Seeded flat cost_items contain original/revised budget, commitment, incurred, cash, forecast and request allowance. No WBS hierarchy, budget revisions/release, transaction allocation, resource breakdown, approved forecast history or actual-to-ledger reconciliation.',
 preserve='Original budget never changes; approved revisions build revised budget. Keep reservation, commitment, received exposure/accrual, posted actual, cash and forecast distinct. Allocate costs by work item/location/resource/period; make unallocated visible. Forecast equals actual plus remaining committed plus remaining uncommitted plus risk, each counted once.',
 data='WBS tree; BOQ/WBS/location crosswalk; original and revised budgets; release/approvals; source cost facts; accrual/reversal links; allocations; approved forecast versions and dates; remaining-cost detail.',
 verify='Confirm budget authority/overrun behaviour, accrual clearing, price/quantity variances, stock-consumption versus purchase timing, labour/plant rates and forecast selection at historical cutoffs.',
 example='A late supplier bill replaces an earlier accrual for the same work; actual cost does not double. Revising Floor 12 budget changes the approved revision, while the original tower estimate remains unchanged.'),
dict(id='D09', title='Materials, stores, returns and waste', roots=['Material returns','Site receipts','Site materials & issues','Stores & Receipts'], route='Project > Site > Materials & waste; Company > Stores', evidence='19-22, 65-69, 77-78; navigation 41',
 observed='Requisition/PO/receipt links and stock source records were recorded. Stores navigation includes transfers, stocktake, scrap, replenishment, moves and returns. Scrap form exposes product, quantity/UOM, reason, company and replenishment; full waste handling was not proven.',
 current='Read-only materials/waste/stores examples. No stock ledger, warehouse/location model, receiving, issue/return, reservation, valuation, count adjustment or waste authorisation engine.',
 preserve='Separate ordered, received, quarantined, available, issued, returned, reused and scrapped quantities. Each movement carries source/destination, project/item/location, actor, date and valuation. Waste needs cause, approval, reuse/disposal destination, carrier/evidence and cost treatment.',
 data='Products/UOM/conversions; warehouses/bins; batches/serials where used; opening stock/valuation; receipt/transfer/issue/return/scrap lines; reservations; stocktakes; disposal evidence and linked NCR.',
 verify='Verify valuation method, negative-stock policy, partial/rejected receipt, return-to-supplier credit, physical counts, lot/serial requirements and waste cost recognition. Treat specialist environmental requirements as requirements to confirm, not observed JAKH logic.',
 example='Receive 100 tiles; issue 80; return 5; scrap 3 from issued stock with approval. Preserve the balance and cost provenance, with the NCR linked to the same loss rather than charging it twice.'),
dict(id='D10', title='Site diaries, labour and plant actuals', roots=['Site diaries','Labour & plant allocation','Labour & plant actual feeds'], route='Project > Site > Daily work / Resources; Plan > Look-ahead', evidence='36-38, 81; navigation 41',
 observed='Site diary contains manpower, equipment, photos, work/events and review context. Separate allocation and actual-feed destinations exist. Project-control facts distinguish native workflow and validated integration sources.',
 current='Read-only daily-work examples, with no diary editing, attendance allocation, resource booking, approvals or source-feed ingestion.',
 preserve='Keep planned allocation distinct from accepted actual hours/quantities. Diary evidence records location/work/date/weather/events; approved time and plant use feed costs once. Integration replays must not duplicate actuals.',
 data='Daily diaries; work quantities; worker/crew/equipment identities; allocation and actual lines; rates; evidence; approvals; source-system ID/batch and corrections.',
 verify='Verify paid versus worked hours, overtime, idle time, hired plant minimums, actual acceptance and correction/reversal rules; confirm source systems and ownership.',
 example='A crane planned for eight hours works five and is idle three due to missing drawings. Record both with cause, attach diary evidence and allocate approved cost to the correct work package once.'),
dict(id='D11', title='Client contract, measured BOQ and certification', roots=['Contracts & measured BOQ','Payment certificates'], route='Project > Costs & Contracts > Client contract / Claims & certificates / Changes', evidence='15-17, 46-47, 85-86',
 observed='JAKH has immutable client BOQ in company currency, original/revised contract values, BOQ revisions, building budgets, finance policy and staged certificate approval. Certificates take cumulative installed quantities, derive previous/current/remaining, include approved owner variations and calculate retention/recovery/deductions. Finance approval freezes quantities; linked draft invoice remains separately controlled.',
 current='No contract/BOQ/certificate domain or calculations. Payments and change examples cannot measure, review, certify, revise BOQ or create a linked invoice.',
 preserve='Separate claimed, technically accepted, commercially reviewed, certified, invoiced, due, paid and cleared. Snapshot contract rates/quantities and approved variation entitlement at cutoff. Enforce cumulative limits and explicit corrections; preserve previous approved periods and review cycles.',
 data='Contract header/finance terms; original/revised BOQ/locations; unit rates; certificate periods/lines; previous/current/cumulative quantities; deductions; approval route/cycles; invoice/credit links.',
 verify='Verify overmeasurement, negative corrections, simultaneous certificates, tax/deduction bases, approvals by different people, invoice idempotency and prior-period credit adjustments. Review actual BOQ-revision forms before defining migration columns.',
 example='Previously certified 40 m3; cumulative accepted 55 m3; current period is 15 m3. Returning the submission must not change the approved 40. One approved certificate can generate only the intended invoice, even after a retry.'),
dict(id='D12', title='Advances, retention, securities and final accounts', roots=['Advances & retention releases','Final accounts & closeout','Guarantees & bonds'], route='Costs & Contracts > Advances / Retention / Securities / Final account; Handover > Closeout', evidence='12-13, 16-17, 48-49; navigation 41',
 observed='Client contract links advances/retention and final accounts; visible policy warns an advance ceiling is not cash receipt. Approved final account records certified gross, recovered advance, released retention and approval metadata. A close-contract/project action exists but was not executed. Guarantees have a navigation destination.',
 current='Read-only payment/closeout examples. No advance balances, retention caps/releases, guarantee lifecycle, final-account reconciliation or controlled closure.',
 preserve='Track actual advance receipt/payment separately from contractual entitlement; recover only according to terms and outstanding balance. Release retention/securities against milestones and authority. Technical handover, defect obligations and financial closure stay separate.',
 data='Advance/recovery entries; retention accrual/releases; guarantees/bonds and expiries; final account versions; accepted adjustments; disputes; releases; closure/reopening events and obligations.',
 verify='Verify deduction caps, partial release, foreign-currency advances, bond renewals/calls, outstanding liabilities and closeout blockers. A completed-project sample does not prove all closure checks.',
 example='A floor is accepted while the tower retains defects and an unrecovered advance. Allow partial handover; block unsupported final settlement or release and clearly show the remaining obligations.'),
dict(id='D13', title='Subcontract package through settlement', roots=['Subcontract finance','Subcontract order amendments','Subcontractor applications','Subcontract service entries','Subcontract work corrections'], route='Project > Buying > Subcontracts > Package; Costs & Contracts views link the same package', evidence='27-29, 70-72; navigation 41',
 observed='Service entry records PO line, project/WBS/contract line/location and completed work; visible rule says approval creates received-cost exposure and supplier invoice cannot exceed approved service quantity. Supplier certificate links service entry, agreement, retention/recovery and bill. Agreement has retention percent/cap/accounts, advance/recovery terms and balances. Eight linked certificates were visible.',
 current='Read-only package/application/certificate examples. No tender award, order amendment, measured service approval, quantity ceiling, deduction engine, payable or settlement workflow.',
 preserve='One package holds scope/BOQ, subcontractor, award/order, revisions, applications, accepted measurements, certificates, deductions, bills, payments and balance. Requested, accepted and certified quantities differ. Correct previously accepted work via traceable adjustment; never overwrite paid history.',
 data='Package/award/PO lines; applications and claimed quantities; service entries and acceptance; amendments; corrections; finance agreements; certificates/deductions; bills/credits/payments; guarantees and closeout.',
 verify='Verify amendment authority, overmeasurement, disputed quantities, backcharges, retention caps, advance recovery, bill limits, correction/reversal and settlement gates. Menus alone do not verify those exceptions.',
 example='Claim 120 m2, accept 100, return 20 with reason. At AED 200/m2, gross is 20,000; a 10% retention is 2,000 before tax/other agreed deductions. The bill and subsequent correction retain links to approved measurements.'),
dict(id='D14', title='Programme, progress and delay', roots=['P6 schedule progress'], route='Project > Plan > Programme / Look-ahead / Constraints / Delay events', evidence='42, 79-80; navigation 41',
 observed='JAKH declares Primavera P6 as schedule master; accepted WBS progress contributes planned/earned value. Sample progress can be manual and some activity/location/finish links were blank. A full critical-path or EOT engine was not proven.',
 current='Programme/KPI examples only; no activity/dependency/calendar model, baseline import, progress approval, schedule update or delay assessment.',
 preserve='Declare master per project; preserve baseline/current version, calendars, activity/WBS/location mappings, data date, progress basis and acceptance. Link constraints/delay events to instructions, diaries and mitigation. Keep forecast completion separate from contractual extension entitlement.',
 data='Schedule versions; activities/dependencies/calendars; baseline and current dates; progress snapshots; PV/EV basis; resource links; delay events/notices; evidence and accepted extensions.',
 verify='Confirm required P6 exchange format and external ownership, accepted manual fallback, duplicate-import handling, baseline changes, float/critical-path method and delay-analysis requirements. Retaining an integration requires explicit scope treatment, not silent removal.',
 example='A delayed drawing blocks Floor 12 concrete. The same event links RFI, diary and affected activity; show forecast slippage and mitigation while an EOT assessment remains separately reviewed.'),
dict(id='D15', title='Finance, payments and cash', roots=['Finance'], route='Company > Finance; project-linked views in Costs & Contracts', evidence='70, 73-76, 91-92; navigation 41',
 observed='JAKH exposes receivables/payables, journals/items, audit trail, accounting reports, taxes, chart of accounts, currencies, fiscal positions and multi-ledger. A posted customer payment had balanced bank/receivable entries and invoice reference. Posted payment evidence did not prove bank reconciliation.',
 current='No original accounting engine, receivable/payable subledger, journals, tax/period controls, payment allocation, bank reconciliation, FX gains/losses or financial statements. The cost report and payment examples are not accounting.',
 preserve='Build original double-entry accounting with company periods/numbering, immutable posting and authorised reversals. Reconcile AP/AR, advances, retention, stock/project costs, cash and bank. Keep operational certificates separate from legal invoices. Preserve currencies, rates and settlement differences.',
 data='COA/journals/taxes/periods; invoice/bill lines; open items; credit notes; journal entries/items; payment allocations; bank statements/reconciliations; exchange rates; control-account links and analytic allocation.',
 verify='Source posting rules, localisations, tax treatment, lock dates, currencies and multi-ledger purpose need validation. The demo is not the production accounting migration source. No opening balance, trial balance, AP/AR or bank reconciliation has been imported.',
 example='A USD supplier bill is booked at one rate and partially paid at another. Record remaining USD liability, company-currency cash and realised FX separately; settle only the approved payment and reconcile the bank independently.'),
dict(id='D16', title='Quality, NCR, safety and document control', roots=['Quality, HSE & Specifications'], route='Project > Site > Quality & safety; Documents > Controlled documents / Reviews; Handover > Snags', evidence='09-11, 34-35, 43-45, 56-60, 82',
 observed='Quality/HSE action and NCR records were inspected; document categories include drawings, submittals, specifications, methods, ITP and correspondence. Approved revision B was Current while approved A was Superseded. Review report includes reviewer, due/completed dates, state, register status, issued-for-construction and cycle/age. Snag links location, WBS/BOQ and contractor.',
 current='Read-only NCR, drawing, RFI and snag examples. No controlled revision workflow, attachment storage, review routing, ITP holds, NCR verification or closure/reopening.',
 preserve='Keep NCR requirement/inspection, containment, root cause, disposition/remedy, responsible party, evidence, independent verification and closure/reopen. Connect cost, waste, change and delay consequences. Documents require unique identity plus revision, issue purpose, supersession, distributions and review history; approval is distinct from current/issued-for-construction.',
 data='Quality/HSE cases; severity/type; requirement/inspection reference; remedies/verifications; attachments/photos; document identities/revisions/hashes; review cycles/transmittals; snag locations and acceptance.',
 verify='Confirm source NCR transition requirements, HSE reporting/restrictions, review routing and enforcement of superseded drawings/hold points. The external NCR-kit reference was contextual; no kit was purchased/imported and its content is not proof of JAKH capability.',
 example='Concrete fails inspection. Open one NCR, contain work, approve a remedy, attach retest evidence and verify closure. Link rework cost/waste/delay without duplicate cases. Workers must find the correct approved drawing revision for that location.'),
dict(id='D17', title='People, HR, leave, attendance and timesheets', roots=['People & HR','Time Off','Attendance','Timesheets'], route='Company > People; My Work > Self-service; Project > Site > Resource time', evidence='Navigation 41 (functional depth not sampled)',
 observed='Menus cover people/directory/departments, skills, certifications/training, onboarding/offboarding, employment types, locations/schedules, recruitment job positions/templates, leave requests/allocations/accruals/holidays, attendance/kiosk and timesheet reporting. Menu names establish scope only; payroll calculation was not demonstrated.',
 current='A few read-only people/time examples; no employee lifecycle, leave balance/accrual engine, attendance capture, timesheet submission/approval or payroll integration.',
 preserve='Keep private employee records scoped; effective-dated employment/schedules, leave entitlement/approval, attendance corrections and approved project time. Do not conflate attendance, timesheet cost, billable hours and payroll. Preserve configuration and report dimensions.',
 data='Employees; departments/positions; contracts and dates; skills/certifications; leave types/balances/allocations/accruals; calendars/holidays; attendance events; timesheets and approvals; external payroll/source IDs.',
 verify='Inspect forms and policies per company, overtime/time zones, accrual/rounding, overlapping leave, kiosk identity, payroll scope and statutory needs. Rebuild confirmed functionality; decide payroll depth explicitly rather than infer it from menus.',
 example='A worker attends eight hours, books six to Tower A and two to training. Approved project cost is six hours; attendance and payroll retain their own rules. A leave correction preserves the original approval history.'),
dict(id='D18', title='Plant, assets and fleet', roots=['Plant & Equipment','Fleet'], route='Company > Assets & fleet; Project > Site > Plant & equipment', evidence='61-64; navigation 41',
 observed='Twenty equipment records were visible; TC-01 showed serial, acquisition cost/vendor/model, warranty, maintenance team, reliability fields and 14 maintenance links. Fleet menus include vehicles, contracts, services, odometers and costs. Custody, hire and depreciation workflows were not proven.',
 current='Read-only asset/maintenance/fleet examples. No asset registry CRUD, work orders, preventive schedule, custody/transfer, hire return, utilisation or fixed-asset accounting.',
 preserve='Maintain owned/hired asset identity, availability, custody, site transfers, service/calibration obligations, downtime and cost. Fleet keeps mileage/services/contracts. Installed building assets remain connected to commissioning/warranty and handover, separate from contractor plant.',
 data='Equipment/vehicles; tags/serial/model; owner/hire contracts; acquisition/warranty; maintenance requests/parts; odometer; custody/transfers; utilisation; depreciation policy if required; installed asset register.',
 verify='Confirm asset accounting versus maintenance boundaries, depreciation requirements, transfer acknowledgements, hire billing, work-order approvals and installed-system handover.',
 example='Transfer crane TC-01 from Tower A to Tower B with custody acknowledgement, off-hire/maintenance checks and dated cost allocation. A lift handed to the client follows installed-asset acceptance and warranty records instead.'),
dict(id='D19', title='Contacts, catalogue and shared reference data', roots=['Contacts & Masters'], route='Company > Contacts & catalogue; contextual pickers', evidence='Navigation 41; vendor details in 19-22, 70-72',
 observed='Contacts/localisation configuration exist. Products, customers, vendors, categories and UOM recur under several modules. Similar labels are not proof of identical target, view, role or company rules.',
 current='Seeded vendors with one quotation/price/rate each; no full party master, addresses/contacts, product/service catalogue, UOM, bank-change workflow or governed deduplication.',
 preserve='Canonical party identity with customer/vendor roles and company-specific status, terms, currency permissions and approved payment instructions. Canonical product/service and UOM, with contextual finance/procurement/stock fields. Keep each original route until equivalent access is proven.',
 data='Parties/contacts/addresses; company terms and permitted currencies; tax identifiers; approved bank history; products/services/categories; UOM/conversions; geographic reference data; aliases and merge history.',
 verify='Confirm shared versus entity-owned records, duplicate targets, product variants/packaging, currency defaults, payment-instruction approval and identifiers before merging data.',
 example='One supplier serves two companies under different credit terms and currencies. Selecting it on Company A request defaults only A-approved terms; switching company never silently carries Company B bank details or rates.'),
dict(id='D20', title='Collaboration, activities and record history', roots=['Team Discussions'], route='My Work > Discussions; record > Activity & history; Company > Communication settings', evidence='Navigation 41; record activity panels in 05, 15, 72',
 observed='Record forms expose message/note/activity/attachment history. Team Discussions includes channels, call history, roles, canned responses, notifications and voice/video settings. Actual communication/retention capabilities were not exercised.',
 current='Purchase-request event history only; no discussion service, comments/files, mentions, subscriptions, communications permissions or call integration.',
 preserve='Keep a canonical record timeline with authored notes, decisions, attachments and links; distinguish business audit from chat. Preserve channel membership, retention and visibility. A task generated from discussion links the originating record and is not duplicated in another queue.',
 data='Threads/messages; authors/timestamps; record links; attachments/hashes; channels/memberships; activities; notification preferences; call metadata; retention/export rules.',
 verify='Confirm actual messaging, voice/video dependencies, export and retention; never silently replace existing internal communications with a third-party service.',
 example='A supervisor asks for clarification on an NCR. The response and attachment stay with the NCR, the assignee receives one task, and an external subcontractor cannot see internal commercial notes.'),
dict(id='D21', title='Users, company administration and configurable tools', roots=['Users & Access','Administration'], route='Company > Administration; configuration links inside relevant workspaces', evidence='Navigation 41; role previews 30, 50, 53',
 observed='Menus include user creation/presets/native settings, companies, calendars, cost/location/discipline masters, business audit, threshold rules, import/workbook, resources, P6/Jisr mappings, integration inbox, readiness, form/report/automation/screen builders and AI connections. Builders and integration behaviour were not inspected end to end.',
 current='Local sample actor with server scope checks; no production identity, user provisioning, permissions administration, configuration builders, import/integration inbox, audit service or AI connection management.',
 preserve='Implement company/role/project/record authority and policy configuration with traceable changes. Keep configuration discoverable under its domain and administration. Preserve validated import/retry/reconciliation, field/report/automation configuration and integration visibility without inheriting Odoo runtime/code.',
 data='Companies/currencies/period settings; users/memberships/roles/presets; calendars; masters; thresholds; import mappings; integration batches/errors/idempotency IDs; custom definitions/versions; audit events; AI connection metadata (secrets handled separately).',
 verify='Inventory custom fields/actions/reports/automations and external APIs before promising equivalence. Confirm authentication/SSO, server authorisation, company inheritance, maker/checker, restore and integration ownership.',
 example='An administrator maps one P6 activity code to a WBS and reviews a rejected duplicate feed in the inbox. Retrying after correction posts once, with source batch, reviewer and audit event; the AI connection cannot grant itself posting authority.'),
]

# Each numbered line corresponds exactly to one recorded leaf control, in source order.
# The specific requirement/test complements the domain-level comparison above.
LEAF_SPECS = '''
001|Separate physical, certified and posted measures; open contributing records.|A project with no approved progress shows Unknown, not 0%.
002|Preserve ledger, trial balance and aging definitions/cutoffs.|Debits equal credits and AP/AR aging agrees to control accounts.
003|Classify actual cash by approved company policy and period.|A posted receipt and an uncleared bank item remain distinguishable.
004|Version and approve cash-flow classification policy.|Changing account mapping requires a dated policy, not a silent historic rewrite.
005|Analyse BOQ by building/location with explicit unallocated cost.|Floor totals plus unallocated reconcile to project total.
006|Keep approved certificate exposure separate from billing.|An approved certificate with no posted invoice appears exactly once.
007|Explain threshold exceptions with sources and accountable owner.|An over-budget WBS opens the exact dated facts causing the exception.
008|Use actuals and latest approved forecast at cutoff for CVR.|An unapproved forecast cannot replace the approved final-cost figure.
009|Maintain forecast submission/approval/version history.|A second approved forecast preserves the first snapshot and basis.
010|Maintain dated project cash forecast inputs and assumptions.|Expected retention release remains forecast until actual payment is recorded.
011|Render project cash forecast with inflow/outflow timing and assumptions.|Moving a due date changes the matching forecast and findings together.
012|Expose posted project facts with original sources and reversals.|Opening a cost fact reaches the bill or approved source movement.
013|Report quality/HSE by type, age, location and state.|Closed and reopened NCRs follow defined counts, not duplicate cases.
014|Trace project-control facts to source and integration provenance.|A corrected feed shows original and reversing facts without hidden overwrite.
015|Preserve scheduled report parameters, recipients and permissions.|A recipient losing access receives no restricted rows in the next run.
016|Calculate revision review/issue lifecycle and turnaround.|A returned review retains its cycle and due-date history.
017|Open saved dashboards under current permissions.|A saved company view cannot expose another company's restricted project.
018|Configure dashboard definitions with versions and ownership.|Editing a dashboard preserves the prior approved definition.
019|Configure named dashboard sections and metric sources.|A section cannot mix unlike currencies under one unlabeled total.
020|Control dashboard sharing scope, expiry and revocation.|A revoked link fails without leaking cached totals.
021|Unify actionable approvals and activities with source links.|One returned certificate produces one current task with its review stage.
022|Manage opportunity stages, ownership and bid deadlines.|A tower bid moves stage with date and responsible owner recorded.
023|Schedule CRM follow-ups tied to the opportunity.|Completing a follow-up updates the same opportunity timeline.
024|Find quotations linked to opportunities and revisions.|Opening a bid shows its current offer and previous versions.
025|View team ownership and workload.|A reassigned bid retains its earlier team history.
026|Open customer identities in CRM context.|One customer used in CRM and a contract retains one identity.
027|Compute sales forecast with explicit probability/currency basis.|Changing probability changes weighted forecast without changing contract value.
028|Report pipeline stages using a declared cutoff/population.|Won and lost opportunities reconcile to the stage population.
029|Report lead source/conversion without duplicate leads.|Merged leads retain provenance and do not count twice.
030|Report overdue/completed CRM activities.|A completed call no longer appears in overdue tasks.
031|Configure CRM scope and defaults with audit.|A company setting cannot silently affect another company.
032|Maintain sales teams, memberships and ownership.|Removing a member preserves historical opportunity ownership.
033|Define CRM activity types and required fields.|A site-visit activity records its due date and result.
034|Define sequenced activity plans.|Applying a bid plan creates linked tasks once.
035|Maintain pipeline stage definitions and gates.|A stage rename preserves historic stage IDs and reporting.
036|Manage opportunity tags without losing links.|Renaming a tag updates views without duplicating records.
037|Record structured lost reasons and context.|A declined bid remains searchable with its decision reason.
038|Validate BOQ workbook intake before creating controlled rows.|An invalid UOM is quarantined with workbook/sheet/row evidence.
039|Calculate assemblies, location quantities, indirects and selling rates.|A repeated-floor variant changes its quantities without altering other floors.
040|Lock approved estimate versions and compare revisions.|Changing a resource rate creates a new study version.
041|Explain estimate cost, markup, selling price and margin.|Analysis reconciles to line calculations using the documented pricing order.
042|Prepare/version quotations with terms and validity.|An expired offer cannot be silently treated as the accepted contract.
043|Confirm and amend sales orders with accepted scope.|An accepted quote creates a linked order once.
044|Open customer terms from sales context.|The same customer retains company-specific sales terms.
045|Manage saleable products/services and UOM.|A BOQ service line retains its unit and tax classification.
046|Version applicable selling price lists.|A dated quote preserves the price rule used at issue.
047|Report sales with status, period and currency basis.|Cancelled orders are excluded according to a visible report rule.
048|Report salesperson results with attribution rules.|Reassignment does not silently rewrite historical attribution.
049|Report sales by product/service and unit.|Different units are not summed as one quantity.
050|Report customer sales and concentration.|Totals reconcile to the chosen order or invoice basis.
051|Configure sales policies and defaults.|Changing invoicing basis is effective-dated and authorised.
052|Maintain sales team roles and defaults.|A team filter does not override company access.
053|Preserve sales payment settings and provider boundaries.|A payment configuration change never initiates a payment itself.
054|Maintain approved quotation/order templates.|A new template version does not alter previously issued documents.
055|Preserve document headers, footers and legal-company identity.|A Company A quotation never prints Company B legal details.
056|Manage project identity, team, phase and canonical linked records.|A direct award can create a project without a fabricated tender.
057|Show personal project tasks with owners and dependencies.|A blocked inspection task names the unresolved predecessor.
058|Manage all permitted project tasks.|A manager reassigns work without granting unrelated project access.
059|Analyse task progress, delay and workload.|Closed task counts reconcile to source tasks at the cutoff.
060|Preserve customer feedback and rating context.|A rating retains its author, project and collection purpose.
061|Report realised project margin using declared cost/revenue basis.|Certified value is not automatically treated as posted revenue.
062|Report forecast margin from approved contract/cost forecasts.|Unapproved variation value is shown separately from approved margin.
063|Configure project policies and defaults.|Enabling a feature does not rewrite existing project baselines.
064|Maintain project setup/configuration records.|Changing a project manager preserves historical approvals.
065|Create projects from controlled templates.|A copied template creates new IDs and keeps template provenance.
066|Define project roles and authority.|A site role cannot approve financial posting merely by seeing the project.
067|Maintain project tags and filters.|A renamed tag remains linked to existing projects.
068|Configure project activity types.|An inspection activity requires location and responsible role.
069|Configure project activity plans.|A mobilisation plan creates its checklist once per application.
070|Reserve released budget for approved multi-line requisitions and link orders.|Cancelling an unconverted request releases only its remaining reservation.
071|Track mobilisation readiness, cost centre and baseline prerequisites.|A direct-award project shows missing budget/contract approvals explicitly.
072|Return material to stores or supplier with original movement links.|Returning five accepted units adjusts quantity/value once and keeps credit pending.
073|Maintain WBS hierarchy, cost codes and budget release.|A child WBS release respects parent allocations and authority.
074|Approve budget revisions without overwriting original budget.|A 10,000 approved revision raises revised budget while original stays fixed.
075|Record accepted/rejected/partial site receipt against order.|A receipt of 30 against 100 leaves 70 outstanding before rejection adjustments.
076|Capture dated work, manpower, equipment, photos and events.|A corrected diary preserves its prior approved content and author.
077|Maintain immutable contract BOQ and commercial/finance policy.|Award quantities/rates remain traceable after a later approved revision.
078|Approve quantity/rate/scope BOQ revisions with history.|A revised line does not rewrite quantities in an approved prior certificate.
079|Separate owner/subcontract variations, approval and downstream effects.|An approved subcontract change alone does not create a supplier invoice.
080|Link material demand, issue and consumption to work/location.|Stock issued to Floor 12 appears in that work item's source costs.
081|Solicit/compare product-specific supplier quotations.|Two offers with different pack sizes compare after UOM conversion.
082|Create/version purchase orders with partial delivery/billing links.|A retry does not create a second order for the same approved conversion.
083|Maintain dated purchase agreements and call-off limits.|An expired agreement cannot silently supply an approved price.
084|Maintain company-approved vendor terms and status.|A blocked vendor cannot receive an order through another menu.
085|Manage purchasable products/services and supplier identifiers.|Vendor code resolves to the same canonical product and unit.
086|Report purchase commitments, receipts and billing separately.|An order received but not billed appears in the correct exposure bucket.
087|Configure procurement approval, receipt and billing policies.|Changing tolerance cannot retroactively authorise a rejected bill.
088|Maintain vendor prices by product, quantity, currency and validity.|Selecting another vendor reprices each line rather than relabeling its currency.
089|Maintain purchase product categories and control defaults.|Category changes preserve historical order/account treatment.
090|Define units and packaging conversions with precision.|Buying ten boxes of twelve posts 120 base units.
091|Certify cumulative work through technical/commercial/finance reviews.|Previous 40 plus current 15 equals cumulative 55, frozen on approval.
092|Track advances, recoveries and authorised retention release.|Recovery cannot exceed the actual outstanding advance under the policy.
093|Reconcile final account and close only satisfied obligations.|Outstanding disputed work remains visible after partial technical handover.
094|Track bonds/guarantees, expiries, renewals and release evidence.|An expiring performance bond produces a dated action, not automatic release.
095|Configure subcontract finance agreement terms and balances.|Retention cap and advance accounts are explicit before activation.
096|Create supplier certificates from accepted service quantities.|Gross less authorised retention/recovery links to one supplier bill.
097|Manage supplier advance/recovery and retention releases.|Partial retention release leaves a reconciled outstanding balance.
098|Approve subcontract order amendments with commitment effects.|An increased quantity changes the approved order version and remaining commitment.
099|Receive subcontractor claims without treating them as accepted work.|A 120 m2 claim can be assessed as 100 accepted and 20 disputed.
100|Approve completed service against confirmed order lines.|A bill cannot exceed the accepted measured service quantity.
101|Correct accepted subcontract work with traceable adjustment.|A correction after billing links a credit/adjustment instead of overwriting history.
102|Show warehouse workload, stock and exceptions.|A warehouse receipt queue excludes completed/cancelled transfers by rule.
103|Receive warehouse goods with source order and inspection state.|Quarantined goods do not become available stock prematurely.
104|Dispatch or deliver stock with destination acknowledgement.|A partial delivery leaves a traceable backorder.
105|Count and authorise stock adjustments.|A count variance records counted quantity, expected quantity, cause and approver.
106|Scrap approved quantities with reason, valuation and evidence.|Scrap cannot exceed available eligible stock without an explicit exception.
107|Calculate replenishment from stock, demand and outstanding supply.|Existing inbound supply prevents duplicate shortage purchasing.
108|Maintain stockable product/lot/serial rules.|A serialized asset receipt requires unique serial identity.
109|Report stock by location/lot and valuation cutoff.|Opening plus movements equals closing stock.
110|Trace stock move history and source documents.|A return opens its original receipt and subsequent credit status.
111|Analyse stock movement quantities and values.|Unlike units or currencies are grouped or converted explicitly.
112|Report returns by reason, source and settlement state.|A supplier return stays visible until its credit is reconciled.
113|Configure inventory and valuation policies.|Changing valuation rules follows controlled migration rather than silent recalculation.
114|Maintain warehouse/bin ownership and project relationship.|A Company A bin cannot receive Company B goods without explicit intercompany flow.
115|Configure receipt/delivery/transfer operation sequences.|Internal transfer preserves source and destination and creates no false sale.
116|Maintain stock category valuation/control defaults.|Historical movements retain the policy applied when posted.
117|Maintain stock UOM and packaging conversions.|A broken conversion is rejected before a movement is posted.
118|Plan labour/plant allocation by work/date/location.|The same crane cannot be fully allocated to two sites in the same shift without conflict.
119|Accept external actual feeds with mapping and idempotency.|Replaying one source batch does not double hours or costs.
120|Import/accept schedule progress with explicit master and data date.|A stale P6 update cannot silently overwrite a newer approved snapshot.
121|Show financial exceptions and account balances by company.|Company dashboard totals reconcile to its own ledger only.
122|Issue/post customer invoices from controlled sources.|A certificate retry cannot create duplicate receivables.
123|Create linked customer credits and authorised reversals.|A credit adjusts the invoice and remaining open balance with audit.
124|Record/allocate customer receipts separately from clearance.|One receipt can settle two invoices without overstating revenue.
125|Maintain finance-facing product tax/account treatment.|A product change does not rewrite posted invoice lines.
126|Maintain customer receivable terms and control context.|Customer aging agrees to its open invoice balance.
127|Post vendor bills subject to receipt/service and approval rules.|A bill beyond approved service quantity is held as an exception.
128|Process linked vendor credits/refunds.|A supplier credit reduces payable and corrects source cost appropriately.
129|Record authorised vendor payment and allocation.|Partial payment leaves the correct transaction-currency liability.
130|Maintain vendor product expense/tax treatment.|A stocked product uses its declared receipt/valuation policy.
131|Maintain vendor payable terms and approved instructions.|Changing bank instructions requires separate authority and audit.
132|Post balanced journal entries within open periods.|An unbalanced entry or locked-period posting is rejected.
133|Inspect journal items with source and analytic dimensions.|A project cost drill-down reaches balanced accounting evidence.
134|Preserve financial audit history and reversal links.|Posted history cannot be silently edited or deleted.
135|Analyse invoices by period/status/tax basis.|Draft documents are excluded from posted totals explicitly.
136|Analyse cash with approved classification and settlement basis.|Forecast receipts never enter actual-cash totals.
137|Reconcile analytic/project allocations to ledger amounts.|Allocated plus unallocated equals the source journal line.
138|Configure company finance/localisation/lock policies.|Changing a fiscal setting records effective date and authority.
139|Configure online payment providers without conflating setup/payment.|A provider callback is authenticated and idempotent before marking settlement.
140|Maintain chart of accounts and control-account restrictions.|An inactive account cannot be used on new entries but remains in history.
141|Maintain tax codes, rates, rounding and reporting rules.|A dated tax change preserves earlier posted calculations.
142|Maintain company journals, sequences and posting controls.|Two companies never share an unintended legal numbering sequence.
143|Maintain supported currencies, precision and dated rates.|A missing rate blocks financial posting instead of defaulting to one.
144|Map fiscal positions and tax/account exceptions.|The chosen mapping is retained on the issued transaction.
145|Preserve multi-ledger purpose and reconcile permitted differences.|Parallel books reconcile through an explicit adjustment bridge.
146|Calculate instalments and due dates from payment terms.|A 30/60-day split produces separate aging amounts and dates.
147|Maintain finance product category account defaults.|Reclassifying a category affects future entries with traceable approval.
148|Manage location-specific snags, rectification and acceptance/reopen.|A snag reopened after failed verification retains its earlier evidence.
149|Manage NCR/HSE containment, remedy, evidence and verification.|A remedy cannot close a case without required verification evidence.
150|Control document identity/revisions, issue purpose and supersession.|Approved revision A remains historical after B becomes current.
151|Manage document reviewers, cycles, due dates and turnaround.|A returned drawing review restarts the appropriate cycle with prior history intact.
152|Maintain governed employee lifecycle and effective dates.|An offboarded employee loses future access while historic approvals remain attributable.
153|Provide permission-scoped employee directory.|A general directory user cannot view private HR details.
154|Maintain departments and reporting relationships.|A department move preserves effective-dated employment history.
155|Track certifications, validity and evidence.|An expired crane-operator certificate flags allocation review.
156|Record training attendance and completion evidence.|Scheduled training is not counted as completed without attendance.
157|Report skills/certifications using current validity.|Expired qualifications do not inflate available qualified capacity.
158|Configure company HR policies and privacy.|An HR setting is restricted to its authorised company.
159|Run onboarding/offboarding tasks and required evidence.|Offboarding closes access obligations without deleting employment history.
160|Maintain employment types and applicable policies.|A contractor category does not automatically receive employee leave entitlement.
161|Maintain employee work locations with effective dates.|Moving a worker preserves prior attendance/location context.
162|Maintain departure reasons and restricted visibility.|A sensitive departure reason is excluded from public directory views.
163|Define skills and proficiency levels.|Two different skill scales are not merged into one misleading score.
164|Maintain working schedules, shifts and time zones.|An overnight shift is attributed to the correct working period.
165|Define HR time categories and treatment.|Training time remains distinct from billable site work.
166|Maintain job positions and recruitment ownership.|A vacancy retains its department/company and approval history.
167|Maintain controlled employment contract templates.|A new template never rewrites an executed historical contract.
168|Show personal days off and balances.|An employee sees only their authorised balances and calendar.
169|Submit/withdraw leave requests with workflow history.|An overlapping request is flagged before approval.
170|Show authorised team leave coverage.|Leave visibility protects private reasons while showing staffing availability.
171|Approve/return leave with delegated authority.|A reviewer cannot approve their own request where independence applies.
172|Allocate entitlement with effective dates and authority.|A retroactive allocation adjustment preserves prior balance calculation.
173|Report leave by employee and period.|Employee totals reconcile to approved leave transactions.
174|Report leave by type and unit.|Hours and days are not summed without declared conversion.
175|Calculate opening/accrued/used/adjusted/closing leave balance.|A corrected leave transaction reconciles the balance bridge.
176|Maintain leave types, units and approval rules.|A type change retains historical entitlement meaning.
177|Version accrual rules, carryover and caps.|A year-end carryover follows the applicable dated plan.
178|Maintain company holidays and calendars.|A Company A holiday does not reduce Company B leave incorrectly.
179|Maintain mandatory attendance/leave dates and exceptions.|An authorised exception records why a blocked day was allowed.
180|Configure leave automation with audit and exception handling.|Rerunning an accrual job cannot grant entitlement twice.
181|Record personal attendance and correction requests.|A missing checkout remains an exception until reviewed.
182|Show attendance exceptions and staffing overview.|Open shifts are not counted as completed workdays.
183|Manage attendance-related employee assignments.|Attendance administration does not grant unrelated HR access.
184|Review/correct attendance events with reasons.|Original check-in/out values remain recoverable in history.
185|Support controlled kiosk check-in identity and device scope.|One worker cannot record another worker's time without authorised procedure.
186|Report attendance and overtime under declared rules.|A late checkout is not automatically approved payable overtime.
187|Reconcile attendance and leave ledger categories.|Approved leave explains absence without fabricating hours worked.
188|Define attendance time categories.|Break/idle/work categories preserve their distinct treatment.
189|Configure attendance policies and devices.|A grace-period change applies from a recorded effective date.
190|Run attendance automation idempotently.|A repeated missing-checkout job creates one exception, not duplicates.
191|Set up employee attendance participation.|A new joiner's schedule and device scope are explicit before capture.
192|Enter/submit personal project timesheets.|Time booked to two projects cannot exceed the authorised total without review.
193|Review/approve permitted timesheets.|Returned time retains submission cycle and reviewer reason.
194|Report time by employee with privacy.|Employee hours reconcile across approved project and non-project work.
195|Report project hours and cost allocation.|Approved timesheet source cost appears once in the project report.
196|Report time by task/WBS/location.|Reassigning a task does not rewrite posted historical time allocation.
197|Separate billable/nonbillable time and billing rules.|Training is not invoiced merely because it belongs to a project.
198|Compare timesheet and attendance coverage.|Eight attended hours and six booked hours show a two-hour difference.
199|Configure timesheet units, approvals, rates and locks.|A closed-period timesheet correction uses a controlled adjustment.
200|Show equipment availability, maintenance and exceptions.|An out-of-service crane is not shown as available for allocation.
201|Manage corrective/preventive maintenance work orders.|A completed repair records parts, labour, downtime and verification.
202|Maintain equipment identity, serial, warranty and history.|A transfer changes custody while retaining one asset identity.
203|Analyse maintenance cost/reliability/downtime.|Downtime ratios use a declared operating-time denominator.
204|Configure asset/maintenance policies.|A preventive interval change preserves past work-order schedules.
205|Maintain maintenance teams and escalation ownership.|An overdue safety repair has a named accountable team.
206|Maintain equipment categories and required inspection fields.|A lifting-equipment category requires its applicable inspection evidence.
207|Maintain fleet vehicles and availability.|A disposed vehicle remains in historical cost reports but is unavailable for booking.
208|Maintain fleet lease/insurance/service contracts and expiry.|An upcoming insurance expiry produces a traceable renewal action.
209|Record vehicle services, parts and downtime.|Service cost links to the correct vehicle and company.
210|Record odometer readings with date and validation.|A lower reading is rejected or explained as meter replacement.
211|Report vehicle costs by period/category.|Fuel, lease and service totals reconcile to their source records.
212|Report mileage and utilisation from validated readings.|Duplicate readings do not inflate travelled distance.
213|Configure fleet policies and defaults.|Company-specific vehicle rules remain scoped.
214|Maintain vehicle manufacturers.|Renaming a manufacturer does not duplicate vehicle identity.
215|Maintain vehicle models and specifications.|A model update preserves historical vehicle acquisition data.
216|Maintain fleet model categories.|A category change is traceable across applicable reporting periods.
217|Define fleet contract types and obligations.|A lease and an insurance contract have distinct expiry/renewal evidence.
218|Define service types and evidence requirements.|A safety inspection cannot be recorded as routine cleaning.
219|Maintain vehicle statuses and allowed transitions.|A vehicle under repair cannot be marked rentable without release authority.
220|Maintain vehicle tags and filters.|A tag rename preserves existing assignments.
221|Configure fleet activity/reminder types.|An insurance reminder links the expiring contract and responsible person.
222|Maintain canonical parties, addresses and contact roles.|The same supplier/customer has one identity with company-specific terms.
223|Maintain contact tags and segmentation.|Removing a tag does not delete the contact or transactions.
224|Maintain industry classifications.|Industry reporting uses stable IDs across renamed labels.
225|Maintain country references and localisation links.|Country choice does not by itself decide transaction currency.
226|Maintain state/province references and country relationships.|A state cannot belong to an incompatible country silently.
227|Maintain city/address reference data.|A city rename preserves historical issued-document addresses.
228|Maintain country groups used in rules.|A group edit does not retroactively change posted tax treatment.
229|Discuss work in permission-scoped threads linked to records.|A note on an NCR remains with the case and authorised participants.
230|Manage channels, membership and visibility.|Leaving a restricted channel removes access to future and protected history as policy defines.
231|Preserve call metadata and retention where used.|Call history retains owner/time/context without inventing a recording.
232|Configure discussion/retention policies.|A retention change is auditable and does not silently erase required records.
233|Maintain channel categories and discovery.|A private category does not leak channel names to unauthorised users.
234|Maintain reviewed canned responses.|Editing a template does not rewrite previously sent messages.
235|Maintain communication roles and moderation authority.|A channel moderator does not gain financial approval authority.
236|Manage notification preferences without losing mandatory tasks.|Muting a channel does not remove an outstanding approval from My Work.
237|Configure voice/video integrations and privacy settings.|A disabled integration leaves historic call metadata accessible under policy.
238|Provide one personal task queue across source workflows.|The same source approval is not duplicated by project and company views.
239|Provision users with explicit company/project/role access.|A new site engineer starts with only assigned projects.
240|Manage user lifecycle and effective access changes.|Deactivating a user preserves their historic authorship and decisions.
241|Maintain versioned access presets with least required scope.|Changing a preset produces a reviewable access delta.
242|Preserve necessary advanced account/security settings in original implementation.|A custom permission maps to a named Builder control, not an Odoo dependency.
243|Manage work calendars, appointments and record links.|An inspection appointment retains project/location and attendees.
244|Configure calendar defaults, sharing and privacy.|A private HR event is not exposed through the project calendar.
245|Maintain calendars and availability rules.|A project uses its explicit working calendar for due-date calculations.
246|Maintain calendar work locations.|A site move preserves earlier event location snapshots.
247|Configure reminder rules and delivery logs.|A retried reminder job does not send duplicate notices.
248|Maintain calendar tags and filtering.|Tag renaming retains event associations.
249|Maintain cost-code hierarchy and financial mappings.|An inactive code remains visible on historical cost facts.
250|Maintain structured building/floor/zone hierarchy.|Renaming Floor 12 preserves all linked BOQ, costs and snags.
251|Maintain disciplines and role/report routing.|MEP records remain filterable across drawings, costs and changes.
252|Record business changes, actors, versions and source links.|A rejected unauthorised action is distinguishable from a completed change.
253|Version project thresholds and exception ownership.|A new overrun threshold changes current alerts without falsifying historic reports.
254|Track implementation workbook imports, validation and signoff.|A failed row is quarantined with correction instructions and source reference.
255|Import CRM data with deduplication and reconciliation.|Rerunning the same file does not create duplicate leads/customers.
256|Maintain site resource identities, availability and mappings.|One external worker ID maps consistently to the authorised resource.
257|Maintain P6/Jisr mappings with effective dates and validation.|An unmapped source code is held for review rather than assigned arbitrarily.
258|Review integration batches, errors, retries and acceptance.|A duplicate batch is detected and produces no duplicate cost posting.
259|Track release readiness evidence, owners and blockers.|A failed restore test blocks readiness even if UI checks pass.
260|Preserve governed custom fields/forms with schema/version validation.|A new required field has a migration/default plan for existing records.
261|Preserve governed report definitions with sources and findings rules.|A custom report applies the same row permissions as its source data.
262|Preserve controlled event rules, dry runs and execution history.|An automation retry is idempotent and cannot bypass approval.
263|Preserve configurable screens without bypassing business services.|Hiding a field never removes server validation or authority checks.
264|Configure AI providers, policies, permissions and evaluations.|A malicious uploaded instruction cannot trigger posting or reveal another company.
265|Maintain global/application settings with scoped audit.|A setting change states which companies/projects it affects.
266|Manage account identities and access under one canonical user model.|The administration and access menus resolve to the same user lifecycle.
267|Maintain legal entities, currency and accounting/security boundaries.|Company-specific sequences, permissions and terms remain isolated.
'''
