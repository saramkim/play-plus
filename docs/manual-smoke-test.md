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
| Code candidate commit | `626f792437b020b74147187f78859c3f3570b480` |
| Production-code verification head | `626f792437b020b74147187f78859c3f3570b480`; actual v1.11 Chrome에서 발견한 Storage object-key order readback 결함의 최소 수정 포함 |
| Final certification PR head | 문서 커밋은 자신의 SHA를 기록할 수 없으므로 PR 본문과 exact-head CI에 기록 |
| Build command | `yarn build` |
| Stable unpacked output | repository의 current `dist/` absolute Windows path를 사용했으며 machine-specific path는 committed evidence에서 생략 |
| Chrome version | `151.0.0.0` (`chrome-devtools-kr` persistent profile) |
| OS | Windows |
| Tester / date | Codex / 2026-08-12 |
| Coupang Play account / region | PASS — `chrome-devtools-kr` persistent profile의 기존 인증 세션 재사용; 전용 gateway의 KR egress, `hostUnchanged: true`, Coupang preflight 확인; credential 입력·수집 없음 |
| Korean test route | `https://www.coupangplay.com/play/<video-id>` |
| English test route | `https://www.coupangplay.com/en/play/<video-id>` |
| v1.11.0 upgrade profile | PASS (storage/profile) — dedicated `chrome-devtools-kr-v111` profile에 actual v1.11.0 tag build를 설치하고 representative fixture의 v1.11 reload를 확인한 뒤 같은 stable absolute `dist` path에서 final candidate로 upgrade; signed-in v1.11 player setup은 별도 `NOT RUN` |
| Fresh-install profile | PASS — initially extension-free dedicated `chrome-devtools-kr-clean` profile에 final candidate를 설치하고 fresh canonical v2 state와 recoverable readiness failures를 실제 Extension Pages Side Panel에서 확인 |
| OpenSubtitles Consumer / plan | NOT RUN — #66 exact candidate에서 production provider gate를 다시 실행하지 않음 |
| OpenSubtitles build environment | NOT RUN — production build 완료만으로 Consumer key injection을 증명하지 않으며 #66 exact candidate에서 별도 확인하지 않음 |

## Automated preconditions

자동 검증은 Chrome smoke를 대신하지 않는다. 각 결과는 최종 후보의 정확한 SHA에서 새로 기록한다.

| Gate | Result | Evidence / notes |
| --- | --- | --- |
| `yarn type-check` | PASS | production-code verification head `626f792`에서 `yarn.cmd type-check` |
| `yarn lint` | PASS | production-code verification head `626f792`에서 `yarn.cmd lint` |
| Focused latest-main matrices | PASS | migration adapter 1 file / 13 tests와 Listening Mission async 1 file / 26 tests; full suite로 다시 검증 |
| Storage/migration correction matrix | PASS | raw v1.11 snapshot의 recursive object-key reorder를 수용하고 array order 변경은 계속 reject; UUID-only video namespace, record/reset serialization/recovery와 completion-state write recovery는 기존 focused/full matrix로 유지 |
| `yarn test:run` | PASS | production-code verification head `626f792`에서 `yarn.cmd test:run`: 97 files, 892 tests |
| `yarn build` | PASS | production-code verification head `626f792`에서 stable absolute repository `dist` path build 완료; 기존 bundle-size warning 3건 |
| `git diff --check` | PASS | Whitespace errors 없음; Windows line-ending 안내만 출력 |
| GitHub CI on recorded evidence head | PASS | prior evidence head `c0983b1d48fa16145e6672e106dbdbf80f075b15`의 required checks terminal success 확인; final evidence head의 exact-head CI는 PR #72 checks/body에 별도로 기록 |
| Production bundle/static reachability audit | PASS | 정확히 네 destination만 존재; retired/deferred route와 새 network/permission/telemetry 경로 없음; background bundle에 Mission `answerText`, `draft`, `alignedSupport`, `missionSnapshot`, `catalogBody`, `rawCue`, `sourceUrl` token 없음 |
| EN/KO locale audit | PASS | EN 455 keys / KO 455 keys, exact parity; Listening Mission 129/129, empty/missing/placeholder mismatch 없음 |
| Manifest contains only reviewed active permissions, exact OpenSubtitles optional origins and no wildcard | PASS | source/built manifest 모두 `1.11.0`; required host는 Coupang Play 하나, optional host는 exact OpenSubtitles 두 개, CSP·permission·package·Webpack 변경 없음 |
| Reload unpacked `dist/` and run signed-in Chrome smoke | PASS | `list_extensions`에서 ID를 동적으로 확인하고 미설치 production `dist/`를 install; MCP reconnect 뒤 목록이 비어 동일 stable build를 reinstall한 다음 persistent 인증 세션의 실제 `/en/play/<video-id>/episode` route, DRM/player, registered subtitle catalog와 실제 Extension Pages Side Panel에서 아래 bounded smoke 수행 |

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
| Authenticated evidence baseline | `c0983b1d48fa16145e6672e106dbdbf80f075b15` | PASS — 위 production code의 기존 authenticated Chrome evidence documentation; 이번 Batch #67 검증의 stable build/head 기준 |
| Chrome-found storage correction | `626f792437b020b74147187f78859c3f3570b480` | PASS — actual v1.11 upgrade의 nested object-key reorder를 semantic readback으로 수용하고 array order는 계속 strict reject; same-path upgrade와 세 KR profile final-build reload로 재검증 |

### Automated, static and privacy evidence

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Full local gates | PASS | type-check, lint, 97 files / 892 tests, production build, diff-check |
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
| Production extension install/reconnect | PASS | 최초 `list_extensions` 결과 미설치여서 current absolute `dist`를 install하고 ID를 동적으로 확인; 한 MCP reconnect 뒤 다시 미설치 상태를 확인해 같은 stable build를 reinstall했으며 reconnect 자체를 product 실패로 분류하지 않음 |
| Dedicated clean-profile install/readiness | PASS | initially extension-free dedicated profile에서 dynamic install과 action-triggered actual Extension Pages Side Panel을 확인; fresh marker 2/complete/sourceVersion null, empty required facts와 canonical local/sync keys가 reload 뒤 유지됨. required `listeningProgress` missing/invalid 각각 fail-closed 후 valid restore와 Retry로 회복 |
| Dedicated actual-v1.11 storage/profile upgrade | PASS | actual v1.11.0 tag build와 representative v1.11 fixture를 same stable absolute `dist` path에서 reload한 뒤 final candidate로 upgrade; 3 cards와 duplicate/order facts, 2 valid registered metadata/bodies, 1 damaged-body isolation, non-default sync mapping, final marker/cleanup state와 Library/Review eligibility가 final reload 뒤 유지됨. dedicated profile의 Coupang authentication은 별도 `NOT RUN` |
| Chrome Storage object-order correction | PASS | first final-candidate attempt가 Chrome의 nested object-key reordering을 strict byte-order mismatch로 거부해 marker/canonical write 없이 v1 source를 보존함을 실제 확인; semantic object-key comparison의 최소 수정 뒤 같은 source에서 migration 성공, array order strictness 회귀 테스트 유지 |
| Actual 360px Side Panel identity/geometry | PASS | action trigger 후 Chrome의 Extension Pages에 나타난 실제 Side Panel target만 사용; 360×758 CSS px, DPR 1.25, horizontal overflow 0, active vertical scroll owner 정확히 1개, 관찰한 Mission action 높이 58–62px |
| Four destinations and active-tab communication | PASS | Learning, Subtitles, Library, Review만 표시; 키보드로 Subtitles 진입 후 포인터로 Learning 복귀; `Connected / Detected`, 실제 catalog와 progress가 active player tab에서 갱신 |
| Registered subtitle add and management subset | PASS | synthetic English SRT와 Korean VTT를 실제 file flow로 각각 등록; unassigned preview 12/12, unique-query 1/12, Clear/Back focus와 preview 전용 read-only control 경계 확인; SMI add는 MCP reconnect가 발생해 미등록이며 SRT/VTT 성공을 SMI 증거로 확장하지 않음 |
| Registered roles, edit, delay and persistence subset | PASS | SRT를 Learning, VTT를 Support로 명시 지정하고 Learning delay +0.5s와 title edit 뒤 역할 유지를 같은 live session에서 확인; reconnect 뒤에는 두 등록 자막 metadata/body가 유지되고 SMI partial registration은 없음을 확인 |
| Current subtitle overview subset | PASS | Together/Learning/Support가 각 12행과 full effective range를 source 순서로 표시; unique-query 1/12, Support-only Save 부재, pointer seek, ArrowDown+Enter seek, delay-once timing과 Learning 행 support-included save/repeat marker를 확인 |
| Registered catalog and entry selection subset | PASS | exact registered source/version에서 support available, source-order 12 segments와 +0.5s delay가 첫 interval에 한 번만 적용됨을 확인; fresh zero-completed Continue exit, 10-line Continue, Next 10의 2-line tail, below-cleared Continue, current-position containment 3-line과 gap-next 2-line selection을 실제 active tab에서 수행 |
| Zero-completed exit restoration | PASS | 제출하지 않은 transient draft가 있는 Mission을 Save and exit; registered progress source가 생기지 않고 draft가 Storage에 없으며 captured position, paused state와 1.25× rate를 복원; containment/gap zero-completed exits도 각각 exact position과 captured 1.3×를 복원 |
| Answer, hint and retry subset | PASS | exact, punctuation/spacing/case-normalized exact, one-grapheme almost 뒤 exact, wrong 뒤 exact, Shape, First graphemes, accepted Support, Reveal, Later를 실제 10-line source-order round에서 확인; 5 retry candidates가 original order로 정확히 한 번, blank draft와 hidden hints로 다시 열리고 모두 exact로 clear됨 |
| Results and progress facts subset | PASS | 10-line 결과는 2 stars, cleared 10/10, first-submission exact 6, hint-free 8, retry 5/5, best combo 3; 저장 직후 exact registered source는 mastered 5/cleared 5, attempts 15. tail Later-only 결과는 1 star, cleared 0/2와 attempt 0, 다음 Continue exact 결과는 3 stars + Perfect, landing은 cleared 12/12, mastered 7/12, best combo 3을 사실대로 표시 |
| Playback and results end subset | PASS | 새 line autoplay, bounded Replay와 Slow 0.75× endpoint를 확인; Results close는 last endpoint에 paused/captured 1.25×로 남고 Continue Watching은 endpoint에서 captured 1.25×로 재생을 재개 |
| Explicit difficult-line save success/repeat subset | PASS | difficult 선택은 처음 모두 clear; 두 ordinal만 선택해 두 support-bearing canonical cards를 distinct ID로 저장하고 한 ordinal을 다시 선택해 별도 third card를 저장; source URL은 canonical card 예외에만 있고 선택하지 않은 line은 저장하지 않음 |
| Difficult-line terminal partial subset | PASS | 4-line queue에 실제 controller 결과 `saved`, `busy`, `stale`를 순서대로 주입; stale에서 중단되어 fourth call은 발생하지 않았고 UI는 line 1 saved, line 2 not saved, line 3 terminal stop, line 4 not attempted를 구분; storage counts `[1,0,0,0]`, patch 복원과 safe exit 확인 |
| Progress read/write/retry/discard subset | PASS | one-shot progress read failure는 authored unavailable alert와 unchanged 안내 뒤 Try again으로 회복; one-shot mid-exit write failure는 기존 progress 불변, Retry focus와 재저장 성공; persistent write failure는 explicit discard로 이번 Later-only unsaved result만 버리고 기존 attempt count를 보존 |
| End-error ownership and heartbeat subset | PASS | zero-completed direct end `error`에서 authored alert와 Retry Ending만 노출, destination/idle settings lock과 session ownership이 16초 뒤에도 유지되어 heartbeat가 lease expiry를 막음; Retry가 실제 end를 통과해 captured position, paused state와 1.25×를 복원하고 patch를 제거 |
| Route invalidation subset | PASS | active Mission과 unsaved draft 중 실제 player tab을 `/en/home`으로 이동; old Mission text 제거와 Connected/Waiting을 확인하고 first cleanup transport failure 뒤 Retry Ending으로 safe terminal message와 navigation unlock을 확인; actual episode로 돌아와 `readyState: 4`, no media error와 landing retry 회복 확인 |
| Library and Review bounded regression | PASS | Library 7-card state에서 unique-query가 1/7을 반환하고 synthetic assigned cards의 role/source/time 및 repeated distinct IDs를 표시; partial-save 뒤 total 8 확인. Review Active 1/7에서 support reveal 후 Skip 2/7, canonical study state 불변을 확인 |
| Diagnostics and privacy subset | PASS | Side Panel network request 0건, Side Panel console error/warn 없음, service worker error/warn/issue 없음; Chrome autofill advisory 1건은 browser form advisory이며 extension error가 아님. player의 preload/DRM robustness/quirks warning은 host-site diagnostics이고 media error 없음 |
| Current ready-v2 storage/privacy shape | PASS | sanitized local/sync/session inspection에서 required v2 keys, migration complete, strict registered progress facts와 total attempts 18 확인; typed answer/draft 및 mission-only snapshot/catalog copy는 어느 Storage에도 없고 canonical source text는 기존 registered-subtitle body와 명시 선택 canonical LearningCard에만 존재하며 full URL은 canonical card exception에만 존재 |
| Actual Side Panel approximately 390px | NOT RUN | actual Extension Pages target에서 `resize_page`가 `Protocol error (Browser.getWindowForTarget): Browser window not found`로 실패; environment limitation이며 product FAIL로 분류하지 않음 |
| Actual Side Panel 320px | NOT RUN | Chrome의 attainable minimum이 360px이며 automated 320px coverage와 구분 |
| Platform caption ownership | NOT RUN | Coupang Play caption DOM/preference의 on/off 상태를 inspect, click, hide 또는 변경하지 않았으며 이번 run은 platform-caption pair의 증거가 아님 |
| Real Korean IME composition | NOT RUN | MCP synthetic input은 실제 OS Korean IME composition을 증명하지 못하며 Computer Use로 대체하지 않음 |
| Clean-install and actual-v1.11 profiles | PASS (storage/profile) | dedicated clean profile의 final-candidate fresh install/readiness와 dedicated actual-v1.11 profile의 same-path storage upgrade를 직접 확인; signed-in v1.11 player setup은 별도 `NOT RUN`이며 shared authenticated profile을 clean/upgrade 증거로 재해석하지 않음 |

### Acceptance disposition

실제 signed-in player, registered SRT/VTT 관리, native/registered catalog와 bounded Mission 흐름, dedicated clean fresh install/readiness, dedicated actual-v1.11 storage/profile upgrade, strict progress facts와 bounded Library/Review 회귀는 이번 exact candidate에서 직접 확인했다. 그러나 signed-in v1.11 player setup, actual ~390px, real Korean IME, platform-caption on/off pair와 나머지 compound row가 `NOT RUN`이므로 #66의 현재 증거 결론은 계속 **INSUFFICIENT EVIDENCE**다. 이는 acceptance waiver가 아니며 merge 또는 다음 릴리스 판단으로 해석하지 않는다.

## Fresh install and readiness

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Unpacked load | Clean profile | Load production `dist/`; action opens the side panel without uncaught errors | PASS | Initial `list_extensions`에서 미설치를 확인한 뒤 stable absolute production `dist`를 install; action이 actual Extension Pages Side Panel의 First Entry를 열었고 console error/warn 없음 |
| Fresh canonical state | Clean profile | First service-worker start creates complete canonical v2 local/sync data and `dataSchemaVersion: 2` | PASS | marker 2, migration complete/sourceVersion null, empty cards/registered/progress와 exact required canonical local/sync keys 확인 |
| Fresh decoder boundary | Clean profile | Confirm no v1 source snapshot, v1 decoder path, or legacy cleanup runs | NOT RUN | preinstall extension storage empty, sourceVersion null, v1 snapshot·legacy key 부재의 final-state subset PASS; decoder/cleanup 미호출 runtime hook은 NOT RUN |
| Startup gate | Clean profile | UI, content and storage-dependent background handlers do not read/write normal data before readiness succeeds | NOT RUN | |
| Concurrent startup | Clean profile | Open panel and load a supported video during startup; all consumers share one readiness attempt | NOT RUN | |
| Worker restart | Clean profile | Stop/restart the service worker after completion; canonical state is reread and normal UI recovers without reinitialization | NOT RUN | final candidate의 `reload_extension` 뒤 pre/post canonical digest와 normal UI recovery subset PASS; worker-only natural restart는 NOT RUN |
| Missing canonical key | Prepared profile | Remove one required v2 key after marker; UI fails closed and does not substitute defaults | PASS | required `listeningProgress` 제거 후 migration/readiness error UI; 값 자동 대체·overwrite 없이 valid empty value 복원과 Retry로 회복 |
| Invalid canonical value | Prepared profile | Corrupt one required canonical value; UI shows a recoverable error and does not overwrite it | PASS | forbidden extra field가 있는 strict-invalid `listeningProgress`에서 동일 fail-closed UI; overwrite 없이 복원 후 Retry 성공 |

## Signed-in v1.11.0 upgrade

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Upgrade source | Signed-in v1.11.0 profile | Create representative settings, duplicate saved lines, and valid local registered subtitles before loading the candidate | NOT RUN | |
| Card preservation | Upgrade profile | Preserve saved-card count, order, duplicates, text, source URL, start time and saved date; migrated cards are `unassigned` and `active` | PASS | sanitized count/order/equality digest로 3/3과 duplicate relation, source/start/savedAt preservation 확인; Library에서 모두 unassigned/active, 실제 text/full URL은 기록하지 않음 |
| Appearance preservation | Upgrade profile | Preserve every valid learning/support visibility and appearance value exactly | PASS | synthetic v1.11 fixture의 모든 learning/support visibility·position·color·font·background·line-break non-default 값이 exact canonical sync mapping으로 이동하고 reload 뒤 유지됨 |
| Registered metadata | Upgrade profile | Preserve valid registered-subtitle ID, title, language, saved time and delay | PASS | 두 valid item의 ID/title/language/savedAt/delay equality digest와 count를 확인; 본문·title은 committed evidence에 기록하지 않음 |
| Registered cue bodies | Upgrade profile | Preserve valid cue order and values and reload them after service-worker restart | NOT RUN | 두 valid body의 cue count/order/value digest가 candidate와 final `reload_extension` 뒤 동일한 subset PASS; worker-only natural restart는 NOT RUN, cue text는 기록하지 않음 |
| Isolated unavailable item | Upgrade profile with one damaged item | Keep valid data usable; show the damaged item factually as unavailable without deleting, repairing or relinking its source | PASS | actual Subtitles/Add surface가 generic invalid-data 1건과 kept-as-is/no-repair-or-delete copy를 표시하고 두 valid source를 계속 제공; damaged physical body도 보존 |
| Migration completion | Upgrade profile | Completion marker is written only after canonical local/sync readback succeeds | NOT RUN | first source-snapshot readback failure에서 marker/canonical write 없이 v1 source 보존하고 final success에서 marker 2/complete/sourceVersion 1.11.0을 확인한 subset PASS; canonical local/sync readback과 marker 사이 temporal hook은 NOT RUN |
| Legacy normal reads | Upgrade profile | After completion, normal UI/content/background never reads remaining v1 keys | NOT RUN | |
| Cleanup | Upgrade profile | Approved v1 keys and internal source snapshot are removed only after the completion marker | NOT RUN | failed first attempt에는 모든 v1 key/snapshot을 보존하고 successful final state에서는 complete marker와 approved v1 key/snapshot cleanup을 확인한 subset PASS; marker-write와 cleanup 사이 temporal hook은 NOT RUN |
| Library eligibility | Upgrade profile | Migrated `unassigned` cards remain visible/editable in Library and are excluded from Focused Review | PASS | actual Library에서 migrated cards 3/3이 distinct unassigned items와 enabled Edit/state controls로 표시되고 Review는 active assigned card가 없어 empty state를 표시 |

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
| Old Web Storage cleanup | Upgrade profile | `isOnboardingComplete` and obsolete `page-store` are removed only after successful v2 confirmation | PASS | v1.11 reload와 failed migration 동안 두 legacy key를 보존하고, successful v2 language confirmation 뒤에만 제거; `v2OnboardingComplete`와 valid theme은 reload 뒤 유지 |
| Theme preservation | Light, dark and system | A valid `vite-ui-theme` survives migration/confirmation/reload; invalid values are not treated as valid themes | NOT RUN | |

## Learning/support subtitles and playback

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Native learning subtitle | Both routes | Select and render the actual learning cue stream with canonical appearance | NOT RUN | |
| Native support subtitle | Both routes | Select, render, show and hide the actual support cue stream | NOT RUN | |
| Local file add | Both routes | Add valid SRT, VTT and SMI files; reject unsupported, oversized, undecodable or empty files without partial metadata/body writes | NOT RUN | Actual English SRT와 Korean VTT add 성공 및 MCP reconnect 뒤 SMI partial write 부재 subset PASS; valid SMI와 모든 rejection fixture는 NOT RUN |
| Local role selection | Both routes | Assign a local registered subtitle independently to learning and support roles | NOT RUN | Actual `/en/play/<video-id>/episode`에서 SRT Learning, VTT Support 역할 지정 PASS; Korean route pair는 NOT RUN |
| Local delay | Both routes | Change each role delay, reload, and verify it is applied exactly once to render, navigation and save alignment | NOT RUN | Actual Learning +0.5s가 overview range, seek, registered catalog interval과 save alignment에 한 번 적용되는 subset PASS; Support delay와 both-route matrix는 NOT RUN |
| Local persistence | Both routes | Added metadata and cue bodies survive panel close, player reload and service-worker restart | NOT RUN | SRT/VTT metadata/body가 MCP/browser reconnect 뒤 유지되는 subset PASS; role/edit/delay persistence, isolated service-worker restart와 both-route matrix는 NOT RUN |
| Learning visibility | Both routes | Hide/show learning subtitles without changing stored appearance | NOT RUN | |
| Support visibility | Both routes | Hide/show support subtitles without changing stored appearance | NOT RUN | |
| No support language | Both routes | Set support language to None; support controls are disabled, support is not paired/saved, and stored support appearance remains intact | NOT RUN | |
| Previous cue | Both routes | Move to the previous valid learning cue using control and shortcut | NOT RUN | |
| Next cue | Both routes | Move to the next valid learning cue using control and shortcut | NOT RUN | |
| No target cue | Start/end boundary and empty learning cues | Previous/Next performs no arbitrary seek and gives truthful feedback where visible | NOT RUN | |
| Repeat current | Both routes | Repeat the current learning cue using control and shortcut | NOT RUN | |
| No current cue | Playback gap | Repeat and Save perform no arbitrary action and give truthful feedback where visible | NOT RUN | |
| Playback speed | Both routes | Increase, decrease and reset speed using controls and configured shortcuts | NOT RUN | |
| Support pairing | One-cue and multi-cue support | Save uses delayed time alignment and stores the expected support group once | NOT RUN | Actual registered 12-line fixture의 delayed alignment와 support-included overview/Mission card save subset PASS; one-cue/multi-cue prepared pairing matrix는 NOT RUN |
| Learning-only save | Low-confidence or no support | Learning card saves successfully without a support sentence and is not reported as failure | NOT RUN | |
| Repeated save | Same cue and source | Repeat the explicit save action; each save creates a distinct card | PASS | Actual registered overview와 Mission Results에서 같은 source/segment를 명시적으로 다시 저장해 서로 다른 canonical IDs를 확인 |
| Save pending/error | Inject write delay/failure | Duplicate saves are blocked; failure creates no partial card and leaves a truthful recoverable state | NOT RUN | |
| Shortcut enforcement | Both routes | Disabled shortcuts, reserved keys and conflicts do not execute actions | NOT RUN | |

## Listening Mission side-panel integration (#65 / #66)

이번 #66 candidate에서 actual signed-in `/en/play/<video-id>/episode`, 360px Side Panel, registered source와 bounded active Mission subset은 위 certification record에 `PASS`로 기록했다. 그러나 아래 compound 행은 명시된 fixture·failure·width·source 조건을 모두 실행하기 전까지 `NOT RUN`으로 유지한다.

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Four destinations | Automated 320px fixture and actual side panel near ~360px / ~390px | Exactly Learning, Subtitles, Library and Review remain; Listening Mission is inside Learning and does not add a fifth destination | NOT RUN | #66 actual 360px subset PASS; actual ~390px NOT RUN |
| Connected-video truth | No active tab, connecting content, disconnected content, detecting video and no detected video | Each state is distinct and truthful; no direct content request is sent without the exact connected active tab | NOT RUN | |
| Catalog unavailable truth | Detected page fixtures | Verify identity unavailable, no learning track, no effective segments and transport/storage error states; Retry never reuses stale ready counts | NOT RUN | |
| Native and registered learning tracks | Native and each registered subtitle type | Landing and mission use only the currently selected learning track, its effective delay and canonical source order | NOT RUN | Native English와 registered SRT Learning actual subset PASS; registered VTT는 Support로만 사용했고 registered SMI는 MCP reconnect로 미등록 |
| Optional support | Reliable, unreliable and absent support alignment | Support guidance appears only for reliable aligned support; learning-only practice remains fully usable | NOT RUN | |
| Continue selection | Fresh, attempted, cleared and mixed exact-source progress | Continue chooses the earliest unrecorded segment, then the earliest attempted segment, otherwise the first; selection is refreshed at click time and capped at 10 | NOT RUN | Actual fresh registered source가 first 10을 선택하고, tail 2개를 Later-only로 남긴 뒤 earliest below-cleared 2개를 선택하는 subset PASS; 모든 cleared fallback과 prepared mixed fixture는 NOT RUN |
| Current-position selection | Inside overlap, boundary, gap, before first, after last and track tail | Current Position uses a fresh player time, chooses the canonical containing/next segment and returns fewer than 10 only at the end | NOT RUN | Actual segment containment은 해당 위치부터 3개, 다음 segment 전 gap은 next 위치부터 2개를 선택; boundary/before-first/after-last prepared fixtures는 NOT RUN |
| First-use and source isolation | Same video with two learning subtitle selections | First use starts at the first segment; progress and summaries never cross the exact video/source/version namespace | NOT RUN | Registered exact source first use 0/12와 Line 1/10, registered source/version progress isolation subset PASS; prepared two-learning-source switch matrix는 NOT RUN |
| Mission playback | Playing and paused starts at 1x and non-1x | Each newly entered first/retry line auto-plays exactly once; Play, Replay and Slow play only the current selected segment and preserve bounded controls | NOT RUN | Actual playing 1×와 paused non-1× starts, new-line/retry autoplay, bounded Replay 1×와 Slow 0.75× endpoint subset PASS; every-line exactly-once count의 actual 전수 관찰은 하지 않음 |
| Answer states | Exact, normalized almost, wrong, hint, reveal and Try Later paths | Authored feedback, attempts, hints, reveal, combo and star facts match the submitted outcome without sending typed or answer text to background | PASS | Actual registered Mission에서 답안/기대 문장을 기록하지 않은 채 exact 15% boundary를 직접 확인: edit distance 4는 Almost, 5는 Try again; exact·case/spacing/punctuation normalization, Shape/First/Support/Reveal/Later, retry, combo/stars와 typed-text privacy도 확인 |
| Next within mission | Mission with 10 selected segments | Next advances only within the frozen snapshot, stops at the final selected segment and cannot silently append new source text | PASS | Actual 10-line first round와 5-line original-order retry가 frozen registered snapshot 안에서 explicit Next로 진행하고 final에서 Summary/Results로 끝나며 새 source text를 append하지 않음 |
| Progress durability | Complete, partial attempt, Later, Reveal, close/reopen panel and restart worker | Only committed result facts persist; Later/Reveal may persist `attempted` with 0 submitted attempts; landing counts, last practiced and best combo survive restart | NOT RUN | Actual complete/partial/Reveal/Later, attempted+0, landing summary와 final-candidate `reload_extension` 뒤 12 registered segment/total attempts 18/best combo 3/forbidden text token 0 subset PASS; worker-only natural restart는 NOT RUN |
| Normal exit restoration | Start paused, playing and at non-1x playback rate | Mid-mission exit restores the captured start time, paused/playing state and rate before releasing navigation ownership | PASS | 기존 playing restore-start evidence와 이번 paused 1.25×/1.3× zero-completed exits에서 exact captured position/state/rate 복원과 navigation unlock 확인 |
| Results end modes | Complete a mission | Entering Results sends no end; close/discard uses `complete-stay`, Continue Watching uses `continue-watching`, and Next 10 uses `complete-stay` before refreshing catalog/progress; only mid-mission exit/discard uses `restore-start` | PASS | Actual Results close는 paused endpoint/captured rate, Continue Watching은 endpoint/captured rate playing, Next 10은 old session을 끝내고 refreshed 2-line tail 시작, mid-mission exit/discard는 restore-start를 사용 |
| End retry ownership | Inject end transport error, rejection and delayed response | Learning settings stay hidden, navigation stays locked, heartbeat continues, Retry Ending receives focus, and ownership releases only after ended/already-ended/stale/no-video | NOT RUN | Direct end `error` actual subset에서 authored alert, Retry Ending only, 16초 lock/ownership/heartbeat 유지와 retry-ended cleanup PASS; rejection과 delayed-response variants는 NOT RUN |
| Heartbeat lease | Active session, Side Panel close/reload/crash and delayed or missing heartbeat | Heartbeat runs every 5 seconds; after more than 15 seconds without a valid heartbeat content restores the captured state and releases suppression | NOT RUN | Actual Side Panel close 뒤 16.5초 exact restore와 separate end-error dialog가 16초 뒤에도 expiry 없이 lock을 유지한 subset PASS; reload/crash와 직접 5-second cadence 관찰은 NOT RUN |
| Route/tab/source invalidation | Change active tab, route/video, native language, registered source, delay or subtitle revision during catalog/begin/mission | Late responses never mount old text; the owned session is ended or expires safely and the landing reloads authoritative truth | NOT RUN | Actual route invalidation subset PASS: Mission 중 `/en/home` 이동 시 old text 제거, cleanup retry와 unlock, actual episode 복귀 후 authoritative landing recovery; tab/video/source/delay/revision variants는 NOT RUN |
| Platform caption ownership | Platform captions initially on and off | Mission suppresses only Play Plus learning/support rendering while owned; it neither reads nor changes the platform caption preference and always shows the reminder | NOT RUN | Platform caption DOM/preference를 inspect·click·hide·change하지 않았고 on/off pair는 NOT RUN |
| Difficult-segment save | No selection, selected segments, retryable card write and terminal stale/no-video response | Only explicitly selected difficult segments invoke the canonical card builder; retryable failures remain retryable and terminal failure stops remaining saves | NOT RUN | Initial-clear/no-selection, selected-only, distinct repeat와 injected `saved`/`busy`/terminal `stale` partial-stop subset PASS; retryable error retry와 terminal `no-video` variant는 NOT RUN |
| Progress failure choices | Inject local progress read/write failure during landing, mission, results and reset | Reads fail closed; Retry or discard choices are explicit; no fabricated success, partial mutation or raw storage error is shown | NOT RUN | Landing read failure retry, mid-exit one-shot write failure retry, persistent write failure discard와 prior-data preservation subset PASS; Results와 reset failure variants는 NOT RUN |
| Separate resets | Exact-video and all-progress confirmations | Dialogs are separate, trap focus, close with Escape, cancel on tab/source/video change, preserve cards/subtitles/settings, and restore trigger focus after success | NOT RUN | Exact-video dialog/success and card preservation PASS; all-progress/Escape/context-change variants NOT RUN |
| Keyboard, IME and announcements | Keyboard-only with Korean IME composition | No submit occurs during composition; focus order, 44px targets, alert/status announcements and stable labels work without pointer input | NOT RUN | Keyboard destination navigation, Enter/Shift+Enter, dialog/retry/title focus, 58–62px actions와 authored alerts subset PASS; MCP synthetic input은 real Korean OS IME composition 증거가 아니므로 IME는 NOT RUN |
| Compact geometry | Automated 320px fixture, then actual Chrome near its attainable minimum (~360px) and at ~390px | Exactly one vertical scroll owner is active, no horizontal clipping occurs, settings are hidden during an owned mission and long EN/KO copy wraps; if Chrome clamps 320px, record it as NOT RUN rather than simulated | NOT RUN | Actual 360×758 idle/active Mission은 one scroll owner, overflow 0와 hidden settings를 확인; actual ~390px는 exact protocol error, automated 320px는 별도 NOT RUN |
| Privacy boundary | DevTools Network, message inspection and storage inspection | Progress/reset messages contain only strict facts/scope and never typed or raw text; the sole allowed background/local-persistence exception is a user-selected canonical LearningCard with its sentence and source URL, which is never sent to the network | NOT RUN | Active Mission sanitized local/sync/session과 Side Panel network 0건에서 draft/wrong/almost/route-stale/raw mission text 부재 및 canonical card exception만 확인; direct message-payload capture는 NOT RUN |
| Latest-main integration (#66) | Clean profile and representative upgraded profile on latest `main` | Run the full automated gate plus this real-Chrome matrix; verify no permission, host, manifest, release-version or existing Learning/Subtitles/Library/Review regression | NOT RUN | Exact latest-main gates, dedicated clean/profile upgrade와 shared-auth signed-in player/registered Mission/Library/Review subset PASS; signed-in v1.11 player setup과 full compound matrix는 NOT RUN |

## Registered subtitle management

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Edit pending and retry | Registered subtitle, injected delayed write then failure | One submit starts; the form is busy and all controls are disabled; failure preserves the draft and mode, releases navigation, announces an inline error and focuses the re-enabled Save; retry succeeds and restores focus to Edit | NOT RUN | Actual title edit success와 Learning role 유지 subset PASS; delayed/failure/retry path는 NOT RUN |
| Sync pending and retry | Registered subtitle, injected delayed write then storage failure | One submit starts; the form is busy, all controls are disabled and no press-and-hold step remains active; failure preserves the delay and mode, releases navigation, announces an inline error and focuses the re-enabled Save; retry succeeds and restores focus to Sync | NOT RUN | Actual +0.5s sync save와 refresh success subset PASS; delayed/storage-failure/retry path는 NOT RUN |
| Sync refresh partial success | Connected video, delay storage succeeds and refresh fails | The saved delay is retained without rollback; the editor stays open with the specific inline refresh error, no duplicate modal appears, navigation unlocks and Save can retry the refresh path | NOT RUN | |
| Manage no results | Non-empty registered list and unmatched explicit search | Show a factual no-results state; Clear search removes both the visible input and committed query, preserves sort, restores the full list and returns focus to the search input | NOT RUN | |
| Concurrent mutations | Two registered cards with delayed Edit and Sync writes | Different cards may remain concurrently pending; the subview/search/Add navigation lock remains until both tokens settle, while duplicate submit on either form creates no extra mutation or token | NOT RUN | |

## Current subtitle overview

| Area | Route / setup | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Subview discovery | Connected Coupang Play tab | `Subtitles` always exposes `Add subtitles` and `Full subtitles`; Add is the default after reopening and the selection is not persisted | NOT RUN | Actual connected tab에서 Add subtitles와 Full subtitles discovery PASS; reopen/default/non-persistence 전수는 NOT RUN |
| Navigation lock | Inject pending Add, Edit and Sync operations | Subview controls are disabled and do not change view until each operation settles, including overlapping token-based locks | NOT RUN | |
| View scope | Learning and support configured | `Together` is the default, `Learning` and `Support` switch the displayed rows, changing view clears search, and no overview-local source picker appears | NOT RUN | Actual registered Learning/Support에서 Together/Learning/Support 12-row views와 Support-only no-Save 확인; query-clear/default/source-picker 전수는 NOT RUN |
| No support language | Set support language to None | Together/Support controls are absent and the complete learning overview remains usable | NOT RUN | |
| Empty support track | Support configured without cues | A truthful role-specific empty state appears without falling back to another source | NOT RUN | |
| Native and registered sources | Native plus local/OpenSubtitles registered tracks | The active source title is truthful for both roles; each role shows its complete non-empty cue stream without exposing unselected tracks, and Change returns to the existing role management area | NOT RUN | Native prior subset과 actual local registered Learning/Support source titles, selected 12-cue streams subset PASS; OpenSubtitles registered track와 full Change matrix는 NOT RUN |
| Registered subtitle preview | Unassigned local/OpenSubtitles registered track, including disconnected/no-video state | `자막 확인` opens a UI-local read-only list with Back, title, language, delay, search and count; it does not assign a role or expose Together/Learning/Support, current/follow, seek, Save, Change or Refresh, and Back restores focus | NOT RUN | Actual unassigned local preview 12/12, unique-query 1/12, Clear, Back focus와 role/current/follow/seek/Save control 부재 PASS; OpenSubtitles 및 disconnected/no-video variants는 NOT RUN |
| Preview lifecycle | Slow load, invalid/empty/deleted body and metadata delay edit | Loading keeps Back/source context, retry is recoverable, late or deleted data never replaces the current target, empty state is truthful and delay is applied exactly once | NOT RUN | |
| Together alignment | Learning cues with matched, unmatched and reused support candidates | Together remains learning-anchored, uses the same deterministic support alignment as save, keeps unmatched learning rows and may show the same best support text beside adjacent learning rows; Support retains every unpaired cue | NOT RUN | |
| Late native acquisition | Delay the native subtitle response | An initially empty snapshot updates automatically when native cues arrive without requiring Refresh or remount | NOT RUN | |
| Delay and range | Registered tracks with positive and negative delay | Every timestamp and the full range apply role delay exactly once and match actual seek/render timing | NOT RUN | Actual positive +0.5s Learning delay가 12-row full range/catalog/seek timing에 한 번 적용됨; negative와 Support delay는 NOT RUN |
| Count and timestamps | Short, multiline and multilingual cues in each view | View-specific total count and full effective range remain accurate; the compact start timestamp is always visible and end time/full truncated text are available by hover, focus and touch | NOT RUN | Actual bilingual synthetic 12-row Together/Learning/Support count와 full effective range subset PASS; multiline 및 hover/focus/touch disclosure 전수는 NOT RUN |
| Search | Mixed-case learning and aligned support fixture | Trimmed case-insensitive substring search matches every visible row text, preserves source order, reports result/total counts and clears explicitly | NOT RUN | Actual unique-query 1/12, source-order retention과 explicit Clear subset PASS; mixed-case/aligned-support prepared matrix는 NOT RUN |
| Dense multiline layout | Search then clear a fixture with long learning/support rows | Divider rows repeat no card chrome or Support label, Together stays visually centered on one learning line plus one support line, disclosure exposes the full text, and every next measured row begins at or below the previous row bottom | NOT RUN | |
| Search empty result | No matching text | A truthful no-results state appears without changing the source snapshot | NOT RUN | |
| Current cue | Overlap, tied start, gap and boundary fixture | 1ms closed-interval matching chooses latest start then lower source index; gaps highlight no row | NOT RUN | |
| Follow lifecycle | Play, user-scroll, search, clear and resume | Follow starts on, centers the current cue, turns off only for user scroll/non-empty search, stays off after clear, keeps highlighting and resumes explicitly | NOT RUN | |
| Pointer seek | Any visible row | Clicking a row seeks to its effective start through the existing content boundary | PASS | Actual visible Support row pointer action이 active player를 effective start로 seek |
| Keyboard seek and focus | Filtered and unfiltered lists | Roving focus uses Arrow Up/Down and Home/End across results; Enter/Space seeks; focus remains visible and deterministic after view/search/snapshot changes | NOT RUN | Actual unfiltered Support list에서 ArrowDown+Enter focus/seek subset PASS; filtered/Home/End/Space와 snapshot-change matrix는 NOT RUN |
| Direct save with support | Together or Learning row with a reliable support match | Save does not seek, revalidates identity/revision/source index in content, writes one card through the existing builder/storage boundary and reports that support was included | NOT RUN | Actual registered Learning row save의 support-included toast, canonical card, unchanged player position과 saved marker subset PASS; prepared stale identity/revision revalidation은 NOT RUN |
| Direct learning-only save | Learning row without a reliable support match | Save succeeds with the learning sentence, reports that support was omitted, and Support-only rows expose no Save action | NOT RUN | |
| Save guard and repeat | Delay the current-cue or row save, then change subtitle/video and repeat | Current-cue and row save share one pending lock; concurrent save reports busy and writes nothing, stale/removed cue is rejected, and a completed repeated save creates a distinct card | NOT RUN | Actual completed repeated row save가 distinct card를 만들고 marker action이 enabled인 subset PASS; pending/shared-lock/stale variants는 NOT RUN |
| Save toast and marker | Save a row, use the shortcut, then edit/delete/restore matching cards | Save feedback uses the existing side-panel toast without moving the list; successful/matching rows show a persistent best-effort saved marker, storage changes reconcile it, and the marked action remains enabled for a distinct repeated save | NOT RUN | Actual support-included toast, saved marker와 enabled repeat-save subset PASS; shortcut 및 edit/delete/restore reconciliation은 NOT RUN |
| Large virtual list | Thousands of variable-height cues | Scrolling remains responsive, measured rows do not overlap and the view has exactly one vertical scroll owner | NOT RUN | |
| Stale isolation | Switch tab, SPA video, content reload and selected registered role | Old and late snapshot/time responses never replace or control the new video; a stale row cannot seek or save against the replacement video; polling stops on disconnect/no-video/failure | NOT RUN | |
| Compact controls | 360px and 390px side panel | No duplicate visible Full subtitles heading; `Together | Learning | Support` fits without merging; Refresh, Clear and Save icons have tooltips, accurate accessible names and 44px targets; source/follow controls retain text | NOT RUN | Actual 360px registered overview no horizontal overflow와 segmented views fit subset PASS; actual ~390px protocol error 및 complete icon/tooltip matrix는 NOT RUN |
| Ephemeral privacy | Chrome Storage, messages, network and consoles | Active cue snapshots/current time stay only in direct UI-content messages; registered preview reads only its existing local body; no cue copies, background relay, external request or sentence logging is introduced | NOT RUN | Existing registered body read, Side Panel network 0건, console no sentence logging와 추가 snapshot/catalog persistence 부재 subset PASS; direct message-payload capture는 NOT RUN |

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
| Immediate coherence | Save from video | Newly saved card appears without reload or shape conversion | PASS | Actual overview/Mission card save 뒤 Library에서 canonical assigned card와 distinct repeated IDs를 reload 없이 확인 |
| Search | Mixed cards | Search learning and support sentence text | NOT RUN | Actual 7-card Library에서 sanitized unique learning query가 1/7을 반환하는 subset PASS; support-text search matrix는 NOT RUN |
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
| Active session | Assigned active cards | Session auto-loads a stable storage-order snapshot and excludes `unassigned` cards | NOT RUN | Actual assigned Active Review가 1/7에서 시작하는 bounded subset PASS; prepared unassigned exclusion과 storage-order fixture는 NOT RUN |
| Completed session | Assigned completed cards | Explicit completed review loads only completed assigned cards | NOT RUN | |
| Support reveal | Card with support | Support starts hidden, announces disclosure state, and resets on navigation | NOT RUN | Actual support-bearing card에서 reveal 후 Skip 2/7 subset PASS; disclosure announcement/reset 전수는 NOT RUN |
| Learning-only card | Card without support | No empty support region or misleading reveal action appears | NOT RUN | |
| Previous / Skip | Multi-card session | Navigate without writing study state; progress and total stay stable | NOT RUN | Actual Skip 1/7→2/7과 canonical study-state 불변 subset PASS; Previous와 full progress/total matrix는 NOT RUN |
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
| Panel reconnect | Both routes | Close/reopen side panel; canonical state reconnects without default fallback | NOT RUN | Actual Extension Pages Side Panel reopen/MCP reconnect 뒤 registered canonical state와 active-tab handshake recovery subset PASS; both-route matrix는 NOT RUN |
| Player reload | Both routes | Hard reload; selected roles, registered subtitles, controls and rendering recover | NOT RUN | Actual episode return/reload 뒤 registered roles/catalog와 `readyState: 4` recovery subset PASS; both-route full rendering matrix는 NOT RUN |
| SPA navigation | Both routes | Navigate away and back without full reload; new video/cue state replaces stale state | NOT RUN | Actual active Mission `/en/home` route invalidation과 old text removal, episode return recovery subset PASS; Korean route와 new-video replacement matrix는 NOT RUN |
| Service-worker restart | Active video | Restart worker; readiness, active-tab state and content handshake recover | NOT RUN | |
| Coupang Play request | Both routes | Required native subtitle acquisition still works through the active host boundary | NOT RUN | |
| External requests | Network panel | Before explicit OpenSubtitles Search there are zero external provider requests; afterward only the submitted fields and selected download use the approved exact origins, with no translation, telemetry, account or payment request | NOT RUN | |
| Optional hosts | Manifest and Chrome details | Only `https://api.opensubtitles.com/*` and `https://www.opensubtitles.com/*` are optional, neither is granted at install, and no wildcard or unqualified candidate host is present | NOT RUN | |
| Host scope | Manifest and runtime | Required access remains `https://www.coupangplay.com/*`; OpenSubtitles access remains separately optional and user initiated | NOT RUN | |
| Required permissions | Manifest and runtime | `storage`, `tabs`, `webRequest`, `sidePanel` and `unlimitedStorage` each support an observed active v2 path | NOT RUN | |
| Local storage volume | Large local subtitle/card fixture | Local cue bodies and cards remain available without quota loss; no external upload occurs | NOT RUN | |
| Provider identity boundary | UI, requests and Storage | No OpenSubtitles account/login, JWT, user-supplied API key, developer credential, BYOK or Play Plus proxy/backend surface exists | NOT RUN | |
| Console privacy | Background/content/side-panel/page consoles | No API key, temporary URL, provider error body, actual sentence, cue body, registered body or complete watched URL appears in diagnostics | NOT RUN | Side Panel/SW console error-warn 0과 sentence/draft/full-URL logging 부재 subset PASS; content/page 전체 log sweep과 provider cases는 NOT RUN. Chrome autofill advisory와 Coupang preload/DRM robustness/quirks warnings는 extension error와 분리 |
| Removed surfaces | Side panel, commands and network | No retired/deferred screen, control, shortcut, request, permission or hidden route is reachable; Full subtitles exists only as the approved Subtitles subview | NOT RUN | |

## Narrow-width accessibility

Run every row in light and dark mode with long learning/support text and visible validation/error states.

Use actual Chrome for the browser's attainable minimum side-panel width (currently 360 CSS px) and approximately 390 CSS px. Keep 320 CSS px as automated responsive coverage. If Chrome clamps the panel to 360 CSS px, record an attempted real-Chrome 320px check as `NOT RUN` with that browser constraint, not `FAIL`; automated 320px coverage does not replace the real-Chrome minimum-width and 390px rows.

| Surface / width | Views | Check | Result | Evidence / notes |
| --- | --- | --- | --- | --- |
| Automated responsive coverage / 320px | Migration/error, first entry, settings, local and OpenSubtitles search/result/permission/error states, Full subtitles, Library, Review | Keyboard-operate every field, filter, pagination, Add, cue seek and row-save action; verify visible focus, correct labels/order, no row overlap or horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | |
| Real Chrome side panel / attainable minimum (currently 360px) | Migration/error, first entry, settings, local and OpenSubtitles search/result/permission/error states, Full subtitles, Library, Review | Keyboard-operate every field, filter, pagination, Add, cue seek and row-save action; verify visible focus, correct labels/order, no row overlap or horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | Actual 360×758 registered Add/preview/Full subtitles, active Mission/error dialogs, Library/Review subset은 overflow 0, one vertical scroll owner와 58–62px Mission actions 확인; migration/first-entry/OpenSubtitles 및 full keyboard matrix는 NOT RUN |
| Real Chrome side panel / approximately 390px | Migration/error, first entry, settings, local and OpenSubtitles search/result/permission/error states, Full subtitles, Library, Review | Keyboard-operate every field, filter, pagination, Add, cue seek and row-save action; verify visible focus, correct labels/order, no row overlap or horizontal overflow, wrapping, focus restoration and exactly one vertical scroll owner per view | NOT RUN | actual Extension Pages target resize가 `Protocol error (Browser.getWindowForTarget): Browser window not found`로 실패한 environment limitation; product FAIL 아님 |

## Release decision

Do not authorize a release, tag, store submission or deployment while any required automated or manual row is `FAIL`, `NOT RUN`, or `UNKNOWN`. The signed-in v1.11.0 upgrade and clean-profile fresh-install checks require actual Chrome profiles and cannot be replaced by unit, integration, build or CI results.

Issue #66 certification status on 2026-08-12: **INSUFFICIENT EVIDENCE**. Batch #67 production-code verification head `626f792`의 exact candidate는 automated/static gates, dedicated clean fresh install/readiness, dedicated actual-v1.11 storage/profile upgrade, bounded actual signed-in `/en/play/<video-id>/episode`, DRM/player, native/registered subtitle와 360px Mission/Library/Review subsets을 통과했다. 그러나 signed-in v1.11 player setup, worker-only restart variants, approximately 390px의 exact protocol error, real Korean IME, platform-caption on/off pair와 나머지 compound rows는 계속 `NOT RUN`이며 waiver가 아니다. 상세 matrix는 `PASS 17 / NOT RUN 176 / FAIL 0 / UNKNOWN 0`이다. Release, tag, deployment, Store submission, merge와 direct `main` push는 수행하지 않았다.
