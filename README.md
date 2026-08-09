# Play Plus

**Play Plus**는 Coupang Play 시청과 문장 복습을 연결하는 로컬 우선 Chrome 확장 프로그램입니다. 학습 자막을 보며 현재 문장을 한 번에 저장하고, Library에서 정리한 뒤 Focused Review에서 복습하고 원래 영상 시점으로 돌아갈 수 있습니다.

> `package.json`과 확장 프로그램 manifest의 현재 버전은 **v1.11.0**입니다. 이 저장소에는 다음 릴리스 후보인 Play Plus 2.0 런타임이 구현되어 있지만, 이 설명은 2.0이 Chrome 웹 스토어에 출시·배포되었다는 뜻이 아닙니다. 2.0의 승인된 제품·데이터·마이그레이션 계약은 [`docs/play-plus-2.0.md`](docs/play-plus-2.0.md)를 따릅니다.

## Play Plus 2.0 학습 흐름

1. 첫 진입에서 학습 언어와 선택적인 도움 언어를 확인합니다.
2. Coupang Play 자막, 로컬 파일 또는 사용자가 명시적으로 검색·추가한 OpenSubtitles 자막을 학습·도움 역할에 지정합니다.
3. 현재 선택한 학습·도움 자막의 전체 문장을 함께 또는 역할별로 탐색하고, 원하는 장면으로 이동하거나 학습 문장을 바로 카드로 저장합니다.
4. Learning에서 현재 위치 또는 저장된 진행 상황부터 Listening Mission을 시작해 이어지는 학습 문장을 최대 10개까지 듣고 입력합니다.
5. 이전/다음 학습 문장으로 이동하거나 현재 학습 문장을 반복하며 시청합니다.
6. 한 번의 저장 동작으로 현재 학습 문장을 카드로 저장합니다. 시간 정렬 신뢰도가 충분할 때만 도움 문장이 함께 저장됩니다.
7. Library에서 카드를 검색·정렬·필터링하고, 문장과 역할을 편집하거나 상태를 바꾸고 삭제·실행 취소합니다.
8. Focused Review에서 도움 문장을 필요할 때 공개하고 카드를 `active` 또는 `completed`로 정리합니다.
9. 카드에 기록된 정확한 원본 URL과 재생 시점으로 돌아갑니다.

## 주요 기능

### 학습·도움 자막

- Coupang Play 자막과 로컬 SRT, VTT, SMI 파일 지원
- 사용자가 명시적으로 검색하고 선택한 OpenSubtitles 자막을 기존 등록 자막 경계로 추가
- 학습 언어와 선택적인 도움 언어 설정
- 역할별 표시·숨김, 위치, 오프셋, 색상, 크기, 굵기, 배경 투명도와 줄바꿈 설정
- 역할별 delay를 한 번만 적용하는 재생·저장 동작
- 도움 언어를 사용하지 않을 때 도움 자막 제어를 비활성화하되 저장된 외형 값은 보존
- 등록 자막 메타데이터와 cue 본문을 브라우저 로컬 저장소에 유지

### 전체 자막

- 기존 `Subtitles` 화면 안에서 `자막 추가 | 전체 자막`을 바로 전환
- 현재 재생에 선택한 native 또는 등록 학습·도움 자막의 source를 표시하고 기존 관리 화면에서 변경
- 학습 문장을 기준으로 도움 문장을 함께 보여 주는 기본 보기와 짧은 `함께 | 학습 | 도움` 역할별 전체 보기
- 카드 외곽과 반복 label을 없앤 고밀도 목록에서 학습 한 줄과 도움 한 줄을 빠르게 훑고, 시작 시각은 항상 보며 전체 범위·잘린 전문은 hover·focus·touch로 확인
- 대소문자를 구분하지 않는 문장 검색, 결과 수·delay 반영 시간 범위, 현재 문장 강조와 명시적인 follow 재개
- 수천 문장도 겹치지 않는 가상 목록으로 탐색하고 pointer 또는 키보드로 원하는 장면에 이동
- `함께 | 학습` 보기의 문장을 seek 없이 바로 카드로 저장하며, 결과는 기존 side panel toast로 알리고 기존 카드와 일치하는 행은 저장 표시를 제공
- 저장 표시는 toggle·delete·dedupe가 아니며 완료 뒤 같은 문장을 다시 저장하면 별도 카드로 보존
- 등록 자막 카드의 `자막 확인`에서 역할 지정이나 영상 연결 없이 제목·언어·delay와 전체 문장을 읽기 전용으로 검색·확인

### OpenSubtitles 온라인 자막

- 온라인 화면을 열거나 검색어·필터를 입력하는 것만으로는 외부 요청을 보내지 않고, 사용자가 **검색**을 실행한 뒤에만 요청
- 검색 시 사용자가 입력한 제목 또는 query, 언어, 유형·연도·시즌·회차와 page만 전송
- 접근 가능한 결과 목록과 명시적인 pagination을 제공하고, 사용자가 **추가**를 실행한 하나의 `file_id`만 다운로드
- 다운로드한 자막을 엄격하게 decode·parse한 뒤 기존 등록 자막과 같은 로컬 형식으로 저장하며, 학습·도움 역할은 자동 지정하지 않음
- 선택적 권한 거부·취소·회수, provider 오류 또는 quota 제한 뒤에도 Coupang Play 자막과 로컬 파일 경로를 계속 사용

### 재생과 저장

- 이전/다음 학습 문장 이동
- 현재 학습 문장 반복
- 재생 속도 증가·감소·초기화
- 도움 자막 보이기·숨기기
- 하나의 명령과 하나의 단축키로 학습 카드 저장
- 현재 문장이 없거나 이동 대상이 없을 때 임의의 seek·repeat·save를 하지 않는 명시적 no-op
- 같은 문장을 반복 저장해도 각각의 학습 맥락을 가진 별도 카드로 보존

### Listening Mission

- 기존 네 destination 중 `Learning` 안에서만 제공하며 별도 화면이나 다섯 번째 destination을 만들지 않음
- 현재 영상·학습 자막 조합의 완료/첫 시도 완료 수, 최근 연습 시각과 최고 콤보를 현재 문장 목록 기준으로 표시
- `계속하기` 또는 `현재 위치에서 시작`으로 자막 순서의 연속 문장을 최대 10개 선택하고 자막 끝에서는 남은 문장만 연습
- 1.0× 자동·반복 재생과 0.75× 느린 재생, 다국어 입력, 단계별 힌트, 정답 공개, 나중에, 한 번의 선택적 재도전과 결과 제공
- 활성 미션 동안에만 Play Plus 자막과 영상 위 control을 일시적으로 억제하고, 종료 모드에 맞춰 원래 재생 상태 또는 마지막 연습 위치를 안전하게 복원
- side panel이 닫히거나 연결을 잃을 때 5초 heartbeat와 content 소유 15초 lease로 재생 속도·억제 상태를 긴급 복원
- 진행 상황 저장 실패 뒤 명시적 재시도와 저장하지 않고 나가기 제공; 현재 영상 진행 상황과 전체 듣기 진행 상황은 서로 다른 확인을 거쳐서만 삭제
- 결과에서 사용자가 직접 선택한 어려운 문장만 기존 canonical LearningCard 경계로 저장하며 반복 저장은 서로 다른 카드로 유지

### Library와 Focused Review

- `active`, `completed`, `unassigned` 카드 검색·정렬·필터
- 학습·도움 문장 텍스트와 역할 편집, 도움 문장 제거
- 상태 변경, 삭제와 실행 취소
- `unassigned` 카드는 Library에 유지하고 Review에서는 제외
- Focused Review의 고정된 세션 순서, 도움 문장 공개, 이전·건너뛰기와 상태 판단
- 상태 저장 중 중복 동작 방지와 실패 시 현재 카드·포커스 보존
- 원본 영상의 정확한 URL과 시점 열기

### 마이그레이션과 첫 진입

- 백그라운드 서비스 워커가 정상 런타임보다 먼저 v2 준비 상태를 확인
- v1.11.0의 공개 저장 데이터를 strict decoder로 한 번만 변환
- 완료 표식 전에 실패하면 원본을 유지하고, 완료 표식 뒤 정리가 중단되면 정리만 안전하게 재시도
- 부분 데이터나 손상된 데이터를 빈 기본값으로 조용히 대체하지 않는 fail-closed 동작
- 사이드 패널의 복구 가능한 오류와 명시적 재시도
- 학습·도움 언어와 모호하거나 충돌하는 단축키 후보를 사용자가 직접 확인
- 유효한 테마 설정을 유지하면서 이전 첫 진입·페이지 상태를 성공 이후에만 정리

## 로컬 우선과 개인정보

- 학습 카드와 등록 자막은 사용자의 브라우저에 로컬로 저장됩니다.
- 설정은 Chrome Storage의 확장 프로그램 전용 영역에 저장됩니다.
- Coupang Play 자막과 로컬 파일을 사용하는 핵심 학습 흐름은 OpenSubtitles 권한이나 연결 없이 작동합니다.
- OpenSubtitles는 사용자가 검색·추가를 명시적으로 실행할 때만 사용하는 선택 기능이며, 시청 URL·Coupang Play video ID·재생 시각·카드·cue 본문을 전송하지 않습니다.
- 검색 입력·결과 metadata·임시 URL·quota는 영속화하지 않습니다. 선택한 다운로드의 same-session cache만 최대 8개, 총 4 MiB, 6시간 TTL로 `chrome.storage.session`에 제한하고, 성공적으로 등록한 metadata와 cue만 로컬에 보존합니다.
- 사용자 계정·JWT, BYOK, Play Plus proxy/backend, 원격 번역과 telemetry를 사용하지 않습니다.
- 오류와 진단 정보에는 실제 자막 문장, 등록 자막 본문 또는 전체 시청 URL을 기록하지 않습니다.
- 전체 자막 snapshot과 현재 재생 시각은 활성 탭의 content script에서 side panel로 직접 전달해 일시적으로만 사용합니다. 등록 자막 확인은 이미 로컬에 저장된 cue를 strict하게 읽을 뿐이며, 어느 경로도 본문을 추가 Storage, background, 외부 네트워크나 로그에 복제하지 않습니다.
- Listening Mission의 문장 목록, 정답 문장과 입력 중인 답은 활성 탭 content script와 side panel 메모리에만 일시적으로 존재합니다. 진행·초기화 메시지에는 문장 본문이나 입력 답을 넣지 않으며, `listeningProgress`에는 문장 key, 상태, 제출 횟수, 시각과 최고 콤보 사실만 저장합니다.
- 문장 본문과 원본 URL이 background·로컬 저장 경계를 지나는 유일한 예외는 결과에서 사용자가 명시적으로 선택한 어려운 문장을 content script가 현재 세션과 자막을 다시 검증해 canonical LearningCard로 만든 경우입니다. 이 카드도 외부 네트워크로 보내지 않습니다.
- 로컬 데이터는 장치 간 동기화나 복구를 보장하지 않습니다.

## Manifest 권한

현재 [`public/manifest.json`](public/manifest.json)은 다음 권한만 사용합니다.

| 권한 | 필요한 이유 |
| --- | --- |
| `storage` | v2 학습 설정, 마이그레이션 상태, 등록 자막 메타데이터·cue 본문과 학습 카드를 확장 프로그램 전용 Storage에 저장합니다. |
| `tabs` | 활성 Coupang Play 탭의 생명주기를 추적하고, Review 카드의 정확한 원본 URL·시점을 기존 탭 또는 새 탭에서 엽니다. |
| `webRequest` | Coupang Play 페이지가 요청하는 자막 응답을 확장 프로그램의 content 경계로 전달하는 데 필요한 요청 정보를 감지합니다. |
| `sidePanel` | 확장 프로그램 action에서 학습 UI가 있는 Chrome side panel을 엽니다. |
| `unlimitedStorage` | 사용자가 추가한 로컬 자막의 cue 본문과 누적 학습 카드를 브라우저 로컬에 보존할 때 일반 확장 저장 용량 제한으로 인한 예기치 않은 손실을 피합니다. |

필수 host access는 `https://www.coupangplay.com/*`뿐입니다. OpenSubtitles용 host는 설치 시 부여되지 않는 다음 exact optional permission으로 분리합니다.

| 선택적 host | 필요한 이유 |
| --- | --- |
| `https://api.opensubtitles.com/*` | 사용자가 실행한 검색과 선택한 `file_id`의 임시 다운로드 URL 발급 요청을 background service worker에서 수행합니다. |
| `https://www.opensubtitles.com/*` | API가 반환하고 사전 검증한 임시 `/download/` URL에서 선택한 자막 하나를 가져옵니다. |

두 origin은 첫 번째 명시적 **검색**에서 한 번에 요청합니다. 거부·취소하거나 나중에 회수하면 provider 요청을 보내지 않으며 Coupang Play 자막과 로컬 파일 기능은 계속 작동합니다. wildcard나 다른 OpenSubtitles 후보 host는 선언하지 않습니다.

## 설치

### Chrome 웹 스토어

[Chrome 웹 스토어에서 현재 배포 버전 설치](https://chromewebstore.google.com/detail/dmpmihmopccgeieooepklikeacdhkbki?utm_source=item-share-cb)

### 개발 빌드

필수 환경은 Node.js 22–24와 Yarn 4.9.1입니다.

```bash
git clone <repository-url>
cd play-plus
yarn install
yarn build
```

OpenSubtitles 개발 빌드를 검증하려면 `.env.example`을 `.env.local`로 복사하고 승인된 Consumer 값을 설정합니다.

```powershell
Copy-Item .env.example .env.local
```

| 변수 | 용도 |
| --- | --- |
| `OPENSUBTITLES_API_KEY` | build-time에 주입하는 OpenSubtitles public Consumer key입니다. 온라인 검색·추가 검증에 필요합니다. |
| `OPENSUBTITLES_USER_AGENT` | 선택적인 app/version 식별자입니다. 비워 두면 현재 package 버전의 `Play Plus v<version>`을 사용합니다. |

`.env.local`과 실제 key는 commit하지 않습니다. 배포 가능한 public client용 Consumer key이므로 보안 secret이라고 주장하지 않으며, 최종 사용자에게 API key·계정·JWT 입력을 요구하지 않습니다. key가 없거나 provider가 거부하면 온라인 기능만 실패하고 로컬 자막 경로는 유지되어야 합니다.

이 설정만으로 production 사용이 승인되지는 않습니다. 릴리스 전에는 승인된 Play Plus Consumer로 로그인/JWT 없이 trailing-slash search·download와 반환된 임시 URL이 redirect 없이 exact optional origin에서 동작하는지 실제 Chrome에서 확인하고, plan·quota·attribution 조건을 OpenSubtitles와 다시 확인해야 합니다.

Chrome의 `chrome://extensions/`에서 개발자 모드를 켜고 **압축해제된 확장 프로그램을 로드합니다**를 선택한 뒤 `dist/`를 지정합니다.

## 개발 명령어

```bash
yarn dev          # 개발 빌드 후 변경 감지
yarn build:dev    # 1회 개발 빌드
yarn build        # 프로덕션 빌드
yarn type-check   # TypeScript strict 검사
yarn lint         # ESLint 검사
yarn lint:fix     # ESLint 자동 수정
yarn test:run     # Vitest 1회 실행
```

## 아키텍처

Play Plus는 Chrome Extension Manifest V3의 세 실행 컨텍스트를 분리합니다.

- `src/ui/`: side panel React 앱. Listening Mission 진입·세션 UI, 학습 설정, 로컬·OpenSubtitles 자막 추가와 읽기 전용 확인, 현재 학습·도움 자막의 함께/역할별 탐색·행 저장·저장 표시, Library와 Focused Review를 제공합니다.
- `src/background/`: service worker. v2 준비 상태, strict Listening Progress, 탭 생명주기, OpenSubtitles 네트워크·session cache와 컨텍스트 간 메시지를 조정합니다.
- `src/content/`: Coupang Play 페이지의 DOM·video·cue 접근, Listening Mission media session·lease·복원, 자막 렌더링, 재생 제어와 저장 anchor를 담당합니다.
- `src/storage/`: Chrome Storage의 strict schema, v1.11.0 one-shot decoder, v2 migration과 canonical API를 제공합니다.
- `src/utils/`: 타입이 지정된 메시지·OpenSubtitles 계약, i18n과 공통 유틸리티를 제공합니다.

UI와 background는 페이지 DOM이나 video에 직접 접근하지 않습니다. 컨텍스트 간 동작은 중앙 메시지 schema와 Storage 경계를 사용합니다.

## 개발과 기여

제품·UX·아키텍처·공개 동작 변경은 Issue에서 범위를 정한 뒤 최신 `main` 기반 작업 브랜치와 Pull Request로 진행합니다. 실제 릴리스는 별도의 릴리스 커밋과 `v<version>` 태그로 구분합니다.

- 제품·마이그레이션 계약: [`docs/play-plus-2.0.md`](docs/play-plus-2.0.md)
- 개발 workflow: [`docs/development-workflow.md`](docs/development-workflow.md)
- 선택적 Batch Relay workflow: [`docs/batch-relay.md`](docs/batch-relay.md)
- 저장소·검증 규칙: [`AGENTS.md`](AGENTS.md)
- 2.0 수동 검증 matrix: [`docs/manual-smoke-test.md`](docs/manual-smoke-test.md)

## 버전과 라이선스

- 현재 manifest/package 버전: **v1.11.0**
- 라이선스: ISC

이슈나 문의사항은 GitHub Issues를 이용해주세요.
