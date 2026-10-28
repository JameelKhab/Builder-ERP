# Local architecture and control boundaries

28 October 2026. Original application code; no Odoo runtime, models, modules or application source imported.

## Components

| Component | Responsibility |
| --- | --- |
| React/Vite frontend (`app/src`) | Four global destinations, seven project areas, category directories, forms, scoped report views and progressive record detail. |
| Express HTTP boundary (`app/server/http.mjs`) | Local session, same-origin write checks, request-size limit, service dispatch and controlled error responses. |
| Domain service (`app/server/service.mjs`) | Authorised company/project scope, quote derivation, request state transitions, limits, independent reviewer routing and deterministic reports. |
| Exact money helpers (`decimal.mjs`, `money.mjs`) | Decimal-string arithmetic using BigInt with 12 internal fractional digits; validated inputs, explicit two-decimal document rounding and FX conversion. |
| SQLite (`db.mjs`) | Durable local records, foreign keys, WAL, transaction boundaries, indexes and append-only request-event triggers. |
| Launcher (`app/scripts/local.mjs`) | Starts both processes on loopback and requires explicit local-sample mode for the API. |

Node 24.15.x is the current runtime. Dependencies and lockfile are pinned. Inter is self-hosted from the installed font package; Georgia is the display fallback. Phosphor supplies standard icons. No third-party font, telemetry or AI request is needed at runtime.

## Authority and state

The sample HTTP identity is injected by the server, not accepted from a caller-supplied role header. A random expiring HttpOnly/SameSite=Strict cookie identifies a local session. Write requests require the expected origin (when supplied) and a custom client header. **Anyone who can use this local sample endpoint can obtain the sample identity. This is explicitly not real authentication or a production security boundary.** Both listeners are loopback-only; API startup requires `BUILDER_LOCAL_SAMPLE=1`.

Domain services resolve membership for every company/project lookup, search, report and mutation. A company-level membership grants the applicable company scope; project membership restricts the population. Services validate that a request's project, cost item and vendor belong to the owning company. Database relationships supplement these checks; schema-level constraints alone are not the complete access model.

Request writes run in `BEGIN IMMEDIATE` transactions. A revision check prevents an old screen from deciding a changed request. Approval rejects self-approval, insufficient authority, changed/expired pricing and exhausted sourcing allowance. State and event insertion commit together. Events cannot be updated/deleted through normal SQL statements, but a privileged file/database owner can alter the database; the local event table is not a tamper-proof audit service. Current event records contain action/revision/actor/note/time, not complete immutable snapshots of every historical field.

## Financial semantics

All monetary input/output values are strings. Validated quantity and unit price have up to six fractional digits; their product is rounded to document cents before conversion to company cents. Current arithmetic assumes two minor-unit decimals and rejects invalid/nonpositive commercial inputs. Tests include negative internal rounding and high-precision display/export. Policies for JPY and other non-two-decimal currencies, tax rounding, invoice lines, discounts and settlement FX are not implemented.

Request approval reserves an allowance on a cost item. It does not create a financial commitment, recognised cost, cash payment or ledger posting. Those transitions need their own documents and authority. Cost-report committed/incurred/cash/forecast values currently come from labelled synthetic opening snapshots.

Reports compute one complete authorised population and deterministic findings from it, returning source identifiers, definition/rule version and a content hash. Pagination is a display concern. CSV exports this complete snapshot with findings first, quotes values and guards spreadsheet formula prefixes. The hash identifies the returned data; it is not a retained historical report archive or a cryptographic attestation.

## Data lifecycle and delivery

Schema version 1 is recorded. Future schema changes require explicit migrations and migration tests; `CREATE TABLE IF NOT EXISTS` is only initialisation. Empty databases are seeded once; reopening preserves user changes. The explicit local startup also installs the versioned `feature-examples-v1` pack transactionally. Its marker prevents repeat installation, and insert-if-missing semantics preserve existing rows. This pack adds examples, not financial opening balances. Local runtime data is ignored by Git. Git bundles back up source/documents, **not** live business data. A separate tested database backup/restore process is required before real use.

The first install used cached packages because this laptop's TLS gateway prevented a verified registry connection. TLS verification and OS trust were not weakened. `cookie-signature` is pinned to cached compatible 1.0.6 via an override; reassess this and all dependencies in the release review. No vulnerability-audit pass is asserted.

The Vite starter's Sites files remain intact for provenance, but its worker serves static assets only. Do not upload that build and expect the Express/SQLite service to exist. No hosting target, production credentials, CI deployment or remote sync is configured by this increment.

Production readiness additionally requires identity/roles, policy administration, audit/revision storage, financial localisation, secure document storage, DB migration/concurrency strategy, backup recovery, monitoring, dependency/security review, accessibility/user testing and migration reconciliation. Deployment still needs a later explicit user instruction.
