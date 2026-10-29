# Cross-laptop handover verification — 29 October 2026

GitHub repository: https://github.com/JameelKhab/Builder-ERP. The user explicitly authorised sync and approved GitHub CLI access as JameelKhab. The old account's 403 was resolved through the official device flow; no credential is committed. No repository visibility/access setting or deployment was changed.

Published source checkpoint `2f4844cd01e8527bf0c7f4f515b2eca622ef270e` was verified by GitHub's reference API, browser file listing and a new clone from GitHub. That checkpoint contains the complete application increment `35b7ae1` and the root START-HERE.md handover. Subsequent handover commits update documentation/verification only; application code is unchanged.

- `fresh-install.txt`: a clean `npm ci --offline --no-audit --no-fund` installed 140 packages from the existing local package cache using the committed lockfile. This proves a clean dependency install with available cached packages, not an uncached Internet install or vulnerability audit.
- `fresh-tests.txt`: all 231 tests pass in the freshly cloned checkout, including real local HTTP identity/permission journeys.
- `fresh-build.txt`: frontend build and retained static packaging pass in that checkout. Static packaging is not an ERP backend deployment.
- `data-backup.json`: consistent SQLite backup of the saved workspace; schema 15, all 99 business tables match, integrity/FKs clean, zero identities and identity sessions.
- `fresh-restore.json`: that backup was copied into the new checkout without overwriting another database and reopened using its schema/example code. All 99 business tables still match.
- `pre-publication-check.json`: bounded common-token/private-key and private-file checks across all reachable history blobs and ZIP evidence. A broad-pattern false positive in a public NIST URL was corrected. This is not a full security audit.

The exact provided comparison PDF is retained in Git and its hash agrees with the user-supplied file. Application runtime source contains no hard-coded original-Mac path. START-HERE.md documents original scope, authoritative evidence, setup, operating limits, the advance-invoicing/recovery continuation and all wider outstanding work.

GitHub contains committed source, documentation, evidence, tests and history. The public repository intentionally excludes the live SQLite workspace and credentials. The separately delivered private portable archive includes a verified source bundle and consistent SQLite snapshot, so local demonstration edits can be recovered without the old laptop or chat. A fresh clone without that archive recreates the fictional baseline.

The full ERP goal is still active; no migration parity or production readiness is claimed. No JAKH mutation, deployment or real financial transaction occurred.
