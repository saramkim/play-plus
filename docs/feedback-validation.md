# Issue #128 implementation validation

Initial validation: 2026-10-15 Pacific/Auckland, base `e4e7ebdb2684d6a4c9a61d0a4d283d914f179658`, branch `feat/in-panel-feedback`. Follow-up production evidence below is dated 2026-10-15 UTC. Feature PR #129 merged as `df5e61a459b222fe4ead2691a7ef9b0569772b66`; source version remains 1.12.0. The owner approved commits, pushes, review PRs, the free Cloudflare setup and remaining validation work. Intake is temporarily enabled only for synthetic tests and restored afterward. No Store submission or real user collection has been performed.

## Automated verification

| Check | Result | Evidence |
| --- | --- | --- |
| Extension type check | PASS | `yarn type-check` |
| Repository lint | PASS | `yarn lint`, including the isolated Worker source/tests |
| Extension/build configuration tests | PASS | Final `yarn test:run --maxWorkers=2`: 42 files, 292 tests |
| Worker type check | PASS | `npm run type-check` in `services/feedback` |
| Worker bundle | PASS | Wrangler 4.151.0 `deploy --dry-run`, no deployment |
| Worker runtime integration | PASS | 9 tests in local workerd + D1 + Rate Limiting bindings |
| Development manifest | PASS | Actual `yarn build:dev` with local HTTPS configuration emitted only `https://localhost:8787/*` as optional host; required host remained Coupang Play |
| Production manifest | PASS | Final unconfigured `yarn build` removed local optional host; version 1.12.0; required hosts unchanged |
| Build-address gate | PASS | Missing paired values, non-HTTPS, path/userinfo/wildcard origin, local/placeholder production addresses rejected; explicit development allows localhost |
| Whitespace | PASS | `git diff --check` |
| GitHub PR CI | PENDING | Authorized review PR; workflow includes isolated Worker installation/type/test. Use the PR's exact-head checks for current status. |

The first unconstrained full test run passed 287/288 tests; the existing `subtitle-delay-form.test.tsx` timer-count assertion failed once. That file passed 14/14 in isolation, and the complete suite passed with two workers. After the actual-Chrome focus correction and its regression test, the final full run passed 292/292 with two workers; type check and lint also passed again. The existing timer test source was not changed. Vite emitted its existing Yarn PnP advisory. The Worker tests use the pinned Miniflare version matching Wrangler and its supplied v4-options adapter.

UI tests cover no send on discovery/typing, onboarding precedence, persistent dismiss, unconfigured/disabled intake, trimmed 1/1,000-character boundaries, validation errors, permission refusal, pending double-click and cancel protection, same-ID retry, new ID after editing, 429/offline errors, invalid receipts, timeout, IME/Enter safety, success and actual App focus restoration/re-entry. App integration tests mock unrelated pages and the footer entry. An additional test renders the real Radix MoreMenu and verifies that it releases the page's aria-hidden state before opening feedback. These tests do not replace actual Chrome permission evidence.

Worker tests exercise compiled code against local D1, including POST/readback/server time, identical and concurrent retries, ID conflict, extra/media fields, types/length/body/content-type, chunked body limit, CORS/preflight/HTTPS/no public reader, actual local per-IP limit and Retry-After, scheduled expiration preserving recent rows, storage failures, and checked-in intake-disabled configuration. They do not prove the target Cloudflare account's quota/billing/logging configuration.

Final unconfigured `yarn build` passed with the existing three Webpack size/performance warnings. Entry bytes: index 767515, content 413453, background 6939; all remain under 1 MiB. The localhost development build used below was replaced with this production baseline, and the installed extension was reloaded. Its manifest has no optional host permission and requires only Coupang Play. No generated output is included in the source changes.

## Actual Chrome and environment

Initial attempt: **BLOCKED ON ENV**. The dedicated gateway successfully verified Korean proxy egress, unchanged Windows routing, and Coupang login readiness. Both `chrome-devtools-kr.list_pages` and `list_extensions` then returned:

> The browser is already running for C:\Users\Yujun\.cache\chrome-devtools-mcp\chrome-profile-kr-auth. Use --isolated to run multiple browser instances.

Ownership of the running browser was not established, so no process was terminated, no profile lock was removed, and no existing tabs were changed. This task created no browser tabs. Its newly started VPN gateway was stopped; result `ok: true, active: false`.

This initial blocker was subsequently resolved as described below. The old release smoke matrix is not used as evidence for these changes.

### Resumed after explicit browser takeover authorization

The browser was traced to the idle prior task `01a139b9-d87b-7be2-b913-ed9b61a4ac77` (Chrome PID 36664, parent MCP PID 4248). The user explicitly authorized closing it and using the profile in this task. The process identity was rechecked and that Chrome was stopped; no other browser process was targeted. The new gateway passed Korean egress, unchanged-host and login-preflight checks.

- New Chrome inventory: existing `about:blank` page 1; no extensions reported installed. Installed this repository's stable `dist/` as `mpknnoepdadenanfhmccdaoiaidjhcna`.
- Owned page 2: Coupang Play; retained authenticated session, navigated via visible Resume control to `/en/play/bbdda45f-6c8f-4ef0-8e54-51541c2ae1fe/episode`. Video reached readyState 4 and played an advertisement. This alone does not pass playback/subtitle regression.
- Actual extension action opened **Extension Page 3**, the real side panel. Initial viewport 360×770. Onboarding suppressed the invitation; choosing Set Up Manually displayed the banner. Opening the form focused the textarea. No feedback fetch occurred on these actions.
- Existing extension data included archived-v2 keys. Full sync/local/localStorage backup is saved locally at ignored `services/feedback/.wrangler/chrome-storage-backup.json`. Do not treat this profile as a pristine v1 installation or discard its data. Restore after validation.
- Local-only `wrangler.local.jsonc` allows exactly the unpacked extension ID, enables test intake, and uses a local-only wrapper for `/privacy`. The wrapper and config are ignored; production source has no policy fixture route. A local TLS exception was accepted only for localhost in this dedicated browser; system certificate checks were not disabled.
- The local policy fixture was read successfully; owned policy/error pages 4 and 5 were closed after verification.
- English form at emulated 320/360/390px: document scroll width equalled viewport width in all three; textarea and buttons fit horizontally. At 320px, scrolling the main area exposed the send button fully inside its viewport. A 360px screenshot was visually checked. These are side-panel viewport emulations, not physical side-panel drag measurements.
- First Send with synthetic text `Issue 128 local Chrome synthetic feedback A` requested the optional host. `chrome.permissions.contains` remained false; the form remained pending with the draft intact; send/cancel were disabled. Repeated clicks did not generate a request. Panel fetch/XHR list was empty and actual local D1 count was 0.
- The user clarified that they were connected remotely and could not operate the local permission prompt. The initial pending test was ended by reloading the extension. This is not a denial test or evidence of draft persistence across reload.
- Using Chrome's own extensions management API, `developerPrivate.addHostPermission`, granted only `https://localhost:8787/*` in the dedicated profile. After reload, the product's real Send action completed its unchanged `chrome.permissions.request` call; `permissions.contains` became true. No permission/fetch mock, manifest rewrite, or broader host grant was used. This proves management-assisted grant and real submission, not interaction with the native Allow button. API contract: [Chromium developer_private.webidl](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/common/extensions/api/developer_private.webidl).
- Real panel POST returned 200 and displayed success only after the matching receipt. D1 readback: ID `d4f69865-5e99-46af-a09f-960ff07f83b7`, synthetic message B, version 1.12.0, server time `2026-10-14T23:21:51.289Z`. Request JSON contained only message, requestId and extensionVersion; no cookie/referrer was sent. Success took focus; closing restored the footer trigger; the banner remained dismissed after reload.
- The permanent footer entry reopened an empty form. Enter added a newline without sending. Chrome offline emulation produced `ERR_INTERNET_DISCONNECTED`; the visible error retained the exact draft and re-enabled controls. Online retry reused ID `ef5165bc-8fc4-401d-859c-54d4a6b25934`, trimmed the newline, returned 200 and stored one row at `2026-10-14T23:23:00.904Z`.
- Six direct browser fetches repeated that same synthetic receipt solely to exercise idempotency and saturate the actual local rate limiter (200/200/200/200/429/429). A subsequent real UI Send returned 429, displayed the rate-limit message, and retained the draft. D1 contained exactly two rows/two distinct IDs afterward. This fixture traffic is distinct from the product's explicit-Send-only traffic.
- `chrome.permissions.remove` returned true for the localhost host; `permissions.contains` then returned false. Actual native Deny/Cancel behavior remains NOT RUN; unit coverage is not substituted for it.
- Actual menu opening initially emitted Chrome's focused-descendant/aria-hidden warning. Moved opening feedback to the dropdown's close-autofocus callback. Rebuilt/reloaded and repeated the real menu action: menu absent, textarea focused, no hidden ancestor and no warning/error. Escape from the textarea closed the form and restored footer focus. The real-Radix regression test passes.
- Related existing functionality: player reloaded to Connected/Detected; content video readyState 4 and duration 710.443 seconds; both English/Korean platform subtitles rendered; Analysis listed 242 cues. With video paused, ArrowRight moved from 60.059444 to the next subtitle at 60.833 seconds. Clicking the subtitle saved it and Review displayed one matching entry. Primary font-size change 6→7 was saved through the existing Save button and persisted across extension reload. These are targeted regressions, not the full release matrix.
- Player console contained service preload/DRM robustness warnings. Panel's intentional offline/429 errors were recorded separately from the corrected focus warning. Korean extension UI layout, native IME composition and screen-reader operation remain NOT RUN; Korean subtitle rendering is not Korean extension UI evidence.

Cleanup completed: restored the original sync/local/localStorage backup and read back equality for all three stores; removed the localhost permission; closed owned player, policy and management tabs. Reloading the final production build closed the owned panel. The final browser inventory contained only the pre-existing blank page 1. The local Wrangler process exited and port 8787 had no listener. Gateway stop returned `ok: true, active: false`. Ignored local backup and synthetic test DB remain available for audit; no user data was added to source changes.

Remaining browser release checks: native Allow/Deny/Cancel prompt interaction, Korean extension UI layout, native IME, screen reader and the full production release matrix. They do not require the user to take local action in this remote session; they remain explicitly unverified.

## Human/environment release gates

**NOT RELEASE-READY**. Current infrastructure evidence and remaining gates:

- Approved account, exact endpoint, D1, Free plan, public operator/contact and 90-day retention plus daily interval / seven-day recovery history are recorded in `feedback-service.md`.
- Free D1 migration and Worker deployment at `https://play-plus-feedback.saramkimm.workers.dev` are complete. Default intake remains disabled. Observability and previews are disabled; per-IP 5/min and shared 100/min bindings are configured. These are approximate location-scoped limits, not exact accounting or global spending caps.
- Live HTTPS checks passed: allowed-origin POST 503 when disabled, untrusted origin 403/no CORS, GET 405 and valid preflight 204. Enabled-intake CLI tests now verify production storage/readback, retry and rejection behavior; see evidence below. They do not replace real Chrome submission or permission tests.
- Website PR https://github.com/saramkim/saramkim.com/pull/3 merged as `76628ca32de79d59856b6c41757ad081736e396a`. Released dependency fixes plus the owner's documented narrow braces exception passed full CI/audit. Vercel deployed successfully; live policy HTTP 200, both languages, operator/contact, retention, canonical URL, footer and sitemap passed. The user reported requesting FortiGuard reclassification after an Unrated block; approval/propagation is unconfirmed.
- Real scheduled retention execution is verified below. Before public collection, finish operational/account logging checks. `feedback-service.md` contains draft Store descriptions and a fail-closed shutdown procedure.
- Complete actual Chrome checks and the full release matrix on the final approved production build; update Store data/permission disclosures.
- Feature PR #129 is merged. Store release still requires explicit authority and completed checks. No version bump, tag, Store submission or publication has been performed for this feature.

Implementation, automated verification, targeted Chrome checks and policy publication are complete. Remaining browser and live-collection gates are open; existing Store users do not yet have this feedback feature.

## Production synthetic checks (2026-10-15 UTC)

The API was enabled temporarily with the existing exact Store origin and real D1 binding, then restored to disabled intake in a `finally` block. No Chrome permission was bypassed: these were server-side CLI probes, not browser UX evidence. Test rows were removed by exact random receipt ID and verified absent. No real opinions or IP addresses were exported.

- Version `411fe6f3-e202-4d28-a376-f0a2f8335663`, 03:25:59–03:26:04: a synthetic POST returned 200 with only the expected receipt fields. Exact D1 readback matched the submitted message, version and server timestamp. An identical retry returned the same receipt and left one row; changed text under the same ID returned 409; an extra payload field returned 400.
- The first test incorrectly expected the sixth request to be 429. It returned 200, so that whole test run is **not PASS**. Requests crossed the minute boundary, and Cloudflare's limiter is permissive/eventually consistent. The failed assertion and cleanup result are retained in ignored local evidence. Disabled version `c7283c09-2233-4404-924b-f3cf1de6ea74` then passed the 503/403/405/204 probes.
- Version `b7d740fa-9035-49fb-8a1c-ef6bbdabfb6c`, 03:27:05–03:27:08: storage/readback again succeeded, followed by an actual 429 with `Retry-After: 60` from AKL. This confirms live throttling, but that run also failed its fixed-order expectation of a successful retry and is **not an all-green suite**. Its synthetic row was deleted; disabled version `971f87d3-db6d-438b-a77c-7b67b7e763d5` was restored.

The individually observed storage, idempotency, rejection and throttling outcomes are valid; do not relabel the failed fixed-sequence scripts as passing. [Cloudflare documents the rate limiter's locality and approximate consistency](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

- A third immediate-after-deploy run on `23418d28-ed1a-4eb0-b3b2-27b471f30b9d` passed storage/retry/conflict checks, then received an unexpected 503 for an extra-field request at 03:35:26. This run failed and was cleaned up; the cause is **UNKNOWN**, not proven to be deployment propagation. Disabled version `95ea2aa7-ac0d-4ae4-ae02-430c521467cf` was restored.
- Final run on `9b31995e-e35f-4731-b31c-01783d9430f3`, after a 30-second post-deploy wait: **PASS** for 200 receipt/exact D1 readback, same receipt and one row on identical retry, 409 conflicting retry, 400 extra field, 429 with `Retry-After: 60` within a bounded probe, and 403/no CORS for a foreign origin. All replies were no-store. Only this final full sequence is recorded as passing; the earlier failure evidence remains preserved.
- Final restoration: `8fe6b402-5cfb-472f-8b88-aea4fa793a4a`, `ACCEPT_FEEDBACK=false`, daily `17 3 * * *` UTC. Disabled-intake 503, foreign-origin 403, reader 405 and preflight 204 checks all passed. Remote D1 total count was zero after exact synthetic-row cleanup. Before collection commencement, allow deployment settings to settle and repeat a synthetic smoke check; investigate any recurring 503 instead of treating it as confirmed propagation.

### Real scheduled retention

From 03:28:38 to 03:34:36 UTC, intake stayed disabled while two synthetic rows were inserted: one 91 days old and one current. A temporary every-minute Cron was deployed as `8a72b8b5-5ac7-4f78-ab29-6a4a6699b0d3`, with a bounded wait and mandatory restoration/cleanup in `finally`. At 03:34:28 the actual scheduled handler had deleted the expired row and preserved the recent row. No manual deletion of the expired fixture occurred before this observation.

The original daily `17 3 * * *` UTC schedule and disabled intake were redeployed as `ff5cf6b2-75a3-4116-b563-2346357dff16`. Both exact synthetic IDs were then deleted and read back as absent. This proves actual Cloudflare scheduled-handler execution with D1 retention, not the elapsed timing of the next daily 03:17 run. Cron configuration propagation may take time; keep this separate from the already passing local scheduled test.

### Additional production-origin Chrome check

The later production-origin Chrome test installed the configured local build with user approval and verified no requests before Send, no request while permission was pending, and retained draft text. Native Allow/Deny/Cancel remained inaccessible to the available tool. Reload discarded the in-memory test draft and ended the pending request; it was not a denial test. Its Set Up Manually onboarding flag remains set in the dedicated test profile. The default disabled build was restored, owned tabs closed and the gateway stopped; do not apply the earlier full-storage restoration claim to this later test.

The available browser connector also refused navigation to the Chrome Web Store developer console. No Store fields were edited and no package was uploaded; the resulting temporary blank tab was closed. Store copy is prepared in `feedback-service.md` for a later authorized submission through an available management interface.
