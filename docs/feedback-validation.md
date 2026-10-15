# Issue #128 implementation validation

> **Historical validation snapshot — 2026-10-15.** Results, PENDING/NOT RUN gates and the no-merge statement below describe the pre-merge implementation review, not the present state. [PR #129](https://github.com/saramkim/play-plus/pull/129) was later merged to `main`. Merging is not evidence of Chrome Web Store publication, live feedback acceptance or completion of the remaining operational gates. Recheck [feedback service operations](./feedback-service.md) and current systems before release decisions.

Date: 2026-10-15 Pacific/Auckland. Base: `e4e7ebdb2684d6a4c9a61d0a4d283d914f179658`. Branch: `feat/in-panel-feedback`. Source version remains 1.12.0. The owner approved commits, pushes, review PRs and the free Cloudflare setup. The Worker is deployed with intake disabled; there has been no PR merge, Store submission or real user collection.

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
- Free D1 migration applied and Worker version `272f1475-8caf-41f9-80b7-ad14f08d54de` deployed at `https://play-plus-feedback.saramkimm.workers.dev`, `ACCEPT_FEEDBACK=false`. Registered Cron: `17 3 * * *`. Observability and previews disabled; per-IP 5/min and shared 100/min bindings deployed.
- Live HTTPS checks passed: allowed-origin POST 503, untrusted origin 403/no CORS, GET 405 and valid preflight 204. Remote D1 readback: zero feedback rows. Successful live POST/readback, actual scheduled execution and production rate-limit behavior remain NOT RUN.
- Publish the prepared policy through website PR https://github.com/saramkim/saramkim.com/pull/3. Website lint/typecheck/build/export and 360px/desktop preview passed; existing dependency audit fails high/critical advisories and remains a publication gate.
- After policy publication, validate production POST → D1 receipt, rate limits and cleanup before collection; establish operational shutdown thresholds and verify applicable account-level logging controls.
- Complete actual Chrome checks and the full release matrix on the final approved production build; update Store data/permission disclosures.
- PR merge and Store release require their own authority and completed checks; commit/push/review-PR authority has been granted.

Implementation, automated verification, targeted Chrome checks and disabled-intake deployment are complete. Remaining browser, website and live-collection gates are open; users cannot yet submit feedback to this deployment.
