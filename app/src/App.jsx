import { Quality } from './Quality.jsx';
import { Masters } from './Masters.jsx';
import { Account } from './Identity.jsx';
import { Foundations, Organisation } from './Foundations.jsx';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { User, Notebook, Buildings, Users, MagnifyingGlass, Question, CaretRight, FileText, ChartBar, Sparkle, ArrowLeft, ArrowRight, Plus, List, CheckCircle, House, ShieldCheck } from '@phosphor-icons/react';
import { api, amount, compact, stateLabel } from './api.js';
import { AREAS, CATEGORIES, COMPANY_GROUPS } from './catalogue.js';
import { Modal, ErrorBox, Empty, Status, RecordTable, RecordDetail, RequestDetail, RequestForm, CostReport } from './components.jsx';
import { Procurement } from './Procurement.jsx';
import { Landing } from './Landing.jsx';
const AccessPage = lazy(() => import('./Access.jsx').then(m=>({default:m.Access})));
const Access = props => <Suspense fallback={<p role='status'>Loading access management…</p>}><AccessPage {...props}/></Suspense>;
import { canCategory, ROLE_BY_ID } from '../shared/access.mjs';
import { Examples } from './Examples.jsx';
const LedgerPage = lazy(() => import('./Ledger.jsx').then(m => ({
  default: m.Ledger
})));
const Ledger = props => <Suspense fallback={<p role='status'>Loading accounting…</p>}><LedgerPage {...props} /></Suspense>;
const CommercialPage = lazy(() => import('./Commercial.jsx'));
const CertificatesPage = lazy(() => import('./Certificates.jsx'));
const Certificates = props => <Suspense fallback={<p role='status'>Loading client certificates…</p>}><CertificatesPage {...props}/></Suspense>;
const Commercial = props => <Suspense fallback={<p role='status'>Loading commercial work…</p>}><CommercialPage {...props}/></Suspense>;
const EstimatesPage = lazy(() => import('./Estimates.jsx'));
const Estimates = props => <Suspense fallback={<p role='status'>Loading estimates…</p>}><EstimatesPage {...props}/></Suspense>;
const PaymentsPage = lazy(() => import('./Payments.jsx'));
const Payments = props => <Suspense fallback={<p role='status'>Loading payments…</p>}><PaymentsPage {...props}/></Suspense>;
const PayablesPage = lazy(() => import('./Payables.jsx'));
const Payables = props => <Suspense fallback={<p role='status'>Loading supplier bills…</p>}><PayablesPage {...props}/></Suspense>;
const GLOBALS = [['Home', House], ['Access', ShieldCheck], ['Organisation', Buildings], ['My Work', User], ['Tenders', Notebook], ['Projects', Buildings], ['Company', Users]];
function readRoute() {
  const p = new URLSearchParams(location.hash.slice(1));
  return {
    global: GLOBALS.some(([g]) => g === p.get('section')) ? p.get('section') : 'Home',
    area: AREAS.includes(p.get('area')) ? p.get('area') : 'Overview',
    category: p.get('category') || ''
  };
}
export function App({
  initialBoot,
  onSignOut,
  onSetup
}) {
  const [boot, setBoot] = useState(initialBoot),
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
  const caps = workspace?.capabilities || [];
  const can = cap => caps.includes(cap);
  const canOpenOrderSource = row => boot.grants.some(g => g.company_id === row.company_id && (g.project_id === '*' || g.project_id === row.project_id) && g.capabilities.some(c => ['requests.read', 'materials.read'].includes(c)));
  const qualityProjects = (boot?.projects || []).filter(p => p.company_id === companyId && boot.grants.some(g => g.company_id === p.company_id && (g.project_id === '*' || g.project_id === p.id) && g.capabilities.includes('quality.read')));
  const reportProjects = (boot?.projects || []).filter(p => boot.grants.some(g => g.company_id === p.company_id && (g.project_id === '*' || g.project_id === p.id) && g.capabilities.includes('cost.read')));
  const areaVisible = area => area === 'Overview' || (CATEGORIES[area] || []).some(([category]) => canCategory(caps, category));
  const globalVisible = title => title === 'Organisation' && !!boot?.actor.organisation_admin && !boot?.preview || title === 'Home' || title === 'My Work' && (can('requests.read') || can('budgets.approve') || can('budgets.write') || can('quality.read') || can('finance.read') || can('ap.read') || can('payments.read') || can('ar.read') || can('certificates.read') || can('tenders.read')) || title === 'Access' && !!boot?.actor.access_admin && !boot?.preview || title === 'Projects' && can('projects.read') || title === 'Tenders' && can('tenders.read') || title === 'Company' && COMPANY_GROUPS.some(([, entries]) => entries.some(e => canCategory(caps, e[2])));
  async function previewUser(id) {
    close();
    setWorkspace(null);
    setLoading(true);
    try {
      await api('/access/preview', {
        user_id: id
      });
      const b = await api('/bootstrap');
      setBoot(b);
      setCompanyId(b.companies[0]?.id || '');
      setProjectId(b.projects[0]?.id || '');
      setSearch('');
      nav('Home');
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }
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
    const fn = () => {
      if (location.hash !== '#main-content') setRoute(readRoute());
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => {
    setBoot(initialBoot);
    if (!initialBoot.companies.some(c => c.id === companyId)) {
      setCompanyId(initialBoot.companies[0]?.id || '');
      setProjectId(initialBoot.projects[0]?.id || '');
    }
  }, [initialBoot]);
  useEffect(() => {
    if (!boot) return;
    if (!companyId) {
      setWorkspace({
        capabilities: [],
        requests: [],
        records: [],
        report: null,
        vendors: [],
        items: [],
        material_requests: [],
        purchase_orders: [],
        budget_documents: [],
        project_setup: []
      });
      setLoading(false);
      setError('');
      return;
    }
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
  }, [boot?.actor.id, boot?.preview?.name, companyId, scopeProject, revision, route.global, route.area, route.category]);
  const refresh = () => setRevision(n => n + 1);
  const close = () => {
    openSerial.current++;
    setModal(null);
  };
  async function openRecord(id) {
    if (/^(CER|CIN)-[A-F0-9]{8}$/.test(id) || id.startsWith('CFN:')) { setModal({type:'certificates',title:'Client certificates',id:id.startsWith('CFN:')?id.slice(4):id}); return; }
    if (/^(OFR|CTR)-[A-F0-9]{8}$/.test(id)) { setModal({type:'commercial',title:'Quotations & awards',id}); return; }
    if (id.startsWith('NEW-OFFER:')) {setModal({type:'commercial',title:'Prepare offer',estimate:id.slice(10)});return;}
    if (/^EST-[A-F0-9]{8}$/.test(id)) { setModal({type:'estimates',title:'Estimates & BOQ',id}); return; }
    if (/^PAY-[A-F0-9]{8}$/.test(id)) { setModal({type:'payments',title:'Payments & cash flow',id}); return; }
    if (/^AP-[A-F0-9]{8}$/.test(id)) { setModal({type:'payables',title:'Supplier bills',id}); return; }
    if (/^JRN-[A-F0-9]{8}$/.test(id)) {
      setModal({
        type: 'ledger',
        title: 'General ledger',
        id
      });
      return;
    }
    if (/^NCR-[A-F0-9]{8}$/.test(id)) {
      setModal({
        type: 'quality',
        title: 'Quality & NCRs',
        id
      });
      return;
    }
    if (id.startsWith('MASTER-')) {
      setModal({
        type: 'masters',
        title: 'Contacts & catalogue',
        id: id.slice(7)
      });
      return;
    }
    if (id.startsWith('BUD-')) {
      setModal({
        type: 'budget',
        title: 'Budget control',
        id
      });
      return;
    }
    if (id.startsWith('MR-') || id.startsWith('PO-')) {
      setModal({
        type: 'procurement',
        title: 'Requests & orders',
        id
      });
      return;
    }
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
    setModal({
      type: 'loading',
      title: 'Explore examples'
    });
    try {
      const all = await api(`/workspace?company=${companyId}`);
      if (serial === openSerial.current) setModal({
        type: 'examples',
        title: 'Explore examples',
        workspace: all
      });
    } catch (e) {
      if (serial === openSerial.current) setModal({
        type: 'error',
        title: 'Examples unavailable',
        error: e.message
      });
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
  const pageTitle = route.global === 'Organisation' ? 'Companies' : route.global === 'Home' ? 'Home' : route.global === 'Access' ? 'Users & access' : route.global === 'Projects' ? project?.name : route.global === 'Company' ? company?.name : route.global === 'Tenders' ? 'Tenders' : 'My Work';
  const contextFor = r => ({
    company: boot.companies.find(c => c.id === r.company_id)?.name,
    project: boot.projects.find(p => p.id === r.project_id)?.name
  });
  function typedRequestList(rows) {
    return <div className='request-list'>{rows.map(r => <button className='request-row' key={r.id} onClick={() => openRecord(r.id)}><div><small>{r.id} · {r.state.replaceAll('_', ' ')}</small><h3>{r.title}</h3><p>{r.lines.length} materials · Needed {r.needed_by}</p></div><ArrowRight size={20} /></button>)}</div>;
  }
  function requestList(rows) {
    return rows.length ? <div className="request-list">{rows.map(r => <button className="request-row" key={r.id} onClick={() => openRecord(r.id)}>
<div>
<strong>{r.title}</strong>
<small>{r.id} · {r.location} · {boot.projects.find(p => p.id === r.project_id)?.name}</small>
</div>
<span>{r.can_price ? amount(r.amount, r.currency) : `${r.quantity} ${r.unit}`}</span>
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
{can('requests.read') && <button className="text-button" onClick={() => nav('Projects', 'Buying', 'Purchase requests')}>View requests<ArrowRight size={18} />
</button>}
</div>}</section>
    <section className="overview-site">
<div className="section-head">
<h2>{can('site.read') ? 'Site & programme' : 'Project activity'}</h2>
<span className="muted">Next 7 days</span>
{areaVisible('Site') && <button className="text-button push-right" onClick={() => nav('Projects', 'Site')}>Open site work<CaretRight size={20} />
</button>}
</div>
<RecordTable rows={siteRows.length ? siteRows : workspace.records.slice(0, 3)} onOpen={openRecord} />
</section>
    {workspace.report && <section className="overview-cost">
<div className="section-head">
<h2>Cost & cash</h2>
<span className="muted">{company.currency} · As of {workspace.report.meta.asOf}</span>
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
</section>}
</>;
  }
  const reloadFoundations = async () => {
    setBoot(await api('/bootstrap'));
    if (companyId) setWorkspace(await api(`/workspace?company=${companyId}${scopeProject ? '&project=' + scopeProject : ''}`));
  };
  function projectArea() {
    if (!can('projects.read') || !areaVisible(route.area) || route.category && !canCategory(caps, route.category)) return <Empty>This destination is not available for your current role and project.</Empty>;
    if (route.category === 'Client certificates') return <Certificates key={companyId+projectId} company={company} project={project} preview={!!boot.preview} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (route.category === 'Client contracts') return <Commercial key={companyId+projectId} company={company} project={project} preview={!!boot.preview} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (['Project setup', 'Budget control'].includes(route.category)) return <Foundations key={companyId + projectId + route.category} company={company} project={project} preview={!!boot.preview} initial={route.category === 'Budget control' ? 'budget' : 'setup'} onChanged={reloadFoundations} />;
    if (route.area === 'Overview') return overview();
    if (['Purchase requests', 'Orders & deliveries'].includes(route.category)) return <Procurement onOpen={openRecord} key={companyId + projectId + route.category} company={company} project={project} projects={boot.projects.filter(p => p.company_id === companyId)} preview={!!boot.preview} initialTab={route.category === 'Orders & deliveries' ? 'orders' : 'requests'} />;
    if (route.category === 'Payments & cash flow') return <><Payments key={companyId+projectId} company={company} project={project} preview={!!boot.preview} onOpen={openRecord}/><details className='record-section'><summary>Earlier commercial and cash planning examples · read only</summary><RecordTable rows={workspace.records.filter(r => r.category === 'Payments & cash flow')} onOpen={openRecord}/></details></>;
    if (route.category === 'Supplier bills') return <Payables key={companyId + projectId} company={company} project={project} preview={!!boot.preview} onOpen={openRecord}/>;
    if (route.category === 'General ledger') return <Ledger onOpen={openRecord} key={companyId + projectId} company={company} project={project} preview={!!boot.preview} />;
    if (route.category === 'Quality & safety') return <><Quality key={companyId + projectId} company={company} project={project} projects={qualityProjects} preview={!!boot.preview} /><details className='record-section'><summary>Earlier quality & HSE examples · read only</summary><RecordTable rows={workspace.records.filter(r => r.category === 'Quality & safety')} onOpen={openRecord} /></details></>;
    if (route.category === 'Cost report') return <CostReport key={companyId + projectId} company={company} projects={reportProjects} initialProject={projectId} onSource={sources} onExplain={explain} />;
    if (route.category) {
      const group = (CATEGORIES[route.area] || []).find(g => g[0] === route.category);
      return <>
<button className="back" onClick={() => nav('Projects', route.area)}>
<ArrowLeft size={18} />All {route.area.toLowerCase()}</button>
<div className="section-head">
<div>
<h2>{route.category}</h2>
<p className="muted">{group?.[1]}</p>
</div>{route.category === 'Purchase requests' && can('requests.write') && !boot.preview && <button className="primary" onClick={newRequest}>
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
</div>{directory((CATEGORIES[route.area] || []).filter(([category]) => canCategory(caps, category)), category => nav('Projects', route.area, category))}</>;
  }
  function companyArea() {
    if (route.category && !canCategory(caps, route.category)) return <Empty>This destination is not available for your role in this company.</Empty>;
    if (route.category === 'Payments & cash flow') return <><Payments key={companyId} company={company} preview={!!boot.preview} onOpen={openRecord}/><details className='record-section'><summary>Earlier commercial and cash planning examples · read only</summary><RecordTable rows={workspace.records.filter(r => r.category === 'Payments & cash flow')} onOpen={openRecord}/></details></>;
    if (route.category === 'certificates') return <Certificates key={companyId} company={company} preview={!!boot.preview} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (route.category === 'commercial') return <Commercial key={companyId} company={company} preview={!!boot.preview} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (route.category === 'payables') return <Payables key={companyId} company={company} preview={!!boot.preview} onOpen={openRecord}/>;
    if (route.category === 'ledger') return <Ledger onOpen={openRecord} key={companyId} company={company} preview={!!boot.preview} />;
    if (route.category === 'quality') return <Quality key={companyId} company={company} projects={qualityProjects} preview={!!boot.preview} />;
    if (route.category === 'vendors') return <Masters key={companyId} company={company} preview={!!boot.preview} />;
    if (route.category === 'setup') return <Foundations key={companyId} company={company} preview={!!boot.preview} onChanged={reloadFoundations} />;
    if (route.category === 'resources') return <><h2>Resources</h2><p className="muted">Plant and materials across your authorised projects.</p>{directory(COMPANY_GROUPS.flatMap(([, entries]) => entries).filter(e => ['Plant & equipment', 'Stores'].includes(e[2]) && canCategory(caps, e[2])).map(e => [e[0], e[1]]), title => nav('Company', 'Overview', title === 'Assets & fleet' ? 'Plant & equipment' : 'Stores'))}</>;
    if (route.category === 'buying') return <><Procurement onOpen={openRecord} key={companyId} company={company} projects={boot.projects.filter(p => p.company_id === companyId)} preview={!!boot.preview} /><details className='proc-history'><summary>Earlier purchase request examples</summary>{requestList(workspace.requests)}</details><h3 className='spaced'>Subcontract examples</h3><RecordTable rows={workspace.records.filter(r => r.category === 'Subcontracts')} onOpen={openRecord} /></>;
    if (route.category === 'report') return <CostReport key={companyId} company={company} projects={reportProjects} onSource={sources} onExplain={explain} />;
    if (route.category) {
      return <>
<button className="back" onClick={() => nav('Company')}>
<ArrowLeft size={18} />Company directory</button>
<div className="section-head">
<h2>{route.category === 'buying' ? 'Buying & subcontractors' : route.category === 'vendors' ? 'Contacts & catalogue' : route.category}</h2>
<span className="muted">Across this company</span>
</div>{route.category === 'buying' ? <>{requestList(workspace.requests)}<h3 className="spaced">Subcontracts</h3>
<RecordTable rows={workspace.records.filter(r => r.category === 'Subcontracts')} onOpen={openRecord} />
</> : <RecordTable rows={workspace.records.filter(r => r.category === route.category || route.category === 'Stores' && r.category === 'Materials & waste')} onOpen={openRecord} />}</>;
    }
    return <>
<p className="intro">Company-wide work, grouped by purpose. Each project keeps the same source records.</p>{COMPANY_GROUPS.map(([group, entries]) => [group, entries.filter(e => canCategory(caps, e[2]))]).filter(([, entries]) => entries.length).map(([group, entries]) => <section className="company-group" key={group}>
<h2>{group}</h2>{directory(entries.map(e => [e[0], e[1]]), title => nav('Company', 'Overview', entries.find(e => e[0] === title)[2]))}</section>)}</>;
  }
  function modalBody() {
    if (modal.type === 'certificates') return <Certificates key={companyId+modal.id} company={company} preview={!!boot.preview} initialRecord={modal.id} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (modal.type === 'commercial') return <Commercial key={companyId+(modal.id||modal.estimate)} company={company} preview={!!boot.preview} initialRecord={modal.id} initialEstimate={modal.estimate} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (modal.type === 'estimates') return <Estimates key={companyId+modal.id} company={company} preview={!!boot.preview} initialRecord={modal.id} onChanged={reloadFoundations} onOpen={openRecord}/>;
    if (modal.type === 'payments') return <Payments key={companyId+modal.id} company={company} preview={!!boot.preview} initialRecord={modal.id} onChanged={refresh} onOpen={openRecord}/>;
    if (modal.type === 'payables') return <Payables key={companyId+modal.id} company={company} preview={!!boot.preview} initialRecord={modal.id} onChanged={refresh} onOpen={openRecord}/>;
    if (modal.type === 'ledger') return <Ledger onOpen={openRecord} key={companyId + modal.id} company={company} preview={!!boot.preview} initialRecord={modal.id} onChanged={refresh} />;
    if (modal.type === 'quality') return <Quality key={companyId + modal.id} company={company} projects={qualityProjects} preview={!!boot.preview} initialRecord={modal.id} onChanged={refresh} />;
    if (modal.type === 'masters') return <Masters key={companyId + modal.id} company={company} preview={!!boot.preview} initialRecord={modal.id} onChanged={refresh} />;
    if (modal.type === 'account') return <Account mode={boot.mode} onSetup={onSetup} onSignOut={onSignOut} />;
    if (modal.type === 'budget') return <Foundations key={modal.id} company={company} preview={!!boot.preview} initial='budget' initialRecord={modal.id} onChanged={reloadFoundations} />;
    if (modal.type === 'procurement') return <Procurement onOpen={openRecord} key={companyId + modal.id} company={company} projects={boot.projects.filter(p => p.company_id === companyId)} preview={!!boot.preview} initialRecord={modal.id} />;
    if (modal.type === 'loading') return <p role="status">Loading…</p>;
    if (modal.type === 'error') return <ErrorBox message={modal.error} />;
    if (modal.type === 'examples') return <Examples workspace={modal.workspace} company={company} projects={boot.projects.filter(p => p.company_id === companyId)} initialProject={projectId} actorId={boot.actor.id} onVisit={(feature, selectedProject) => {
      close();
      setProjectId(selectedProject);
      nav(feature.global, feature.area, feature.category);
    }} />;
    if (modal.type === 'request') return <RequestDetail key={modal.record.id} request={{
      ...modal.record,
      can_edit: modal.record.can_edit && !boot.preview,
      can_review: modal.record.can_review && !boot.preview
    }} {...contextFor(modal.record)} onChanged={refresh} onEdit={r => setModal({
      type: 'edit',
      title: 'Revise purchase request',
      record: r
    })} />;
    if (modal.type === 'record') return <RecordDetail record={modal.record} {...contextFor(modal.record)} onOpen={openRecord} />;
    if (['new', 'edit'].includes(modal.type)) {
      const p = modal.record ? boot.projects.find(p => p.id === modal.record.project_id) : project;
      return <RequestForm company={company} project={p} vendors={workspace?.vendors || []} canPrice={can('pricing.read')} items={(workspace?.items || []).filter(i => i.project_id === p.id)} existing={modal.record} onSaved={r => {
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
<p>{r.display_reference || r.id} · {contextFor(r).project || 'Company'} · {r.location}</p>
</div>
<CaretRight size={20} />
</button>)}</div> : <Empty>No matching records. Try a record ID, location, supplier or work description.</Empty>}</>;
    if (modal.type === 'sources') return <>
<p className="eyebrow">{modal.report.meta.company.name} · {modal.report.meta.project?.name || 'Company scope'} · {modal.report.meta.currency}</p>
<p className="muted">Snapshot {modal.report.snapshot} · {modal.report.meta.asOf}</p>{modal.rows.map(r => <section className="record-section" key={r.id}>
<h3>{r.id} · {r.name}</h3>
<dl className="facts">{[['original_budget', 'Original budget'], ['revised_budget', 'Revised budget'], ['committed', 'Issued commitments'], ['incurred', 'Incurred cost'], ['cash', 'Cash paid'], ['forecast', 'Forecast final cost']].map(([key, label]) => <div key={key}>
<dt>{label}</dt>
<dd>{amount(r[key], modal.report.meta.currency)}</dd>
</div>)}</dl>
<p className="notice">{r.source}<small>Illustrative opening snapshot; original JAKH transaction documents have not been imported.</small>
</p>{r.budget_sources?.length > 0 && <div><h4>Approved budget allocations</h4>{r.budget_sources.map(f => <p key={f.id}>{f.title} · revised budget change {amount(f.budget_delta, modal.report.meta.currency)} · release change {amount(f.release_delta, modal.report.meta.currency)} <button className='text-button' onClick={() => openRecord(f.document_id)}>Open budget<ArrowRight size={15} /></button></p>)}</div>}{r.transaction_sources?.length > 0 && <div><h4>Local transaction additions</h4>{r.transaction_sources.map(f => <p key={f.id}>{f.kind} · {amount(f.amount, modal.report.meta.currency)} · {f.source_id} {f.order_id && canOpenOrderSource(r) && <button className='text-button' onClick={() => openRecord(f.order_id)}>Open {f.order_id}<ArrowRight size={15} /></button>}</p>)}</div>}
</section>)}</>;
    if (modal.type === 'explain') return <>
<p className="eyebrow">{modal.report.meta.company.name} · {modal.report.meta.project?.name || 'Company scope'}</p>
<p className="notice">Calculated explanation<small>These statements come from report rules and source totals. No generative AI service is connected.</small>
</p>{modal.report.findings.map(f => <section className="record-section" key={f.id}>
<h3>{f.id === 'variance' ? 'Budget versus forecast' : f.id === 'driver' ? 'Largest cost pressure' : f.id === 'cash' ? 'Cash is separate' : f.id === 'local_transactions' ? 'Local transaction additions' : 'Data coverage'}</h3>
<p>{f.text}</p>{f.sourceIds.length > 0 && <button className="text-button" onClick={() => sources(modal.report.rows.filter(r => f.sourceIds.includes(r.id)), modal.report)}>Inspect supporting items<ArrowRight size={18} />
</button>}</section>)}<p className="muted">Snapshot {modal.report.snapshot} · {modal.report.meta.rules}. Suggestions and external commitments require human review.</p>
</>;
  }
  return <div className={`shell ${route.global === 'Home' ? 'home-shell' : ''}`}>
<a className="skip-link" href="#main-content">Skip to workspace</a>
<aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
<button className="brand" onClick={() => nav('Home')}>Builder ERP</button>
<p className="brand-company">{company?.name || 'Construction workspace'}</p>
<nav aria-label="Main navigation">{GLOBALS.filter(([title]) => globalVisible(title)).map(([title, Icon]) => <button key={title} aria-current={route.global === title ? 'page' : undefined} className={route.global === title ? 'global-link active' : 'global-link'} onClick={() => nav(title)}>
<Icon size={25} weight={route.global === title ? 'fill' : 'regular'} />{title}</button>)}</nav>
<div className="sidebar-footer">Built around your work.<br />
<span>{boot?.mode === 'local' ? 'Local workspace' : 'Local sample workspace'}</span>
</div>
</aside>
<div className="workspace">
<header className="topbar"><button className="home-brand" onClick={() => nav('Home')}>Builder<span> ERP</span></button>
<button className="icon-button mobile-menu" aria-label="Toggle main navigation" onClick={() => setMobileNav(v => !v)}>
<List size={25} />
</button>
<label className="company-select">
<span className="sr-only">Company</span>
<select value={companyId} onChange={e => switchCompany(e.target.value)} disabled={!boot || !companyId}>{!companyId && <option value="">No business scope</option>}{boot?.companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
</label>
<form className="search" onSubmit={doSearch}>
<MagnifyingGlass size={21} />
<input aria-label="Search company records" placeholder="Search projects, documents, contracts…" value={search} onChange={e => setSearch(e.target.value)} maxLength={120} disabled={!companyId} required />
<button type="submit" className="sr-only">Search</button>
</form>
<button className="examples-button" aria-label="Explore examples" onClick={openExamples} disabled={!boot || !companyId}>
<Question size={21} /><span>Examples</span>
</button>
<div className="profile">
<button className="profile-button" disabled={!!boot?.preview} aria-label="Your account and sign-in" onClick={() => setModal({
            type: 'account',
            title: 'Your account'
          })}><span className="avatar">{boot?.actor.name.split(' ').slice(0, 2).map(n => n[0]).join('') || 'B'}</span>
<div>
<strong>{boot?.actor.name || 'Ahmed Al Mansoori'}</strong>
<small>{boot?.preview ? 'Access preview · Read only' : ROLE_BY_ID[boot?.actor.role]?.name || boot?.actor.role || 'Loading…'}</small>
</div>
</button>
</div>
</header>
{boot?.preview && <div className="preview-banner"><span>Previewing {boot.actor.name} · Read only · Live permissions</span><button onClick={() => previewUser(null)}>Return to {boot.preview.name.split(' ')[0]}’s workspace</button></div>}
<main id="main-content" tabIndex={-1}>
{!['Home', 'Access'].includes(route.global) && <div className="project-header">
<div>
<h1>{pageTitle || 'Builder ERP'}</h1>
<p>{route.global === 'Projects' ? `${project?.location} · ${project?.phase} · ${new Date().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}` : route.global === 'Company' ? 'Company-wide operations and shared information' : route.global === 'Tenders' ? 'From opportunity to a confident bid.' : 'Your reviews and requests, across this company.'}</p>
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
</div>}</div>}{route.global === 'Projects' && <nav className="project-nav" aria-label="Project areas">{AREAS.filter(areaVisible).map(area => <button key={area} className={route.area === area ? 'selected' : ''} aria-current={route.area === area ? 'page' : undefined} onClick={() => nav('Projects', area)}>{area}</button>)}</nav>}<div className="content">
<ErrorBox message={error} retry={boot ? refresh : () => location.reload()} />{boot && !companyId && !['Home', 'Organisation', 'Access'].includes(route.global) && <Empty>No company access is assigned. An access administrator can review the required role and scope.</Empty>}{loading && !error && <div className="loading" role="status">Loading your workspace…</div>}{workspace && !loading && <>{route.global === 'Home' ? !company ? <section className="workspace-welcome"><p className="eyebrow">YOUR WORKSPACE</p><h1>Your workspace is ready.</h1><p className="muted">No business scope has been assigned to this account.</p><div className="inline-actions">{boot.actor.organisation_admin && <button className='primary' onClick={() => nav('Organisation')}>Manage companies</button>}{boot.actor.access_admin && <button className='secondary' onClick={() => nav('Access')}>Manage users & access</button>}</div></section> : <Landing boot={boot} company={company} workspace={workspace} projectId={projectId} setProjectId={setProjectId} onVisit={d => nav(d.section, d.area || 'Overview', d.category || '')} /> : route.global === 'Organisation' ? boot.actor.organisation_admin && !boot.preview ? <Organisation onChanged={reloadFoundations} /> : <Empty>Organisation administration is restricted.</Empty> : route.global === 'Access' ? boot.actor.access_admin && !boot.preview ? <Access actorId={boot.actor.id} onPreview={previewUser} /> : <Empty>User administration is restricted.</Empty> : !globalVisible(route.global) ? <Empty>This destination is not available for your role.</Empty> : route.global === 'Projects' ? projectArea() : route.global === 'Company' ? companyArea() : route.global === 'Tenders' ? <>
<Estimates key={companyId} company={company} preview={!!boot.preview} onChanged={reloadFoundations} onOpen={openRecord}/><details className='record-section'><summary>Earlier opportunity and tender examples · read only</summary><RecordTable rows={workspace.records.filter(r => r.area === 'Tenders')} onOpen={openRecord}/></details>
</> : <>
<section>
<div className="section-head">
<h2>Awaiting your review</h2>
</div>{[...(workspace.client_certificates || []), ...(workspace.client_invoices || [])].filter(r=>r.can_review).map(r=><button className='budget-work-link' key={r.id} onClick={()=>openRecord(r.id)}><strong>{r.title}</strong><span>{r.state_label} · {amount(r.total,r.currency)}</span><ArrowRight size={18}/></button>)}{(workspace.commercial_offers || []).filter(r=>r.can_review).map(r=><button className='budget-work-link' key={r.id} onClick={()=>openRecord(r.id)}><strong>{r.title}</strong><span>{r.state_label} · {amount(r.net_amount,r.currency)}</span><ArrowRight size={18}/></button>)}{(workspace.boq_intakes || []).filter(r=>r.can_review).map(r=><button className='budget-work-link' key={r.id} onClick={()=>openRecord(r.estimate_id)}><strong>{r.title}</strong><span>BOQ intake · Independent file review · {r.id}</span><ArrowRight size={18}/></button>)}{(workspace.estimate_documents || []).filter(r => r.can_review).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Estimate approval · Revision {r.revision} · {amount(r.totals.company_selling,company.currency)}</span><ArrowRight size={18}/></button>)}{(workspace.payment_documents || []).filter(r => r.can_review).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Payment approval · {amount(r.total,r.currency)}</span><ArrowRight size={18}/></button>)}{(workspace.payable_documents || []).filter(r => r.can_review).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Supplier {r.kind} · {r.state_label} · {amount(r.total,r.currency)}</span><ArrowRight size={18}/></button>)}{(workspace.ledger_entries || []).filter(r => r.can_review).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Journal posting · {amount(r.company_total, company.currency)}</span><ArrowRight size={18} /></button>)}{(workspace.quality_cases || []).filter(c => c.can_review).map(c => <button className='budget-work-link' key={c.id} onClick={() => openRecord(c.id)}><strong>{c.title}</strong><span>NCR · {c.state_label} · {c.project}</span><ArrowRight size={18} /></button>)}{(workspace.master_reviews || []).map(p => <button className='budget-work-link' key={p.id} onClick={() => openRecord(p.id)}><strong>{p.name}</strong><span>Supplier terms · Independent review{p.stale ? ' · Needs revision' : ''}</span><ArrowRight size={18} /></button>)}{(workspace.budget_documents || []).filter(d => d.can_review).map(d => <button className='budget-work-link' key={d.id} onClick={() => openRecord(d.id)}><strong>{d.title}</strong><span>Budget approval · {amount(d.approval_amount, company.currency)}</span><ArrowRight size={18} /></button>)}{typedRequestList((workspace.material_requests || []).filter(r => r.can_approve))}{requestList(workspace.requests.filter(r => r.can_review))}</section>
<section className="spaced">
<div className="section-head">
<h2>Your drafts & assigned work</h2>
</div>{[...(workspace.client_certificates || []), ...(workspace.client_invoices || [])].filter(r=>r.my_draft).map(r=><button className='budget-work-link' key={r.id} onClick={()=>openRecord(r.id)}><strong>{r.title}</strong><span>{r.state_label}</span><ArrowRight size={18}/></button>)}{(workspace.commercial_offers || []).filter(r=>r.my_draft).map(r=><button className='budget-work-link' key={r.id} onClick={()=>openRecord(r.id)}><strong>{r.title}</strong><span>{r.state_label}</span><ArrowRight size={18}/></button>)}{(workspace.estimate_documents || []).filter(r => r.my_draft).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Estimate · {r.state_label}</span><ArrowRight size={18}/></button>)}{(workspace.payment_documents || []).filter(r => r.my_draft || r.can_record).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>{r.state_label}</span><ArrowRight size={18}/></button>)}{(workspace.payable_documents || []).filter(r => r.my_draft).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Supplier {r.kind} · {r.state_label} · {amount(r.total,r.currency)}</span><ArrowRight size={18}/></button>)}{(workspace.ledger_entries || []).filter(r => r.my_draft).map(r => <button className='budget-work-link' key={r.id} onClick={() => openRecord(r.id)}><strong>{r.title}</strong><span>Journal · {r.state_label}</span><ArrowRight size={18} /></button>)}{(workspace.quality_cases || []).filter(c => (c.my_case || c.my_action) && !['closed', 'cancelled'].includes(c.state)).map(c => <button className='budget-work-link' key={c.id} onClick={() => openRecord(c.id)}><strong>{c.title}</strong><span>NCR · {c.state_label} · Due {dueLabel(c.due_date)}</span><ArrowRight size={18} /></button>)}{(workspace.budget_documents || []).filter(d => d.author_id === boot.actor.id && ['draft', 'returned', 'submitted'].includes(d.state)).map(d => <button className='budget-work-link' key={d.id} onClick={() => openRecord(d.id)}><strong>{d.title}</strong><span>Budget · {d.state}</span><ArrowRight size={18} /></button>)}{typedRequestList((workspace.material_requests || []).filter(r => r.requester_id === boot.actor.id))}{requestList(workspace.requests.filter(r => r.requester_id === boot.actor.id))}</section>
</>}</>}</div>
</main>
</div>{modal && <Modal title={modal.title} onClose={close} wide={['payables', 'ledger', 'quality', 'masters', 'account', 'budget', 'procurement', 'request', 'new', 'edit', 'sources', 'examples'].includes(modal.type)}>{modalBody()}</Modal>}</div>;
}
