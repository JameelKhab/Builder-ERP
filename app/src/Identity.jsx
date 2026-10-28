import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, ShieldCheck, SignOut, Plus } from '@phosphor-icons/react';
import { permissionLabel } from './access-labels.js';
import { api } from './api.js';
import { ErrorBox } from './components.jsx';
import './identity.css';
const Input = ({
  label,
  value,
  setValue,
  type = 'text',
  autoComplete,
  required = true,
  ...rest
}) => <label className="field">{label}<input type={type} value={value || ''} onChange={e => setValue(e.target.value)} autoComplete={autoComplete} required={required} {...rest} /></label>;
export function RecoveryCodes({
  codes,
  onDone
}) {
  const [saved, setSaved] = useState(false);
  return <section className="recovery-codes"><ShieldCheck size={28} /><h2>Keep your recovery codes safe</h2><p>Each code can restore your sign-in once. Keep them in your password manager or another private place. They will not be shown again.</p><div className="recovery-grid">{codes.map(c => <code key={c}>{c}</code>)}</div><label className="check-field"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />I have saved my recovery codes privately</label><button className="primary" disabled={!saved} onClick={onDone}>Continue<ArrowRight size={18} /></button></section>;
}
export function ConfirmIdentity({
  onConfirmed,
  onCancel
}) {
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return <form className="reauth-form" onSubmit={async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/reauthenticate', {
        password
      });
      setPassword('');
      await onConfirmed();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }}><h3>Confirm it’s you</h3><p className="muted">Enter your current password to continue this sensitive change.</p><ErrorBox message={error} /><Input label="Current password" type="password" autoComplete="current-password" value={password} setValue={setPassword} /><div className="inline-actions"><button className="primary" disabled={busy}>{busy ? 'Checking…' : 'Confirm and continue'}</button>{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}</div></form>;
}
export function SignIn({
  mode,
  onReady,
  onBack
}) {
  const [view, setView] = useState(mode === 'setup' ? 'setup' : 'login'),
    [options, setOptions] = useState({
      companies: []
    }),
    [form, setForm] = useState({
      name: '',
      login: '',
      password: '',
      confirm_password: '',
      code: '',
      company_ids: []
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [codes, setCodes] = useState(null),
    [afterCodes, setAfterCodes] = useState('login'),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (view === 'setup') api('/auth/setup-options').then(setOptions).catch(e => setError(e.message));
  }, [view]);
  const change = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  function switchView(v) {
    setView(v);
    setForm(f => ({
      ...f,
      password: '',
      confirm_password: '',
      code: ''
    }));
    setError('');
    setNotice('');
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/' + (view === 'login' ? 'login' : view === 'setup' ? 'setup' : 'activate'), form);
      setForm(f => ({
        ...f,
        password: '',
        confirm_password: '',
        code: ''
      }));
      if (r.recovery_codes) {
        setCodes(r.recovery_codes);
        setAfterCodes(view === 'setup' ? 'workspace' : 'login');
      } else await onReady();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="identity-page"><header><strong>Builder <span>ERP</span></strong><span>Local workspace</span></header><main className="identity-card">{codes ? <RecoveryCodes codes={codes} onDone={async () => {
        setCodes(null);
        if (afterCodes === 'workspace') await onReady();else {
          switchView('login');
          setNotice('Your sign-in is ready. Use your username and new password.');
        }
      }} /> : <><div className="identity-icon"><ShieldCheck size={27} /></div><p className="eyebrow">YOUR CONSTRUCTION WORKSPACE</p><h1>{view === 'setup' ? 'Make this workspace yours.' : view === 'activate' ? 'Activate your account.' : view === 'recover' ? 'Restore your sign-in.' : 'Welcome back.'}</h1><p className="muted">{view === 'setup' ? 'Create the first owner account. Your existing projects and records will stay in place.' : view === 'activate' ? 'Use the code provided by your administrator, then choose your own password.' : view === 'recover' ? 'Use a recovery code you saved, or a reset code supplied by your administrator.' : 'Sign in to your projects, records and next actions.'}</p><ErrorBox message={error} />{notice && <p className="success" role="status">{notice}</p>}<form onSubmit={submit}><fieldset disabled={busy}>{view === 'setup' && <Input label="Your name" autoComplete="name" value={form.name} setValue={v => change('name', v)} />}<Input label="Username" autoComplete="username" value={form.login} setValue={v => change('login', v)} maxLength={80} />{['activate', 'recover'].includes(view) && <Input label={view === 'activate' ? 'Activation code' : 'Recovery or reset code'} autoComplete="off" value={form.code} setValue={v => change('code', v)} />}<Input label={view === 'login' ? 'Password' : 'Choose a password'} type="password" autoComplete={view === 'login' ? 'current-password' : 'new-password'} value={form.password} setValue={v => change('password', v)} minLength={view === 'login' ? undefined : 15} maxLength={128} />{view !== 'login' && <><p className="password-hint">Use 15–128 characters. A long, memorable passphrase works well.</p><Input label="Confirm password" type="password" autoComplete="new-password" value={form.confirm_password} setValue={v => change('confirm_password', v)} maxLength={128} /></>}{view === 'setup' && <section className="initial-scope"><h3>Review your starting access</h3><p>You will manage users and legal companies. Select any existing companies where you also need the project-manager role.</p>{options.companies.map(c => <label className="check-field" key={c.id}><input type="checkbox" checked={form.company_ids.includes(c.id)} onChange={e => change('company_ids', e.target.checked ? [...form.company_ids, c.id] : form.company_ids.filter(id => id !== c.id))} /><span>{c.name}<small>{c.currency} · All projects and company records</small></span></label>)}<p className="notice">Purchase and budget approval limits start at zero. Other people’s access is assigned separately. Setting up sign-in permanently disables automatic sample sign-in for this database.</p></section>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : view === 'setup' ? 'Create owner account' : view === 'login' ? 'Sign in' : 'Set password and continue'}<ArrowRight size={18} /></button></fieldset></form>{view === 'login' ? <div className="identity-links"><button onClick={() => switchView('activate')}>Activate an account</button><button onClick={() => switchView('recover')}>Recover sign-in</button></div> : <button className="back" onClick={() => view === 'setup' ? onBack?.() : switchView('login')} disabled={view === 'setup' && !onBack}><ArrowLeft size={17} />{view === 'setup' ? 'Back to the example workspace' : 'Back to sign-in'}</button>}<p className="identity-foot">Your credentials are processed by this local Builder ERP application.</p></>}</main></div>;
}
export function Account({
  mode,
  onSignOut,
  onSetup
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [form, setForm] = useState({
      current_password: '',
      new_password: '',
      confirm_password: ''
    }),
    [busy, setBusy] = useState(false),
    [codes, setCodes] = useState(null),
    [signedOut, setSignedOut] = useState(false),
    [confirm, setConfirm] = useState(false);
  const load = () => api('/auth/profile').then(setData);
  useEffect(() => {
    if (mode === 'local') load().catch(e => setError(e.message));
  }, [mode]);
  if (mode !== 'local') return <div className="identity-account"><ShieldCheck size={32} /><h2>Individual sign-in</h2><p>This example workspace currently uses a synthetic manager identity. Set up your own sign-in to use separate accounts and independent approvals.</p><div className="inline-actions"><button className="primary" onClick={onSetup}>Set up local sign-in<ArrowRight size={18} /></button></div><p className="muted">Your existing records stay in place. You choose your own password and starting access.</p></div>;
  if (codes) return <RecoveryCodes codes={codes} onDone={() => {
    setCodes(null);
    if (signedOut) onSignOut({
      sessionEnded: true
    });else load();
  }} />;
  async function changePassword(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/password', form);
      setForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setSignedOut(true);
      setCodes(r.recovery_codes);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function recovery() {
    setError('');
    try {
      const r = await api('/auth/recovery-codes', {});
      setConfirm(false);
      setCodes(r.recovery_codes);
    } catch (e) {
      if (e.status === 428) setConfirm(true);else setError(e.message);
    }
  }
  return <div className="identity-account"><ErrorBox message={error} /><h2>Your sign-in</h2>{!data ? <p>Loading account…</p> : <><p className="muted">{data.identity.login} · Individual local account</p><button className="secondary" onClick={onSignOut}><SignOut size={18} />Sign out</button><section className="spaced"><h3>Active sessions</h3>{data.sessions.map(s => <div className="identity-session" key={s.id}><div><strong>{s.current ? 'This browser' : 'Another browser session'}</strong><small>Last active {new Date(s.last_seen).toLocaleString()}</small><small>{s.client_label}</small></div><button className="text-button" onClick={async () => {
            try {
              const r = await api(`/auth/sessions/${s.id}/revoke`, {});
              if (r.current) onSignOut({
                sessionEnded: true
              });else load();
            } catch (e) {
              setError(e.message);
            }
          }}>Sign out{!s.current ? ' this session' : ''}</button></div>)}</section><details className="spaced"><summary>Change password</summary><form onSubmit={changePassword}><fieldset disabled={busy}><Input label="Current password" type="password" autoComplete="current-password" value={form.current_password} setValue={v => setForm({
              ...form,
              current_password: v
            })} /><Input label="New password" type="password" autoComplete="new-password" value={form.new_password} setValue={v => setForm({
              ...form,
              new_password: v
            })} minLength={15} maxLength={128} /><Input label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm_password} setValue={v => setForm({
              ...form,
              confirm_password: v
            })} maxLength={128} /><p className="muted">Changing your password signs out all sessions and replaces your recovery codes.</p><button className="primary" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button></fieldset></form></details><section className="spaced"><h3>Recovery</h3><p>{data.recovery_codes_remaining} unused recovery codes remain. Replacing them invalidates the previous set.</p>{confirm ? <ConfirmIdentity onConfirmed={recovery} onCancel={() => setConfirm(false)} /> : <button className="secondary" onClick={recovery}>Replace recovery codes</button>}</section><details className="spaced"><summary>Recent sign-in activity</summary>{data.events.map((e, i) => <div className="identity-event" key={i}><strong>{e.action.replaceAll('_', ' ')}</strong><small>{new Date(e.at).toLocaleString()}</small></div>)}</details></>}</div>;
}
export function AccountProvisioning({
  data,
  onChanged,
  actorId,
  onEditingChange
}) {
  const [view, setView] = useState('closed'),
    [form, setForm] = useState({
      name: '',
      login: '',
      job_title: '',
      grants: [],
      reason: ''
    }),
    [review, setReview] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [issued, setIssued] = useState(null),
    [pending, setPending] = useState(null),
    [security, setSecurity] = useState(null);
  useEffect(() => {
    onEditingChange?.(view !== 'closed');
  }, [view, onEditingChange]);
  const change = (k, v) => {
    setForm(f => ({
      ...f,
      [k]: v
    }));
    setReview(false);
  };
  const grantChange = (i, k, v) => {
    setReview(false);
    setForm(f => ({
      ...f,
      grants: f.grants.map((g, n) => n === i ? {
        ...g,
        [k]: v,
        ...(k === 'company_id' ? {
          project_id: ''
        } : {}),
        ...(k === 'role_id' ? {
          approval_limit: '0',
          budget_approval_limit: '0'
        } : {})
      } : g)
    }));
  };
  async function run(action) {
    setBusy(true);
    setError('');
    try {
      const r = await action();
      setPending(null);
      if (r.activation_code) setIssued(r);
      setView('closed');
      setSecurity(null);
      await onChanged();
    } catch (e) {
      if (e.status === 428) setPending(() => action);else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const start = entry => {
    setView('invite');
    setReview(false);
    setIssued(null);
    setError('');
    setForm({
      name: entry?.user.name || '',
      login: '',
      job_title: entry?.user.role || '',
      existing_user_id: entry?.user.id,
      version: entry?.user.access_version,
      grants: entry?.grants.map(g => ({
        ...g
      })) || [],
      reason: ''
    });
  };
  if (data.identity_mode !== 'local') return <p className="notice">Individual account provisioning becomes available after local sign-in is set up from your profile.</p>;
  return <section className="account-provision"><ErrorBox message={error} />{pending && <ConfirmIdentity onConfirmed={() => run(pending)} onCancel={() => setPending(null)} />} {issued && <div className="issued-code"><h3>Activation code ready</h3><p>Give this code privately to <strong>{issued.login}</strong>. They choose their own password on the activation screen. Nothing has been sent.</p><code>{issued.activation_code}</code><small>Expires {new Date(issued.expires_at).toLocaleString()}. Displayed once; issuing another invalidates the previous code.</small><button className="secondary" onClick={() => setIssued(null)}>I have recorded the code privately</button></div>}
 {view === 'invite' ? <><button className="back" onClick={() => setView('closed')}><ArrowLeft size={16} />Back to users</button><h2>{form.existing_user_id ? 'Set up sign-in for an existing identity' : 'Add a person'}</h2><div className="identity-form-grid"><Input label="Full name" value={form.name} setValue={v => change('name', v)} /><Input label="Username" autoComplete="off" value={form.login} setValue={v => change('login', v)} /><Input label="Job title" value={form.job_title} setValue={v => change('job_title', v)} /></div><p className="muted">Job titles describe the person. Reviewed roles below determine their access.</p>{form.grants.map((g, i) => <div className="grant" key={i}><div className="grant-fields"><label className="field">Company<select value={g.company_id} onChange={e => grantChange(i, 'company_id', e.target.value)}><option value="">Choose company</option>{data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field">Project scope<select value={g.project_id} onChange={e => grantChange(i, 'project_id', e.target.value)}><option value="">Choose scope</option><option value="*">All projects + company records</option>{data.projects.filter(p => p.company_id === g.company_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field">Role<select value={g.role_id} onChange={e => grantChange(i, 'role_id', e.target.value)}><option value="">Choose role</option>{data.roles.filter(r => r.available).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><Input label="Purchase approval limit" disabled={!data.roles.find(r => r.id === g.role_id)?.capabilities.includes('requests.approve')} value={g.approval_limit} setValue={v => grantChange(i, 'approval_limit', v)} inputMode="decimal" /><Input label="Budget approval limit" disabled={!data.roles.find(r => r.id === g.role_id)?.capabilities.includes('budgets.approve')} value={g.budget_approval_limit} setValue={v => grantChange(i, 'budget_approval_limit', v)} inputMode="decimal" /></div><button className="text-button" onClick={() => change('grants', form.grants.filter((_, n) => n !== i))}>Remove scope</button></div>)}<button className="secondary" onClick={() => change('grants', [...form.grants, {
        company_id: '',
        project_id: '',
        role_id: '',
        approval_limit: '0',
        budget_approval_limit: '0'
      }])}><Plus size={16} />Add company or project scope</button><label className="field spaced">Reason<textarea value={form.reason} onChange={e => change('reason', e.target.value)} minLength={10} /></label>{!review ? <button className="primary" disabled={!form.name.trim() || !form.login.trim() || !form.job_title.trim() || form.reason.trim().length < 10 || form.grants.some(g => !g.company_id || !g.project_id || !g.role_id)} onClick={() => setReview(true)}>Review account and access</button> : <div className="access-review"><h3>Review before creating</h3><p>{form.name} · {form.login} · {form.job_title}</p>{form.grants.length ? form.grants.map((g, i) => <p key={i}><strong>{data.companies.find(c => c.id === g.company_id)?.name} · {g.project_id === '*' ? 'All projects and company records' : data.projects.find(p => p.id === g.project_id)?.name}</strong><br />{data.roles.find(r => r.id === g.role_id)?.name} · Purchase {g.approval_limit} / Budget {g.budget_approval_limit} {data.companies.find(c => c.id === g.company_id)?.currency}<br /><small>{data.roles.find(r => r.id === g.role_id)?.capabilities.map(permissionLabel).join(' · ')}</small></p>) : <p>No business access will be assigned.</p>}<p>This account starts without a password or administrative authority. An activation code will be shown for manual delivery.</p><button className="primary" disabled={busy} onClick={() => run(() => api('/access/accounts', form))}>{busy ? 'Creating…' : 'Create reviewed account'}</button></div>}</> : <><div className="section-head"><div><h3>Individual accounts</h3><p className="muted">Each person activates their own sign-in. Roles and financial limits stay separate.</p></div><button className="primary" onClick={() => start()}><Plus size={18} />Add user</button></div><details><summary>Activation and recovery administration</summary>{data.users.filter(e => !e.user.access_admin && !e.user.organisation_admin).map(e => <div className="identity-session" key={e.user.id}><div><strong>{e.user.name}</strong><small>{e.identity ? `${e.identity.login} · ${e.identity.status.replaceAll('_', ' ')}` : 'No individual sign-in'}</small></div>{!e.identity ? <button className="text-button" onClick={() => start(e)}>Set up sign-in</button> : <button className="text-button" onClick={() => {
            setView('reset');
            setForm({
              user_id: e.user.id,
              login: e.identity.login,
              credential_version: e.identity.credential_version,
              reason: ''
            });
          }}>Issue activation / reset code</button>}</div>)}</details></>}
 {view === 'reset' && <div className="access-review"><h3>Issue a new code for {form.login}</h3><p>Earlier activation/reset codes will stop working. Current sign-in continues until the new code is used; disable the account separately if access must stop immediately.</p><label className="field">Reason<textarea value={form.reason} onChange={e => setForm({
          ...form,
          reason: e.target.value
        })} /></label><div className="inline-actions"><button className="primary" disabled={busy || form.reason.trim().length < 10} onClick={() => run(() => api(`/access/accounts/${form.user_id}/activation`, form))}>Issue new code</button><button className="secondary" onClick={() => setView('closed')}>Cancel</button></div></div>}
 {view === 'administration' && <div className="access-review"><h3>Review administrative authority for {form.name}</h3><p>Administration controls setup and access. It does not grant project visibility or financial approval limits. Existing sessions will end.</p><label className="check-field"><input type="checkbox" checked={form.access_admin} onChange={e => change('access_admin', e.target.checked)} />Manage users, access and account activation</label><label className="check-field"><input type="checkbox" checked={form.organisation_admin} onChange={e => change('organisation_admin', e.target.checked)} />Manage legal companies</label><label className="field">Reason<textarea value={form.reason} onChange={e => change('reason', e.target.value)} /></label><div className="inline-actions">{!review ? <button className="primary" disabled={form.reason.trim().length < 10} onClick={() => setReview(true)}>Review authority</button> : <><p>Users &amp; access: {form.access_admin ? 'Allowed' : 'Removed'} · Company setup: {form.organisation_admin ? 'Allowed' : 'Removed'}</p><button className="primary" disabled={busy} onClick={() => run(() => api(`/access/accounts/${form.user_id}/administration`, form))}>Apply reviewed authority</button></>}<button className="secondary" onClick={() => setView('closed')}>Cancel</button></div></div>}
 <details className="spaced"><summary>Administrative authority</summary><p className="muted">Only active, individually activated accounts can receive administration. Another administrator must review your own authority. Remove administrative authority here before disabling an administrator.</p>{data.users.filter(e => e.user.active && e.user.id !== actorId && e.identity?.status === 'active').map(e => <div className="identity-session" key={e.user.id}><div><strong>{e.user.name}</strong><small>{e.user.access_admin ? 'Users & access' : 'No user administration'} · {e.user.organisation_admin ? 'Company setup' : 'No company administration'}</small></div><button className="text-button" onClick={() => {
          setReview(false);
          setView('administration');
          setForm({
            user_id: e.user.id,
            name: e.user.name,
            version: e.user.access_version,
            access_admin: !!e.user.access_admin,
            organisation_admin: !!e.user.organisation_admin,
            reason: ''
          });
        }}>Review authority</button></div>)}</details>
 <details className="spaced"><summary onClick={() => {
        if (!security) api('/access/security-events').then(setSecurity).catch(e => setError(e.message));
      }}>Recent identity events</summary>{security?.map(e => <div className="identity-event" key={e.id}><strong>{e.action.replaceAll('_', ' ')} · {e.subject || 'Unverified account'}</strong><small>{e.actor || 'Unauthenticated'} · {new Date(e.at).toLocaleString()}</small></div>)}</details></section>;
}
