export const SAMPLE_DATE = '2026-10-28';
export function seed(db) {
  const insert = (table, row) => {
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
  };
  for (const row of [{
    id: 'jakh',
    name: 'JAKH Contracting LLC',
    currency: 'AED'
  }, {
    id: 'build',
    name: 'JAKH International Ltd',
    currency: 'USD'
  }]) insert('companies', row);
  for (const row of [{
    id: 'harbour',
    company_id: 'jakh',
    name: 'Harbour Tower',
    code: 'HT-001',
    location: 'Dubai',
    phase: 'Delivery'
  }, {
    id: 'gardens',
    company_id: 'jakh',
    name: 'Garden Residences',
    code: 'GR-002',
    location: 'Sharjah',
    phase: 'Mobilisation'
  }, {
    id: 'creek',
    company_id: 'build',
    name: 'Creek Offices',
    code: 'CO-003',
    location: 'International portfolio',
    phase: 'Delivery'
  }]) insert('projects', row);
  for (const row of [{
    id: 'ahmed',
    name: 'Ahmed Al Mansoori',
    role: 'Project manager'
  }, {
    id: 'mohammed',
    name: 'Mohammed Khan',
    role: 'Site engineer'
  }, {
    id: 'sara',
    name: 'Sara Al Mansoori',
    role: 'Commercial manager'
  }]) insert('users', row);
  for (const row of [['ahmed', 'jakh', '*', 1, '250000'], ['ahmed', 'build', '*', 1, '100000'], ['mohammed', 'jakh', 'harbour', 0, '0'], ['sara', 'jakh', '*', 1, '1000000']]) insert('memberships', Object.fromEntries(['user_id', 'company_id', 'project_id', 'can_approve', 'approval_limit'].map((key, i) => [key, row[i]])));
  for (const row of [['euro', 'jakh', 'EuroSteel Supplies', 'EUR', '900', '4.00', 'Q-781'], ['gulf', 'jakh', 'Gulf Reinforcement LLC', 'AED', '3700', '1', 'Q-792'], ['world', 'build', 'Global Steel Supply', 'USD', '1000', '1', 'Q-801']]) insert('vendors', {
    id: row[0],
    company_id: row[1],
    name: row[2],
    currency: row[3],
    unit_price: row[4],
    rate: row[5],
    quote: row[6],
    rate_date: SAMPLE_DATE,
    valid_until: '2026-11-04'
  });
  const costs = [['C-101', 'jakh', 'harbour', 'Concrete frame / Reinforcement', 'Levels 01–24', '18000000', '18000000', '12000000', '10500000', '8400000', '18400000', '200000', 'Approved budget B-001 rev 2; forecast F-001 rev 1; cost snapshot CS-001'], ['C-102', 'jakh', 'harbour', 'Mechanical, electrical & plumbing', 'All systems', '14500000', '15000000', '10000000', '7000000', '5200000', '15100000', '500000', 'Approved budget B-001 rev 2; forecast F-002 rev 1; cost snapshot CS-002'], ['C-103', 'jakh', 'harbour', 'Finishes & façade', 'All elevations', '9500000', '10000000', '6000000', '4000000', '3000000', '10200000', '300000', 'Approved budget B-001 rev 2; forecast F-003 rev 1; cost snapshot CS-003'], ['C-104', 'jakh', 'harbour', 'Site preliminaries', 'Main site', '5000000', '5000000', '3000000', '3000000', '2800000', '4900000', '100000', 'Approved budget B-001 rev 2; forecast F-004 rev 1; cost snapshot CS-004'], ['C-201', 'jakh', 'gardens', 'Mobilisation', 'Main site', '2000000', '2000000', '600000', '400000', '300000', '2100000', '200000', 'Budget GR-B01; forecast GR-F01; snapshot GR-CS01'], ['C-900', 'jakh', null, 'Company overheads', 'Head office', '800000', '800000', '500000', '450000', '400000', '800000', '0', 'Company budget OH-B01; snapshot OH-CS01'], ['C-301', 'build', 'creek', 'Structural works', 'Main building', '4000000', '4200000', '2000000', '1200000', '900000', '4300000', '100000', 'Budget CO-B01; forecast CO-F01; snapshot CO-CS01']];
  const costKeys = ['id', 'company_id', 'project_id', 'name', 'location', 'original_budget', 'revised_budget', 'committed', 'incurred', 'cash', 'forecast', 'request_allowance', 'source'];
  costs.forEach(row => insert('cost_items', Object.fromEntries(costKeys.map((key, i) => [key, row[i]]))));
  insert('requests', {
    id: 'PR-0264',
    company_id: 'jakh',
    project_id: 'harbour',
    item_id: 'C-101',
    title: 'Reinforcement steel',
    location: 'Level 13',
    due: '2026-11-02',
    requester_id: 'mohammed',
    owner: 'Ahmed',
    status: 'submitted',
    version: 2,
    vendor_id: 'euro',
    quantity: '40',
    unit: 'tonnes',
    unit_price: '900',
    currency: 'EUR',
    amount: '36000.00',
    company_amount: '144000.00',
    rate: '4.00',
    rate_date: SAMPLE_DATE,
    rate_source: 'Illustrative quote conversion',
    quote: 'Q-781',
    created_at: '2026-10-28T08:45:00Z'
  });
  insert('events', {
    request_id: 'PR-0264',
    actor_id: 'mohammed',
    action: 'created',
    version: 1,
    note: 'Quote Q-781 attached. Rebar B500B for Level 13.',
    at: '2026-10-28T08:45:00Z'
  });
  insert('events', {
    request_id: 'PR-0264',
    actor_id: 'mohammed',
    action: 'submitted',
    version: 2,
    note: 'Submitted for budget and sourcing approval.',
    at: '2026-10-28T09:20:00Z'
  });
  const record = (id, area, category, title, location, owner, due, status, next, details, project = 'harbour', company = 'jakh') => insert('records', {
    id,
    company_id: company,
    project_id: project,
    area,
    category,
    title,
    location,
    owner,
    due,
    status,
    next_action: next,
    details: JSON.stringify(details)
  });
  record('NCR-018', 'Site', 'Quality & safety', 'Verify concrete finish', 'Level 12', 'Omar', '2026-10-28', 'Verification due', 'Independent QA verification', {
    'Issue': 'Honeycombing on column C12; inspection ITP-04.',
    'Containment': 'Affected area isolated; no covering work permitted.',
    'Remedy': 'Approved repair method RM-07 applied on 27 Oct.',
    'Evidence': 'Repair photographs and inspection checklist referenced in QA-PACK-018. Files not imported in this local sample.',
    'Closure requirement': 'Independent verification, acceptance evidence and QA authority.',
    'Related cost item': 'C-101'
  });
  record('VO-014', 'Costs & Contracts', 'Changes & variations', 'Review lobby change', 'Ground floor', 'Sara', '2026-10-30', 'Cost review', 'Complete cost and time assessment', {
    'Instruction': 'Client instruction CI-022, lobby layout revision.',
    'Notice': 'Submitted 25 Oct; acknowledgement pending.',
    'Assessment': 'AED 85,000 proposed; 2 days potential impact, not agreed.',
    'Authority': 'Client approval pending. No revised commitment or invoice issued.'
  });
  record('ACT-012', 'Plan', 'Programme & delays', 'Level 13 reinforcement', 'Level 13', 'Rami', '2026-11-02', 'At risk', 'Confirm material release and crew availability', {
    'Baseline': 'Start 02 Nov; finish 06 Nov.',
    'Current plan': 'Start 02 Nov; finish 06 Nov; subject to material release.',
    'Constraint': 'PR-0264 awaiting sourcing approval.',
    'Schedule master': 'Local sample activity register; CPM calculation and P6 integration are not yet implemented.',
    'Delay notice': 'None issued. Potential impact requires planner assessment.'
  });
  record('LOG-028', 'Site', 'Daily work', 'Daily site record', 'Main site', 'Rami', '2026-10-28', 'Draft', 'Complete daily work review', {
    'Work': 'Level 12 repair verification; Level 13 preparation.',
    'Labour': '48 workers; 2 supervisors.',
    'Plant': 'Tower crane TC-01; concrete pump CP-02.',
    'Weather': 'Clear; 31°C (illustrative).',
    'Evidence': 'Daily diary fields are sample records; photo upload is a later increment.'
  });
  record('WST-009', 'Site', 'Materials & waste', 'Rebar offcuts', 'Cutting yard', 'Nabil', '2026-10-29', 'Awaiting disposition', 'Approve reuse or disposal destination', {
    'Quantity balance': '0.80 tonnes identified: 0.50 reusable + 0.30 proposed scrap.',
    'Reuse': 'Tagged for secondary supports; technical acceptance pending.',
    'Disposal': 'Carrier and destination not yet recorded.',
    'Cost treatment': 'Material cost stays on its original receipt/issue; disposal fees would be a separate cost.',
    'Related cost item': 'C-101'
  });
  record('AST-001', 'Site', 'Plant & equipment', 'Tower crane TC-01', 'Main site', 'Khalid', '2026-10-31', 'Service due', 'Arrange preventive service', {
    'Ownership': 'Owned by JAKH Contracting LLC.',
    'Custody': 'Harbour Tower plant team.',
    'Meter': '1,240 hours; next service 1,250 hours.',
    'Maintenance': 'Service order M-041 planned; operator checks current.',
    'Allocation': 'Preliminaries / C-104. Installed building assets are managed in Handover.'
  });
  record('SC-006', 'Buying', 'Subcontracts', 'Façade package', 'All elevations', 'Sara', '2026-11-03', 'Measurement review', 'Review measured work against package scope', {
    'Agreement': 'SC-006 rev 1; AED 6,000,000.',
    'Measured work': 'AED 900,000 claimed; AED 850,000 certified.',
    'Bills': 'AED 800,000 posted in the sample snapshot.',
    'Payments': 'AED 600,000 recorded paid; bank clearing not confirmed.',
    'Retention': '5% per sample agreement. Certification, billing and settlement are distinct.'
  });
  record('PAY-011', 'Costs & Contracts', 'Payments & cash flow', 'Client certificate 07', 'Project-wide', 'Leila', '2026-11-05', 'Due for collection', 'Confirm expected receipt date', {
    'Certified': 'AED 2,400,000 gross.',
    'Invoice': 'INV-007; AED 2,280,000 after retention in this simplified sample, excluding tax.',
    'Received': 'AED 1,000,000.',
    'Open receivable': 'AED 1,280,000.',
    'Forecast date': '05 Nov 2026; collection assumption, not bank receipt.'
  });
  record('KPI-001', 'Plan', 'KPIs & performance', 'Inspection acceptance', 'All locations', 'Omar', '2026-10-28', 'Below target', 'Review rejected inspection causes', {
    'Definition': 'Accepted inspections / completed inspections in period.',
    'Population': '72 accepted / 80 completed, 01–28 Oct.',
    'Result': '90%; target 95%.',
    'Missing data': 'Open inspections excluded; sample population only.',
    'Owner': 'QA/QC manager; review weekly.'
  });
  record('DRW-041', 'Documents', 'Drawings & revisions', 'Level 13 reinforcement drawing', 'Level 13', 'Dina', '2026-10-27', 'Current revision', 'Use revision C for construction', {
    'Document': 'STR-L13-041 · Revision C · Issued for construction.',
    'Supersedes': 'Revision B, retained in issue history.',
    'Distribution': 'Site engineer, QA/QC, subcontractor.',
    'File availability': 'Metadata only in local sample; controlled uploads and external transmittals are pending.'
  });
  record('RFI-033', 'Documents', 'RFIs & correspondence', 'Lobby ceiling coordination', 'Ground floor', 'Dina', '2026-10-30', 'Awaiting reply', 'Consultant response required', {
    'Question': 'Confirm clear height after revised services routing.',
    'Related event': 'VO-014.',
    'Submitted': '26 Oct 2026; response due 30 Oct.',
    'Recordkeeping': 'Responses must preserve author, issue date and revision.'
  });
  record('SN-021', 'Handover', 'Snags & defects', 'Door alignment', 'Level 02 / Unit 204', 'Faisal', '2026-11-04', 'Open', 'Rectify and request independent inspection', {
    'Defect': 'Bathroom door catches at frame.',
    'Assigned party': 'Joinery subcontractor.',
    'Completion evidence': 'Required before verification.',
    'Acceptance': 'Location has not been handed over.'
  });
  record('COM-004', 'Handover', 'Testing & commissioning', 'Fire alarm commissioning', 'Fire alarm system', 'Faisal', '2026-11-12', 'Not ready', 'Complete pre-commissioning checks', {
    'Prerequisites': 'Approved test procedure, device checks and interface matrix.',
    'Witness': 'Consultant witness booking pending.',
    'Installed assets': 'FA-001 fire alarm panel; warranty starts on agreed acceptance date.',
    'Handover pack': 'O&M manual and as-built register incomplete.'
  });
  record('TEN-008', 'Tenders', 'Bids & estimates', 'Marina residential tower', 'Dubai', 'Yasmin', '2026-11-10', 'Estimating', 'Complete subcontract enquiry comparison', {
    'Client': 'Marina Developments (sample).',
    'Bid stage': 'Qualified; estimate revision 3.',
    'Scope': 'G+24 residential tower.',
    'Outstanding': 'MEP quote comparison and risk review.',
    'Tender value': 'Not approved; no contract awarded.'
  }, null);
  record('HR-014', 'Company', 'People', 'October site timesheets', 'Harbour Tower', 'Lina', '2026-10-30', 'Review due', 'Check cost allocation before payroll export', {
    'Coverage': 'Site labour hours; payroll is not posted from this record.',
    'Access': 'Company HR policy and individual record permissions still require implementation.'
  }, null);
  record('ST-005', 'Company', 'Stores', 'Central store stock check', 'Central warehouse', 'Nabil', '2026-11-01', 'Scheduled', 'Reconcile counted and recorded stock', {
    'Scope': 'Reinforcement and consumables.',
    'Company ownership': 'JAKH Contracting LLC.',
    'Intercompany': 'Transfers to another legal entity require linked documents; not implemented in this increment.'
  }, null);
  record('CO-011', 'Site', 'Quality & safety', 'Foundation inspection', 'Basement', 'Noah', '2026-10-30', 'Scheduled', 'Prepare inspection evidence', {
    'Requirement': 'Approved inspection plan.',
    'Evidence': 'Sample record for USD company scope.'
  }, 'creek', 'build');
}
