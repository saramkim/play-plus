# Project Overview

- Play Plus는 Coupang Play의 자막 학습, 재생 제어, 반복 재생 등을 확장하는 Chrome Extension Manifest V3 프로젝트다.
- 기술 스택: TypeScript 5.8, React 19, Zustand, React Hook Form, Zod, Tailwind CSS 4, Webpack 5, Vitest, ESLint 9.
- 실행 환경: Node.js `>=22 <25`, Yarn 4.9.1, Chrome. 빌드 결과인 `dist/`를 압축 해제된 확장 프로그램으로 로드한다.

# Architecture

- `public/`: MV3 manifest, 아이콘, locale 등 빌드 시 그대로 복사되는 정적 파일.
- `src/ui/`: 사이드 패널 React 앱. 진입점은 `src/ui/index.tsx`; 설정과 활성 탭 상태를 표시하고 Chrome Storage/메시지를 통해 다른 컨텍스트와 연동한다.
- `src/background/`: MV3 서비스 워커. 진입점은 `src/background/index.ts`; 설치/마이그레이션, 탭 생명주기, 사이드 패널, webRequest, 컨텍스트 간 중계를 담당한다.
- `src/content/`: Coupang Play 페이지에 주입되는 스크립트. 진입점은 `src/content/index.ts`; DOM/비디오 감지, 페이지 내 React UI, 자막·재생 기능을 담당한다.
- `src/storage/`: `chrome.storage.sync/local/session`의 타입, Zod 스키마, 기본값, 마이그레이션과 탭/자막 저장 API.
- `src/utils/`: 공통 상수, 파서, i18n, Coupang Play 유틸리티. 메시지 계약은 `src/utils/message/type.ts`, 전송 래퍼는 `src/utils/message/index.ts`에 둔다.
- Webpack 진입점은 UI→`index.js`, background→`background.js`, content→`content.js`이며 `public/manifest.json`이 이를 연결한다.

주요 흐름: UI가 설정을 Storage에 저장하면 content script가 변경을 구독해 페이지 기능에 반영한다. UI는 활성 탭의 content script에 비디오·자막 명령을 직접 보내고, 탭 열기 요청과 content의 상태/자막 보고는 runtime 메시지로 background가 처리한다. background는 활성 탭 및 자막 상태를 Storage에 기록해 UI와 동기화한다.

MV3 경계:

- 페이지 DOM과 `<video>` 접근은 content script에서만 한다. UI/background에서 페이지 전역 객체나 DOM을 직접 사용하지 않는다.
- background는 영구 프로세스가 아닌 service worker다. 메모리 전역 상태에 지속성을 기대하지 말고 필요한 상태는 Storage에 저장하며 비동기 작업을 `await`한다.
- UI는 side panel 문서이며 content script와 동일한 DOM/React root를 공유하지 않는다. 교차 컨텍스트 변경은 `MessageSchema`와 메시지 래퍼 또는 기존 Storage API를 사용한다.
- 새 메시지는 스키마, 송신부, 올바른 컨텍스트의 수신부를 함께 변경한다. 비동기 `sendResponse` 핸들러는 리스너에서 `true`를 반환한다.
- 권한, host match, 엔트리 변경은 `public/manifest.json`과 Webpack 출력 이름을 함께 확인하고 최소 권한을 유지한다.

# Development Rules

- ESLint가 기준이다. 파일명은 kebab-case, TypeScript export는 named export를 사용한다(default export 금지).
- import는 builtin→external→internal→parent→sibling→index 순서, 그룹 간 빈 줄, 그룹 내 알파벳 순서를 지킨다. 중복·순환 import를 만들지 않는다.
- `../` 상위 상대 import는 금지한다. `@/`, `@storage/`, `@utils/` 별칭을 사용한다.
- TypeScript `strict`를 유지하고 `unknown`과 타입 좁히기를 우선한다. 저장 데이터는 기존 Zod 스키마와 기본값 검증 경로를 우회하지 않는다.
- 기존 feature/controller/store/hook 구조와 인접 코드 패턴을 우선한다. 생성물 `dist/`, Yarn 내부 파일, 무관한 설정은 수정하지 않는다.
- 광범위한 리팩터링, 임의의 권한 추가, 컨텍스트 경계를 우회하는 직접 결합을 피한다. 요청에 필요한 최소 파일만 수정한다.

# Working Guidelines for AI Agents

- 시작 시 작업과 직접 관련된 파일만 읽는다. 기본 확인 순서는 `package.json`, `tsconfig.json`, `webpack.config.js`, `public/manifest.json`, 관련 진입점과 인접 테스트다.
- 구조가 필요할 때는 먼저 `rg --files <관련 경로>`와 `rg <심볼>`을 사용한다. 전체 저장소나 생성물을 무작정 출력하지 않는다.
- 관련 없는 사용자 변경을 보존하고, 요청 밖 파일을 수정하거나 큰 리팩터링을 하지 않는다.
- 새 추상화보다 기존 패턴을 재사용하고 변경 범위를 최소화한다. 동작 변경에는 가까운 `*.test.ts(x)`를 추가하거나 갱신한다.
- 완료 보고는 변경 파일, 핵심 동작, 수행한 검증과 남은 수동 검증만 간결하게 적는다.

# ChatGPT Collaboration

ChatGPT에서는 `Play Plus` 프로젝트를 사용한다. Codex와 ChatGPT는 다음 역할로 협업한다.

- Codex: 로컬 저장소 조사, 구현, 실행, 테스트, 최신 작업 트리와 전체 diff 확인.
- ChatGPT: 제품 방향, 사용자 경험, 기술 설계, 작업 범위와 트레이드오프, 구현 완료 여부 검토.
- 사용자: 제품 우선순위, 범위 변경, 개인정보·권한 정책, 배포와 되돌리기 어려운 결정의 최종 승인.

다음 작업은 구현 전에 ChatGPT와 논의한다.

- 사용자 경험이나 제품 방향을 변경하는 작업.
- 기존 기능의 범위를 확대하거나 축소하는 작업.
- 공개 동작이나 외부 계약을 변경하는 작업.
- 아키텍처 경계나 공유 컴포넌트 구조를 변경하는 작업.
- 유지보수 비용이나 되돌리기 어려움에 실질적인 트레이드오프가 있는 작업.
- 요구사항이 모호하거나 현재 제품 원칙과 충돌하는 작업.

다음 작업은 ChatGPT 논의를 생략할 수 있다.

- 범위가 명확한 단순 버그 수정이나 명확한 문구 수정.
- 동작을 바꾸지 않는 기계적인 리팩터링.
- 현재 이슈나 해당 주제의 canonical documentation에 이미 결정된 방향의 반복 구현.
- 사용자가 현재 작업에서 직접 승인한 명확한 방향.

ChatGPT에 전달하는 Context Packet은 다음 형식을 사용한다.

```text
GOAL
The outcome the user wants

CURRENT STATE
Relevant files, components, and current behavior

CONSTRAINTS
Technical constraints and existing decisions

OPTIONS
Reasonable implementation alternatives

CODEX RECOMMENDATION
Codex's recommendation and supporting code evidence

QUESTIONS
Decisions ChatGPT needs to make
```

협업 절차:

1. Codex가 먼저 저장소와 최신 작업 트리를 조사한다.
2. 위 기준에 해당하면 Context Packet을 ChatGPT에 전달한다.
3. 논의는 원칙적으로 두 차례 왕복 안에 끝낸다.
4. 결론이 나면 선택한 방향, 제약과 제외 범위를 구현 전에 짧게 정리한다.
5. 합의한 방향이 현재 이슈의 범위나 acceptance criteria를 변경하면 구현 전에 이슈를 갱신한다.
6. 구현 후 전체 작업 diff와 실제 검증 결과를 ChatGPT에 전달해 완료 여부를 다시 검토받는다.
7. 현재 합의 범위 내 결함은 수정한다.
8. 새로운 제품 결정이나 범위 확대가 필요하면 자동으로 구현하지 않고 사용자에게 결정을 요청한다.
9. 실행하지 않은 테스트를 통과했다고 간주하지 않는다.
10. 중요한 장기 결정만 해당 주제의 기존 canonical documentation에 기록한다.

세부 Issue-to-PR 절차는 [`docs/development-workflow.md`](docs/development-workflow.md)를 따른다. 브랜치, commit, 검증과 릴리스에는 아래 기존 규칙을 그대로 적용한다. worktree와 배포는 현재 저장소에 문서화된 범위만 따르며, 다른 저장소의 명명법, 명령 또는 lifecycle 도구를 가져오지 않는다.

# Commands

```bash
yarn install          # 의존성 설치
yarn dev              # dist 정리, 개발 빌드 후 watch
yarn build:dev        # 1회 개발 빌드
yarn build            # 프로덕션 빌드
yarn type-check       # tsc --noEmit
yarn lint             # ESLint
yarn lint:fix         # ESLint 자동 수정
yarn test             # Vitest watch
yarn test:run         # Vitest 1회 실행
yarn build:analyze    # 프로덕션 번들 분석
```

# Git Workflow

## Branch Strategy

- `main`은 원격 기본 브랜치이자 다음 릴리스에 포함할 검증된 변경을 통합하는 브랜치다. 실제 릴리스는 릴리스 커밋과 `v<version>` 태그로 구분한다.
- 모든 변경은 최신 `main`에서 `feature/<name>`, `fix/<name>`, `refactor/<name>`, `chore/<name>`처럼 변경 종류와 짧은 kebab-case 이름의 브랜치를 만들어 진행하고, Pull Request로 `main`에 합친다.
- 장기 `develop` 또는 상시 release 브랜치는 사용하지 않는다. 릴리스 준비에 별도 격리가 필요해지는 경우 요구사항과 운영 비용을 검토한 뒤 사용자가 승인한다.

## Commit Rules

- Conventional Commits 형식 `<type>(<scope>): <subject>`를 사용한다. type과 scope는 lowercase로 쓴다.
- 기존 type은 `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`다. scope는 `ui`, `content`, `background`, `storage`, `message` 등 실제 변경 영역으로 제한한다.
- subject는 영어 명령형, 가능하면 50자 이내, 끝에 마침표 없이 작성한다.
- 예: `feat(content): add subtitle shortcut`, `fix(background): preserve pending action`, `docs: add agent workflow`.
- 하나의 커밋에는 하나의 관련 변경만 포함한다. unrelated formatting이나 refactoring을 섞지 않는다.

## Before Commit

- `git status --short`와 `git diff`로 staged/unstaged/untracked 파일을 모두 확인한다.
- 요청과 관련된 파일만 명시적으로 stage하고, 다른 작업자의 변경이나 기존 로컬 변경을 제외한다.
- `dist/` 같은 generated file, 로그, 임시 파일, 자격 증명·토큰·환경 파일이 포함되지 않았는지 확인한다.
- 변경 유형에 맞는 Verification을 통과한 뒤 staged diff와 커밋 메시지를 다시 확인한다.

## AI Agent Git Rules

- AI 에이전트는 사용자가 요청한 경우에만 commit한다. commit 요청에는 변경 확인, 선택적 staging, 검증이 포함되지만 push는 포함되지 않는다.
- push는 사용자가 명시적으로 요청한 경우에만 현재 작업 브랜치로 수행한다.
- `main`에 직접 commit/push하지 않는다. 기존 commit을 amend, rebase, reset, force-push하거나 history를 다시 쓰지 않는다.
- unrelated change나 요청 밖 리팩터링을 commit에 포함하지 않는다. 작업 트리가 이미 dirty이면 사용자 변경을 보존한다.

## Release Workflow

- 릴리스 버전은 `package.json`, `public/manifest.json`, `README.md`, `docs/manual-smoke-test.md`에서 함께 갱신한다.
- `yarn type-check`, `yarn lint`, `yarn test:run`, `yarn build`와 `docs/manual-smoke-test.md`의 전체 Chrome smoke matrix를 통과한 뒤 릴리스한다.
- 릴리스 커밋은 기존 형식 `chore(release): v<version>`을 사용한다.
- 모든 릴리스는 릴리스 커밋에 lightweight 태그 `v<version>`을 생성해야 한다(예: `git tag v1.10.2`). 릴리스 배포 시 해당 태그도 원격에 push한다.
- AI 에이전트는 사용자가 릴리스 또는 태그 생성을 명시적으로 요청한 경우에만 태그를 만들고, 태그 push 역시 명시적인 push 요청이 있을 때만 수행한다.

# Task Execution

모든 coding task는 다음 순서를 따른다.

1. 관련 파일만 확인한다.
2. 필요한 최소 변경만 수행한다.
3. 변경 유형에 맞는 검증을 실행한다.
4. 변경 내용과 검증 결과를 요약한다.
5. 사용자가 요청한 경우에만 commit한다.

# Verification

- 문서만 변경: 내용과 `git diff --check`를 확인한다.
- 코드 변경 기본 게이트: `yarn type-check && yarn lint && yarn test:run`.
- 빌드/manifest/엔트리/의존성 변경: 기본 게이트에 `yarn build`를 추가하고 `dist/` 산출물과 Webpack 경고를 확인한다.
- content/background/UI 통신 또는 Chrome API 변경: `docs/manual-smoke-test.md`의 관련 항목을 실제 Chrome의 unpacked `dist/`에서 확인한다. 릴리스 전에는 전체 smoke matrix를 수행한다.
