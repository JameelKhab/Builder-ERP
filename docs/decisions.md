# Decisions and open questions

Last updated: 28 October 2026, Asia/Dubai.

## Confirmed user requirements

| ID | Requirement | Source / consequence |
| --- | --- | --- |
| D-001 | Original ERP, no Odoo application code | Build from scratch. Existing screens supply business evidence only. |
| D-002 | Simple, easy-to-find interface with rich information | Avoid busy/repetitive navigation, repeated entry and unclear handoffs. |
| D-003 | Complete construction lifecycle | Tender/bidding through tower construction, handover, snagging and settlement. |
| D-004 | Preserve all twelve requested capabilities | NCR, assets, cash/payments, subcontracting, item costs, waste, changes, programme/delay, KPIs, records, approvals and transparency. |
| D-005 | Multiple companies and currencies | Legal entity boundaries and vendor-based purchase currencies are foundational. |
| D-006 | Project and company reports | Use consistent definitions, filters and traceable source data. |
| D-007 | Findings summary above every report | Build logic that reads the report results; summaries must match the full authorised filtered population. |
| D-008 | Strategic AI across the ERP | Fit assistance to useful tasks and measure benefit; preserve financial/approval authority. |
| D-009 | Builder-ERP is the project repository | Use https://github.com/JameelKhab/Builder-ERP to record work. |
| D-010 | Work locally; no jakh.net deployment yet | Keep the existing site unchanged until the user explicitly instructs deployment after local completion. |
| D-011 | Keep everything committed locally for now | After the GitHub permission rejection, the user explicitly deferred remote syncing. Do not retry a push until instructed. |
| D-012 | Start building with quality | Explicitly authorised implementation on 28 October 2026; no need to re-request implementation permission. |
| D-013 | Choice 2 with clearer categories | User selected Project briefing and emphasised easy reading, easy operation and rich information. Refined before implementation. |
| D-014 | Product name: Builder ERP | Explicit user correction; apply to the application, titles and exports. Company identities remain separate. |
| D-015 | Examples for every provided feature | Add discoverable, meaningful scenarios in every supplied company/project and preserve existing local work. |

## Proposed design decisions, pending validation

| ID | Proposal | Validation needed |
| --- | --- | --- |
| P-001 | Four starting points: My Work, Tenders, Projects, Company | Test first destination choices and task completion with representative users. |
| P-002 | Seven stable project areas | Test especially Company, Costs & Contracts and snag discovery; preserve stable relative order. |
| P-003 | Canonical cases with contextual views | Walk NCR, change, subcontract package and handover journeys without duplicate entry. |
| P-004 | Quote -> agreement -> permitted vendor preference for currency defaults | Confirm actual supplier arrangements, exceptions and reapproval thresholds. |
| P-005 | Deterministic report findings with optional AI explanation | Prove numerical/source consistency, missing-data handling, permission isolation and fallback behaviour. |
| P-006 | Source-linked search and explanations before predictive AI | Evaluate useful accuracy and effort against a baseline; prediction needs adequate history. |
| P-007 | Explicit group reports beyond single-company/project views | Define management aggregation versus financial consolidation and elimination policies. |

## Unresolved implementation inputs

- Legal entities, jurisdictions, branches, joint ventures and intercompany operations.
- Accounting standards/localisation, functional currencies, project control currencies, presentation currencies, fiscal calendars and FX sources.
- Roles, approval limits, delegation, external-party access and separation of duties.
- Contract types, cost/work breakdown, tower/floor/unit/system hierarchy and programme ownership/integration.
- Mobile, offline, language, accessibility and volume requirements.
- AI provider/data region/retention policy, restricted data categories, pilot tasks and evaluation sets.
- Representative-user validation of the selected direction; production architecture, delivery priorities and migration/cutover strategy.

These are open inputs, not permission to silently replace requested functions with integrations or remove them from scope.

## First local implementation decisions

- The overview uses Decisions needed, Site & programme and Cost & cash. Deeper information follows purpose-labelled directories and record details, preserving the four/seven navigation structure.
- React/Vite and an original Express service with SQLite support the first persistent local increment. This is a local implementation choice, not a decision to run a multi-user production ERP on this topology.
- Exact decimal strings/BigInt arithmetic, service-enforced scope, revision checks, independent approval and append-only events are foundational. Current currency support assumes two minor-unit digits (sample AED/EUR/USD).
- Report facts are deterministic; Explain findings uses those same facts and source items. No external AI model, payment service or accounting system is connected.
- The local sample actor is server-selected. Production identity, policy administration, audit hardening, backup/recovery and localisation remain required.
- Preserve the entire requested scope in the implementation coverage matrix. A navigable sample register is not a completed workflow.
