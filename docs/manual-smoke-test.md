# Play Plus Manual Release Smoke Test

> **Active release checklist — no verification has been executed by this template.** Before every release, fill in the exact candidate and record fresh results for every applicable row. The original v1.12.0 execution record is preserved at [archive/releases/v1.12.0-smoke-test.md](./archive/releases/v1.12.0-smoke-test.md); its PASS outcomes cannot be inherited.

## Release candidate identity

- Proposed extension version: **TO RECORD**
- Exact source commit / build artifact identifier: **TO RECORD**
- Build command, Node/Yarn versions, Chrome version and platform: **TO RECORD**
- Tester, local date/time and actual testing method: **TO RECORD**
- Test profile, real Coupang Play routes, authentication/locale and network conditions: **TO RECORD**
- Extension installation method and whether the real action-opened Chrome Side Panel was used: **TO RECORD**
- Pre-test storage backup and post-test restoration check: **TO RECORD**

A `main` commit, PR review, automated test or synthetic fixture alone is not proof of a release candidate passing a real-Chrome row. Distinguish real provider playback from controlled test fixtures.

## Automated and production bundle gate

| Check | Exact command / result | Notes |
| --- | --- | --- |
| Type check | `yarn type-check` — NOT RUN | |
| Lint | `yarn lint` — NOT RUN | |
| Full tests | `yarn test:run` — NOT RUN | Include count and exclusions |
| Production build | `yarn build` — NOT RUN | Record warnings, build configuration and entry sizes |
| Built manifest | NOT RUN | Verify version, required hosts, optional hosts and permissions match the exact release build |
| Feedback service (if configured) | NOT RUN | Apply separately required Worker verification and privacy/operations gates |

Record bundle sizes for `dist/index.js`, `dist/content.js` and `dist/background.js` from the **exact** built candidate. A prior size, test count or build PASS is not carried forward.

## Actual Chrome smoke matrix

For each row, record **PASS**, **FAIL**, **BLOCKED**, or **NOT RUN**, the tested route and relevant evidence. For a failure, include exact steps, visible result and console errors. Do not mark a row PASS based solely on code review or an unrelated earlier run.

| Area | Route(s) | Check | Result | Evidence / errors |
| --- | --- | --- | --- | --- |
| Install | N/A | Load `dist/`; actual side panel opens without errors | NOT RUN | — |
| Fresh state | Both | Default settings and active-video detection | NOT RUN | — |
| Upgrade | Both | Existing sync settings and local uploads remain intact | NOT RUN | — |
| Route support | `/play` | Detection, connection and controls initialize | NOT RUN | — |
| Route support | `/en/play` | Detection, connection and controls initialize | NOT RUN | — |
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
