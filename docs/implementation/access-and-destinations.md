# Destination workspace and access foundation

Implemented locally on 28 October 2026 against the supplied **Builder-ERP-Full-Comparison.pdf** (SHA-256 `512702d7d8a5eb2762975562204f3be92d495541dd18e9e904a82f87cd7d1928`). The supplied copy matches the repository's comparison report. This increment advances the full migration; it does not complete or certify it.

## User direction and design

The user requested a landing page that makes permitted destinations clear, borrowing the access-dependent launcher idea while avoiding Odoo's appearance. Builder now opens on Home: a quiet, original layout with descriptive destination cards, a selected company, project context, search and the user's next requests. Its existing Project briefing remains available inside Projects.

Destinations are grouped into Project delivery, Company operations and Administration. Each card opens existing work. Access controls determine the available cards, project areas, categories, example guide and report choices. Project cards use the selected project's grants; company cards use the company's permitted work. No unavailable payroll/AP/AR/timekeeping workflow is advertised as operational.

## Fresh source review before implementation

Read-only browser inspection of `https://demo.jakh.net/` examined:

1. **Users & Access → Access Presets:** 27 named presets, project scope, business-read-only flag, finance document scope, availability, version and active status.
2. **Site Engineer preset:** selected-project default; quantities, measurements and supporting documents; separate designated approvers; construction cost fields hidden; approved no-price technical role; workspace/menu choices separate from underlying rights. The source explicitly warns that hiding a menu does not remove access.
3. **Manage Users → Manage Access, Project Manager demonstration account:** identity/job title, preset, allowed/default companies, project scope, approved additional roles, reason and Review Effective Access. The source warns that native accounting/purchasing/stock access may remain company-wide even when construction records are assigned-project-only.

Screenshots and accessibility evidence are in `docs/validation/access/source/`. No source user, permission or business record was saved or changed. The form was cancelled. No Odoo source code was imported, copied or adapted. Visible controls establish the intended source contract; no adversarial permission tests were run against JAKH.

The 27 source role names are mapped, but only Site Engineer was examined at detailed preset level in this pass. Other Builder capability sets are explicit original least-privilege proposals for implemented domains, **not verified one-to-one translations of all inherited JAKH permissions**. They need role-by-role acceptance before real migration.

## Implemented behaviour

| Area | Behaviour and example |
|---|---|
| Home | Ahmed sees nine destinations. Mohammed's site-engineer preview sees four: Projects, Buying, Documents and Resources. No commercial, HR, tender, report or administration cards. |
| Scope | A role belongs to a legal company and either one project or all that company's projects/company records. Multiple grants combine. A role on Garden Residences does not widen Harbour Tower access. |
| Requests | Site engineers see quantities and supplier currency without monetary amounts, FX snapshots, cost balances or free-text commercial history notes. They can use an approved supplier quote; entering provisional prices requires pricing permission. |
| Pricing versus budgets | Procurement may see request pricing without receiving budgets, forecasts, cash, cost reports or sourcing allowance through embedded request items. |
| Reports/search/related records | The server filters by domain capability and company/project scope before assembling results. Findings, supporting rows, CSV data and deterministic explanation share the same permitted report population. Restricted related links are omitted. |
| People | HR records have their own capability; project management and financial visibility do not imply HR access. |
| Administration | Local access administrators can review existing users, change business roles/scope/limits, disable/re-enable accounts, and inspect changes. Self-access and changes to access administrators are blocked by this editor. Administrator authority does not itself grant business/financial rights. |
| Review and audit | The editor shows effective role permissions before Apply, requires a reason and current revision, validates company/project relationships, commits changes transactionally and records before/after grants. History rejects update/delete through ordinary application database statements. |
| Revocation | Every API request checks current account status and session access revision; a changed user's existing sessions are rejected. Service-level checks also consult current grants. Disabled users cannot receive new approval work. |
| Approval | Approval requires both role capability and a separately assigned amount limit in the legal company's currency. Self-approval, stale revisions, stale quotes and excess allowance remain blocked. |
| Preview | An access administrator can preview a sample user's real permitted views. All writes are blocked at the API during preview, except leaving/changing preview or logout. Ordinary users cannot impersonate other users. |
| Presets | 27 construction role definitions, 23 assignable for current domains. AP clerk, AR clerk, Payroll officer and Timekeeper fail closed until their document/field-specific boundaries exist. These are not four completed modules. |

## Comparison traceability

| Comparison IDs | Current advancement | Still required for acceptance |
|---|---|---|
| F001 Dashboard | Original permission-dependent Home and preserved project briefing | Role walkthroughs across the complete ERP; real operational populations |
| F021 My Approvals & Activities / M32 | Scoped request review, independent authority, current-user filtering | All other workflow approvals, delegation, escalation, absence and cross-domain inbox |
| F070 Project requisitions | Domain/field controls added to existing local request flow | Unpriced site needs, buyer pricing handoff, requisition lines, RFQ/PO/receipt/returns/finance chain |
| F239 Add User | Scope retained in register; no claim of completion | Provisioning, identity provider, invitations, initial-access approval, MFA/recovery |
| F240 Manage Users / F266 Users | Existing-user access review, grant replacement, status and revision controls | Production identities, admin lifecycle, independent privileged-access review, bulk/offboarding procedures |
| F241 Access Presets | Original version-1 role vocabulary, current-domain permission matrix | Detailed source review and representative acceptance for every role; reviewed preset version upgrades/custom roles |
| F242 Advanced Native User Settings | Original controls replace the need for a native Odoo settings route | Remaining enterprise settings and integration identities; no Odoo settings/code migration |
| F252 Business Audit / M32 | Append-only request events and before/after access events | Durable external audit retention, privileged database administration controls, all domains and export audit |
| F267 Companies / M01 / M02 | Existing legal companies/projects retained; consistent grant boundaries | Company creation, tax/localisation, intercompany controls and real project membership import |

The historical comparison remains frozen to application commit `3d941a0`. Its 267 rows and 34 contracts are not silently relabelled as complete. This document is a progress overlay; all full-parity acceptance journeys remain outstanding.

## Verification and data preservation

- 46 automated tests passed after the access/policy changes: arithmetic, workflow state, persistence, full report population, all explicit role capability contracts, unknown-role denial, domain/field restrictions, mixed project roles, self-approval, invalid grants, access audit integrity, session revocation, read-only preview and ordinary-user impersonation denial.
- Production frontend build passed. Build output is local only; the legacy static-hosting package is not a production ERP backend and was not deployed.
- Browser checks covered manager Home, scope review, site-engineer preview, hidden commercial navigation, quantity-only request detail, preview exit, phone/desktop layouts, company switch and report findings. Layout evidence records the tested sizes. These are developer checks, not representative-user usability acceptance.
- Before schema version 2, SQLite's backup API saved `.work/data/builder-before-access.sqlite`. The additive schema migration preserves existing requests, records, companies, projects and events. Backups/runtime data remain ignored by Git.
- No permission grant was applied through the live browser during QA. Write-path tests use disposable databases. Source JAKH remained read-only.

## Boundaries and next construction work

This is still an explicit **local sample** with a server-selected synthetic identity, not production sign-in. Sessions use random opaque tokens and HttpOnly/SameSite cookies; loopback HTTP does not provide a production HTTPS/Secure-cookie deployment. Production identity/MFA, session lifecycle, rate limiting, recovery, administrator provisioning and security review must precede real data or network exposure.

Generic sample details have conservative field allowlists for unpriced roles; unknown fields and free-text example history are withheld. This is not a substitute for typed document/field classification and attachment/download permissions in the future migration. Existing operational titles/locations remain visible. Persisted role changes are immediate; already displayed browser content cannot be recalled.

Only purchase requests, reports and access controls are executable local workflows here. NCR, assets, waste, programme, variations, measured subcontract/client certificates, accounting, document and handover records remain examples until their typed original services and connected acceptance journeys are built. No production source export/import/reconciliation has occurred. Calculated explanations remain deterministic; no external AI is connected.

Next build sequence: verify the remaining role contracts and production identity adapter, then implement typed project/WBS/cost-code and unpriced requisition → sourcing → purchase-order → receipt states, with company/currency/approval rules and tests. Continue the comparison's connected client/subcontract certificate and cost-ledger journeys rather than treating navigation coverage as migration progress.

## Security reference

The policy follows the least-privilege, deny-by-default and per-request validation principles in the [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Session design is informed by the [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). This is implementation guidance, not a security certification.
