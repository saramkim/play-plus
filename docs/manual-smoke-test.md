# Play Plus 2.0 Release-Candidate Manual Smoke Test

이 문서는 Play Plus 2.0 production `dist/`를 실제 Chrome에서 검증하기 위한 새 matrix다. 이전 버전의 실행 결과를 승계하지 않는다. 모든 항목은 이번 후보에서 직접 확인하기 전까지 `NOT RUN`이다.

## Status vocabulary

- `PASS`: 아래 절차를 이번 후보에서 실제로 수행했고 기대 결과를 확인했다.
- `FAIL`: 실제 수행 결과가 기대와 달랐다.
- `NOT RUN`: 아직 수행하지 않았다.
- `UNKNOWN`: 외부 환경이나 관찰 한계 때문에 수행했지만 판정할 수 없다.

`BLOCKED`나 이전 릴리스의 결과를 현재 결과처럼 복사하지 않는다. 실패·UNKNOWN에는 route, 정확한 동작, 관찰 결과와 관련 console 오류를 적는다. 실제 자막 문장, 등록 자막 본문 또는 전체 시청 URL은 기록하지 않는다.

## Test record

| Field | Value |
| --- | --- |
| Candidate version | `1.11.0` manifest/package value; Play Plus 2.0은 아직 출시되었다고 간주하지 않음 |
| Commit SHA | 커밋 전 후보; exact-head CI는 아직 실행하지 않음 |
| Build command | `yarn build` |
| Chrome version | UNKNOWN — 외부 Chrome 연결은 성공했지만 버전은 수집하지 않음 |
| OS | Windows |
| Tester / date | Codex / 2026-08-07 (자동 게이트, provider 사전 실증, Chrome 접속 시도 수행) |
| Coupang Play account / region | UNKNOWN — 현재 연결 환경에서 홈페이지가 `/not-available`로 이동해 signed-in 재생 경로를 열 수 없었음 |
| Korean test route | `https://www.coupangplay.com/play/<video-id>` |
| English test route | `https://www.coupangplay.com/en/play/<video-id>` |
| v1.11.0 upgrade profile | 실제 배포 v1.11.0에서 대표 데이터를 만든 별도 signed-in profile 필요 |
| Fresh-install profile | 확장 Storage와 Web Storage가 없는 별도 clean profile 필요 |
| OpenSubtitles Consumer / plan | UNKNOWN — 기존 Consumer로 login/JWT-free direct qualification은 통과했으나 production plan·attribution 승인은 별도 확인 필요; key 값은 기록하지 않음 |
| OpenSubtitles build environment | PASS — ignored `.env.local`의 key 존재와 package-version 기본 User-Agent 사용을 값 노출 없이 확인 |

## Automated preconditions

자동 검증은 Chrome smoke를 대신하지 않는다. 각 결과는 최종 후보의 정확한 SHA에서 새로 기록한다.

| Gate | Result | Evidence / notes |
| --- | --- | --- |
| `yarn type-check` | PASS | `yarn.cmd type-check` |
| `yarn lint` | PASS | `yarn.cmd lint` |
| `yarn test:run` | PASS | `yarn.cmd test:run`: 62 files, 424 tests |
| `yarn build` | PASS | Production Webpack build completed; 기존 bundle-size warning 3건 |
| `git diff --check` | PASS | Whitespace errors 없음; Windows line-ending 안내만 출력 |
| GitHub CI on exact head SHA | NOT RUN | |
| Production bundle contains no retired/deferred runtime module | NOT RUN | 이번 구현 후보에서 전체 legacy reachability audit는 아직 실행하지 않음 |
| Manifest contains only reviewed active permissions, exact OpenSubtitles optional origins and no wildcard | PASS | built manifest에 `https://api.opensubtitles.com/*`, `https://www.opensubtitles.com/*`만 optional로 존재; required host는 Coupang Play 하나 |
| Reload unpacked `dist/` and run signed-in Chrome smoke | NOT RUN | 연결된 Chrome의 보안 정책상 `chrome://extensions` 조작이 차단되었고 Coupang Play는 `/not-available`로 이동함; 최신 후보가 로드됐다고 간주하지 않음 |

## Fresh install and readiness

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Unpacked load | Clean profile | Load production `dist/`; action opens the side panel without uncaught errors | NOT RUN | |
| Fresh canonical state | Clean profile | First service-worker start creates complete canonical v2 local/sync data and `dataSchemaVersion: 2` | NOT RUN | |
| Fresh decoder boundary | Clean profile | Confirm no v1 source snapshot, v1 decoder path, or legacy cleanup runs | NOT RUN | |
| Startup gate | Clean profile | UI, content and storage-dependent background handlers do not read/write normal data before readiness succeeds | NOT RUN | |
| Concurrent startup | Clean profile | Open panel and load a supported video during startup; all consumers share one readiness attempt | NOT RUN | |
| Worker restart | Clean profile | Stop/restart the service worker after completion; canonical state is reread and normal UI recovers without reinitialization | NOT RUN | |
| Missing canonical key | Prepared profile | Remove one required v2 key after marker; UI fails closed and does not substitute defaults | NOT RUN | |
| Invalid canonical value | Prepared profile | Corrupt one required canonical value; UI shows a recoverable error and does not overwrite it | NOT RUN | |

## Signed-in v1.11.0 upgrade

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Upgrade source | Signed-in v1.11.0 profile | Create representative settings, duplicate saved lines, and valid local registered subtitles before loading the candidate | NOT RUN | |
| Card preservation | Upgrade profile | Preserve saved-card count, order, duplicates, text, source URL, start time and saved date; migrated cards are `unassigned` and `active` | NOT RUN | |
| Appearance preservation | Upgrade profile | Preserve every valid learning/support visibility and appearance value exactly | NOT RUN | |
| Registered metadata | Upgrade profile | Preserve valid registered-subtitle ID, title, language, saved time and delay | NOT RUN | |
| Registered cue bodies | Upgrade profile | Preserve valid cue order and values and reload them after service-worker restart | NOT RUN | |
| Isolated unavailable item | Upgrade profile with one damaged item | Keep valid data usable; show the damaged item factually as unavailable without deleting, repairing or relinking its source | NOT RUN | |
| Migration completion | Upgrade profile | Completion marker is written only after canonical local/sync readback succeeds | NOT RUN | |
| Legacy normal reads | Upgrade profile | After completion, normal UI/content/background never reads remaining v1 keys | NOT RUN | |
| Cleanup | Upgrade profile | Approved v1 keys and internal source snapshot are removed only after the completion marker | NOT RUN | |
| Library eligibility | Upgrade profile | Migrated `unassigned` cards remain visible/editable in Library and are excluded from Focused Review | NOT RUN | |

## Migration failure and restart injection

Use a controlled test build or debugger hook that fails exactly one boundary. Restore the unmodified production candidate before continuing ordinary smoke. Never capture real card text or full URLs in evidence.

| Failure boundary | Expected result | Result | Evidence / notes |
| --- | --- | --- | --- |
| Source read / strict v1.11 decode | No canonical write, no marker, no source deletion; error is recoverable | NOT RUN | |
| Raw source snapshot write | No canonical write or marker; live v1 source remains unchanged | NOT RUN | |
| Raw source snapshot readback | No canonical write or marker; Retry uses or recreates only a validated snapshot | NOT RUN | |
| Canonical local write | No marker or cleanup; source snapshot remains and Retry deterministically overwrites partial v2 values | NOT RUN | |
| Canonical sync write | No marker or cleanup; source snapshot remains and Retry does not decode partially overwritten live keys | NOT RUN | |
| Canonical local readback / validation | No marker or cleanup; changed or invalid readback is not accepted | NOT RUN | |
| Canonical sync readback / validation | No marker or cleanup; changed or invalid readback is not accepted | NOT RUN | |
| Marker write | No source cleanup; Retry remains deterministic from preserved source | NOT RUN | |
| Local cleanup | Marker remains `cleanup-pending`; restart retries cleanup only and does not reconvert/rewrite canonical data | NOT RUN | |
| Sync cleanup | Marker remains `cleanup-pending`; restart retries idempotent cleanup only | NOT RUN | |
| Completion-state write | Marker remains recoverable; restart finishes completion without returning to v1 reads | NOT RUN | |
| Retry control | Side-panel Retry starts one fresh attempt after failure; concurrent clicks do not start duplicate attempts | NOT RUN | |
| Error privacy | Visible errors and background/content/page consoles contain no subtitle body, sentence text or complete watched URL | NOT RUN | |

## First entry and Web Storage

| Area | Setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Profile confirmation | Fresh and upgrade profiles | Confirm required learning language and optional support language before completion | NOT RUN | |
| Save-card candidate | Upgrade with unresolved candidate | Select each offered candidate in separate runs and verify the exact canonical shortcut; choose Disable and verify an empty field | NOT RUN | |
| Previous-cue candidate | Upgrade with unresolved candidate | Select a candidate and verify shortcut plus enabled control; choose Disable and verify empty shortcut plus disabled control | NOT RUN | |
| Next-cue candidate | Upgrade with unresolved candidate | Select a candidate and verify shortcut plus enabled control; choose Disable and verify empty shortcut plus disabled control | NOT RUN | |
| Repeat-current candidate | Upgrade with unresolved candidate | Select a candidate and verify shortcut plus enabled control; choose Disable and verify empty shortcut plus disabled control | NOT RUN | |
| Speed-increase candidate | Upgrade with unresolved candidate | Select candidate or Disable; verify the field changes while global playback-speed enabled intent is preserved | NOT RUN | |
| Speed-decrease candidate | Upgrade with unresolved candidate | Select candidate or Disable; verify the field changes while global playback-speed enabled intent is preserved | NOT RUN | |
| Speed-reset candidate | Upgrade with unresolved candidate | Select candidate or Disable; verify the field changes while global playback-speed enabled intent is preserved | NOT RUN | |
| Conflict rejection | Prepared conflict | Duplicate or reserved non-empty shortcuts cannot be confirmed | NOT RUN | |
| Pending lock | Any first entry | During writes, confirmation controls and navigation prevent duplicate submission | NOT RUN | |
| Reload resume | Partially confirmed profile | Reload during confirmation; completed storage migration is not repeated and every unresolved choice remains visible | NOT RUN | |
| Worker restart resume | Partially confirmed profile | Restart service worker; unresolved choices remain and no candidate is silently selected | NOT RUN | |
| Interrupted sync write | Inject interruption | Retry writes the same canonical result and clears confirmations only after strict readback | NOT RUN | |
| Completion marker order | Any first entry | New v2 onboarding Web Storage marker appears only after profile and all shortcut confirmations succeed | NOT RUN | |
| Old Web Storage cleanup | Upgrade profile | `isOnboardingComplete` and obsolete `page-store` are removed only after successful v2 confirmation | NOT RUN | |
| Theme preservation | Light, dark and system | A valid `vite-ui-theme` survives migration/confirmation/reload; invalid values are not treated as valid themes | NOT RUN | |

## Learning/support subtitles and playback

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Native learning subtitle | Both routes | Select and render the actual learning cue stream with canonical appearance | NOT RUN | |
| Native support subtitle | Both routes | Select, render, show and hide the actual support cue stream | NOT RUN | |
| Local file add | Both routes | Add valid SRT, VTT and SMI files; reject unsupported, oversized, undecodable or empty files without partial metadata/body writes | NOT RUN | |
| Local role selection | Both routes | Assign a local registered subtitle independently to learning and support roles | NOT RUN | |
| Local delay | Both routes | Change each role delay, reload, and verify it is applied exactly once to render, navigation and save alignment | NOT RUN | |
| Local persistence | Both routes | Added metadata and cue bodies survive panel close, player reload and service-worker restart | NOT RUN | |
| Learning visibility | Both routes | Hide/show learning subtitles without changing stored appearance | NOT RUN | |
| Support visibility | Both routes | Hide/show support subtitles without changing stored appearance | NOT RUN | |
| No support language | Both routes | Set support language to None; support controls are disabled, support is not paired/saved, and stored support appearance remains intact | NOT RUN | |
| Previous cue | Both routes | Move to the previous valid learning cue using control and shortcut | NOT RUN | |
| Next cue | Both routes | Move to the next valid learning cue using control and shortcut | NOT RUN | |
| No target cue | Start/end boundary and empty learning cues | Previous/Next performs no arbitrary seek and gives truthful feedback where visible | NOT RUN | |
| Repeat current | Both routes | Repeat the current learning cue using control and shortcut | NOT RUN | |
| No current cue | Playback gap | Repeat and Save perform no arbitrary action and give truthful feedback where visible | NOT RUN | |
| Playback speed | Both routes | Increase, decrease and reset speed using controls and configured shortcuts | NOT RUN | |
| Support pairing | One-cue and multi-cue support | Save uses delayed time alignment and stores the expected support group once | NOT RUN | |
| Learning-only save | Low-confidence or no support | Learning card saves successfully without a support sentence and is not reported as failure | NOT RUN | |
| Repeated save | Same cue and source | Repeat the explicit save action; each save creates a distinct card | NOT RUN | |
| Save pending/error | Inject write delay/failure | Duplicate saves are blocked; failure creates no partial card and leaves a truthful recoverable state | NOT RUN | |
| Shortcut enforcement | Both routes | Disabled shortcuts, reserved keys and conflicts do not execute actions | NOT RUN | |

## Current subtitle overview

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Subview discovery | Connected Coupang Play tab | `Subtitles` always exposes `Add subtitles` and `Full subtitles`; Add is the default after reopening and the selection is not persisted | NOT RUN | |
| Navigation lock | Inject pending Add, Edit and Sync operations | Subview controls are disabled and do not change view until each operation settles, including overlapping token-based locks | NOT RUN | |
| View scope | Learning and support configured | `Together` is the default, `Learning` and `Support` switch the displayed rows, changing view clears search, and no overview-local source picker appears | NOT RUN | |
| No support language | Set support language to None | Together/Support controls are absent and the complete learning overview remains usable | NOT RUN | |
| Empty support track | Support configured without cues | A truthful role-specific empty state appears without falling back to another source | NOT RUN | |
| Native and registered sources | Native plus local/OpenSubtitles registered tracks | The active source title is truthful for both roles; each role shows its complete non-empty cue stream without exposing unselected tracks, and Change returns to the existing role management area | NOT RUN | |
| Registered subtitle preview | Unassigned local/OpenSubtitles registered track, including disconnected/no-video state | `자막 확인` opens a UI-local read-only list with Back, title, language, delay, search and count; it does not assign a role or expose Together/Learning/Support, current/follow, seek, Save, Change or Refresh, and Back restores focus | NOT RUN | |
| Preview lifecycle | Slow load, invalid/empty/deleted body and metadata delay edit | Loading keeps Back/source context, retry is recoverable, late or deleted data never replaces the current target, empty state is truthful and delay is applied exactly once | NOT RUN | |
| Together alignment | Learning cues with matched, unmatched and reused support candidates | Together remains learning-anchored, uses the same deterministic support alignment as save, keeps unmatched learning rows and may show the same best support text beside adjacent learning rows; Support retains every unpaired cue | NOT RUN | |
| Late native acquisition | Delay the native subtitle response | An initially empty snapshot updates automatically when native cues arrive without requiring Refresh or remount | NOT RUN | |
| Delay and range | Registered tracks with positive and negative delay | Every timestamp and the full range apply role delay exactly once and match actual seek/render timing | NOT RUN | |
| Count and timestamps | Short, multiline and multilingual cues in each view | View-specific total count and full effective range remain accurate; the compact start timestamp is always visible and end time/full truncated text are available by hover, focus and touch | NOT RUN | |
| Search | Mixed-case learning and aligned support fixture | Trimmed case-insensitive substring search matches every visible row text, preserves source order, reports result/total counts and clears explicitly | NOT RUN | |
| Dense multiline layout | Search then clear a fixture with long learning/support rows | Divider rows repeat no card chrome or Support label, Together stays visually centered on one learning line plus one support line, disclosure exposes the full text, and every next measured row begins at or below the previous row bottom | NOT RUN | |
| Search empty result | No matching text | A truthful no-results state appears without changing the source snapshot | NOT RUN | |
| Current cue | Overlap, tied start, gap and boundary fixture | 1ms closed-interval matching chooses latest start then lower source index; gaps highlight no row | NOT RUN | |
| Follow lifecycle | Play, user-scroll, search, clear and resume | Follow starts on, centers the current cue, turns off only for user scroll/non-empty search, stays off after clear, keeps highlighting and resumes explicitly | NOT RUN | |
| Pointer seek | Any visible row | Clicking a row seeks to its effective start through the existing content boundary | NOT RUN | |
| Keyboard seek and focus | Filtered and unfiltered lists | Roving focus uses Arrow Up/Down and Home/End across results; Enter/Space seeks; focus remains visible and deterministic after view/search/snapshot changes | NOT RUN | |
| Direct save with support | Together or Learning row with a reliable support match | Save does not seek, revalidates identity/revision/source index in content, writes one card through the existing builder/storage boundary and reports that support was included | NOT RUN | |
| Direct learning-only save | Learning row without a reliable support match | Save succeeds with the learning sentence, reports that support was omitted, and Support-only rows expose no Save action | NOT RUN | |
| Save guard and repeat | Delay the current-cue or row save, then change subtitle/video and repeat | Current-cue and row save share one pending lock; concurrent save reports busy and writes nothing, stale/removed cue is rejected, and a completed repeated save creates a distinct card | NOT RUN | |
| Save toast and marker | Save a row, use the shortcut, then edit/delete/restore matching cards | Save feedback uses the existing side-panel toast without moving the list; successful/matching rows show a persistent best-effort saved marker, storage changes reconcile it, and the marked action remains enabled for a distinct repeated save | NOT RUN | |
| Large virtual list | Thousands of variable-height cues | Scrolling remains responsive, measured rows do not overlap and the view has exactly one vertical scroll owner | NOT RUN | |
| Stale isolation | Switch tab, SPA video, content reload and selected registered role | Old and late snapshot/time responses never replace or control the new video; a stale row cannot seek or save against the replacement video; polling stops on disconnect/no-video/failure | NOT RUN | |
| Compact controls | 360px and 390px side panel | No duplicate visible Full subtitles heading; `Together | Learning | Support` fits without merging; Refresh, Clear and Save icons have tooltips, accurate accessible names and 44px targets; source/follow controls retain text | NOT RUN | |
| Ephemeral privacy | Chrome Storage, messages, network and consoles | Active cue snapshots/current time stay only in direct UI-content messages; registered preview reads only its existing local body; no cue copies, background relay, external request or sentence logging is introduced | NOT RUN | |

## OpenSubtitles explicit acquisition

Use provider mocks for deterministic boundary/error/cache cases and an approved production Consumer for the real-provider rows. Never record the API key, full temporary URL, downloaded subtitle text or provider error body in evidence. A mock PASS does not replace the production gate.

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Build-time Consumer | Production `dist/` built from `.env.local` | `OPENSUBTITLES_API_KEY` is injected only as the approved public Consumer key and never appears in UI, Storage, logs or captured evidence; `OPENSUBTITLES_USER_AGENT` uses the configured app/version or defaults to `Play Plus v<package version>` in the approved request | NOT RUN | |
| Missing Consumer key | Build with an empty `OPENSUBTITLES_API_KEY` | Explicit search reports that online search is unavailable without sending a provider request; Coupang Play and local subtitle paths remain usable | NOT RUN | |
| Zero implicit requests | Clean profile, Network open | Open the subtitle-add screen and online source, then type and edit query, language, type, year, season and episode; no permission prompt or extension-initiated OpenSubtitles request occurs before **Search** | NOT RUN | |
| Search disclosure boundary | Prepared query with every filter | Before Search, UI identifies the provider fields, the two exact optional origins requested on first Search, and that denial leaves file/Coupang Play subtitles available; the actual request contains only title/query, language, selected type/year/season/episode and page, never watched URL, Coupang Play video ID, playback time, cards, cues or registered subtitle bodies | NOT RUN | |
| Permission grant | Clean profile, first explicit Search | Request exactly `https://api.opensubtitles.com/*` and `https://www.opensubtitles.com/*` together; after grant, run only the submitted search and do not request a wildcard or candidate host | NOT RUN | |
| Permission deny | Clean profile, deny first-search prompt | Send no provider request, preserve the online draft, show truthful recovery guidance and keep local-file/Coupang Play subtitle flows usable | NOT RUN | |
| Permission cancel | Clean profile, dismiss first-search prompt | Treat dismissal as no grant: send no provider request, preserve the draft and keep local flows usable | NOT RUN | |
| Permission revoke | Granted profile; revoke the API origin, download origin and both in separate runs | Do not use stale permission state; make no automatic request, safely block or re-gate the next explicit provider action, and leave local registered data unaffected | NOT RUN | |
| Direct search contract | Approved production Consumer, granted origins | Send direct `GET https://api.opensubtitles.com/api/v1/subtitles/?...` with a trailing slash, sorted/lowercase parameters and `+` spaces; receive the response without a 3xx, redirect hop or unapproved origin | NOT RUN | |
| Search authentication boundary | Same request | Send `Api-Key` and the approved app/version identifier only; no user `Authorization`/JWT, developer login, BYOK field or Play Plus proxy/backend is involved | NOT RUN | |
| Result list | Search with multiple results | Show an accessible result list with file-level choices and metadata; do not download any result merely because it is visible or focused | NOT RUN | |
| Pagination | Multi-page result | **Show More** is explicit, keeps the submitted filters, changes only `page`, appends new file-level results without duplicates and performs no subtitle download | NOT RUN | |
| Empty search | Provider mock and production query with zero results | Show a factual empty state, keep the search form usable and create no registered subtitle or cache entry | NOT RUN | |
| Search error | Network, invalid-response and 5xx fixtures | Show a bounded provider error without raw response body or credential; local source and a user-initiated retry remain available | NOT RUN | |
| Rate/quota state | 429 and exhausted-download fixtures | Distinguish rate/quota failure from empty results, expose only safe reset guidance when available, perform no partial registration and leave local flows usable | NOT RUN | |
| Selected-only download | Results with at least two file choices | Before **Add**, make no `/download/` request; one Add sends exactly one selected file-level `file_id`, and no unselected candidate is downloaded or prefetched | NOT RUN | |
| Direct download contract | Approved production Consumer, selected result | Send direct `POST https://api.opensubtitles.com/api/v1/download/` with a trailing slash, then fetch only the returned `https://www.opensubtitles.com/download/…` URL; every step succeeds without 3xx, redirect following or another origin | NOT RUN | |
| Temporary-link validation | Valid, expired, wrong-origin and wrong-path fixtures | Accept only HTTPS, the approved exact origin and `/download/` path; reject expired, malformed, credential-bearing or unexpected links before fetching | NOT RUN | |
| Decode/parse/atomic registration | Valid UTF-8 SRT plus oversized, undecodable, malformed and empty fixtures | Enforce byte, decode, strict parse and non-empty-cue checks; success writes one ordinary registered-subtitle metadata/body pair, while every failure leaves no partial metadata or cue body | NOT RUN | |
| No automatic role | Existing learning/support selections | After online registration, keep both role selections unchanged; the new item is available for a later explicit learning or support assignment | NOT RUN | |
| Local fallback | Permission and provider failure cases | Add and select a local SRT/VTT/SMI subtitle successfully without granting OpenSubtitles permission or retrying the provider | NOT RUN | |
| Same-session cache hit | Download one selected `file_id`, then request it again in the same extension session | Reuse only the validated cached download and avoid a second provider download; registration still goes through the ordinary strict boundary | NOT RUN | |
| Cache entry cap | Controlled clock/provider, nine small selected downloads | `chrome.storage.session` contains at most 8 valid entries; inserting the ninth applies the documented deterministic eviction and never writes the cache to local/sync storage | NOT RUN | |
| Cache byte cap | Controlled downloads around the boundary | Complete serialized JSON cache payload never exceeds 4 MiB; deterministic eviction occurs before accepting a fitting entry, and an entry that cannot fit is not retained | NOT RUN | |
| Cache TTL | Controlled clock around the boundary | An entry is reusable before 6 hours and expires at the 6-hour boundary; expiry causes a new download only after another explicit Add | NOT RUN | |
| Cache worker restart | Warm cache, restart only the service worker | `chrome.storage.session` restores the bounded cache without relying on worker memory and the same selected file remains a cache hit | NOT RUN | |
| Cache session restart | Warm cache, restart the extension/browser session | Provider cache is cleared; previously registered local metadata/cues remain, and no redownload occurs until the user explicitly selects Add again | NOT RUN | |
| Storage privacy | Search, page, download, success and failure cases | `chrome.storage.local`/`sync` contain no provider query, result metadata, `file_id`, quota, temporary URL or download cache; session storage contains only the bounded cache; only successfully registered metadata/cues persist | NOT RUN | |
| Provider production gate | Approved Consumer and documented plan | Record login/JWT-free behavior, direct exact origins, quota/plan and attribution terms without recording credentials; mark `UNKNOWN` and block release if OpenSubtitles approval or any contract term cannot be confirmed | NOT RUN | |

## Library

| Area | Setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Immediate coherence | Save from video | Newly saved card appears without reload or shape conversion | NOT RUN | |
| Search | Mixed cards | Search learning and support sentence text | NOT RUN | |
| Sort | Mixed dates | Switch newest/oldest order without mutating storage order unexpectedly | NOT RUN | |
| Filter | Mixed cards | Filter All, Active, Completed and Needs assignment accurately | NOT RUN | |
| Assigned edit | Assigned card | Edit learning/support text and languages; remove support; immutable source/created time remain unchanged | NOT RUN | |
| Unassigned edit | Migrated card | Assign learning-only or learning+support roles and languages | NOT RUN | |
| State | Assigned cards | Move between `active` and `completed`; active eligibility is immediately coherent with Review | NOT RUN | |
| Delete | Any card | Delete by stable ID and show one truthful undo action | NOT RUN | |
| Undo | Deleted card | Restore at the original bounded position; failure retains truthful state and does not duplicate ID | NOT RUN | |
| Pending/error focus | Inject write delay/failure | Conflicting controls/navigation lock while pending; failure preserves card and returns focus to the initiating control | NOT RUN | |
| Unavailable subtitle | Migrated damaged item | Display factual unavailable state without delete, repair, relink or language guess | NOT RUN | |

## Focused Review and video return

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Active session | Assigned active cards | Session auto-loads a stable storage-order snapshot and excludes `unassigned` cards | NOT RUN | |
| Completed session | Assigned completed cards | Explicit completed review loads only completed assigned cards | NOT RUN | |
| Support reveal | Card with support | Support starts hidden, announces disclosure state, and resets on navigation | NOT RUN | |
| Learning-only card | Card without support | No empty support region or misleading reveal action appears | NOT RUN | |
| Previous / Skip | Multi-card session | Navigate without writing study state; progress and total stay stable | NOT RUN | |
| Keep learning | Active and completed cards | Await canonical `active` write before advancing, including completed-card reactivation | NOT RUN | |
| Complete | Active and completed cards | Await canonical `completed` write before advancing, including same-state completion | NOT RUN | |
| Failed judgment | Inject write failure | Keep the same card, progress, revealed support and initiating-button focus | NOT RUN | |
| Pending lock | Inject write delay | Disable session, navigation, video and judgment controls; duplicate writes do not occur | NOT RUN | |
| Stale completion | Switch session during pending write | Late success/failure cannot advance or overwrite the newer session | NOT RUN | |
| Exact video return | Existing matching tab | Open the exact stored source URL and start time without deriving or changing provenance | NOT RUN | |
| New-tab video return | No matching tab | Open the exact stored source URL and apply the stored time through the approved MV3 boundary | NOT RUN | |
| End state | Complete a queue | Focus the completion heading and expose one discoverable Library action after it | NOT RUN | |

## Runtime recovery, privacy and permissions

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Panel reconnect | Both routes | Close/reopen side panel; canonical state reconnects without default fallback | NOT RUN | |
| Player reload | Both routes | Hard reload; selected roles, registered subtitles, controls and rendering recover | NOT RUN | |
| SPA navigation | Both routes | Navigate away and back without full reload; new video/cue state replaces stale state | NOT RUN | |
| Service-worker restart | Active video | Restart worker; readiness, active-tab state and content handshake recover | NOT RUN | |
| Coupang Play request | Both routes | Required native subtitle acquisition still works through the active host boundary | NOT RUN | |
| External requests | Network panel | Before explicit OpenSubtitles Search there are zero external provider requests; afterward only the submitted fields and selected download use the approved exact origins, with no translation, telemetry, account or payment request | NOT RUN | |
| Optional hosts | Manifest and Chrome details | Only `https://api.opensubtitles.com/*` and `https://www.opensubtitles.com/*` are optional, neither is granted at install, and no wildcard or unqualified candidate host is present | NOT RUN | |
| Host scope | Manifest and runtime | Required access remains `https://www.coupangplay.com/*`; OpenSubtitles access remains separately optional and user initiated | NOT RUN | |
| Required permissions | Manifest and runtime | `storage`, `tabs`, `webRequest`, `sidePanel` and `unlimitedStorage` each support an observed active v2 path | NOT RUN | |
| Local storage volume | Large local subtitle/card fixture | Local cue bodies and cards remain available without quota loss; no external upload occurs | NOT RUN | |
| Provider identity boundary | UI, requests and Storage | No OpenSubtitles account/login, JWT, user-supplied API key, developer credential, BYOK or Play Plus proxy/backend surface exists | NOT RUN | |
| Console privacy | Background/content/side-panel/page consoles | No API key, temporary URL, provider error body, actual sentence, cue body, registered body or complete watched URL appears in diagnostics | NOT RUN | |
| Removed surfaces | Side panel, commands and network | No retired/deferred screen, control, shortcut, request, permission or hidden route is reachable; Full subtitles exists only as the approved Subtitles subview | NOT RUN | |

## Narrow-width accessibility

Run every row in light and dark mode with long learning/support text and visible validation/error states.

Use actual Chrome for the browser's attainable minimum side-panel width (currently 360 CSS px) and approximately 390 CSS px. Keep 320 CSS px as automated responsive coverage. If Chrome clamps the panel to 360 CSS px, record an attempted real-Chrome 320px check as `NOT RUN` with that browser constraint, not `FAIL`; automated 320px coverage does not replace the real-Chrome minimum-width and 390px rows.

| Surface / width | Views | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Automated responsive coverage / 320px | Migration/error, first entry, settings, local and OpenSubtitles search/result/permission/error states, Full subtitles, Library, Review | Keyboard-operate every field, filter, pagination, Add, cue seek and row-save action; verify visible focus, correct labels/order, no row overlap or horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |
| Real Chrome side panel / attainable minimum (currently 360px) | Migration/error, first entry, settings, local and OpenSubtitles search/result/permission/error states, Full subtitles, Library, Review | Keyboard-operate every field, filter, pagination, Add, cue seek and row-save action; verify visible focus, correct labels/order, no row overlap or horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |
| Real Chrome side panel / approximately 390px | Migration/error, first entry, settings, local and OpenSubtitles search/result/permission/error states, Full subtitles, Library, Review | Keyboard-operate every field, filter, pagination, Add, cue seek and row-save action; verify visible focus, correct labels/order, no row overlap or horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |

## Release decision

Do not authorize a release, tag, store submission or deployment while any required automated or manual row is `FAIL`, `NOT RUN`, or `UNKNOWN`. The signed-in v1.11.0 upgrade and clean-profile fresh-install checks require actual Chrome profiles and cannot be replaced by unit, integration, build or CI results.
