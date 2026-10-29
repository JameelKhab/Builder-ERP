import { transaction } from './db.mjs';
import { estimates } from './estimates.mjs';
import { masters } from './masters.mjs';
export const ESTIMATE_EXAMPLES = 'estimates-v1';
export function sampleEstimate(c, customer, date, project = null) {
  const currency = c.currency;
  const item = (key, code, description, quantity, unit, rate) => ({
    key,
    code,
    description,
    kind: 'item',
    parent_key: 'construction',
    cost_code_id: c.id + '-GENERAL',
    unit,
    quantity,
    mode: 'direct',
    direct_rate: rate,
    item_markup: '0',
    secondary_unit: null,
    conversion: '0'
  });
  return {
    company_id: c.id,
    project_id: project,
    customer_id: customer,
    title: 'Example · Eleven villas and one variant',
    tender_reference: 'DEMO-VILLAS-11',
    due: '2026-12-01',
    currency,
    rate: '1',
    rate_date: date,
    rate_source: 'Functional currency · fictional estimate',
    buildings: 11,
    indirect_pool: '2352',
    overhead: '10',
    profit: '20',
    header_markup: '0',
    basis: 'Fictional study. Ten standard villas plus one variant. Resource costs and quantity exceptions are explicit.',
    exclusions: 'Tax, client acceptance, bonds and contract finance terms require separate review.',
    reason: 'Synthetic estimating example; no external offer',
    lines: [{
      key: 'construction',
      code: 'WORKS',
      description: 'Construction work',
      kind: 'group',
      parent_key: null,
      cost_code_id: c.id + '-GENERAL'
    }, {
      ...item('structure', 'STR', 'Structure assembly', '10', 'm3', '0'),
      mode: 'assembly',
      secondary_unit: 'kg',
      conversion: '120'
    }, item('finishes', 'FIN', 'Finishes', '20', 'm2', '40'), item('mep', 'MEP', 'MEP work package', '1', 'lump', '500')],
    resources: [['material', '40'], ['labour', '20'], ['plant', '10'], ['subcontract', '10']].map(([kind, rate]) => ({
      key: 'resource-' + kind,
      line_key: 'structure',
      kind,
      description: 'Example · ' + kind,
      unit: kind === 'labour' || kind === 'plant' ? 'hour' : 'unit',
      consumption: '1',
      unit_rate: rate,
      price_basis: '1',
      currency,
      rate: '1',
      rate_date: date,
      rate_source: 'Fictional dated resource quote'
    })),
    overrides: [['structure', '12'], ['finishes', '24'], ['mep', '1.2']].map(([line_key, quantity]) => ({
      line_key,
      building: 11,
      quantity,
      reason: 'Villa 11 variant · 20% more work'
    }))
  };
}
export function installEstimateExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(ESTIMATE_EXAMPLES)) return;
  transaction(db, () => {
    for (const [id, name, role] of [['example-estimator', 'Rami · example estimator', 'estimator'], ['example-estimate-reviewer', 'Aisha · example tender reviewer', 'tendering_manager']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, name, role);
      for (const c of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,estimate_approval_limit) VALUES(?,?,'*',?,?)").run(id, c, role, role === 'tendering_manager' ? '1000000' : '0');
    }
    const date = new Date().toISOString().slice(0, 10),
      today = () => date,
      maker = estimates(db, 'example-estimator', today),
      reviewer = estimates(db, 'example-estimate-reviewer', today),
      local = estimates(db, 'ahmed', today);
    const act = (s, r, action, reason = 'Fictional independent review of quantities and pricing') => s.decide(r.id, {
      version: r.version,
      action,
      reason
    });
    for (const c of db.prepare('SELECT * FROM companies').all()) {
      const customer = masters(db, 'ahmed', today).saveParty(null, {
        company_id: c.id,
        name: `Example · ${c.name} development client`,
        customer: true,
        supplier: false,
        subcontractor: false,
        reference: 'DEMO-EST-CLIENT',
        reason: 'Fictional customer for estimating examples'
      });
      const base = sampleEstimate(c, customer.party_id, date);
      let ready = maker.save(null, {
        ...base,
        title: 'Example · Approved estimate ready for project setup',
        tender_reference: 'DEMO-SETUP-' + c.id
      });
      ready = act(reviewer, act(maker, ready, 'submit'), 'approve');
      for (const p of db.prepare('SELECT * FROM projects WHERE company_id=?').all(c.id)) {
        let approved = maker.save(null, {
          ...base,
          project_id: p.id,
          title: 'Example · Reviewed villa estimate · ' + p.name,
          tender_reference: 'DEMO-REVIEW-' + p.code
        });
        approved = act(reviewer, act(maker, approved, 'submit'), 'approve');
        let rev = maker.revise(approved.id, {
          version: approved.version,
          reason: 'Example resource price change; original approved version remains locked'
        });
        rev = maker.save(rev.id, {
          ...rev,
          resources: rev.resources.map(r => r.kind === 'material' ? {
            ...r,
            unit_rate: '42'
          } : r),
          reason: 'Fictional material quote increased from 40 to 42'
        });
        act(maker, rev, 'submit');
        let draft = local.save(null, {
          ...base,
          project_id: p.id,
          title: 'Example · Estimate to finish · ' + p.name,
          tender_reference: 'DEMO-DRAFT-' + p.code,
          overrides: [...base.overrides, {
            line_key: 'finishes',
            building: 10,
            quantity: '0',
            reason: 'Villa 10 excludes this finish'
          }]
        });
        act(reviewer, act(local, draft, 'submit'), 'return', 'Clarify excluded finishes and supplier rate evidence before approval.');
        // Foreign resource demonstrates quote currency without changing the tender currency.
        local.save(null, {
          ...base,
          project_id: p.id,
          title: 'Example · Foreign resource quote · ' + p.name,
          tender_reference: 'DEMO-FX-' + p.code,
          resources: base.resources.map(r => r.kind === 'plant' ? {
            ...r,
            currency: c.currency === 'AED' ? 'USD' : 'EUR',
            unit_rate: '2.5',
            rate: c.currency === 'AED' ? '3.6725' : '1.08',
            rate_source: 'Fictional supplier quote and explicit resource FX'
          } : r)
        });
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(ESTIMATE_EXAMPLES, new Date().toISOString());
  });
}
