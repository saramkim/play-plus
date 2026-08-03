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
| Chrome version | NOT RUN — 연결된 Chrome 확장 테스트 환경 없음 |
| OS | Windows |
| Tester / date | Codex / 2026-08-04 (자동 게이트만 수행) |
| Coupang Play account / region | NOT RUN |
| Korean test route | `https://www.coupangplay.com/play/<video-id>` |
| English test route | `https://www.coupangplay.com/en/play/<video-id>` |
| v1.11.0 upgrade profile | 실제 배포 v1.11.0에서 대표 데이터를 만든 별도 signed-in profile 필요 |
| Fresh-install profile | 확장 Storage와 Web Storage가 없는 별도 clean profile 필요 |

## Automated preconditions

자동 검증은 Chrome smoke를 대신하지 않는다. 각 결과는 최종 후보의 정확한 SHA에서 새로 기록한다.

| Gate | Result | Evidence / notes |
| --- | --- | --- |
| `yarn type-check` | PASS | `yarn.cmd type-check` |
| `yarn lint` | PASS | `yarn.cmd lint` |
| `yarn test:run` | PASS | `yarn.cmd test:run --pool=forks --maxWorkers=2`: 54 files, 310 tests |
| `yarn build` | PASS | Production Webpack build completed; 3 bundle-size warnings |
| `git diff --check` | PASS | Whitespace errors 없음; Windows line-ending 안내만 출력 |
| GitHub CI on exact head SHA | NOT RUN | |
| Production bundle contains no retired/deferred runtime module | PASS | Entrypoint reachability 및 production `dist/` 문자열 검사 |
| Manifest contains only reviewed active permissions and no optional host | PASS | JSON/entrypoint/permission 정적 검사 |

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
| External requests | Network panel | No extension-initiated request goes to an external subtitle, translation, telemetry, account or payment service | NOT RUN | |
| Optional hosts | Manifest and Chrome details | No optional host permission is declared or requested | NOT RUN | |
| Host scope | Manifest and runtime | Host access is limited to `https://www.coupangplay.com/*` | NOT RUN | |
| Required permissions | Manifest and runtime | `storage`, `tabs`, `webRequest`, `sidePanel` and `unlimitedStorage` each support an observed active v2 path | NOT RUN | |
| Local storage volume | Large local subtitle/card fixture | Local cue bodies and cards remain available without quota loss; no external upload occurs | NOT RUN | |
| Console privacy | Background/content/side-panel/page consoles | No actual sentence, cue body, registered body or complete watched URL appears in diagnostics | NOT RUN | |
| Removed surfaces | Side panel, commands and network | No retired/deferred screen, control, shortcut, request, permission or hidden route is reachable | NOT RUN | |

## Narrow-width accessibility

Run every row in light and dark mode with long learning/support text and visible validation/error states.

| Width | Views | Check | Result | Evidence / notes |
| ---: | --- | --- | --- | --- |
| 320px | Migration/error, first entry, settings, local subtitles, Library, Review | Keyboard-operate every action; verify visible focus, correct labels/order, no horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |
| 360px | Migration/error, first entry, settings, local subtitles, Library, Review | Keyboard-operate every action; verify visible focus, correct labels/order, no horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |
| 390px | Migration/error, first entry, settings, local subtitles, Library, Review | Keyboard-operate every action; verify visible focus, correct labels/order, no horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |

## Release decision

Do not authorize a release, tag, store submission or deployment while any required automated or manual row is `FAIL`, `NOT RUN`, or `UNKNOWN`. The signed-in v1.11.0 upgrade and clean-profile fresh-install checks require actual Chrome profiles and cannot be replaced by unit, integration, build or CI results.
