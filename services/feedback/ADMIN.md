# Private feedback inbox

`src/admin-worker.ts` is a separate Worker for the operator's inbox. The released
extension and the collection Worker's deployment are independent of this UI.

## Security and storage

- Cloudflare **Worker-level Access, all traffic** must protect the inbox Worker.
  Configure an allow policy for the exact email `saramkimm@gmail.com`, with
  one-time PIN login. Do not permit a whole email domain or everyone.
- The application additionally requires runtime-verified `ctx.access`, the exact
  configured `ACCESS_AUD`, and the operator email. Email/JWT headers are not
  trusted. Missing Access configuration denies all requests, including assets.
- Do not add a Workers Static Assets binding: that router does not propagate
  `ctx.access` to user code. HTML/CSS/JS are imported Text modules served by the
  authenticated Worker.
- Mutation requests require same-origin JSON. Feedback is rendered with
  `textContent`, never HTML. All responses use `no-store`; logs and preview URLs
  are disabled. No feedback is copied to local storage or analytics.
- Migration `0002` adds nullable `read_at` to the existing row. The existing
  collection insert and receipt query continue to work. The 90-day cleanup
  deletes read status with its feedback; the inbox also excludes expired rows.
- Search is literal, case-insensitive for SQLite's supported characters, and
  limited to 200 characters. Lists use 25-item timestamp/UUID cursor pagination.

## Local checks

From this directory:

```powershell
npm run type-check
npm test
```

`npm test` builds both Workers and runs real local D1 tests, including missing or
forged authentication, wrong email/audience, CSRF, read state, cursor ties, and
post-migration collection/retention compatibility. Access identities in these
tests are provided by Miniflare's local-only Access simulation, not an application
authentication bypass.

The repository's `yarn type-check`, `yarn lint`, and `yarn test:run` still apply.
The extension build/version does not change for an inbox-only deployment.

## Deployment

1. Copy `wrangler.admin.jsonc` to ignored `wrangler.admin.production.jsonc`.
   Set the intended account ID and existing production D1 binding. Do not copy
   `access.dev` or any local authentication simulation into production config.
2. Deploy initially with empty `ACCESS_AUD`; the Worker must return 403 on every
   application route. This is a locked preparation state, not a usable inbox.
3. Set up the exact-email Cloudflare Access policy for **this Worker only**, all
   traffic, including its workers.dev hostname. Preserve the public collection
   Worker's access configuration.
4. Apply the additive D1 migration using the production config, then set
   `ACCESS_AUD` to the protected application's audience tag and deploy the inbox.
5. Attach `feedback.saramkim.com`. Workers Custom Domains require an active
   Cloudflare zone. If the domain uses another DNS provider, obtain approval for
   any whole-zone DNS migration after inventorying and preserving existing
   records. Do not silently change nameservers for a subdomain request.
6. Verify anonymous access, other-account denial, operator login, data listing,
   read state, search, logout, mobile layout, and the alternate workers.dev URL.
   Verify the existing website and collection endpoint remain functional.

Use the account's existing Free plans; do not silently upgrade paid services.
Never include real feedback content, login tokens, or credentials in Git, CI
output, screenshots shared publicly, or issue/PR descriptions.

To close access immediately, redeploy with empty `ACCESS_AUD`. Keep the Access
policy in place. No rollback of the additive read-state column is needed.

## Deployment verification — 2026-10-16

- Inbox Worker version: `a165a13b-7ef7-4f07-8af3-b74edf74f7bb`.
  Migration `0002` was applied to the existing production database.
- Custom domain: `https://feedback.saramkim.com`. The ignored production config
  records this custom-domain route so later deployments preserve it.
- Access application `64a47b58-c943-475e-ac99-1b16424cfc4b` protects the Worker;
  the exact-owner email policy uses one-time PIN and a 24-hour session.
  Anonymous root, API, and script requests redirect to Access on both hostnames.
  Custom-domain HTTPS was verified with normal certificate validation.
- With approval, the six existing Gabia DNS records were copied to Cloudflare
  Free, retaining DNS-only status and 600-second TTL. Delegation now uses
  `emerson.ns.cloudflare.com` and `tiffany.ns.cloudflare.com`. Registrar remains
  Gabia. Both the safety lock and transfer lock were restored to On afterward.
- Both public resolvers 1.1.1.1 and 8.8.8.8 resolve the new inbox hostname.
  The current PC's upstream resolver still returns the previous Gabia zone;
  custom-domain Chrome login remains pending that resolver's cache expiry.
  The alternate `https://play-plus-feedback-inbox.saramkimm.workers.dev` works.
- Real Chrome on the alternate hostname: owner PIN login, authenticated list
  (zero feedback), empty search, unread filter, refresh, and logout passed.
  Production read-state toggling was not run because there were no records.
  Read-state persistence and 390-pixel mobile layout passed with local fixtures.
- Other-email denial passed automated runtime-identity tests and exact-policy
  inspection; a live login using a second real email was not run.
- Existing homepage redirects to www; the privacy page returns 200. All six
  original DNS values match the authoritative Cloudflare responses. Collection
  preflight still returns 204 for the released extension's allowed origin.
- Service type check, four admin tests, nine collection tests, repository type
  check/lint, 44 Vitest files (312 tests), and diff whitespace check passed.
  This independent inbox deployment does not change the extension version or
  require a Chrome Web Store release.
