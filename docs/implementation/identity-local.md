# Individual local sign-in and reviewed account provisioning

29 October 2026. This implements an original local identity subset for F239–F242/F266 and M32. Full ERP migration remains open. No Odoo application code, password database or authentication implementation was copied.

## What now works

- One-time owner setup preserves the existing database. The owner chooses their own username/password and explicitly selects any initial company project-manager scopes. Purchase and budget approval limits begin at zero. Company and user administration remain separate from business scope.
- An access administrator creates a person, reviews company/project roles and limits, and receives a one-time activation code for private manual delivery. An eligible existing identity can be bound to a new sign-in without replacing its referenced user ID. Name/job-title changes during binding are audited.
- Each person activates their own account and signs in independently. The permission-dependent Home and every service/report/search use that authenticated identity and current access revision.
- Active-session listing, logout, individual session revocation, password change, offline recovery codes and administrator-issued activation/reset codes. Reset issuance alone does not revoke the existing password; using the code revokes all sessions and earlier codes. Immediate access removal uses account disabling.
- Recent password confirmation for sensitive access/credential administration. Another administrator must review changes to one's own business access or administrative authority. Active administrators must have administration removed through its separate review before disabling; no self-removal or self-elevation path exists.
- Preview remains read-only on the server and cannot inspect or modify account credentials or personal sessions. Disabled/re-scoped accounts lose existing sessions. Administrators without business company access can still reach company/user administration.
- Original responsive sign-in, setup, account and account-review screens. Review uses plain-language permissions, separate financial limits and one focused form. Mobile account/sign-out controls remain visible.

## Clear example for each feature

These scenarios run against disposable test databases; no shared-password real accounts are installed in the user's workspace.

| Feature | Example and expected outcome | Evidence |
|---|---|---|
| First owner | Choose JAKH Contracting only. Receive company/project visibility and administration, with zero approval limits. A simultaneous second setup is rejected. | `identity.test.mjs` |
| Reviewed user | Create a Harbour Tower engineer. Project scope is Harbour only, prices and budget reports withheld, no administration granted. | Both identity test files; account-review screenshots |
| Existing identity binding | Activate Mohammed's existing user ID with reviewed labels/scopes; preserve references and log previous labels. | `identity.test.mjs` |
| Activation | Consume the administrator's code once; an expired/replaced/used code cannot activate again. Recipient chooses the password. | `identity.test.mjs` |
| Independent approvals | Authenticated owner submits a new project budget and material request. Authenticated reviewer approves both; self-approval fails. An issued AED 200 order changes commitment, with original budget AED 50,000 and cash zero. | `identity-api.test.mjs` |
| Session controls | Sign in twice, revoke the other browser, then verify its requests fail. Restart preserves valid real sessions; idle/absolute expiry still apply. | Both test files; browser logout check |
| Recovery/password change | Change password, invalidating every session and prior codes; use a new recovery code once and sign in again. No role grant is added. | `identity.test.mjs` |
| Sensitive changes | After five minutes, account/access administration requests password confirmation. Preview cannot confirm credentials or make writes. | Both test files |
| Administrative separation | Grant a second activated account administration. It independently changes the first owner's business scope. Neither can change their own authority. | `identity.test.mjs` |
| Empty scope | Sign in as an administrator with no business grants. Home offers company/user administration, with no project data. | `admin-without-business-scope.png` |
| Security/audit | Wrong/unknown/disabled login produces generic errors; rate counters persist; revocation during hashing wins; events cannot be edited/deleted. Stored/returned account views contain no raw passwords or secret tokens. | Both test files |

## Source review

Fresh read-only evidence: `docs/validation/identity/source-add-user.txt` and `.png`, from JAKH Users & Access → Add User. The form exposed existing-user binding, full name/login, contact email, optional invitation, job title, language, access preset, allowed/default companies, project scope, extra approved roles, reason and effective-access review. The email checkbox was unchecked; the unsaved form was cancelled. This establishes visible source intent, not proof of its internal enforcement.

Builder preserves explicit review, scope and separate authority with original code. Source contact-email/default-company/language preferences, multiple additional roles per exact scope, invitation transport and advanced source authentication policies remain unimplemented or unverified. They are not certified as migrated. Current policy uses one reviewed role per company/project scope; grants from separate scopes combine explicitly.

## Local operating boundary

`npm run local` retains the existing explicit sample workspace until the user sets up their first owner through the profile. `npm run local -- --secure` opens owner setup/sign-in without sample login. Starting the API directly defaults to setup/sign-in. After owner setup succeeds, the database is permanently secured: restarting with the sample flag cannot restore sample login.

The real workspace was backed up and migrated additively to schema 5; it still has **zero configured individual accounts**. The user must choose their own first-owner credentials in the UI. Development can continue against synthetic examples before that choice. No credential has been chosen for the user, no invitation sent, and no network exposure configured.

Credentials use salted scrypt with bounded work; sessions and activation/recovery codes are opaque and stored only as digests. Sessions have eight-hour absolute and thirty-minute idle limits. This loopback HTTP build uses HttpOnly/SameSite cookies plus strict Host/Origin/write-header checks. External/network release requires HTTPS/Secure cookies, MFA/passkeys/SSO decisions, a comprehensive breached-password policy, dependency/security assessment and operational recovery procedures. See `contracts/identity-v1.md` for parameters and primary references. Local tests are not a security certification.

## Validation and retained scope

94 automated tests pass, including 15 new identity service/HTTP tests. Frontend build passes. Browser checks cover signed-in owner/engineer/empty-scope administrator, reviewed provisioning without applying a grant, desktop/mobile layout, logout/current-session revocation and preserved destinations. Password creation/change/recovery was tested in disposable service/API fixtures; browser QA did not enter a new password or create an account. The QA database was in memory, separate from the persistent workspace.

Migration preservation compares every row of 29 existing business/history tables against the pre-migration backup; all match. Recovery copy compares all 36 current tables; integrity is `ok`, with no foreign-key errors. Runtime identity count remains zero. See `docs/validation/identity/migration-recovery.json` and `verification.md`.

This does not complete accounting/cash, estimating, subcontracting, commercial certification, NCR/site/programme, assets/people, configurable policies/integrations, full reporting/AI or production import/reconciliation. All 267 comparison functions remain tracked and none is certified as full parity.
