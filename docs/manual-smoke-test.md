# Play Plus Manual Release Smoke Test

> **v1.13.0 release candidate — validation in progress.** The preparation checkpoint below records the earlier UI checks; final-candidate results are recorded separately and are not inherited. The original v1.12.0 execution record is preserved at [archive/releases/v1.12.0-smoke-test.md](./archive/releases/v1.12.0-smoke-test.md).

## Preparation checkpoint — 2026-10-15 Pacific/Auckland

- UI approved and committed: `fb5e5bd14dcf958f4111470e646b9c523d0aab9a` (`feat(ui): refine feedback form and consent flow`), based on current remote main `e010995a288c408cc24693156f5eaa6b23751557`.
- Suggested release version: **1.13.0, awaiting version-bump approval**. Current package, manifest and configured test build remain **1.12.0**. No release tag, ZIP or Store upload has been created.
- Changes since `v1.12.0` include subtitle upload/storage/delay fixes, analysis search and keyboard access, shortcut readability, native subtitle fallback/isolation, optional companion subtitles and voluntary feedback. Review and smoke testing must cover the entire range, not only the latest feedback UI.
- Pre-release automated checks: `yarn type-check`, `yarn lint`, `yarn test:run` (**293/293, 42 files**) and configured `yarn build` passed in the same UI session. Main synchronization changed documentation only; the six UI/locale/test files were compared against the saved pre-sync tree and matched exactly. These results cover the current source, not a future versioned candidate.
- Worker checks refreshed: `npm run type-check` and `npm test` (**9/9**), including local D1 readback/idempotency/rate limits/retention; the build was a dry run, not a deployment.
- Live Worker remains `19f1cfab-43ec-4b62-8d82-a535bc96d9ff` at 100%, `ACCEPT_FEEDBACK=false`; read-only D1 count is **0**. Disabled intake **503**, untrusted origin **403**, public reader **405** and preflight **204** were rechecked successfully.
- Current native UI evidence: Windows Chrome 155, Korean actual side panel; approved banner/outline button at 360px, input opening/focus/Escape with no send, compact input and offline failure preservation, 320px confirmation and Tab/Shift+Tab cycling. Full Korean/English 320/360/390px coverage, screen-reader operation, settings-level permission revocation and the final versioned Chrome matrix are still pending.
- Native permission Allow/refusal and real production storage were demonstrated on the earlier UI. Fresh permission interaction and storage success must be checked with the final confirmation flow; do not treat the earlier run as proof of the revised candidate.
- Store status/declarations remain **UNKNOWN**: authorized read attempts returned `The extensions gallery cannot be scripted.` No alternate access path was used to bypass that restriction. The existing Store item's actual published version and privacy/permission fields must be checked before submission.

Current configured test artifact (not a release package):

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `dist/index.js` | 769772 | `3107B2EA9C192009DD0100CAC8BDE4C9BF054EC9F8E762BC8E172A21871B39F1` |
| `dist/content.js` | 414253 | `BF23E0C6C95DD9FACCAE5CF357A07D97C27A9FE560B54586726AFDF4DADBC235` |
| `dist/background.js` | 6939 | `EF59EC118A376ECE1290D7ABFC71F96EBB7C77F313BB31C36E5B733357669B83` |

Build settings are `PLAY_PLUS_FEEDBACK_ORIGIN=https://play-plus-feedback.saramkimm.workers.dev` and `PLAY_PLUS_FEEDBACK_PRIVACY_URL=https://www.saramkim.com/play-plus/privacy`, with Node v24.18.0 and project Yarn 4.9.1. The three existing Webpack bundle-size warnings remain. Built manifest version is 1.12.0; the only optional host is `https://play-plus-feedback.saramkimm.workers.dev/*`, and existing required permissions/Coupang host remain unchanged. Manifest SHA256: `A4F851BBB42DFDB63F88000952D05AF556AA414E5C117983CF451BA12B008BF5`.

Next sequence: review/integrate the UI commit via PR; approve the version bump; update package/manifest/README/this checklist together; build the exact candidate; complete all rows below and feedback-service gates; prepare final Store metadata and ZIP; obtain the separately required tag/push/Store submission/publication/collection authority. The UI commit is local; push and publication have not been performed by this checkpoint.

## Release candidate identity

- Proposed extension version: **1.13.0**, owner-approved on 2026-10-15; no tag or publication yet.
- Source: UI commit `fb5e5bd14dcf958f4111470e646b9c523d0aab9a` plus the four-file v1.13.0 candidate preparation change; Draft [PR #133](https://github.com/saramkim/play-plus/pull/133). No release tag.
- Artifact: the three JavaScript SHA256 values and byte sizes above are unchanged; v1.13.0 manifest SHA256 is `D199F5FC67592AA0D42086CF02CC2546C5D22431D2A7FE507F650EE3BF82086A`.
- Build: configured `yarn build` with the two endpoint/privacy environment variables above; Node v24.18.0, Yarn 4.9.1, Windows Chrome 155.
- Tester: Codex using dedicated KR Chrome DevTools, 2026-10-15 Pacific/Auckland; real provider playback and action-opened side panel, not a fixture.
- Profile: existing authenticated dedicated Korean Chrome; Korean UI; gateway egress `183.99.25.80`. Host routing unchanged. Episode `bbdda45f-6c8f-4ef0-8e54-51541c2ae1fe` on `/en/play`.
- Unpacked extension `mpknnoepdadenanfhmccdaoiaidjhcna` reloaded from `dist/`, actual side panel reports **1.13.0**.
- Backup: ignored `.wrangler/pre-v113-storage.json` and `post-v113-storage.json` under `services/feedback`; sync, local and localStorage were exactly equal immediately after reload. Session active-tab state is transient. Final cleanup comparison pending.

A `main` commit, PR review, automated test or synthetic fixture alone is not proof of a release candidate passing a real-Chrome row. Distinguish real provider playback from controlled test fixtures.

## Automated and production bundle gate

| Check | Exact command / result | Notes |
| --- | --- | --- |
| Type check | `yarn type-check` — PASS | v1.13.0 candidate |
| Lint | `yarn lint` — PASS | v1.13.0 candidate |
| Full tests | `yarn test:run` — PASS | 293 tests, 42 files, no exclusions |
| Production build | configured `yarn build` — PASS | Three existing bundle-size warnings; exact entry sizes/hashes above |
| Built manifest | PASS | 1.13.0; required hosts/permissions unchanged; only optional host is the feedback Worker |
| Feedback service (if configured) | PARTIAL | Worker type check and 9 tests passed at the preparation checkpoint; final candidate browser receipt and cleanup tracked below |

Record bundle sizes for `dist/index.js`, `dist/content.js` and `dist/background.js` from the **exact** built candidate. A prior size, test count or build PASS is not carried forward.

## Actual Chrome smoke matrix

For each row, record **PASS**, **FAIL**, **BLOCKED**, or **NOT RUN**, the tested route and relevant evidence. For a failure, include exact steps, visible result and console errors. Do not mark a row PASS based solely on code review or an unrelated earlier run.

| Area | Route(s) | Check | Result | Evidence / errors |
| --- | --- | --- | --- | --- |
| Install | N/A | Load `dist/`; actual side panel opens without errors | PASS | Reloaded existing unpacked extension, version 1.13.0, actual action-opened panel |
| Fresh state | Both | Default settings and active-video detection | NOT RUN | — |
| Upgrade | N/A (storage) | Existing sync settings and local uploads remain intact | PASS | Exact before/after sync, local and localStorage equality; this is unpacked reload evidence, not Store upgrade delivery |
| Route support | `/play` | Detection, connection and controls initialize | NOT RUN | — |
| Route support | `/en/play` | Detection, connection and controls initialize | PASS | Actual episode playback; connected/detected; English primary and Korean secondary displayed |
| Primary subtitle | Both | Select, display, hide/show and seek | NOT RUN | — |
| Secondary subtitle | Both | Select, display, hide/show and seek | NOT RUN | — |
| Upload | Both | Upload, delay, edit and reload | NOT RUN | — |
| Copy | Both | Configured primary/secondary shortcuts | NOT RUN | — |
| Save | Both | Save primary/secondary and review | NOT RUN | — |
| Navigation | Both | Subtitle and fixed-time forward/backward | NOT RUN | — |
| Loop | Both | A/B, current subtitle and clear | NOT RUN | — |
| Speed | Both | Increase, decrease and reset | NOT RUN | — |
| Reconnect | Both | Close/reopen actual side panel | NOT RUN | — |
| Reload | Both | Player reload recovers subtitles/controls | NOT RUN | — |
| SPA navigation | Both | Away/back without full reload; new player detected | NOT RUN | — |
| Saved subtitle | Existing tab | Open saved line in matching tab | NOT RUN | — |
| Saved subtitle | New tab | Open saved line with no matching tab | NOT RUN | — |

### Feedback functionality (when included in the release build)

If the candidate includes a configured feedback endpoint, validate the additional matrix in [feedback-service.md](./feedback-service.md): voluntary entry, privacy notice, exact optional host permission, Allow/Deny/Cancel, explicit send only, offline/retry/429, server receipt and D1 readback, rate limits, retention/cleanup, accessibility and no disruption of ordinary playback. Record the exact live endpoint, privacy policy status and permitted production collection state. If the build intentionally disables feedback, instead verify disabled/unconfigured behavior and justify the excluded configured-flow rows; **do not claim feedback collection was released**.

## Evidence limits, cleanup and decision

- Record **NOT RUN** and **BLOCKED** honestly; environment problems are not feature PASS.
- Record actual Chrome versus emulated UI/fixture coverage separately.
- Confirm owned test tabs/processes were cleaned up and unrelated browser data preserved.
- Confirm the release version, manifest, permissions, user-data disclosure, privacy policy and Store details match the candidate.
- Do **not** release while a required row is FAIL, BLOCKED or NOT RUN. Resolve missing evidence or receive an explicit, documented scope decision before further action.
- A passing matrix does not itself grant tag, Chrome Web Store submission, deployment or user-data collection authorization.
- Save the completed result with the exact release commit. For past evidence, use [docs/archive/releases/](./archive/releases/); do not overwrite older results when preparing a new release.
