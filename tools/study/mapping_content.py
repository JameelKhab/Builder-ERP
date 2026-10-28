from mapping_data import MENU_MAP, CAPABILITIES, WALKTHROUGHS

# These twelve pages are the authoritative Revision 3 navigation proposal.
begin('Four clear starting points', 'Recommended information map. This is a study proposal, not a tested interface or a visual design.')
p('<b>Start with a task, a tender, a project, or company work.</b> Keep these four destinations in a small global navigation. After opening a project, use its seven stable areas below. Do not keep the old module tree alongside them.')
table(['Start here','What the user expects to find'],[
 ('My Work','What I need to do, decide, chase or resume. Direct links to my frequent specialist queues and personal requests.'),
 ('Tenders','Opportunities, bid/no-bid, tender documents, estimates, offers, revisions and award. A tender remains traceable after a project is created.'),
 ('Projects','Find a project, then manage its plan, site work, buying, costs, documents and handover in one context.'),
 ('Company','Buying across projects, Finance, People, Assets & Fleet, Stores, Contacts & Catalogue, and Reports. Show these names visibly on the directory.'),
],[CW*.24,CW*.76])
heading('The project map')
table(['Project areas - stable order','Plain-language purpose'],[
 ('Overview  |  Plan  |  Site','Understand the project; plan the work; record and control what happens on site.'),
 ('Buying  |  Costs & Contracts','Obtain materials/subcontract work; explain budgets, obligations, changes, claims and money.'),
 ('Documents  |  Handover','Find controlled information; prove work is ready, accepted and supported after completion.'),
],[CW*.46,CW*.54])
heading('Utilities, not additional business modules')
p('Search, company/project scope, help, profile and authorised Administration access stay consistent. The Company workspace follows the selected legal entity; authorised group views explicitly show their included entities. A project overview opens on current work, risks and next actions.')
p('<b>Why this replaces Revision 2:</b> Buying, Finance and Resources no longer compete with Projects in the primary menu. Company-wide specialists use direct queue shortcuts; project users follow the job without leaving its context. The number four is a proposed grouping, not a usability result.','small')

begin('Seven places inside a project', 'Each area opens a useful work view with clearly named links. No nested accordion tree and no universal row of repeated tabs.')
table(['Area','Visible contents and boundaries'],[
 ('Overview','Next actions, blockers, due milestones and a small role-relevant performance summary. Setup checklist and project facts are secondary links. KPIs link to source records.'),
 ('Plan','Programme; Look-ahead; Constraints & delays; Resources. Baseline/current dates and progress stay connected. Delay events link to commercial/time claims, without copying them.'),
 ('Site','Daily work; Materials; Quality & NCRs; Safety; Waste. Direct actions: Record daily work, Request materials, Receive delivery, Report a quality problem. Show assigned field work first.'),
 ('Buying','Requests; Orders & deliveries; Subcontract packages. Follow selection/award, delivery or measured work through the same order/package. Company Buying is an all-project view.'),
 ('Costs & Contracts','Budget & cost; Client contract; Changes; Claims & payments; Cash flow; Final account. Subcontract amounts link to their Buying package. Finance posting/bank work stays in Company Finance.'),
 ('Documents','Drawings; Submittals; RFIs; Specifications & methods; Correspondence. Current/revision/issue/review states are explicit. Source-case attachments are searchable links, not copied documents.'),
 ('Handover','Snags; Testing & commissioning; Handover packs; Defects & warranties. Organise by location/system/installed asset, with partial handover and client acceptance evidence.'),
],[CW*.25,CW*.75])
heading('Stable structure; relevant content')
p('Keep area names and order stable across lifecycle stages. Stage and role change the recommended work and visible permissions, not the meaning or location of an area. Snagging and handover preparation remain reachable during construction.')
p('A specialist registry can be a dense, filterable table when that helps its user. A site worker gets a focused action and the evidence needed now. Neither requires a second copy of the data. Area sublinks are page content, not another permanently expanded sidebar. Preserve filters and scroll position when returning from a record.','small')

begin('My Work is the daily starting point', 'Role-aware priorities, with consistent navigation and explicit authority. Proposed defaults must be checked with actual staff.')
p('Show <b>Needs my decision</b>, <b>Assigned to me</b>, and <b>Waiting on others</b> as views of one queue. Every row says what to do, project/location, due date, current owner and why it is waiting. Resume drafts and recent work directly; routine notifications must not bury decisions.')
table(['Person','Default work and direct shortcuts'],[
 ('Owner / project manager','Exceptions, milestones, cost/cash outlook and delegated decisions. Project Overview and portfolio reports.'),
 ('Estimator / tender manager','Bid deadlines, estimate review and offer revisions. Tender workspace.'),
 ('Site engineer / supervisor','Today\'s work, drawings, material needs, inspections and blockers. Site plus the look-ahead.'),
 ('QS / cost controller / buyer','Measurements, changes, forecasts, claims and purchasing decisions. Budget & cost or a cross-project Buying queue.'),
 ('QA/QC / document controller','Inspections, NCR actions and document reviews; overdue owners visible. Quality & NCRs or Documents.'),
 ('Finance / people / plant teams','Authorised payment/close work, staff requests, or asset service/availability. Their named Company workspace directly.'),
],[CW*.32,CW*.68])
heading('Company is a visible directory, not a miscellaneous menu')
p('<b>Buying</b> - all-project procurement and subcontract queues.<br/><b>Finance</b> - receivables, payables, cash/bank, ledger, period close and financial reports.<br/><b>People</b> - employment, recruitment, leave, attendance and time.<br/><b>Assets & Fleet</b> - custody, hire, maintenance and vehicles.<br/><b>Stores</b> - warehouses, transfers, counts and stock movements.<br/><b>Contacts & Catalogue</b> - parties, materials/services and shared units.<br/><b>Reports</b> - cross-project comparisons and governed metric/report definitions.')
p('Daily specialists go straight to their queue from My Work. Keep company and All projects / named project scope visible; a cross-company queue labels each record. Roles and entity permissions control access. Company > Reports uses the same definitions as project reports, always with a findings summary.','small')

begin('One case, a clear next step', 'Screen behaviour requirements. The proposal preserves rich information while reducing repeated navigation and data entry.')
table(['Layer','What stays visible or opens on demand'],[
 ('Always visible','Record title/ID; project and relevant package/location; status in words; owner; next action and due date; material blockers; version/cutoff for decisions and totals.'),
 ('Main working content','The information needed for the current task and one primary action, with explicit secondary alternatives such as Return for correction. A reviewer sees evidence before deciding.'),
 ('Named detail sections','Quantities, resources, money, technical evidence or terms as appropriate to the record. Show section names and key warnings; expand detail when useful. No vague More container for essential work.'),
 ('Related records and history','Linked order, certificate, bill, inspection, change or drawing; decision and revision history. Open a related record with context retained and a clear return path.'),
],[CW*.28,CW*.72])
heading('A record evolves; the user does not restart')
p('An NCR stays the same case through containment, remedy, verification and closure. A subcontract package keeps scope, work and money together; its certificates and bills remain separately controlled linked records. Do not copy every tab into each linked screen or flatten legally different transactions into one form.')
p('Prefill known project, item, location and party details. Ask only for facts needed at the current transition. Preserve drafts, validation messages and entered information. New approved versions require explicit revision; historic decisions retain the evidence actually reviewed.')
p('Contextual AI can help find, explain or draft information without becoming another navigation layer. Keep its sources and active company/project visible. Financial arithmetic and approval rules remain controlled logic; AI proposals require the relevant review. See pages 50-52.','small')
heading('Find information without knowing its module')
p('Search by ID, title, party, floor/unit, asset tag and familiar aliases: NCR / non-conformance / quality problem; VO / variation / change; plant / equipment; snag / defect. Results show type, scope, state and current revision, deduplicated by record identity. Always offer a browsable route as well.')
p('Make search scope obvious and offer a deliberate broader search. Respect permissions in results, snippets, exports and links. Distinguish no records, active filters, insufficient access, stale data and a loading/error state. Attachment full-text/OCR coverage must be stated and verified.','small')

begin('Exact homes for all twelve areas', 'All project paths below start inside the selected project unless Company or My Work is specified. These are proposed homes, not live routes.')
table(['Capability','Home','Owner / connected work'], CAPABILITIES, [CW*.22,CW*.30,CW*.48])
p('Records, approval decisions and tracking are present on every relevant case. Their dedicated search or queue views are additional ways to reach the same information, not additional copies or independent workflows.','small')

begin('The construction journey stays connected', 'A project lifecycle is a guide, not a compulsory wizard. Procurement, design, site work, commercial work and handover preparation overlap.')
table(['Stage','Where work starts','Handoff that must be explicit'],[
 ('1. Opportunity / bid decision','Tenders > Opportunity','Client, tender requirements, deadlines, scope, risks and accountable bid decision.'),
 ('2. Estimate / offer','Tender workspace','Take-off/BOQ, resource rates, quotes, exclusions and approved offer revision. Preserve the tender basis.'),
 ('3. Award / mobilisation','Award -> Project setup checklist','Accepted contract and scope; versioned cost baseline; location/work-item structure; programme; authorities and obligations. Direct awards have a supported entry.'),
 ('4. Design / plan / procure','Documents + Plan + Buying','Approved information, material/subcontract readiness and site prerequisites linked to planned work.'),
 ('5. Execute / inspect','Site, from the look-ahead','Daily evidence, quantities/resources, quality/safety, material movements and accepted progress. Failed work generates accountable follow-up.'),
 ('6. Assess / claim / pay','Costs & Contracts; package Money','Measured acceptance -> certificate -> invoice/bill -> payment. Separate commercial values, incurred cost and cash.'),
 ('7. Test / hand over','Handover by floor/unit/system','Tests, snags, as-builts, O&M, training, warranties and acceptance. Partial handover has clear boundaries and outstanding obligations.'),
 ('8. Defects / final settlement','Handover + Final account','Defects and warranty duties; agreed final account; authorised securities/retention release. Technical and commercial closure remain distinct.'),
],[CW*.23,CW*.28,CW*.49])
heading('The common context travels with the work')
p('Company -> project -> work item/package + location/system. Link the programme activity, client BOQ line, subcontract scope, resource and evidence as relevant. A work breakdown and a physical location are different dimensions; neither should have to stand in for the other.')
p('Changes, delays, approvals, records and cost control operate throughout these stages. A closed stage remains readable. New information can cause a controlled revision or reopening instead of silently overwriting the past.','small')

begin('Four journeys that expose weak mapping', 'Expert walkthrough of the proposed structure. These are reasoned checks, not observed user-test results or executed business transactions.')
heading('1. A failed concrete inspection')
p('<b>Site / inspection -> NCR -> authorised repair -> reinspection.</b> Keep the inspection, location, cause, corrective actions and closure evidence together. Link labour/material/plant costs and waste to that work item. If a commercial change or delay is relevant, create a linked assessment; an NCR does not automatically become a billable variation.')
p('<b>Navigation test:</b> the engineer can report the problem from the inspection; QA receives the decision in My Work; the PM sees the blocker. Nobody must find a separate approval or costing module to understand the case.','small')
heading('2. A subcontractor submits more than is accepted')
p('<b>Buying / package -> application -> assessed work -> certificate -> bill -> payment.</b> Show claimed and accepted quantities with reasons for differences. The same package Money view explains deductions, retention, invoice status, due balance and payment. Finance acts on the linked authorised bill/payment record.')
p('<b>Navigation test:</b> the QS and accountant can identify the held step and its owner without treating a certificate as a paid invoice. Partial/rejected work and revised claims remain traceable.','small')
heading('3. A drawing instruction affects time and cost')
p('<b>Documents / instruction -> change case -> linked delay assessment.</b> The change owns scope, notice evidence, price and decision versions. Plan owns affected activities, mitigation and time analysis. Link both under the instruction; record pending/disputed status and accountable deadlines without double-entering the event.')
p('<b>Navigation test:</b> both Plan and Costs & Contracts reveal the same originating event and the other assessment. A priced variation alone does not imply approved time or changed commitments.','small')
heading('4. The owner asks why one slab is overspending')
p('<b>Costs & Contracts / Budget & cost -> floor + slab item.</b> Begin with revised budget, incurred cost, cash spent and forecast final cost at one cutoff. Expand material/labour/plant/subcontract/indirect detail, then source transactions. Show allocation gaps, productivity, waste, outstanding obligations and assumptions.')
p('<b>Navigation test:</b> no separate search through stock, purchasing and finance is required to explain the totals. Source documents stay one link away, with their scope, tax basis and reconciliation status visible.','small')

for group_idx, (start, end) in enumerate([(0,14),(14,28),(28,42)], 1):
 begin(f'Every current menu has a home - {group_idx}', 'Traceability from the 42 observed administrator entries (E41). New destinations are proposals; repeated old labels do not prove duplicate functionality.')
 rows = [(f'{num:02d}. {old}', home, rule) for num,old,home,rule in MENU_MAP[start:end]]
 table(['Current entry','Proposed destination','What is preserved or consolidated'], rows, [CW*.27,CW*.31,CW*.42], padding=6)
 if group_idx == 1:
  p('Project means the selected project workspace. A root-level map does not replace a later inventory of all 267 leaf controls, fields, reports, permissions and integrations before implementation.','small')
 else:
  p('Project means the selected project. Contextual shortcuts open the same records; no duplicate entry.','small')

begin('Twelve findability checks', 'Desk review performed against the proposed routes. No prototype exists and no click counts, timings or completion rates have been measured.')
table(['Task in the user\'s words','Proposed starting route','Information required to finish'], WALKTHROUGHS, [CW*.27,CW*.29,CW*.44], padding=6)
p('<b>Review result:</b> each of these tasks now has a named home and a linked handoff. Remaining hypotheses include whether Company is clear enough, whether users expect changes under Costs & Contracts, and whether snag discovery works equally well from Site and Handover. Test these first.','small')

begin('Prove the map before building it', 'Review conclusion: this is a stronger, traceable proposal. Calling it the best user experience requires evidence from representative users.')
heading('What the second review changed')
p('Removed competing top-level module choices; split vague Resources into named Company workspaces; gave Documents and Handover permanent homes; defined package ownership and Finance handoffs; removed stage-dependent navigation; mapped all 42 roots and all twelve requested capabilities. Richness now comes from connected records, not more primary menu entries.')
heading('A small, measurable validation programme')
table(['Round','Method and proposed acceptance target'],[
 ('1. Labels and tree test','Give realistic tasks without menu words. Test the proposed map with you and representatives of site, QS/PM, buying, quality/documents and finance; add estimator/plant/people users for their routes. Target at least 90% correct first destinations across core tasks; inspect failures by role, not only the overall average.'),
 ('2. Paper/clickable task walkthrough','After study review, test current drawing, NCR, partial delivery, subcontract claim, item cost, change/delay and handover cases. Target at least 90% unassisted completion and median information-finding time under 60 seconds. These are proposed gates, not achieved results.'),
 ('3. Comprehension and exceptions','Every participant handling money must correctly distinguish budget, incurred, cash spent and forecast on the tested item. Critical tested decisions must have the right version, authority and scope. Include wrong project, missing allocation, rejected work, stale data, partial payment and reopening.'),
 ('4. Accessibility and repeat use','Test keyboard/focus, zoom, touch and relevant assistive technology; mobile capture and poor connectivity where needed. Repeat with revised labels and different examples; check return visits without coaching.'),
],[CW*.27,CW*.73])
p('Record the baseline and agree targets before testing; revise the design when it fails. Do not average away a severe control failure or conceal poor results for one role. Test browse routes as well as search, and record wrong turns and repeated entry.','small')
heading('Principles checked against published guidance')
p('<link href="https://www.nngroup.com/articles/progressive-disclosure/" color="#28675F">Nielsen Norman Group: Progressive Disclosure</link> supports keeping frequent needs visible and clearly labelling secondary detail. <link href="https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html" color="#28675F">W3C: Consistent Navigation</link> supports predictable relative ordering. <link href="https://design-system.service.gov.uk/components/task-list/" color="#28675F">GOV.UK: Task list</link> distinguishes flexible task completion from a strictly ordered process. These support the principles, not the exact four/seven-area grouping. Accessed 28 October 2026.','small')
