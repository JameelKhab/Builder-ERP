import { randomUUID } from 'node:crypto';
import { policy } from './access.mjs';
import { transaction } from './db.mjs';
import { decimal, requireThat } from './money.mjs';
import { quantityFor, usableSupplier } from './master-rules.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const text = (v, label, max = 200, optional = false) => {
  requireThat(typeof v === 'string' && v.length <= max && (optional || v.trim()), `${label} is required (maximum ${max} characters).`);
  return v.trim();
};
const date = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const flag = v => {
  requireThat(typeof v === 'boolean' || v === 0 || v === 1, 'Choose yes or no.');
  return Number(v);
};
export function masters(db, actorId, today = () => new Date().toISOString().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (sql, ...v) => db.prepare(sql).get(...v),
    all = (sql, ...v) => db.prepare(sql).all(...v),
    run = (sql, ...v) => db.prepare(sql).run(...v);
  const read = company => requireThat(access.has('vendors.read', company, null, true), 'Master records are not available.', 404);
  const write = company => {
    read(company);
    access.requireCap('masters.write', company, null);
  };
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This master record changed. Reload and review the current version.', 409);
  const event = (company, type, id, action, revision, reason, before, after) => run('INSERT INTO master_events(company_id,entity_type,entity_id,actor_id,action,version,reason,before_json,after_json,at) VALUES(?,?,?,?,?,?,?,?,?,?)', company, type, id, actorId, action, revision, reason, before ? JSON.stringify(before) : null, JSON.stringify(after), now());
  const relation = (company, id) => {
    read(company);
    const r = get('SELECT pc.*,p.name,p.version party_version FROM party_companies pc JOIN parties p ON p.id=pc.party_id WHERE pc.company_id=? AND pc.party_id=?', company, id);
    requireThat(r, 'Contact is not available.', 404);
    return r;
  };
  const terms = t => t ? {
    ...t,
    currencies: JSON.parse(t.currencies)
  } : null;
  const current = r => terms(get('SELECT * FROM supplier_terms WHERE id=?', r.current_terms_id || ''));
  const history = (company, type, id) => all('SELECT e.*,u.name actor FROM master_events e JOIN users u ON u.id=e.actor_id WHERE company_id=? AND entity_type=? AND entity_id=? ORDER BY e.id', company, type, id);
  function partyDetail(company, id) {
    const r = relation(company, id),
      priced = access.has('pricing.read', company, null, true),
      manage = access.has('masters.write', company, null),
      review = access.has('suppliers.approve', company, null);
    const result = {
      ...r,
      can_edit: manage,
      can_rename: manage && all('SELECT company_id FROM party_companies WHERE party_id=?', id).every(c => access.has('masters.write', c.company_id, null)),
      can_review: review
    };
    // Project-scoped readers see usable operational identity; commercial proposal/history is company-scoped.
    if (priced) result.terms = current(r);
    if (manage || review) {
      result.proposals = all("SELECT t.*,d.decision,d.reason decision_reason,d.at decided_at,u.name author,ru.name reviewer FROM supplier_terms t LEFT JOIN supplier_term_decisions d ON d.terms_id=t.id LEFT JOIN users u ON u.id=t.author_id LEFT JOIN users ru ON ru.id=d.reviewer_id WHERE t.company_id=? AND t.party_id=? ORDER BY t.created_at DESC,t.id", company, id).map(t => ({
        ...terms(t),
        can_decide: review && t.provenance === 'proposal' && !t.decision && t.author_id !== actorId,
        stale: t.base_version !== r.version
      }));
      result.history = history(company, 'party', id);
    }
    return result;
  }
  function saveParty(id, input) {
    return transaction(db, () => {
      const company = input.company_id;
      write(company);
      const before = id ? relation(company, id) : null;
      if (before) version(before, input.version);
      const name = text(input.name, 'Legal or personal name'),
        reason = text(input.reason, 'Reason', 500),
        fields = {
          reference: text(input.reference || '', 'Reference', 100, true),
          supplier: flag(input.supplier),
          customer: flag(input.customer),
          subcontractor: flag(input.subcontractor),
          email: text(input.email || '', 'Email', 200, true),
          phone: text(input.phone || '', 'Phone', 60, true),
          address: text(input.address || '', 'Address', 600, true),
          country: text(input.country || '', 'Country', 80, true),
          active: flag(input.active ?? true)
        };
      requireThat(fields.supplier || fields.customer || fields.subcontractor, 'Choose at least one contact role.');
      requireThat(!fields.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email), 'Enter a valid business email.');
      if (!before) {
        if (input.existing_party_id) {
          const linked = all('SELECT company_id FROM party_companies WHERE party_id=?', input.existing_party_id);
          requireThat(linked.some(c => access.has('masters.write', c.company_id, null)), 'Shared identity is not available.', 404);
          requireThat(!linked.some(c => c.company_id === company), 'This contact is already linked to this company.', 409);
          id = input.existing_party_id;
          requireThat(get('SELECT name FROM parties WHERE id=?', id)?.name === name, 'Use the existing legal identity name when linking.', 409);
        } else {
          id = uid('PARTY');
          run('INSERT INTO parties(id,name) VALUES(?,?)', id, name);
        }
        // Compatibility identity only: deliberately unusable as a legacy quotation.
        run('INSERT INTO vendors(id,company_id,name,currency,unit_price,rate,rate_date,valid_until,quote) VALUES(?,?,?,?,?,?,?,?,?)', id, company, name, get('SELECT currency FROM companies WHERE id=?', company).currency, '0', '1', '1900-01-01', '1900-01-01', 'No legacy quotation; use product-specific quotations');
        run('INSERT INTO party_companies(party_id,company_id,vendor_id,reference,supplier,customer,subcontractor,email,phone,address,country,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, company, id, ...Object.values(fields));
      } else {
        version({
          version: before.party_version
        }, input.party_version);
        if (name !== before.name) {
          const linked = all('SELECT company_id,vendor_id,version FROM party_companies WHERE party_id=?', id);
          requireThat(linked.every(c => access.has('masters.write', c.company_id, null)), 'Changing shared identity requires master authority in every linked company.', 403);
          run('UPDATE parties SET name=?,version=version+1 WHERE id=?', name, id);
          for (const c of linked) {
            run('UPDATE vendors SET name=? WHERE id=? AND company_id=?', name, c.vendor_id, c.company_id);
            if (c.company_id !== company) run('UPDATE party_companies SET version=version+1 WHERE party_id=? AND company_id=?', id, c.company_id);
            if (c.company_id !== company) event(c.company_id, 'party', id, 'shared identity renamed', c.version + 1, reason, {
              name: before.name
            }, {
              name
            });
          }
        }
        run('UPDATE party_companies SET reference=?,supplier=?,customer=?,subcontractor=?,email=?,phone=?,address=?,country=?,active=?,version=version+1 WHERE party_id=? AND company_id=?', ...Object.values(fields), id, company);
      }
      const after = relation(company, id);
      event(company, 'party', id, before ? 'contact revised' : 'contact created', after.version, reason, before, after);
      return partyDetail(company, id);
    });
  }
  function proposeTerms(id, input) {
    return transaction(db, () => {
      const company = input.company_id;
      write(company);
      const r = relation(company, id);
      version(r, input.version);
      requireThat(r.active && (r.supplier || r.subcontractor), 'Active supplier or subcontractor role is required.');
      requireThat(!get("SELECT t.id FROM supplier_terms t LEFT JOIN supplier_term_decisions d ON d.terms_id=t.id WHERE t.company_id=? AND t.party_id=? AND t.provenance='proposal' AND d.id IS NULL", company, id), 'Review or return the existing terms proposal first.', 409);
      const currencies = input.currencies;
      requireThat(Array.isArray(currencies) && currencies.length > 0 && currencies.length <= 3 && new Set(currencies).size === currencies.length && currencies.every(c => ['AED', 'EUR', 'USD'].includes(c)), 'Choose permitted currencies from AED, EUR and USD.');
      requireThat(currencies.includes(input.preferred_currency), 'The preferred currency must be permitted.');
      requireThat(Number.isInteger(input.payment_days) && input.payment_days >= 0 && input.payment_days <= 365, 'Payment days must be 0–365 whole days after invoice.');
      const start = date(input.effective_from),
        end = input.effective_until ? date(input.effective_until) : null;
      requireThat(!end || end >= start, 'The end date must follow the start date.');
      const termId = uid('TERM'),
        reason = text(input.reason, 'Reason and source', 800);
      run('INSERT INTO supplier_terms VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', termId, id, company, input.preferred_currency, JSON.stringify(currencies), input.payment_days, start, end, actorId, r.version, reason, now(), 'proposal');
      event(company, 'party', id, 'terms proposed', r.version, reason, null, {
        terms_id: termId
      });
      return partyDetail(company, id);
    });
  }
  function decideTerms(termId, input) {
    return transaction(db, () => {
      const company = input.company_id;
      read(company);
      access.requireCap('suppliers.approve', company, null);
      const t = get('SELECT * FROM supplier_terms WHERE id=? AND company_id=?', termId, company);
      requireThat(t, 'Terms are not available.', 404);
      requireThat(t.provenance === 'proposal' && !get('SELECT id FROM supplier_term_decisions WHERE terms_id=?', termId), 'This proposal is already resolved.', 409);
      requireThat(t.author_id !== actorId, 'An independent reviewer must decide these terms.', 403);
      const r = relation(company, t.party_id);
      version(r, input.version);
      requireThat(['approved', 'returned'].includes(input.decision), 'Choose approve or return.');
      const reason = text(input.reason, 'Review reason', 800);
      if (input.decision === 'approved') {
        requireThat(r.active && (r.supplier || r.subcontractor), 'An active supplier relationship is required.');
        requireThat(r.version === t.base_version, 'The contact changed after this proposal. Return it and prepare current terms.', 409);
        requireThat(t.effective_from <= today() && (!t.effective_until || t.effective_until >= today()), 'These terms are not effective today.');
        run('UPDATE party_companies SET current_terms_id=?,blocked=0,version=version+1 WHERE party_id=? AND company_id=?', t.id, t.party_id, company);
      }
      run('INSERT INTO supplier_term_decisions VALUES(?,?,?,?,?,?)', uid('TD'), termId, input.decision, actorId, reason, now());
      event(company, 'party', t.party_id, `terms ${input.decision}`, input.decision === 'approved' ? r.version + 1 : r.version, reason, {
        terms_id: r.current_terms_id
      }, {
        terms_id: t.id,
        decision: input.decision
      });
      return partyDetail(company, t.party_id);
    });
  }
  function blockSupplier(id, input) {
    return transaction(db, () => {
      write(input.company_id);
      const r = relation(input.company_id, id);
      version(r, input.version);
      requireThat(!r.blocked, 'Purchasing is already blocked.', 409);
      const reason = text(input.reason, 'Block reason', 500);
      run('UPDATE party_companies SET blocked=1,version=version+1 WHERE party_id=? AND company_id=?', id, input.company_id);
      event(input.company_id, 'party', id, 'purchasing blocked', r.version + 1, reason, {
        blocked: 0
      }, {
        blocked: 1
      });
      return partyDetail(input.company_id, id);
    });
  }
  function productDetail(id) {
    const p = get('SELECT * FROM products WHERE id=?', id);
    requireThat(p && access.has('vendors.read', p.company_id, null, true), 'Product is not available.', 404);
    return {
      ...p,
      packs: all('SELECT * FROM product_packs WHERE product_id=? ORDER BY name', id),
      can_edit: access.has('masters.write', p.company_id, null),
      history: access.has('masters.write', p.company_id, null) ? history(p.company_id, 'product', id) : []
    };
  }
  function saveProduct(id, input) {
    return transaction(db, () => {
      write(input.company_id);
      const old = id ? productDetail(id) : null;
      requireThat(!old || old.company_id === input.company_id, 'Product is not available.', 404);
      if (old) version(old, input.version);
      const name = text(input.name, 'Product name'),
        description = text(input.description || '', 'Description', 1000, true),
        reason = text(input.reason, 'Reason', 500),
        active = flag(input.active ?? true),
        cat = get('SELECT * FROM product_categories WHERE id=? AND company_id=?', input.category_id, input.company_id);
      requireThat(cat && (cat.active || old?.category_id === cat.id), 'Choose an active category in this company.');
      if (old) {
        requireThat(input.code === old.code && input.kind === old.kind && input.uom === old.uom && input.precision === old.precision, 'Code, type, base unit and precision are fixed. Create a new item for a different definition.');
        run('UPDATE products SET name=?,category_id=?,description=?,active=?,version=version+1 WHERE id=?', name, cat.id, description, active, id);
      } else {
        const code = text(input.code, 'Item code', 40).toUpperCase();
        requireThat(/^[A-Z0-9._-]+$/.test(code), 'Use letters, numbers, dots, dashes or underscores in the code.');
        requireThat(!get('SELECT id FROM products WHERE code=? AND company_id=?', code, input.company_id), 'This product code already exists.', 409);
        requireThat(['material', 'service'].includes(input.kind), 'Choose material or service.');
        const unit = get('SELECT * FROM catalogue_units WHERE id=?', input.uom);
        requireThat(unit, 'Choose a recognised base unit.');
        requireThat(Number.isInteger(input.precision) && input.precision >= 0 && input.precision <= unit.precision, 'Quantity precision exceeds the unit policy.');
        id = uid('ITEM');
        run('INSERT INTO products(id,company_id,code,name,uom,active,kind,precision,category_id,description) VALUES(?,?,?,?,?,?,?,?,?,?)', id, input.company_id, code, name, unit.id, active, input.kind, input.precision, cat.id, description);
      }
      const after = get('SELECT * FROM products WHERE id=?', id);
      event(input.company_id, 'product', id, old ? 'item revised' : 'item created', after.version, reason, old ? Object.fromEntries(Object.entries(old).filter(([k]) => !['history', 'can_edit', 'packs'].includes(k))) : null, after);
      return productDetail(id);
    });
  }
  function saveCategory(id, input) {
    return transaction(db, () => {
      write(input.company_id);
      const name = text(input.name, 'Category name', 100),
        reason = text(input.reason, 'Reason', 500),
        old = id ? get('SELECT * FROM product_categories WHERE id=? AND company_id=?', id, input.company_id) : null;
      requireThat(!id || old, 'Category is not available.', 404);
      if (old) version(old, input.version);
      requireThat(!get('SELECT id FROM product_categories WHERE company_id=? AND name=? AND id<>?', input.company_id, name, id || ''), 'This category already exists.', 409);
      if (old) run('UPDATE product_categories SET name=?,active=?,version=version+1 WHERE id=?', name, flag(input.active), id);else {
        id = uid('CAT');
        run('INSERT INTO product_categories(id,company_id,name) VALUES(?,?,?)', id, input.company_id, name);
      }
      const after = get('SELECT * FROM product_categories WHERE id=?', id);
      event(input.company_id, 'category', id, old ? 'category revised' : 'category created', after.version, reason, old, after);
      return after;
    });
  }
  function addPack(id, input) {
    return transaction(db, () => {
      const p = productDetail(id);
      write(p.company_id);
      version(p, input.version);
      const name = text(input.name, 'Pack name', 100),
        factor = quantityFor(input.base_quantity, p.precision, 'Base quantity'),
        code = text(input.supplier_code || '', 'Pack reference', 100, true),
        reason = text(input.reason, 'Source and reason', 500);
      requireThat(!get('SELECT id FROM product_packs WHERE product_id=? AND name=?', id, name), 'This pack name already exists.', 409);
      const pack = {
        id: uid('PACK'),
        product_id: id,
        name,
        base_quantity: factor.toString(),
        supplier_code: code
      };
      run('INSERT INTO product_packs(id,product_id,name,base_quantity,supplier_code) VALUES(?,?,?,?,?)', ...Object.values(pack));
      run('UPDATE products SET version=version+1 WHERE id=?', id);
      event(p.company_id, 'product', id, 'pack defined', p.version + 1, reason, null, pack);
      return productDetail(id);
    });
  }
  function retirePack(id, input) {
    return transaction(db, () => {
      const pack = get('SELECT * FROM product_packs WHERE id=?', id);
      requireThat(pack, 'Pack is not available.', 404);
      const p = productDetail(pack.product_id);
      write(p.company_id);
      version(pack, input.version);
      const active = flag(input.active),
        reason = text(input.reason, 'Reason', 500);
      run('UPDATE product_packs SET active=?,version=version+1 WHERE id=?', active, id);
      run('UPDATE products SET version=version+1 WHERE id=?', p.id);
      event(p.company_id, 'product', p.id, active ? 'pack restored' : 'pack retired', p.version + 1, reason, pack, {
        ...pack,
        active
      });
      return productDetail(p.id);
    });
  }
  function workspace(company) {
    read(company);
    const canWrite = access.has('masters.write', company, null),
      canReview = access.has('suppliers.approve', company, null);
    const contacts = all('SELECT party_id FROM party_companies WHERE company_id=?', company).map(r => {
      const p = partyDetail(company, r.party_id);
      delete p.history;
      return p;
    });
    const products = all('SELECT p.*,c.name category FROM products p LEFT JOIN product_categories c ON c.id=p.category_id WHERE p.company_id=? ORDER BY p.name', company);
    const pending = contacts.flatMap(p => (p.proposals || []).filter(t => t.provenance === 'proposal' && !t.decision).map(t => ({
      id: t.id,
      party_id: p.party_id,
      name: p.name,
      can_decide: t.can_decide,
      stale: t.stale
    })));
    const unavailable = contacts.filter(p => p.supplier || p.subcontractor).filter(p => {
      try {
        usableSupplier(db, company, p.vendor_id, today());
        return false;
      } catch {
        return true;
      }
    });
    return {
      contacts,
      products,
      categories: all('SELECT * FROM product_categories WHERE company_id=? ORDER BY name', company),
      units: all('SELECT * FROM catalogue_units ORDER BY name'),
      can_write: canWrite,
      can_review: canReview,
      pending,
      shared_identities: canWrite ? all('SELECT DISTINCT p.id,p.name FROM parties p JOIN party_companies pc ON pc.party_id=p.id').filter(p => !contacts.some(c => c.party_id === p.id) && all('SELECT company_id FROM party_companies WHERE party_id=?', p.id).some(c => access.has('masters.write', c.company_id, null))) : [],
      findings: [`${contacts.length} contact identities belong to this company. Company terms stay separate.`, `${unavailable.length} supplier relationships cannot be used for new purchases.`, `${pending.length} terms proposals await review within your authority.`, `${products.filter(p => p.active && p.kind === 'material').length} active material items are available for site requests.`]
    };
  }
  return {
    workspace,
    partyDetail,
    saveParty,
    proposeTerms,
    decideTerms,
    blockSupplier,
    productDetail,
    saveProduct,
    saveCategory,
    addPack,
    retirePack
  };
}
