import { AccountProvisioning, ConfirmIdentity } from './Identity.jsx';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowLeft, Plus, Trash, Eye, CheckCircle } from '@phosphor-icons/react';
import { api } from './api.js';
import { permissionLabel } from './access-labels.js';
import { ErrorBox } from './components.jsx';
export function Access({
  actorId,
  onPreview
}) {
  const [data, setData] = useState(null),
    [selected, setSelected] = useState(null),
    [form, setForm] = useState(null),
    [review, setReview] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [busy, setBusy] = useState(false),
    [reauth, setReauth] = useState(false),
    [provisioning, setProvisioning] = useState(false);
  const load = () => api('/access').then(setData).catch(e => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  function edit(entry) {
    setSelected(entry);
    setForm({
      version: entry.user.access_version,
      active: !!entry.user.active,
      grants: entry.grants.map(g => ({
        ...g
      })),
      reason: ''
    });
    setReview(false);
    setError('');
    setSaved('');
  }
  function changeGrant(i, key, value) {
    setReview(false);
    setForm(f => ({
      ...f,
      grants: f.grants.map((g, n) => n !== i ? g : {
        ...g,
        [key]: value,
        ...(key === 'company_id' ? {
          project_id: ''
        } : {}),
        ...(key === 'role_id' ? {
          approval_limit: '0',
          budget_approval_limit: '0'
        } : {})
      })
    }));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/access/users/${selected.user.id}`, form, 'PUT');
      setReauth(false);
      setSelected(null);
      setSaved('Access updated. Existing sessions for this user are invalidated. The reason and before/after grants were recorded.');
      await load();
    } catch (e) {
      if (e.status === 428) setReauth(true);else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <><ErrorBox message={error} /><p>Loading access records…</p></>;
  return <div className="access-workspace"><ErrorBox message={error} />{saved && <p className="success" role="status"><CheckCircle size={20} />{saved}</p>}
    {!selected ? <><div className="section-head"><div><p className="eyebrow">ADMINISTRATION</p><h1>Users & access</h1><p className="muted">Choose a person. Review their role, scope and authority together.</p></div><ShieldCheck size={36} /></div>
      <AccountProvisioning actorId={actorId} data={data} onChanged={load} onEditingChange={setProvisioning} />
      {!provisioning && <>
      <div className="notice">Business access and user administration are separate.<small>{data.identity_mode === 'local' ? 'Individual local sign-in is active. Roles, company scope and approval limits remain independent.' : 'The example workspace uses a synthetic identity. Set up individual sign-in from your profile to provision accounts.'}</small></div>
      <div className="access-users">{data.users.map(e => <div className="access-user" key={e.user.id}><span className="avatar">{e.user.name.split(' ').slice(0, 2).map(n => n[0]).join('')}</span><div><h3>{e.user.name}</h3><p>{e.grants.map(g => data.roles.find(r => r.id === g.role_id)?.name || 'No role').filter((v, i, a) => a.indexOf(v) === i).join(' · ') || 'No business access'}</p><small>{e.user.active ? 'Active' : 'Disabled'} · {e.grants.length} scope{e.grants.length === 1 ? '' : 's'}{e.user.access_admin ? ' · Access administrator' : ''}</small></div><div className="inline-actions">{e.user.active && e.user.id !== actorId && <button className="text-button" onClick={() => onPreview(e.user.id)}><Eye size={18} />Preview</button>}<button className="secondary" onClick={() => edit(e)}>Review access</button></div></div>)}</div>
      <details className="role-catalogue"><summary>Role presets · {data.roles.length} construction role presets</summary><p className="muted">Presets describe permissions for the implemented domains. Unavailable roles cannot be assigned.</p>{data.roles.map(r => <div key={r.id}><strong>{r.name}{!r.available ? ' · Not yet available' : ''}</strong><p>{r.description}</p></div>)}</details>
      <section className="spaced"><h2>Recent access changes</h2>{data.events.length ? data.events.map(e => <details className="access-event" key={e.id}><summary>{e.subject} · {e.actor} · {new Date(e.at).toLocaleString()}</summary><p>{e.reason}</p><p>Version {JSON.parse(e.before_json).user.access_version} → {JSON.parse(e.after_json).user.access_version}</p><pre>{JSON.stringify({
                before: JSON.parse(e.before_json).grants,
                after: JSON.parse(e.after_json).grants
              }, null, 2)}</pre></details>) : <p className="muted">No access changes recorded yet.</p>}</section></>}
    </> : <><button className="back" onClick={() => setSelected(null)}><ArrowLeft size={18} />All users</button><h1>{selected.user.name}</h1><p className="muted">Access revision {form.version} · Job title: {selected.user.role}. A title alone grants no access.</p>
    {reauth && <ConfirmIdentity onConfirmed={save} onCancel={() => setReauth(false)} />}<fieldset disabled={busy || selected.user.id === actorId}><legend>Account and business permissions</legend><label className="check-field"><input type="checkbox" disabled={!!selected.user.access_admin || !!selected.user.organisation_admin} checked={form.active} onChange={e => {
            setReview(false);
            setForm({
              ...form,
              active: e.target.checked
            });
          }} />Account active</label>
      {form.grants.map((g, i) => <div className="grant" key={i}><div className="grant-fields"><label className="field">Company<select value={g.company_id} onChange={e => changeGrant(i, 'company_id', e.target.value)}><option value="">Choose company</option>{data.companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label className="field">Project scope<select value={g.project_id} onChange={e => changeGrant(i, 'project_id', e.target.value)}><option value="">Choose scope</option><option value="*">All projects + company records</option>{data.projects.filter(p => p.company_id === g.company_id).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="field">Role<select value={g.role_id} onChange={e => changeGrant(i, 'role_id', e.target.value)}><option value="">Choose role</option>{data.roles.filter(r => r.available).map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label><label className="field">Purchase approval · {data.companies.find(c => c.id === g.company_id)?.currency || 'company currency'}<input inputMode="decimal" value={g.approval_limit} onChange={e => changeGrant(i, 'approval_limit', e.target.value)} /></label><label className="field">Budget approval · {data.companies.find(c => c.id === g.company_id)?.currency || 'company currency'}<input inputMode="decimal" value={g.budget_approval_limit || '0'} onChange={e => changeGrant(i, 'budget_approval_limit', e.target.value)} /></label></div><p>{data.roles.find(r => r.id === g.role_id)?.description}</p><button className="text-button" onClick={() => {
            setReview(false);
            setForm({
              ...form,
              grants: form.grants.filter((_, n) => n !== i)
            });
          }}><Trash size={16} />Remove this scope</button></div>)}
      <button className="secondary" onClick={() => {
          setReview(false);
          setForm({
            ...form,
            grants: [...form.grants, {
              company_id: '',
              project_id: '',
              role_id: '',
              approval_limit: '0',
              budget_approval_limit: '0'
            }]
          });
        }}><Plus size={18} />Add company or project scope</button>
      <label className="field spaced">Reason for the change<textarea value={form.reason} onChange={e => {
            setReview(false);
            setForm({
              ...form,
              reason: e.target.value
            });
          }} minLength={10} maxLength={1000} placeholder="Explain the business need and who requested this access." /></label>
      {!review ? <button className="primary" onClick={() => setReview(true)} disabled={form.reason.trim().length < 10}>Review effective access</button> : <section className="access-review"><h2>Review before applying</h2><p>{form.active ? 'Account remains active.' : 'Account will be disabled.'} Every listed scope is combined. A company-wide role also applies to its projects.</p>{form.grants.map((g, i) => <div key={i}><strong>{data.companies.find(c => c.id === g.company_id)?.name} · {g.project_id === '*' ? 'All projects and company records' : data.projects.find(p => p.id === g.project_id)?.name}</strong><p>{data.roles.find(r => r.id === g.role_id)?.name} · Purchase approval up to {g.approval_limit} {data.companies.find(c => c.id === g.company_id)?.currency}</p><p>Budget approval up to {g.budget_approval_limit || '0'} {data.companies.find(c => c.id === g.company_id)?.currency}. Separate authority; self-approval is blocked.</p><p className="muted">{data.roles.find(r => r.id === g.role_id)?.capabilities.map(permissionLabel).join(' · ')}</p></div>)}<p>Self-approval remains blocked. Existing sessions will be invalidated. The old and new access will be recorded with your reason.</p><button className="primary" onClick={save} disabled={busy}>{busy ? 'Applying…' : 'Apply reviewed access'}</button></section>}
    </fieldset>{selected.user.id === actorId && <p className="notice">Another administrator must review changes to your own access.</p>}</>}
  </div>;
}
