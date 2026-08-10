# Play Plus 2.0 Release-Candidate Manual Smoke Test

이 문서는 Play Plus 2.0 production `dist/`를 실제 Chrome에서 검증하기 위한 새 matrix다. 이전 버전의 실행 결과를 승계하지 않는다. 모든 항목은 이번 후보에서 직접 확인하기 전까지 `NOT RUN`이다.

## Status vocabulary

- `PASS`: 아래 절차를 이번 후보에서 실제로 수행했고 기대 결과를 확인했다.
- `FAIL`: 실제 수행 결과가 기대와 달랐다.
- `NOT RUN`: 아직 수행하지 않았다.
- `UNKNOWN`: 외부 환경이나 관찰 한계 때문에 수행했지만 판정할 수 없다.

`BLOCKED`나 이전 릴리스의 결과를 현재 결과처럼 복사하지 않는다. 실패·UNKNOWN에는 route, 정확한 동작, 관찰 결과와 관련 console 오류를 적는다. 실제 자막 문장, 등록 자막 본문 또는 전체 시청 URL은 기록하지 않는다.

## Chrome DevTools MCP execution protocol

이 matrix의 실제 Chrome 검증은 `AGENTS.md`의 Chrome DevTools MCP real-extension workflow를 따른다.

1. 자동 gate를 실행한 뒤 `yarn build`로 stable unpacked output `dist/`를 만들고 absolute Windows path를 확인한다.
2. `list_extensions`로 현재 설치 상태와 ID를 찾는다. 없으면 `install_extension`으로 한 번 설치하고, 있으면 새 build마다 `reload_extension`을 실행한다.
3. `https://www.coupangplay.com/play/<video-uuid>` 또는 해당하는 `/en/play/<video-uuid>` route를 열고 `trigger_extension_action` 또는 실제 지원 user-action path로 패널을 연다.
4. Chrome이 제공한 실제 extension side-panel surface를 선택해 DOM/accessibility snapshot, screenshot, console error/warning, relevant network failure, pointer, keyboard와 active-tab communication을 확인한다. side-panel document를 일반 extension tab으로 연 결과는 증거로 인정하지 않는다.
5. shared MCP profile은 독립 task 간 직렬로 사용한다. MCP 연결·도구·startup·profile·surface 문제가 검증을 막으면 `UNKNOWN`에 정확한 environment error를 기록하고 product `FAIL`과 구분한다.

Coupang authentication, DRM/player accessibility와 platform subtitle acquisition은 extension 설치·side-panel 동작과 별도 gate다. authentication이 필요하면 올바른 login page를 열고 최소한의 one-time human authentication만 요청한 뒤 persistent MCP profile을 재사용한다. 인증·DRM 한계를 product-code 변경으로 우회하지 않는다. 이 shared profile은 별도 준비 없이는 clean fresh-install profile이나 v1.11.0 upgrade profile의 증거가 아니며, 해당 row는 실제 전용 profile에서 수행하기 전까지 `NOT RUN`으로 남긴다.

## Test record

| Field | Value |
| --- | --- |
| Candidate version | `1.11.0` manifest/package value; Play Plus 2.0은 아직 출시되었다고 간주하지 않음 |
| Planning baseline | `7ec060d08ca716de78d26468289459f1b41435f3` |
| Integrated latest-main baseline | `d3c8c775083e87fda972d30c910c691d0b5754e8` (#62–#65 통합과 #73 Chrome workflow) |
| Code candidate commit | `0013f5a4ee8b77a25aadae1032caf18f4ada7927` |
| Final certification PR head | 문서 커밋은 자신의 SHA를 기록할 수 없으므로 PR 본문과 exact-head CI에 기록 |
| Build command | `yarn build` |
| Chrome version | `151.0.0.0` (`chrome-devtools-kr` persistent profile) |
| OS | Windows |
| Tester / date | Codex / 2026-08-10 |
| Coupang Play account / region | PASS — `chrome-devtools-kr` persistent profile의 기존 인증 세션 재사용; 전용 gateway의 KR egress, `hostUnchanged: true`, Coupang preflight 확인; credential 입력·수집 없음 |
| Korean test route | `https://www.coupangplay.com/play/<video-id>` |
| English test route | `https://www.coupangplay.com/en/play/<video-id>` |
| v1.11.0 upgrade profile | NOT RUN — 사용자 지시에 따라 이번 run에서 건너뜀; acceptance waiver가 아님 |
| Fresh-install profile | NOT RUN — 별도 clean profile을 준비하지 못함 |
| OpenSubtitles Consumer / plan | NOT RUN — #66 exact candidate에서 production provider gate를 다시 실행하지 않음 |
| OpenSubtitles build environment | NOT RUN — production build 완료만으로 Consumer key injection을 증명하지 않으며 #66 exact candidate에서 별도 확인하지 않음 |

## Automated preconditions

자동 검증은 Chrome smoke를 대신하지 않는다. 각 결과는 최종 후보의 정확한 SHA에서 새로 기록한다.

| Gate | Result | Evidence / notes |
| --- | --- | --- |
| `yarn type-check` | PASS | exact code candidate에서 `yarn.cmd type-check` |
| `yarn lint` | PASS | exact code candidate에서 `yarn.cmd lint` |
| Focused latest-main matrices | PASS | storage/migration 11 files / 166 tests와 Listening Mission async 1 file / 26 tests; full suite로 다시 검증 |
| Storage/migration correction matrix | PASS | 11 files, 166 tests; UUID-only video namespace, URL rejection, record/reset serialization and recovery, final completion-state write recovery |
| `yarn test:run` | PASS | exact code candidate에서 `yarn.cmd test:run`: 97 files, 890 tests |
| `yarn build` | PASS | exact production code에서 stable absolute repository `dist` path build 완료; 기존 bundle-size warning 3건 |
| `git diff --check` | PASS | Whitespace errors 없음; Windows line-ending 안내만 출력 |
| GitHub CI on exact head SHA | NOT RUN | |
| Production bundle/static reachability audit | PASS | 정확히 네 destination만 존재; retired/deferred route와 새 network/permission/telemetry 경로 없음; background bundle에 Mission `answerText`, `draft`, `alignedSupport`, `missionSnapshot`, `catalogBody`, `rawCue`, `sourceUrl` token 없음 |
| EN/KO locale audit | PASS | EN 455 keys / KO 455 keys, exact parity; Listening Mission 129/129, empty/missing/placeholder mismatch 없음 |
| Manifest contains only reviewed active permissions, exact OpenSubtitles optional origins and no wildcard | PASS | source/built manifest 모두 `1.11.0`; required host는 Coupang Play 하나, optional host는 exact OpenSubtitles 두 개, CSP·permission·package·Webpack 변경 없음 |
| Reload unpacked `dist/` and run signed-in Chrome smoke | PASS | `list_extensions`에서 ID를 동적으로 확인하고 production `dist/`를 reload; persistent 인증 세션의 실제 `/en/play/<video-id>/episode` route, DRM/player, native subtitle catalog와 실제 Extension Pages Side Panel에서 아래 bounded smoke 수행 |

## Issue #66 final integration certification record

이 절은 Batch Relay #67의 마지막 통합 후보를 최신 `main`에서 다시 검증한 증거다. 아래에서 명시적으로 `PASS`로 적은 subset 외의 기존 matrix 행은 계속 `NOT RUN`이며, automated fixture나 이전 PR의 Chrome 관찰을 이번 후보의 real-Chrome `PASS`로 승계하지 않는다.

### Integrated commits and candidate scope

| Scope | Commit | Result / notes |
| --- | --- | --- |
| Planning contract baseline | `7ec060d08ca716de78d26468289459f1b41435f3` | PASS — 비교 기준 고정 |
| #62 canonical contract | `c6f3db0ce6ef6e5b6469a2ba83c83ff18d57b43f` | PASS — merged baseline 확인 |
| #63 domain/storage foundation | `138d9e011aad6ace75a301a62c1c8e267843f17d` | PASS — merged baseline 확인 |
| #64 isolated session UI | `1f727858907ed4b24e34dabfd4222ab94829d194` | PASS — merged baseline 확인 |
| #65 integrated runtime | `b69dbea54a525266db1d9ed9ecb195d1a6313344` | PASS — latest-main baseline 확인 |
| #66 minimum correction | `4cd259f61c10a578302b032b54a50796476630a5` | PASS — progress namespace와 clear boundary에서 full URL·공백·malformed video ID를 strict reject; 새 public field/permission/version 없음 |
| #73 real-Chrome workflow | `d3c8c775083e87fda972d30c910c691d0b5754e8` | PASS — dynamic extension ID, stable absolute `dist`, actual Extension Pages Side Panel과 environment-failure 분류 절차 반영 |
| Latest-main merge | `a678bddb2035f5525527106dc0ff836954a27ee7` | PASS — history rewrite 없이 #73 latest `main`을 certification branch에 통합 |
| Chrome-found UI correction | `0013f5a4ee8b77a25aadae1032caf18f4ada7927` | PASS — active line 종료 시 pending playback announcement와 generation을 정리; 회귀 테스트와 동일 실제 Side Panel 재검증 |

### Automated, static and privacy evidence

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Full local gates | PASS | type-check, lint, 97 files / 890 tests, production build, diff-check |
| Deterministic/failure matrices | PASS | segment/key/answer/hint/result, session reducer/UI races, content lease/media restoration, progress initialization/monotonic merge/attempt 0/reset/write recovery를 focused suites로 검증 |
| Four-destination and activation boundary | PASS | source와 built UI 모두 `Learning`, `Subtitles`, `Library`, `Review`만 존재; Listening Mission은 Learning 내부에만 존재 |
| Progress/privacy schema | PASS | progress/reset은 strict factual data와 reset scope만 허용; typed answer/raw transient Mission text/full URL을 거부; 명시 선택한 canonical LearningCard만 transient Listening Mission data에 허용된 기존 background/local persistence 경로의 유일한 text-bearing exception |
| Bundle/network/config boundary | PASS | 새 permission, host, CSP, dependency, entry, network primitive, telemetry, speech/mic/AI/account/payment surface 없음 |

### Actual Chrome observations on the exact code candidate

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Dedicated KR route setup | PASS | skill gateway가 KR egress, `hostUnchanged: true`, Coupang preflight ready를 확인; 검증 후 stop 결과 `active: false` |
| Real Coupang Play authentication | PASS | persistent profile의 기존 인증 세션으로 실제 supported `/en/play/<video-id>/episode` route 진입; login 요청이나 credential 입력 없음 |
| DRM/player accessibility | PASS | 실제 episode video가 `readyState: 4`, media error 없음, content time 진행; preroll과 본편 전환 후 실제 본편 duration 확인 |
| Production extension install/reload | PASS | 최초 `list_extensions` 결과 미설치여서 absolute `dist`를 install, 동적 ID 확인; 수정 build 후 동일 ID를 reload하고 player page를 reload |
| Actual 360px Side Panel identity/geometry | PASS | action trigger 후 Chrome의 Extension Pages에 나타난 실제 Side Panel target 사용; 360×754 CSS px, DPR 1.25, document/body horizontal overflow 없음, active vertical scroll owner 정확히 1개 |
| Four destinations and active-tab communication | PASS | Learning, Subtitles, Library, Review만 표시; 키보드로 Subtitles 진입 후 포인터로 Learning 복귀; `Connected / Detected`, 실제 catalog와 progress가 active player tab에서 갱신 |
| Native subtitle acquisition | PASS | 현재 learning source native English, optional Korean support available, current catalog 185 segments; 등록 자막 source는 이번 run에서 수행하지 않음 |
| Mission interaction subset | PASS | current-position 10-line Mission과 tail 1-line Mission 실행; first/retry source order, new-line autoplay, bounded Replay/Slow 0.75×, wrong feedback, Shape/First/Support/Reveal, Later, explicit Next, Results와 1-star truth 확인 |
| Progress/reset/privacy subset | PASS | first 10 lines가 attempted로 저장되고 submitted attempts는 synthetic wrong 1회만 반영; 9개 Later-only item은 attempt 0, progress에 URL/typed draft/forbidden field 없음; current-video reset은 progress만 비우고 카드 보존 |
| Explicit difficult-line save subset | PASS | 무선택 Save disabled; 한 항목만 명시 선택해 canonical LearningCard 저장; 같은 항목 재선택 저장 시 서로 다른 canonical ID 2개, typed draft 미저장, card 외 network 전송 없음 |
| End/lease/restoration subset | PASS | Results Continue Watching은 1× 재생을 재개; mid-mission Save and exit은 restore-start 후 원래 playing 상태로 복귀; Side Panel close 후 16.5초에 캡처 위치, paused 상태와 1.25× rate를 정확히 복원 |
| Chrome-found status correction | PASS | pending autoplay 중 마지막 Later로 Summary 진입 시 stale `Playing this line…`을 실제로 재현; 수정 build reload 후 Summary/Results live region이 즉시 비고 늦은 played 응답 뒤에도 비어 있으며 제목 focus 유지 |
| Side Panel/service-worker diagnostics | PASS | Side Panel에 Chrome form-field issue 1종만 있고 extension error/warn 없음; 두 service worker console error/warn 없음; player에는 Coupang robustness/preload warning만 있고 media error 없음 |
| Current ready-v2 storage shape | PASS | sanitized inspection에서 required v2 keys, migration complete, `listeningProgress.version: 1`, UUID video namespace와 strict factual items 확인; full watched URL은 progress에 없고 canonical card exception에만 존재 |
| Actual Side Panel approximately 390px | NOT RUN | actual Extension Pages target에서 `resize_page`가 `Protocol error (Browser.getWindowForTarget): Browser window not found`로 실패; environment limitation이며 product FAIL로 분류하지 않음 |
| Actual Side Panel 320px | NOT RUN | Chrome의 attainable minimum이 360px이며 automated 320px coverage와 구분 |
| Remaining compound player/Mission matrix | NOT RUN | registered source, exact/almost answer, injected controller/storage errors, route/tab/source invalidation, real Korean IME와 platform-caption on/off pair는 이번 bounded run에서 모두 수행하지 않음 |
| Clean-install and actual-v1.11 profiles | NOT RUN | shared persistent profile은 clean-install 증거가 아니며, actual-v1.11 profile은 사용자 지시에 따라 이번 run에서 건너뜀 |

### Acceptance disposition

실제 signed-in player, native subtitle, 한 complete Mission, playback/hint/retry/results, progress/privacy, explicit canonical-card save, reset, end modes와 15초 lease 복구의 bounded subset은 이번 exact candidate에서 직접 확인했다. 그 과정에서 발견한 stale playback announcement는 수정 후 동일 실제 Side Panel에서 재검증했다. 그러나 clean-install, actual-v1.11 upgrade, actual ~390px, injected failure paths, registered-source matrix, real Korean IME와 나머지 compound row가 `NOT RUN`이므로 #66의 현재 증거 결론은 계속 **INSUFFICIENT EVIDENCE**다. 특히 actual-v1.11은 사용자가 이번 run에서 건너뛰라고 명시한 임시 deferral이며 acceptance waiver가 아니다. merge 또는 다음 릴리스 판단으로 해석하지 않는다.

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

## Listening Mission side-panel integration (#65 / #66)

이번 #66 candidate에서 actual signed-in `/en/play/<video-id>/episode`, 360px Side Panel, native source와 bounded active Mission subset은 위 certification record에 `PASS`로 기록했다. 그러나 아래 compound 행은 명시된 fixture·failure·width·source 조건을 모두 실행하기 전까지 `NOT RUN`으로 유지한다.

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Four destinations | Automated 320px fixture and actual side panel near ~360px / ~390px | Exactly Learning, Subtitles, Library and Review remain; Listening Mission is inside Learning and does not add a fifth destination | NOT RUN | #66 actual 360px subset PASS; actual ~390px NOT RUN |
| Connected-video truth | No active tab, connecting content, disconnected content, detecting video and no detected video | Each state is distinct and truthful; no direct content request is sent without the exact connected active tab | NOT RUN | |
| Catalog unavailable truth | Detected page fixtures | Verify identity unavailable, no learning track, no effective segments and transport/storage error states; Retry never reuses stale ready counts | NOT RUN | |
| Native and registered learning tracks | Native and each registered subtitle type | Landing and mission use only the currently selected learning track, its effective delay and canonical source order | NOT RUN | Native English actual catalog/Mission subset PASS; registered types NOT RUN |
| Optional support | Reliable, unreliable and absent support alignment | Support guidance appears only for reliable aligned support; learning-only practice remains fully usable | NOT RUN | |
| Continue selection | Fresh, attempted, cleared and mixed exact-source progress | Continue chooses the earliest unrecorded segment, then the earliest attempted segment, otherwise the first; selection is refreshed at click time and capped at 10 | NOT RUN | |
| Current-position selection | Inside overlap, boundary, gap, before first, after last and track tail | Current Position uses a fresh player time, chooses the canonical containing/next segment and returns fewer than 10 only at the end | NOT RUN | Actual ordinary position selected 10 and tail selected exactly 1; remaining boundary/gap fixtures NOT RUN |
| First-use and source isolation | Same video with two learning subtitle selections | First use starts at the first segment; progress and summaries never cross the exact video/source/version namespace | NOT RUN | |
| Mission playback | Playing and paused starts at 1x and non-1x | Each newly entered first/retry line auto-plays exactly once; Play, Replay and Slow play only the current selected segment and preserve bounded controls | NOT RUN | Actual playing 1× and paused 1.25× starts, new-line autoplay, bounded Replay 1× and Slow 0.75× endpoints subset PASS; 모든 active line의 exactly-once count는 automated proof만 있고 actual 전수 관찰은 하지 않음 |
| Answer states | Exact, normalized almost, wrong, hint, reveal and Try Later paths | Authored feedback, attempts, hints, reveal, combo and star facts match the submitted outcome without sending typed or answer text to background | NOT RUN | Actual wrong, every hint level, Reveal and Later subset PASS; exact/almost NOT RUN |
| Next within mission | Mission with 10 selected segments | Next advances only within the frozen snapshot, stops at the final selected segment and cannot silently append new source text | NOT RUN | |
| Progress durability | Complete, partial attempt, Later, Reveal, close/reopen panel and restart worker | Only committed result facts persist; Later/Reveal may persist `attempted` with 0 submitted attempts; landing counts, last practiced and best combo survive restart | NOT RUN | Actual committed attempt-0 facts, close/reopen and sanitized storage subset PASS; worker-restart durability was not isolated |
| Normal exit restoration | Start paused, playing and at non-1x playback rate | Mid-mission exit restores the captured start time, paused/playing state and rate before releasing navigation ownership | NOT RUN | Actual playing restore-start and separate paused 1.25× lease restoration PASS; all three mid-exit setup variants not completed |
| Results end modes | Complete a mission | Entering Results sends no end; close/discard uses `complete-stay`, Continue Watching uses `continue-watching`, and Next 10 uses `complete-stay` before refreshing catalog/progress; only mid-mission exit/discard uses `restore-start` | NOT RUN | Actual Continue Watching, Close results and mid-mission restore-start PASS; Next 10 not executed |
| End retry ownership | Inject end transport error, rejection and delayed response | Learning settings stay hidden, navigation stays locked, heartbeat continues, Retry Ending receives focus, and ownership releases only after ended/already-ended/stale/no-video | NOT RUN | |
| Heartbeat lease | Active session, Side Panel close/reload/crash and delayed or missing heartbeat | Heartbeat runs every 5 seconds; after more than 15 seconds without a valid heartbeat content restores the captured state and releases suppression | NOT RUN | Actual Side Panel close and 16.5-second exact restore of position/paused/1.25× PASS; reload/crash and direct 5-second renewal observation NOT RUN |
| Route/tab/source invalidation | Change active tab, route/video, native language, registered source, delay or subtitle revision during catalog/begin/mission | Late responses never mount old text; the owned session is ended or expires safely and the landing reloads authoritative truth | NOT RUN | |
| Platform caption ownership | Platform captions initially on and off | Mission suppresses only Play Plus learning/support rendering while owned; it neither reads nor changes the platform caption preference and always shows the reminder | NOT RUN | |
| Difficult-segment save | No selection, selected segments, retryable card write and terminal stale/no-video response | Only explicitly selected difficult segments invoke the canonical card builder; retryable failures remain retryable and terminal failure stops remaining saves | NOT RUN | No-selection, selected-only and distinct repeated-save subset PASS; injected retryable/terminal failures NOT RUN |
| Progress failure choices | Inject local progress read/write failure during landing, mission, results and reset | Reads fail closed; Retry or discard choices are explicit; no fabricated success, partial mutation or raw storage error is shown | NOT RUN | |
| Separate resets | Exact-video and all-progress confirmations | Dialogs are separate, trap focus, close with Escape, cancel on tab/source/video change, preserve cards/subtitles/settings, and restore trigger focus after success | NOT RUN | Exact-video dialog/success and card preservation PASS; all-progress/Escape/context-change variants NOT RUN |
| Keyboard, IME and announcements | Keyboard-only with Korean IME composition | No submit occurs during composition; focus order, 44px targets, alert/status announcements and stable labels work without pointer input | NOT RUN | Keyboard destination navigation, Shift+Enter/Enter and title focus PASS; real Korean IME composition NOT RUN |
| Compact geometry | Automated 320px fixture, then actual Chrome near its attainable minimum (~360px) and at ~390px | Exactly one vertical scroll owner is active, no horizontal clipping occurs, settings are hidden during an owned mission and long EN/KO copy wraps; if Chrome clamps 320px, record it as NOT RUN rather than simulated | NOT RUN | Actual 360px idle/active Mission had one scroll owner and no horizontal overflow; actual ~390px environment error, automated 320px remains separate |
| Privacy boundary | DevTools Network, message inspection and storage inspection | Progress/reset messages contain only strict facts/scope and never typed or raw text; the sole allowed background/local-persistence exception is a user-selected canonical LearningCard with its sentence and source URL, which is never sent to the network | NOT RUN | Active Mission storage/network/card-exception subset PASS; direct message-payload capture was not completed |
| Latest-main integration (#66) | Clean profile and representative upgraded profile on latest `main` | Run the full automated gate plus this real-Chrome matrix; verify no permission, host, manifest, release-version or existing Learning/Subtitles/Library/Review regression | NOT RUN | Exact latest-main automated gates and signed-in real-player subset PASS; clean and actual-v1.11 profiles NOT RUN |

## Registered subtitle management

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Edit pending and retry | Registered subtitle, injected delayed write then failure | One submit starts; the form is busy and all controls are disabled; failure preserves the draft and mode, releases navigation, announces an inline error and focuses the re-enabled Save; retry succeeds and restores focus to Edit | NOT RUN | |
| Sync pending and retry | Registered subtitle, injected delayed write then storage failure | One submit starts; the form is busy, all controls are disabled and no press-and-hold step remains active; failure preserves the delay and mode, releases navigation, announces an inline error and focuses the re-enabled Save; retry succeeds and restores focus to Sync | NOT RUN | |
| Sync refresh partial success | Connected video, delay storage succeeds and refresh fails | The saved delay is retained without rollback; the editor stays open with the specific inline refresh error, no duplicate modal appears, navigation unlocks and Save can retry the refresh path | NOT RUN | |
| Manage no results | Non-empty registered list and unmatched explicit search | Show a factual no-results state; Clear search removes both the visible input and committed query, preserves sort, restores the full list and returns focus to the search input | NOT RUN | |
| Concurrent mutations | Two registered cards with delayed Edit and Sync writes | Different cards may remain concurrently pending; the subview/search/Add navigation lock remains until both tokens settle, while duplicate submit on either form creates no extra mutation or token | NOT RUN | |

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

Issue #66 certification status on 2026-08-10: **INSUFFICIENT EVIDENCE**. The exact candidate passed automated/static gates and bounded actual signed-in `/en/play/<video-id>/episode`, DRM/player, native subtitle, 360px active Mission, progress/privacy/card-save, end/lease/restoration subsets. Required clean-install, actual-v1.11, approximately 390px, injected failure, registered-source, real Korean IME and remaining compound rows are still `NOT RUN`; actual-v1.11 was explicitly deferred by the user for this run and was not waived. Release, tag, deployment, Store submission, merge and direct `main` push were not performed.
