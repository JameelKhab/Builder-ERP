import React, { useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { exampleGroups } from './example-guide.js';

export function Examples({ workspace, company, projects, initialProject, actorId, onVisit }) {
  const [projectId, setProjectId] = useState(initialProject || projects[0]?.id || '');
  const groups = exampleGroups(workspace, projectId, actorId);
  return <div className="example-guide">
    <p className="eyebrow">Builder ERP · {company.name}</p>
    <p>Choose a feature to explore its examples. Purchase requests and cost reports work locally; the other registers show read-only construction scenarios.</p>
    <label className="field">Example project
      <select value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    </label>
    <p className="muted footnote">In the cost report, try changing scope, opening a supporting item, Explain findings and Export report. Search also finds the example IDs below.</p>
    {groups.map(([group, features]) => <section className="example-group" key={group}>
      <h3>{group === 'Company' ? 'Across the company' : group}</h3>
      <ul>{features.map(feature => <li key={feature.title}>
        <div><h4>{feature.title} <span className="example-count">{feature.count} records</span></h4>
          <p>{feature.description}</p>
          <small>{feature.examples.map(r => `${r.id} · ${r.title}`).join(' / ') || 'No records in your authorised scope.'}</small>
        </div>
        <button className="text-button" onClick={() => onVisit(feature, projectId)} aria-label={`Open ${feature.title} examples`}>Open<ArrowRight size={18} /></button>
      </li>)}</ul>
    </section>)}
    <p className="muted footnote">All examples are fictional. They demonstrate the information and handoffs; a sample record is not a posted transaction, uploaded document or completed ERP workflow.</p>
  </div>;
}
