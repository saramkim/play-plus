# Play Plus Development Workflow

이 문서는 Play Plus의 제품·UX·기술 설계 논의를 실제 저장소 작업으로 연결하는 canonical workflow다. 필수 Git, 검증, 릴리스 규칙은 [`AGENTS.md`](../AGENTS.md)를 따르며 여기에서 중복하지 않는다.

## Principles

- 프로세스의 강도는 변경 줄 수가 아니라 결정의 무게에 맞춘다.
- GitHub Issue는 무엇을 왜 구현할지 정하는 계약이고, Pull Request는 어떻게 구현하고 검증했는지 보여 주는 증거다.
- Codex는 현재 저장소와 작업 트리를 근거로 조사·구현·검증한다.
- ChatGPT는 제품 방향, 사용자 경험, 기술 설계, 범위와 트레이드오프, 구현 완료 여부를 검토한다.
- 사용자는 우선순위, 범위 변경, 개인정보·권한 정책, 배포와 되돌리기 어려운 결정을 최종 승인한다.

## Decide Whether an Issue Is Required

다음 중 하나라도 해당하면 구현 전에 Issue를 만든다.

- 사용자 경험이나 제품 방향을 변경한다.
- 기존 기능의 범위를 확대하거나 축소한다.
- 공개 동작, 저장 데이터, 메시지 계약이나 외부 계약을 변경한다.
- MV3 컨텍스트 경계, 아키텍처 경계나 공유 컴포넌트 구조를 변경한다.
- 개인정보, Chrome 권한이나 host permission에 영향을 준다.
- 요구사항, acceptance criteria 또는 완료 조건을 검토해야 하는 비자명한 버그나 작업이다.
- 유지보수 비용이나 되돌리기 어려움에 실질적인 트레이드오프가 있다.

다음 작업은 Issue 없이 짧은 작업 브랜치와 Pull Request로 진행할 수 있다.

- 범위가 명확한 단순 버그 수정.
- 제품이나 개발 workflow 계약을 바꾸지 않는 명확한 문구나 문서 수정.
- 동작을 바꾸지 않는 기계적인 리팩터링.
- 현재 canonical documentation이나 기존 Issue가 이미 정한 방향의 반복 구현.

Issue 필요 여부는 먼저 위 예외 조건으로 판단한다. 승인된 기대 동작의 복원이나 기존 결정의 구현이라는 이유만으로 새 Issue를 요구하지 않는다. 새로운 결정을 기록해야 한다면 Issue를 사용하며, 기존 Issue 계약 변경과 명시적인 승인 요건은 유지한다.

## Issue Contract

Issue-required 작업은 구현 전에 다음 내용을 확정한다.

- 목표와 사용자 문제.
- 현재 동작과 관련 파일·컴포넌트.
- 포함 범위와 제외 범위.
- 기술·제품 제약과 기존 결정.
- 검증 가능한 acceptance criteria.
- 실행할 자동·수동 검증.
- 알려진 위험, 트레이드오프와 필요한 사용자 승인.

제품·UX·기술 설계 논의가 필요하면 `AGENTS.md`의 Context Packet 형식으로 ChatGPT에 전달한다. 합의가 Issue의 범위나 acceptance criteria를 바꾸면 구현 전에 Issue를 갱신한다.

## Issue-to-PR Lifecycle

Issue-required 작업은 다음 순서를 따른다. 이 lifecycle 자체는 commit·push·PR 생성·상태 변경 권한을 부여하지 않는다. 해당 실행의 승인이 필요하면 승인된 범위 안에서 독립적으로 가능한 준비·검증과 검토자료 작성을 먼저 마친다. 승인 대기 단계는 요청 범위의 완료와 구분하며, 필수 선행 Issue 계약이나 검토·승인 gate를 건너뛰지 않는다.

1. Codex가 로컬 저장소와 최신 작업 트리를 조사한다.
2. 필요한 ChatGPT 검토와 사용자 결정을 거쳐 Issue 계약을 확정한다.
3. 최신 `main`에서 작업 종류에 맞는 짧은 kebab-case 브랜치를 만든다. 브랜치 종류는 `AGENTS.md`의 기존 전략을 따른다.
4. Issue 범위 안에서 최소 변경을 구현하고 변경 유형에 맞는 검증을 실제로 실행한다.
5. Pull Request를 `main` 대상으로 만들고 Issue를 `Closes #<issue-number>`로 연결한다.
6. 작업이 아직 진행 중이거나 조기 피드백이 필요하면 Draft로 만들고, 합의 범위와 검증이 완료되면 review-ready 상태로 전환한다.
7. Codex가 전체 diff와 실제 검증 결과를 ChatGPT에 전달해 완료 여부를 검토받는다.
8. 합의 범위 안의 결함은 수정한다. 새로운 제품 결정이나 범위 확대가 필요하면 구현을 멈추고 사용자 결정을 받은 뒤 Issue를 갱신한다.
9. PR에는 최종 범위, 검증 증거, 남은 수동 확인, 문서 영향과 위험을 기록한다.

Issue가 필요 없는 작업도 원칙적으로 짧은 작업 브랜치와 `main` 대상 Pull Request를 사용하며, `AGENTS.md`의 commit·push 승인 규칙을 따른다.

## Optional Batch Relay Mode

일반 Issue-to-PR lifecycle이 기본 workflow다. 사용자가 여러 승인된 Issue의 순차 구현, ChatGPT 검토·병합과 다음 Issue 인계를 한 번에 위임하려면 정확한 `BATCH RELAY RUN #<parent-batch-issue-number>` 트리거로 선택적 Batch Relay를 활성화할 수 있다.

Batch Relay의 부모 계약, 권한, 순차 실행, PR 검토·병합 gate, 중단과 최종 통합 검증은 [`docs/batch-relay.md`](batch-relay.md)를 따른다. 정확한 트리거가 없으면 Batch Relay를 추정하지 않는다. 이 모드는 GitHub auto-merge, 별도 merge Action, branch protection, release 또는 deployment automation을 추가하지 않는다.

## Branch and Release Model

- `main`은 다음 릴리스에 포함할 검증된 변경을 계속 통합하는 원격 기본 브랜치다.
- 작업 브랜치는 최신 `main`에서 시작하고 Pull Request로 `main`에 합친 뒤 오래 유지하지 않는다.
- `main`의 최신 커밋이 항상 배포된 버전을 뜻하지는 않는다. 실제 릴리스는 `chore(release): v<version>` 커밋과 해당 커밋의 lightweight `v<version>` 태그로 식별한다.
- 장기 `develop` 또는 상시 release 브랜치는 기본 workflow에 포함하지 않는다.

기존 `develop`에서 `main`으로 전환할 때는 누적 변경과 이 workflow 변경을 하나의 전환 Pull Request로 검증해 `main`에 합친다. 전환 PR이 병합되기 전까지는 `develop`을 유일한 통합 기준으로 유지하고 새 `main` 기반 작업을 시작하지 않으며, 위의 `main` 중심 규칙은 전환 PR이 병합된 뒤 적용한다. 브랜치 대상 필터가 없는 CI의 `pull_request` 트리거는 전환 PR에서도 전체 검증을 실행해야 한다.

전환 PR 병합 후에는 활성 브랜치와 worktree가 더 이상 `develop`을 기준으로 사용하지 않는지 확인한다. 로컬·원격 `develop` 삭제는 모든 참조 확인과 사용자 승인 후 별도 단계로 수행한다.

## Pull Request Evidence

Pull Request는 최소한 다음 정보를 포함한다.

- 연결된 Issue와 구현 요약.
- 범위 안에서 변경한 파일과 동작.
- 실제 실행한 명령과 결과.
- 실행하지 않았거나 남아 있는 수동 검증.
- 문서, 권한, 개인정보, 릴리스 영향.
- 알려진 위험과 필요한 후속 작업.

실행하지 않은 검증을 통과로 표시하지 않는다. CI 결과와 로컬 검증 결과를 구분한다.

## Canonical Documentation

- `AGENTS.md`: 아키텍처 경계, 개발 규칙, Git, 검증과 릴리스 guardrail.
- `docs/play-plus-2.0.md`: Play Plus 2.0의 승인된 제품 방향, 데이터 모델, v1.11 마이그레이션, 기능 범위와 완료 기준.
- `docs/development-workflow.md`: Issue, ChatGPT 협업과 Pull Request lifecycle.
- `docs/batch-relay.md`: 사람이 정확한 트리거로 활성화하는 선택적 다중 Issue 실행, 검토·병합과 중단 workflow.
- `docs/manual-smoke-test.md`: 릴리스 전 실제 Chrome 검증 기록.
- `README.md`: 제품·설치·개발 진입점과 canonical 문서 링크.

중요하고 장기적인 결정만 해당 주제의 canonical documentation에 반영한다. 일회성 논의, 구현 세부사항과 검증 결과는 Issue와 Pull Request에 남긴다.

## Out of Scope

이 workflow는 기존 검증 명령과 릴리스 절차를 변경하지 않는다. `main` 중심 workflow로의 전환은 릴리스나 배포를 의미하지 않으며, Chrome Web Store 또는 다른 배포 메커니즘이 저장소에 정의되기 전까지 배포 절차도 만들지 않는다. branch protection·ruleset, label automation, workflow enforcement Action, worktree 또는 lifecycle 도구는 별도 승인된 작업으로 다룬다.
