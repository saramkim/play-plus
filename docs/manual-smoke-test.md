# Play Plus Manual Release Smoke Test

> **v1.13.2 candidate — technical follow-up complete; final CI and release actions tracked in PR #134.** Runtime fixes are committed at `5e458f65d00b6b6a6445b54afaf2d7cab3b42c97` in PR #134. The owner reports a v1.13.1 rollback to v1.12.0 behavior. The final v1.13.2 checkpoint below distinguishes new Chrome checks from reused evidence and retains the two owner-approved test exclusions. The original v1.12.0 record is preserved at [archive/releases/v1.12.0-smoke-test.md](./archive/releases/v1.12.0-smoke-test.md).

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

## Final verification and review checkpoint — 2026-10-16

This checkpoint supersedes the remaining technical holds above. It does not turn earlier partial observations into new full-matrix runs. Runtime source is `403b7abf64c881ea9aeb1b1cbbec56f67183f614`, pushed to `origin/codex/feedback-native-validation` at the owner's request. PR #133 base remains `e010995a288c408cc24693156f5eaa6b23751557`; GitHub CI run [38772679238](https://github.com/saramkim/play-plus/actions/runs/38772679238) passed on this exact head. Type check, lint, 306 tests in 44 files and the configured production build passed in this session. The artifact hashes in the uploaded-subtitle follow-up remain unchanged. No runtime code changed during this final verification.

| Final check | Result | Evidence and limits |
| --- | --- | --- |
| Fresh extension state | PASS | Exact copies of the configured `dist/` loaded under new IDs `hacgamfkploljnnbkejajjhfhcdoemaa` and `cbcllemjbepdmomgkhnkpcaippombjeh`. Sync/local/localStorage initially empty, feedback permission absent, zero feedback requests. This is fresh extension storage in the existing authenticated browser, not a clean browser profile. |
| Onboarding and discovery | PASS | Actual action-opened Korean and English panels showed onboarding before the banner. Set Up Manually exposed the approved announcement/outline button. Dismissal survived panel reload; More options reopened an empty form and focused the textarea with zero feedback requests. |
| Fresh defaults and playback after denial | PASS, both routes | Primary English/secondary Korean default settings; real episode on `/en/play/.../episode` and `/play/.../episode` reached connected/detected, readyState 4, actual playing content and both subtitle overlays. English route loaded 242 English and 249 Korean cues. Pause/seek remained functional with feedback permission denied. No duplicate extension was installed during playback. |
| Native English locale | PASS | Chrome UI was changed through Settings and relaunched; `chrome.i18n.getUILanguage()` returned `en-US`, with no locale injection. Form and confirmation fit 320/360/390px without horizontal overflow or hidden action buttons. Initial focus, Shift+Tab wrapping and Escape draft/focus restoration passed. Earlier native Korean layout and human IME results remain attributed above. |
| Native permission Allow | PASS | Owner initially reported denial, then corrected that they had clicked Allow. Permission was true; a server rejection preserved the draft. The corrected observation is Allow only. |
| Native permission Deny/Cancel | PASS | A second fresh extension ID displayed a new Chrome prompt. Owner clicked Deny/Cancel; permission stayed false, request count stayed zero, the exact draft remained and the permission error was visible. This does not distinguish separate Deny and Cancel controls. |
| Offline/reconnect | PASS | Actual offline failure and subsequent online rejection retained the draft, as recorded in the restoration follow-up. Successful online retry is covered by the controlled storage test below. |
| HTTP failures and receipts | PASS, controlled local backend | Actual Chrome HTTP against local workerd/D1: 503, malformed 200 receipt, valid but mismatched receipt ID, actual Worker rate-limiter 429, and client timeout at 15,008ms all retained input without false success. Only the feedback fetch transport was redirected to loopback; the compiled bundle and native permission behavior were unchanged. These are not production-network failure tests. |
| Lost response and repeated click | PASS, controlled local backend | Worker stored a row, then the transport socket dropped the response. Chrome's HTTP retry and the later UI retry reused ID `71435fdb-8844-4716-842e-c99e2ecfaaec`; D1 held one row with timestamp `2026-10-15T17:06:28.49Z`. Double-clicking final confirmation on retry produced one successful client POST. Matching receipt focused success and cleared the input. Payload keys were only `message`, `requestId`, `extensionVersion` (1.13.0). |
| Screen-reader spoken output | NOT RUN — owner exclusion | Owner explicitly requested skipping this test. DOM/focus/keyboard evidence is not spoken-output evidence. |
| Chrome-settings revocation/re-request | NOT RUN — owner exclusion | Owner explicitly skipped this after the proposed temporary automatic-site-access change. That setting was never changed. API permission cleanup is not settings-level validation. |
| Final source review | COMPLETE; no blocking finding identified | Author review of all 20 PR diff files at the exact head/base above, plus focused inspection of the broader changes since v1.12.0: storage/upload/delay, native subtitle isolation, playback/loop lifecycle, analysis/keyboard, feedback client/Worker/manifest and CI. This is not an independent external review or proof of all possible browser/network behavior. |

Production readback: Worker `51030da8-1cb2-455f-951c-b89def907397` remains at 100%, with `ACCEPT_FEEDBACK=false` and only the Store extension origin. D1 count is **0**, with no rows written by the readback. Safe empty-body probes reconfirmed disabled intake 503, untrusted origin 403, no public reader 405 and preflight 204. No deployment or public collection activation occurred in this checkpoint. Earlier production receipt and retention evidence remain attributed to their original checkpoints.

Cleanup: the controlled local D1 was emptied (0 rows); loopback server stopped; fetch instrumentation and header-name-only observer removed. Both temporary extension copies were uninstalled. Chrome display language and preference order were restored to Korean, English (United States), English; Coupang Play's language was visibly restored to English, with no test video playing. The stable `dist/` extension was restored, version 1.13.0, native UI language `ko`, no draft. Exact JSON comparison against `pre-final-release-storage.json` confirms unchanged original sync, local, localStorage and permissions, including the existing upload. Owned playback/settings tabs were closed; pre-existing or uncertain-ownership tabs were preserved. No pending native permission prompt remains.

Dedicated gateway cleanup returned `ok: true, active: false`. Loopback port 18789 has no listener.

Decision: technical verification is complete subject to the two explicit exclusions above. Submission still requires the owner-deferred Store policy URL, reviewed data categories and certifications, and confirmation of the currently published version. See [Store preparation](./feedback-service.md#store-data-category-review--2026-10-16). No merge, release commit/tag/ZIP, Store upload/submission/publication or public intake activation was performed. The owner explicitly authorized committing and pushing this documentation checkpoint after reviewing the final results.

## Post-release native subtitle regression fix — 2026-10-16

The owner reports rolling the Store back to v1.12.0 behavior under version v1.13.1. This checkpoint covers uncommitted fixes on `codex/fix-native-subtitle-regressions`, based on `959d31a6d258ad05254229e891fdad345612c844`. Package/manifest versions remain 1.13.0 for this local test build; it is not a new Store submission artifact. These observations do not establish the reviewer's exact failing title or installed version.

Three content-side defects were addressed:

- Same-title media element/source replacement no longer discards in-flight native subtitle acquisition. Title and newer-request guards remain enforced.
- Lifecycle refresh checks the current page URL before emitting a video ID. Page-world SPA navigation can bypass the isolated content world's history wrappers; the previous player/source is retained for transition comparison so an already-replaced player is not mistaken for stale content.
- An invalid cue is excluded individually instead of rejecting its entire track. Tracks with no usable cues still fail.

Automated gates: type check, lint, **312 tests in 44 files**, and the configured production build PASS. Regression cases failed before their respective fixes: two same-title media changes, three invalid-cue positions, and two page-world route/player changes. Tests also cover new-episode acquisition across lifecycle refresh and actual background persistence for both language tracks. Three existing Webpack size warnings remain. Final tested `dist/content.js` SHA256: `A00C3028B748936DB5F677A718C82C42AAE0EDA77F6081443D8F8F45F4292DE8`.

| Actual Chrome check | Result and limits |
| --- | --- |
| Initial playback | Both native overlays and the actual side-panel list displayed on `/en/play`. |
| Different-episode SPA navigation | The first build, containing only acquisition/cue fixes, reproduced missing subtitles after Next Episode. After the lifecycle fix, the provider's Next Episode button changed `be5a6352-dff1-4328-b0b3-f1b5ab9c382d` to `ba219084-82bf-4114-8665-99abbabbb357` in the same document. Session data contained 274 English and 258 Korean cues for the new ID; the actual panel displayed the 274-cue list with 14 virtualized rows. |
| Mixed valid/invalid cues | Controlled inline metadata/VTT fixtures passed through the compiled extension's native acquisition and background persistence. Each language retained one healthy cue and excluded the reversed-time cue; both overlays and the panel showed the healthy text. This is not a malformed provider-asset observation. |
| Reload after fixture | Provider metadata restored 274 English/258 Korean cues; synthetic text was absent. Both natural subtitle overlays displayed again during playback. |

Cleanup PASS: exact comparisons confirm original sync/local storage, extension localStorage and permissions restored, including existing uploads. Test instrumentation and synthetic tracks were cleared; no feedback was sent. Owned playback tab 2 and side-panel page 4 were closed; pre-existing blank tab 1 and the stable extension were preserved. Provider language remained English. Dedicated gateway stop returned `ok: true, active: false`. Ignored diagnostic evidence is under `services/feedback/.wrangler/incident-20261016/`.

Scope: bug-fix validation complete; **not a release-readiness declaration**. This follow-up did not rerun the full release matrix, the `/play` route in actual Chrome, or a Store automatic-update path. No commit, push, tag, deployment, Store submission or collection-setting change was performed.

## v1.13.2 candidate follow-up — 2026-10-16 Pacific/Auckland

Runtime source: `5e458f65d00b6b6a6445b54afaf2d7cab3b42c97`; reviewed base: `959d31a6d258ad05254229e891fdad345612c844`. [PR #134](https://github.com/saramkim/play-plus/pull/134), GitHub [CI run 38860885865](https://github.com/saramkim/play-plus/actions/runs/38860885865), **PASS**. The version commit containing this checkpoint changes only package/manifest version to 1.13.2, README and this checkpoint. No runtime changes followed the 312-test/type/lint PASS. A new configured production build passed with the same three size warnings; all three JavaScript hashes exactly match the previous tested fix build, so those automated results are reused rather than rerun solely for version/docs changes.

Actual Chrome 155, persistent dedicated KR profile, stable unpacked extension `mpknnoepdadenanfhmccdaoiaidjhcna`, manifest **1.13.2**, action-opened side panel:

| Area | Current evidence / reuse boundary |
| --- | --- |
| Install and existing storage | PASS: 1.13.2 loaded; actual panel connected/detected. Original sync/local/localStorage/permissions match after cleanup. This is persistent-profile unpacked evidence, not Store auto-update delivery. |
| `/en/play` and pre-roll recovery | PASS: actual 15-second provider ad was observed, then content reached readyState 4 with both native overlays and 274 English/258 Korean cues. This does not add a new during-ad shortcut-inhibition claim; classifier/lifecycle advertisement tests remain part of the 312-test suite. |
| `/play` | PASS: provider language temporarily changed via its UI under the prior owner approval. Native overlays, 274-cue actual analysis list, player reload and panel close/action-reopen worked. |
| Different-episode SPA on `/play` | PASS: native Next Episode changed `ba219084-82bf-4114-8665-99abbabbb357` to `878f0ed9-b9b5-45dd-8b6e-307f409f9dc8` without losing the document marker. New title stored 206 English/211 Korean cues; actual panel had 206 cues/18 virtualized rows. Both overlays were sampled at 37.409s. `/en/play` different-episode evidence is recorded in the preceding fix checkpoint on identical JavaScript. |
| Primary/secondary visibility | PASS: Q hid only English and W hid only Korean after that SPA transition; both restored. |
| Upload selection, delay, reload | PASS on `/play`: UI-uploaded two-cue SRT selected for both roles, delay +2 seconds saved, then player reloaded without reselecting. Settled playback samples: 241.899 empty, 243.050 first cue in both overlays, 251.941 first, 253.049 second. Earlier immediate paused-seek samples were empty and are not counted as proof; settled readyState 4 playback is the evidence. Prior `/en/play` upload/edit evidence is reused for unchanged upload code. |
| Seek, speed, loop, reconnect | PASS on `/play`: ArrowRight 252.5→262.5, ArrowLeft→252.5; Period 1→1.1, Slash→1. Current uploaded cue loop wrapped 261.883→252.721 within 252–262; L disabled looping and subsequent playback at 265.620 remained beyond its end. Closing/reopening the actual panel retained selection and connection. |
| Copy/save/review, other settings, feedback | REUSED: earlier final v1.13.0 checkpoints. Their UI/background/storage/permission code is unchanged; exact index.js/background.js hashes are unchanged, and current native acquisition, display, controls and storage were checked above. No new clipboard prompt, feedback POST, backend mutation or policy change was performed. |
| Accessibility and permission revocation | NOT RUN — retained owner exclusions: spoken screen-reader output and Chrome-settings revocation/re-request. No new exclusion is inferred. |
| Final source review | COMPLETE, no blocking finding identified: author review of all seven committed diff files plus route observation, lifecycle classification/consumer, native request ordering and background persistence; version-only manifest change/required permissions also checked. This is not an independent review or a guarantee against every provider timing variation. |

Candidate artifact (configured endpoint/privacy URL unchanged):

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `dist/index.js` | 769810 | `E31EF264A78BA6BEA5838E79B9E3205ECF81FF48DD18714C964F6275EAEA3ECC` |
| `dist/content.js` | 415622 | `A00C3028B748936DB5F677A718C82C42AAE0EDA77F6081443D8F8F45F4292DE8` |
| `dist/background.js` | 7410 | `7A48597E25AD5D52CA649DE1C148011C1B54B7B38A6E5A0F7BAD58416DFFB329` |
| `dist/manifest.json` | 900 | `55A1696805070582AAA6121F4DD4F2B937671E364A340D9A381F6930DDFAA06E` |

Ignored `services/feedback/.wrangler/incident-20261016/play-plus-1.13.2-candidate.zip` has SHA256 `08532E36784F82333CFBAA38D216201D5A04137CCCEDD96F80C34CFEDCF6FD43`. All 15 archive entries were read and compared by SHA256 against the tested `dist/`; manifest is at archive root and no source, credentials or test evidence is packaged. This is the candidate for the version commit containing this checkpoint; the release/tag workflow and Store submission remain separate.

Cleanup PASS: synthetic upload deleted through its confirmation UI; existing upload preserved. Exact sync/local/localStorage/permissions comparisons pass. Provider Language visibly restored to English. Owned playback tab 2 and panel 4 closed, existing blank tab 1 preserved, diagnostic timers removed with their document. No video, pending permission prompt or feedback draft remains. Gateway stop: `ok: true, active: false`. Panel and worker console error queries returned none; provider warnings are not counted as extension failures.

Decision: technical follow-up complete using current targeted Chrome evidence plus the explicitly identified unchanged evidence above. This is not a claim of freshly repeating every matrix row. The owner authorized committing/pushing the version and this checkpoint and checking final CI. The final version-commit CI result is tracked in PR #134 to avoid a documentation-only commit loop. Merge, release tag and Store upload/submission remain separate steps. No merge, tag, Store action or backend deployment is included.

## Evidence limits, cleanup and decision

- Record **NOT RUN** and **BLOCKED** honestly; environment problems are not feature PASS.
- Record actual Chrome versus emulated UI/fixture coverage separately.
- Confirm owned test tabs/processes were cleaned up and unrelated browser data preserved.
- Confirm the release version, manifest, permissions, user-data disclosure, privacy policy and Store details match the candidate.
- Do **not** release while a required row is FAIL, BLOCKED or NOT RUN. Resolve missing evidence or receive an explicit, documented scope decision before further action.
- A passing matrix does not itself grant tag, Chrome Web Store submission, deployment or user-data collection authorization.
- Save the completed result with the exact release commit. For past evidence, use [docs/archive/releases/](./archive/releases/); do not overwrite older results when preparing a new release.
