# Play Plus 2.0 Product and Migration Contract

상태: **사용자 승인 완료 — canonical contract**

승인일: 2026-08-02

공개 마이그레이션 기준: Chrome Web Store에 배포된 **Play Plus v1.11.0**

적용 범위: Play Plus 2.0의 제품 방향, 저장 데이터, 마이그레이션, 기능 범위와 검증

이 문서는 Play Plus 2.0 작업의 최상위 제품·마이그레이션 계약이다. 2.0 관련 Issue, 설계와 구현은 이 문서를 먼저 읽고 범위와 acceptance criteria를 여기에서 내려받아야 한다. 하위 Issue나 Pull Request가 이 문서와 충돌하면 이 문서가 우선한다.

이 계약을 바꾸려면 코드부터 수정하지 않는다. Codex의 최신 저장소 조사, ChatGPT의 제품·설계 검토와 사용자의 명시적 승인을 거친 뒤 이 문서와 해당 Issue를 먼저 갱신한다. 단순한 구현 세부사항은 Issue에서 정할 수 있지만, 여기에서 `확정`, `제외` 또는 `연기`한 범위를 하위 작업이 임의로 바꿀 수 없다.

## 1. Product North Star

Play Plus 2.0은 Coupang Play를 위한 범용 편의 기능 모음이 아니라 **영상 시청과 문장 복습을 연결하는 언어 학습 도구**다.

핵심 사용자 흐름은 다음과 같다.

1. 사용자가 학습 언어와 도움 언어를 확인한다.
2. Coupang Play에서 학습 자막을 보며 영상을 시청한다.
3. 한 번의 저장 동작으로 현재 학습 문장과, 신뢰할 수 있을 때만 대응 도움 문장을 카드로 저장한다.
4. Library에서 저장한 카드를 확인·수정한다.
5. Review에서 한 카드에 집중하고 도움 문장을 필요할 때 공개한다.
6. 카드를 `active` 또는 `completed`로 정리한 뒤 원래 영상 시점으로 돌아갈 수 있다.

2.0의 성공 기준은 많은 기능 수가 아니다. 저장이 빠르고, 학습/도움 역할이 명확하며, 저장한 문장을 잃지 않고, 복습이 시청으로 다시 이어지는지가 기준이다.

## 2. Authority and Baseline

### 2.1 공개 호환성 기준

- 사용자에게 실제 배포된 v1.11.0의 영속 데이터만 2.0 마이그레이션의 공개 입력 계약으로 인정한다.
- v1.11.0 이후 `main`에 추가된 기능과 저장 형식은 아직 일반 사용자에게 배포되지 않았다. 안정 ID가 있는 저장 카드, `new | learning | mastered` 복습 상태, backup v1, 최신 Review UI와 OpenSubtitles 통합은 공개 마이그레이션 입력으로 지원하지 않는다.
- 개발 빌드나 미배포 `main`을 사용한 데이터까지 보존하는 호환 계층을 만들지 않는다. 필요한 개발 테스트 데이터는 새 v2 fixture로 다시 만든다.
- v1.11.0 릴리스 기준을 조사하거나 fixture를 만들 때 현재 `main`의 타입을 추정해 사용하지 말고, 실제 v1.11.0 코드와 배포 산출물을 기준으로 확인한다.

### 2.2 v1.11.0에서 고려할 영속 데이터

| 저장 위치 | 공개 v1.11.0 데이터 | 2.0 처리 |
| --- | --- | --- |
| `chrome.storage.sync` | `primarySubtitle`, `secondarySubtitle` | 학습/도움 언어·표시·외형 설정으로 이전 |
| `chrome.storage.sync` | `videoSkip`, `subVideoSkip`, `loop` | 아래의 제한된 이전/다음 문장·현재 문장 반복 매핑만 수행하고 구 설정 모델은 제거 |
| `chrome.storage.sync` | `shortcuts` | 하나의 저장 단축키 후보만 매핑하고 복사·중복 저장·역할별 표시 단축키는 제거 |
| `chrome.storage.sync` | `playbackSpeed` | 2.0 재생 속도 제어로 이전 |
| `chrome.storage.local` | `savedSubtitles`의 `{ content, url, startTime, savedAt }[]` | `learningCards`로 항목별 이전 |
| `chrome.storage.local` | `registeredSubtitles` 메타데이터 | 유효한 항목을 그대로 보존 |
| `chrome.storage.local` | `subtitle-<uuid>` 자막 cue 본문 | 해당 유효 메타데이터와 함께 그대로 보존 |
| `chrome.storage.session` | 활성 탭과 진행 중 요청 | 일시 상태이므로 이전하지 않음 |
| side panel Web Storage | `isOnboardingComplete`, `vite-ui-theme`, `page-store` | 아래의 UI 상태 정책에 따라 처리 |

여기에 없는 키를 발견했다고 자동으로 보존 범위를 넓히지 않는다. 먼저 그 키가 공개 v1.11.0 데이터인지 증명하고, 사용자 데이터 손실 위험이 있으면 이 계약을 갱신한다.

## 3. Canonical v2 Data Model

### 3.1 저장 위치와 소유권

v2의 정상 코드가 사용하는 영속 데이터는 다음처럼 소유한다. 실제 키 이름은 이 계약을 그대로 따르며, 타입과 Zod 스키마를 단일 출처로 둔다.

| 저장 위치 | v2 키 | 책임 |
| --- | --- | --- |
| `chrome.storage.local` | `dataSchemaVersion` | 정상 데이터가 v2임을 나타내는 완료 표식. 값은 `2` |
| `chrome.storage.local` | `migrationState` | 마이그레이션 단계, 오류와 정리 재시도를 관리하는 내부 상태 |
| `chrome.storage.local` | `learningCards` | 사용자가 저장한 학습 카드 |
| `chrome.storage.local` | `registeredSubtitles` | 사용자가 등록한 자막 메타데이터 |
| `chrome.storage.local` | `subtitle-<uuid>` | 등록 자막 cue 본문 |
| `chrome.storage.sync` | `learningProfile` | 학습 언어와 도움 언어 |
| `chrome.storage.sync` | `subtitleDisplay` | 역할별 표시 방식과 자막 외형 |
| `chrome.storage.sync` | `learningControls` | 이전/다음 학습 문장, 현재 문장 반복 등 핵심 재생 제어 |
| `chrome.storage.sync` | `shortcuts` | 하나의 저장 동작과 승인된 핵심 제어의 단축키 |
| `chrome.storage.sync` | `playbackSpeed` | 재생 속도 제어 |

학습 카드는 로컬 데이터다. 2.0은 계정, 장치 간 동기화 또는 복구를 약속하지 않는다. `chrome.storage.sync`에 카드를 넣거나 저장 용량을 쪼개 우회하지 않는다.

### 3.2 Learning profile

- `learningLanguage`는 새로 저장하는 카드의 학습 문장 언어다.
- `supportLanguage`는 선택 사항이며 도움 문장 언어다.
- 1.11의 `primarySubtitle.language`는 학습 언어로, `secondarySubtitle.language`는 도움 언어로 이전한다.
- 첫 2.0 진입에서 사용자가 두 역할을 확인할 수 있어야 한다. 기존 카드를 전부 분류할 때까지 앱 전체를 막지는 않는다.
- 자동 언어 감지와 기존 카드 일괄 역할 지정은 2.0 범위가 아니다.

### 3.3 Subtitle display and appearance

자막 설정을 모두 없애지 않는다. 1.11의 `primary`/`secondary`라는 기술적 명칭을 `learning`/`support`라는 학습 역할로 바꾸되, 사용자가 조정한 외형 값은 v2의 정상 설정으로 보존한다.

역할별로 다음 값을 유지하고 정확히 이전한다.

- 표시 상태 또는 표시 방식. 기존 `enabled` 값을 잃지 않으며, 도움 자막은 필요할 때 보이기/숨기기 동작을 지원한다.
- 위치 기준 `top | center | bottom`
- 위치 오프셋
- 글자색
- 글자 크기
- 글자 굵기
- 배경 투명도
- 줄바꿈 여부

이 값들은 레거시 호환 설정이 아니다. 이름과 역할만 정리한 canonical v2 설정이다. UI에서는 기본 학습 흐름을 방해하지 않도록 고급 설정 disclosure 아래에 둘 수 있지만, 숨겼다는 이유로 값을 삭제하거나 기본값으로 덮어쓰면 안 된다.

다음 의미 중복은 제거한다.

- `primary`/`secondary` 언어 선택 → `learningProfile`
- 역할별 단순 `enabled` 체크박스 → 학습/도움 표시 방식
- 학습 프리셋 → 제거. 프리셋이 바꾸던 설정은 사용자의 현재 값 또는 명시적인 v2 기본값으로만 결정

### 3.4 Learning card

canonical 카드의 의미 모델은 다음과 같다. TypeScript 구현은 strict schema와 discriminated union 등으로 불변식을 강제해야 한다.

```text
LearningCard
  id: stable deterministic string
  content:
    | { learning: Line, support?: Line }
    | { unassigned: Line }
  source:
    url: string
    startTime: number
    endTime?: number
    title?: string
  studyState: "active" | "completed"
  createdAt: ISO-8601 string

Line
  text: non-empty string
  language: normalized language code
```

불변식은 다음과 같다.

- 카드에는 하나 이상의 비어 있지 않은 문장이 있어야 한다.
- `unassigned`는 `learning` 또는 `support`와 동시에 존재할 수 없다. 언어 코드는 `und`다.
- 새 2.0 저장은 항상 `learning`을 포함한다. 신뢰할 수 있는 대응 문장이 있을 때만 `support`를 포함한다.
- v1.11에서 이전한 미분류 카드는 정상적인 `unassigned` 카드다. `legacy`, `migrated`, `v1` 같은 영구 출처 필드를 추가하지 않는다.
- `unassigned` 카드는 Library에는 보이지만 Review 대상에는 들어가지 않는다.
- `active`는 계속 학습할 카드, `completed`는 사용자가 완료로 정리한 카드다. SRS 단계, 정답률 또는 기억 수준을 뜻하지 않는다.
- `title`은 향후 수집할 수 있는 선택 필드다. 2.0 초기 구현의 acceptance criterion이 아니며, 제목이 없다고 URL에서 추측하거나 네트워크 요청을 보내지 않는다.

2.0의 카드 편집은 다음으로 제한한다.

- 학습/도움 문장 텍스트 수정
- 도움 문장 제거
- 문장 언어와 학습/도움 역할 변경
- `unassigned` 카드를 학습 문장 또는 학습+도움 문장으로 정리

노트, 태그, 폴더, 덱, source URL·시간·제목 편집, 자동 병합, 자막 cue 전문 편집과 편집 이력은 포함하지 않는다.

## 4. v1.11 to v2 Migration Contract

### 4.1 구조 원칙

마이그레이션은 **깨끗한 v2 정상 모델 + 격리된 v1.11 one-shot decoder** 구조로 구현한다.

- UI, content script와 정상 background 경로는 v2 스키마만 읽고 쓴다.
- v1.11 파싱과 변환은 전용 migration 모듈에만 둔다.
- 정상 컴포넌트에 `oldKey ?? newKey`, 구버전 union, 이중 쓰기 또는 장기 fallback을 남기지 않는다.
- background 시작 시 `ensureV2Ready()`에 해당하는 준비 게이트를 통과하기 전에는 정상 v2 읽기·쓰기를 시작하지 않는다.
- fresh install은 v2 기본 데이터와 완료 표식을 직접 만들며 v1 decoder를 거치지 않는다.

### 4.2 비원자 저장소에서의 안전 절차

`chrome.storage.local`, `chrome.storage.sync`와 side panel Web Storage를 하나의 transaction으로 묶을 수 없으므로 다음 순서를 지킨다.

1. 완료 표식이 없으면 v1.11 원본을 읽고 strict decoder로 검증한다.
2. 원본은 건드리지 않은 채 메모리에서 전체 v2 결과를 만든다.
3. v2 local/sync 데이터를 쓴다.
4. 방금 쓴 모든 v2 데이터를 다시 읽고 v2 스키마와 교차 참조 불변식을 검증한다.
5. 검증이 모두 성공한 뒤에만 `dataSchemaVersion: 2`와 완료 상태를 기록한다.
6. 완료 표식 이후 v1 전용 키와 더 이상 쓰지 않는 Web Storage를 idempotent하게 정리한다.
7. 완료 뒤 정리가 중단되면 v2는 사용할 수 있지만, 다음 background 시작에서 정리만 재시도한다. 정상 기능은 남은 v1 키를 읽지 않는다.

완료 표식 전에 읽기·변환·쓰기·재검증 중 하나라도 실패하면 다음을 지킨다.

- v1 원본을 삭제하거나 수정하지 않는다.
- 완료 표식을 기록하지 않는다.
- 부분적으로 쓴 v2 데이터는 다음 시도에서 같은 결과로 덮어쓸 수 있어야 한다.
- background 시작 때 재시도한다.
- 정상 UI 대신 복구 가능한 오류 상태를 보여 주며 빈 기본값으로 조용히 초기화하지 않는다.
- 오류에 원본 자막 텍스트나 전체 URL을 로그로 남기지 않는다.

### 4.3 Saved subtitle conversion

v1.11의 각 `savedSubtitles` 항목은 다음 규칙으로 정확히 하나의 카드가 된다.

- 배열 항목 수, 순서, 중복, `content`, `url`, `startTime`, `savedAt`을 보존한다.
- `content`는 `unassigned.text`, 언어는 `und`가 된다.
- `savedAt`은 `createdAt`이 되고 `studyState`는 `active`다.
- v1.11에 없는 `endTime`과 `title`은 만들지 않는다.
- 시간, 문장 유사도 또는 같은 영상이라는 이유로 항목을 자동 결합하지 않는다.
- 중복을 제거하거나 텍스트를 정규화하지 않는다.

ID는 재시도해도 같고 중복 항목은 서로 달라야 한다. 구현은 UTF-8 JSON tuple `[content, url, startTime, savedAt, originalIndex]`의 SHA-256을 사용해 `card-v1-<64 lowercase hex>` 형식으로 만든다. tuple 직렬화는 JSON 표준 출력 그대로 사용하며 필드 순서를 바꾸지 않는다.

### 4.4 Registered subtitle conversion

등록 자막은 사용자가 추가한 데이터이므로 2.0에서도 유지한다.

- 유효한 `registeredSubtitles` 메타데이터의 ID, 제목, 언어, 저장 시각과 delay를 보존한다.
- 대응하는 `subtitle-<uuid>` cue 본문의 순서와 값을 바꾸지 않는다.
- 등록 자막은 2.0에서도 학습 또는 도움 자막 source로 선택할 수 있다.
- 메타데이터나 본문이 유효하지 않거나 서로 맞지 않으면 해당 항목만 `unavailable`로 격리하고 나머지 마이그레이션을 계속한다.
- 잘못된 항목이나 orphan cue body를 자동 삭제·수정·재연결하거나 언어를 추측하지 않는다.
- 등록 자막 repair/cleanup UI는 연기한다. 이후 추가하려면 별도 제품 결정과 사용자 승인이 필요하다.

격리된 원본은 사용자가 명시적으로 삭제하기 전까지 보존한다. 격리 상태 때문에 정상 데이터까지 빈 값으로 덮어쓰면 안 된다.

### 4.5 Settings and Web Storage conversion

- `primarySubtitle`의 언어·표시·외형은 `learning` 역할로 이전한다.
- `secondarySubtitle`의 언어·표시·외형은 `support` 역할로 이전한다.
- 숫자 범위와 enum이 유효한 사용자 값은 기본값으로 치환하지 않고 그대로 보존한다.
- `playbackSpeed`의 유효한 단축키와 활성 의도는 새 속도 제어로 이전한다.
- 하나의 저장 동작에 사용할 수 있는 기존 저장 단축키가 하나뿐이면 그 값을 후보로 이전한다. 두 값이 모두 있거나 충돌하면 임의로 선택하지 말고 첫 진입 확인 대상으로 둔다.
- `videoSkip.skipTimeUnit`이 `subtitles`일 때 유효한 `backward`/`forward` 단축키는 이전/다음 학습 문장 후보로 이전한다. 문장 이동 수가 1이 아니거나 다른 v2 단축키와 충돌하면 첫 진입 확인 대상으로 두며 임의로 의미를 바꾸지 않는다.
- `loop.loopCurrentSubtitle`의 유효한 단축키는 현재 학습 문장 반복 후보로 이전한다. `playCurrentSubtitleOnce`를 별도 명령으로 유지하지 않는다.
- 복사 전용, primary/secondary 중복 저장·표시, 초/분 단위 스킵, `subVideoSkip`, 수동 A/B 시작·끝, 일반 loop toggle과 일회 재생 설정은 v2 데이터로 이전하지 않는다.
- 유효한 `vite-ui-theme` 값은 유지한다.
- 기존 `page-store`는 2.0 정보 구조와 맞지 않으므로 제거하고 v2 기본 진입점에서 시작한다.
- 기존 `isOnboardingComplete`는 그대로 신뢰하지 않는다. 2.0의 학습/도움 언어 확인을 한 번 완료한 뒤 새 v2 onboarding 표식을 기록하고 구 키를 제거한다.

## 5. 2.0 Feature Scope

### 5.1 확정 — 유지하거나 재구성

#### Learning playback

- 이전 학습 문장으로 이동
- 다음 학습 문장으로 이동
- 현재 학습 문장 반복
- 재생 속도 증가·감소·초기화
- 도움 자막 보이기/숨기기
- 현재 학습 문장을 저장하는 하나의 명령과 하나의 사용자 단축키

두 개의 저장 명령, 자막 복사 단축키, primary/secondary 토글이라는 이름은 남기지 않는다. 같은 키 충돌과 예약 키 검증은 계속 필요하다.

#### Save and multi-cue alignment

- 저장의 anchor는 현재 재생 중인 학습 cue다.
- 도움 자막의 delay를 적용한 뒤, 시간적으로 연속된 하나 이상의 도움 cue 그룹을 후보로 비교한다.
- 시간 겹침, 중심점 거리와 cue 사이 gap을 함께 사용해 가장 신뢰할 수 있는 그룹을 선택한다.
- 신뢰도가 기준보다 낮으면 도움 문장을 생략하되 학습 문장 저장은 성공시킨다.
- 문장 텍스트만 보고 서로 다른 cue를 결합하지 않는다.
- 점수, threshold, tie-break와 최대 후보 범위는 구현 Issue에서 fixture와 함께 명시하고 결정론적으로 테스트한다. 이 세부값을 바꿔 자동 저장 결과가 달라지면 제품 동작 변경으로 취급한다.

#### Library and Review

- Library는 `active`, `completed`, `unassigned` 카드를 모두 보여 주고 상태·역할에 따라 필터할 수 있다.
- Review 기본 대상은 학습 문장이 있는 `active` 카드다. 사용자가 요청하면 `completed` 카드를 별도로 볼 수 있다.
- Review는 한 번에 한 카드에 집중하고 도움 문장을 먼저 숨긴 뒤 명시적으로 공개한다.
- 이전, 건너뛰기, 계속 학습, 완료와 원래 영상 시점 열기를 제공한다.
- 저장 요청이 진행 중일 때 중복 상태 변경과 페이지 이동을 막고, 실패하면 해당 카드 상태를 되돌린다.
- 좁은 side panel에서 키보드, 포커스 순서, 스크린 리더 이름과 스크롤이 작동해야 한다.
- 최신 `main`의 Review 상호작용과 접근성 개선은 참고할 수 있지만 `new | learning | mastered` 모델과 세션 기록을 그대로 이식하지 않는다.

#### Registered subtitles and runtime boundaries

- 로컬 파일로 등록한 자막, 역할 선택, delay와 cue 본문 보존을 유지한다.
- 기존 MV3 context 책임, 메시지 스키마, 저장소 중앙화와 탭 생명주기 개선은 유지한다.
- 페이지 DOM과 video 접근은 content script만 담당하고, background service worker의 메모리 지속성을 가정하지 않는다.

### 5.2 확정 — 2.0에서 제거

- 독립된 자막 분석 top-level 화면, 전체 자막 탐색과 단어 빈도 기능
- 학습 프리셋과 preset storage/module/UI
- 시간 단위·자막 단위 스킵을 중복 구성하는 `videoSkip`/`subVideoSkip` 모델
- 사용자가 시작·끝을 정하는 수동 A/B 루프와 일반 루프 설정
- primary/secondary별 저장·복사·표시 단축키
- `new | learning | mastered` 복습 상태와 이를 전제로 한 필터·문구·세션 override
- 하이라이트, 추천, 대시보드, 퀴즈, 공유와 밝기 조절 같은 범용 확장 기능

제거는 UI를 숨기는 것으로 끝나지 않는다. 정상 schema, 기본값, store, message, content/background handler, locale, 테스트와 죽은 코드까지 제거한다. 단, v1.11 입력을 읽는 데 필요한 최소 decoder는 migration 모듈 안에만 남긴다.

### 5.3 확정 — 백업 계약 없음

Play Plus 2.0에는 내보내기, 가져오기 또는 backup 파일 형식을 만들지 않는다.

- 현재 `main`의 미배포 backup v1 모듈, UI, locale, 테스트, parser와 rollback 코드는 제거한다.
- backup v1 문서를 읽거나 호환하는 migration/import 경로를 만들지 않는다.
- “저장한 카드만 내보내기”도 2.0 계약에 포함하지 않는다.
- 계정, 동기화, 복구, export/import와 유료 기능은 향후 별도 제품 결정이다. 지금 파일 형식을 미리 예약하거나 숨은 API를 만들지 않는다.

### 5.4 확정 — 초기 2.0에서 연기

- OpenSubtitles 검색·다운로드. 2.0 UI, runtime integration과 선택적 host permission에서 제거하고 별도 Issue로 다시 검토한다.
- 자동 번역
- SRS, 오늘의 복습, 일정, 학습 이력, 정답률, streak와 알림
- 계정, 장치 간 동기화, 결제와 유료 등급
- 영상 제목 자동 수집·표시, 영상별 그룹과 검색
- 자동 언어 감지와 일괄 역할 지정
- 등록 자막 repair/cleanup
- 고급 문장 pair 교정과 자동 재정렬

`연기`는 2.0 내부에 비활성 코드나 미래용 schema를 미리 넣는다는 뜻이 아니다. 실제 사용자 신호와 별도 승인 전까지 코드, 권한, 저장 필드와 공개 문구를 추가하지 않는다.

## 6. UX Contract

- 제품 용어는 `학습 자막/문장`과 `도움 자막/문장`을 사용한다. 정상 v2 UI에서 `메인/서브`, `primary/secondary`를 사용자 역할명으로 노출하지 않는다.
- 첫 2.0 진입은 학습 언어와 도움 언어 확인에 집중한다. v1 카드를 모두 고치도록 강제하지 않는다.
- 미분류 이전 카드는 “언어/역할 지정 필요”처럼 사실만 말한다. 자동 감지했다고 주장하지 않는다.
- 도움 문장이 정렬되지 않아 저장되지 않은 경우에도 학습 문장은 저장되며, 실패가 아니라 도움 문장 생략으로 이해할 수 있어야 한다.
- 데이터 오류나 마이그레이션 실패는 재시도 가능한 상태로 알린다. “모두 복구됐다” 또는 “백업됐다”처럼 구현하지 않은 보장을 하지 않는다.
- 자막 외형 설정은 고급 영역에 둘 수 있지만 찾을 수 있어야 하며, 접근성 있는 label과 현재 값을 제공한다.

## 7. Privacy and Permissions

- 학습 카드와 등록 자막은 사용자의 브라우저에 로컬로 저장한다.
- 2.0 핵심 흐름은 계정과 외부 서버 없이 작동해야 한다.
- 원격 번역, 분석, telemetry, BYOK와 클라우드 저장을 추가하지 않는다.
- OpenSubtitles 제거와 함께 더 이상 필요한 사용 흐름이 없는 host/optional permission도 제거한다.
- migration 오류 로그, 테스트 fixture와 진단 정보에 실제 사용자의 자막 본문, 전체 시청 URL 또는 등록 자막 본문을 기록하지 않는다.
- 새로운 네트워크 전송, 권한 또는 개인정보 계약은 별도 ChatGPT 검토와 사용자 승인을 받는다.

## 8. Implementation Program

2.0은 하나의 거대한 변경으로 만들지 않는다. 각 단계는 최신 `main`에서 Issue 계약과 작업 브랜치를 만들고, 검증 가능한 vertical slice로 Pull Request를 제출한다. 순서는 다음을 기본으로 한다.

1. **Data contract and migration fixtures**: 실제 v1.11 fixture, v2 schema, deterministic ID, 실패 주입 테스트와 readiness gate.
2. **Learning profile and subtitle display**: 역할 명칭, 언어 확인, 외형 값 보존과 UI 정보 구조.
3. **Learning playback and save**: 핵심 단축키, 현재 cue anchor, multi-cue 도움 문장 정렬과 one-action save.
4. **Library and card editing**: canonical 카드 목록, 상태·역할 필터와 제한된 편집.
5. **Focused Review**: 도움 문장 공개, 상태 전환, video link, pending lock와 접근성.
6. **Scope cleanup**: backup, OpenSubtitles, 분석, preset, 구 상태 모델, 제거된 재생 설정, 관련 권한·locale·테스트 삭제.
7. **Legacy audit and release validation**: v1 정상 경로 참조 제거 증명, 전체 자동 검증과 실제 Chrome upgrade/fresh-install smoke.

기능을 먼저 제거해 v1.11 사용자의 데이터를 읽지 못하게 만들면 안 된다. migration decoder와 fixture를 먼저 고정하고, 제거 작업과 정상 v2 경로 전환이 같은 릴리스에서 일관되게 완료돼야 한다.

각 Issue는 최소한 이 문서의 관련 절을 링크하고 다음을 적는다.

- 사용자 결과와 포함/제외 범위
- 바뀌는 schema, key, message와 MV3 context 책임
- v1.11 upgrade 및 fresh install acceptance criteria
- 자동 테스트와 실제 Chrome smoke 항목
- 권한, 개인정보, 삭제와 rollback 위험

## 9. Definition of Done for 2.0

### 9.1 Migration proof

- 실제 v1.11 형식 fixture로 저장 카드의 수·순서·중복·텍스트·URL·시각·저장일이 보존된다.
- 같은 fixture를 여러 번 변환해 같은 ID와 결과를 얻는다.
- 학습/도움 자막의 유효한 외형 값이 각 역할에 정확히 보존된다.
- 유효한 등록 자막 metadata와 cue body가 byte-for-byte 또는 구조적으로 동등하게 보존된다.
- 변환, 쓰기, 재읽기, 표식과 정리 각 단계의 실패를 주입해 원본 비삭제, 무표식, 재시도와 오류 UI를 증명한다.
- 손상된 등록 자막 한 항목이 정상 카드와 다른 등록 자막의 이전을 막지 않고 격리된다.
- fresh install은 v1 키 없이 canonical v2 데이터만 만든다.

### 9.2 No-runtime-legacy proof

- v1.11 decoder와 migration fixture 외에는 v1 key, v1 type, v1 status 또는 v1 fallback 참조가 없다.
- 정상 UI/content/background가 `savedSubtitles`, `primarySubtitle`, `secondarySubtitle`, `videoSkip`, `subVideoSkip` 또는 구 `loop`를 읽거나 쓰지 않는다.
- 미배포 backup v1과 `new | learning | mastered` 호환 분기가 없다.
- 제거한 feature의 route, UI, controller/store, schema/default, message handler, locale, test와 Chrome permission이 남지 않는다.
- migration 완료 뒤 정리 대상 v1 키가 사라지고, 정리가 중단돼도 다음 시작에서 안전하게 끝난다.

### 9.3 Product proof

- 학습/도움 언어 확인 → 시청 → 한 번 저장 → Library 확인/수정 → 집중 Review → 영상 복귀의 전체 흐름이 작동한다.
- 도움 자막이 한 cue 및 여러 연속 cue일 때 올바르게 pair되고, 낮은 신뢰도에서는 학습 문장만 저장된다.
- `unassigned`는 Library에 남고 Review에서 제외되며 사용자가 정상 카드로 바꿀 수 있다.
- `active`와 `completed`만으로 Review와 Library 동작이 일관된다.
- 백업, OpenSubtitles, 분석과 연기한 기능이 UI, 네트워크 동작과 권한에 노출되지 않는다.

### 9.4 Verification gate

릴리스 후보에서 다음을 모두 실제로 실행한다.

- `yarn type-check`
- `yarn lint`
- `yarn test:run`
- `yarn build`
- `docs/manual-smoke-test.md`를 2.0 계약에 맞게 먼저 갱신한 뒤 전체 Chrome smoke matrix
- v1.11.0을 설치하고 대표 데이터를 만든 실제 Chrome profile에서 2.0으로 update하는 upgrade smoke
- 깨끗한 Chrome profile의 fresh-install smoke
- 최소 320px, 360px와 390px 폭 side panel에서 Library, Review, 설정, migration 오류 상태의 키보드·스크롤·레이아웃 확인

자동 테스트는 실제 Chrome upgrade smoke를 대신하지 않는다. 실행하지 않은 항목은 `NOT RUN`, 외부 환경 때문에 판정할 수 없는 항목은 `UNKNOWN`으로 기록한다.

## 10. Explicit Non-goals and Amendment Rule

2.0 완료를 이유로 다음 작업을 함께 끼워 넣지 않는다.

- 배포, 태그, Chrome Web Store 제출 또는 자동 업데이트 정책 변경
- 계정·결제·서버 구축
- telemetry나 사용자 조사 수집 코드
- 전면적인 디자인 시스템 교체
- MV3 경계를 넘는 편의성 리팩터링
- 다른 스트리밍 서비스 지원

구현 중 이 문서만으로 결정할 수 없는 문제가 생기면 다음처럼 처리한다.

1. 데이터 보존, 공개 동작, 개인정보, 권한 또는 사용자 흐름을 바꾸면 작업을 멈춘다.
2. Codex가 현재 코드 증거와 선택지를 Context Packet으로 정리한다.
3. ChatGPT 검토와 사용자 승인을 받는다.
4. 이 문서와 해당 Issue를 먼저 갱신한 뒤 구현을 재개한다.

버그 수정이나 내부 함수 이름처럼 계약을 바꾸지 않는 세부사항은 Issue와 PR에만 기록한다. 이 문서는 실제 구현 현황을 과장하는 roadmap이 아니라, 2.0이 지켜야 할 승인된 경계다.
