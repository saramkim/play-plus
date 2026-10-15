# Play Plus Manual Release Smoke Test

> **v1.13.0 candidate — HOLD, not release-ready.** Draft PR #133 contains the candidate. The integrated bilingual privacy policy is deployed; Store alignment and the full Chrome matrix remain incomplete. The 2026-10-16 follow-up supersedes the earlier candidate results only where explicitly stated. The original v1.12.0 record is preserved at [archive/releases/v1.12.0-smoke-test.md](./archive/releases/v1.12.0-smoke-test.md).

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

## Initial release candidate identity — 2026-10-15

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

## Follow-up — 2026-10-16 Pacific/Auckland

- Current tested source: `3cca53a8a9778743a65a3c8ea755ad75347abf93`, `fix(content): track playback behind other windows`. Real playback reproduced a short-cue loop ending after another window/tab was brought forward. Frame callbacks stopped updating playback time while the video continued. A guarded `timeupdate` listener now supplements frame callbacks and is detached when the video is replaced or cleared. Stale callbacks from replaced videos are ignored. This is an observed occlusion case, not proof for every Chrome background throttling mode.
- Automated verification: type check, lint, **295 tests in 42 files**, and configured production build PASS. Focused VideoManager/loop tests: 9 PASS, including absent frame delivery and stale-video events. Three existing Webpack size warnings remain.
- Current `dist/content.js`: **414498 bytes**, SHA256 `3914D6B2074990C3F6D7DE02EAA18F8B7633840B7F340386234F8ECAF1AEBEA9`. UI/background sizes and hashes are unchanged from the table above; manifest remains 1.13.0 with SHA256 `D199F5FC67592AA0D42086CF02CC2546C5D22431D2A7FE507F650EE3BF82086A`. Earlier browser evidence remains attributed to its original source; it is not a fresh full-matrix run on this fix.
- Same dedicated Chrome 155 profile, actual side panel and episode as above. Provider language temporarily Korean under the existing approval, then visibly restored to English.

| Follow-up area | Result | Real-Chrome evidence and limit |
| --- | --- | --- |
| Primary/secondary selection | PASS, both routes | Explicit primary Korean/secondary English selection displayed matching cues; restored primary English/secondary Korean. Previous hide/show and seek evidence remains as recorded above. |
| Loop | PASS, both routes | Current-cue 269.366–271.1 at 1.1x continued wrapping with another page brought forward. Manual A/B 300–302 repeatedly wrapped; explicit clear allowed playback past 302 and removed the active marker. This resolves the earlier short-cue observation. |
| Speed | PASS, both routes | Physical `Slash` reset 1.1 to 1, supplementing prior increase/decrease checks. |
| Reconnect | PASS, both routes | Closed and action-reopened the actual panel during playback; connected/detected status, version and settings recovered. |
| Reload | PASS for native subtitles, both routes | Explicit `/play` reload recovered playback, English/Korean native cues and panel connection; complements the earlier `/en/play` result. Uploaded selection restoration is not included in this PASS. |
| SPA navigation | PASS, both routes | Provider back/history UI moved away and returned to the same episode with a new video element; a document marker remained unchanged and cues/connection recovered. Different-episode navigation was not tested. |
| Upload | PARTIAL | `/play` synthetic SRT upload, apply, edit, delay 2, and panel reopen preserved metadata. Settled cue samples: 241.520 empty, 242.500 first, 251.628 first, 252.632 second. Test upload removed; original upload preserved. Player reload showed native cues despite the panel retaining the uploaded selection; selecting again restored it. Investigate this selection/UI mismatch before marking the entire upload/reload row PASS. |
| Native Korean IME | PASS | Owner typed directly using the Korean IME and pressed Enter twice. Recorded compositionstart/compositionend and Enter events; text plus two newlines remained, no dialog and zero feedback resource requests. Listener removed afterward. |

Remaining Chrome gates: fresh-install/default/onboarding/banner coverage, native English locale, screen-reader output, fresh Deny/Cancel plus Chrome-settings revocation/re-request, and the full native offline/reconnect/timeout/429/malformed-receipt/double-click/lost-response matrix. Upload selection after player reload remains unresolved. Full-diff review of the final source is also pending.

Read-only backend checks: D1 total **0**, no database changes; disabled intake **503**, foreign origin **403**, public reader **405**, preflight **204** all PASS. No backend deployment or public intake activation in this follow-up.

Cleanup: exact JSON comparison with the previous final checkpoint confirms unchanged sync, local, localStorage and permissions. Original upload preserved, temporary upload absent, optional feedback host absent. Provider language restored to English; no video remains active. Probe listeners/document marker removed. Temporary policy preview tab and local preview server closed. Existing tabs and current panel preserved. The synthetic IME draft remains in the panel because automatic approval review rejected its cancellation as input deletion. Dedicated gateway stop returned `ok: true, active: false`.

### Privacy and Store gate — HOLD

The owner supplied the currently registered [Notion policy](https://saramkim.notion.site/Play-Plus-135b75df10d480d3a854c5caeb35ead6). The domain policy was integrated and deployed on 2026-10-16:

- The Notion page says all extension data stays locally and is not sent to external servers. That is incompatible with enabling optional feedback; its device-only wording also needs an accurate distinction between `chrome.storage.local` and settings in `chrome.storage.sync`.
- The [integrated domain policy](https://www.saramkim.com/play-plus/privacy) now covers settings sync, local uploaded/saved subtitles, tab/playback/request processing, permissions, retention/deletion and optional feedback in Korean and English. Send opens confirmation; Agree and send requests permission/transmits. Website [PR #4](https://github.com/saramkim/saramkim.com/pull/4), source `81691188befaee413a17f85555ee459d05a91f54`, merged as `5629611071deb345bbb666bf2de4ebd61d6d5d9d` under explicit approval. Website lint/type/build/export and CI passed; Vercel production and live page content/date were verified.
- Owner explicitly deferred changing the Store policy URL until submission. Target URL: `https://www.saramkim.com/play-plus/privacy`. No Store field or certification was changed here.
- Owner screenshot shows all nine data categories unchecked. Published Store version and certification boxes remain UNKNOWN. Dashboard automation was blocked by `The extensions gallery cannot be scripted`; this restriction was not bypassed. See the [category review draft](./feedback-service.md#store-data-category-review--2026-10-16) before submission.

Release decision: **HOLD**. The public policy mismatch is resolved, but remaining Chrome rows, uploaded-selection reload behavior, final-source review and Store alignment are not. Do not tag, package for submission, merge as release-ready, publish, or enable public intake until those gates are resolved or an explicit scope decision is documented.

Earlier cleanup checkpoint (2026-10-15): owned playback tab 5 and both temporary policy-reading tabs were closed; existing user tabs were preserved. Korean gateway stopped with `ok: true, active: false`. Test-only locale/key probes were removed, provider language was English again, and no browser permission prompt or temporary backend deployment remained pending. Current cleanup is recorded in the follow-up above.

## Uploaded-subtitle restoration follow-up — 2026-10-16

This checkpoint supersedes the unresolved uploaded-selection observation above. Tested source is the restoration change included in the commit containing this checkpoint, based on `5abee3cb87f5d3fcd8a270d8add81bf14fa9c8a2`. The owner subsequently authorized committing this change; it is not yet part of the remote PR head. No release or public intake activation was performed.

On a new player document, the content script now requests the tab's saved upload selections through the background worker, reloads registered subtitle bodies with their saved delay, and reconciles deleted uploads. Explicit newer selection/deselection takes precedence. Startup reporting retries at most three times after a failed response and stops when the video is replaced or detached. The first native run exposed a failed initial restoration request; adding bounded retry and propagating restoration failure resolved that observation. The precise cause of the initial transport failure was not established.

- Automated gates: `yarn type-check`, `yarn lint`, `yarn test:run` (**306 tests, 44 files**) and the configured production build all PASS. Regression tests cover both roles, delay applied once, stale selection/video/route rejection, deleted uploads, asynchronous response handling and bounded startup retries. Three existing Webpack bundle-size warnings remain.
- `/en/play`: explicit player reload preserved the selected test upload in **both** roles without manual re-selection. Stored delay remained **+2 seconds**. Settled samples at 241.5/242.5/251.5/252.5 seconds showed no cue / first cue / first cue / second cue, with shifted starts 242/252.
- `/play`: a new full document preserved both selections and the delay. A subsequent reload hit provider buffering/timeouts and is not counted as PASS. After the dedicated KR gateway recovered, navigation to the same episode in another fresh document again restored both selections automatically; settled 241.5/242.5/252.5 samples showed no cue / first cue / second cue at the same shifted boundaries. No manual re-selection or restoration message was used for these final observations.
- Feedback: the previously retained IME draft was deleted under the owner's explicit instruction. An agent-authored synthetic draft survived an actual offline send failure and subsequent online rejection. Double-clicking final confirmation produced one POST; retrying reused request ID `e78c8e35-3100-4a71-b1da-19f7af3b33bc`. Both observed online responses were **403**, with no success notice and the draft retained. Payload keys were only `message`, `requestId`, `extensionVersion` (`1.13.0`). This is request/retry evidence, not production storage or lost-response proof.
- The intended native permission-denial attempt ended with permission present; no fresh denial PASS is claimed. The owner's prompt-visibility/denial answer remains pending. Programmatic permission removal during cleanup does not substitute for Chrome-settings revocation coverage.

Exact configured artifact:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `dist/index.js` | 769810 | `E31EF264A78BA6BEA5838E79B9E3205ECF81FF48DD18714C964F6275EAEA3ECC` |
| `dist/content.js` | 415614 | `424B1A3965AC09CB2C710E5D5453A3E41A95E323DE42229895A6C8F80438A5CE` |
| `dist/background.js` | 7410 | `7A48597E25AD5D52CA649DE1C148011C1B54B7B38A6E5A0F7BAD58416DFFB329` |
| `dist/manifest.json` | 900 | `D199F5FC67592AA0D42086CF02CC2546C5D22431D2A7FE507F650EE3BF82086A` |

Cleanup PASS: the agent-authored feedback draft and `v113-smoke` upload were removed through the UI; the existing upload was preserved. The passive fetch observer and restoration probes were removed, offline emulation reset, and feedback host permission removed. Exact JSON comparisons of sync, local, localStorage and permissions against ignored `services/feedback/.wrangler/pre-upload-restore-storage.json` all match. Post-check state is saved in `post-upload-restore-storage.json`. Provider language visibly restored to English at `/en/my-profile`, with no video active. Existing tabs 1/2 and actual panel 11 were preserved; no disposable test tabs remain. Gateway stop returned `ok: true, active: false`.

Release remains **HOLD**: fresh-install/default/onboarding/banner, native English Chrome locale, screen-reader output, fresh permission Deny/Cancel and settings revocation/re-request, native timeout/429/malformed-receipt/lost-response coverage, final-source full-diff review and Store alignment remain incomplete. Earlier receipt/backend checks retain their original source/date; D1 and deployment state were not refreshed in this follow-up. This change is committed at the owner's request; no push, tag, Store submission or collection activation is included in this checkpoint.

## Evidence limits, cleanup and decision

- Record **NOT RUN** and **BLOCKED** honestly; environment problems are not feature PASS.
- Record actual Chrome versus emulated UI/fixture coverage separately.
- Confirm owned test tabs/processes were cleaned up and unrelated browser data preserved.
- Confirm the release version, manifest, permissions, user-data disclosure, privacy policy and Store details match the candidate.
- Do **not** release while a required row is FAIL, BLOCKED or NOT RUN. Resolve missing evidence or receive an explicit, documented scope decision before further action.
- A passing matrix does not itself grant tag, Chrome Web Store submission, deployment or user-data collection authorization.
- Save the completed result with the exact release commit. For past evidence, use [docs/archive/releases/](./archive/releases/); do not overwrite older results when preparing a new release.
