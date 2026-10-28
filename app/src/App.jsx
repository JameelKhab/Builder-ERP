import React, { useEffect, useRef, useState } from 'react';
import { User, Notebook, Buildings, Users, MagnifyingGlass, Question, CaretRight, FileText, ChartBar, Sparkle, ArrowLeft, ArrowRight, Plus, List, CheckCircle } from '@phosphor-icons/react';
import { api, amount, compact, stateLabel } from './api.js';
import { AREAS, CATEGORIES, COMPANY_GROUPS } from './catalogue.js';
import { Modal, ErrorBox, Empty, Status, RecordTable, RecordDetail, RequestDetail, RequestForm, CostReport } from './components.jsx';
import { Examples } from './Examples.jsx';
const GLOBALS = [['My Work', User], ['Tenders', Notebook], ['Projects', Buildings], ['Company', Users]];
function readRoute() {
  const p = new URLSearchParams(location.hash.slice(1));
  return {
    global: GLOBALS.some(([g]) => g === p.get('section')) ? p.get('section') : 'Projects',
    area: AREAS.includes(p.get('area')) ? p.get('area') : 'Overview',
    category: p.get('category') || ''
  };
}
export function App() {
  const [boot, setBoot] = useState(null),
    [companyId, setCompanyId] = useState('jakh'),
    [projectId, setProjectId] = useState('harbour'),
    [route, setRoute] = useState(readRoute),
    [workspace, setWorkspace] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [modal, setModal] = useState(null),
    [search, setSearch] = useState(''),
    [mobileNav, setMobileNav] = useState(false);
  const openSerial = useRef(0);
  const company = boot?.companies.find(c => c.id === companyId),
    project = boot?.projects.find(p => p.id === projectId),
    scopeProject = route.global === 'Projects' ? projectId : '';
  function nav(global, area = 'Overview', category = '') {
    location.hash = new URLSearchParams({
      section: global,
      area,
      ...(category ? {
        category
      } : {})
    }).toString();
    setRoute({
      global,
      area,
      category
    });
    setMobileNav(false);
  }
  useEffect(() => {
    const fn = () => setRoute(readRoute());
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => {
    let active = true;
    api('/local-session', {}).then(() => api('/bootstrap')).then(b => {
      if (active) {
        setBoot(b);
        if (!b.companies.some(c => c.id === companyId)) {
          setCompanyId(b.companies[0]?.id || '');
          setProjectId(b.projects[0]?.id || '');
        }
      }
    }).catch(e => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!boot) return;
    const controller = new AbortController();
    setLoading(true);
    setWorkspace(null);
    setError('');
    api(`/workspace?company=${companyId}&project=${scopeProject}`, undefined, 'GET', controller.signal).then(w => {
      setWorkspace(w);
      setLoading(false);
    }).catch(e => {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [boot, companyId, scopeProject, revision]);
  const refresh = () => setRevision(n => n + 1);
  const close = () => {
    openSerial.current++;
    setModal(null);
  };
  async function openRecord(id) {
    const serial = ++openSerial.current;
    setModal({
      type: 'loading',
      title: 'Opening record'
    });
    try {
      const isRequest = id.startsWith('PR-');
      const r = await api(`/${isRequest ? 'requests' : 'records'}/${encodeURIComponent(id)}`);
      if (serial === openSerial.current) setModal({
        type: isRequest ? 'request' : 'record',
        title: r.title,
        record: r
      });
    } catch (e) {
      if (serial === openSerial.current) setModal({
        type: 'error',
        title: 'Unable to open record',
        error: e.message
      });
    }
  }
  async function doSearch(e) {
    e.preventDefault();
    const serial = ++openSerial.current;
    setModal({
      type: 'loading',
      title: 'Searching this company'
    });
    try {
      const rows = await api(`/search?company=${companyId}&q=${encodeURIComponent(search)}`);
      if (serial === openSerial.current) setModal({
        type: 'search',
        title: `Results for “${search}”`,
        rows
      });
    } catch (e) {
      if (serial === openSerial.current) setModal({
        type: 'error',
        title: 'Search unavailable',
        error: e.message
      });
    }
  }
  async function openExamples() {
    const serial = ++openSerial.current;
    setModal({ type: 'loading', title: 'Explore examples' });
    try {
      const all = await api(`/workspace?company=${companyId}`);
      if (serial === openSerial.current) setModal({ type: 'examples', title: 'Explore examples', workspace: all });
    } catch (e) {
      if (serial === openSerial.current) setModal({ type: 'error', title: 'Examples unavailable', error: e.message });
    }
  }
  function switchCompany(id) {
    setCompanyId(id);
    setProjectId(boot.projects.find(p => p.company_id === id)?.id || '');
    close();
    setSearch('');
    nav(route.global);
  }
  const explain = report => setModal({
    type: 'explain',
    title: 'Understand these findings',
    report
  });
  const sources = (rows, report) => setModal({
    type: 'sources',
    title: 'Supporting cost items',
    rows,
    report
  });
  const newRequest = () => setModal({
    type: 'new',
    title: 'New purchase request'
  });
  const pageTitle = route.global === 'Projects' ? project?.name : route.global === 'Company' ? company?.name : route.global === 'Tenders' ? 'Tenders' : 'My Work';
  const contextFor = r => ({
    company: boot.companies.find(c => c.id === r.company_id)?.name,
    project: boot.projects.find(p => p.id === r.project_id)?.name
  });
  function requestList(rows) {
    return rows.length ? <div className="request-list">{rows.map(r => <button className="request-row" key={r.id} onClick={() => openRecord(r.id)}>
<div>
<strong>{r.title}</strong>
<small>{r.id} · {r.location} · {boot.projects.find(p => p.id === r.project_id)?.name}</small>
</div>
<span>{amount(r.amount, r.currency)}</span>
<Status value={r.status} />
<CaretRight size={20} />
</button>)}</div> : <Empty>No purchase requests in this scope.</Empty>;
  }
  function directory(groups, choose) {
    return <div className="directory">{groups.map(([title, description]) => <button className="directory-row" key={title} onClick={() => choose(title)}>
<div>
<h3>{title}</h3>
<p>{description}</p>
</div>
<CaretRight size={22} />
</button>)}</div>;
  }
  function overview() {
    const pending = workspace.requests.filter(r => r.can_review),
      r = pending[0];
    const siteRows = projectId === 'harbour' ? [...workspace.records.filter(r => ['NCR-018', 'VO-014'].includes(r.id)), ...workspace.requests.filter(r => r.id === 'PR-0264').map(r => ({
      ...r,
      title: 'Reinforcement delivery',
      owner: 'Procurement',
      status: r.status === 'approved' ? 'Sourcing approved' : 'Awaiting order'
    }))] : workspace.records.filter(r => ['Site', 'Plan'].includes(r.area)).slice(0, 3);
    return <>
    <section className="overview-decisions">
<div className="section-head">
<h2>Decisions needed</h2>
<span className="muted">{pending.length ? `${pending.length} awaiting your review` : 'You’re up to date'}</span>
{pending.length > 1 && <button className="text-button push-right" onClick={() => nav('My Work')}>View all reviews<ArrowRight size={18} /></button>}
</div>{r ? <div className="decision">
<div className="decision-title">
<h3>{r.title}</h3>
<p>Purchase request · {stateLabel[r.status]}</p>
<small>{r.id} · {r.location} · Requested by {r.requester}</small>
</div>
<div className="decision-money">
<span>Vendor amount</span>
<strong>{amount(r.amount, r.currency)}</strong>
</div>
<div className="decision-money">
<span>Company estimate</span>
<strong>{amount(r.company_amount, company.currency)}</strong>
</div>
<div className="decision-action">
<span>Next owner: {r.owner}</span>
<strong className="urgent">Review pending</strong>
<button className="primary" onClick={() => openRecord(r.id)}>
<FileText size={20} />Review request<CaretRight size={20} />
</button>
</div>
</div> : <div className="caught-up">
<CheckCircle size={25} />
<div>
<strong>No decisions waiting for you.</strong>
<p>Your submitted requests and project records are available in Buying and Site.</p>
</div>
<button className="text-button" onClick={() => nav('Projects', 'Buying', 'Purchase requests')}>View requests<ArrowRight size={18} />
</button>
</div>}</section>
    <section className="overview-site">
<div className="section-head">
<h2>Site & programme</h2>
<span className="muted">Next 7 days</span>
<button className="text-button push-right" onClick={() => nav('Projects', 'Site')}>Open site work<CaretRight size={20} />
</button>
</div>
<RecordTable rows={siteRows} onOpen={openRecord} />
</section>
    <section className="overview-cost">
<div className="section-head">
<h2>Cost & cash</h2>
<span className="muted">{company.currency} · As of 28 Oct</span>
<div className="push-right inline-actions">
<button className="text-button" onClick={() => nav('Projects', 'Costs & Contracts', 'Cost report')}>
<ChartBar size={21} />View cost report<CaretRight size={19} />
</button>
<button className="text-button neutral" onClick={() => explain(workspace.report)}>
<Sparkle size={21} />Explain findings<CaretRight size={19} />
</button>
</div>
</div>
<p className="cost-finding">{workspace.report.findings[0]?.text}</p>
<div className="metrics">{[['revised_budget', 'Revised budget'], ['forecast', 'Forecast final cost'], ['cash', 'Cash paid']].map(([key, label]) => <div key={key}>
<span>{label}</span>
<strong>{compact(workspace.report.totals[key], company.currency)}</strong>
</div>)}</div>
<div className="overview-foot">
<button className="source-link" onClick={() => sources(workspace.report.rows, workspace.report)}>Based on {workspace.report.rows.length} cost item{workspace.report.rows.length === 1 ? '' : 's'}</button>
<span>Sample data · Local development</span>
</div>
</section>
</>;
  }
  function projectArea() {
    if (route.area === 'Overview') return overview();
    if (route.category === 'Cost report') return <CostReport key={companyId + projectId} company={company} projects={boot.projects} initialProject={projectId} onSource={sources} onExplain={explain} />;
    if (route.category) {
      const group = (CATEGORIES[route.area] || []).find(g => g[0] === route.category);
      return <>
<button className="back" onClick={() => nav('Projects', route.area)}>
<ArrowLeft size={18} />All {route.area.toLowerCase()}</button>
<div className="section-head">
<div>
<h2>{route.category}</h2>
<p className="muted">{group?.[1]}</p>
</div>{route.category === 'Purchase requests' && <button className="primary" onClick={newRequest}>
<Plus size={19} />New request</button>}</div>{route.category === 'Purchase requests' ? requestList(workspace.requests) : <>
<RecordTable rows={workspace.records.filter(r => r.category === route.category)} onOpen={openRecord} />
<p className="footnote muted">Sample register · Open a record to inspect its context and next action.</p>
</>}</>;
    }
    return <>
<div className="section-head">
<div>
<h2>{route.area}</h2>
<p className="muted">Choose the work you need. Your project context stays with you.</p>
</div>
</div>{directory(CATEGORIES[route.area] || [], category => nav('Projects', route.area, category))}</>;
  }
  function companyArea() {
    if (route.category === 'report') return <CostReport key={companyId} company={company} projects={boot.projects} onSource={sources} onExplain={explain} />;
    if (route.category) {
      return <>
<button className="back" onClick={() => nav('Company')}>
<ArrowLeft size={18} />Company directory</button>
<div className="section-head">
<h2>{route.category === 'buying' ? 'Buying & subcontractors' : route.category === 'vendors' ? 'Contacts & catalogue' : route.category}</h2>
<span className="muted">Across this company</span>
</div>{route.category === 'vendors' ? <div className="directory">{workspace.vendors.map(v => <div className="directory-row static" key={v.id}>
<div>
<h3>{v.name}</h3>
<p>{v.quote} · {v.currency} · Quote valid until {v.valid_until}</p>
</div>
<strong>{amount(v.unit_price, v.currency)} / tonne</strong>
</div>)}</div> : route.category === 'buying' ? <>{requestList(workspace.requests)}<h3 className="spaced">Subcontracts</h3>
<RecordTable rows={workspace.records.filter(r => r.category === 'Subcontracts')} onOpen={openRecord} />
</> : <RecordTable rows={workspace.records.filter(r => r.category === route.category)} onOpen={openRecord} />}</>;
    }
    return <>
<p className="intro">Company-wide work, grouped by purpose. Each project keeps the same source records.</p>{COMPANY_GROUPS.map(([group, entries]) => <section className="company-group" key={group}>
<h2>{group}</h2>{directory(entries.map(e => [e[0], e[1]]), title => nav('Company', 'Overview', entries.find(e => e[0] === title)[2]))}</section>)}</>;
  }
  function modalBody() {
    if (modal.type === 'loading') return <p role="status">Loading…</p>;
    if (modal.type === 'error') return <ErrorBox message={modal.error} />;
    if (modal.type === 'examples') return <Examples workspace={modal.workspace} company={company} projects={boot.projects.filter(p => p.company_id === companyId)} initialProject={projectId} actorId={boot.actor.id} onVisit={(feature, selectedProject) => {
      close();
      setProjectId(selectedProject);
      nav(feature.global, feature.area, feature.category);
    }} />;
    if (modal.type === 'request') return <RequestDetail key={modal.record.id} request={modal.record} {...contextFor(modal.record)} onChanged={refresh} onEdit={r => setModal({
      type: 'edit',
      title: 'Revise purchase request',
      record: r
    })} />;
    if (modal.type === 'record') return <RecordDetail record={modal.record} {...contextFor(modal.record)} onOpen={openRecord} />;
    if (['new', 'edit'].includes(modal.type)) {
      const p = modal.record ? boot.projects.find(p => p.id === modal.record.project_id) : project;
      return <RequestForm company={company} project={p} vendors={workspace?.vendors || []} items={(workspace?.report.rows || []).filter(i => i.project_id === p.id)} existing={modal.record} onSaved={r => {
        setModal({
          type: 'request',
          title: r.title,
          record: r
        });
        refresh();
      }} />;
    }
    if (modal.type === 'search') return <>
<p className="muted">{company.name} · Authorised records across projects</p>{modal.rows.length ? <div className="directory">{modal.rows.map(r => <button className="directory-row" key={r.id} onClick={() => openRecord(r.id)}>
<div>
<h3>{r.title}</h3>
<p>{r.id} · {contextFor(r).project || 'Company'} · {r.location}</p>
</div>
<CaretRight size={20} />
</button>)}</div> : <Empty>No matching records. Try a record ID, location, supplier or work description.</Empty>}</>;
    if (modal.type === 'sources') return <>
<p className="eyebrow">{modal.report.meta.company.name} · {modal.report.meta.project?.name || 'Company scope'} · {modal.report.meta.currency}</p>
<p className="muted">Snapshot {modal.report.snapshot} · 28 Oct 2026</p>{modal.rows.map(r => <section className="record-section" key={r.id}>
<h3>{r.id} · {r.name}</h3>
<dl className="facts">{[['original_budget', 'Original budget'], ['revised_budget', 'Revised budget'], ['committed', 'Issued commitments'], ['incurred', 'Incurred cost'], ['cash', 'Cash paid'], ['forecast', 'Forecast final cost']].map(([key, label]) => <div key={key}>
<dt>{label}</dt>
<dd>{amount(r[key], modal.report.meta.currency)}</dd>
</div>)}</dl>
<p className="notice">{r.source}<small>Illustrative opening snapshot. Transaction documents have not been imported.</small>
</p>
</section>)}</>;
    if (modal.type === 'explain') return <>
<p className="eyebrow">{modal.report.meta.company.name} · {modal.report.meta.project?.name || 'Company scope'}</p>
<p className="notice">Calculated explanation<small>These statements come from report rules and source totals. No generative AI service is connected.</small>
</p>{modal.report.findings.map(f => <section className="record-section" key={f.id}>
<h3>{f.id === 'variance' ? 'Budget versus forecast' : f.id === 'driver' ? 'Largest cost pressure' : f.id === 'cash' ? 'Cash is separate' : 'Data coverage'}</h3>
<p>{f.text}</p>{f.sourceIds.length > 0 && <button className="text-button" onClick={() => sources(modal.report.rows.filter(r => f.sourceIds.includes(r.id)), modal.report)}>Inspect supporting items<ArrowRight size={18} />
</button>}</section>)}<p className="muted">Snapshot {modal.report.snapshot} · {modal.report.meta.rules}. Suggestions and external commitments require human review.</p>
</>;
  }
  return <div className="shell">
<a className="skip-link" href="#main-content">Skip to workspace</a>
<aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
<div className="brand">Builder ERP</div>
<p className="brand-company">{company?.name || 'Construction workspace'}</p>
<nav aria-label="Main navigation">{GLOBALS.map(([title, Icon]) => <button key={title} aria-current={route.global === title ? 'page' : undefined} className={route.global === title ? 'global-link active' : 'global-link'} onClick={() => nav(title)}>
<Icon size={25} weight={route.global === title ? 'fill' : 'regular'} />{title}</button>)}</nav>
<div className="sidebar-footer">Built around your work.<br />
<span>Local sample workspace</span>
</div>
</aside>
<div className="workspace">
<header className="topbar">
<button className="icon-button mobile-menu" aria-label="Toggle main navigation" onClick={() => setMobileNav(v => !v)}>
<List size={25} />
</button>
<label className="company-select">
<span className="sr-only">Company</span>
<select value={companyId} onChange={e => switchCompany(e.target.value)} disabled={!boot}>{boot?.companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
</label>
<form className="search" onSubmit={doSearch}>
<MagnifyingGlass size={21} />
<input aria-label="Search company records" placeholder="Search projects, documents, contracts…" value={search} onChange={e => setSearch(e.target.value)} maxLength={120} required />
<button type="submit" className="sr-only">Search</button>
</form>
<button className="examples-button" aria-label="Explore examples" onClick={openExamples} disabled={!boot}>
<Question size={21} /><span>Examples</span>
</button>
<div className="profile">
<span className="avatar">AA</span>
<div>
<strong>{boot?.actor.name || 'Ahmed Al Mansoori'}</strong>
<small>{boot?.actor.role || 'Project manager'}</small>
</div>
</div>
</header>
<main id="main-content" tabIndex={-1}>
<div className="project-header">
<div>
<h1>{pageTitle || 'Builder ERP'}</h1>
<p>{route.global === 'Projects' ? `${project?.location} · ${project?.phase} · Wednesday, 28 October 2026` : route.global === 'Company' ? 'Company-wide operations and shared information' : route.global === 'Tenders' ? 'From opportunity to a confident bid.' : 'Your reviews and requests, across this company.'}</p>
</div>{route.global === 'Projects' && project && <div className="project-meta">
<label>
<span>Project</span>
<select aria-label="Project" value={projectId} onChange={e => {
                setProjectId(e.target.value);
                nav('Projects');
              }}>{boot.projects.filter(p => p.company_id === companyId).map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select>
</label>
<div>
<span>Base currency</span>
<strong>{company?.currency}</strong>
</div>
</div>}</div>{route.global === 'Projects' && <nav className="project-nav" aria-label="Project areas">{AREAS.map(area => <button key={area} className={route.area === area ? 'selected' : ''} aria-current={route.area === area ? 'page' : undefined} onClick={() => nav('Projects', area)}>{area}</button>)}</nav>}<div className="content">
<ErrorBox message={error} retry={boot ? refresh : () => location.reload()} />{loading && !error && <div className="loading" role="status">Loading your workspace…</div>}{workspace && !loading && <>{route.global === 'Projects' ? projectArea() : route.global === 'Company' ? companyArea() : route.global === 'Tenders' ? <>
<div className="section-head">
<h2>Bids & estimates</h2>
<span className="muted">{company.name}</span>
</div>
<RecordTable rows={workspace.records.filter(r => r.area === 'Tenders')} onOpen={openRecord} />
<p className="footnote muted">Tender sample register · Estimate authoring is a later increment.</p>
</> : <>
<section>
<div className="section-head">
<h2>Awaiting your review</h2>
</div>{requestList(workspace.requests.filter(r => r.can_review))}</section>
<section className="spaced">
<div className="section-head">
<h2>Your requests</h2>
</div>{requestList(workspace.requests.filter(r => r.requester_id === boot.actor.id))}</section>
</>}</>}</div>
</main>
</div>{modal && <Modal title={modal.title} onClose={close} wide={['request', 'new', 'edit', 'sources', 'examples'].includes(modal.type)}>{modalBody()}</Modal>}</div>;
}
