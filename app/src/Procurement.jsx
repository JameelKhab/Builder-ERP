import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Package, CheckCircle } from '@phosphor-icons/react';
import { api, amount, numberText } from './api.js';
import { ErrorBox, Empty } from './components.jsx';
const labels = {
  draft: 'Draft',
  submitted: 'With procurement',
  awaiting_approval: 'Review sourcing',
  approved: 'Ready to order',
  ordered: 'Orders created',
  cancelled: 'Cancelled',
  issued: 'Issued locally'
};
const next = {
  draft: 'Complete the quantities, then submit to procurement.',
  submitted: 'Procurement records supplier quotes and allocates the required quantities.',
  awaiting_approval: 'An independent reviewer checks the supplier plan and released allowance.',
  approved: 'Procurement can create the approved supplier orders.',
  ordered: 'Follow the linked orders through delivery and material use.',
  cancelled: 'Cancelled with its history retained.'
};
const today = () => new Date().toISOString().slice(0, 10);
function Field({
  label,
  children
}) {
  return <label className="field">{label}{children}</label>;
}
function Input({
  label,
  value,
  onChange,
  ...props
}) {
  return <Field label={label}><input value={value} onChange={e => onChange(e.target.value)} onInput={e => onChange(e.currentTarget.value)} required {...props} /></Field>;
}
function Select({
  label,
  value,
  onChange,
  rows,
  ...props
}) {
  return <Field label={label}><select value={value} onChange={e => onChange(e.target.value)} onInput={e => onChange(e.currentTarget.value)} required {...props}><option value="">Select…</option>{rows.map(r => <option value={r.id} key={r.id}>{r.label || r.name}</option>)}</select></Field>;
}
function History({
  rows
}) {
  return <details className="proc-history"><summary>Activity & accountability · {rows.length} events</summary>{rows.map(e => <div key={e.id}><strong>{e.actor} · {e.action.replaceAll('_', ' ')}</strong><small>Revision {e.version} · {new Date(e.at).toLocaleString()}</small><p>{e.note}</p></div>)}</details>;
}
function RecordRows({
  rows,
  onOpen,
  projects,
  orders = false
}) {
  return rows.length ? <div className="proc-records">{rows.map(r => <button className="proc-row" key={r.id} onClick={() => onOpen(orders ? 'order' : 'request', r.id)}><div><small>{r.id} · {projects.find(p => p.id === r.project_id)?.name}</small><h3>{orders ? r.vendor : r.title}</h3><p>{orders ? `${r.lines.length} line(s) · ${r.lines.filter(l => Number(l.outstanding) > 0).length} awaiting delivery` : `${r.lines.length} line(s) · Needed ${r.needed_by} · ${r.requester}`}</p></div><span className={`proc-state ${r.state}`}>{labels[r.state]}</span><ArrowRight size={20} /></button>)}</div> : <Empty>No records in this scope. New requests start with the quantities your site needs.</Empty>;
}
export function Procurement({
  company,
  project,
  projects,
  preview = false,
  initialTab = 'requests',
  initialRecord = null
}) {
  const [data, setData] = useState(null),
    [tab, setTab] = useState(initialTab),
    [selected, setSelected] = useState(null),
    [mode, setMode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState('');
  const serial = useRef(0),
    heading = useRef(null);
  const url = `/procurement?company=${company.id}&project=${project?.id || ''}`;
  async function load() {
    const d = await api(url);
    setData(d);
    return d;
  }
  useEffect(() => {
    const controller = new AbortController();
    api(url, undefined, 'GET', controller.signal).then(setData).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => controller.abort();
  }, [url]);
  useEffect(() => {
    if (initialRecord) open(initialRecord.startsWith('MR-') ? 'request' : 'order', initialRecord);
  }, [initialRecord]);
  useEffect(() => {
    heading.current?.focus();
  }, [selected?.record.id, mode]);
  async function open(type, id) {
    const n = ++serial.current;
    setError('');
    setBusy(true);
    setMode('');
    try {
      const record = await api(`/${type === 'request' ? 'material-requests' : 'purchase-orders'}/${id}`);
      if (n === serial.current) setSelected({
        type,
        record
      });
    } catch (e) {
      if (n === serial.current) setError(e.message);
    } finally {
      if (n === serial.current) setBusy(false);
    }
  }
  async function act(path, body, method = 'POST', kind = selected?.type || 'request') {
    setBusy(true);
    setError('');
    try {
      const result = await api(path, body, method);
      setMode('');
      if (Array.isArray(result)) setSelected({
        type: 'request',
        record: await api(`/material-requests/${selected.record.id}`)
      });else setSelected({
        type: kind,
        record: result
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function back() {
    serial.current++;
    setSelected(null);
    setMode('');
    setError('');
    setBusy(false);
  }
  const writable = cap => !preview && data?.capabilities.includes(cap);
  const r = selected?.record;
  const filtered = (tab === 'orders' ? data?.orders : data?.requests)?.filter(r => `${r.id} ${r.title || ''} ${r.vendor || ''} ${labels[r.state]}`.toLowerCase().includes(filter.toLowerCase())) || [];
  return <section className="procurement" aria-busy={busy}>
 {selected || mode === 'new' ? <button className="back" onClick={back} disabled={busy}><ArrowLeft size={18} />Back to requests & orders</button> : null}
 <div className="section-head"><div><p className="eyebrow">{company.name} · {projects.find(p => p.id === r?.project_id)?.name || project?.name || 'Authorised company projects'}</p><h2 ref={heading} tabIndex={-1}>{mode === 'new' ? 'What does the site need?' : r ? selected.type === 'request' ? r.title : `Order for ${r.vendor}` : 'Requests & orders'}</h2><p className="muted">{r ? `${r.id} · Revision ${r.version}` : 'One path from site demand to supplier delivery and material use.'}</p></div>{!selected && !mode && writable('requests.write') && <button className="primary" onClick={() => {
        setMode('new');
        setError('');
      }}><Plus size={18} />New site request</button>}</div>
 <ErrorBox message={error} />{!data && !error && <p role="status">Loading procurement…</p>}
 {data && <>
 {mode === 'new' ? <DemandForm data={data} company={company} project={project} projects={projects} busy={busy} onSave={body => act('/material-requests', body, 'POST', 'request')} onCancel={back} /> : selected ? <>
 <div className="proc-next"><div><span className={`proc-state ${r.state}`}>{labels[r.state]}</span><p>{selected.type === 'request' ? next[r.state] : 'Record accepted goods separately from rejected goods, then track returns and material consumption.'}</p></div>{selected.type === 'request' && r.can_price && <div><small>Plan value · excluding tax</small><strong>{r.company_amount === null ? 'Not priced yet' : amount(r.company_amount, company.currency)}</strong></div>}{selected.type === 'order' && r.can_price && <div><small>Order value · excluding tax</small><strong>{amount(r.amount, r.currency)}</strong><small>{amount(r.company_amount, company.currency)} at frozen quote rates</small></div>}</div>
 {selected.type === 'request' ? <>
<p className='proc-record-context'>Requested by {r.requester} · Needed on site {r.needed_by}</p>
 <div className="proc-steps" aria-label="Request stages">{['draft', 'submitted', 'awaiting_approval', 'approved', 'ordered'].map((s, i) => <span key={s} aria-current={r.state === s ? 'step' : undefined}>{i + 1}. {labels[s]}</span>)}</div>
 <Lines lines={r.lines} />
 {r.can_price && r.allocations?.length > 0 && <section className="proc-section"><h3>Supplier plan</h3><div className="proc-table-wrap"><table className="proc-table"><thead><tr><th>Material / supplier</th><th>Quantity</th><th>Supplier amount</th><th>{company.currency} value</th><th>Rate snapshot</th></tr></thead><tbody>{r.allocations.map(a => <tr key={a.id}><td data-label="Material / supplier"><strong>{r.lines.find(l => l.id === a.line_id)?.product}</strong><small>{a.vendor} · {a.reference}</small></td><td data-label="Allocated quantity">{numberText(a.quantity)} {r.lines.find(l => l.id === a.line_id)?.uom}</td><td data-label="Supplier amount">{amount(a.amount, a.currency)}</td><td data-label={`${company.currency} value`}>{amount(a.company_amount, company.currency)}</td><td data-label="Rate snapshot">{a.rate} · {a.rate_date}<small>{a.rate_source}</small></td></tr>)}</tbody></table></div><p className="muted footnote">Approval reserves the released sourcing allowance. Orders, material cost and payment remain separate stages.</p></section>}
 {r.orders.length > 0 && <section className="proc-section"><h3>Linked supplier orders</h3><div className="proc-links">{r.orders.map(o => <button className="secondary" key={o.id} onClick={() => open('order', o.id)}><Package size={19} />{o.id} · {o.currency}<ArrowRight size={17} /></button>)}</div></section>}
 {!preview && !mode && <div className="proc-actions">
 {r.can_edit && <><button className="primary" disabled={busy} onClick={() => act(`/material-requests/${r.id}/decision`, {
                version: r.version,
                action: 'submit'
              })}>Submit to procurement<ArrowRight size={17} /></button><button className="secondary" onClick={() => setMode('edit')}>Edit quantities</button></>}
 {r.can_source && <><button className="primary" onClick={() => setMode('quote')}>Record a supplier quote</button>{r.quotes.length > 0 && <button className="secondary" onClick={() => setMode('source')}>Prepare supplier plan</button>}</>}
 {r.can_approve && <><button className="primary" disabled={busy} onClick={() => act(`/material-requests/${r.id}/decision`, {
                version: r.version,
                action: 'approve'
              })}>Approve sourcing<CheckCircle size={18} /></button><button className="secondary" onClick={() => setMode('return')}>Return for changes</button></>}
 {r.can_issue && <button className="primary" disabled={busy} onClick={() => act(`/material-requests/${r.id}/orders`, {
              version: r.version
            })}>Create supplier orders locally<ArrowRight size={17} /></button>}
 {r.can_cancel && <button className="text-button" onClick={() => setMode('cancel')}>Cancel request</button>}
 </div>}
 {mode === 'edit' && <DemandForm existing={r} data={data} company={company} project={projects.find(p => p.id === r.project_id)} projects={projects} busy={busy} onCancel={() => setMode('')} onSave={body => act(`/material-requests/${r.id}`, {
            ...body,
            version: r.version
          }, 'PUT')} />}
 {mode === 'quote' && <QuoteForm key={r.version} request={r} data={data} company={company} busy={busy} onCancel={() => setMode('')} onSave={body => act(`/material-requests/${r.id}/quotes`, {
            ...body,
            version: r.version
          })} />}
 {mode === 'source' && <SourcingForm request={r} busy={busy} onCancel={() => setMode('')} onSave={body => act(`/material-requests/${r.id}/sourcing`, {
            ...body,
            version: r.version
          })} />}
 {['return', 'cancel'].includes(mode) && <ReasonForm label={mode === 'return' ? 'What must procurement change?' : 'Why is this request being cancelled?'} actionLabel={mode === 'return' ? 'Return sourcing plan' : 'Cancel request'} busy={busy} onCancel={() => setMode('')} onSave={note => act(`/material-requests/${r.id}/decision`, {
            version: r.version,
            action: mode,
            note
          })} />}
 {r.can_price && r.quotes?.length > 0 && <details className="proc-history"><summary>All supplier quotations · {r.quotes.length}</summary>{r.quotes.map(q => <div key={q.id}><strong>{q.vendor} · {q.product}</strong><p>{numberText(q.quantity)} {q.uom} · {q.pack ? `${q.pack.quoted_quantity} ${q.pack.pack_name} at ${amount(q.pack.quoted_price, q.currency)} per quoted unit` : `${amount(q.unit_price, q.currency)} each`} · Lead time {q.lead_days} days</p><small>{q.reference}{q.pack?.supplier_code ? ` · Supplier item ${q.pack.supplier_code}` : ''} · Valid until {q.valid_until} · {q.id}</small></div>)}</details>}
 </> : <>
 <button className="text-button" onClick={() => open('request', r.request_id)}>Open originating request {r.request_id}<ArrowRight size={17} /></button>
 <Lines lines={r.lines} order priced={r.can_price} currency={r.currency} />
 {!preview && r.can_receive && !mode && <button className="primary" onClick={() => setMode('receipt')}>Record delivery</button>}
 {mode === 'receipt' && <ReceiptForm order={r} busy={busy} onCancel={() => setMode('')} onSave={body => act(`/purchase-orders/${r.id}/receipts`, {
            ...body,
            version: r.version
          })} />}
 <section className="proc-section"><h3>Receipts & available stock</h3>{!r.receipts.length ? <Empty>No deliveries recorded yet.</Empty> : r.receipts.map(lot => <div className="proc-lot" key={lot.id}><div><h4>{lot.delivery_reference}</h4><p>{r.lines.find(l => l.id === lot.order_line_id)?.product} · {lot.receiver}</p><small>{lot.id} · {new Date(lot.received_at).toLocaleString()}</small></div><dl><div><dt>Accepted</dt><dd>{lot.accepted} <small>{r.lines.find(l => l.id === lot.order_line_id)?.uom}</small></dd></div><div><dt>Rejected</dt><dd>{lot.rejected} <small>{r.lines.find(l => l.id === lot.order_line_id)?.uom}</small></dd></div><div><dt>Available</dt><dd>{lot.available} <small>{r.lines.find(l => l.id === lot.order_line_id)?.uom}</small></dd></div>{r.can_price && <div><dt>Stock value</dt><dd>{amount(lot.stock_value, company.currency)}</dd></div>}</dl>{lot.reason && <p className="footnote">{lot.reason}</p>}{!preview && r.can_move && Number(lot.available) > 0 && !mode && <div className="proc-actions"><button className="secondary" onClick={() => setMode(`issue:${lot.id}`)}>Record material use</button><button className="text-button" onClick={() => setMode(`return:${lot.id}`)}>Return to supplier</button></div>}{mode.endsWith(`:${lot.id}`) && <MovementForm order={r} lot={lot} data={data} kind={mode.split(':')[0]} busy={busy} onCancel={() => setMode('')} onSave={body => act(`/material-receipts/${lot.id}/movements`, {
                ...body,
                version: r.version
              })} />}</div>)}</section>
 {r.movements.length > 0 && <details className="proc-history"><summary>Stock movement ledger · {r.movements.length}</summary>{r.movements.map(m => <div key={m.id}><strong>{m.kind === 'issue' ? 'Material consumed' : m.kind === 'return' ? 'Returned to supplier' : 'Accepted into stock'} · {m.quantity}</strong><p>{m.location} · {m.actor}{r.can_price ? ` · ${amount(m.company_value, company.currency)}` : ''}</p><small>{m.id} · {m.reason}</small></div>)}</details>}
 <p className="notice">Local order and stock records<small>Creating an order does not send it to a supplier. Consumed material contributes to operational cost; supplier bills, taxes and payments require their own accounting workflow.</small></p>
 </>}
 <History rows={r.history} />
 </> : <>
 <section className="proc-findings" aria-label="Procurement findings"><p className="eyebrow">AT A GLANCE</p>{data.findings.map(f => <p key={f.id}>{f.text}</p>)}<small>Calculated from every authorised request and order in this scope.</small></section>
 <div className="proc-toolbar"><div className="proc-switch" aria-label="Procurement view"><button aria-pressed={tab === 'requests'} onClick={() => {
              setTab('requests');
              setFilter('');
            }}>Site requests <span>{data.requests.length}</span></button><button aria-pressed={tab === 'orders'} onClick={() => {
              setTab('orders');
              setFilter('');
            }}>Supplier orders <span>{data.orders.length}</span></button></div><input aria-label="Filter requests and orders" placeholder="Find by ID, name or stage…" value={filter} onChange={e => setFilter(e.target.value)} /></div>
 <RecordRows rows={filtered} projects={projects} onOpen={open} orders={tab === 'orders'} />
 <details className="proc-history"><summary>Try a connected example</summary><div><p>Open “Example · Review supplier allocation” to inspect quantities and frozen supplier currencies before approval. Open an existing order to see accepted and rejected deliveries, returned materials, stock remaining and consumed cost.</p><p>Every supplied project has an unpriced draft, a sourcing review and an order with delivery and consumption history. These are fictional local records.</p></div></details>
 </>}
 </>}
 </section>;
}
function Lines({
  lines,
  order = false,
  priced = false,
  currency
}) {
  return <div className="proc-table-wrap"><table className="proc-table"><caption>{order ? 'Ordered quantities and delivery position' : 'Requested quantities'}</caption><thead><tr><th>Material / work package</th><th>Location</th><th>{order ? 'Ordered' : 'Needed'}</th>{order && <><th>Accepted net of returns</th><th>Outstanding</th>{priced && <th>Quoted price</th>}</>}</tr></thead><tbody>{lines.map(l => <tr key={l.id}><td data-label="Material / work package"><strong>{l.product}</strong><small>{l.work_package}</small>{l.note && <small>{l.note}</small>}</td><td data-label="Location">{l.location_code} {l.location}</td><td data-label={order ? "Ordered" : "Needed"}>{numberText(l.quantity)} {l.uom}</td>{order && <><td data-label="Accepted net of returns">{l.received} {l.uom}</td><td data-label="Outstanding">{l.outstanding} {l.uom}</td>{priced && <td data-label="Quoted price">{amount(l.pack?.quoted_price || l.unit_price, currency)}<small>per {l.pack?.pack_name || l.uom}{l.pack && l.pack.base_quantity !== '1' ? ` · ${l.pack.base_quantity} ${l.uom}` : ''}</small></td>}</>}</tr>)}</tbody></table></div>;
}
function Buttons({
  busy,
  onCancel,
  label
}) {
  return <div className="proc-actions"><button className="primary" disabled={busy} type="submit">{busy ? 'Saving…' : label}</button><button className="secondary" type="button" onClick={onCancel} disabled={busy}>Back</button></div>;
}
function DemandForm({
  data,
  company,
  project,
  projects,
  existing,
  busy,
  onSave,
  onCancel
}) {
  const [pid, setPid] = useState(existing?.project_id || project?.id || ''),
    [title, setTitle] = useState(existing?.title || ''),
    [needed, setNeeded] = useState(existing?.needed_by || ''),
    [lines, setLines] = useState(existing?.lines || [{
      product_id: '',
      quantity: '',
      work_package_id: '',
      location_id: '',
      note: ''
    }]);
  const change = (i, key, value) => setLines(ls => ls.map((l, n) => n === i ? {
    ...l,
    [key]: value
  } : l));
  const work = data.work_packages.filter(w => w.project_id === pid),
    loc = data.locations.filter(l => l.project_id === pid).map(l => ({
      ...l,
      label: `${l.code} · ${l.name}`
    }));
  return <form className="proc-form" onSubmit={e => {
    e.preventDefault();
    onSave({
      company_id: company.id,
      project_id: pid,
      title,
      needed_by: needed,
      lines
    });
  }}><p className="muted">Start with the need. Procurement adds suppliers, prices and currency later.</p><div className="proc-grid"><Input label="Request title" value={title} onChange={setTitle} maxLength={200} /><Input label="Needed on site" type="date" value={needed} onChange={setNeeded} />{!project && !existing && <Select label="Project" value={pid} onChange={v => {
        setPid(v);
        setLines(ls => ls.map(l => ({
          ...l,
          work_package_id: '',
          location_id: ''
        })));
      }} rows={data.creatable_projects || []} />}</div>
 {lines.map((l, i) => <fieldset key={i}><legend>Material {i + 1}</legend><div className="proc-grid"><Select label="Product" value={l.product_id} onChange={v => change(i, 'product_id', v)} rows={data.products} /><Input label={`Quantity · ${data.products.find(p => p.id === l.product_id)?.uom || 'product unit'}`} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,6})?" value={l.quantity} onChange={v => change(i, 'quantity', v)} /><Select label="Work package / budget" value={l.work_package_id} onChange={v => change(i, 'work_package_id', v)} rows={work} /><Select label="Where it is needed" value={l.location_id} onChange={v => change(i, 'location_id', v)} rows={loc} /></div><Input label="Specification or drawing reference (optional)" required={false} value={l.note} onChange={v => change(i, 'note', v)} maxLength={500} />{lines.length > 1 && <button type="button" className="text-button" onClick={() => setLines(ls => ls.filter((_, n) => n !== i))}>Remove material {i + 1}</button>}</fieldset>)}
 <button type="button" className="secondary" disabled={lines.length >= 100} onClick={() => setLines(ls => [...ls, {
      product_id: '',
      quantity: '',
      work_package_id: '',
      location_id: '',
      note: ''
    }])}><Plus size={17} />Add another material</button><Buttons busy={busy} onCancel={onCancel} label="Save request draft" /></form>;
}
function QuoteForm({
  request,
  data,
  company,
  busy,
  onSave,
  onCancel
}) {
  const [form, setForm] = useState({
    line_id: request.lines[0].id,
    vendor_id: '',
    currency: '',
    pack_id: '',
    supplier_code: '',
    quantity: request.lines[0].quantity,
    unit_price: '',
    rate: '',
    rate_date: today(),
    rate_source: '',
    valid_until: '',
    reference: '',
    lead_days: '3'
  });
  const put = k => v => setForm(f => ({
    ...f,
    [k]: v
  }));
  const vendor = data.vendors.find(v => v.id === form.vendor_id),
    line = request.lines.find(l => l.id === form.line_id),
    packs = (data.packs || []).filter(p => p.product_id === line.product_id),
    pack = packs.find(p => p.id === form.pack_id),
    currency = form.currency || vendor?.currency;
  return <form className="proc-form" onSubmit={e => {
    e.preventDefault();
    onSave({
      ...form,
      currency,
      rate: currency === company.currency ? '1' : form.rate,
      rate_source: currency === company.currency ? 'Same company currency' : form.rate_source,
      lead_days: Number(form.lead_days)
    });
  }}><h3>Record a supplier quotation</h3><p className="muted">Use the supplier’s approved company currencies. Quote units, terms and exchange-rate evidence stay with the purchase.</p>{!data.vendors.length && <Empty>No approved suppliers are available. Maintain the company’s supplier terms in Contacts & catalogue.</Empty>}<div className="proc-grid"><Select label="Requested material" value={form.line_id} onChange={v => setForm(f => ({
        ...f,
        line_id: v,
        supplier_code: '',
        pack_id: '',
        quantity: request.lines.find(l => l.id === v).quantity,
        unit_price: ''
      }))} rows={request.lines.map(l => ({
        id: l.id,
        label: `${l.product} · ${l.quantity} ${l.uom} · ${l.location}`
      }))} /><Select label="Supplier" value={form.vendor_id} onChange={v => setForm(f => ({
        ...f,
        vendor_id: v,
        supplier_code: '',
        currency: data.vendors.find(x => x.id === v)?.currency || '',
        unit_price: '',
        rate: '',
        rate_source: '',
        reference: ''
      }))} rows={data.vendors.map(v => ({
        ...v,
        label: `${v.name} · ${v.currency} preferred`
      }))} />{vendor && <Select label="Quotation currency" value={currency} onChange={v => setForm(f => ({
        ...f,
        currency: v,
        unit_price: '',
        rate: '',
        rate_source: ''
      }))} rows={vendor.currencies.map(c => ({
        id: c,
        name: c
      }))} />}<Field label="Quotation unit"><select value={form.pack_id} onChange={e => setForm(f => ({
          ...f,
          pack_id: e.target.value,
          quantity: '',
          unit_price: ''
        }))}><option value="">Base unit · {line.uom}</option>{packs.map(p => <option key={p.id} value={p.id}>{p.name} · {p.base_quantity} {line.uom} each</option>)}</select></Field><Input label="Supplier item code (optional)" value={form.supplier_code} onChange={put('supplier_code')} required={false} maxLength={100} /><Input label="Quote reference" value={form.reference} onChange={put('reference')} maxLength={120} /><Input label={`Quoted quantity · ${pack ? pack.name : line.uom}`} inputMode="decimal" value={form.quantity} onChange={put('quantity')} /><Input label={`Price per ${pack ? 'pack' : line.uom} · ${currency || 'supplier currency'}`} inputMode="decimal" value={form.unit_price} onChange={put('unit_price')} /><Input label="Valid until" type="date" value={form.valid_until} onChange={put('valid_until')} /><Input label="Lead time · days" type="number" min="0" max="730" value={form.lead_days} onChange={put('lead_days')} /><Input label="Rate date" type="date" value={form.rate_date} onChange={put('rate_date')} />{vendor && currency !== company.currency && <><Input label={`1 ${currency} equals how many ${company.currency}?`} inputMode="decimal" value={form.rate} onChange={put('rate')} /><Input label="Rate source / reference" value={form.rate_source} onChange={put('rate_source')} maxLength={160} /></>}</div>{pack && <p className="muted">1 {pack.name} = {pack.base_quantity} {line.uom}. Supplier allocation and site receipts will use {line.uom}.</p>}<Buttons busy={busy} onCancel={onCancel} label="Save supplier quotation" /></form>;
}
function SourcingForm({
  request,
  busy,
  onSave,
  onCancel
}) {
  const [quantities, setQuantities] = useState(Object.fromEntries(request.quotes.map(q => [q.id, request.allocations?.find(a => a.quote_id === q.id)?.quantity || ''])));
  return <form className="proc-form" onSubmit={e => {
    e.preventDefault();
    onSave({
      allocations: Object.entries(quantities).filter(([, v]) => v && Number(v) > 0).map(([quote_id, quantity]) => ({
        quote_id,
        quantity
      }))
    });
  }}><h3>Allocate quantities to suppliers</h3><p className="muted">Split a material between suppliers if needed. Quantities must cover each request line exactly. Leave unused quotes blank.</p>{request.quotes.map(q => <div className="proc-quote" key={q.id}><div><strong>{q.vendor} · {q.product}</strong><small>{request.lines.find(l => l.id === q.line_id)?.location} · {request.lines.find(l => l.id === q.line_id)?.work_package}</small><p>{q.quantity} {q.uom} available · {q.pack ? `${amount(q.pack.quoted_price, q.currency)} per ${q.pack.pack_name} (${q.pack.base_quantity} ${q.uom})` : amount(q.unit_price, q.currency)} · {q.reference}</p><small>Valid until {q.valid_until} · Rate {q.rate} on {q.rate_date}</small></div><Input label={`Allocate · ${q.uom}`} required={false} inputMode="decimal" value={quantities[q.id]} onChange={v => setQuantities({
        ...quantities,
        [q.id]: v
      })} /></div>)}<Buttons busy={busy} onCancel={onCancel} label="Send plan for independent review" /></form>;
}
function ReasonForm({
  label,
  actionLabel,
  busy,
  onSave,
  onCancel
}) {
  const [reason, setReason] = useState('');
  return <form className="proc-form" onSubmit={e => {
    e.preventDefault();
    onSave(reason);
  }}><Field label={label}><textarea value={reason} onChange={e => setReason(e.target.value)} required maxLength={1000} /></Field><Buttons busy={busy} onCancel={onCancel} label={actionLabel} /></form>;
}
function ReceiptForm({
  order,
  busy,
  onSave,
  onCancel
}) {
  const [form, setForm] = useState({
    line_id: order.lines.find(l => Number(l.outstanding) > 0)?.id || order.lines[0].id,
    accepted: '',
    rejected: '0',
    delivery_reference: '',
    reason: '',
    command_key: crypto.randomUUID()
  });
  const put = k => v => setForm(f => ({
    ...f,
    [k]: v
  }));
  return <form className="proc-form" onSubmit={e => {
    e.preventDefault();
    onSave(form);
  }}><h3>Record what arrived</h3><div className="proc-grid"><Select label="Order line" value={form.line_id} onChange={put('line_id')} rows={order.lines.map(l => ({
        id: l.id,
        label: `${l.product} · ${l.outstanding} ${l.uom} outstanding`
      }))} /><Input label="Supplier delivery note" value={form.delivery_reference} onChange={put('delivery_reference')} maxLength={160} /><Input label="Accepted quantity" inputMode="decimal" value={form.accepted} onChange={put('accepted')} /><Input label="Rejected quantity" inputMode="decimal" value={form.rejected} onChange={put('rejected')} /></div><Input label="Inspection / rejection reason" required={Number(form.rejected) > 0} value={form.reason} onChange={put('reason')} maxLength={500} /><p className="muted footnote">Only accepted goods enter stock. Rejected goods remain outstanding supply.</p><Buttons busy={busy} onCancel={onCancel} label="Record delivery" /></form>;
}
function MovementForm({
  order,
  lot,
  data,
  kind,
  busy,
  onSave,
  onCancel
}) {
  const [form, setForm] = useState({
    kind,
    quantity: '',
    location_id: order.lines.find(l => l.id === lot.order_line_id)?.location_id || '',
    reason: '',
    command_key: crypto.randomUUID()
  });
  const put = k => v => setForm(f => ({
    ...f,
    [k]: v
  }));
  return <form className="proc-form" onSubmit={e => {
    e.preventDefault();
    onSave(form);
  }}><h3>{kind === 'issue' ? 'Record material consumed' : 'Return accepted goods to supplier'}</h3><p className="muted">{lot.available} available. {kind === 'issue' ? 'Use this for incorporated material; its value becomes operational cost.' : 'Returned quantities leave stock and reopen the outstanding supply quantity.'}</p><div className="proc-grid"><Input label="Quantity" inputMode="decimal" value={form.quantity} onChange={put('quantity')} /><Select label={kind === 'issue' ? 'Work location' : 'Return origin'} value={form.location_id} onChange={put('location_id')} rows={data.locations.filter(l => l.project_id === order.project_id)} /></div><Input label="Reason / work evidence" value={form.reason} onChange={put('reason')} maxLength={500} /><Buttons busy={busy} onCancel={onCancel} label={kind === 'issue' ? 'Record consumption' : 'Record supplier return'} /></form>;
}
