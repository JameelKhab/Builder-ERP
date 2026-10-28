import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, CheckCircle } from '@phosphor-icons/react';
import { api } from './api.js';
import { ErrorBox, Empty } from './components.jsx';
import './masters.css';
const F = ({
  label,
  value,
  onChange,
  children,
  type = 'text',
  required = true,
  ...rest
}) => <label className="field">{label}{children ? <select value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} {...rest}>{children}</select> : type === 'textarea' ? <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} {...rest} /> : <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} onInput={type === 'date' ? e => onChange(e.currentTarget.value) : undefined} required={required} {...rest} />}</label>;
const Options = ({
  rows
}) => <><option value="">Choose…</option>{rows.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</>;
const History = ({
  rows = []
}) => rows.length > 0 && <details className="foundation-history"><summary>History & accountability · {rows.length} events</summary>{rows.map(e => <div key={e.id}><strong>{e.action} · {e.actor}</strong><small>{new Date(e.at).toLocaleString()} · Version {e.version}</small><p>{e.reason}</p><details><summary>Recorded changes</summary><pre>{JSON.stringify({
          before: e.before_json ? JSON.parse(e.before_json) : null,
          after: JSON.parse(e.after_json)
        }, null, 2)}</pre></details></div>)}</details>;
const roles = p => [p.supplier && 'Supplier', p.customer && 'Customer', p.subcontractor && 'Subcontractor'].filter(Boolean).join(' · ');
const today = () => new Date().toISOString().slice(0, 10);
const termsText = t => t ? `${t.preferred_currency} preferred · ${t.payment_days === null ? 'Payment days not recorded' : t.payment_days === 0 ? 'Due on invoice' : t.payment_days + ' days after invoice'}` : 'Terms need independent approval';
function status(p) {
  if (!p.active) return 'Archived';
  if (p.blocked) return 'Purchasing blocked';
  if ((p.supplier || p.subcontractor) && !p.current_terms_id) return 'Needs terms';
  if (p.terms && (p.terms.effective_from > today() || p.terms.effective_until && p.terms.effective_until < today())) return 'Terms expired';
  return 'Active';
}
export function Masters({
  company,
  preview = false,
  initialRecord = null,
  onChanged
}) {
  const [data, setData] = useState(null),
    [page, setPage] = useState('contacts'),
    [selected, setSelected] = useState(null),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [search, setSearch] = useState('');
  const head = useRef(null),
    serial = useRef(0);
  const load = () => api(`/masters?company=${company.id}`).then(d => {
    setData(d);
    return d;
  });
  useEffect(() => {
    const c = new AbortController();
    api(`/masters?company=${company.id}`, undefined, 'GET', c.signal).then(setData).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => {
      c.abort();
      serial.current++;
    };
  }, [company.id]);
  useEffect(() => {
    if (initialRecord) {
      const [type, id] = initialRecord.split(':');
      setPage(type === 'party' ? 'contacts' : 'products');
      open(type, id);
    }
  }, [initialRecord]);
  useEffect(() => {
    head.current?.focus({
      preventScroll: true
    });
    head.current?.scrollIntoView({
      block: 'start',
      behavior: 'instant'
    });
  }, [selected?.party_id, selected?.id, form?.mode, page]);
  async function open(type, id) {
    const n = ++serial.current;
    setBusy(true);
    setError('');
    try {
      const r = await api(type === 'party' ? `/masters/parties/${id}?company=${company.id}` : `/masters/products/${id}`);
      if (n === serial.current) {
        setSelected(r);
        setForm(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(path, body, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      const result = await api(path, {
        ...body,
        company_id: company.id
      }, method);
      await load();
      setForm(null);
      if (result.party_id || result.code) setSelected(result);else setSelected(null);
      setMessage('Saved locally. History has been retained.');
      onChanged?.();
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(mode, values = {}) {
    setMessage('');
    setError('');
    setForm({
      mode,
      ...values,
      reason: ''
    });
  }
  const put = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  function back() {
    serial.current++;
    setSelected(null);
    setForm(null);
    setError('');
    setMessage('');
  }
  if (!data) return <>{error ? <ErrorBox message={error} /> : <p>Loading company contacts and catalogue…</p>}</>;
  const editing = data.can_write && !preview,
    reviewing = data.can_review && !preview;
  function formBody() {
    const f = form,
      buttons = <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : f.mode === 'terms' ? 'Send terms for review' : f.mode === 'review' ? f.decision === 'approved' ? 'Approve these terms' : 'Return for changes' : 'Save locally'}</button></div>;
    let fields, submit, title;
    if (f.mode === 'contact') {
      title = f.party_id ? 'Edit company contact' : 'Add a company contact';
      submit = () => save(`/masters/parties${f.party_id ? '/' + f.party_id : ''}`, f, f.party_id ? 'PUT' : 'POST');
      fields = <><div className="master-grid">{!f.party_id && data.shared_identities.length > 0 && <F label="Start from an existing shared identity (optional)" value={f.existing_party_id} required={false} onChange={v => setForm(x => ({
            ...x,
            existing_party_id: v,
            name: data.shared_identities.find(p => p.id === v)?.name || ''
          }))}><option value="">Create a new identity</option>{data.shared_identities.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</F>}<F label="Legal or personal name" value={f.name} disabled={!!f.existing_party_id || f.party_id && !selected.can_rename} onChange={v => put('name', v)} maxLength={200} /><F label="Company reference (optional)" value={f.reference} required={false} onChange={v => put('reference', v)} maxLength={100} /><F label="Business email (optional)" type="email" value={f.email} required={false} onChange={v => put('email', v)} /><F label="Business phone (optional)" value={f.phone} required={false} onChange={v => put('phone', v)} /><F label="Country (optional)" value={f.country} required={false} onChange={v => put('country', v)} /></div><fieldset className="master-checks"><legend>Relationship with {company.name}</legend>{['supplier', 'customer', 'subcontractor'].map(k => <label key={k}><input type="checkbox" checked={!!f[k]} onChange={e => put(k, e.target.checked)} />{k[0].toUpperCase() + k.slice(1)}</label>)}</fieldset><F label="Company contact address (optional)" type="textarea" value={f.address} required={false} onChange={v => put('address', v)} maxLength={600} />{f.party_id && <label className="master-check"><input type="checkbox" checked={!!f.active} onChange={e => put('active', e.target.checked)} />Active contact · clear to archive, with history retained</label>}<p className="muted">One identity may be both a supplier and a customer. Contact details and terms here belong to {company.name}.</p></>;
    } else if (f.mode === 'terms') {
      title = 'Propose supplier terms';
      submit = () => save(`/masters/parties/${selected.party_id}/terms`, {
        ...f,
        version: selected.version,
        payment_days: Number(f.payment_days)
      });
      fields = <><p className="muted">Another authorised person must approve this proposal. Existing terms stay in use until then.</p><fieldset className="master-checks"><legend>Permitted purchase currencies</legend>{['AED', 'EUR', 'USD'].map(c => <label key={c}><input type="checkbox" checked={f.currencies.includes(c)} onChange={e => {
              const cs = e.target.checked ? [...f.currencies, c] : f.currencies.filter(x => x !== c);
              setForm(x => ({
                ...x,
                currencies: cs,
                preferred_currency: cs.includes(x.preferred_currency) ? x.preferred_currency : cs[0] || ''
              }));
            }} />{c}</label>)}</fieldset><div className="master-grid"><F label="Preferred purchase currency" value={f.preferred_currency} onChange={v => put('preferred_currency', v)}><Options rows={f.currencies.map(c => ({
              id: c,
              name: c
            }))} /></F><F label="Payment days after invoice" value={f.payment_days} type="number" min="0" max="365" onChange={v => put('payment_days', v)} /><F label="Effective from" type="date" value={f.effective_from} onChange={v => put('effective_from', v)} /><F label="Effective until (optional)" type="date" required={false} value={f.effective_until} onChange={v => put('effective_until', v)} /></div><p className="muted">Currency comes from the approved supplier agreement. Country does not choose it. Approving these terms also lifts any purchasing block.</p></>;
    } else if (f.mode === 'review') {
      title = f.decision === 'approved' ? 'Review and approve terms' : 'Return terms for changes';
      submit = () => save(`/masters/terms/${f.term.id}/decision`, {
        ...f,
        version: selected.version
      });
      fields = <div className="master-review"><strong>{selected.name} · {company.name}</strong><p><small>Current: {termsText(selected.terms)}</small></p><p><strong>Proposed: {termsText(f.term)}</strong></p><p>Permitted currencies: {f.term.currencies.join(', ')}</p><p>Effective {f.term.effective_from} to {f.term.effective_until || 'open ended'}</p><p>Prepared by {f.term.author} · {f.term.reason}</p>{!!selected.blocked && <p>Approval will unblock new purchasing.</p>}</div>;
    } else if (f.mode === 'block') {
      title = 'Block new purchasing';
      submit = () => save(`/masters/parties/${selected.party_id}/block`, {
        version: selected.version,
        reason: f.reason
      });
      fields = <p>New quotations, sourcing approvals and orders for {selected.name} will stop. Existing orders and deliveries keep their history. Independently approved terms are required to lift the block.</p>;
    } else if (f.mode === 'product') {
      title = f.id ? 'Edit catalogue item' : 'Add catalogue item';
      submit = () => save(`/masters/products${f.id ? '/' + f.id : ''}`, {
        ...f,
        precision: Number(f.precision)
      }, f.id ? 'PUT' : 'POST');
      fields = <><div className="master-grid"><F label="Item code" value={f.code} disabled={!!f.id} onChange={v => put('code', v)} maxLength={40} /><F label="Item name" value={f.name} onChange={v => put('name', v)} /><F label="Type" value={f.kind} disabled={!!f.id} onChange={v => put('kind', v)}><option value="material">Material · can enter site stock</option><option value="service">Service · no stock receipt</option></F><F label="Category" value={f.category_id} onChange={v => put('category_id', v)}><Options rows={data.categories.filter(c => c.active || c.id === f.category_id)} /></F><F label="Base unit" value={f.uom} disabled={!!f.id} onChange={v => setForm(x => ({
            ...x,
            uom: v,
            precision: data.units.find(u => u.id === v)?.precision ?? 0
          }))}><Options rows={data.units} /></F><F label="Quantity decimal places" value={f.precision} type="number" min="0" max={data.units.find(u => u.id === f.uom)?.precision ?? 6} disabled={!!f.id} onChange={v => put('precision', v)} /></div><F label="Specification / description (optional)" type="textarea" value={f.description} required={false} onChange={v => put('description', v)} />{f.id && <label className="master-check"><input type="checkbox" checked={!!f.active} onChange={e => put('active', e.target.checked)} />Active for new use</label>}<p className="muted">Code, type, base unit and precision are fixed after creation. Define pack quantities separately; the item name never sets a conversion.</p></>;
    } else if (f.mode === 'pack') {
      title = 'Define a purchase pack';
      submit = () => save(`/masters/products/${selected.id}/packs`, {
        ...f,
        version: selected.version
      });
      fields = <div className="master-grid"><F label="Pack name" value={f.name} onChange={v => put('name', v)} placeholder="e.g. Pallet of 100 blocks" /><F label={`Base quantity · ${selected.uom} per pack`} value={f.base_quantity} onChange={v => put('base_quantity', v)} inputMode="decimal" /><F label="Pack reference (optional)" value={f.supplier_code} required={false} onChange={v => put('supplier_code', v)} /></div>;
    } else if (f.mode === 'pack-status') {
      title = f.active ? 'Restore purchase pack' : 'Retire purchase pack';
      submit = () => save(`/masters/packs/${f.id}`, f, 'PUT');
      fields = <p>Frozen quote conversions remain unchanged. This changes whether the pack can be selected for a new quote.</p>;
    } else {
      title = f.id ? 'Edit product category' : 'Add product category';
      submit = () => save(`/masters/categories${f.id ? '/' + f.id : ''}`, f, f.id ? 'PUT' : 'POST');
      fields = <><F label="Category name" value={f.name} onChange={v => put('name', v)} />{f.id && <label className="master-check"><input type="checkbox" checked={!!f.active} onChange={e => put('active', e.target.checked)} />Available for new items</label>}</>;
    }
    return <form className="master-form" onSubmit={e => {
      e.preventDefault();
      submit();
    }}><h2 ref={head} tabIndex={-1}>{title}</h2>{fields}<F label={f.mode === 'terms' ? 'Agreement reference and reason' : 'Reason / supporting reference'} value={f.reason} onChange={v => put('reason', v)} type="textarea" maxLength={500} />{buttons}</form>;
  }
  const contactDetail = selected?.party_id && <><div className="section-head"><div><p className="eyebrow">{roles(selected)}</p><h2 ref={head} tabIndex={-1}>{selected.name}</h2><p className="muted">{selected.reference || selected.party_id}</p></div><span className="proc-state">{status(selected)}</span></div><div className="master-grid master-info"><div><small>Contact for this company</small><p>{selected.email || 'No email recorded'}<br />{selected.phone || 'No phone recorded'}</p></div><div><small>Address</small><p className="master-address">{selected.address || 'No address recorded'}<br />{selected.country}</p></div></div>{!!(selected.supplier || selected.subcontractor) && <section className="master-current"><h3>Current purchasing terms</h3>{selected.terms ? <><strong>{termsText(selected.terms)}</strong><p>Permitted: {selected.terms.currencies.join(', ')} · Effective {selected.terms.effective_from} to {selected.terms.effective_until || 'open ended'}</p><small>{selected.terms.provenance === 'opening' ? 'Existing local preference · no historic approval recorded' : `Approved terms ${selected.terms.id}`}</small></> : <p>{selected.current_terms_id ? 'Commercial details are restricted for your role.' : 'No approved terms. Purchasing is unavailable until independent approval.'}</p>}</section>}<div className="master-actions">{editing && <><button className="secondary" onClick={() => edit('contact', selected)}>Edit contact</button>{!!(selected.supplier || selected.subcontractor) && <><button className="primary" disabled={selected.proposals?.some(t => t.provenance === 'proposal' && !t.decision)} onClick={() => edit('terms', {
            currencies: selected.terms?.currencies || [company.currency],
            preferred_currency: selected.terms?.preferred_currency || company.currency,
            payment_days: selected.terms?.payment_days ?? '',
            effective_from: today(),
            effective_until: ''
          })}>Propose terms</button>{!selected.blocked && <button className="secondary" onClick={() => edit('block')}>Block purchasing</button>}</>}</>}</div>{selected.proposals?.filter(t => t.provenance === 'proposal' && !t.decision).map(t => <section className="master-review" key={t.id}><h3>Terms awaiting review</h3><p>{termsText(t)} · {t.currencies.join(', ')}</p><p>{t.reason}</p><small>{t.author} · Prepared {new Date(t.created_at).toLocaleDateString()}</small>{t.stale && <p className="error">The contact changed. Return this proposal for a fresh review.</p>}{reviewing && t.can_decide ? <div className="master-actions"><button className="primary" disabled={t.stale} onClick={() => edit('review', {
          term: t,
          decision: 'approved'
        })}>Review terms</button><button className="secondary" onClick={() => edit('review', {
          term: t,
          decision: 'returned'
        })}>Return proposal</button></div> : <p className="muted">An independent company reviewer must decide.</p>}</section>)}{selected.proposals?.some(t => t.decision) && <details className="foundation-history"><summary>Previous terms decisions</summary>{selected.proposals.filter(t => t.decision).map(t => <div key={t.id}><strong>{t.decision} · {termsText(t)}</strong><p>{t.decision_reason}</p><small>{t.reviewer} · {t.decided_at}</small></div>)}</details>}<History rows={selected.history} /></>;
  const productDetail = selected?.code && <><div className="section-head"><div><p className="eyebrow">{selected.code} · {selected.kind}</p><h2 ref={head} tabIndex={-1}>{selected.name}</h2><p className="muted">Base unit: {selected.uom} · Up to {selected.precision} decimal places</p></div><span className="proc-state">{selected.active ? 'Active' : 'Archived'}</span></div><p>{selected.description || 'No additional specification recorded.'}</p>{editing && <div className="master-actions"><button className="secondary" onClick={() => edit('product', selected)}>Edit item</button><button className="primary" onClick={() => edit('pack')}>Define purchase pack</button></div>}<h3 className="spaced">Purchase packs</h3><p className="muted">Requests and stock use {selected.uom}. Quotations can use these explicit pack conversions.</p>{selected.packs.length ? selected.packs.map(p => <div className="master-pack" key={p.id}><div><strong>{p.name}</strong><p>1 pack = {p.base_quantity} {selected.uom}{p.supplier_code ? ` · Pack reference ${p.supplier_code}` : ''}</p><small>{p.active ? 'Available' : 'Retired'} · Factor is fixed</small></div>{editing && <button className="text-button" onClick={() => edit('pack-status', {
        ...p,
        active: !p.active
      })}>{p.active ? 'Retire' : 'Restore'}</button>}</div>) : <Empty>No extra packs defined. Quotes use the base unit.</Empty>}<History rows={selected.history} /></>;
  return <div className="masters"><p className="eyebrow">SHARED INFORMATION · {company.name}</p>{(selected || form) && <button className="back" onClick={back}><ArrowLeft size={18} />Back to {page === 'contacts' ? 'contacts' : 'catalogue'}</button>}{error && <ErrorBox message={error} />}{message && <p role="status" className="success"><CheckCircle size={20} />{message}</p>}{form ? formBody() : selected ? selected.party_id ? contactDetail : productDetail : <><div className="section-head"><div><h1 ref={head} tabIndex={-1}>Contacts & catalogue</h1><p className="muted">Maintain each fact once. Use it across the company’s projects.</p></div></div><details className="master-summary"><summary>Company findings</summary><ul>{data.findings.map(f => <li key={f}>{f}</li>)}</ul></details><div className="foundation-nav" aria-label="Master information categories">{[['contacts', 'Contacts & suppliers'], ['products', 'Materials & services'], ['definitions', 'Categories & units']].map(([id, label]) => <button className={page === id ? 'active' : ''} aria-pressed={page === id} key={id} onClick={() => {
          setPage(id);
          setSearch('');
        }}>{label}</button>)}</div>{page !== 'definitions' && <div className="master-toolbar"><F label={page === 'contacts' ? 'Find a contact' : 'Find an item'} value={search} onChange={setSearch} required={false} type="search" />{editing && <button className="primary" onClick={() => page === 'contacts' ? edit('contact', {
          supplier: true,
          customer: false,
          subcontractor: false,
          active: true
        }) : edit('product', {
          kind: 'material',
          uom: 'unit',
          precision: 0,
          active: true
        })}><Plus size={18} />{page === 'contacts' ? 'Add contact' : 'Add item'}</button>}</div>}{page === 'contacts' && <div className="master-list">{data.contacts.filter(p => [p.name, p.reference, roles(p)].join(' ').toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.party_id} className="master-row" disabled={busy} onClick={() => open('party', p.party_id)}><span><strong>{p.name}</strong><small>{roles(p)}{p.terms ? ` · ${p.terms.preferred_currency} preferred` : ''}</small></span><span className="proc-state">{status(p)}</span><ArrowRight size={20} /></button>)}</div>}{page === 'products' && <div className="master-list">{data.products.filter(p => [p.name, p.code, p.category].join(' ').toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} className="master-row" disabled={busy} onClick={() => open('product', p.id)}><span><strong>{p.name}</strong><small>{p.code} · {p.category} · {p.kind}</small></span><span>{p.uom}{!p.active ? ' · Archived' : ''}</span><ArrowRight size={20} /></button>)}</div>}{page === 'definitions' && <><div className="section-head"><h2>Product categories</h2>{editing && <button className="secondary" onClick={() => edit('category')}>Add category</button>}</div>{data.categories.map(c => <div className="master-pack" key={c.id}><span>{c.name}{!c.active ? ' · Archived' : ''}</span>{editing && <button className="text-button" onClick={() => edit('category', c)}>Edit category</button>}</div>)}<h2 className="spaced">Base units</h2><p className="muted">Choose an explicit unit when creating an item. Pack conversions belong to their product.</p><div className="master-units">{data.units.map(u => <div key={u.id}><strong>{u.name}</strong><small>{u.dimension} · Up to {u.precision} decimals</small></div>)}</div></>}{page !== 'definitions' && !(page === 'contacts' ? data.contacts : data.products).some(p => [p.name, p.reference, p.code, p.category, page === 'contacts' ? roles(p) : ''].join(' ').toLowerCase().includes(search.toLowerCase())) && <Empty>No matches. Try another name or code.</Empty>}<details className="master-examples"><summary>Examples to try</summary><p>Open an example supplier to compare current terms with a proposal awaiting review. In Materials & services, open Concrete block 200 mm to see a pallet of 100 units. Site requests use units; a supplier can quote by the pallet.</p><p>Changing a contact name or retiring a pack preserves the details already recorded on orders. Each company maintains its own terms.</p></details></>}</div>;
}
