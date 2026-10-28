# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## JAKH-specific direction and boundaries

- User selected choice 2, Project briefing, on 28 October 2026. Use `../docs/design/directions/02-project-briefing-refined.png` as the selected visual target. The refinement incorporates their request: easy to read, easy to operate, rich in information, with clearer categories.
- Keep four global destinations, seven stable project areas and three overview groups: Decisions needed, Site & programme, Cost & cash. Category directories describe purpose; record detail carries evidence and history. Avoid recursive module menus and repeated nested tab bars.
- Use `npm run local` to start BOTH the loopback API and Vite. `npm run dev` alone starts only the frontend. This is an original, persistent local ERP increment, not merely a static Sites prototype.
- User explicitly requires local work and local Git commits. Do not push, share, deploy, modify the old demo or invoke a hosting handoff without a later user instruction.
- The Sites starter files are retained, but its static worker does NOT run this app's database/API. A successful frontend build is not a deployable ERP or production readiness.
- Keep sample-mode identity and synthetic records clearly labelled. The only operational write workflow currently implemented is purchase request drafting, repricing and approval. Other registers are read-only samples. Never describe those as completed workflow modules.
- Run `npm test` and `npm run build` for meaningful application changes. Financial state changes require service tests; do not replace exact arithmetic with JavaScript floating-point money.
- Follow the root AGENTS.md and update `../docs/implementation/local-increment-1.md` and the project log when scope changes.
