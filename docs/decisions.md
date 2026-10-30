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
| D-011 | Historical local-only sync decision — superseded | Initially deferred after a GitHub permission rejection. On 29 October the user explicitly authorised GitHub sync and a portable handover; see D-012 below. |
| D-012 | Start building with quality | Explicitly authorised implementation on 28 October 2026; no need to re-request implementation permission. |
| D-013 | Choice 2 with clearer categories | User selected Project briefing and emphasised easy reading, easy operation and rich information. Refined before implementation. |
| D-014 | Product name: Builder ERP | Explicit user correction; apply to the application, titles and exports. Company identities remain separate. |
| D-015 | Examples for every provided feature | Add discoverable, meaningful scenarios in every supplied company/project and preserve existing local work. |
| D-016 | Full proper migration preserving JAKH logic | User rejected the shallow functional coverage and requested a full comparison, not a list of gaps supplied by them. Preserve all existing capabilities or explicitly resolve a change; original code does not mean discarding business rules. |

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

## Correction after the user's migration challenge

- The earlier discovery and initial implementation did not complete the required business-rule/data/exception mapping. Advancing the UI and sample coverage did not satisfy the migration objective.
- `docs/migration/` is the corrective baseline: 42 areas, 267 recorded navigation destinations, 21 workstreams and 34 proposed data contracts. The complete inventory comparison does not certify hidden workflow behaviour or data migration.
- Keep the selected visual direction, but add named browse routes and typed services for omitted functions, including original finance, stores, HR, configuration and integrations. No silent scope removal or third-party substitution.
- Future domain acceptance requires source evidence, business invariants, authorisation/exception tests, connected end-to-end evidence and reconciliation. The actual source export/schema, production identity, data migration/recovery and user validation remain open.

## 28 October 2026 — Original Home and scoped permissions

- User-directed: add a clear access-dependent destination landing page; retain the selected Builder project-briefing style and avoid Odoo's icon-wall appearance.
- Fresh JAKH source UI review confirmed preset/company/project/approval separation and Site Engineer's no-price intent. Builder now applies consistent service policy and field projection across implemented data surfaces.
- Original implementation choice: role grants per company/project scope, independent approval limits, separate access-administration authority, reviewed versioned changes and read-only administrator preview. Preset names are mapped; unreviewed source role inheritance is not assumed equivalent.
- AP/AR/payroll/timekeeper presets cannot be assigned while their necessary document and confidential-field controls are absent. Existing sample identities remain explicitly local; no production authentication claim.
- Historical full-comparison files remain unchanged; `implementation/access-and-destinations.md` records progress against F001/F021/F070/F239–242/F252/F266/F267 and M01/M02/M32.


## 29 October 2026 — Connected original procurement

- The user reaffirms full local completion. Maintain the entire comparison scope; tested subsets are recorded as partial and navigation/examples do not count as completed operational functions.
- Site demand is unpriced and multi-line. Product-specific quotes and supplier allocation are a separate commercial stage; vendor details determine transaction currency. Procurement author and requester both require independent approval.
- Approved allocations reserve a released sourcing allowance; issued orders replace reservations with commitments. Receipt acceptance creates stock; consumption creates operational cost. These do not manufacture accounting postings, payment, cash or a new completion forecast.
- Returns are constrained by remaining accepted lot stock and reopen expected supply. Consumption/return value uses remaining-lot allocation with residual cents on the final movement. Delivery rounding differences require future explicit reconciliation policy.
- New procurement example records are additive and transactional. Their cost additions are visible separately from unchanged illustrative opening balances. They are not a production migration.
- Operational history retains the submitted allocation references and quantities. API reads/writes use live company/project capabilities; role preview remains read only. All user/ERP work stays on this Mac and in local commits.

## 29 October 2026 — Company/project/budget implementation choices

The full local ERP remains the authorised objective. Implemented original typed project/WBS/location and budget controls from source evidence; no copying of Odoo code. Company creation does not assign business access. Organisation administration is distinct from access administration. Functional currency is fixed and supported minor units are explicit. Project ownership cannot move between legal companies.

Original baselines, later revised targets and released buying capacity are separate. Budget decisions use an independent reviewer, a dedicated limit, gross movements, current exposure and frozen project/balance revisions. Historic opening values are not relabelled as migrated approvals. New projects show unknown budgets until baseline approval. Dated forecasts and historic/period controls remain a separate dependency; current approvals use server timestamps.

Synthetic examples add a separate fictional budget reviewer with explicit limits; existing users' purchase authority does not automatically become budget authority. Local sample identity is still a release blocker for real multi-user use.


## 29 October 2026 — Local identity continuation

- Local owner setup and individual username/password accounts now replace the synthetic identity once the user opts into setup. The user chooses their own credentials; no invitations are sent automatically. Sample login is permanently disabled for a secured database.
- Scope, business approvals and administrative authority remain separate. Another administrator reviews changes to one's own authority; new owner financial approval limits begin at zero.
- Opaque sessions, local activation/recovery and recent password confirmation support independent local business decisions. This is a tested local implementation choice, not a certified production identity service. MFA/SSO, preferences, network-release hardening and source-policy equivalence remain open.

## 29 October 2026 — Company masters and buying definitions

Original party identity can be shared; commercial terms and contact details stay within the legal company. Company-wide maintenance is distinct from project access; an independent company reviewer approves supplier currencies, explicit invoice-relative payment days and effective dates. Opening payment days stay unknown. Blocking new purchasing does not prevent existing deliveries.

A product’s name never determines a pack size. Stable base units/precision, immutable product-specific pack factors and exact ratio pricing prevent silent quantity/price reinterpretation. Quote/order master snapshots preserve historical identity and require fresh review when supplier terms or order identity/address changes. Preset versions explicitly add master maintenance/review capabilities without granting financial limits. Full supplier/customer/configuration, accounting and migration scope stays open.

## 29 October 2026 — NCR lifecycle and evidence

Immediate containment is recordable before completing the investigation. An assigned independent reviewer accepts a plan and later verifies closure; reporter, owners, plan authors and all historical action completers within the cycle are excluded. Revised containment/plans require current evidence. Failed verification requires new corrective evidence; reopening preserves earlier cycles. Local files are immutable database blobs with hash and authorised attachment-only download. Consequence follow-ups do not create financial, waste, variation or schedule facts. Full quality/HSE/inspection and downstream consequence resolution remain open.

## 29 October 2026 — Original accounting controls

General journals use a single legal company and optional single project. Immutable posted facts are corrected by linked full reversal; no reset to draft. Separate journal limits and independent author/reviewer checks apply. Company chart and periods are explicit configuration, with reserved control accounts blocked from manual posting until typed subledgers exist. Exact FX conversion records visible rounding; procurement rates do not become accounting rates. Original source evidence is read-only, and the source reset-to-draft control is intentionally replaced by traceable reversal.

## 29 October 2026 — Supplier settlement and bank evidence

Payment approval, recording an offline transaction and bank clearance are distinct facts. Separate zero-default limits and independent preparer/approver/recorder/reconciler controls apply. Bank accounting aliases retain currency/control identity without executable routing credentials. Partial payments/refunds preserve remaining transaction/carrying cents; typed functional journals preserve source currency and exact FX corrections. Company-wide authority is required for multi-project batches; project findings reveal only authorised allocations. Immutable bank statement evidence can be independently voided after unmatching and replaced with a new reference. These are implementation decisions, not claims of source enforcement or full accounting compliance. Full cash policy/forecast, AR, broader bank/commercial integration and source migration remain open.

## 29 October 2026 — Estimate control and handover

Original estimate studies preserve explicit resource/currency/price-basis calculations and replacement building quantities. Approved versions lock and new revisions retain stable BOQ identities. Estimate authority is separate and defaults to zero. Project setup copies estimated cost to a draft baseline with zero released capacity; it does not imply client acceptance or a sales contract. Source cap/share behaviour and exact legacy item/header combination remain unverified and cannot be silently imported as summary groups. Sequential Builder pricing is explicitly versioned. See implementation/contracts/estimates-v1.md.

## 29 October 2026 — Reviewed workbook intake

Original XLSX/CSV intake appends direct items only after all-file reconciliation and independent data review. Original files and saved checks remain immutable; estimate/master/reviewer changes invalidate commitment. Rates use the estimate currency, quantities are per building, and product units are never inferred. Parent caps/shares remain quarantined pending source verification. Automatic mapping is progressive detail; filename and next action lead the intake card. These are implementation policies, not certified source enforcement.

## 29 October 2026 — Commercial offers and original awards

An approved estimate supplies exact scope and selling amounts; the offer separately records validity and commercial terms. Offer/award authority is independent and zero by default. Retained client acceptance evidence is reviewed by someone other than both the offer author and evidence recorder. Only that verification creates an immutable original project-allocated contract. Expired acceptance cannot be silently accepted; late recording of in-time acceptance is visibly flagged. Finance activation, invoice/retention/advance/cash balances and budget release remain distinct. These original controls strengthen independence compared with the optional role-overlap setting visible in the sampled JAKH contract. Full source enforcement/parity and contract-finance rules remain open.

## 29 October 2026 — Client certification and separate AR

Finance activation is a versioned independent decision. Cumulative measurement uses authoritative original line amounts, frozen approved predecessors and residual-cent exhaustion; unapproved revisions do not rewrite history. Technical, commercial and finance reviewers are distinct people. Separate certificate and AR limits default to zero. Invoice preparation/posting is explicit after certification, and cash/clearance remain separate. Original evidence is hashed and retained. Exclusive tax basis is explicit configuration, not an inferred jurisdictional rule. No eligible advance balance is manufactured from a ceiling; the client-advance subledger remains required. The new AR clerk can prepare client-only accounting documents and cannot access supplier/ledger/people controls. Corrections, ownership handover, richer contract finance and full migration remain open.

## 29 October 2026 — Customer receipts and shared bank evidence

Receipt approval, evidenced cash recording and independent bank matching are distinct decisions. Customer cash uses `customer_receipts.*`; the existing `receipts.write` continues to mean material delivery. Separate receipt limits default to zero. A remittance can cover multiple invoices/projects under company-wide authority; project users see only their allocation, while combined titles/files/detail stay restricted. Exact remaining AR carrying values and actual bank FX balance each project without recognising revenue twice. Full linked reversal preserves original facts and needs fresh independent decisions. The advance source sequence is request → invoice → actual settlement; advance recovery must derive from its settled subledger, never an allowance. Credits/unallocated cash, advance invoicing/recovery, broader bank integration and full migration remain open.

## 29 October 2026 — GitHub continuity (D-012)

The user now explicitly requests publishing all verified project work to JameelKhab/Builder-ERP and using it as the source of information for another laptop and possibly another ChatGPT account. This supersedes D-011 and earlier local-only Git restrictions. START-HERE.md must contain the full objective, current state, setup, validation, exact next step, remaining scope and continuation prompt. Preserve runtime data separately in a portable consistent backup; credentials and local environment remain outside Git. Development remains local and deployment is not authorised. Browser sign-in and Git credentials are separate; do not claim publication until the remote commit is verified.

## 29 October 2026 — Client advance accounting foundation

Keep one canonical client invoice source: approved certificate or approved advance. Advance principal uses a dedicated liability control that rejects manual journals; exclusive tax is explicit configuration. Separate advance authority starts at zero and aggregate approved principal consumes the original ceiling once. Cumulative recorded receipts/corrections determine paid principal/tax and original carrying values; approval and billing cannot impersonate cash. Recovery is not yet implemented: a temporary measurement guard blocks periods with paid principal rather than allowing zero recovery. The next increment must replace that guard with exact protected recovery allocations, source posting, reports, UI and examples. This is a backend foundation, not complete F092 acceptance.

## 29 October 2026 — Recovery groundwork continuity

Preserve exact partial-principal cents conservatively: floor to cents and exhaust principal/tax on final settlement. No saved advances exist and posted invoice/receipt amounts are unchanged. Schema 17 adds immutable future recovery rows and unconfigured tax/FX policy fields; no recovery service is active. Planned taxed recovery requires explicit original-tax policy. Planned foreign non-monetary recovery uses historical advance consideration for related revenue, with bank FX separate. These are original design choices pending connected implementation and acceptance; see the recovery contract and continuation notes. Keep the temporary guard until all protections are implemented.

## 29 October 2026 — Connected advance recovery

Certificate finance approval now atomically freezes invoice-level principal/tax/original carrying allocations; unposted certificates already reserve them. Explicit original-tax policy separates work tax and recovered tax. Foreign non-monetary principal uses historical consideration in related revenue, while original-tax carrying differences use separately selected gain/loss accounts. Pending approved cash reversals reduce availability and every reversal transition preserves certified principal/tax. The temporary paid-advance guard is replaced by these controls. Existing no-advance snapshots remain compatible. Dedicated advance UI/report/examples and approved correction paths remain open.

## 29 October 2026 — Advance destination, reporting and sample continuity

- Reuse the canonical invoice form and receipt/certificate destinations. One request detail shows funding, cash, recovery, evidence and next action without a second copy of those workflows. Saving a request preserves detail; global refresh is deferred to navigation so it cannot discard the user's context.
- Accounting cutoff applies to posted invoices and recorded receipts/corrections. Approved/certified/pending-correction/available columns describe current workflow for selected requests, not historical knowledge. Keep these definitions in findings and CSV. Unpaid invoiced principal remains a liability; approval alone does not.
- Reconcile the full authorised principal-control population by company/project/currency/date. Reconcile original advance tax only against its original invoice and identified recovery-release ledger lines, excluding measured-work tax and tax FX. The shared receipt report remains responsible for AR/bank controls.
- Add a versioned, explicitly enabled local sample pack with new contracts and synthetic preparer/reviewer identities. Never revise old policies or increase existing users' limits to make a walkthrough work. Low-level earlier financial fixtures keep their baseline; the local launcher and complete-example test explicitly enable the new pack.
- Narrow report filters stack vertically. Capture responsive evidence with explicit CSS clip dimensions: this browser's default screenshot and device metrics mixed physical/CSS scaling. A 390-pixel DOM and full readable screenshot now agree; broader accessibility/representative-user acceptance remains open.
