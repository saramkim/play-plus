# In-panel feedback (Issue #128)

> **Operations guide (2026-10-15 status snapshot).** Extension [PR #129](https://github.com/saramkim/play-plus/pull/129) and validation documentation [PR #132](https://github.com/saramkim/play-plus/pull/132) are merged. The privacy page was published and synthetic production API checks were recorded, but Chrome Web Store publication and real-user feedback collection are not established by those steps. Verify live Worker intake, policy disclosures and release gates at execution time. See the [document guide](./README.md) and [archived validation](./archive/feedback/2026-10-15-issue-128-validation.md).

This v1 feature collects voluntarily submitted text before the future 2.0 release. The Worker is isolated in `services/feedback`; it is not imported into any extension entry. No account, email, media URL, subtitles, cookies, telemetry SDK, attachment or automatic submission is added.

## Configuration and current release gate

### Owner-approved operating choices (2026-10-15)

The owner approved the following free-plan setup, Wrangler access and both repositories' commits, pushes and review PRs, then authorized completing the remaining work. Play Plus PR #129 and website PR #3 were subsequently merged. Paid upgrades and Store submission/publication remain separate decisions.

- Cloudflare account: `Saramkimm@gmail.com's Account` (`06dcd49cf34af7e671eff6950e9199b8`), Workers Free verified in the dashboard.
- API target: `https://play-plus-feedback.saramkimm.workers.dev`; no DNS migration or new domain.
- Policy target: `https://www.saramkim.com/play-plus/privacy`.
- Operator: 김유준; public contact: `saramkimm@gmail.com`. The supplied phone number is omitted from the public page.
- Retention: 90 days plus the daily cleanup interval, with up to 7 additional days in Free D1 recovery history.
- D1 `play-plus-feedback` was created through the existing authenticated dashboard, with Asia Pacific location hint. Database ID: `a9f9ee53-6f21-444f-9f7a-ea45b7424094`. A hint is not a country residency guarantee.
- The ignored `services/feedback/wrangler.production.jsonc` references this real database and the agreed workers.dev route. Previews/logging are disabled. Intake is opened only for controlled synthetic validation and restored to `ACCEPT_FEEDBACK=false` afterward; see `archive/feedback/2026-10-15-issue-128-validation.md` for current evidence.
- The bilingual policy page, footer and sitemap are live at the approved URL. Website PR #3 merged as `76628ca32de79d59856b6c41757ad081736e396a`; final CI, Vercel production deployment and live HTTP/content checks passed. Desktop and 360px previews rendered without horizontal overflow. The owner reported submitting a FortiGuard reclassification request after an Unrated network-policy block; reclassification is not yet confirmed.
- Wrangler is authenticated with the approved `account:read`, `user:read`, `workers_scripts:write`, `d1:write` scopes and OAuth background access. Credentials are encrypted with a key in Windows Credential Manager; no credential is included in this repository. Unneeded default scopes were not requested.
- Live HTTPS probes passed: allowed-origin POST returns 503 while intake is disabled; untrusted origin returns 403 without CORS allowance; GET returns 405; valid preflight returns 204. Temporary enabled-intake tests verified production POST, exact D1 readback, identical retry receipts, conflicting-ID rejection and 429 responses. Synthetic rows are deleted by exact ID; these CLI probes do not prove Chrome permission interaction.
- Website PR: https://github.com/saramkim/saramkim.com/pull/3. Released dependency fixes and the owner's narrow exception for unpatched braces advisory `1240992` allowed the full audit/CI to pass. The exception is documented in that repository and is not a vulnerability fix.

Next: finish the remaining live-service and actual Chrome checks, review operational shutdown procedures, and prepare the final versioned release. Extension Store release remains a separate gate; the default build does not enable feedback.

An unconfigured extension build has no feedback host permission, hides the invitation banner, and explains that feedback is unavailable when opened from More options. It remains usable for all existing features. This is **not a feedback release candidate**.

The owner must approve the Cloudflare account, exact HTTPS API origin, D1 database, operational costs, public privacy policy URL, deletion/contact route, and collection commencement. None is implied by implementation, PR creation or merge. Do not invent a policy or deploy the local configuration. The checked-in Worker has `ACCEPT_FEEDBACK=false`, no public routes, and a local-only D1 identifier.

Extension build variables (both required together):

- `PLAY_PLUS_FEEDBACK_ORIGIN`: exact approved HTTPS origin, with no path or trailing slash.
- `PLAY_PLUS_FEEDBACK_PRIVACY_URL`: approved published HTTPS policy URL.

Webpack injects these values into the side panel and adds only `<origin>/*` to the generated manifest's `optional_host_permissions`. The source manifest and required permissions are unchanged. The server address is public configuration, never a secret. Production builds reject localhost, IP and reserved example/test addresses. With no variables, `yarn build` remains the disabled baseline. Never package a local test build for the Store.

The send click synchronously calls `chrome.permissions.request`, then awaits the result. Denial leaves the draft and other features intact. Opening the form, typing, dismissing or installing makes no feedback request. A clicked privacy link navigates to the policy separately. Drafts and retry IDs stay only in panel memory. Cancel discards the draft; panel closure may also discard it. Only banner dismissal is persisted in extension-origin localStorage, independently of existing setting schemas.

## Local setup

From `services/feedback`, using Node 22–24:

```powershell
$env:WRANGLER_SEND_METRICS = 'false'
npm ci
npm run type-check
npm test
```

Dependencies are pinned with their own `package-lock.json`; do not add them to the extension's Yarn dependency graph. Tests bundle the Worker without deploying, run actual local workerd/D1 and rate-limit bindings, and dispose the in-memory test environment. No Cloudflare login is needed. `npm run build` is a dry run, not a deployment.

For Chrome integration, copy `wrangler.jsonc` to ignored `wrangler.local.jsonc` in the same directory. Change only its local `vars.ACCEPT_FEEDBACK` to `true` and its `vars.ALLOWED_ORIGINS` to the exact unpacked Chrome extension origin (discover it in Chrome). Keep production and test extension IDs separate; never permit arbitrary web origins or `*`.

```powershell
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npx wrangler dev --local --local-protocol https --ip 127.0.0.1 --port 8787 --test-scheduled --config wrangler.local.jsonc
```

Use a locally trusted development certificate for Chrome; do not disable certificate checks globally. A local policy fixture should explicitly identify itself as a test document and contain no invented operator/contact details. Set the extension variables to the exact local HTTPS origin and fixture URL, run `yarn build:dev` at the repository root, then install/reload the stable `dist/` path. Localhost is allowed only in development builds. Test with synthetic messages only. Chrome permits a self-signed certificate exception for local testing, but that exception is not production TLS evidence.

Inspect the local row using `npx wrangler d1 execute DB --local --config wrangler.local.jsonc --command "SELECT request_id, extension_version, received_at FROM feedback ORDER BY received_at DESC LIMIT 20"`. Query a synthetic message by its receipt ID to verify POST → D1 readback. The local scheduled-test endpoint is provided by Wrangler, never by our public Worker; invoke it as documented by Wrangler to test cleanup, or use the automated scheduled integration test.

## API contract

`POST /feedback`, HTTPS, `Content-Type: application/json`, exact allowed extension `Origin`. No query parameters, content encodings, cookies or authorization keys. Maximum encoded body: 8,192 bytes, enforced while reading the stream as well as against Content-Length.

```json
{"message":"An improvement suggestion","extensionVersion":"1.12.0","requestId":"11111111-1111-4111-8111-111111111111"}
```

Exactly these three keys are accepted. Message is trimmed and must contain 1–1,000 JavaScript UTF-16 code units (the UI counter uses the same measure). Version is one to four numeric components of at most five digits. Request ID is a lowercase UUID v4; it identifies an attempt, not a person. Unknown fields are rejected.

The database has exactly `request_id`, `message`, `extension_version`, `received_at`. Time is generated on the server in UTC. An atomic D1 batch inserts with conflict-ignore and reads back the row. Identical retries return the original receipt without another row; reusing an ID for different text/version returns 409. Successful responses contain no opinion text:

```json
{"status":"stored","requestId":"11111111-1111-4111-8111-111111111111","receivedAt":"2026-10-15T00:00:00.000Z"}
```

| HTTP | JSON error / meaning |
| --- | --- |
| 200 | Stored receipt (also identical retries) |
| 204 | Allowed OPTIONS preflight, empty body |
| 400 | `https_required` or `invalid_request` |
| 403 | `origin_denied` or `preflight_denied` |
| 404 | `not_found` |
| 405 | `method_not_allowed` (no public read/delete/admin API) |
| 409 | `request_id_conflict` |
| 413 | `body_too_large` |
| 415 | `json_required` or `encoding_not_supported` |
| 429 | `rate_limited`, Retry-After: 60 |
| 503 | `unavailable` or `storage_unavailable` |

All replies are no-store. CORS echoes only a validated allowed origin, permits POST and Content-Type, and grants no credentials. CORS is not authentication: a non-browser attacker can forge Origin. The client requires a valid matching stored receipt and treats malformed responses, timeouts, redirects and non-2xx responses as unconfirmed. It retains the text and ID for same-text retries, including when a response was lost after storage. There is no automatic retry. Idempotency lasts while the row exists (until retention or operator deletion).

## Abuse, privacy and cost controls

Cloudflare Rate Limiting bindings enforce 5 requests/minute per connecting IP and 100/minute for the shared feedback key before database access. The trusted `CF-Connecting-IP` is used transiently as a rate-limit key; no IP/user identifier is added to D1. Missing bindings or IP fail closed. These limits are local to Cloudflare locations and approximate; they are not global billing ceilings or strong spam authentication. An attacker with distributed IPs can still submit spam. Before enabling collection, verify availability on the chosen account, set approved Worker CPU limits and billing alerts, review account WAF controls if needed, and agree on shutdown thresholds. Set `ACCEPT_FEEDBACK=false` to stop intake without changing existing extension functions.

Worker code does not log requests, bodies, exceptions, IPs or identifiers. Observability is disabled in the checked-in configuration. Do not enable request logs, Logpush, analytics events or third-party error reporting containing these fields. Cloudflare necessarily processes network metadata; the policy must explain this accurately and account for any account-level logging/security features. D1 Time Travel is always enabled and can retain deleted rows in recovery history (currently 7 days on Free, 30 days on Paid). Confirm the chosen account's applicable window and disclose it before release. Do not promise immediate erasure from backups.

Official references:

- [Cloudflare Rate Limiting bindings and location scope](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Chrome runtime permission requests](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

## Retention and administrator procedures

The daily `17 3 * * *` UTC trigger deletes rows older than 90 days using the indexed server timestamp. Live-table retention is therefore 90 days plus up to one daily scheduling interval. Verify Cron is active after approved deployment and monitor failed runs without recording message contents. A failed cleanup must trigger operational investigation; execute the same deletion query manually if needed. Backups and exported data need separate retention controls. Do not export real feedback into Git, CI artifacts, terminal transcripts, analytics, or public issues.

Use the account's restricted D1 console for real opinion reading. Verify the account/database first. Inspect only the needed rows:

```sql
SELECT request_id, message, extension_version, received_at
FROM feedback ORDER BY received_at DESC LIMIT 20;

-- Select an exact receipt ID, inspect the result, then delete that exact row.
SELECT request_id, received_at FROM feedback WHERE request_id = '<verified-receipt-id>';
DELETE FROM feedback WHERE request_id = '<verified-receipt-id>';
SELECT COUNT(*) FROM feedback WHERE request_id = '<verified-receipt-id>';

-- Manual equivalent of the daily live-table cleanup:
DELETE FROM feedback
WHERE received_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days');
```

Delete only the intended row and confirm count zero. Anonymous submissions cannot reliably identify their authors; the owner-approved deletion contact must explain this limitation, and individual replies must not be promised.

## Approved deployment procedure (not executed by implementation)

1. Obtain explicit authority for the named Cloudflare account, resources, cost controls and intake. Prepare ignored `wrangler.production.jsonc` with the approved Worker name, account/D1 identity, exact HTTPS route, only the Store extension origin, rate bindings, disabled logs, and daily Cron. Never use the local D1 ID remotely.
2. In that account create D1, copy its real ID into the production config and apply `migrations/0001-feedback.sql` using Wrangler `d1 migrations apply DB --remote --config wrangler.production.jsonc`. Keep intake disabled initially. Store credentials in the operator's secret store/CI secrets, never the extension or repository.
3. Run `wrangler deploy --config wrangler.production.jsonc` only under the separate deployment approval. Confirm HTTPS, narrow CORS, kill switch, account-level logging, retention and actual binding availability.
4. After intake approval, enable it and perform a synthetic production POST, read the exact row in D1, exercise duplicate/429/failure behavior, and delete the synthetic row. Record receipt ID/times and results without opinion text or IP. Verify scheduled cleanup execution independently.
5. Publish the approved policy and contact route. Align Store user-data disclosures with actual free text, version, receipt ID, server timestamp, developer reading, Cloudflare processing and retention. A voluntary text field can contain personal information; do not claim “no data collected.” Review the optional permission disclosure. The form's Send notice provides explicit consent without another required field.
6. Build with the approved origin and policy URL. Inspect manifest and bundles; no placeholder host, client secret, automatic media data or new required permissions. Complete the actual Chrome matrix below and the entire existing release matrix on the final version/build.
7. Version bump, tag, push, Store submission and publication remain separate explicitly authorized release work.

## Store submission preparation (draft, not submitted)

Use the existing Play Plus Store item, not a new extension identity. Build the final approved version with both `PLAY_PLUS_FEEDBACK_ORIGIN=https://play-plus-feedback.saramkimm.workers.dev` and `PLAY_PLUS_FEEDBACK_PRIVACY_URL=https://www.saramkim.com/play-plus/privacy`. Without these variables, the banner and API are disabled. A build still numbered `1.12.0` is test evidence, not the next release package.

Suggested optional-host permission explanation:

> Optional access to https://play-plus-feedback.saramkimm.workers.dev/* is requested only when the user selects Send feedback. It permits sending the user's written feedback to the developer and receiving a storage receipt. Declining access does not prevent subtitle or playback features from working.

Suggested feedback data-use description:

> When the user chooses to send feedback, Play Plus transmits their written message, extension version and a random per-submission receipt ID. The server adds the UTC receipt time. The developer reads these submissions to understand issues and improve the extension. Cloudflare Workers and D1 process and store them. No viewing history, video URL/title, subtitles, files, account information or cookies are automatically attached. Free text can contain personal information. Live records are retained for 90 days plus the daily deletion interval; deleted data can remain in D1 recovery history for up to seven further days. Details and deletion contact: https://www.saramkim.com/play-plus/privacy.

These paragraphs describe the added feature only. Review the Store's complete existing data/permission declarations against the whole extension; do not declare "no data collected" or certify unchecked disclosures automatically. The privacy page's scope is the optional feedback feature, so preserve any applicable disclosure of existing extension behavior.

Suggested release-note addition:

> Play Plus 개선을 위한 선택적 의견 보내기 기능을 추가했습니다. 사이드 패널의 안내 또는 더보기 메뉴에서 의견을 보낼 수 있습니다. 직접 보내기를 선택할 때만 전송하며, 이용하지 않아도 기존 자막·재생 기능은 그대로 사용할 수 있습니다.

After all release checks and explicit release authority, update the four version files, produce the release commit/tag and ZIP, and submit the existing Store item with deferred publication. Do not publish an unvalidated build to work around the native-permission testing gap. At approved collection commencement, deploy `ACCEPT_FEEDBACK=true`, verify a synthetic receipt and cleanup, and publish the reviewed Store version. Stop intake with `ACCEPT_FEEDBACK=false` if storage receipts, retention cleanup or privacy guarantees fail; do not enable paid upgrades automatically.

## Required Chrome matrix

Record each result against the exact candidate, extension ID, source/diff and endpoint. Old release evidence is not inherited.

| Area | Required observation |
| --- | --- |
| Discovery | Actual action-opened side panel; onboarding precedes banner; dismissal persists across reopen; More options always reopens form |
| Layout | Korean and English at 320/360/390px; no horizontal overflow, hidden buttons or clipped disclosure; scroll works |
| Keyboard | Entry focuses textarea; normal Tab order, IME/Enter never submits unexpectedly; Escape/cancel restores trigger; success focuses receipt |
| No collection | Install/open/type/dismiss causes zero feedback requests and zero permission prompts |
| Optional host | Unrequested/allowed/denied/revoked; prompt only on Send; denial keeps text and existing features |
| Storage | POST to real local/test API, D1 readback, matching receipt; repeated click and lost-response retry store one row |
| Failure | Offline/reconnect, timeout, 429, server error, malformed receipt; input retained and no false success |
| Retention | Daily deletion path tested with expired and recent synthetic rows |
| Regression | Existing settings, menu actions, tabs, subtitles, playback and review with API disabled/denied/failed |
| Final release | Entire `docs/manual-smoke-test.md` matrix on final approved production build |

See `docs/archive/feedback/2026-10-15-issue-128-validation.md` for execution results and outstanding gates.
