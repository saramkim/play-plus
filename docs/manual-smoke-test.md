# Play Plus Manual Release Smoke Test

> **v1.13.0 candidate — HOLD, not release-ready.** Version bump and branch push are complete in Draft PR #133. Automated checks pass, but the full Chrome matrix and privacy/Store alignment are incomplete. The preparation checkpoint below is historical; final-candidate evidence follows it. The original v1.12.0 record is preserved at [archive/releases/v1.12.0-smoke-test.md](./archive/releases/v1.12.0-smoke-test.md).

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
- Source: `87b91409251289242a0be17452487cba876313ca` (`chore: prepare v1.13.0 candidate`), including UI commit `fb5e5bd14dcf958f4111470e646b9c523d0aab9a`; Draft [PR #133](https://github.com/saramkim/play-plus/pull/133). Subsequent validation-record changes are documentation only. No release tag.
- Artifact: the three JavaScript SHA256 values and byte sizes above are unchanged; v1.13.0 manifest SHA256 is `D199F5FC67592AA0D42086CF02CC2546C5D22431D2A7FE507F650EE3BF82086A`.
- Build: configured `yarn build` with the two endpoint/privacy environment variables above; Node v24.18.0, Yarn 4.9.1, Windows Chrome 155.
- Tester: Codex using dedicated KR Chrome DevTools, 2026-10-15 Pacific/Auckland; real provider playback and action-opened side panel, not a fixture.
- Profile: existing authenticated dedicated Korean Chrome; Korean UI; episode `bbdda45f-6c8f-4ef0-8e54-51541c2ae1fe` on `/en/play` and `/play`. The first KR relay stopped; bounded gateway recovery passed on another KR relay with host routing unchanged. With explicit owner approval, provider language was temporarily Korean, then visibly restored to English.
- Unpacked extension `mpknnoepdadenanfhmccdaoiaidjhcna` reloaded from `dist/`, actual side panel reports **1.13.0**.
- Backup: ignored `.wrangler/pre-v113-storage.json`, `post-v113-storage.json` and `final-v113-storage.json` under `services/feedback`. Sync, local and localStorage were exactly equal immediately after reload. After tests, sync and localStorage still match exactly; all pre-existing local values match. The only added local key is empty `savedSubtitles: []` after UI deletion of test lines. Existing upload preserved; test SRT deleted; optional feedback host permission removed. Session active-tab state is transient.

A `main` commit, PR review, automated test or synthetic fixture alone is not proof of a release candidate passing a real-Chrome row. Distinguish real provider playback from controlled test fixtures.

## Automated and production bundle gate

| Check | Exact command / result | Notes |
| --- | --- | --- |
| Type check | `yarn type-check` — PASS | v1.13.0 candidate |
| Lint | `yarn lint` — PASS | v1.13.0 candidate |
| Full tests | `yarn test:run` — PASS | 293 tests, 42 files, no exclusions |
| Production build | configured `yarn build` — PASS | Three existing bundle-size warnings; exact entry sizes/hashes above |
| Built manifest | PASS | 1.13.0; required hosts/permissions unchanged; only optional host is the feedback Worker |
| Feedback service (if configured) | PARTIAL | Worker type check and 9 tests passed; final candidate receipt and cleanup passed below; public-policy/Store gate remains HOLD |
| GitHub CI | PASS | `verify` on `87b9140`, run `38720028351`, 1m48s |

Record bundle sizes for `dist/index.js`, `dist/content.js` and `dist/background.js` from the **exact** built candidate. A prior size, test count or build PASS is not carried forward.

## Actual Chrome smoke matrix

For each row, record **PASS**, **FAIL**, **BLOCKED**, **PARTIAL**, or **NOT RUN**, the tested route and relevant evidence. PARTIAL is not a passing release gate. For a failure, include exact steps, visible result and console errors. Do not mark a row PASS based solely on code review or an unrelated earlier run.

| Area | Route(s) | Check | Result | Evidence / errors |
| --- | --- | --- | --- | --- |
| Install | N/A | Load `dist/`; actual side panel opens without errors | PASS | Reloaded existing unpacked extension, version 1.13.0, actual action-opened panel |
| Fresh state | Both | Default settings and active-video detection | NOT RUN | — |
| Upgrade | N/A (storage) | Existing sync settings and local uploads remain intact | PASS | Exact before/after sync, local and localStorage equality; this is unpacked reload evidence, not Store upgrade delivery |
| Route support | `/play` | Detection, connection and controls initialize | PASS | After approved provider-language change, real main content played with English/Korean subtitles and connected/detected panel |
| Route support | `/en/play` | Detection, connection and controls initialize | PASS | Actual episode playback; connected/detected; English primary and Korean secondary displayed |
| Primary subtitle | Both | Select, display, hide/show and seek | PARTIAL | English displayed, Q toggled off/on on both routes; uploaded primary selection passed on `/en/play`; complete selection matrix pending |
| Secondary subtitle | Both | Select, display, hide/show and seek | PARTIAL | Korean displayed, W toggled off/on on both routes; explicit alternate secondary selection pending |
| Upload | Both | Upload, delay, edit and reload | PARTIAL | `/en/play`: synthetic 3-cue SRT uploaded/applied, delay 2 stored, title edited, panel reload preserved values. `/play` repetition and precise delayed cue-boundary check pending |
| Copy | Both | Configured primary/secondary shortcuts | PASS | Z/X copied matching English/Korean text; clipboard readback after owner granted browser permission |
| Save | Both | Save primary/secondary and review | PASS | E/R added two lines per route, visible in review with matching timestamps; all four test lines subsequently deleted through UI |
| Navigation | Both | Subtitle and fixed-time forward/backward | PASS | Arrow keys moved exactly +/-10s; A/D moved to adjacent cue boundaries |
| Loop | Both | A/B, current subtitle and clear | PARTIAL | `/en/play` manual 10s interval wrapped; `/play` active visible current-cue interval wrapped. One earlier short-cue run advanced beyond end; visibility/timing cause not established. Repeat in active/background states and verify explicit clear before PASS |
| Speed | Both | Increase, decrease and reset | PARTIAL | Increase/decrease passed both. Reset 1.1→1 passed on `/play` using physical `Slash`. Tool key `/` emits `NumpadDivide`, so the earlier `/en/play` reset check at 1x was inconclusive; repeat with `Slash` |
| Reconnect | Both | Close/reopen actual side panel | PARTIAL | Actual panel closed and action-reopened successfully at provider home; version/settings preserved, `/play` later connected. Complete in-play coverage pending |
| Reload | Both | Player reload recovers subtitles/controls | PARTIAL | `/en/play` reload recovered actual playback, subtitles and panel connection. `/play` explicit reload pending |
| SPA navigation | Both | Away/back without full reload; new player detected | NOT RUN | — |
| Saved subtitle | Existing tab | Open saved line in matching tab | PASS | `/en/play` reused the same tab and sought to saved 265.266s. A later `/play` attempt with a still-active loop was inconclusive and is not counted |
| Saved subtitle | New tab | Open saved line with no matching tab | PASS | After old player tab moved to home, review opened new tab 5 at the saved episode and playback resumed near saved position; owned tab closed afterward |

### Feedback functionality (when included in the release build)

If the candidate includes a configured feedback endpoint, validate the additional matrix in [feedback-service.md](./feedback-service.md): voluntary entry, privacy notice, exact optional host permission, Allow/Deny/Cancel, explicit send only, offline/retry/429, server receipt and D1 readback, rate limits, retention/cleanup, accessibility and no disruption of ordinary playback. Record the exact live endpoint, privacy policy status and permitted production collection state. If the build intentionally disables feedback, instead verify disabled/unconfigured behavior and justify the excluded configured-flow rows; **do not claim feedback collection was released**.

Candidate-specific feedback results:

- PASS: More menu opens the form despite prior banner dismissal; textarea receives focus. Opening confirmation made zero feedback resource requests. Korean modal at 320/360/390px had no horizontal overflow. Shift+Tab wrapped to Agree and send; Escape preserved text and returned focus to Send.
- PASS: owner clicked the actual Chrome Allow prompt after Agree and send. With intake disabled, failure text preserved the draft. With a bounded test-only deployment, the exact candidate showed success and focused its success status after D1 storage confirmation.
- Receipt `57fc83e5-08a3-41e0-b96c-8e324a2bf477`, extension `1.13.0`, received `2026-10-15T10:24:03.462Z`. One synthetic row stored; deleted after readback. Original Store-only origin and `ACCEPT_FEEDBACK=false` restored in Worker version `51030da8-1cb2-455f-951c-b89def907397`; final D1 total **0**. Read-only probes PASS: disabled 503, foreign origin 403, GET 405, OPTIONS 204.
- CONTROLLED LAYOUT PASS: English feedback strings from the checked-in locale were temporarily injected into the real panel; form and modal fit 320/360/390px. The original i18n function was restored. This does **not** prove Chrome's native English locale selection, full-English application layout or screen-reader output.
- Still NOT RUN on the final candidate: fresh-install onboarding/banner matrix; native English Chrome; screen reader and native IME composition; fresh Deny/Cancel and Chrome-settings revocation/re-request; full offline/reconnect, timeout, 429, malformed receipt, double-click/lost-response native matrix. Unit/Worker tests and earlier UI evidence are not substitutes for these rows.

### Privacy and Store gate — HOLD

The owner supplied the currently registered [Notion policy](https://saramkim.notion.site/Play-Plus-135b75df10d480d3a854c5caeb35ead6). Both public pages were read in the browser on 2026-10-15:

- The Notion page says all extension data stays locally and is not sent to external servers. That is incompatible with enabling optional feedback; its device-only wording also needs an accurate distinction between `chrome.storage.local` and settings in `chrome.storage.sync`.
- The [new domain policy](https://www.saramkim.com/play-plus/privacy) expressly covers only optional feedback. It must not silently replace the complete extension policy until existing settings/subtitle/review handling is covered. Its Korean/English send wording still describes Send, whereas the candidate sends only after Agree and send.
- Proposed next step: integrate the whole-extension disclosure and final consent wording on the domain page, review it, then update the Store policy URL and matching data/permission declarations under explicit publication authority. No policy or Store field was edited in this validation.
- Actual Store published version and selected data categories remain UNKNOWN. The authorized automated dashboard read was blocked by `The extensions gallery cannot be scripted`; the user provided the policy URL, not those remaining fields.

Release decision: **HOLD**. Do not tag, package for submission, merge as release-ready, publish, or enable public intake while the incomplete rows and policy mismatch remain unresolved. No code change was made to mask provider/network limitations or the inconclusive loop observation.

Cleanup checkpoint: owned playback tab 5 and both temporary policy-reading tabs were closed; existing user tabs were preserved. Korean gateway stopped with `ok: true, active: false`. Test-only locale/key probes were removed, provider language is English again, and no browser permission prompt or temporary backend deployment remains pending.

## Evidence limits, cleanup and decision

- Record **NOT RUN** and **BLOCKED** honestly; environment problems are not feature PASS.
- Record actual Chrome versus emulated UI/fixture coverage separately.
- Confirm owned test tabs/processes were cleaned up and unrelated browser data preserved.
- Confirm the release version, manifest, permissions, user-data disclosure, privacy policy and Store details match the candidate.
- Do **not** release while a required row is FAIL, BLOCKED or NOT RUN. Resolve missing evidence or receive an explicit, documented scope decision before further action.
- A passing matrix does not itself grant tag, Chrome Web Store submission, deployment or user-data collection authorization.
- Save the completed result with the exact release commit. For past evidence, use [docs/archive/releases/](./archive/releases/); do not overwrite older results when preparing a new release.
