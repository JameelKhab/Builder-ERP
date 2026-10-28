import { canCategory } from '../shared/access.mjs';
import { CATEGORIES, COMPANY_GROUPS } from './catalogue.js';

// Built from the same authorised workspace used by the app, never an unscoped fixture index.
export function exampleGroups(workspace, projectId, actorId) {
  const records = workspace.records;
  const projectRecords = records.filter(r => r.project_id === projectId);
  const projectRequests = (workspace.material_requests||workspace.requests).filter(r => r.project_id === projectId);
  const reportRows = (workspace.report?.rows || []).filter(r => r.project_id === projectId);
  const feature = (title, description, rows, global, area = 'Overview', category = '') => ({
    title,
    description,
    count: rows.length,
    examples: rows.slice(0, 2).map(r => ({
      id: r.id,
      title: r.title || r.name
    })),
    global,
    area,
    category
  });
  return [['Start here', [feature('My Work', 'Review another person’s request, or resume one of your own drafts and returned requests.', workspace.requests.filter(r => r.can_review || r.requester_id === actorId), 'My Work'), feature('Tenders', 'Compare an estimating example with an earlier bid/no-bid decision.', records.filter(r => r.area === 'Tenders'), 'Tenders')]], ...Object.entries(CATEGORIES).map(([area, categories]) => [area, categories.map(([title, description]) => feature(title, description, title === 'Purchase requests' ? projectRequests : title === 'Orders & deliveries' ? (workspace.purchase_orders||[]).filter(r=>r.project_id===projectId).map(r=>({...r,title:r.vendor})) : title === 'Cost report' ? reportRows : projectRecords.filter(r => r.category === title), 'Projects', area, title))]), ['Company', COMPANY_GROUPS.flatMap(([, entries]) => entries.map(([title, description, category]) => feature(title, description, category === 'report' ? workspace.report?.rows || [] : category === 'vendors' ? workspace.vendors : category === 'buying' ? [...workspace.requests, ...records.filter(r => r.category === 'Subcontracts')] : records.filter(r => r.category === category), 'Company', 'Overview', category)))]].map(([group, features]) => [group, features.filter(f => f.global === 'My Work' || f.global === 'Tenders' && (!workspace.capabilities || workspace.capabilities.includes('tenders.read')) || f.category && (!workspace.capabilities || canCategory(workspace.capabilities, f.category)))]).filter(([, features]) => features.length);
}
