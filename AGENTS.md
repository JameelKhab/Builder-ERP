# Builder ERP working instructions

## Scope and authority

- Build an original construction ERP from scratch. Do not copy, translate, adapt or depend on Odoo application code or import the old Odoo project into this repository.
- The existing JAKH demo was used as a read-only requirements/evidence source. Do not modify it while working on the replacement.
- Develop and validate locally. Do not deploy to jakh.net, demo.jakh.net or another production destination without a later explicit user instruction. Do not add automatic deployment pipelines as part of routine development.
- GitHub is the intended remote project record, but the user's latest instruction is to keep everything committed locally for now. Keep meaningful changes and validation in local Git. Do not push to GitHub until the user resumes syncing; that is separate from any deployment instruction.
- Current phase: the user explicitly authorised implementation on 28 October 2026. The user selected choice 2 (Project briefing), with clearer categories and rich information. The first working local increment is in app/. Do not ask again for permission to build. Follow the user's current instruction when advancing the work.

## Read before substantial work

Read README.md, docs/requirements.md, docs/decisions.md and the latest entry in docs/project-log.md. Use the study for supporting detail. Update these records when requirements or decisions change; distinguish confirmed user requirements from design proposals.

## Product principles

- Simplicity means clear task routes, stable navigation, progressive detail and preserved context. Do not remove essential controls merely to reduce menu counts.
- One canonical record can have project and company views. Do not merge distinct commercial, operational and accounting stages into an ambiguous status or number.
- Carry legal company, project, work item/package, location/system, owner and next action through relevant workflows.
- Enforce company/project/role permissions in services, reports, exports, search and AI, not just the visible menu.
- Use exact monetary arithmetic and explicit currencies/rate snapshots. Separate budget, commitments, incurred cost, cash and completion forecasts.
- Every report needs a findings summary generated from the complete authorised filtered result. Controlled logic calculates and verifies facts; optional AI explains supported findings and prepares reviewable drafts.
- AI must remain useful and contextual. It must not silently approve, post, pay, close, change bank details or make external commitments.

## Recordkeeping and verification

- Log completed work, relevant checks, limitations and next steps in docs/project-log.md.
- Keep credentials and private environment settings out of Git. Do not preserve the login supplied in chat.
- Preserve historical study revisions and evidence provenance. A visible field or menu is not proof of an enforced end-to-end workflow; an empty sampled list is not proof of absence.
- Run checks appropriate to the actual change. Do not claim a prototype, security test, user study, financial reconciliation or deployment that was not performed.
- Keep temporary work under .work/ and deliverable documentation under docs/. Do not commit generated dependency or render-cache directories.
