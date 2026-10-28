begin('Your 12 areas: existence and need', 'Expanded scope map 1 of 2. Follow-up inspection: administrator, JAKH Demo Contracting LLC, AED, 28 October 2026.')
p('<b>All twelve belong in the construction ERP scope.</b> The depth varies, but none should disappear merely to shorten the menu. Place them inside coherent project workspaces and shared services. A visible record proves that capability exists at that level; it does not prove a complete or reliable end-to-end process.')
table(['Area / detail page','Current evidence and status','Need in the new ERP'],[
 ('1. NCR operations<br/>Page 25','PARTIAL: populated Non-conformance records, resolution, verifier and timestamps. E56-E59.','Essential from mobilisation: contain defective work, resolve the cause, verify the remedy, and trace rework consequences.'),
 ('2. Asset management<br/>Page 26','PARTIAL: 20 equipment records; crane serial/cost, maintenance links and reliability metrics. E61-E64.','Essential: know what is available, where it is, who has it, whether it is fit for use, and what it costs. Separate owned/hired plant and client handover assets.'),
 ('3. Payments & cash flow<br/>Page 27','PARTIAL / BLOCKED REPORT: posted receipts and bills exist. Company cash report requires a policy; visible policy and cash-forecast lists are empty. E70, E73-E76, E91-E92.','Essential: expected versus actual money, approved obligations, collections, payment scheduling, advances, retention and liquidity.'),
 ('4. Subcontracting<br/>Page 28','SUBSTANTIAL PARTIAL CHAIN: service-entry/certificate/bill links, finance agreement, retention terms and balances. E29, E70-E72.','Essential: manage each package from selection and award through measured work, changes, payment and final settlement.'),
 ('5. Item cost breakdown<br/>Pages 29-31','PARTIAL: BOQ/location report, source facts, WBS budgets and approved cost-to-complete forecasts. Samples remain coarse. E66-E69, E87-E90.','Essential: one explainable item ledger with budget, quantities, resources, incurred cost, commitments, payments and completion forecast.'),
 ('6. Waste management<br/>Page 32','LIMITED: empty scrap register and unsaved stock-scrap form. Full site waste chain not demonstrated. E77-E78.','Essential: material loss and environmental disposal/reuse records; costs and quantities linked to the work that caused them.'),
],[CW*.24,CW*.39,CW*.37])
p('<b>Status key:</b> PARTIAL = useful records or controls observed, with workflow depth unverified. LIMITED = narrow or unpopulated evidence. BLOCKED REPORT = a specific report could not produce results under the inspected setup. None means proven absent throughout the system.','small')

begin('Your 12 areas: controls and visibility', 'Expanded scope map 2 of 2. Proposed requirements below are design inputs, not claims about existing functionality.')
table(['Area / detail page','Current evidence and status','Need in the new ERP'],[
 ('7. Variations / change requests<br/>Page 33','PARTIAL: 17 variation records; owner/subcontract distinction, pricing, approval and certification states. E85-E86.','Essential: capture an early change event, assess scope/cost/time, obtain authority, and carry the outcome into budgets, orders and programme.'),
 ('8. Programme & delay<br/>Page 34','PARTIAL: accepted progress facts; screen explicitly makes P6 the schedule master. Delay/EOT chain not demonstrated. E79-E80.','Essential: baseline/current plan, look-ahead, constraints, delay events, mitigation and time-impact evidence.'),
 ('9. KPI management<br/>Page 35','PARTIAL: CPI/SPI, project financial/progress metrics, exception activities, turnaround data and generic dashboards. E53-E54, E66, E82-E84.','Essential: definitions, owners, targets, trends, data freshness and corrective actions; a chart alone is insufficient.'),
 ('10. Keeping records<br/>Page 36','PARTIAL: revisions, attachments, diaries, lifecycle rows and source links. E37-E45, E57-E59, E82.','Foundation: authoritative evidence, controlled revisions, search, distribution, retention and export throughout the project.'),
 ('11. Approval workflow<br/>Page 37','PARTIAL: staged certificate review, named forecast approver, quality verifier, document review and activity queues. E15, E54, E59, E71, E82, E90.','Foundation: consistent, policy-based routing with next owner/due date, rejection/resubmission, delegation and version-aware decisions.'),
 ('12. Tracking / transparency<br/>Page 38','PARTIAL: project facts link to source records; dates, provenance and some approver fields exist. E69-E72, E81-E82, E90-E92.','Foundation: show where work stands, why it is blocked, who acts next, and how every total was derived, within access rights.'),
],[CW*.24,CW*.39,CW*.37])
heading('How these fit together')
p('The common spine is company -> project -> building/floor/zone -> work item/package, with linked programme activity, resource, party and evidence. Records, approvals and tracking serve every workflow. Quality, cost and schedule consequences must travel with the originating event.')
p('Example: failed inspection -> NCR -> authorised repair -> labour/material/plant use and waste -> reinspection -> accepted progress. If scope or time changes, link the change/delay assessment. Do not assume every NCR automatically creates a billable variation.','small')

begin('1. NCR operations', 'Existence: confirmed at record level; completeness: partial. Route: Quality, HSE & Specifications -> Quality & HSE Actions. E56-E59.')
shot('59-ncr-lifecycle.png','E59. A closed honeycombing NCR has project/WBS, responsibility, severity, lifecycle dates and a named verifier. Resolution is a separate free-text section.',220)
heading('What exists; what remains uncertain')
p('The register mixes inspections, non-conformances and risk assessments. The sampled NCR has one attachment and a generic correction statement. Its responsible person and verifier are the same in this sample. Structured requirement breach, root-cause analysis, distinct corrective-action tasks, effectiveness review and linked rework costs were not visible; independence rules were not exercised.')
heading('Needed workflow and simple UI')
p('<b>Essential.</b> QA/QC raises the issue against an inspection, specification and exact location; the site team contains it; the responsible contractor proposes a disposition; required technical/client reviewers authorise it; the team implements and supplies evidence; QA/QC verifies and closes or reopens. Record cause, prevention, owners, deadlines and cost/time impacts. Keep it in Project -> Site -> Quality & NCRs, with one case timeline and the action required now.')
p('<b>Test:</b> trace one rejected concrete item through repair, reinspection and linked costs; show why it may be closed. Where policy requires independent verification, prove the resolver cannot provide that approval.','small')
p('<b>Reference reviewed:</b> the public <link href="https://pauligle.gumroad.com/l/ncr-management-kit" color="#28675F">QIC NCR toolkit description</link> covers a form, procedure, register and dashboard, including cause analysis, corrective action and effectiveness checks. Paid files were not acquired or inspected. This is a process reference, not certification evidence or a copied template.','small')

begin('2. Asset management', 'Existence: equipment and maintenance confirmed; a complete asset lifecycle is not demonstrated. E61-E64.')
shot('62-equipment-record.png','E62. Tower crane TC-01 has a maintenance team and 14 linked maintenance records. The project deployment is in description text; Used in location is blank.',220)
heading('Preserve, then connect')
p('Twenty equipment records are visible. The crane has a serial number, cost, vendor/model/warranty fields and reliability measures. Fleet also has navigation entries. These do not establish fixed-asset accounting, hire control, transfer history, inspection/calibration validity, fuel/use reconciliation or client asset handover.')
heading('Needed workflow and simple UI')
p('<b>Essential, with three related tracks.</b> Owned plant/tools: acquire -> identify/tag -> assign/transfer -> use -> maintain -> dispose. Hired plant: hire terms -> on-hire -> utilisation/downtime -> off-hire -> invoice check. Installed client assets: install -> test/commission -> warranty/O&M -> handover. Link rather than duplicate asset identities across operations and finance.')
p('The plant manager owns availability and service dates; site custodians own location/use; finance owns valuation and depreciation policy. Link hours, fuel, repairs, hire, depreciation or approved internal charges to the appropriate project/work item. Keep Company -> Assets & Fleet as the shared register, and show assigned assets in each project.')
p('<b>Test:</b> transfer a crane between projects, stop scheduling it while out of service, reconcile its utilisation/cost, and find its inspection evidence. Separately retrieve one installed pump\'s commissioning and warranty pack.','small')

begin('3. Payments & cash flow', 'Existence: payment evidence confirmed; forecast depth unverified; company cash report blocked by its policy prerequisite. E70, E73-E76, E91-E92.')
shot('74-cash-flow-results.png','E74. Company cash generation requires an approved classification policy. E75 shows an empty visible policy register; E76 shows no project cash-forecast records.',220)
heading('What the evidence supports')
p('The building report links to eight posted payment sources totalling AED 15,675,795.22. One source has balanced bank/receivable journal lines and an invoice reference. The report explicitly does not assert bank clearance. A subcontract bill shows AED 257,484 gross work, AED 25,748.40 retention and AED 231,735.60 due. Certification, invoicing, due balances and cash are different facts.')
heading('Needed workflow and simple UI')
p('<b>Essential.</b> Finance and QS maintain expected receipts and outflows from payment terms, certificates, invoices, payroll, orders, taxes, advances and retention. Use a rolling weekly view for near-term liquidity and monthly project-to-completion outlook, with base/late-payment scenarios. Reconcile actual bank movements, forecast dates and invoice allocations; explain unmatched or overdue items.')
p('Show project cash in Project -> Costs & Contracts, and the same records in Finance for company-wide scheduling and reconciliation. Display planned, approved, due, paid/received and bank-reconciled states separately. Include approval and bank authority checks; report access must not imply payment authority.')
p('<b>Test:</b> follow partial settlement, advance recovery, retention release and a late receipt through both project and company views. Validate the cash-policy setup before relying on the company report. No payments were initiated in this study.','small')

begin('4. Subcontracting management', 'Existence: a substantial measurement-to-bill chain is visible. Award, exceptions and settlement remain to be validated. E29, E70-E72.')
shot('71-supplier-certificate.png','E71. The supplier certificate connects service entry, PO, project/WBS, finance agreement, approver, retention and bill.',220)
heading('Current strengths and gaps')
p('The linked agreement holds retention percentage/cap, advance/recovery terms, balances and eight certificates. The bill links back to the service entry, PO and supplier certificate. Separate application, amendment and correction menus exist. Tender comparison, scope boundaries, securities, insurance expiry, disputed measurements, backcharges and final settlement were not walked end to end.')
heading('Needed workflow and simple UI')
p('<b>Essential.</b> Procurement/QS prequalify and compare bids -> approve package scope and award -> record mobilisation obligations -> receive the subcontractor\'s application -> measure/inspect accepted work -> assess deductions and changes -> approve certificate -> match bill -> pay -> settle and release retention against agreed conditions.')
p('Use one package workspace: scope/BOQ, commitments, progress, changes, quality obligations and money. Keep claimed, assessed, certified, invoiced and paid amounts distinct. Link NCRs, rectification, securities and handover readiness. Company -> Buying provides cross-project queues; project and portal views reference the same authorised records.')
p('<b>Test:</b> certify only accepted quantities from a partly rejected application, amend scope, apply an evidenced deduction, then reconcile the package account without counting both the service receipt and bill as separate incurred cost.','small')

begin('5. Cost analysis for each site item', 'Existence: BOQ/location cost reporting and source lineage are confirmed. Required tower/resource granularity is not yet demonstrated. E66-E69, E87-E90.')
shot('67-building-cost-detail.png','E67. The report distinguishes original/revised budgets, commitments and posted cost, with BOQ/building/location fields and explicit unallocated rows.',220)
heading('A useful foundation with a granularity gap')
p('The sampled building uses four broad WBS/BOQ groups, generally allocated to Main site. This does not demonstrate the cost of a particular floor slab, door type or installation activity. Source facts distinguish commitments, received exposure, posted cost and revenue/billing. Approved forecasts include actual-cost snapshots and remaining costs; report rules avoid silently dividing WBS forecasts among buildings.')
p('One WBS form shows Forecast Amount = 0 while its dated approved forecast is AED 8,428,000 (E88-E90). The report says it uses the approved forecast. The UI should identify that authoritative value and explain the other field; the difference is not proof the report calculation is wrong.')
heading('Required grain and ownership')
p('<b>Essential.</b> QS/cost control defines work items and cost codes; planning supplies quantities and dates; site/stores supply consumption and progress; procurement supplies commitments; finance supplies postings/payments. Analyse by company, project, location, work item/WBS, resource type and period. Map client BOQ lines to internal work items with explicit, versioned allocations; they are not necessarily one-to-one.')
p('<b>Simple UI:</b> select an item and location once, then see Budget / Incurred / Paid / Forecast with expandable resource and source detail. Never label all four as Actual. Pages 30-31 define the measures and a reconciliation example.','small')

begin('Cost dictionary: compare like with like', 'Proposed definitions for agreement with cost control and finance. These are requirements, not a claim that every measure is implemented.')
table(['Measure','Meaning and control'],[
 ('Original budget','Frozen approved cost plan: quantities x resource rates, plus explicitly allocated indirect cost and risk. Keep the original version.'),
 ('Revised budget','Original budget plus approved budget changes/transfers. An owner selling-price variation must not automatically become an equal cost-budget change.'),
 ('Plan to date / earned value','Planned value is budgeted work scheduled by the status date. Earned value is budgeted value of accepted work completed. Both must use the same approved baseline and measurement rules.'),
 ('Commitments','Approved purchase/subcontract obligations, including controlled amendments. Show total and remaining uninvoiced/unperformed exposure separately; total commitments are not extra cost to add to actuals.'),
 ('Incurred actual cost','Posted cost plus approved period-end accruals, net of corrections and credits, counted once. Stock receipt, issue, installation and invoice may represent different stages, not four costs.'),
 ('Cash spent / received','Allocated payment or receipt amounts and dates. Separate advances, taxes and retention; show reconciliation status. Cash spent may precede or follow the related incurred cost.'),
 ('Cost to complete','Reviewed remaining committed work + remaining uncommitted work + explicit risk allowance. Identify assumptions, rates, productivity, owner and update date.'),
 ('Forecast final cost / EAC','Incurred cost + cost to complete. Show variance to revised budget; a favourable forecast is not realised profit. Keep prior approved forecasts.'),
 ('Revenue / margin','Separate contract value, approved/pending changes, claimed, certified, invoiced and collected amounts. Compare compatible revenue/cost forecasts for margin; cash balance is a separate measure.'),
],[CW*.27,CW*.73])
heading('Every number needs a basis')
p('Display cutoff date, company/currency, tax basis, unit of measure, baseline/revision, allocation status and data freshness. For each cost type expose budget quantity/rate, actual quantity/rate, productivity, waste and the source documents. Use material, labour, plant, subcontract and indirect-cost categories.')
p('Never hide missing allocations, stale forecasts or unreconciled differences. Shared costs require an approved allocation basis and version history. Accruals must reverse or clear when the underlying bill arrives. A business owner must approve the precise posting and valuation rules.','small')

begin('One item, four different answers', 'Illustrative acceptance fixture only - invented figures, not extracted from JAKH. Example: one floor slab work item, one cutoff date, AED, tax excluded.')
table(['Question','Example answer / explanation'],[
 ('What was planned?','Original budget 100,000; approved cost-budget change +10,000; revised budget <b>110,000</b>.'),
 ('What has it cost so far?','Posted cost 52,000 + approved unbilled accrual 8,000 = incurred cost <b>60,000</b>.'),
 ('What is committed?','Approved package/order obligations total 80,000. Of these, 40,000 is already included in incurred cost; 40,000 remains. Other incurred labour/plant costs are 20,000.'),
 ('What cash has left?','Payments <b>45,000</b>: 35,000 settling bills plus 10,000 advance. This does not turn incurred cost into 45,000 or 105,000.'),
 ('What will remaining work cost?','Remaining committed work 40,000 + other remaining work 5,000 + risk 3,000 = cost to complete <b>48,000</b>. Future cash timing also reflects unpaid incurred costs and advance recovery.'),
 ('Where will it finish?','Incurred 60,000 + remaining 48,000 = forecast final cost <b>108,000</b>. Revised budget 110,000 - forecast 108,000 = forecast headroom <b>2,000</b>.'),
],[CW*.31,CW*.69])
heading('Break the same item into resources')
p('Expand the slab into concrete, reinforcement, formwork, labour, plant and allocated site overhead. Each has planned quantity/rate, actual consumed quantity, accepted installed quantity, loss/rework, incurred cost and remaining forecast. Use a common location and cutoff; aggregate the detail back to the item, floor and project.')
heading('Required reconciliation tests')
p('1. Every item total equals its contributing facts, with no source counted twice.<br/>2. Cost posted without an item remains visibly unallocated until an authorised allocation.<br/>3. A later bill replaces/clears the accrual rather than adding a duplicate cost.<br/>4. Paid amounts trace to invoice/advance allocations and bank reconciliation.<br/>5. Changes preserve the original budget and prior approved forecasts.')
p('For quantity control, reconcile opening usable stock + receipts/transfers in against installed or otherwise consumed quantity, returns/transfers out, closing usable stock and recorded loss. Define measurement units and avoid counting waste again if it is already included in a consumption category.','small')

begin('6. Waste management', 'Existence: a stock-scrap function is visible; full construction waste control is not demonstrated. E77-E78.')
shot('78-scrap-form.png','E78. Unsaved scrap form: product, quantity/unit, reason, company and replenishment. It was discarded without entry or confirmation.',220)
heading('Two needs must be covered')
p('<b>Material efficiency:</b> distinguish allowed waste, avoidable loss, damage, theft, rejected work, recoverable offcuts and rework. Link issued/returned/installed quantities to the item, location and responsible trade. An inventory adjustment alone does not explain what happened on site.')
p('<b>Site waste handling:</b> classify waste, segregate/store it, arrange collection, record weight/volume, carrier and destination, then attach acceptance/weighbridge/disposal evidence. Track reuse, recycling, recovery proceeds and disposal cost. Confirm jurisdiction and contract requirements before specifying controlled waste paperwork.')
heading('Needed workflow and simple UI')
p('Site/store staff record waste against work or an NCR; the site/environmental owner selects the handling route; an authorised person approves the write-off or disposal; receipt/evidence closes the movement; cost control allocates the impact. One Project -> Site -> Waste register should connect physical movements and cost, with stock transactions remaining controlled linked records.')
p('<b>Test:</b> reconcile reinforcement received, used, returned, reusable offcuts and lost/scrapped quantity for one floor; follow one disposal load to acceptance evidence and its cost. Define waste-rate denominators by material and units; do not combine tonnes and cubic metres in one total.','small')

begin('7. Variations and change requests', 'Existence: commercial variation records confirmed; the upstream change-event and time-impact chain remains partial. E85-E86.')
shot('86-variation-detail.png','E86. A priced owner variation links project, WBS and contract. The instruction is mentioned in free text; structured notice/time-impact fields are not visible.',220)
heading('What exists')
p('The register includes Draft/Submitted/Priced/Approved/Fully certified and Rejected stages. The UI explains that an approved owner variation feeds certification, while a subcontract variation does not itself create a commitment or invoice. Preserve that distinction. Internal design changes, early warnings and potential changes were not demonstrated as a separate connected intake.')
heading('Needed workflow and simple UI')
p('<b>Essential.</b> Capture a change event from a client instruction, RFI, revised drawing or site condition. Identify affected scope/location, initiator, responsibility and contract references. Track notice requirements, cost/time assessment, quotations, review, decision and implementation. Keep potential, instructed, submitted, approved, disputed, rejected and withdrawn outcomes understandable.')
p('QS/PM own assessment; planning owns time effects; the designated internal/client authority owns decisions. Link approved outcomes to budget revision, contract/BOQ, subcontract/PO amendment, programme revision, forecasts and certificates. Internal approval and client acceptance are separate decisions. Configure notice dates from the actual contract; do not hard-code a universal deadline.')
p('<b>Test:</b> an urgent instructed change can proceed under recorded authority while its price is disputed; costs, notice dates and programme effects remain visible. Use one Changes workspace with an evidence timeline, not repeated data entry in each downstream record.','small')

begin('8. Programme & delay', 'Existence: progress ingestion and acceptance confirmed; full planning and delay management not demonstrated. E79-E80.')
shot('80-schedule-record.png','E80. The screen says P6 is the schedule master. This accepted manual update has PV/EV and progress; forecast finish and location are blank. No activity-level link is visible.',220)
heading('Separate progress reporting from controlling time')
p('A percentage or SPI does not explain the critical activity, lost days or recovery plan. The inspected record is a dated WBS progress fact. It does not demonstrate dependencies, calendars, baseline comparison, critical path, float, resource loading, look-ahead constraints or an EOT assessment.')
heading('Needed workflow and simple UI')
p('<b>Essential.</b> Planner owns an approved baseline and dated updates. Site teams report actual starts/finishes and remaining work, linked to accepted evidence. Surface a near-term look-ahead with prerequisites such as design release, access, materials, inspections, labour and plant. Record delay events with discovery/date range, affected activities, cause, evidence, responsibility, mitigation and review status.')
p('Connect delay assessments to notices, change events, the programme version analysed, forecast finish and any time/cost claim. Keep requested, assessed and granted extension distinct. A planner/contract administrator must validate analysis and contractual interpretation; a metric alone must not decide entitlement.')
p('<b>Architecture decision:</b> retain a clearly defined P6 exchange or build original scheduling capability, according to operational need. Either requires one authoritative programme and traceable versions. <b>Test:</b> a late approved drawing blocks a floor activity; show the dependency, mitigation, notice and updated finish without overwriting the baseline.','small')

begin('9. KPI management', 'Existence: metrics and dashboards confirmed; a complete KPI definition/ownership/action cycle is unverified. E53-E54, E66, E82-E84.')
p('Construction dashboards already expose CPI/SPI and financial/physical progress. Saved Project dashboards emphasise tasks, logged hours and task closure, while document turnaround has reviewer/due-date data. These are useful components, but a KPI needs an agreed meaning and accountable response.')
table(['Recommended starting KPI','Definition / owner / response'],[
 ('Cost performance','CPI = earned value / compatible incurred actual cost, where cost > 0. Cost controller investigates adverse cost/productivity drivers; show excluded/unallocated costs.'),
 ('Schedule performance','SPI = earned value / planned value, where plan > 0; planner also tracks milestone slippage and critical constraints. SPI is not a count of delay days.'),
 ('Completion forecast','Revised budget minus forecast final cost, plus forecast coverage/freshness. QS owns the cost-to-complete review and corrective action.'),
 ('Quality','Open/overdue NCR count, closure duration, recurrence and rework cost. QA/QC owns review; normalise comparisons by work/inspection volume where appropriate.'),
 ('Buying / subcontract','Required-on-site delivery reliability and overdue package actions. Procurement/PM owns expediting and recovery.'),
 ('Cash / commercial','Overdue receivables/payables, certified-but-unbilled value and forecast cash shortfall. Finance/QS own collections, billing and payment planning.'),
 ('Resources / waste','Productive asset hours / available planned hours; material waste / defined input quantity. Plant/site owners investigate downtime and loss.'),
 ('Approvals / records','Overdue reviews and turnaround by document type/owner; current approved document coverage. Document control and workflow owners resolve bottlenecks.'),
],[CW*.27,CW*.73])
heading('One metric definition, several contextual views')
p('Store formula/version, unit, population, exclusions, period, baseline, target, threshold, owner, refresh time and source link. Support trend and explanation, then assign an action with due date. Start each role with a few actionable measures; let users expand the supporting detail.')
p('<b>Test:</b> a dashboard total reconciles to its records under the same filters; zero, missing and not-applicable values differ. Crossing a threshold creates one owned action and stops duplicate reminders. Targets need business agreement; this study does not invent performance benchmarks.','small')

begin('10. Keeping records', 'Existence: document revisions, attachments, site diaries and review records confirmed; retention and distribution controls remain unverified. E37-E45, E57-E59, E82.')
shot('82-review-turnaround.png','E82. Review records expose document/revision, project, reviewer, due date, completion and status; age/cycle measures are available in the wider table.',220)
heading('The record must explain what was known then')
p('Preserve a document ID and revision, issue purpose, creator/source, project/location/package, timestamps, review decision and linked work. The current approved drawing should be clear alongside history. Approval and issue-for-construction are separate meanings and must be labelled consistently; the register exposes both fields.')
heading('Needed workflow and simple UI')
p('<b>Foundation across all modules.</b> Capture -> classify -> review/revise -> approve -> issue/distribute -> acknowledge where required -> supersede/archive. Link correspondence, photos, inspections/tests, daily reports, instructions, notices, measurements, meetings, commercial evidence and handover packs. A chatter attachment is not by itself a controlled document register.')
p('Document control owns numbering/revision/distribution; originating teams own content; project/finance owners set retention and access rules. Search by project, floor, work item, party, date and record type. Define offline photo capture/sync, permissions, version conflicts, backups, export and retention/hold behaviour in engineering validation.')
p('<b>Test:</b> reconstruct which approved revision and instruction supported a particular pour/certificate on a historical date, retrieve its evidence, and export an indexed package without losing relationships. Show relevant records inside each workflow; keep one authoritative copy.','small')

begin('11. Approval workflow', 'Existence: several document-specific routes and approver histories are visible; universal queue coverage and enforcement remain untested. E15, E54, E59, E71, E82, E90.')
p('<b>Foundation.</b> Use one approval service and personal queue, with distinct policies for each business object. The table below proposes ownership for validation; it is not a statement of the current permission configuration.')
table(['Object / trigger','Proposed responsibility and decision boundary'],[
 ('Tender / budget / forecast','Estimator or QS prepares; PM/commercial authority reviews; delegated authority approves within value/risk limits. Preserve priced and approved versions.'),
 ('Purchase / subcontract award','Requester -> technical/budget check -> procurement/commercial -> authorised award. Receiving and paying require separate checks.'),
 ('Inspection / NCR / snag','Site/contractor submits -> QA/QC/technical review -> required consultant/client sign-off -> verified closure. Configure independence and hold-point rules.'),
 ('Change / time assessment','Originator -> QS and planner assessment -> PM/internal authority -> client/consultant decision where needed. Keep commercial and time decisions traceable.'),
 ('Measurement / certificate','Site validates quantity -> QS assesses -> commercial/finance checks -> authorised certificate. Supplier claim, certificate, bill and payment remain distinct.'),
 ('Bill / payment / release','Match supporting obligation and evidence -> finance review -> authorised payment/release -> bank reconciliation. No dashboard permission grants bank authority.'),
 ('Document / handover','Author -> discipline reviewers -> approval -> authorised release. Handover also checks technical, client acceptance and commercial obligations.'),
],[CW*.29,CW*.71])
heading('Controls and UI that every route shares')
p('Show current step, assigned person/role, due date, blockers and decision history on the record and in My Work. Support sequential/parallel review, amount/risk limits, substitutes, absence delegation, escalation, rejection reasons and resubmission. A material edit must invalidate or reroute the affected approval version.')
p('Record policy version, actor, authority, timestamp, comments and document snapshot. Enforce permissions on the server and prevent duplicate/concurrent decisions. Distinguish an operational activity marked Done from a formal business approval.','small')
p('<b>Test:</b> absence delegation, out-of-limit approval, prohibited self-approval, changed documents and simultaneous clicks all produce correct, explainable outcomes. Queue counts reconcile to pending business records. Read-only inspection did not execute these tests.','small')

begin('12. Tracking and transparency', 'Existence: source drill-through and provenance confirmed; complete event history and permission boundaries require validation. E69-E72, E81-E82, E90-E92.')
shot('69-cost-source-facts.png','E69. Contributing facts show dates, classifications, project/WBS, amounts, provenance and Open source links. One was followed to a supplier bill and certificate.',220)
heading('Keep the good traceability, make it easier to read')
p('The project-control audit lists financial/control facts, including their provenance. This is useful evidence lineage; it is not proof of an immutable who-changed-what audit log. Approver/date fields and chatter support some history, but universal old/new values, deletions, permission changes and restoration were not tested.')
heading('Needed behaviour and simple UI')
p('<b>Foundation.</b> Every record answers: what is this, which work does it affect, what changed, who owns the next step, when is it due, and why is it blocked? Use a consistent timeline for submission, revision, decision, execution, posting and settlement. Link each event to its actor, authority, source version and resulting records.')
p('A project overview should summarise exceptions and next actions; users expand only what needs explanation. Every aggregate drills to the same filtered records and shows refresh/cutoff and missing data. Client/subcontractor views show their permitted scope, with confidential internal prices and personal information controlled by policy.')
p('<b>Test:</b> trace a forecast variance to an item, bill/service entry and originating scope change; reconstruct its approval version. An authorised user can export that chain, and an unauthorised user cannot gain access through a deep link. Records/approvals/tracking share one history service rather than three duplicate modules.','small')
