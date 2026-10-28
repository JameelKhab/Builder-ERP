# Initial visual directions

28 October 2026. The user has explicitly authorised implementation: "start building, make sure to build with quality". The implementation authorisation supersedes earlier pending-study notes. Development and commits remain local; remote syncing and deployment remain deferred.

Three independent design previews were generated using the built-in image tool. The display order below is the selection order presented in the conversation. The user subsequently selected display choice 2, Project briefing, and asked for clearer information categories. The original three images remain historical design evidence.

| Display order | Direction | Preview | Intended interaction |
| --- | --- | --- | --- |
| 1 | Clear desk | [Image](directions/01-clear-desk.png) | Top-level navigation above a project rail; prioritised actions and a concise cost finding. |
| 2 | Project briefing | [Image](directions/02-project-briefing.png) | Four global destinations in a rail; project areas across the top; narrative briefing and next activities. |
| 3 | Work in context | [Image](directions/03-work-in-context.png) | Global and project navigation above an attention list and an in-place purchase-request detail. |

## Grounding and invariants

- Revision 4 requirements and the previously captured demo screenshots `39-admin-fuller-company.png` and `33-site-project-more.png` grounded the concepts. Both images were inspected and attached to every generation. They are retained in the existing study evidence archive.
- The old demo is evidence of the problem, not a source-code or visual-layout target.
- Four global destinations and seven stable project areas were retained in every concept.
- Company, project, next action and responsibility remain visible. Rich detail is grouped instead of repeated across nested tabs.
- Vendor currency and company estimates are distinct. All names, amounts, dates, rates and records in the new concepts are illustrative, not extracted live business transactions.
- Report findings sit above the figures. Contextual explanations are secondary actions; no AI service has been connected.
- Exact generation prompts are retained in `directions/prompts.json`.

## Review before implementation

The images convey layout and interaction intent, not business-rule validation or accessibility conformance. The implementation must enforce permissions, separation of duties, version-aware approval, decimal FX arithmetic, traceable report findings, and keyboard/responsive behaviour.

Direction 3 depicts the requester as the signed-in user while showing approval. That generated detail must be corrected: approver actions are determined by server-side authority and an applicable separation-of-duties policy; the screen is not approval to allow self-approval. The budget impact must also be labelled as a provisional request allocation rather than a posted cost or issued commitment. Company selection must preserve the owning company of an open record.

The user selection resolved the visual gate. A single [refined choice 2](directions/02-project-briefing-refined.png) was generated to incorporate clearer categories before implementation; its exact [prompt](directions/02-refinement-prompt.json) is retained. The resulting local app is in `app/`; see [design QA](../../app/design-qa.md). The complete ERP build remains in progress.

The selected overview has three groups: Decisions needed, Site & programme, Cost & cash. Company/project context is persistent; deeper detail is reached through named categories or a record. Review pending replaces the image's unsupported Due today claim because the current request has a site-needed date, not a separate approval deadline.
