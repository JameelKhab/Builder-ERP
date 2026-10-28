import React from 'react';
import { AddressBook, Buildings, ShoppingCart, Scales, Files, Notebook, Crane, Users, ChartBar, Wallet, ShieldCheck, ArrowUpRight, ArrowRight } from '@phosphor-icons/react';
import { destinationsFor } from '../shared/access.mjs';
const icons = {
  AddressBook,
  Buildings,
  ShoppingCart,
  Scales,
  Files,
  Notebook,
  Crane,
  Users,
  ChartBar,
  Wallet,
  ShieldCheck
};
export function Landing({
  boot,
  company,
  workspace,
  onVisit,
  projectId,
  setProjectId
}) {
  const caps = [...workspace.capabilities, ...(boot.actor.organisation_admin && !boot.preview ? ['organisation.manage'] : []), ...(boot.actor.access_admin && !boot.preview ? ['access.manage'] : [])];
  const projectCaps = [...new Set(boot.grants.filter(g => g.company_id === company.id && (g.project_id === '*' || g.project_id === projectId)).flatMap(g => g.capabilities))];
  const destinations = destinationsFor(caps).filter(d => d.section !== 'Projects' || destinationsFor(projectCaps).some(p => p.id === d.id));
  const projects = boot.projects.filter(p => p.company_id === company.id);
  const reviews = (workspace.quality_cases || []).filter(c => c.can_review).length + (workspace.master_reviews || []).length + workspace.requests.filter(r => r.can_review).length + (workspace.material_requests || []).filter(r => r.can_approve).length + (workspace.budget_documents || []).filter(d => d.can_review).length;
  const own = (workspace.quality_cases || []).filter(c => (c.my_case || c.my_action) && !['closed', 'cancelled'].includes(c.state)).length + workspace.requests.filter(r => r.requester_id === boot.actor.id && ['draft', 'returned'].includes(r.status)).length + (workspace.material_requests || []).filter(r => r.requester_id === boot.actor.id && r.state === 'draft').length + (workspace.budget_documents || []).filter(d => d.author_id === boot.actor.id && ['draft', 'returned'].includes(d.state)).length;
  return <div className="landing">
    <div className="landing-intro"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>A clear place to start.</h1><p>Choose what you need to work on. Everything stays within {company.name}.</p></div>
      <div className="scope-note"><ShieldCheck size={21} /><span>Built around your access<small>Only your permitted destinations are shown.</small></span></div></div>
    {(caps.includes('requests.read') || caps.includes('budgets.approve') || caps.includes('budgets.write') || caps.includes('quality.read')) && <section className="start-strip" aria-label="Your next steps"><div><span className="eyebrow">MY WORK</span><h2>{reviews ? `${reviews} item${reviews === 1 ? ' needs' : 's need'} your review` : own ? `${own} draft${own === 1 ? '' : 's'} to continue` : 'Your next steps, in one place'}</h2><p>{own} draft or assigned item{own === 1 ? '' : 's'} · {projects.length} accessible project{projects.length === 1 ? '' : 's'}</p></div><button className="primary" onClick={() => onVisit({
        section: 'My Work'
      })}>Open my work<ArrowRight size={19} /></button></section>}
    {projects.length > 0 && <div className="landing-project"><label htmlFor="landing-project">Project for your next task</label><select id="landing-project" value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select><span>Company-wide destinations include all your authorised projects.</span></div>}
    {['Project delivery', 'Company operations', 'Administration'].map(group => {
      const rows = destinations.filter(d => d.group === group);
      if (!rows.length) return null;
      return <section className="destination-group" key={group}><div className="destination-heading"><h2>{group}</h2><span>{rows.length} destination{rows.length === 1 ? '' : 's'}</span></div><div className="destination-grid">{rows.map(d => {
            const Icon = icons[d.icon];
            return <button key={d.id} className="destination-card" onClick={() => onVisit(d)}><div className="destination-symbol"><Icon size={26} /><ArrowUpRight size={19} /></div><h3>{d.title}</h3><p>{d.id === 'buying' && !projectCaps.includes('commercial.read') ? 'Site requests and approved supplier quotations.' : d.description}</p><span className="destination-open">Open {d.title.toLowerCase()}<ArrowRight size={16} /></span></button>;
          })}</div></section>;
    })}
    <p className="landing-foot">Local development · Fictional examples. NCRs, contacts, catalogue, project setup, budget control, procurement, deliveries, material use, reports and access controls work locally; other destinations contain sample registers.</p>
  </div>;
}
