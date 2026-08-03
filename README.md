# Play Plus

**Play Plus**는 Coupang Play 시청과 문장 복습을 연결하는 로컬 우선 Chrome 확장 프로그램입니다. 학습 자막을 보며 현재 문장을 한 번에 저장하고, Library에서 정리한 뒤 Focused Review에서 복습하고 원래 영상 시점으로 돌아갈 수 있습니다.

> `package.json`과 확장 프로그램 manifest의 현재 버전은 **v1.11.0**입니다. 이 저장소에는 다음 릴리스 후보인 Play Plus 2.0 런타임이 구현되어 있지만, 이 설명은 2.0이 Chrome 웹 스토어에 출시·배포되었다는 뜻이 아닙니다. 2.0의 승인된 제품·데이터·마이그레이션 계약은 [`docs/play-plus-2.0.md`](docs/play-plus-2.0.md)를 따릅니다.

## Play Plus 2.0 학습 흐름

1. 첫 진입에서 학습 언어와 선택적인 도움 언어를 확인합니다.
2. Coupang Play가 제공하는 자막이나 사용자가 추가한 로컬 자막 파일을 학습·도움 역할에 지정합니다.
3. 이전/다음 학습 문장으로 이동하거나 현재 학습 문장을 반복하며 시청합니다.
4. 한 번의 저장 동작으로 현재 학습 문장을 카드로 저장합니다. 시간 정렬 신뢰도가 충분할 때만 도움 문장이 함께 저장됩니다.
5. Library에서 카드를 검색·정렬·필터링하고, 문장과 역할을 편집하거나 상태를 바꾸고 삭제·실행 취소합니다.
6. Focused Review에서 도움 문장을 필요할 때 공개하고 카드를 `active` 또는 `completed`로 정리합니다.
7. 카드에 기록된 정확한 원본 URL과 재생 시점으로 돌아갑니다.

## 주요 기능

### 학습·도움 자막

- Coupang Play 자막과 로컬 SRT, VTT, SMI 파일 지원
- 학습 언어와 선택적인 도움 언어 설정
- 역할별 표시·숨김, 위치, 오프셋, 색상, 크기, 굵기, 배경 투명도와 줄바꿈 설정
- 역할별 delay를 한 번만 적용하는 재생·저장 동작
- 도움 언어를 사용하지 않을 때 도움 자막 제어를 비활성화하되 저장된 외형 값은 보존
- 등록 자막 메타데이터와 cue 본문을 브라우저 로컬 저장소에 유지

### 재생과 저장

- 이전/다음 학습 문장 이동
- 현재 학습 문장 반복
- 재생 속도 증가·감소·초기화
- 도움 자막 보이기·숨기기
- 하나의 명령과 하나의 단축키로 학습 카드 저장
- 현재 문장이 없거나 이동 대상이 없을 때 임의의 seek·repeat·save를 하지 않는 명시적 no-op
- 같은 문장을 반복 저장해도 각각의 학습 맥락을 가진 별도 카드로 보존

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
- 핵심 학습 흐름은 계정, 외부 자막 공급자, 번역 서버, telemetry 또는 별도 백엔드 없이 작동합니다.
- 확장 프로그램이 접근하는 웹 호스트는 Coupang Play로 제한됩니다.
- 오류와 진단 정보에는 실제 자막 문장, 등록 자막 본문 또는 전체 시청 URL을 기록하지 않습니다.
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

필수 host access는 `https://www.coupangplay.com/*`뿐이며 optional host permission은 없습니다.

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

- `src/ui/`: side panel React 앱. 학습 설정, 로컬 자막, Library와 Focused Review를 제공합니다.
- `src/background/`: service worker. v2 준비 상태, 탭 생명주기와 컨텍스트 간 메시지를 조정합니다.
- `src/content/`: Coupang Play 페이지의 DOM·video·cue 접근, 자막 렌더링, 재생 제어와 저장 anchor를 담당합니다.
- `src/storage/`: Chrome Storage의 strict schema, v1.11.0 one-shot decoder, v2 migration과 canonical API를 제공합니다.
- `src/utils/`: 타입이 지정된 메시지 계약, i18n과 공통 유틸리티를 제공합니다.

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
