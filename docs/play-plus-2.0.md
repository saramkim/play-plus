# Play Plus 2.0 Product and Migration Contract

상태: **사용자 승인 완료 — canonical contract**

승인일: 2026-08-02

최종 개정 승인일: 2026-08-21 — episode watch-next positive sampling 및 direct advertisement lifecycle gate 정정

공개 마이그레이션 기준: Chrome Web Store에 배포된 **Play Plus v1.11.0**

적용 범위: Play Plus 2.0의 제품 방향, 저장 데이터, 마이그레이션, 기능 범위와 검증

이 문서는 Play Plus 2.0 작업의 최상위 제품·마이그레이션 계약이다. 2.0 관련 Issue, 설계와 구현은 이 문서를 먼저 읽고 범위와 acceptance criteria를 여기에서 내려받아야 한다. 하위 Issue나 Pull Request가 이 문서와 충돌하면 이 문서가 우선한다.

이 계약을 바꾸려면 코드부터 수정하지 않는다. Codex의 최신 저장소 조사, ChatGPT의 제품·설계 검토와 사용자의 명시적 승인을 거친 뒤 이 문서와 해당 Issue를 먼저 갱신한다. 단순한 구현 세부사항은 Issue에서 정할 수 있지만, 여기에서 `확정`, `제외` 또는 `연기`한 범위를 하위 작업이 임의로 바꿀 수 없다.

2026-08-14 실제 Coupang Play 조사에서 관찰한 route, runtime과 비공개 API data surface, 신뢰도와 개인정보 경계는 [Coupang Play Content and Runtime Evidence](./coupang-play-content-evidence.md)에 기록한다. 이 시점별 조사 기록은 구현 가능성을 판단하는 근거이며, 비공개 API의 안정성을 보장하거나 이 계약의 `확정`, `제외`, `연기` 범위를 자체적으로 변경하지 않는다.

## 1. Product North Star

Play Plus 2.0은 Coupang Play를 위한 범용 편의 기능 모음이 아니라 **영상 시청과 문장 복습을 연결하는 언어 학습 도구**다.

Top-level destination은 **Learning, Subtitles, Library, Review** 네 개만 유지한다. Listening Mission의 entry, factual progress summary와 active session은 모두 Learning 안에 둔다.

핵심 사용자 흐름은 다음과 같다.

1. 사용자가 학습 언어와 도움 언어를 확인한다.
2. Coupang Play 자막, 로컬 파일 또는 명시적으로 검색·추가한 OpenSubtitles 자막을 학습/도움 역할로 선택해 영상을 시청한다.
3. Learning에서 현재 장면 또는 로컬 진행도부터 짧은 Listening Mission을 시작해 최대 10개 문장을 듣고 입력하며 필요할 때 단계별 힌트를 사용한다.
4. 한 번의 저장 동작으로 현재 학습 문장과, 신뢰할 수 있을 때만 대응 도움 문장을 카드로 저장한다.
5. Library에서 저장한 카드를 확인·수정한다.
6. Review에서 한 카드에 집중하고 도움 문장을 필요할 때 공개한다.
7. 카드를 `active` 또는 `completed`로 정리한 뒤 원래 영상 시점으로 돌아갈 수 있다.

시청 중에는 현재 선택한 학습·도움 자막의 전체 문장을 함께 또는 역할별로 한눈에 탐색하고, 원하는 장면으로 이동하거나 학습 문장을 바로 카드로 저장할 수 있다. 이는 별도의 분석 workflow가 아니라 시청과 문장 학습을 돕는 자막 기능이다.

Listening Mission은 범용 quiz platform이 아니라 현재 Coupang Play 영상의 선택된 학습 자막에서 source 순서대로 만든 짧은 듣기 활동이다. 문장 듣기, 입력, 단계별 힌트, 한 번의 선택적 재도전, 로컬 진행도와 사용자가 명시적으로 고른 어려운 문장의 Library 저장만 제공한다.

2.0의 성공 기준은 많은 기능 수가 아니다. 저장이 빠르고, 학습/도움 역할이 명확하며, 저장한 문장을 잃지 않고, 복습이 시청으로 다시 이어지는지가 기준이다.

## 2. Authority and Baseline

### 2.1 공개 호환성 기준

- 사용자에게 실제 배포된 v1.11.0의 영속 데이터만 2.0 마이그레이션의 공개 입력 계약으로 인정한다.
- v1.11.0 이후 `main`에 추가된 기능과 저장 형식은 아직 일반 사용자에게 배포되지 않았다. 안정 ID가 있는 저장 카드, `new | learning | mastered` 복습 상태, backup v1, 최신 Review UI와 과거 OpenSubtitles runtime/cache/config는 공개 마이그레이션 입력으로 지원하지 않는다.
- 2.0에서 사용자가 명시적으로 검색하고 선택한 온라인 자막은 새 기능의 출력이다. parse에 성공하면 기존 `registeredSubtitles`와 `subtitle-<uuid>` 경계로 등록하며, 별도의 provider 영속 schema나 과거 미배포 데이터 호환 계층을 만들지 않는다.
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
| `chrome.storage.local` | `listeningProgress` | 영상·학습 source·segmenter version별 Listening Mission 최선 진행도 |
| `chrome.storage.local` | `registeredSubtitles` | 사용자가 등록한 자막 메타데이터 |
| `chrome.storage.local` | `subtitle-<uuid>` | 등록 자막 cue 본문 |
| `chrome.storage.sync` | `learningProfile` | 학습 언어와 도움 언어 |
| `chrome.storage.sync` | `subtitleDisplay` | 역할별 표시 방식과 자막 외형 |
| `chrome.storage.sync` | `shortcuts` | 하나의 저장 동작과 이전/다음/반복의 키보드 바인딩 및 단일 master |
| `chrome.storage.sync` | `playbackSpeed` | 재생 속도 제어 |

학습 카드는 로컬 데이터다. 2.0은 계정, 장치 간 동기화 또는 복구를 약속하지 않는다. `chrome.storage.sync`에 카드를 넣거나 저장 용량을 쪼개 우회하지 않는다.

OpenSubtitles 검색 입력, 결과 metadata, `file_id`, 임시 download URL과 다운로드 원문은 canonical 영속 데이터가 아니다. 필요한 same-session cache는 검증된 최소 필드만 `chrome.storage.session`에 둘 수 있으며, 성공적으로 parse한 cue만 기존 등록 자막 저장 API를 통해 영속화한다. 구현 Issue는 코드를 쓰기 전에 cache entry 수, 총 byte, TTL과 결정론적 eviction 상한을 수치로 고정해야 한다.

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

### 3.5 Listening progress

`listeningProgress`는 `chrome.storage.local`의 하나의 필수 strict v2 key다. `dataSchemaVersion`은 계속 `2`이며, 공개 v1.11.0 이전과 fresh install은 완료 표식 전에 다음 의미의 빈 version 1 진행도를 초기화한다. 아직 공개되지 않은 interim v2 profile에 missing-key fallback이나 별도 compatibility branch를 추가하지 않는다.

```text
ListeningProgressV1
  version: 1
  videos[videoId]
    sources[learningSourceKey]
      segmenterVersion: 1
      bestCombo: nonnegative safe integer
      lastPracticedAt: offset-aware ISO-8601 string
      items[segmentKey]
        state: "attempted" | "cleared" | "mastered"
        totalAttempts: nonnegative safe integer
        lastPracticedAt: offset-aware ISO-8601 string
```

- `videoId`는 비어 있지 않은 지원 Coupang Play video identity이고, source key는 실제 선택한 `native:<language>` 또는 `registered:<subtitleId>`다.
- progress namespace는 `videoId + learningSourceKey + segmenterVersion`이다. 전체 시청 URL은 namespace나 progress field가 아니다.
- 상태 순서는 `attempted < cleared < mastered`이며 저장은 best-ever evidence만 단조롭게 합친다. 이후 실패가 이미 얻은 상태를 낮추지 않는다.
- source `bestCombo`는 maximum으로, factual last-practiced timestamp는 latest valid value로 합친다.
- `mastered`는 한 mission에서 첫 제출이 exact이고 text hint를 사용하지 않은 문장이다. audio replay는 허용한다.
- `totalAttempts`는 제출한 답변 수만 세며 `0`을 허용한다. `Later` 또는 Answer Reveal만으로 방문을 끝냈다면 제출이 없을 수 있고, hint와 audio replay는 attempt를 만들지 않는다.
- 현재 분모와 완료율은 저장된 과거 목록이 아니라 현재 deterministic segment catalog에서 계산한다.
- typed answer, 미완성 draft, chronological mission history, per-attempt text, source URL, subtitle body, support text, mission snapshot, star, 정확도 history, streak, audio와 microphone data는 저장하지 않는다.
- `attempted`/`cleared`/`mastered`, 최근 연습 시각과 best combo는 사실 기반 로컬 진행도일 뿐 SRS schedule이나 장기 기억을 주장하지 않는다.
- 진행도 API는 strict get, 하나의 serialized mission-result batch 기록, 현재 video 삭제와 전체 Listening Progress 삭제만 제공한다. mutation은 queue 안에서 다시 읽고 전체 값을 한 번만 쓰며 overflow, invalid input/persisted value와 write failure에 fail closed하고 다음 요청은 다시 시도할 수 있어야 한다.

## 4. v1.11 to v2 Migration Contract

### 4.1 구조 원칙

마이그레이션은 **깨끗한 v2 정상 모델 + 격리된 v1.11 one-shot decoder** 구조로 구현한다.

- UI, content script와 정상 background 경로는 v2 스키마만 읽고 쓴다.
- v1.11 파싱과 변환은 전용 migration 모듈에만 둔다.
- 정상 컴포넌트에 `oldKey ?? newKey`, 구버전 union, 이중 쓰기 또는 장기 fallback을 남기지 않는다.
- background 시작 시 `ensureV2Ready()`에 해당하는 준비 게이트를 통과하기 전에는 정상 v2 읽기·쓰기를 시작하지 않는다.
- fresh install은 v2 기본 데이터와 완료 표식을 직접 만들며 v1 decoder를 거치지 않는다.
- fresh install과 actual v1.11 migration plan은 strict empty `listeningProgress`를 다른 required v2 local key와 함께 쓰고 다시 읽어 검증한 뒤에만 완료 표식을 기록한다. `dataSchemaVersion`은 `2`를 유지하며 interim unreleased v2 profile용 missing-key default를 두지 않는다.

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
- v2 `shortcuts.enabled`는 기존 `shortcuts.enabled`, 활성화된 자막 단위 `videoSkip`에서 보존할 이전/다음 후보가 있는 경우, 활성화된 `loopCurrentSubtitle`에서 보존할 반복 후보가 있는 경우를 OR해 결정한다. 충돌·모호성으로 첫 진입 확인이 필요한 후보도 기존 활성 의도를 잃지 않으며, 사용자가 거부한 후보는 빈 바인딩으로 남긴다.
- 첫 진입은 모호하거나 충돌한 키 후보와 학습/도움 언어만 확인한다. 이전/다음/반복 동작 자체를 끄는 별도 상태를 만들거나 기록하지 않는다.
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

이전·다음·반복은 항상 제공하는 핵심 재생 동작이며 사용자가 설정에서 개별적으로 숨기거나 비활성화하지 않는다. `shortcuts.enabled`는 저장·이전·다음·반복의 **키보드 바인딩만** 한꺼번에 켜고 끈다. master가 꺼져도 영상 위 재생 control과 직접 명령은 유지하고, master가 켜졌을 때 비어 있지 않은 바인딩만 동작한다. 단, active Listening Mission이 content media state를 소유하는 동안에는 충돌하는 Play Plus overlay와 on-video Controller를 persistent setting 변경 없이 transiently 숨기고 비활성화한다. 재생 속도는 자체 master를 유지한다.

설정에는 `Learning playback controls`나 개별 enabled checkbox를 두지 않는다. 저장·이전·다음·반복과 재생 속도의 raw `KeyboardEvent.code`는 저장·검증·runtime 비교에만 사용하고, 사용자에게는 같은 code를 일관된 읽기 쉬운 키 이름으로 변환해 표시한다. 같은 키 충돌과 예약 키 검증은 계속 필요하며 저장할 수 없는 입력에는 해당 필드와 연결된 이유를 즉시 표시한다.

두 개의 저장 명령, 자막 복사 단축키, primary/secondary 토글이라는 이름은 남기지 않는다.

#### Listening Mission

Listening Mission은 초기 Play Plus 2.0의 flagship 학습 흐름이다. 기존 **Learning** destination 안에 진입, 현재 source 진행도와 active mission을 두고 기존 Learning settings는 mission 밖에서 계속 제공한다. 다섯 번째 destination이나 범용 quiz framework를 만들지 않는다.

##### Mission entry and order

- 사용자에게는 하나의 연습 단위를 `문장` 또는 `line`으로 말한다. 내부에서는 인접한 학습 cue를 합칠 수 있는 deterministic practice segment를 사용한다.
- `Start from current position`은 기존 closed-interval containment rule로 현재 시각을 포함하는 segment에서 시작한다. 겹치면 가장 늦게 시작한 segment, 같은 시작이면 가장 작은 source index를 고르고, gap에서는 다음 segment를 고른다.
- `Continue`는 현재 catalog에서 progress가 없는 가장 이른 segment, 그다음 `cleared` 미만인 가장 이른 segment, 모두 cleared이면 첫 segment에서 시작한다.
- 한 mission은 선택한 시작점부터 source 순서의 연속 segment를 최대 10개 사용해 보통 몇 분 안에 끝낸다. track 끝에서는 더 적을 수 있고 shuffle하지 않는다.
- entry와 progress summary는 정확한 `videoId + learningSourceKey + segmenterVersion`만 결합한다. source가 달라지면 다른 진행도다.

##### Practice segmenter version 1

선택한 학습 track이 answer source다. 선택한 도움 track은 optional support일 뿐 learning segment의 존재나 identity를 결정하지 않는다.

Spoken-text cleanup은 다음 순서를 고정한다.

1. 현재 safe plain-text helper로 기존 subtitle markup을 제거한다.
2. Unicode-aware whitespace를 정규화한다.
3. `[]`, `()`, `［］`, `（）`, `【】`만 지원 wrapper pair로 인식한다.
4. 지원 wrapper의 nesting을 stack으로 parse하고 완전한 outermost span을 통째로 제거한다. 여러 완전한 span은 왼쪽부터 각각 제거하고 mixed content의 나머지 unwrapped text는 보존한다.
5. mismatched, crossed 또는 unclosed wrapper는 의미를 추측하지 않고 일반 text로 보존한다.
6. cleanup 뒤 Unicode letter나 number가 하나도 없으면 empty, punctuation-only, music-symbol-only cue를 포함해 ineligible separator로 처리한다.

dictionary, translation, language model, network request 또는 semantic classifier로 spoken 여부를 판정하지 않는다.

Greedy grouping은 learning cue를 source 순서로 한 번 scan한다.

- 각 eligible cue에서 accumulator를 시작하고 바로 다음 source cue만 검토한다. accumulator가 800ms minimum에 도달한 뒤에도 아래 조건이 모두 true이면 계속 append한다.
- accumulated cleaned text가 `.`, `?`, `!`, `。`, `？`, `！` 중 하나로 끝나면 append하지 않는다.
- 두 cue 사이에 ineligible separator가 있거나 다음 cleaned cue가 trim 뒤 `-`, `–`, `—`와 spoken text로 시작하면 append하지 않는다.
- uncovered effective gap은 700ms 이하여야 한다.
- combined effective duration은 9000ms 이하이고 joined answer는 120 grapheme 이하여야 한다.
- 다음 cue를 append할 수 없거나 source가 끝나면 accumulator를 emit한다. cleaned part는 ordered source index와 함께 유지하고 answer text는 한 개의 normalized ASCII space로 잇는다.
- 유효한 emitted segment는 2–120 grapheme, effective duration 800–9000ms를 inclusive하게 만족한다. emit 시 minimum 또는 maximum boundary를 만족하지 않으면 이미 소비한 source position과 함께 omit하고 이후 group이 그 cue를 bridge하거나 재사용하지 않는다.
- 하나의 source cue를 split하지 않는다. 9000ms 또는 120 grapheme을 넘는 단일 cue는 나누지 않고 omit한다.
- learning role delay는 effective playback timing에 정확히 한 번 적용한다. 모든 learning cue에 동일하게 적용되는 delay만으로 grouping이나 segment identity가 바뀌면 안 된다.
- optional support는 final segment interval에 대해 기존 deterministic support-alignment policy를 정확히 한 번 사용한다. low confidence 또는 unavailable support는 support만 생략하며 learning segment를 제외하지 않는다.

`LISTENING_SEGMENTER_VERSION`은 `1`이다. `ListeningSourceKey`는 `native:<learning-language>` 또는 `registered:<registered-subtitle-id>`이며, `segmentKey`는 다음 순서의 값을 담은 canonical JSON에서 derive한 deterministic, source-specific, versioned key다.

1. segmenter version
2. 실제 learning source key
3. ordered constituent learning source indices
4. join 전 ordered cleaned spoken-text parts

`videoId`는 segment key 밖에서 progress namespace를 만든다. support source/text와 learning/support delay는 key에서 제외한다. timing만 달라진 경우 identity를 유지하고 source index 또는 cleaned spoken text가 달라지면 해당 segment key만 달라지며 unrelated unchanged key는 유효하다.

##### Answer, hints, rounds, and results

Answer comparison은 markup과 complete supported wrapper span을 제거한 뒤 Unicode NFKC, configured learning language에 따른 deterministic case folding과 stable fallback, quote/apostrophe/hyphen canonicalization, Unicode punctuation 제거와 whitespace normalization을 적용한다. 사람이 읽을 수 있는 normalized form과 whitespace를 제거한 compact comparison form을 함께 제공하며 실제 letter와 number는 semantic하게 바꾸지 않는다.

모든 length, mask와 distance 계산은 Unicode grapheme 단위를 사용하고 supported Chrome의 `Intl.Segmenter` 동작과 deterministic fallback을 fixture로 고정한다.

- expected 또는 actual compact form이 비어 있으면 `correct`가 아니다.
- compact exact equality만 `correct`다.
- punctuation과 spacing 차이만으로는 answer가 틀리지 않는다.
- non-exact 답은 grapheme-level Levenshtein distance가 `max(1, floor(max(expectedLength, actualLength) × 0.15))` 이하일 때만 `almost`, 그 밖에는 `try again`이다.
- `almost`와 `try again`은 이후 exact 제출 전에는 문장을 clear하지 않는다. contraction, synonym, translation, semantic similarity 또는 AI 판정은 사용하지 않는다.

Text hint는 typed draft와 무관하게 normalized expected answer만 사용하고, single mask glyph `＿`를 쓴다.

1. **Shape**: whitespace position은 보존하고 모든 non-whitespace grapheme을 `＿`로 바꾼다.
2. **First graphemes**: token이 둘 이상이면 각 whitespace-delimited token의 첫 grapheme만 보이고 나머지를 mask한다. token이 하나뿐인 no-space text는 grapheme index `0, 4, 8, ...`만 보인다.
3. **Support**: accepted aligned support가 있을 때만 보여 준다. 없으면 이 level을 건너뛴다.
4. **Answer Reveal**: full learning answer를 보여 준다.

Hint는 draft와 token을 맞춰 `resolved` portion을 추론하지 않는다. text hint는 즉시 사용할 수 있고 judgment feedback도 현재 opened hint level을 넘는 expected grapheme을 누설하지 않는다. audio control은 text hint가 아니며 즉시 사용할 수 있고 횟수 제한이나 score penalty가 없다.

- first round는 모든 선택 segment를 source 순서로 한 번 방문한다.
- 첫 제출이 non-exact이거나 text hint, `Later` 또는 Answer Reveal을 사용한 line은 retry candidate다.
- round와 관계없이 incorrect submission, text hint, `Later` 또는 Answer Reveal은 current combo를 끊는다.
- exact first submission에 text hint가 없으면 combo를 올리고 그 mission의 mastered evidence를 얻는다. 그 전에 submission 또는 hint가 있었다면 이후 exact는 cleared만 얻는다.
- correct 또는 Reveal 뒤에는 full learning text와 accepted support를 보여 주고 explicit Next 전에는 자동 이동하지 않는다.
- retry candidate에는 original video order의 optional retry round를 정확히 한 번 제안한다. retry는 모든 text와 transient draft를 다시 숨기며 exact가 clear할 수 있지만 first-try/mastered를 소급해 만들지 않는다. 두 번째 retry는 없다.
- 1 star는 first round 완료, 2 stars는 Results 전 모든 line cleared, 3 stars는 모두 cleared이면서 first-submission exact가 80% 이상이고 Answer Reveal이 없는 경우다.
- `Perfect`는 모든 line이 text hint 없이 첫 제출 exact인 경우다.
- difficult candidate는 첫 non-exact 제출, text hint, Reveal, `Later` 또는 retry failure가 있었던 segment다.
- timer, life, game over, wait penalty, leaderboard와 sharing은 없다.

##### Playback session and controller boundary

Mission 시작은 current video element, position, playback rate, paused/playing state와 Play Plus subtitle/controller의 transient visibility를 capture한다. active mission 동안 Play Plus learning/support overlay와 on-video Controller를 storage setting 변경 없이 숨기고 비활성화한다. Coupang Play player 자체 caption DOM은 inspect, click, hide 또는 detected라고 주장하지 않으며, entry copy로 보이면 사용자가 끄도록 안내한다.

- 새 line은 한 번 자동 재생한다. clip은 가능하면 segment 250ms 전부터 시작하고 350ms 뒤에 pause하되 다음 spoken segment를 침범하지 않는다.
- `Listen again`은 1.0×, `Slow`는 0.75×다. 새 clip은 이전 observer를 supersede하고 media event와 generation guard로 정확히 pause한 뒤 완료한다.
- play 결과는 `played | stale | no-video | segment-unavailable | error`를 구분한다.
- video, SPA route, content instance, active learning source 또는 subtitle revision 변경은 old session을 invalidate한다. 이미 completed progress는 저장할 수 있지만 stale media command나 text가 새로운 video/source를 제어하거나 표시하면 안 된다.
- active Side Panel은 direct UI-content heartbeat를 약 5초마다 보내고 content-owned lease는 마지막 valid heartbeat 뒤 15초에 만료한다. captured video가 아직 current이면 expiry가 captured position/rate/play state를 `restore-start`로 복원하고, replacement/new-route video라면 seek하지 않는다. 어느 경우든 observer, session text와 transient Play Plus subtitle/controller suppression을 정리한다. 정상 exit는 heartbeat, observer, timer와 suppression을 즉시 정리하며 expiry는 Side Panel close/reload/crash를 위한 emergency safety다.

End mode와 결과는 다음처럼 고정한다.

- `restore-start`: captured position/rate/play state와 Play Plus transient visibility를 복원한다.
- `complete-stay`: 마지막 practiced endpoint에 paused 상태로 남고 original rate/visibility를 복원한다.
- `continue-watching`: 마지막 endpoint에서 original rate/visibility로 재생을 계속한다.
- end 결과는 `ended | already-ended | stale | no-video | error`를 구분한다. exact session의 end는 idempotent하고 replacement/new-route video를 old position으로 seek하지 않는다.
- normal mid-mission exit는 completed progress만 저장한 뒤 `restore-start`를 사용한다.
- normal completion이 Results에 들어가는 것만으로 content-owned session을 끝내거나 어떤 end mode도 호출하지 않는다. video는 last practiced endpoint에 paused 상태로 남고 session, heartbeat, navigation ownership과 immutable snapshot은 사용자가 end action을 선택할 때까지 유효하다.
- normal Results close는 `complete-stay`, Continue Watching은 `continue-watching`을 사용한다. `Next 10`은 old session을 `complete-stay`로 끝낸 뒤 current catalog, identity와 revision을 refresh하고 새 consecutive session을 시작한다.

Progress commit은 `saved | error`를 구분한다. difficult save는 successful segment key를 보존하고 `busy | error`만 retryable로 다룬다. `stale | no-video | segment-unavailable`은 terminal이며 failing key와 아직 시도하지 않은 later key를 구분해 보고하고 이후 save를 중지한다.

##### Progress failure, reset, and explicit Library save

Mission은 completed visit마다 approved state와 submitted-answer count만 합쳐 한 번의 progress result를 만든다. `Later` 또는 Reveal만으로 완료한 visit은 `attempted`와 submitted-answer increment `0`을 기록할 수 있다. typed answer나 chronological attempt history는 controller, message 또는 storage payload에 포함하지 않는다.

- `Clear current video progress`는 exact current video의 모든 source progress만, `Clear all listening progress`는 Listening Progress만 지운다. 각각 별도의 destructive confirmation을 사용하고 cards, subtitles, settings와 migration data는 건드리지 않는다.
- progress write failure 뒤에는 `Retry saving progress`를 primary action으로 제공하고, failure가 확인된 뒤에만 `Exit without saving this progress`를 secondary action으로 제공한다.
- discard warning은 이번 session의 저장되지 않은 progress가 사라지며 이전에 저장된 progress는 남는다고 정확히 설명한다.
- mid-mission discard는 `restore-start`, Results discard는 `complete-stay`를 사용한다. successful 또는 terminal cleanup은 navigation lock, heartbeat, media observer, 0.75× rate와 subtitle/controller suppression을 lease expiry를 기다리지 않고 즉시 해제한다. end `error`는 사실대로 retryable하게 보여 주고 즉시 다시 cleanup할 수 있게 하며, lease expiry를 정상 exit 방법으로 의도적으로 기다리게 하지 않는다.

Difficult line은 자동으로 Library에 넣지 않는다. Results의 모든 checkbox는 처음에 clear 상태이고, 사용자가 명시적으로 선택한 segment key만 current content session이 다시 검증한다. content가 combined learning text, current canonical watched URL, effective time range와 accepted support를 기존 canonical card builder로 하나의 assigned `LearningCard`로 변환하고 기존 validated card-storage path를 사용한다. repeated save는 distinct card다.

#### Current subtitle overview

- 기존 네 개의 top-level destination은 유지한다. `Subtitles` 안에 항상 보이는 `자막 추가 | 전체 자막` subview를 두며 기본값은 `자막 추가`이고 선택은 영속화하지 않는다.
- `전체 자막`은 content script가 현재 재생에 실제로 선택한 학습·도움 역할을 하나의 원자적 snapshot으로 제공한다. 기본은 학습 cue를 anchor로 대응 도움 문장을 함께 보여 주는 `함께` 보기이며, 사용자는 `학습` 또는 `도움`만 볼 수 있다. 도움 역할이 없으면 도움 관련 control을 숨기고 학습 목록만 표시하며, 역할은 설정됐지만 cue가 없으면 사실적인 empty state를 표시한다.
- `함께` 보기의 도움 문장은 저장과 같은 결정론적 multi-cue alignment를 사용한다. 매칭되지 않은 학습 cue도 학습 문장만으로 남고, 같은 도움 문장이 인접한 여러 학습 cue의 최선 대응일 수 있다. `도움` 보기는 매칭되지 않은 cue를 포함한 도움 track 전체를 source 순서대로 보여 준다.
- 현재 활성 source가 Coupang Play native인지 사용자가 등록한 자막인지 역할별로 표시한다. `변경`은 기존 자막 추가·역할 관리 영역으로 이동하며, `전체 자막` 안에 임의 source 선택기나 활성 역할을 바꾸는 control을 만들지 않는다.
- 등록 자막 목록의 `자막 확인`은 학습·도움 역할 지정이나 활성 영상 연결 없이 해당 로컬 자막의 내용을 읽기 전용으로 보여 준다. 이 화면은 역할 보기, 현재 cue, follow, seek와 카드 저장을 제공하지 않고 제목·언어·delay, 검색·문장 수와 단일 track cue 목록만 제공한다. UI가 기존 strict 로컬 자막 저장 경계를 직접 읽으며, 닫기 또는 뒤로 가기는 시작한 control로 focus를 복원한다.
- 빈 문장을 제외한 전체 cue를 source 순서로 가상화해 보여 준다. 활성 전체 보기의 각 행은 카드 외곽과 역할 label을 반복하지 않는 고밀도 divider 목록이며, `함께`에서는 학습 한 줄과 대응 도움 한 줄을 기본 시각 높이로 삼는다. compact 시작 timestamp는 항상 보이고 종료 시각과 잘린 전체 문장은 hover뿐 아니라 keyboard focus와 touch에서도 확인할 수 있다. 여러 줄·다국어 원문과 검색 전후에도 측정된 행이 다음 행과 겹치지 않아야 한다.
- 검색은 현재 보기에서 보이는 학습·도움 본문에 trim한 대소문자 비구분 substring 일치만 지원하며 source 순서를 바꾸지 않는다. 결과 수와 전체 수, 명시적인 검색 지우기 동작을 제공하고 보기 전환 시 query를 초기화한다.
- 현재 cue는 해당 보기의 anchor에서 1ms로 반올림한 닫힌 시간 구간 중 가장 늦게 시작한 cue를 우선하고, 시작 시각이 같으면 더 작은 source index를 우선한다. gap에서는 어떤 cue도 현재라고 표시하지 않는다.
- 성공한 snapshot 뒤 follow를 기본 활성화한다. 사용자 scroll이나 비어 있지 않은 검색은 follow를 끄지만 현재 cue highlight는 유지하며, 검색을 지워도 자동 재개하지 않는다. 사용자는 명시적인 control로 follow를 재개하고 현재 cue가 있으면 즉시 가운데로 이동할 수 있다.
- 각 행의 본문은 pointer와 키보드 `Enter`/`Space`로 해당 장면을 seek하는 실제 action이다. 가상 목록의 결과 집합에는 roving focus와 `ArrowUp`/`ArrowDown`/`Home`/`End` 이동을 제공한다. 행별 저장은 seek와 중첩되지 않은 별도 action이어야 한다.
- `함께`와 `학습` 보기의 학습 anchor 행은 바로 카드로 저장할 수 있다. UI는 snapshot의 video/content identity, subtitle revision과 학습 source index만 보내고, content script가 현재 활성 학습 cue를 원자적으로 다시 검증한 뒤 기존 delay·도움 정렬·카드 저장 경계를 사용한다. 저장 결과는 도움 포함, 학습만 저장, 오래된 snapshot, cue 없음, 진행 중과 오류를 구분하고 기존 side panel toast로 알린다. `도움` 보기에는 저장 action을 제공하지 않는다.
- 학습 행의 저장 표시는 canonical `learningCards`에서 같은 Coupang Play video ID, 학습 언어, 정제된 학습 문장과 1ms로 반올림한 시작·종료 시각이 모두 일치하는 assigned 카드가 있는지 파생한다. 이는 자막 provenance를 완전히 증명하지 않는 best-effort 표시이며 toggle, dedupe, 저장 차단이나 삭제 control이 아니다. 성공 직후 표시하고 storage revision으로 다시 조정하되 새 provenance schema나 cue 사본을 만들지 않는다. 진행 중인 현재 cue 저장과 행별 저장은 하나의 pending lock을 공유하며, 완료 뒤 같은 문장을 다시 저장하면 기존 카드 계약대로 별도 카드가 추가된다.
- UI는 cue 본문을 Storage나 background에 복제하지 않는다. 활성 tab의 content script에서 직접 받은 일시 snapshot과 재생 시각만 사용하고, tab·SPA route·content instance·video·자막 revision 변경과 늦은 응답을 격리한다. 행 seek와 저장은 content 경계에서 snapshot identity와 자막 revision을 원자적으로 다시 검증한 뒤에만 실행한다.

#### Ordinary viewing save and multi-cue alignment

- active Listening Mission 밖의 ordinary viewing save는 현재 재생 중인 학습 cue를 anchor로 사용한다. mission Results의 combined-segment save는 위 Listening Mission 계약을 따른다.
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

- 로컬 파일 또는 명시적으로 선택한 온라인 결과로 등록한 자막, 역할 선택, delay와 cue 본문 보존을 유지한다.
- 기존 MV3 context 책임, 메시지 스키마, 저장소 중앙화와 탭 생명주기 개선은 유지한다.
- 페이지 DOM과 video 접근은 content script만 담당하고, background service worker의 메모리 지속성을 가정하지 않는다.

#### Transient Playback Context and advertisement safety

Playback Context는 현재 Coupang Play route, 논리 콘텐츠, 실제 media attachment, runtime lifecycle과 자막 source를 결합해 학습 기능이 stale media를 제어하지 않도록 하는 **transient safety contract**다. parser support, `routeKind`, runtime lifecycle과 derived learning capability는 서로 독립된 축이며 하나의 enum이나 boolean으로 합치지 않는다.

##### Route support, kind, lifecycle, and capability

- 현재 `www.coupangplay.com`의 locale/suffix-tolerant `/play/<UUID>` parser 계약을 보존한다. `/play/<UUID>`, `/en/play/<UUID>`와 UUID 뒤 suffix가 있는 현재 지원 경로를 좁히지 않는다. parser가 route UUID를 지원한다는 사실은 해당 route에서 학습 기능을 열 수 있다는 뜻이 아니다.
- transient `routeKind`는 정확히 `movie | episode | trailer | channel | highlight | unknown`이다.
- `routeKind`는 route suffix와 기존 native-subtitle playback request/response replay 경계 안의 `titleType`을 strict optional signal로 사용한다. 두 signal이 모두 인식되고 같은 kind를 가리킬 때만 그 kind를 사용한다. 하나라도 누락, malformed, 비인식 상태이거나 서로 충돌하면 title, duration, DOM copy 또는 video shape로 추측·보정하지 않고 `unknown`으로 둔다.
- runtime lifecycle은 기존 `waiting | placeholder | advertisement | content | transitioning`을 그대로 유지하며 `routeKind`와 독립적으로 변한다.
- learning capability는 current route/content identity, media attachment, learning/support source identity와 `subtitleRevision`의 일치 여부를 함께 검증하는 derived projection이다. 별도의 공개 capability enum은 이 계약에서 승인하지 않는다. evidence 문서의 `learning-ready`, `no-compatible-subtitle`, `coming-soon`, `entitlement-required`, `unsupported-kind`, `player-error`, `unknown`은 계속 비규범적 working vocabulary이며 public/message 상태 이름으로 사용하지 않는다.
- `movie | episode`만 lifecycle이 `content`이고 위 identity가 모두 현재 값으로 검증됐을 때 learning capability를 열 수 있다. `trailer | channel | highlight | unknown`은 항상 fail closed한다. `waiting | placeholder | advertisement | transitioning`인 모든 non-`content` lifecycle도 kind와 별개로 capability를 즉시 닫는다.
- background와 Side Panel은 content가 소유한 정확한 transient kind, lifecycle과 identity-bound capability 결과를 검증·중계할 수 있지만 page DOM, video 또는 page global을 직접 판정하지 않는다. 알려진 광고, placeholder, waiting과 transition을 generic `not_detected`로 축약해 capability를 다시 열어서는 안 된다.

##### Two-layer transient identity

- `contentEpoch`은 active tab 안의 검증된 논리 콘텐츠 lifetime을 나타내는 content-owned authoritative identity다. route/content identity가 바뀌거나 무효화·clear되면 새 epoch으로 advance하거나 현재 epoch을 invalidate하고, 이전 epoch에 묶인 observation, playback response, subtitle snapshot, capability decision과 command를 모두 stale 처리한다. background와 UI는 이를 새 source of truth로 재계산하지 않고 exact current value만 검증·중계한다.
- `mediaAttachmentRevision`은 같은 논리 콘텐츠 안에서 실제 video/media attachment가 detach, replace 또는 rebind되는 lifetime이다. 별도 counter를 추가하지 않고 기존 `videoRevision` spine을 이 의미의 authoritative revision으로 재사용한다. media event와 command는 current `contentEpoch`과 current `mediaAttachmentRevision`을 모두 만족해야 한다.
- Coupang Play UUID, `contentInstanceId`와 `routeChangedAt`의 기존 request-replay stale guard는 유지한다. 이 값들이 이미 계약을 만족하는 곳에서는 재사용하며 병렬 identity source를 만들거나 기존 검사를 제거하지 않는다.
- learning/support source identity와 `subtitleRevision`은 content와 media identity에 합치지 않는 별도 검증 축이다. source 또는 subtitle revision이 바뀌면 이전 cue, catalog, save, seek, repeat와 mission 작업은 현재 상태로 승격되지 않는다.
- 광고 진입만으로 `contentEpoch`을 새 논리 콘텐츠로 바꾸지 않는다. 광고 media attachment, current time, cue와 transcript를 main-content identity나 학습 데이터에 투영하지 않는다.

##### Advertisement suspend, rebind, and explicit Mission resume

- `advertisement` 진입 또는 content 여부가 모호한 전환에서는 마지막으로 검증된 transient main-content context만 freeze하고 learning/media capability를 즉시 닫는다. 진행 중인 media command, observer, cue follow, seek, repeat, current-line save와 Listening Mission playback을 취소하거나 identity-bound 상태로 안전하게 suspend한다.
- 광고의 media, time, cue, transcript는 subtitle display, mission catalog, Learning Card 또는 Listening Progress에 들어가면 안 된다. persistent setting, 저장 카드, 등록 자막과 이미 완료된 mission progress는 광고 진입 때문에 바꾸지 않는다.
- 본편 복귀는 lifecycle `content`, 같은 current `contentEpoch`, 지원되는 `routeKind`, 같은 learning/support source identity와 `subtitleRevision`, 최신 `mediaAttachmentRevision`을 모두 다시 검증한 뒤에만 rebind한다.
- 일반 overlay, current cue와 follow는 현재 본편 시점에서 자동 복구할 수 있다. 중단된 Listening Mission은 자동 재개하지 않으며 사용자의 명시적인 `광고가 끝났어요 · 계속` 계열 action 뒤에만 activity를 계속한다. 광고 자체만으로 attempt나 combo를 변경하지 않는다.
- 광고 길이에 대한 generic timeout을 두지 않는다. route/content 또는 subtitle/source identity 변경, unsupported/unknown kind 전환, 사용자 이탈, heartbeat/lease failure에서는 frozen context와 pending work를 폐기하며 새 콘텐츠나 새 media에 재사용하지 않는다.

이 경계는 새 Storage key, schema, migration, permission, host, CSP, dependency 또는 network request를 승인하지 않는다. title, year, season/episode descriptor, synopsis, artwork, watched URL, raw cue/subtitle body, request header/cookie와 runtime identity를 새로 영속 저장·로그·외부 전송하지 않는다. 비공개 discover endpoint direct fetch, 기존 native-subtitle replay 밖의 playback fetch, page main-world interception과 metadata prefetch도 승인하지 않는다. P1은 아래의 episode-only `watch_next` 학습 안전 fence로, P2는 아래의 deterministic native SDH fallback compatibility로만 제한해 승인한다. P3 content descriptor/Search prefill은 [evidence 문서의 후속 후보](./coupang-play-content-evidence.md#9-%EA%B5%AC%ED%98%84-%EA%B0%80%EB%8A%A5%EC%84%B1-%ED%9B%84%EB%B3%B4%EC%99%80-p0-%EC%8A%B9%EC%9D%B8-%EC%83%81%ED%83%9C)로 남으며 이 계약에 포함되지 않는다.

#### Episode `watch_next` learning safety fence

Episode의 optional terminal learning fence는 Play Plus가 소유한 학습 동작이 다음 화 전환 영역을 침범하지 않게 하는 transient safety projection이다. acquisition qualification의 범위와 근거는 [Coupang Play runtime evidence §14](./coupang-play-content-evidence.md#14-issue-79-p1-playback-marker-acquisition-qualification--2026-08-15)에 기록한다. `routeKind === episode`이고 lifecycle이 `content`인 current Playback Context에서만 사용할 수 있다. 일반 Coupang Play 재생은 fence를 지나 계속될 수 있으며 Play Plus는 fence를 이유로 자동 pause, 자동 seek, 자동 next episode 또는 host UI click을 하지 않는다.

##### Strict optional projection and invalidation

- observation과 consumption은 모두 current `contentEpoch`, content instance, route change, video identity, `mediaAttachmentRevision`, learning/support source identity와 `subtitleRevision`에 정확히 묶는다. 어느 값이든 drift하면 observation과 기존 fence를 즉시 폐기한다.
- `cue_points`는 배열이어야 하고 raw `duration`은 finite·nonnegative number여야 한다. Issue #79 qualification에서 확인한 raw-duration scale `0.001`을 적용한 duration과 current finite·nonnegative media duration을 모두 검증하며, 관계가 증명되지 않으면 fence를 만들지 않는다.
- raw array에서 `name === "watch_next"`인 entry는 정확히 하나여야 한다. 같은 이름의 두 번째 entry는 그 entry 자체가 malformed여도 ambiguity이므로 fence 전체를 unavailable로 만든다.
- 선택 entry는 추가·누락 field 없이 정확히 `force_stop`, `id`, `metadata`, `name`, `time`, `type` 여섯 field를 가져야 한다. `force_stop === false`, nonempty string `id`, string `metadata`, `name === "watch_next"`, `type === "CODE"`, finite·nonnegative number `time`을 만족하고, time은 normalized raw duration과 current media duration을 모두 넘지 않아야 한다.
- malformed, unknown 또는 unqualified sibling은 자체적으로 fence를 무효화하지 않으며 marker projection 실패가 기존 `text_tracks` subtitle extraction을 실패시키거나 바꾸면 안 된다.
- intro marker는 공개 기능에 사용하지 않고 strict consistency check에만 쓴다. malformed intro sibling 또는 strict intro marker 한쪽만 존재하는 경우는 fence를 무효화하지 않는다. 같은 strict `skip_intro_start` 또는 `skip_intro_end`가 복수이면 ambiguity로 fence를 무효화한다. strict intro marker와 `watch_next`의 source order가 감소하거나 strict intro time이 `watch_next` 이상이면 fence를 무효화한다. strict start/end가 각각 하나이면 `start < end < watch_next`여야 한다.
- `advertisement | waiting | placeholder | transitioning`에서는 fence를 관찰하거나 소비하지 않는다. 같은 current identity가 lifecycle `content`로 복귀한 뒤 raw evidence와 모든 identity를 다시 검증해야 한다. marker를 Storage, cache, telemetry, diagnostics 또는 background/UI relay에 보존하지 않는다.
- fence가 unavailable이면 marker timing을 추측하거나 subtitle 끝, media duration, `show_recommendations`, DOM 또는 title로 대체 terminal을 만들지 않고 기존 marker-agnostic 동작을 유지한다.

##### Learning operation boundary

- Listening Mission catalog에는 각 학습 segment의 전체 effective interval이 fence 안에서 끝나는 항목만 포함한다. fence를 가로지르는 segment를 자르거나 일부 cue만 남겨 부분 문제를 만들지 않는다.
- automatic clip, 새 line playback, `Listen again`과 `Slow 0.75×` replay는 pre-roll과 post-roll을 포함한 전체 요청 interval을 fence 안으로 제한하며 fence를 넘는 playback command를 발행하지 않는다.
- previous/next/current-line repeat와 전체 자막 행 seek는 target cue 또는 segment의 전체 effective interval이 fence 안에서 끝날 때만 실행한다. fence 뒤 현재 위치에서 사용자가 명시적으로 이전의 유효한 pre-fence 문장으로 돌아가는 동작은 허용할 수 있다.
- control affordance는 current valid target에 대해 계속 제공한다. 기존 controls-always-available 계약은 fence 밖 operation을 발행하거나 invalid target을 실행해야 한다는 뜻이 아니다.
- 마지막 pre-fence Mission을 마치면 기존 Results 상태로 이동하고 fence 뒤 항목을 대상으로 하는 `Next 10`은 제공하지 않는다.
- `Continue Watching`은 active clip, Mission media ownership과 Play Plus observer를 정리하고 현재 위치에서 original rate와 transient visibility를 복원한 뒤 host playback으로 제어권을 돌려준다. 이 handoff는 host의 다음 화 UI를 inspect·click하거나 playback 위치를 fence로 강제하는 동작이 아니다.

후속 구현에서 content script는 모든 current identity에 묶인 derived transient fence만 유지한다. raw marker response, ID, metadata, exact timing, title, content ID, full URL, request header/cookie/token 또는 viewing history를 background, UI, diagnostics, telemetry, committed evidence나 외부 network로 relay하지 않는다. normal page traffic과 기존 one-time native-subtitle playback replay만 유지하며 `chrome.storage.local/sync/session`, Web Storage, schema와 migration을 변경하지 않는다.

이 fence는 Skip Intro 버튼·UI·단축키·설정, manual/automatic intro skip, intro 구간 seek, `show_recommendations`, movie/trailer/channel/highlight/unknown marker, marker 표시, raw marker relay, persistence, cache 또는 Learning Card time/schema 변경을 승인하지 않는다. 새 request, retry, prefetch, interception, bridge, permission, host, CSP, dependency, Storage schema/migration도 추가하지 않는다. 후속 production 구현은 이 amendment가 reviewed·merged된 뒤 별도 Issue에서만 시작한다.

#### Deterministic native SDH fallback compatibility

P2 native subtitle compatibility는 exact canonical native language가 없을 때 같은 언어의 exact SDH descriptor 하나를 논리적으로 같은 native source의 fallback으로 사용할 수 있게 하는 최소 경계다. qualification의 범위와 제한된 관찰은 [Coupang Play runtime evidence §13](./coupang-play-content-evidence.md#13-issue-80-p2-native-subtitle-variant-qualification--2026-08-15)에 기록한다. 이 계약은 selector, variant catalog, 별도 source namespace 또는 provider의 일반적 SDH 지원을 승인하지 않는다.

##### Exact candidate classification and URL boundary

- canonical language `L`마다 descriptor `kind === "subtitles"`인 track만 후보로 분류한다. `srclang === L`이면 regular이고, `srclang === "<L> sdh"`이면 같은-base SDH다.
- 비교는 case-sensitive exact match이며 language와 `sdh` 사이에는 ASCII space 하나만 허용한다. trim, case folding, region folding, alias mapping과 `cc`, `captions`, label, MIME, default, descriptor metadata 또는 cue 본문 추론을 하지 않는다.
- `metadata`와 다른 non-`subtitles` descriptor는 body fetch 전에 제외한다. strict top-level playback/P0 envelope가 malformed이면 개별 후보 격리가 아니라 acquisition 전체를 fail closed한다. malformed 또는 unknown candidate field가 strict envelope 안에서 후보 단위로 격리 가능한 경우에는 그 candidate만 제외한다.
- 승인된 각 후보의 URL은 기존 `src ?? sources[0].src` 규칙으로만 결정한다. 두 번째 URL, empty direct source 보정, alternate provider, discover lookup 또는 새 playback request로 fallback하지 않는다.

##### Per-track settlement and deterministic language selection

- 승인된 각 후보는 기존 body fetch와 VTT parse를 독립적으로 수행한다. fetch, body-read 또는 parse 실패와 empty parse는 그 candidate만 unusable로 만들며, 다른 언어 또는 usable sibling을 제거하지 않는다.
- 실패한 후보를 retry하거나 두 번째 URL·provider fallback·추가 lookup으로 대체하지 않는다. 모든 후보 settlement가 끝난 뒤 canonical language별 usable candidate 집합을 임시 결과에서 선택한다.
- usable regular가 정확히 하나면 그것을 선택한다. usable regular가 둘 이상이면 array order, label, default, URL 또는 first/last precedence를 만들지 않고 그 언어 전체를 unavailable로 둔다. 이 경우 SDH로 내려가지 않는다.
- usable regular가 없고 usable SDH가 정확히 하나면 그 SDH를 fallback으로 선택한다. usable regular와 usable SDH가 모두 없거나, regular 없이 usable SDH가 둘 이상이면 그 언어를 unavailable로 둔다.

##### Atomic transient application and invalidation

- content script는 후보 fetch·parse·언어별 선택을 content-owned temporary result에서 모두 끝낸 다음 current native cue cache snapshot을 한 번에 교체한다. pending, partially settled 또는 partially selected 결과를 UI, Listening Mission, role projection이나 다른 consumer에 노출하지 않는다.
- snapshot을 수락하기 직전에 current route/video와 P0 `contentEpoch`, content instance, `mediaAttachmentRevision`, lifecycle과 source state를 다시 검증한다. `advertisement | waiting | placeholder | transitioning`, unsupported route, SPA/content drift, media attachment drift 또는 source drift에서는 결과를 적용하지 않는다.
- 선택된 physical candidate identity 또는 category가 바뀌거나 선택된 cue snapshot이 바뀌면 active subtitle-bound transcript, follow, seek, repeat, clip, save와 Listening Mission work를 모두 invalidate하고 `subtitleRevision`을 snapshot 교체와 원자적으로 advance한다. 이전 Mission response나 pending operation을 새 snapshot으로 승격하지 않는다.
- 같은 logical source에 대해 physical candidate identity, category와 cue snapshot이 모두 동일한 accepted result는 cache와 `subtitleRevision`을 churn시키지 않는다. physical identity는 content-owned transient comparison에만 사용하고 저장·중계하지 않는다.

##### Logical source, progress, and non-expansion boundary

- SDH fallback을 선택해도 logical source는 기존 `native:<language>`다. physical descriptor category를 user-visible source로 만들지 않으며 Library/source 표시와 Listening Progress namespace도 `native:<language>`를 유지한다.
- physical category 또는 track이 바뀔 때 persisted progress를 migrate하거나 delete하지 않는다. active subtitle-bound work만 `subtitleRevision`으로 invalidate하고 current catalog와 segment identity에서 다시 시작한다.
- variant selector·label UI, persisted preference, variant role, variant-aware `ListeningSourceKey`/progress, catalog 또는 fingerprint를 추가하지 않는다. 이후 이런 구분이 필요하면 별도 canonical amendment를 먼저 승인한다.
- 실제 표본은 accessibility-like track을 `OBSERVED ONCE`로만 확인했다. same-base regular+SDH coexistence, case/region variation과 fallback-only URL shape는 `NOT OBSERVED WITHIN SAMPLE`이다. fixture와 qualification은 deterministic feasibility이지 provider 지원·분포 또는 production 동작의 증명이 아니다.
- `cc`, `captions`, forced, commentary, metadata와 다른 descriptor, label/MIME/default/order/URL/cue-text inference, track merge·dedupe·content precedence, retry·alternate URL·provider lookup과 raw variant persistence는 승인하지 않는다. P1 runtime 또는 P3 범위도 이 계약에 포함하지 않는다.
- raw playback/provider descriptor, URL, header, cookie, token, cue body/count/timing, title, content/account/profile 또는 viewing history를 Storage, Web Storage, log, telemetry, diagnostics나 committed evidence에 기록하지 않는다. 새 message, permission, host, CSP, dependency, schema, migration 또는 local/sync/session Storage key를 추가하지 않고 native source/progress schema와 version을 유지한다.
- network는 normal page traffic, 기존 one-time native-subtitle playback replay와 그 replay가 이미 승인한 candidate body GET만 사용한다. 새 replay, discover, retry, prefetch, proxy, interception 또는 external service를 추가하지 않는다.

후속 production 구현은 이 amendment가 reviewed·merged된 뒤 별도 P2 Issue에서만 시작한다. 구현은 P0/SPA/advertisement identity 경계를 약화하지 않고 위 exact classifier, per-track settlement, deterministic fail-closed selection, atomic cache replacement와 source/progress 비확대를 함께 증명해야 한다.

#### Explicit OpenSubtitles acquisition

OpenSubtitles 검색·다운로드 capability는 초기 Play Plus 2.0에 포함해야 한다. 다만 온라인 사용과 선택적 권한은 사용자 선택이며, Coupang Play 자막과 로컬 파일을 사용하는 핵심 흐름의 전제 조건이 아니다.

- 온라인 화면을 열거나 검색어·필터를 입력·수정하는 것만으로 외부 요청을 보내지 않는다. 사용자가 `검색`을 명시적으로 실행한 뒤에만 요청한다.
- 첫 검색 동작에서는 pre-implementation qualification으로 증명하고 구현 Issue에 기록한 API base와 download origin 각각의 exact optional permission만 한 번에 요청한다. wildcard, 추정 host 또는 아직 반환되지 않은 후보를 미리 허용하지 않는다. 권한을 거부하거나 취소하면 외부 요청을 보내지 않고 로컬 파일과 플랫폼 자막 흐름을 계속 사용할 수 있어야 한다.
- 검색 요청에는 사용자가 입력한 제목 또는 query, 언어, 선택한 유형·연도·시즌·회차와 page만 보낼 수 있다. 시청 URL, Coupang Play video ID, 재생 시각, 카드·cue·등록 자막 본문을 전송하거나 자동으로 영상 metadata를 수집해 채우지 않는다.
- 모든 provider 요청은 background service worker가 typed message 경계 뒤에서 수행한다. 검색 결과는 접근 가능한 목록과 명시적 pagination으로 보여 주며, 선택하지 않은 결과를 다운로드하지 않는다.
- 사용자가 `추가`를 실행한 하나의 file-level `file_id`만 다운로드한다. HTTPS API 응답과 반환된 임시 `/download/` URL의 origin·path·credential·redirect, 실제 byte 크기, decode, parse와 non-empty cue를 엄격히 검증하고 실패 시 부분 등록을 남기지 않는다. 요청은 redirect를 자동 추적하지 않으며, Play Plus용으로 등록한 Consumer로 direct search와 download가 이 조건에서 성공한다는 증거가 나오기 전에는 구현 Issue를 시작하지 않는다.
- 성공한 자막은 기존 strict 등록 경계인 `registeredSubtitles`와 `subtitle-<uuid>`에 일반 로컬 v2 자막과 같은 형태로 저장한다. 추가 직후 학습/도움 역할을 자동 지정하거나 기존 역할 선택을 덮어쓰지 않는다.
- 검색 입력·결과 metadata·임시 URL·quota 정보는 영속화하지 않는다. same-session cache는 선택한 파일의 재다운로드를 줄이는 최소 필드만 보관하고 수치로 고정한 entry·byte·TTL 상한에서 eviction하며, provider 오류 본문이나 credential을 로그·진단·사용자 메시지에 노출하지 않는다.
- 사용자 계정·JWT, Play Plus backend/proxy, BYOK, 자동 검색·추천·역할 적용과 provider provenance 영속 schema는 승인 범위가 아니다. 로그인/JWT는 OpenSubtitles가 quota 사용을 위해 권장하지만 초기 무료 확장의 출시 조건은 아니다. 새 host, redirect 허용, 로그인/JWT 또는 추가 영속 데이터가 필요하면 구현을 멈추고 새 승인을 받는다.

2026-08-07 provider qualification의 공개 기준은 [canonical OpenSubtitles.com REST API documentation](https://opensubtitles.stoplight.io/docs/opensubtitles-api), [공식 Getting Started](https://opensubtitles.tawk.help/article/getting-started), [공식 Pro Packages 안내](https://opensubtitles.tawk.help/article/pro-packages)와 [legacy OpenSubtitles.org API 종료 공지](https://forum.opensubtitles.com/t/opensubtitles-org-api-final-shutdown-notice-for-non-vip-users/5045)다. 여기에 사용자가 2026-08-13 제공한 `support@opensubtitles.org`의 2026-07-25 답변과, 현재 로컬 key가 사용자 자신의 OpenSubtitles 계정에 Play Plus용으로 등록한 Consumer key라는 사용자 확인을 production qualification 근거로 추가한다. 실제 key 값과 메일 원문은 source, fixture, log 또는 committed evidence에 기록하지 않는다.

- 구현 대상은 OpenSubtitles.com REST API와 사용자 계정에 등록한 Play Plus Consumer/application 경로이며 legacy XML-RPC가 아니다. 별도의 사전 승인 절차는 필요하지 않다.
- 무료이고 유료 기능이 없는 현재 확장에는 standard free API Consumer를 사용할 수 있다. 로그인하지 않은 최종 사용자의 다운로드 한도는 현재 사용자당 하루 5회이며, 사용량이 크게 늘거나 이후 수익화하면 적절한 tier를 OpenSubtitles와 다시 협의한다. 이 계약은 구매, subscription 변경, 유료 기능 또는 자체 quota 시스템을 승인하지 않는다.
- API key는 앱을 식별하는 public client 값으로 확장 package에 포함할 수 있다. 제3자 남용 시 OpenSubtitles가 rotate, throttle 또는 block할 수 있으므로 실제 값은 build 환경에서만 주입하고 source, fixture, log와 evidence에 commit하지 않는다. 장기적으로 더 견고할 수 있는 server-side proxy는 초기 출시 조건이 아니며 현재 범위에도 포함하지 않는다.
- OpenSubtitles는 확장 UI와 Chrome Web Store listing에 `OpenSubtitles.com`을 자막 source로 표시하고 `https://www.opensubtitles.com/` 링크를 제공할 것을 요구한다.
- 공식 Getting Started는 HTTP redirect 처리를 권고하지만 현재 승인 범위는 blind redirect나 미확정 host를 허용하지 않는다. 등록된 Play Plus Consumer로 redirect를 자동 추적하지 않는 direct search와 download가 작동하는지 production qualification에서 증명한다. 작동하지 않으면 구현을 시작하지 않고 인간 결정을 다시 받는다.
- 문서와 공식 forum의 [`www.opensubtitles.com` download 운영 사례](https://forum.opensubtitles.com/t/download-rate-limit/6415), [`dl.opensubtitles.com` download 운영 사례](https://forum.opensubtitles.com/t/cant-download/3043)에는 `api.opensubtitles.com`, `vip-api.opensubtitles.com`, `www.opensubtitles.com`과 `dl.opensubtitles.com`이 API base 또는 생성 download link 후보로 나타난다. 후보를 모두 권한에 넣지 말고 등록된 Consumer의 실제 login-free search와 `/download`에서 필요한 전체 origin 집합을 식별한 뒤 각각 exact origin으로 고정한다. 집합이 안정적으로 증명되지 않으면 구현을 시작하지 않는다.
- production gate는 위 Consumer 소유·무료 plan·anonymous quota·public key·attribution 조건, exact origin 집합과 로그인/JWT 없는 실제 direct search/download를 함께 확인한다. Provider가 이 조건을 변경하거나 새 host, redirect, confidential credential, login/JWT 또는 proxy를 요구하면 현재 gate를 재사용하지 않고 인간 결정을 다시 받는다.

### 5.2 확정 — 2.0에서 제거

- 독립된 자막 분석 top-level 화면과 단어 빈도·통계 기능
- 학습 프리셋과 preset storage/module/UI
- 시간 단위·자막 단위 스킵을 중복 구성하는 `videoSkip`/`subVideoSkip` 모델
- 사용자가 시작·끝을 정하는 수동 A/B 루프와 일반 루프 설정
- primary/secondary별 저장·복사·표시 단축키
- 이전/다음/반복을 개별적으로 숨기거나 막는 `learningControls` enabled 모델
- 과거 LearningCard/Review용 `new | learning | mastered` 복습 상태와 이를 전제로 한 필터·문구·세션 override. 이는 §3.5 Listening Progress의 별도 `attempted | cleared | mastered` best-evidence state를 제거한다는 뜻이 아니다.
- 하이라이트, 추천, broad dashboard, Listening Mission 밖의 범용 퀴즈, 공유와 밝기 조절 같은 범용 확장 기능. Learning의 exact current-source progress summary는 broad dashboard가 아니다.

제거는 UI를 숨기는 것으로 끝나지 않는다. 정상 schema, 기본값, store, message, content/background handler, locale, 테스트와 죽은 코드까지 제거한다. 단, v1.11 입력을 읽는 데 필요한 최소 decoder는 migration 모듈 안에만 남긴다.

### 5.3 확정 — 백업 계약 없음

Play Plus 2.0에는 내보내기, 가져오기 또는 backup 파일 형식을 만들지 않는다.

- 현재 `main`의 미배포 backup v1 모듈, UI, locale, 테스트, parser와 rollback 코드는 제거한다.
- backup v1 문서를 읽거나 호환하는 migration/import 경로를 만들지 않는다.
- “저장한 카드만 내보내기”도 2.0 계약에 포함하지 않는다.
- 계정, 동기화, 복구, export/import와 유료 기능은 향후 별도 제품 결정이다. 지금 파일 형식을 미리 예약하거나 숨은 API를 만들지 않는다.

### 5.4 확정 — 초기 2.0에서 연기

- 자동 번역
- SRS, 오늘의 복습, 일정, chronological 학습 이력, historical 정답률, streak와 알림. §3.5의 factual Listening Progress는 이 연기 항목이 아니다.
- 계정, 장치 간 동기화, 결제와 유료 등급
- 영상 제목 자동 수집·표시, 영상별 그룹과 검색
- 자동 언어 감지와 일괄 역할 지정
- 등록 자막 repair/cleanup
- 고급 문장 pair 교정과 자동 재정렬

`연기`는 2.0 내부에 비활성 코드나 미래용 schema를 미리 넣는다는 뜻이 아니다. 실제 사용자 신호와 별도 승인 전까지 코드, 권한, 저장 필드와 공개 문구를 추가하지 않는다.

## 6. UX Contract

- 제품 용어는 `학습 자막/문장`과 `도움 자막/문장`을 사용한다. 정상 v2 UI에서 `메인/서브`, `primary/secondary`를 사용자 역할명으로 노출하지 않는다.
- Listening Mission에서도 사용자는 연습 단위를 `문장` 또는 `line`으로만 본다. internal `practice segment`, source index와 hash identity를 UI jargon으로 노출하지 않는다.
- Learning idle 화면은 Listening Mission entry와 exact current video/source progress를 기존 settings 앞에 보여 준다. no video, stable video identity unavailable, no learning track, no eligible segment, first use, existing progress, loading과 recoverable error를 사실대로 구분한다.
- mission entry는 `Continue`와 `Start from current position`, current catalog 기준 cleared/mastered 수, 최근 practice와 best combo를 제공한다. aligned support가 있을 때만 support availability를 말하고 Coupang Play caption이 보이면 사용자가 끄도록 안내하되 자동 감지·조작을 주장하지 않는다.
- active mission은 기존 네 destination의 Header를 유지하되 one navigation token으로 destination 이동을 잠그고, idle Learning settings 대신 하나의 mission scroll owner만 보여 준다. 명시적 Exit는 항상 접근 가능해야 하며 terminal cleanup 뒤 exact token을 해제한다.
- active line은 round와 `current / total`, positive combo, non-color-only state, listen instruction, `Listen again`, `Slow 0.75×`, real multiline answer field, Submit, next Hint, Later, feedback/status, correct/Reveal 뒤 answer/support와 explicit Next를 제공한다.
- Enter는 submit, Shift+Enter는 line break이며 IME composition 중 Enter는 submit하지 않는다. non-exact draft는 transient memory에서 수정 가능하게 유지하고 new line의 successful automatic playback 뒤 answer field에 focus한다.
- hint와 judgment, playback, progress error, unsaved warning, stale/fatal state와 difficult-save result는 screen reader에 사실대로 announce한다. correct/Reveal은 자동 advance하지 않고 phase, dialog와 error 뒤 안정된 focus target을 제공한다.
- first-round summary는 first-submission exact 수, retry candidate 수와 best combo를 보여 주고 optional one retry와 `View results now`를 제공한다. Results는 1–3 stars, optional Perfect, cleared/total, first-submission exact, retry outcome, best combo와 progress-save state만 보여 주며 history, streak, daily total, rank와 share를 만들지 않는다.
- difficult candidate checkbox는 모두 처음에 선택되지 않는다. selected-only save, no-selection no-op, retryable partial failure와 terminal partial failure를 구분하고 이미 저장한 성공을 잃었다고 표시하지 않는다.
- progress write failure 뒤 primary `Retry saving progress`와 secondary `Exit without saving this progress`를 정확한 순서로 제공한다. discard는 이번 unsaved progress만 잃고 이전 persisted progress는 남는다는 문구, mid-mission `restore-start`와 Results `complete-stay`를 사용한다.
- `Clear current video progress`와 `Clear all listening progress`는 서로 다른 confirmation과 focus recovery를 사용하며 실패 시 data를 지웠다고 표시하지 않는다.
- 320, 360, 390 CSS px에서 active mission은 horizontal overflow, overlap, clipped focus ring 또는 nested idle-settings scroll이 없어야 한다. Chrome이 실제로 제공하지 않는 320px는 deterministic fixture로 검증하고 실제 Chrome에서는 browser constraint를 기록한다. long English, Korean과 no-space text가 primary action을 막지 않아야 한다.
- 첫 2.0 진입은 학습 언어와 도움 언어 확인에 집중한다. v1 카드를 모두 고치도록 강제하지 않는다.
- 미분류 이전 카드는 “언어/역할 지정 필요”처럼 사실만 말한다. 자동 감지했다고 주장하지 않는다.
- 도움 문장이 정렬되지 않아 저장되지 않은 경우에도 학습 문장은 저장되며, 실패가 아니라 도움 문장 생략으로 이해할 수 있어야 한다.
- 데이터 오류나 마이그레이션 실패는 재시도 가능한 상태로 알린다. “모두 복구됐다” 또는 “백업됐다”처럼 구현하지 않은 보장을 하지 않는다.
- 자막 외형 설정은 고급 영역에 둘 수 있지만 찾을 수 있어야 하며, 접근성 있는 label과 현재 값을 제공한다.
- 자막 추가 화면은 로컬 파일과 온라인 검색 source를 명확히 구분하고 각 draft를 보존한다. 검색 전에 OpenSubtitles로 전송할 필드와 선택적 권한을 알리며, 권한 거부·검색 실패·quota 제한 뒤에도 로컬 파일 추가 경로를 유지한다.
- 온라인 결과는 사용자가 파일을 선택하고 `추가`를 실행해야 등록된다. 등록 성공과 학습/도움 역할 적용을 같은 동작으로 오해하게 만들지 않는다.
- `Subtitles`의 `자막 추가 | 전체 자막` subview는 언제나 발견 가능해야 하며 navigation lock 중에는 전환하지 않는다. 활성 `전체 자막`은 현재 학습/도움 source의 정체와 기존 관리 영역으로 가는 `변경`만 노출하고, 임의 source 선택기나 분석 용어를 만들지 않는다. 등록 자막 카드의 `자막 확인`은 역할을 바꾸지 않는 별도 읽기 전용 target으로 같은 surface에서 열고 활성 전체 보기의 control을 노출하지 않는다.
- 전체 자막은 `함께`를 기본으로 하고 짧은 전용 문구의 `함께 | 학습 | 도움` segmented control을 제공한다. 행은 학습 한 줄과 도움 한 줄을 우선하는 고밀도 divider 형태로 구성하고 반복 역할 label과 별도 metadata 행을 두지 않는다. compact 시작 timestamp는 항상 보이며, 종료 시각과 잘린 전체 문장은 hover·focus·touch disclosure에서 동등하게 확인할 수 있다. 현재 문장, follow 상태와 재개 action은 색상에만 의존하지 않고 행 seek·저장과 목록 이동은 pointer와 키보드에서 모두 작동해야 한다.
- 행 저장 결과는 목록 높이를 바꾸는 inline 문구가 아니라 기존 side panel toast로 제공한다. 기존 카드에서 파생한 저장 표시는 `저장된 카드 있음 · 다시 저장` 의미이며 사용자가 같은 문장을 다시 별도 카드로 저장하는 동작을 막지 않는다.
- 좁은 panel에서 중복 제목을 시각적으로 반복하지 않는다. 새로고침·검색 지우기·행 저장처럼 의미가 보편적인 보조 action은 접근 가능한 이름과 tooltip을 가진 icon control로 압축할 수 있지만, 보기·역할·source 변경과 follow처럼 icon만으로 뜻이 불명확한 control은 텍스트를 유지한다.

## 7. Privacy and Permissions

- 학습 카드와 등록 자막은 사용자의 브라우저에 로컬로 저장한다.
- Listening Mission의 segmenting, answer comparison, hint, score와 transient session state는 모두 로컬에서 처리한다.
- raw cue array, catalog body, immutable mission snapshot, 아직 저장하지 않은 segment text와 typed answer는 active tab의 direct UI-content transient boundary에만 존재한다. background message, tab store, `listeningProgress`, 추가 Storage, network, telemetry, diagnostics, log, error, URL, DOM attribute 또는 committed evidence payload로 보내거나 복제하지 않는다.
- typed answer text는 current component/reducer memory와 input/draft-update/submit action 안에서 judgment에 필요한 동안만 존재한다. external/serialized/controller/message/storage payload와 chronological attempt history에는 포함하지 않는다.
- sole text-bearing 예외는 사용자가 Results에서 명시적으로 선택한 segment다. content가 current session/source/revision을 다시 검증해 canonical `LearningCard`로 변환한 뒤에만 기존 validated card-storage message와 `chrome.storage.local`의 `learningCards` path를 사용할 수 있다. 이 예외는 raw cue/catalog relay, mission snapshot persistence 또는 typed-answer 전송을 허용하지 않는다.
- `listeningProgress`는 §3.5의 numeric/state/timestamp identity facts만 저장한다. full watched URL, subtitle/support text, answer draft, history, star와 per-attempt text는 허용하지 않는다.
- 2.0 핵심 흐름은 계정과 외부 자막 공급자 없이 작동해야 한다. OpenSubtitles는 사용자가 명시적으로 검색·추가할 때만 사용하는 승인된 예외다.
- 원격 번역, 외부 분석, telemetry, BYOK와 클라우드 저장을 추가하지 않는다.
- 전체 자막 snapshot과 현재 재생 시각은 활성 tab의 UI-content 직접 메시지에서만 일시적으로 사용한다. 등록 자막 읽기 전용 확인은 이미 canonical 로컬 저장소에 있는 해당 cue 본문을 UI에서 strict하게 읽을 뿐 새 사본을 만들지 않는다. cue 본문을 background, 추가 Storage, network, telemetry 또는 진단 로그로 복제하지 않는다.
- 필수 host access는 Coupang Play로 제한한다. OpenSubtitles에는 pre-implementation qualification으로 증명한 API base와 download origin 각각만 exact optional permission으로 선언하고 첫 명시적 검색에서 요청한다. 후보 host 전체나 wildcard를 선언하지 않는다.
- OpenSubtitles에는 사용자가 제출한 제목/query, 언어, 선택 필터와 page만 전송한다. query, 결과 metadata, `file_id`, quota, 임시 URL과 다운로드 원문은 provider-specific persistent storage에 남기지 않고, 성공적으로 등록한 자막 metadata와 cue만 기존 로컬 저장소에 보존한다.
- build-time Consumer key와 app/version `User-Agent`는 사용자 계정에 등록한 Play Plus application 식별자로 모든 API 요청에 사용한다. key는 confidential credential이나 최종 사용자 credential로 주장하지 않으며 실제 값은 source, fixture, log와 committed evidence에 넣지 않고 build 환경에서만 주입한다. Provider가 confidential secret을 요구하게 되면 현재 범위를 중단한다.
- migration/mission 오류 log, 테스트 fixture와 진단 정보에 실제 사용자의 자막 본문, 전체 시청 URL, 등록 자막 본문, typed answer 또는 unsaved mission text를 기록하지 않는다.
- 위에서 승인한 범위를 벗어나는 새 host, redirect, 전송 필드, 계정·JWT, proxy 또는 개인정보 계약은 별도 ChatGPT 검토와 사용자 승인을 받는다.
- Listening Mission은 새 Chrome permission, host, CSP, network request, external service, microphone, speech recognition, AI/semantic evaluation, telemetry, account, sync 또는 payment를 추가하지 않는다.
- Playback Context의 `routeKind`, lifecycle, capability, `contentEpoch`과 `mediaAttachmentRevision`은 active tab의 승인된 transient message boundary 안에서만 사용한다. Storage, Web Storage, telemetry, diagnostics 또는 외부 network에 기록하지 않으며 광고 media/time/cue/text를 main-content subtitle, card 또는 progress로 투영하지 않는다.

## 8. Implementation Program

2.0은 하나의 거대한 변경으로 만들지 않는다. 각 단계는 최신 `main`에서 Issue 계약과 작업 브랜치를 만들고, 검증 가능한 vertical slice로 Pull Request를 제출한다. 순서는 다음을 기본으로 한다.

1. **Data contract and migration fixtures**: 실제 v1.11 fixture, v2 schema, deterministic ID, 실패 주입 테스트와 readiness gate.
2. **Learning profile and subtitle display**: 역할 명칭, 언어 확인, 외형 값 보존과 UI 정보 구조.
3. **Learning playback and save**: 핵심 단축키, 현재 cue anchor, multi-cue 도움 문장 정렬과 one-action save.
4. **Library and card editing**: canonical 카드 목록, 상태·역할 필터와 제한된 편집.
5. **Focused Review**: 도움 문장 공개, 상태 전환, video link, pending lock와 접근성.
6. **Scope cleanup**: backup, 독립 분석 화면과 통계, preset, 구 상태 모델, 제거된 재생 설정과 관련 locale·테스트 삭제.
7. **OpenSubtitles acquisition**: 명시적 검색·선택·등록, exact optional permission, background network, session-only cache, provider qualification과 개인정보 proof.
8. **Current subtitle overview restoration**: 현재 학습·도움 역할의 원자적 일시 cue snapshot, 함께/역할별 가상 목록, 검색, follow, 키보드 seek, 학습 행 직접 저장과 stale identity 격리.
9. **Legacy audit and baseline validation**: v1 정상 경로 참조 제거 증명과 기존 2.0 baseline의 자동 검증·실제 Chrome upgrade/fresh-install/provider smoke.

Listening Mission executable work는 이 canonical amendment가 reviewed·merged된 뒤에만 시작한다. 위 baseline program 뒤에 다음 네 slice를 순서대로 수행하며, 각 slice는 직전 merge를 포함한 latest `main`에서 시작한다.

10. **Listening Mission domain and progress foundation**: deterministic segment/source identity, answer·hint·result pure rules, strict progress schema, storage API와 fresh/v1.11 initialization.
11. **Isolated Listening Mission session UI**: immutable 1–10 segment reducer, transient typed draft, injected controller union, retry·Results·failure escape와 narrow Side Panel accessibility를 production에서 unmounted 상태로 검증.
12. **Active-video Listening Mission integration**: direct UI-content catalog/session, content-owned playback·restore·lease, Learning entry/progress, background progress API와 explicit canonical Library save를 연결.
13. **Listening Mission latest-main certification**: combined automated, privacy/permission/storage/migration audit와 actual Chrome mission·failure-discard·restoration·lease·Side Panel regression을 evidence로 기록.
14. **Transient Playback Context and advertisement safety**: 이 canonical amendment가 reviewed·merged된 뒤에만 별도 P0 implementation Issue에서 route kind, lifecycle, two-layer identity, fail-closed capability와 광고 suspend/rebind/explicit Mission resume를 구현하고 exact-head 자동화와 actual Chrome으로 검증한다.
15. **Episode `watch_next` learning safety fence**: 이 canonical amendment가 reviewed·merged된 뒤에만 별도 P1 implementation Issue에서 strict optional marker projection을 current P0 identity에 결합하고 Mission catalog/clip/replay, learning seek/repeat, Results/`Next 10`과 explicit `Continue Watching` 경계를 구현한다. production code는 이 문서 변경에 포함하지 않는다.
16. **Deterministic native SDH fallback compatibility**: 이 canonical amendment가 reviewed·merged된 뒤에만 별도 P2 implementation Issue에서 exact regular/`<L> sdh` 후보 분류, per-track settlement, regular-first duplicate fail-closed selection, atomic cache replacement와 기존 `native:<language>` source/progress 경계를 구현한다. production code는 이 문서 변경에 포함하지 않는다.

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
- v1.11의 저장, 자막 단위 이전/다음, 현재 문장 반복 단축키 후보와 활성 의도가 하나의 v2 `shortcuts` master와 바인딩으로 결정론적으로 이전되고, 첫 진입에서 거부한 후보는 빈 바인딩으로 남는다.
- 유효한 등록 자막 metadata와 cue body가 byte-for-byte 또는 구조적으로 동등하게 보존된다.
- 변환, 쓰기, 재읽기, 표식과 정리 각 단계의 실패를 주입해 원본 비삭제, 무표식, 재시도와 오류 UI를 증명한다.
- 손상된 등록 자막 한 항목이 정상 카드와 다른 등록 자막의 이전을 막지 않고 격리된다.
- fresh install은 v1 키 없이 canonical v2 데이터와 strict empty `listeningProgress` version 1을 만든다.
- actual v1.11 migration은 empty Listening Progress를 다른 required v2 key와 함께 쓰고 strict readback한 뒤에만 `dataSchemaVersion: 2`를 완료한다. 기존 public data 보존·cleanup 순서·실패 재시도 계약은 바뀌지 않는다.
- missing/invalid progress, progress write/readback과 marker/cleanup failure injection이 fail closed·restart-safe하고 interim unreleased v2 missing-key fallback이 없음을 증명한다.

### 9.2 No-runtime-legacy proof

- v1.11 decoder와 migration fixture 외에는 v1 key, v1 type, v1 status 또는 v1 fallback 참조가 없다.
- 정상 UI/content/background가 `savedSubtitles`, `primarySubtitle`, `secondarySubtitle`, `videoSkip`, `subVideoSkip` 또는 구 `loop`를 읽거나 쓰지 않는다.
- 미배포 backup v1과 과거 LearningCard/Review용 `new | learning | mastered` status 호환 분기가 없다. Listening Progress의 별도 best-evidence state `attempted | cleared | mastered`는 §3.5 계약이다.
- 제거한 feature의 route, UI, controller/store, schema/default, message handler, locale, test와 Chrome permission이 남지 않는다.
- 정상 v2 schema, default, storage API, Settings, First Entry, content controller와 runtime에 `learningControls` 키나 개별 enabled 분기가 남지 않는다.
- migration 완료 뒤 정리 대상 v1 키가 사라지고, 정리가 중단돼도 다음 시작에서 안전하게 끝난다.
- interim v2 missing-progress fallback, persisted typed answer/draft/history/raw catalog/mission snapshot 또는 deferred Listening feature용 dormant schema·route·permission이 없다.

### 9.3 Product proof

- 학습/도움 언어 확인 → 시청 → 한 번 저장 → Library 확인/수정 → 집중 Review → 영상 복귀의 전체 흐름이 작동한다.
- 이전·다음·반복 control과 직접 명령은 Shortcuts master 상태와 관계없이 항상 제공되고, master는 저장·이전·다음·반복의 비어 있지 않은 키보드 바인딩만 제어한다. active Listening Mission의 content media ownership 동안만 persistent setting 변경 없이 Play Plus overlay와 on-video Controller를 transiently suppress한다. 저장된 raw code와 사용자 표시 label은 구분되며 예약·중복 키 오류는 충돌 대상을 포함해 접근 가능하게 설명된다.
- 도움 자막이 한 cue 및 여러 연속 cue일 때 올바르게 pair되고, 낮은 신뢰도에서는 학습 문장만 저장된다.
- `unassigned`는 Library에 남고 Review에서 제외되며 사용자가 정상 카드로 바꿀 수 있다.
- `active`와 `completed`만으로 Review와 Library 동작이 일관된다.
- 명시적 `검색` 전에는 OpenSubtitles 요청이나 선택적 권한 prompt가 발생하지 않고, 권한 거부·취소·회수와 provider 실패가 플랫폼/로컬 자막 또는 기존 로컬 데이터에 영향을 주지 않는다.
- 사용자 계정에 등록한 Play Plus Consumer에서 redirect 자동 추적 없이 동작하는 전체 API/download origin 집합을 증명해 각각 exact permission으로 고정하며, wildcard와 미확정 후보 host가 없다.
- 사용자가 제출한 필드만 검색에 사용하고, 명시적으로 선택한 하나의 결과만 다운로드해 strict 등록 경계로 저장한다. 등록 뒤에도 학습/도움 역할을 자동 적용하지 않는다.
- 검색 입력, 결과 metadata, 임시 URL과 provider download cache가 영속 저장되지 않으며, session cache의 entry·byte·TTL 상한과 eviction이 지켜진다. 사용자 소유의 등록된 Play Plus Consumer, 무료 확장 plan, anonymous 사용자당 하루 5회 한도, public package key와 UI/Store attribution 조건이 확인되고 로그인/JWT 없는 실제 동작이 증명된다.
- 현재 선택한 native 또는 등록 학습·도움 source의 전체 cue가 delay를 정확히 한 번 적용한 source 순서로 표시되고, source 정체와 기존 관리 영역으로 가는 변경 동작이 사실대로 작동한다.
- 기본 `함께` 보기에서 저장과 같은 결정론적 alignment로 도움 문장이 학습 cue에 대응되고, 매칭되지 않은 학습 cue와 `학습`/`도움` 전체 보기가 손실 없이 작동한다. 검색·현재 cue highlight·follow 재개·pointer/keyboard seek가 각 보기에서 작동한다.
- `함께`와 `학습` 행 저장은 seek 없이 정확한 학습 source index를 다시 검증해 기존 카드 builder와 저장소를 사용한다. 도움 포함/학습만 저장 결과, stale·cue 없음·pending·오류가 구분되고, 현재 cue 저장과 중복 요청 lock을 공유하며 완료 뒤 반복 저장은 별도 카드가 된다.
- 전체 자막 행은 좁은 panel에서 학습 한 줄과 도움 한 줄을 우선하는 고밀도 divider 목록이며, 시작 시각은 상시 보이고 종료 시각과 잘린 전체 문장은 hover·focus·touch에서 확인된다. 저장 결과 toast는 목록을 밀지 않고, 기존 카드와 일치하는 학습 행 표시는 반복 저장을 막지 않으며 카드 추가·수정·삭제 뒤 다시 조정된다.
- 등록 자막은 학습·도움 역할이나 현재 영상 연결 없이도 `자막 확인`에서 제목·언어·delay와 전체 cue를 검색·탐색할 수 있다. 이 읽기 전용 화면은 active overview의 역할 보기, current/follow, seek와 저장 의미를 가장하지 않는다.
- 수천 cue와 여러 줄·다국어 문장에서 가상 목록이 하나의 scroll owner를 유지하고 검색 전후에도 행이 겹치지 않으며, 늦은 native cue 도착과 tab·SPA route·content instance·video·자막 revision 변경이 자동 반영되고 이전 snapshot이 새 영상을 노출·제어·저장하지 않는다.
- 전체 자막 snapshot과 재생 시각은 영속 저장·background relay·외부 전송·본문 logging 없이 활성 tab에서만 일시적으로 사용된다.
- Learning은 정확히 네 destination 안에서 current video/source의 Listening Mission entry와 factual progress를 제공하고, current position 또는 Continue부터 source 순서의 최대 10 segment를 선택하며 마지막 mission은 더 짧을 수 있다.
- wrapper cleanup, separator, greedy grouping, no-split/omission, timing/grapheme boundary와 versioned identity가 §5.1과 일치하고 delay/support 변화만으로 progress key가 바뀌지 않는다.
- multilingual answer normalization, exact/almost threshold, draft-independent Shape/First-graphemes mask, support skip와 Reveal이 deterministic하고 typed draft에서 expected token을 추론하지 않는다.
- first round, optional one retry, combo, 1–3 stars, Perfect와 difficult candidates가 계약과 일치한다. `Later`/Reveal-only visit은 `totalAttempts: 0`을 기록할 수 있고 retry clear는 mastered를 소급하지 않는다.
- mission은 exact current video state를 capture하고 Play Plus overlay/controller만 transiently suppress한다. 1.0×/0.75× clip, pre/post-roll cap, 모든 end mode, 5초 heartbeat/15초 lease와 route/video/source/revision invalidation이 old text나 media command를 새 video에 적용하지 않고 정상·emergency cleanup을 수행한다.
- locale/suffix-tolerant route parser 지원을 좁히지 않으면서 parser support와 learning eligibility를 분리한다. exact `routeKind`, lifecycle, `contentEpoch`, 기존 `videoRevision` 기반 media attachment revision과 subtitle/source identity가 독립적으로 검증되고, supported `movie | episode`의 current `content` attachment에서만 learning capability가 열린다.
- 광고와 모호한 전환에서는 capability와 identity-bound 작업이 즉시 suspend되고 광고 media/time/cue/text가 자막·카드·mission·progress에 섞이지 않는다. 같은 콘텐츠 복귀는 최신 attachment에 rebind하며 일반 cue/follow만 자동 복구할 수 있고 Listening Mission은 명시적 post-ad resume를 요구한다. generic ad timeout을 두지 않으며 identity 변경·unsupported kind·이탈·lease failure에서는 frozen state를 폐기한다.
- episode/content-only `watch_next` fence는 strict uniqueness/shape/type/unit/range와 intro consistency를 모두 만족한 current P0 identity에서만 transiently 존재한다. malformed·unknown sibling과 marker projection failure는 native subtitle extraction을 바꾸지 않고 missing·ambiguous·stale·advertisement evidence는 marker-agnostic fallback으로 fail closed한다.
- Mission catalog는 전체 effective interval이 fence 안에서 끝나는 segment만 포함하고 crossing segment를 자르지 않는다. clip/replay와 learning seek/repeat는 전체 interval이 fence 안인 target만 실행하며 마지막 pre-fence Results 뒤 fence 밖 `Next 10`을 만들지 않는다. explicit `Continue Watching`은 Play Plus ownership을 정리해 host playback에 제어권을 돌려주되 일반 playback을 자동 pause/seek/next/click하지 않는다.
- native subtitle candidate는 exact `kind === "subtitles"`와 case-sensitive `L` 또는 `<L> sdh`만 사용한다. 각 body fetch·read·parse와 non-empty 결과를 독립적으로 settle한 뒤 language별 exactly-one regular를 우선하고, regular가 없을 때 exactly-one SDH만 같은 `native:<language>` fallback으로 선택한다. regular 또는 SDH duplicate는 order/default/label 추론 없이 그 언어를 unavailable로 만들며 regular duplicate에서 SDH로 내려가지 않는다.
- native cue cache는 P0/SPA/advertisement/source identity를 acceptance 직전에 재검증한 complete temporary result로 한 번에 교체한다. physical category 또는 cue snapshot 변화는 subtitle-bound work와 `subtitleRevision`을 원자적으로 invalidate하고, identical accepted snapshot은 revision churn을 만들지 않는다. variant source, preference, progress namespace, Storage/schema 또는 새 network path는 없다.
- progress는 exact namespace와 monotonic state만 저장하고 current catalog에서 denominator를 계산한다. record/reset failure는 기존 data를 보존하며 Retry와 truthful discard escape가 각각 `restore-start`/`complete-stay`로 lock, heartbeat, observer, rate와 suppression을 즉시 정리한다.
- difficult segment는 처음에 선택되지 않고 explicit selected-only action만 content에서 canonical `LearningCard`로 변환한다. raw catalog/mission/typed-answer data는 background나 progress storage에 들어가지 않으며 repeated explicit save는 distinct card다.
- 백업, 독립 분석·통계와 그 밖에 연기한 기능은 UI, 네트워크 동작과 권한에 노출되지 않는다.

### 9.4 Verification gate

릴리스 후보 증거는 아래 등급으로 평가한다. 실제로 수행하지 않은 manual row는 계속 `NOT RUN`, 외부 환경이나 관찰 한계로 판정할 수 없는 row는 `UNKNOWN`으로 기록하며, 자동화나 waiver를 manual `PASS`로 바꾸지 않는다.

#### 필수 자동·정적 gate

- `yarn type-check`
- `yarn lint`
- `yarn test:run`
- `yarn build`
- deterministic wrapper/greedy segmenter, source/key identity, current/gap/Continue selection, answer threshold, exact hint mask, retry/result와 `totalAttempts: 0` focused suites
- strict progress schema/default/migration/readback/serialized mutation/reset/failure-recovery suites와 production activation/import audit
- mission reducer/component transient-draft, controller union, async race, IME, focus, accessibility, progress-failure/discard, difficult-save와 320/360/390 geometry suites
- direct UI-content catalog/session, content playback/restore/lease/suppression, background progress readiness, Learning landing/lock/Next 10/reset/save와 external storage-change integration suites
- source와 built output에서 typed answer persistence/logging, forbidden raw cue/catalog background relay, microphone/speech/AI, telemetry, account/payment, new network/permission/host/CSP, fifth destination와 release/version change가 없음을 audit한다. explicit canonical LearningCard save exception은 forbidden relay로 오탐하지 않는다.

위 자동·정적 gate는 최종 review head에서 모두 통과해야 하며 이전 head 결과를 승계하지 않는다.

#### 필수 핵심 actual Chrome smoke

- `docs/manual-smoke-test.md`를 2.0 계약에 맞게 먼저 갱신하고 rebuilt production `dist`를 실제 action으로 연 Chrome Extension Pages Side Panel에서 검증한다. 일반 extension tab은 증거가 아니다.
- 깨끗한 전용 profile의 fresh install/readiness와, signed-in actual v1.11.0 전용 profile에서 대표 public data를 만든 뒤 같은 extension identity와 stable unpacked path로 수행하는 2.0 upgrade/readback을 각각 직접 확인한다. 자동 테스트는 이 두 smoke를 대신하지 않는다.
- signed-in supported Coupang Play route에서 extension install/reload, active-tab 통신, DRM/player 접근, native와 registered learning/support source, platform-caption 비간섭과 기존 네 destination을 확인한다.
- 후속 Issue가 이 조사 data를 사용하도록 별도 승인된 경우에도, Coupang Play 페이지에서 API·DOM data를 직접 관찰한 조사는 데이터의 존재와 현재 형태에 대한 증거일 뿐이다. rebuilt unpacked Play Plus가 같은 값을 안전하게 획득하고 exact tab·document·route·video identity와 광고·SPA 전환을 격리한다는 actual Chrome smoke를 대신하지 않는다.
- Playback Context 구현은 supported movie/episode, 실제 advertisement → main-content 전환과 SPA content change에서 exact route kind, truthful lifecycle, current epoch/attachment/source/revision binding, fail-closed controls, ad-data exclusion, ordinary cue/follow 복구와 Listening Mission explicit resume를 실제 Side Panel에서 확인한다. trailer/channel/highlight/unknown 표본이 도달 불가능하면 해당 optional row는 `NOT RUN`으로 남긴다.
- episode `watch_next` fence 구현은 rebuilt production `dist`의 action-opened, tab-bound Chrome Extension Pages Side Panel에서 signed-in KR supported episode의 strict-valid `watch_next` positive를 최소 한 실제 episode에서 end-to-end로 확인한다. 이 actual positive는 current P0/#89 identity에 묶인 fence, whole-interval Mission catalog, automatic/replay/Slow clip bound, previous/next/repeat와 subtitle-row seek bound, 마지막 pre-fence Results, fence 뒤 `Next 10` 부재와 explicit `Continue Watching` cleanup/handoff를 함께 통과해야 한다.

  두 번째 독립 strict-positive episode는 별도의 product safety axis가 아니라 provider sampling redundancy다. 다음 positive-sampling coverage가 모두 `PASS`하면 두 번째 natural positive는 acceptance 필수가 아니다.

  - exact-head strict projection matrix: raw-duration `0.001` scale/range, exactly-one raw `watch_next`, exact six-field shape/type/value/range, intro consistency와 malformed/unknown sibling isolation
  - exact-head P0/content/video/attachment/source/#89 physical snapshot/`subtitleRevision` observation·consumption binding matrix
  - exact-head whole-interval catalog, clip/replay/Slow, previous/next/repeat, subtitle-row seek, Results/`Next 10`와 Continue Watching matrix
  - 최소 한 actual strict-positive episode의 complete end-to-end `PASS`
  - 실제 missing/invalid/ambiguous episode 표본에서 marker-agnostic behavior와 stale positive non-inheritance 확인
  - exact-head full automated/static gate와 CI `PASS`

  bounded live sample에서 두 번째 strict-positive episode가 나오지 않으면 literal `NOT OBSERVED WITHIN SAMPLE`로 남기며 manual `PASS`로 승격하지 않고 acceptance를 막지 않는다.

  advertisement → content는 이 sampling rule과 별개의 mandatory runtime safety gate다. 광고 여부는 media duration, video presence/shape, host DOM copy 또는 유사 heuristic으로 판정하지 않는다. Actual Chrome에서는 Play Plus가 직접 발행하는 current `pingContent`/`contentStatus` lifecycle에서 `advertisement`와 `learningAvailable === false`를 관찰하고, 이후 current supported episode의 `content`, current identity/source/`subtitleRevision`, `learningAvailable === true`와 fresh existing playback replay evidence로 복귀하는 것을 확인한다.

  P1-specific stale-fence safety는 exact-head matrix에서 pre-existing fence가 `advertisement | waiting | placeholder | transitioning` 진입 즉시 폐기되고 lifecycle이 다시 `content`가 되었다는 사실만으로 복원되지 않으며 fresh current replay evidence가 있어야만 새 fence가 생김을 증명한다. Actual advertisement가 Mission 시작 전에 발생해도 이 direct lifecycle gate를 만족할 수 있다. Existing P0 actual-Chrome evidence가 active Mission의 advertisement suspend, `missionResumeRequired`, same-content return과 explicit resume semantics를 이미 증명한 경우 #90은 그 active-Mission cycle 자체를 다시 mandatory actual로 반복할 필요가 없다. #90 exact-head regression은 해당 P0 semantics를 계속 `PASS`해야 한다.

  same-document next-episode SPA, attachment/source/revision drift, 추가 network 0, 새 Storage/permission 0과 sensitive marker/provider logging 0은 계속 actual core gate다. Mandatory actual row의 `NOT RUN | UNKNOWN | FAIL`은 acceptance를 막지만, 위에서 conditional sample로 분류한 두 번째 strict-positive episode의 `NOT OBSERVED WITHIN SAMPLE`은 blocker가 아니다.
- native SDH fallback 구현은 rebuilt production `dist`의 action-opened, tab-bound Chrome Extension Pages Side Panel에서 signed-in KR supported movie/episode의 exact-head production extension, install/auth/region/DRM/player/native acquisition, regular positive와 regular-absent exact `<language> sdh` positive를 실제로 확인한다. 대표 changed-snapshot atomic invalidation, current P0 route/source invalidation, 새 Storage/permission 없음, sensitive persistence/relay/logging 없음과 external subtitle lookup 없음도 actual Chrome에서 확인한다.

  Artifact-identity carry-forward는 아래 세 evidence-equivalence axis와 별개의 provenance rule이며 네 번째 evidence-equivalence axis가 아니다. native SDH fallback의 `regular canonical positive`와 `regular-absent exact <language> sdh positive` 두 category-attribution row에만 적용한다.

  실제 category attribution을 직접 PASS한 certified runtime head 이후 final review head까지의 모든 변경이 documentation-only이고 runtime, source, build configuration, manifest, dependency/lockfile, Storage, permission, message 또는 network input을 변경하지 않았으며, 두 head에서 rebuilt production `dist`의 complete file-path + byte digest set이 동일해 Chrome에 로드되는 production artifact가 byte-identical임을 증명한 경우, 이전 certified runtime head의 두 category observation을 final review head에 carry forward할 수 있다.

  carry-forward를 사용할 때 final evidence는 이전 observation head와 final review head를 모두 명시하고 `category attribution carried forward by byte-identical runtime artifact; not re-observed on this head`라고 기록한다. 이전 observation을 final review head에서 새로 수행한 manual PASS로 표현하면 안 된다. Final review head에서는 automated/static/CI gate와 KR/auth/DRM/player, non-empty logical-native projection, representative P0/changed-snapshot/no-churn, existing-replay/no-failure/no-external-lookup, Storage/permission/privacy gate를 다시 PASS해야 한다.

  intervening runtime/source/build/manifest/dependency/lockfile 변경, production artifact digest mismatch, required current-head revalidation의 `NOT RUN | UNKNOWN | FAIL`, 또는 observation provenance 불명확성 중 하나라도 있으면 carry-forward는 무효이며 두 category row는 current-head actual evidence 없이는 acceptance를 막는다. 이 rule은 다른 manual row, episode `watch_next`, 이후 runtime-changing Issue 또는 final integration evidence에 자동으로 확대하지 않는다.

  다음 세 불변식은 provider-controlled natural occurrence 또는 browser-observability 한계 때문에 native SDH fallback에 한해서 evidence-equivalence core gate로 검증할 수 있다.

  1. P0 stale acceptance matrix: route/video/content instance, `contentEpoch`, `mediaAttachmentRevision`, lifecycle, source와 request freshness의 모든 stale axis를 exact-head focused tests로 증명하고, actual Chrome에서는 그중 하나 이상의 representative current route 또는 source/P0 invalidation이 stale work를 제거하고 current identity로만 복구되는 것을 확인한다. 모든 stale axis가 한 bounded actual-Chrome sample에서 자연 발생할 필요는 없다.
  2. Identical accepted snapshot no-op: identical physical identity + category + cue snapshot이 cache, `subtitleRevision`, catalog, clip, seek, repeat 또는 Listening Mission churn을 만들지 않음을 exact-head atomic-store/message-handler/coordinator tests로 증명하고, actual Chrome에서는 bounded steady-state 동안 unexpected revision/source/Mission churn이 없음을 확인한다. advertisement 또는 same-content replay가 자연 발생하지 않으면 그 trigger는 literal `NOT OBSERVED WITHIN SAMPLE`로 남기며 acceptance를 차단하지 않는다.
  3. One-attempt/no-retry network boundary: selected candidate마다 기존 `src ?? sources[0].src` 한 URL만 한 번 시도하고 second URL, retry, provider/discover lookup, prefetch 또는 interception이 없음을 exact-head fetch-call ledger tests와 source/built-output static audit로 증명한다. actual Chrome에서는 기존 extension playback replay 1회, successful candidate GETs, failed/blocked candidate request 0과 external subtitle lookup 0을 aggregate boundary로 확인한다. Chrome DevTools가 page-player VTT와 content-script VTT initiator를 개별적으로 분리해 표시하는 것은 acceptance requirement가 아니다.

  이 evidence-equivalence는 manual observation을 자동 `PASS`로 바꾸는 waiver가 아니다. 자연 발생하지 않은 advertisement, replay, duplicate, candidate failure 또는 coexistence는 `NOT OBSERVED WITHIN SAMPLE`로 사실대로 남긴다. evidence-equivalence에 필요한 exact-head focused test, fetch-call ledger, static audit, actual representative observation 또는 exact-head CI 중 하나라도 `NOT RUN | UNKNOWN | FAIL`이면 해당 gate는 acceptance를 막는다. deterministic failure/duplicate/coexistence precedence는 exact-head fixture evidence로만 주장하며 provider-wide behavior로 일반화하지 않는다.
- 대표 Listening Mission에서 entry/source truth, automatic/replay/slow playback, answer와 실제 IME, hint/Reveal/Later, retry/Results, explicit difficult save, progress/reset failure와 truthful discard, end/restoration, lease와 실제 route invalidation을 확인한다. Network, Chrome Storage와 log inspection으로 typed answer/raw mission text가 전송·영속화되지 않고 explicit selected segment만 canonical `LearningCard`로 저장되는 예외를 확인한다.
- 실제 Chrome이 제공하는 최소 side panel 폭에서 keyboard, scroll, focus, overflow와 주요 Learning/Subtitles/Library/Review/OpenSubtitles 회귀를 확인한다.
- 첫 명시적 OpenSubtitles 검색 전 request 0건과 exact optional permission을 확인하고, 사용자 소유의 등록된 Play Plus Consumer와 app identifier로 로그인/JWT 없는 direct search, 선택한 한 결과의 direct download·strict 등록, 자동 역할 미적용, same-session cache와 keyless fail-closed를 실제 Chrome에서 확인한다.

핵심 actual row의 `FAIL`은 항상 acceptance를 막고, `NOT RUN` 또는 `UNKNOWN`도 원칙적으로 acceptance를 막는다. 예외는 이 canonical section이 feature-specific evidence-equivalence core gate를 명시적으로 정의한 경우뿐이다. 그런 row는 정의된 exact-head deterministic/static evidence와 required actual representative evidence가 모두 `PASS`여야 하며, 어느 구성요소도 생략하거나 waiver로 대체할 수 없다. 자연 발생하지 않은 manual trigger는 `PASS`로 승격하지 않고 `NOT OBSERVED WITHIN SAMPLE`로 남긴다. 이 예외는 native SDH fallback에 위에서 명시한 세 축에만 적용하며 episode `watch_next` fence나 다른 core actual row로 확대하지 않는다.

#### Exact-head 자동화로 인정하는 결정론적 변형

다음 변형은 해당 production code의 exact review head에서 focused suite와 전체 gate가 `PASS`하고 `docs/manual-smoke-test.md`가 test/claim mapping을 기록하면 acceptance evidence로 인정한다.

- migration/readiness/progress/card write failure injection과 retry·discard 분기
- async race, duplicate action, delayed response와 stale tab/video/source/revision identity 격리
- OpenSubtitles permission deny/cancel/revoke, invalid/error/quota, decode/parse/atomic-registration 경계
- session cache entry cap, 총 byte cap, 6시간 TTL, deterministic eviction과 persistent-storage 비유입
- 320/360/390 CSS px deterministic geometry, long/multilingual text, focus와 accessibility 변형

이 인정은 대응 manual row를 `PASS`로 바꾸지 않는다. manual row는 직접 수행하지 않았다면 `NOT RUN`으로 남고 별도 acceptance mapping에서 자동화 근거를 가리킨다. 자동화에 매핑되지 않은 핵심 동작을 임의로 이 목록에 포함하지 않는다.

#### 비핵심 compound 반복

위 core actual smoke 또는 exact-head 자동화로 이미 확인한 같은 제품 경계를 양 route, 모든 file/source/role/theme, 모든 view/state/keyboard 조합으로 다시 반복하는 manual compound row는 revision 3의 비핵심 exhaustive evidence다. 직접 전부 수행하지 않았으면 literal `NOT RUN`을 유지하고 별도 acceptance inventory에서 `NC`로 분류한다. `NC`는 미실행 동작의 `PASS`가 아니며, 대표 core actual 경계가 없거나 자동화로 증명해야 하는 deterministic failure/race/cache/TTL/eviction/stale/geometry 변형을 대신할 수 없다.

#### Revision 3 환경 waiver

다음 두 actual-Chrome row만 Issue #66 acceptance의 환경 waiver로 승인한다.

- MCP가 service-worker inspector를 분리하지 못해 수행할 수 없는 worker-only natural restart. `reload_extension`을 worker-only 증거로 간주하지 않으며 row는 `NOT RUN`으로 남긴다.
- actual Extension Pages Side Panel의 약 390 CSS px 조정이 `Protocol error (Browser.getWindowForTarget): Browser window not found`로 실패한 환경. 실제 attainable minimum 폭 검증은 계속 필수이고 320/360/390 deterministic geometry suite도 유지하며, 약 390px actual row 자체는 `NOT RUN`으로 남긴다.

waiver는 제품 동작을 확인했다는 뜻이 아니며 다른 environment failure, `UNKNOWN` 또는 `FAIL`로 확장하지 않는다. 어느 row든 실제 결과가 `FAIL`이면 waiver 없이 acceptance를 막는다.

#### 공개 disclosure와 Store 제출 전 gate

- README, 한국어·영어 locale과 manifest 권한 설명은 명시적 전송, 선택적 권한, 로컬 등록, 자동 역할 미적용, anonymous quota와 OpenSubtitles attribution을 사실대로 설명해야 한다.
- 확장 UI와 Chrome Web Store listing에는 `Subtitles provided by OpenSubtitles.com`에 준하는 source credit과 `https://www.opensubtitles.com/` 링크를 제공한다.
- Chrome Web Store 개인정보 공개와 적용 가능한 개인정보처리방침은 사용자가 Search로 제출한 제목/query, 언어, 선택 필터와 page만 OpenSubtitles로 전송하고, 시청 URL·Coupang Play video ID·재생 위치·카드·cue 본문은 전송하지 않으며, 선택한 자막만 다운로드하고 provider 검색정보를 영속 저장하지 않는다는 사실을 정확히 설명한다.

외부 Chrome Web Store listing과 개인정보 공개 갱신은 Store 제출 전에 반드시 완료하지만 Issue #66 merge나 이 문서 개정이 Store 제출·배포 권한을 부여하지 않는다.

## 10. Explicit Non-goals and Amendment Rule

2.0 완료를 이유로 다음 작업을 함께 끼워 넣지 않는다.

- 배포, 태그, Chrome Web Store 제출 또는 자동 업데이트 정책 변경
- 다섯 번째 destination, 다른 mission type, 범용 quiz framework 또는 broad Learning/Library/Review redesign
- subtitle analysis, word frequency, key-expression extraction, independent vocabulary/expression mission 또는 shadowing
- microphone, speech recognition, pronunciation grading, audio recording, AI/semantic grading, automatic translation 또는 external explanation service
- chronological mission history, historical accuracy chart, SRS/due date, streak, reminder, leaderboard 또는 sharing
- Listening Progress 밖의 새 personal data, telemetry, experiment, account, sync, payment, Pro 또는 daily quota
- Play Plus backend/proxy 또는 다른 server 구축
- OpenSubtitles 계정·JWT, Play Plus proxy/backend, BYOK, 자동 영상 제목 수집·검색·추천·역할 적용
- broad optional host, download redirect 허용, provider provenance 영속 schema와 multi-file/CD 자동 병합
- telemetry나 사용자 조사 수집 코드
- 전면적인 디자인 시스템 교체
- 저장 표시 정확도를 위한 새 subtitle provenance/source-index schema, 자동 dedupe, 저장 toggle 또는 행 삭제
- MV3 경계를 넘는 편의성 리팩터링
- 다른 스트리밍 서비스 지원

구현 중 이 문서만으로 결정할 수 없는 문제가 생기면 다음처럼 처리한다.

1. 데이터 보존, 공개 동작, 개인정보, 권한 또는 사용자 흐름을 바꾸면 작업을 멈춘다.
2. Codex가 현재 코드 증거와 선택지를 Context Packet으로 정리한다.
3. ChatGPT 검토와 사용자 승인을 받는다.
4. 이 문서와 해당 Issue를 먼저 갱신한 뒤 구현을 재개한다.

버그 수정이나 내부 함수 이름처럼 계약을 바꾸지 않는 세부사항은 Issue와 PR에만 기록한다. 이 문서는 실제 구현 현황을 과장하는 roadmap이 아니라, 2.0이 지켜야 할 승인된 경계다.
