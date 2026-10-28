import { SAMPLE_DATE } from './seed.mjs';
import { price } from './money.mjs';

// Additive, versioned local-sample content. Never reset or overwrite existing work.
export const EXAMPLE_PACK = 'feature-examples-v1';
const projects = [
  { id: 'harbour', company: 'jakh', code: 'HT', name: 'Harbour Tower', zone: 'Level 13', mockup: 'Level 02 / Unit 204', currency: 'AED', item: 'C-101', prelim: 'C-104', engineer: 'mohammed', reviewer: 'sara', vendor: 'euro' },
  { id: 'gardens', company: 'jakh', code: 'GR', name: 'Garden Residences', zone: 'Block A / Villa 01', mockup: 'Show villa', currency: 'AED', item: 'C-201', prelim: 'C-201', engineer: 'amina', reviewer: 'sara', vendor: 'gulf' },
  { id: 'creek', company: 'build', code: 'CO', name: 'Creek Offices', zone: 'Level 01 / East wing', mockup: 'Office mock-up / Room 103', currency: 'USD', item: 'C-301', prelim: 'C-301', engineer: 'noah', reviewer: 'maya', vendor: 'world' }
];

function scenarios(p) {
  const cash = value => `${p.currency} ${value}`;
  return [
    ['ACT', 'Plan', 'Programme & delays', [
      ['Prepare the next concrete pour', 'At risk', 'Planner to resolve the drawing constraint', { 'Baseline': 'Pour planned 02 Nov; follow-on work 04 Nov.', 'Current forecast': '04 Nov if coordination remains unresolved; two-day potential movement, not an approved extension.', 'Constraint': 'Embedded services need a coordinated drawing before inspection.', 'Responsibility': 'Design coordinator obtains the answer; site engineer confirms readiness.', 'Mitigation': 'Prepare the adjacent work zone while the consultant reviews the detail.' }, ['RFI-1', 'DRW-1', 'LOG-1']],
      ['Close the temporary-access constraint', 'Resolved', 'Monitor the next look-ahead review', { 'Baseline': 'Access required by 27 Oct.', 'Resolution': 'Temporary route inspected and released on 27 Oct, before the work start.', 'Effect': 'No delay claimed. Keep the dated inspection and instruction in the record.', 'Schedule control': 'This example describes an activity; no critical-path calculation is performed.' }, ['LOG-2']]
    ]],
    ['KPI', 'Plan', 'KPIs & performance', [
      ['First-pass inspection acceptance', 'Below target', 'QA manager to review the two recurring defects', { 'Definition': 'First-pass accepted inspections / completed inspections.', 'Population': '18 accepted / 20 completed = 90%; target 95%.', 'Period': '01–28 Oct 2026. Three open inspections are excluded.', 'Main observation': 'Two completed inspections required repair; do not count their reinspection as new first-pass successes.', 'Follow-up': 'Review workmanship briefing and verify the next five inspections.' }, ['NCR-1', 'NCR-2']],
      ['Weekly plan completion', 'On target', 'Maintain the same weekly review cadence', { 'Definition': 'Activities completed as promised / activities promised this week.', 'Population': '9 completed / 10 promised = 90%; target 85%.', 'Cutoff': '28 Oct 2026. One blocked activity remains open.', 'Aggregation': 'Combine the underlying counts across projects; do not average percentages.' }, ['ACT-1', 'ACT-2']]
    ]],
    ['LOG', 'Site', 'Daily work', [
      ['Concrete preparation — daily diary', 'Draft', 'Site engineer to review quantities and constraints', { 'Work completed': `Prepared 120 m² of formwork at ${p.zone}; reinforcement inspection still pending.`, 'People & plant': '18 operatives, two supervisors, one crane for six hours.', 'Weather': 'Illustrative clear conditions, 30°C; no weather stoppage.', 'Material use': '2.0 tonnes of rebar issued; offcuts tracked separately.', 'Blocker': 'Services coordination answer required before closing the pour inspection.', 'Evidence': 'Diary and delivery references are examples; no real photos are attached.' }, ['ACT-1', 'WST-1', 'RFI-1']],
      ['Access route — reviewed daily diary', 'Reviewed', 'Carry the completed quantity into the weekly review', { 'Work completed': 'Temporary access route completed and inspected: 80 linear metres.', 'Resources': 'Six operatives × eight hours = 48 labour-hours; one roller × five hours.', 'Review': 'Supervisor checked measured length and plant hours on 27 Oct.', 'Safety': 'Pedestrian separation and signage checked before release.', 'Posting boundary': 'Reviewed diary data does not automatically post payroll or costs in this increment.' }, ['ACT-2', 'AST-2']]
    ]],
    ['NCR', 'Site', 'Quality & safety', [
      ['Repair a concrete cover defect', 'Verification due', 'Independent QA inspector to verify the repair', { 'Requirement': 'Example approved detail requires 40 mm nominal cover.', 'Observation': `Measured 25 mm at the affected edge in ${p.zone}; NCR raised before follow-on work.`, 'Containment': 'Hold the affected area; prevent concealment until accepted.', 'Cause & disposition': 'Spacer displacement during fixing; engineer-approved local repair proposed.', 'Remedy': 'Repair completed to sample method RM-02; inspection still required.', 'Acceptance': 'QA must record measurements and acceptance evidence. Presence of a repair note is not closure.' }, ['DRW-1', 'LOG-1', 'WST-1']],
      ['Close the edge-protection inspection', 'Closed', 'Retain the accepted inspection evidence', { 'Observation': 'Missing intermediate rail identified during the temporary-works inspection.', 'Containment': 'Access to the exposed edge restricted immediately.', 'Correction': 'Rail installed and fixing torque checked.', 'Verification': 'Independent inspector accepted the correction on 27 Oct.', 'Reopening': 'Reopen if the protection is altered or a repeat defect is found.', 'Evidence': 'Illustrative inspection checklist QA-02; no actual file uploaded.' }, ['LOG-2']]
    ]],
    ['WST', 'Site', 'Materials & waste', [
      ['Rebar offcuts — reuse and disposal', 'Awaiting disposition', 'Storekeeper to confirm authorised destination', { 'Quantity balance': '2.00 t issued = 1.82 t incorporated + 0.12 t reusable offcuts + 0.06 t scrap.', 'Reuse': 'Tag reusable lengths for approved secondary supports.', 'Disposal': 'Scrap collection is proposed; carrier, weight ticket and destination are required before completion.', 'Cost treatment': 'Do not charge the original material a second time. Record any disposal fee separately.', 'Origin': 'Cutting activity in the daily diary, linked to the original work item.' }, ['LOG-1', 'NCR-1']],
      ['Return unused formwork panels', 'Reconciled', 'Keep the store receipt with the site movement', { 'Quantity balance': '50 panels issued = 42 installed + 8 returned; no unexplained loss.', 'Condition': 'Returned panels inspected and marked reusable.', 'Movement': 'Site return and receiving-store acknowledgement dated 27 Oct.', 'Cost treatment': 'Stock/custody movement only in this example; do not treat all returns as waste.' }, ['LOG-2']]
    ]],
    ['AST', 'Site', 'Plant & equipment', [
      ['Telehandler — preventive service', 'Service due', 'Plant coordinator to book service before 500 hours', { 'Asset': `${p.code}-TH-01 · owned plant · custodian: site plant team.`, 'Meter': '492 engine-hours; service threshold 500.', 'Use': 'Six hours used on 28 Oct; inspection checklist completed.', 'Availability': 'Available until planned service; reserve a replacement for unloading.', 'Cost allocation': `Daily hire-equivalent allocation belongs to ${p.prelim}; no depreciation posting is performed here.` }, ['LOG-1']],
      ['Compactor — hire return', 'Returned', 'Commercial team to check the final hire statement', { 'Asset': `${p.code}-CP-02 · hired plate compactor.`, 'Hire period': '20–27 Oct; eight calendar days.', 'Custody': 'Return condition accepted by the supplier on 27 Oct.', 'Cost example': `8 days × ${cash('90')} = ${cash('720')} excluding tax.`, 'Control': 'Return confirmation stops the expected hire period; supplier invoice still needs checking.' }, ['LOG-2', 'PAY-2']]
    ]],
    ['SC', 'Buying', 'Subcontracts', [
      ['Waterproofing package — measurement review', 'Measurement review', 'Quantity surveyor to verify the claimed quantity', { 'Scope': `Waterproofing to ${p.zone}; sample package rate ${cash('40')} / m².`, 'Claimed work': `1,000 m² × ${cash('40')} = ${cash('40,000')}.`, 'Verified work': `950 m² × ${cash('40')} = ${cash('38,000')}; 50 m² pending inspection.`, 'Retention': `5% of certified gross = ${cash('1,900')}; net before tax ${cash('36,100')}.`, 'Next handoff': 'Approved certificate supports the bill review; it is not a payment.', 'Outstanding': 'Resolve the unverified 50 m² and preserve measurement sheets.' }, ['PAY-2', 'NCR-1']],
      ['Mock-up joinery package — final review', 'Final review', 'Commercial manager to check final obligations', { 'Scope': `Doors and joinery in ${p.mockup}.`, 'Contract': `Original ${cash('60,000')} + approved change ${cash('3,000')} = revised ${cash('63,000')}.`, 'Certified': `${cash('63,000')} gross; no further measured work expected.`, 'Retention': `${cash('3,150')} held, subject to the agreed defects-release conditions.`, 'Closeout': 'Mock-up snag acceptance is recorded; warranty and final account signatures still need checking.' }, ['VO-2', 'SN-2', 'COM-2']]
    ]],
    ['VO', 'Costs & Contracts', 'Changes & variations', [
      ['Assess a revised service opening', 'Cost review', 'Commercial manager and planner to complete the assessment', { 'Origin': 'Design coordination identified a conflict requiring a proposed service-opening relocation.', 'Instruction': 'Sample instruction CI-03 received 26 Oct; notice issued 27 Oct.', 'Cost proposal': `Labour ${cash('2,000')} + materials ${cash('1,500')} + plant ${cash('500')} = ${cash('4,000')}, excluding tax.`, 'Time proposal': 'One additional day proposed; no entitlement or extension has been agreed.', 'Authority': 'Client approval pending. Do not revise the approved budget or order yet.' }, ['RFI-1', 'ACT-1']],
      ['Approved mock-up door hardware change', 'Approved', 'Check the downstream package amendment', { 'Origin': 'Client selected upgraded hardware for the accepted mock-up.', 'Assessment': `12 sets × ${cash('250')} incremental cost = ${cash('3,000')}.`, 'Decision': 'Illustrative client approval recorded 27 Oct; no additional time agreed.', 'Downstream control': 'Link to the joinery package amendment. This read-only example does not post a live budget change.' }, ['SC-2', 'SN-2']]
    ]],
    ['PAY', 'Costs & Contracts', 'Payments & cash flow', [
      ['Client certificate — partial receipt', 'Due for collection', 'Finance to confirm the remaining receipt date', { 'Certificate': `${cash('100,000')} gross less 5% retention (${cash('5,000')}) = ${cash('95,000')} net, excluding tax.`, 'Cash received': cash('40,000'), 'Open balance': `${cash('55,000')} expected 05 Nov; forecast only, not a bank receipt.`, 'Tracking': 'Certificate, invoice, receipt and bank clearing are separate records.', 'Cash planning': 'Do not use the gross certificate as cash available.' }, ['SC-1']],
      ['Subcontract certificate — payment review', 'Payment review', 'Finance reviewer to match the bill and certificate', { 'Certified gross': cash('38,000'), 'Retention': `5% = ${cash('1,900')}.`, 'Net payable': `${cash('36,100')} excluding tax; nothing paid in this example.`, 'Due date': '03 Nov 2026, subject to invoice and authority checks.', 'Controls': 'Match measurement, certificate and bill. No bank details or executable payment instruction is included.' }, ['SC-1', 'AST-2']]
    ]],
    ['DRW', 'Documents', 'Drawings & revisions', [
      ['Coordinated structural detail — revision C', 'Current revision', 'Use revision C and check the linked clarification', { 'Document': `${p.code}-STR-021 · revision C · issued for construction on 27 Oct.`, 'Change': 'Revision C updates the general reinforcement layout. A proposed opening relocation remains on hold pending the RFI answer.', 'Revision history': 'A: design issue; B: review issue; C: construction issue. Earlier revisions remain historical.', 'Distribution': 'Site engineer, subcontractor and QA/QC.', 'Availability': 'Example metadata only; no drawing file attached.' }, ['RFI-1', 'VO-1', 'NCR-1']],
      ['Structural detail — superseded revision B', 'Superseded', 'Use the current construction revision', { 'Document': `${p.code}-STR-021 · revision B · review issue dated 22 Oct.`, 'Superseded by': 'Revision C dated 27 Oct.', 'Control': 'Retained for the audit trail; must not be used for new work.', 'Availability': 'Illustrative revision metadata; no actual attachment.' }, ['DRW-1']]
    ]],
    ['RFI', 'Documents', 'RFIs & correspondence', [
      ['Clarify the service-opening detail', 'Awaiting reply', 'Design coordinator to obtain the consultant response', { 'Question': `Confirm opening dimensions and reinforcement arrangement at ${p.zone}.`, 'Reason': 'Services route conflicts with the structural review issue.', 'Requested response': '29 Oct, before the pour inspection.', 'Commercial link': 'Assess a change only after instruction and applicable notice review.', 'Evidence': 'Keep the issued question, dated response and drawing revision together.' }, ['DRW-1', 'VO-1', 'ACT-1']],
      ['Confirm the mock-up finish code', 'Answered', 'Site team to use the confirmed finish schedule', { 'Question': 'Confirm finish code for the mock-up door and frame.', 'Response': 'Consultant confirmed finish F-07 on 26 Oct.', 'Distribution': 'Reply issued to joinery subcontractor and QA/QC.', 'Closure': 'Answer recorded; physical acceptance remains with the snag/inspection workflow.' }, ['SN-2', 'SC-2']]
    ]],
    ['SN', 'Handover', 'Snags & defects', [
      ['Rectify the mock-up door clearance', 'Open', 'Joinery subcontractor to correct and request verification', { 'Location': p.mockup, 'Defect': 'Door leaf catches on the frame at the upper corner.', 'Assignment': 'Joinery subcontractor; rectify by 30 Oct.', 'Evidence needed': 'Before/after photo references and measured clearance.', 'Acceptance': 'Keep this snag open until independent verification; completion claimed by the trade is not acceptance.' }, ['SC-2', 'RFI-2']],
      ['Accept the mock-up sealant finish', 'Accepted', 'Carry acceptance into the location handover checklist', { 'Location': p.mockup, 'Observation': 'Uneven sealant bead at the sample window.', 'Rectification': 'Bead removed and reapplied to the approved finish sample.', 'Verification': 'Consultant representative accepted the finish on 27 Oct.', 'Boundary': 'This closes one snag, not the whole location or project.' }, ['SC-2', 'COM-2']]
    ]],
    ['COM', 'Handover', 'Testing & commissioning', [
      ['Prepare the emergency-lighting test', 'Not ready', 'MEP lead to complete prerequisites and book the witness', { 'System': `Emergency lighting serving ${p.mockup}.`, 'Prerequisites': 'Approved test procedure and circuit schedule; battery charge confirmation still missing.', 'Test': 'Proposed three-hour duration test on 03 Nov, subject to the approved project specification.', 'Witness': 'Consultant booking requested, not confirmed.', 'Handover': 'O&M, asset serials and test evidence remain required before acceptance.' }, ['DRW-1', 'SN-1']],
      ['Mock-up water test — accepted result', 'Accepted', 'Document controller to complete the handover pack', { 'System': `Wet-area waterproofing at ${p.mockup}.`, 'Test record': 'Illustrative 24-hour water-retention test completed 27 Oct; no visible leakage recorded.', 'Witness': 'QA/QC and consultant example sign-off recorded.', 'Outstanding pack': 'Add approved method, material certificates and warranty reference.', 'Boundary': 'Accepted test does not automatically release retention or hand over the entire project.' }, ['SN-2', 'SC-1']]
    ]]
  ];
}

export function installExamples(db) {
  db.exec('CREATE TABLE IF NOT EXISTS sample_packs (id TEXT PRIMARY KEY, installed_at TEXT NOT NULL)');
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(EXAMPLE_PACK)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const insert = (table, row) => {
      const keys = Object.keys(row);
      return db.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
    };
    for (const [id, name, role, company, project, limit] of [
      ['amina', 'Amina Hassan', 'Site engineer', 'jakh', 'gardens', '0'],
      ['noah', 'Noah Williams', 'Site engineer', 'build', 'creek', '0'],
      ['maya', 'Maya Chen', 'Commercial manager', 'build', '*', '500000']
    ]) {
      insert('users', { id, name, role });
      insert('memberships', { user_id: id, company_id: company, project_id: project, can_approve: limit === '0' ? 0 : 1, approval_limit: limit });
    }
    for (const p of projects) {
      if (!db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(p.id, p.company)) continue;
      const recordId = suffix => `EX-${p.code}-${suffix}`;
      for (const [code, area, category, cases] of scenarios(p)) {
        cases.forEach(([title, status, next_action, details, links], index) => {
          const id = recordId(`${code}-${index + 1}`);
          const complete = ['Closed', 'Accepted', 'Resolved', 'Reconciled', 'Returned', 'Reviewed', 'Answered', 'Approved', 'Superseded'].includes(status);
          insert('records', {
            id, company_id: p.company, project_id: p.id, area, category, title,
            location: ['SN', 'COM'].includes(code) ? p.mockup : p.zone,
            owner: ['VO', 'SC', 'PAY'].includes(code) ? 'Commercial team' : ['DRW', 'RFI'].includes(code) ? 'Design coordinator' : 'Site team',
            due: complete ? '2026-10-27' : '2026-10-30', status, next_action,
            details: JSON.stringify({ ...details, _example: {
              label: 'Illustrative construction example',
              linkedIds: links.map(recordId),
              timeline: [{ at: '2026-10-25', who: 'Originating team', text: `Example opened for ${p.name}.` }, { at: complete ? '2026-10-27' : SAMPLE_DATE, who: ['VO', 'SC', 'PAY'].includes(code) ? 'Commercial reviewer' : 'Responsible reviewer', text: `${status}. ${next_action}.` }]
            } })
          });
        });
      }
      const vendor = db.prepare('SELECT * FROM vendors WHERE id=? AND company_id=?').get(p.vendor, p.company);
      for (const [status, title, quantity, unit, estimate] of [
        ['draft', 'Temporary edge protection', '20', 'metres', '125'],
        ['submitted', 'Reinforcement for the next pour', '2', 'tonnes', null],
        ['returned', 'Mobile access platform hire', '14', 'days', '180'],
        ['approved', 'Dust suppression hoses', '10', 'lengths', '95']
      ]) {
        const sourced = status === 'submitted';
        const requester = ['draft', 'returned'].includes(status) ? 'ahmed' : p.engineer;
        const requesterName = db.prepare('SELECT name FROM users WHERE id=?').get(requester).name;
        const reviewer = status === 'returned' ? p.reviewer : 'ahmed';
        const version = status === 'draft' ? 1 : status === 'submitted' ? 2 : 3;
        const unitPrice = sourced ? vendor.unit_price : estimate;
        const rate = sourced ? vendor.rate : '1';
        const values = price(quantity, unitPrice, rate);
        const id = `PR-EX-${p.code}-${status.toUpperCase()}`;
        const result = insert('requests', {
          id, company_id: p.company, project_id: p.id, item_id: sourced ? p.item : p.prelim,
          title, location: p.zone, due: '2026-11-02', requester_id: requester,
          owner: status === 'submitted' ? 'Ahmed Al Mansoori' : status === 'approved' ? 'Procurement' : requesterName,
          status, version, vendor_id: sourced ? vendor.id : null, quantity, unit, unit_price: unitPrice,
          currency: sourced ? vendor.currency : p.currency, amount: values.amount, company_amount: values.companyAmount,
          rate, rate_date: SAMPLE_DATE, rate_source: sourced ? 'Illustrative quote conversion' : 'Company-currency estimate',
          quote: sourced ? vendor.quote : null, created_at: '2026-10-25T08:00:00Z'
        });
        if (result.changes) {
          insert('events', { request_id: id, actor_id: requester, action: 'created', version: 1, note: 'Illustrative example created for the local learning workspace.', at: '2026-10-25T08:00:00Z' });
          if (version >= 2) insert('events', { request_id: id, actor_id: requester, action: 'submitted', version: 2, note: 'Submitted for independent sourcing review.', at: '2026-10-26T09:00:00Z' });
          if (version === 3) insert('events', { request_id: id, actor_id: reviewer, action: status, version: 3, note: status === 'returned' ? 'Confirm the hire duration and collection charge before resubmitting.' : 'Sourcing approved only; no order, cost or cash posting created.', at: '2026-10-27T10:00:00Z' });
        }
      }
    }
    for (const [company, code, currency, city] of [['jakh', 'AE', 'AED', 'Dubai'], ['build', 'INT', 'USD', 'International portfolio']]) {
      const add = (suffix, area, category, title, status, next, details) => insert('records', {
        id: `EX-${code}-${suffix}`, company_id: company, project_id: null, area, category, title, location: city,
        owner: area === 'Tenders' ? 'Bid team' : category === 'People' ? 'People team' : 'Storekeeper', due: '2026-11-03', status,
        next_action: next, details: JSON.stringify(details)
      });
      add('TEN-1', 'Tenders', 'Bids & estimates', 'Mixed-use tower — tender comparison', 'Estimating', 'Complete quote coverage and risk review', {
        'Opportunity': 'Illustrative G+18 mixed-use tower; submission 10 Nov.', 'Estimate': `Base works ${currency} 20,000,000 + preliminaries 2,000,000 + risk allowance 1,000,000 = ${currency} 23,000,000 before margin/tax.`,
        'Quote coverage': 'Three façade quotes received; two MEP packages still have exclusions.', 'Review': 'Compare equivalent scope, lead time and currency basis before bid approval.', 'Next step': 'Bid director reviews the assumptions and approves the submission version.'
      });
      add('TEN-2', 'Tenders', 'Bids & estimates', 'Community centre — bid/no-bid review', 'Decision pending', 'Bid director to decide whether to tender', {
        'Opportunity': 'Illustrative community centre; 12-month delivery period.', 'Capacity': 'Site team available, subject to the tower project mobilisation date.', 'Risk': 'Client design is incomplete; pricing basis and tender conditions need clarification.', 'Decision record': 'Document reasons, owner and date. No bid or contract has been submitted.'
      });
      add('HR-1', 'Company', 'People', 'Weekly timesheets — allocation review', 'Review due', 'Supervisor to confirm hours and cost allocation', {
        'Population': 'Example crew: eight workers × 40 hours = 320 hours.', 'Allocation': '240 hours structural work + 64 hours temporary works + 16 hours induction = 320.', 'Exception': 'Overtime is not authorised by this record.', 'Privacy': 'Synthetic aggregate crew information; no real employee pay or personal data.', 'Next handoff': 'Approved allocation supports payroll review; no payroll posting is implemented.'
      });
      add('HR-2', 'Company', 'People', 'Site induction — new starter checklist', 'In progress', 'Site administrator to complete the induction evidence', {
        'Checklist': 'Identity/right-to-work review, project induction, safety briefing and role access.', 'Progress': 'Three of four example checks complete; role access awaits approval.', 'Control': 'A checklist must not create access or make an employment decision automatically.', 'Privacy': 'No real identity documents are included.'
      });
      add('ST-1', 'Company', 'Stores', 'Consumables — stock count variance', 'Reconciliation due', 'Storekeeper to investigate the missing issue note', {
        'Balance': '100 units opening + 40 received − 90 issued = 50 recorded units.', 'Physical count': '48 units; variance −2 units.', 'Investigation': 'Check the unposted issue before proposing an adjustment.', 'Authority': 'No write-off or cost posting until authorised.'
      });
      add('ST-2', 'Company', 'Stores', 'Safety barriers — project return', 'Received', 'Keep the return and receipt references together', {
        'Movement': 'Eight reusable barriers returned from the sample project to the same company warehouse.', 'Inspection': 'All eight accepted; no damage or unexplained difference.', 'Custody': 'Receiving storekeeper acknowledged custody on 27 Oct.', 'Boundary': 'A transfer to another legal company requires separate intercompany documents.'
      });
    }
    insert('sample_packs', { id: EXAMPLE_PACK, installed_at: new Date().toISOString() });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
