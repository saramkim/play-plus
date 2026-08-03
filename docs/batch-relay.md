# Play Plus Batch Relay

이 문서는 여러 승인된 GitHub Issue를 **Codex 구현 → ChatGPT 독립 검토·병합 → Codex의 다음 Issue 진행** 순서로 처리하는 선택적 실행 모드인 **Batch Relay**의 canonical workflow다.

Batch Relay는 [`docs/development-workflow.md`](development-workflow.md)의 일반 Issue-to-PR lifecycle을 대체하지 않는다. 사용자가 정확한 트리거로 활성화한 부모 배치 Issue에만 이 문서를 추가 적용한다.

## Trigger

사람이 Codex에 보내는 활성화·재개 명령은 정확히 다음 형식이다.

```text
BATCH RELAY RUN #<parent-batch-issue-number>
```

예:

```text
BATCH RELAY RUN #61
```

숫자는 개별 구현 Issue가 아니라 `.github/ISSUE_TEMPLATE/batch-relay.yml`로 작성한 **부모 Batch Relay Issue** 번호다. 같은 명령은 새 배치를 시작할 때와 중단된 Codex 세션에서 재개할 때 모두 사용한다. 현재 상태는 부모 Issue에서 복구한다.

사람이 중단할 때는 다음 명령을 사용한다.

```text
BATCH RELAY STOP #<parent-batch-issue-number>
```

다음 상황만으로 Batch Relay를 추정하거나 활성화하지 않는다.

- 여러 Issue가 존재한다.
- 사용자가 여러 기능을 한 번에 설명했다.
- 과거에 같은 저장소에서 Batch Relay를 사용했다.
- Codex가 자동화 권한이 있다고 주장한다.
- Pull Request 검토 요청에 `BATCH RELAY REVIEW`가 적혀 있다.

`BATCH RELAY RUN`은 사람만 발행할 수 있다. Codex가 ChatGPT에 보내는 `BATCH RELAY REVIEW`와 `BATCH RELAY FINAL REVIEW`는 이미 활성화된 배치의 검토 요청이며 새로운 권한을 만들지 않는다.

## Batch preparation ownership

Batch Relay는 실행 자동화이지 Issue 기획 자동화가 아니다. 실행 전에 휴먼과 ChatGPT가 제품 방향, 작업 분해, 순서, acceptance criteria와 보호 경계를 합의한다.

합의가 완료되면 ChatGPT가 GitHub에 다음 순서로 Issue를 직접 생성한다.

1. 기존 `feature.yml` 또는 `bug.yml` 계약을 따르는 모든 하위 구현 Issue
2. 최신 `main`에서 배치 전체를 검증하는 마지막 통합 검증 Issue
3. 모든 하위 Issue 번호와 순서, merge method, 검증, exclusions, human-decision boundaries와 현재 휴먼 승인을 기록한 부모 Batch Relay Issue

부모 Issue는 하위 Issue와 최종 통합 검증 Issue가 모두 존재한 뒤 마지막에 만든다. `.github/ISSUE_TEMPLATE/batch-relay.yml`은 ChatGPT가 부모 Issue 본문을 구성할 때 따르는 계약이자 사람이 직접 생성해야 하는 예외 상황의 fallback이다.

Codex는 `BATCH RELAY RUN`을 받은 뒤 Issue를 생성하거나 계약을 보완하지 않는다. 하위 Issue, 최종 통합 검증 Issue 또는 부모 계약이 누락·불완전하면 `PAUSED`로 두고 정확한 누락 사항을 보고한다. Codex는 승인된 Issue의 범위, 순서, acceptance criteria, merge method 또는 권한을 수정할 수 없다.

## Parent batch contract

Batch Relay를 실행하기 전에 다음 계약이 GitHub에 있어야 한다.

1. 모든 구현 Issue와 마지막 통합 검증 Issue가 먼저 존재한다.
2. 각 하위 Issue에는 목표, 현재 상태, 포함 범위, 제외 범위, 제약, acceptance criteria와 검증 계획이 있다.
3. 부모 Issue에는 정확한 실행 순서가 GitHub task list로 기록되어 있다.
4. 마지막 항목은 최신 `main`에서 배치 전체를 검증하는 통합 검증 Issue다.
5. 부모 Issue에는 merge method, 추가 검증, human-decision boundaries와 exclusions가 명시되어 있다.
6. 부모 Issue의 human authorization 항목이 모두 확인되어 있다.
7. `Control state`가 `AUTHORIZED`, `ACTIVE` 또는 사람이 해결한 뒤 재개하는 `PAUSED`다.
8. `COMPLETED` 또는 `CANCELLED` 상태가 아니다.

하위 Issue는 기존 `feature.yml` 또는 `bug.yml` 계약을 사용한다. 부모 Issue는 `batch-relay.yml`의 구조를 따른다. GitHub API로 생성할 때도 같은 필드를 본문에 유지한다.

부모 Issue를 하위 Issue보다 먼저 만들지 않는다. 예외적으로 초안을 먼저 만들었다면 번호와 계약을 모두 채울 때까지 `DRAFT`로 유지하며, `DRAFT` 상태에서는 `BATCH RELAY RUN`을 실행하지 않는다.

기본적으로 저장소당 하나의 Batch Relay만 `ACTIVE`로 둔다. 둘 이상의 배치를 병렬 실행하려면 파일 충돌, 공통 계약과 선행 의존성을 검토한 뒤 사람이 각 배치에 명시적으로 승인해야 한다.

## Sources of truth

Batch Relay에서는 다음 순서로 현재 계약을 판단한다.

1. 사람의 현재 명시적 지시
2. 부모 배치 Issue의 승인 범위, 순서와 control state
3. 현재 하위 Issue의 Scope, Out of scope와 acceptance criteria
4. 루트 [`AGENTS.md`](../AGENTS.md)
5. 관련 canonical documentation
6. 현재 기본 브랜치, Pull Request와 전체 diff
7. 이전 대화와 기억

Codex와 ChatGPT는 요약만 신뢰하지 않고 가능한 경우 GitHub의 현재 Issue, Pull Request, 코드와 검증 상태를 직접 확인한다.

## Authority granted by `BATCH RELAY RUN`

유효한 트리거는 현재 부모 Issue에 나열된 작업에 한해 Codex에게 다음 외부 쓰기를 한 번에 명시적으로 승인한다.

- 최신 `main`에서 하위 Issue별 작업 브랜치 생성
- 현재 Issue 범위의 commit
- 현재 작업 브랜치 push
- Pull Request 생성과 수정
- 같은 Pull Request에서 required fix commit과 push
- 부모 Issue의 task list와 `Control state` 갱신
- 진행·병합·중단 기록 comment 작성
- 승인된 최종 검증 Issue의 종료
- 모든 조건 충족 후 부모 배치 Issue 종료

따라서 활성 배치 안에서는 각 commit, push, Pull Request와 상태 갱신마다 다시 사람에게 승인받지 않는다.

이 권한에는 다음이 포함되지 않는다.

- `main` 직접 commit 또는 push
- force-push, amend, reset, rebase 또는 history rewrite
- 원격·로컬 브랜치 삭제
- 부모 Issue의 승인된 Issue 목록, 실행 순서, merge method, 범위, 검증 또는 human-decision boundaries 변경
- 새 하위 Issue, 최종 통합 검증 Issue 또는 부모 Batch Relay Issue 생성
- 새 하위 Issue를 자동화 권한에 추가
- 현재 Issue 밖 기능, 리팩터링, 일반화 또는 cleanup
- 릴리스 버전 변경, tag, GitHub Release, Chrome Web Store 제출 또는 production 배포
- 별도 승인되지 않은 권한, 개인정보 처리, telemetry, 계정, 결제 또는 외부 전송 변경
- 저장 데이터 손실 가능성이 있는 migration
- 새로운 외부 서비스, 대규모 의존성 또는 빌드 체계 변경

Codex는 Pull Request를 병합하지 않는다. 부모 Issue가 허용하는 조건에서 ChatGPT가 검토한 head SHA를 기준으로 병합한다.

## Activation record and state

Codex는 유효한 `BATCH RELAY RUN`을 받은 즉시 코드를 변경하기 전에 다음을 수행한다.

1. `AGENTS.md`, 이 문서, 부모 Issue와 모든 미완료 하위 Issue를 읽는다.
2. 원격 기본 브랜치와 현재 작업 트리를 확인한다.
3. 다른 활성 Batch Relay와 충돌하지 않는지 확인한다.
4. 부모 Issue의 현재 계약을 스냅샷으로 기록한다.
5. 부모 Issue `Control state`를 `ACTIVE`로 갱신한다.
6. 부모 Issue에 다음 형식의 activation 또는 resume comment를 남긴다.

```text
BATCH RELAY ACTIVATION

Trigger: BATCH RELAY RUN #<parent>
Contract version: 1
Authorized order:
- #...
- #...
Merge method: <squash|merge|rebase>
Starting main SHA: <sha>
Current issue: #...
```

재개 시에는 기존 activation record를 참조하고 계약이 동일한지 확인한다. Codex가 갱신할 수 있는 부모 Issue 내용은 task list의 완료 표시와 `Control state`뿐이다. 승인 목록, 순서, merge method, 검증 또는 경계가 activation record와 달라졌다면 새 방향을 추정하지 않고 `PAUSED`로 전환해 사람의 새 `BATCH RELAY RUN`을 요구한다.

상태 값은 다음과 같다.

- `DRAFT`: 계약 미완성, 실행 불가
- `AUTHORIZED`: 계약과 사람 승인 완료, 아직 실행하지 않음
- `ACTIVE`: Codex가 현재 실행 중이거나 같은 계약으로 재개 가능
- `PAUSED`: 사람 결정, 중단 명령 또는 실제 실행 제한으로 정지
- `COMPLETED`: 모든 하위 Issue와 최종 통합 검증 완료
- `CANCELLED`: 사람이 배치를 취소함

첫 번째 미완료 task list 항목이 현재 Issue다. Codex는 완료되지 않은 앞선 항목을 건너뛰지 않는다.

## Sequential execution loop

별도 병렬 승인이 없다면 다음 loop를 정확히 따른다.

1. 현재 Issue가 부모 Issue의 첫 번째 미완료 항목인지 확인한다.
2. 최신 `origin/main`을 fetch하고 clean base를 확인한다.
3. 최신 `main`에서 현재 Issue 전용 브랜치를 만든다.
4. 현재 Issue와 직접 관련된 코드, 문서와 테스트만 조사한다.
5. Issue 범위 안의 최소 변경을 구현한다.
6. Issue, 부모 Issue, `AGENTS.md`와 canonical documentation이 요구하는 검증을 실제로 실행한다.
7. complete diff를 Scope, Out of scope와 acceptance criteria에 다시 대조한다.
8. 현재 Issue 범위의 commit을 만들고 작업 브랜치에 push한다.
9. `main` 대상 Pull Request를 만들고 `Closes #<current-issue>`로 연결한다.
10. GitHub CI가 terminal state가 될 때까지 현재 실행 안에서 확인한다.
11. CI가 실패하면 원인을 조사하고 현재 Issue 범위의 결함만 수정한 뒤 다시 검증한다.
12. PR과 CI가 review-ready가 되면 ChatGPT에 `BATCH RELAY REVIEW`를 제출한다.
13. ChatGPT 결과에 따라 같은 Issue를 수정하거나, 병합을 확인하거나, 사람 결정을 위해 정지한다.
14. 병합을 GitHub에서 확인한 뒤에만 부모 Issue 상태를 갱신하고 다음 Issue를 시작한다.

Pull Request 생성은 Issue 완료가 아니다. 병합이 확인될 때까지 현재 Issue를 유지한다.

각 작업 브랜치는 직전 Pull Request가 병합된 최신 `main`에서 시작한다. stacked Pull Request, 하나의 PR에 여러 Issue 결합, 실행 순서 변경은 허용하지 않는다.

## Pull Request evidence

기존 `.github/pull_request_template.md`를 사용하고 다음 Batch Relay block을 추가한다.

```markdown
## Batch Relay

- Parent batch: #<parent>
- Sequence: <current>/<total>
- Current issue: #<issue>
- Parent state: ACTIVE
- Merge method: <method>
- Base SHA: `<sha>`
- Head SHA: `<sha>`
```

PR에는 다음 증거가 있어야 한다.

- 연결된 부모와 하위 Issue
- 구현한 전체 범위와 명시적 exclusions
- complete changed-file scope
- 실제 실행한 로컬 명령과 결과
- GitHub checks 상태
- 실행하지 않은 수동 검증과 이유
- 문서, 개인정보, 권한, 릴리스와 배포 영향
- 현재 base SHA와 head SHA

실행하지 않은 검증을 통과로 표시하지 않는다. 이전 head에서 실행한 결과를 새 head의 결과로 간주하지 않는다.

## ChatGPT review request

Codex는 Play Plus ChatGPT 프로젝트에서 다음 형식으로 요청한다.

```text
BATCH RELAY REVIEW

REPOSITORY
saramkim/play-plus

PARENT BATCH ISSUE
#<number>
<url>

ACTIVATION
Trigger: BATCH RELAY RUN #<number>
Parent state: ACTIVE
Sequence: <current>/<total>

CURRENT ISSUE
#<number>
<url>

PULL REQUEST
#<number>
<url>

BASE
Branch: main
SHA: <sha>

HEAD
Branch: <branch>
SHA: <sha>

IMPLEMENTED
- ...

COMPLETE DIFF
- Files changed: ...
- Insertions/deletions: ...
- Changed files:
  - ...

VALIDATION
- `<exact command>`: PASS / FAIL / NOT RUN
- GitHub checks: PASS / FAIL / PENDING

CONTRACT NOTES
- Relevant canonical sections:
- Explicit exclusions:
- Privacy/permission/release impact:

REQUEST
Independently inspect the current parent batch issue, child issue, AGENTS.md,
canonical documentation, complete pull request diff, checks, review conversations,
mergeability, base state, and current head SHA.

Use the Play Plus Codex review format. Judge only blocker or required in-scope fixes.
If DECISION is APPROVE, HUMAN DECISION REQUIRED is 없음, and the batch authority
remains valid, merge using the authorized method and the reviewed expected head SHA.
Return the merge result and next authorized issue in BATCH RELAY HANDOFF.
```

Codex의 요약은 탐색 시작점일 뿐 승인 근거를 대체하지 않는다.

## ChatGPT review and merge gate

ChatGPT는 가능한 경우 GitHub에서 다음을 직접 확인한다.

1. 부모 Issue의 authorization, 순서, merge method와 control state
2. 현재 하위 Issue의 전체 계약
3. `AGENTS.md`와 관련 canonical documentation
4. PR base, head branch와 현재 head SHA
5. 전체 changed files와 complete diff
6. PR 본문과 Issue 연결
7. GitHub checks와 workflow run 상태
8. review submission, inline thread와 unresolved conversation
9. mergeability와 base branch 이동
10. Codex가 제출한 정확한 로컬 검증 결과

병합 조건은 다음과 같다.

- 현재 Issue가 승인 목록의 첫 번째 미완료 항목이다.
- PR이 정확히 현재 Issue 하나만 구현한다.
- PR이 Draft가 아니고 merge conflict가 없다.
- Issue, `AGENTS.md`와 canonical documentation을 충족한다.
- 필수 CI와 검증이 통과했다.
- required review thread가 남아 있지 않다.
- 검토한 head SHA가 병합 시점에도 동일하다.
- base 변경이 유효성에 영향을 주지 않거나 다시 검토되었다.
- 개인정보, 권한, 외부 전송, 릴리스·배포 또는 기타 human-decision boundary를 넘지 않는다.
- `HUMAN DECISION REQUIRED`가 `없음`이다.

가능한 경우 병합 요청에 reviewed expected head SHA를 전달한다. head가 이동하면 이전 승인을 재사용하지 않는다.

GitHub auto-merge, 별도 merge Action 또는 bot을 새로 활성화하지 않는다. Batch Relay의 merge는 ChatGPT가 모든 조건을 확인한 뒤 현재 응답에서 명시적으로 실행한다.

같은 GitHub 계정이 PR 작성자이거나 사용 가능한 도구가 formal approval review를 만들지 못하는 경우, GitHub의 Approve submission 자체를 필수 조건으로 두지 않는다. 필수 게이트는 **현재 head SHA에 결부된 ChatGPT의 `APPROVE` 판정과 성공한 merge 결과**다.

## Review result handling

ChatGPT는 기존 Play Plus Codex 협업 형식을 유지한다.

```text
DECISION
APPROVE | CHANGES REQUIRED | INSUFFICIENT EVIDENCE

EVIDENCE
...

RATIONALE
...

SCOPE
...

OUT OF SCOPE
...

ACCEPTANCE CRITERIA
- ...: MET | PARTIAL | NOT MET | UNKNOWN

RISKS
...

HUMAN DECISION REQUIRED
없음 또는 사람이 결정해야 할 정확한 사항과 권장안

BATCH RELAY HANDOFF
Merge status: MERGED | NOT MERGED
Reviewed head SHA: <sha>
Merge SHA: <sha or none>
Next issue: #<number> | FINAL REVIEW | NONE
Required Codex action: ...
```

처리 우선순위는 다음과 같다.

1. `HUMAN DECISION REQUIRED`가 `없음`이 아니면 `DECISION`과 관계없이 즉시 `PAUSED`로 전환한다.
2. `CHANGES REQUIRED`면 같은 branch와 PR에서 지정된 범위만 수정하고 새 head SHA로 재검토를 요청한다.
3. `INSUFFICIENT EVIDENCE`면 요청된 증거만 확보하고 현재 Issue를 유지한다.
4. `APPROVE`지만 `Merge status`가 `NOT MERGED`면 병합 장애를 해결하거나 증거를 보완한 뒤 같은 Issue로 다시 요청한다.
5. `APPROVE`이고 `MERGED`면 Codex가 GitHub의 실제 merge 상태를 확인한 뒤 다음 단계로 진행한다.

새 제품 결정이나 후속 개선을 required fix로 몰래 추가하지 않는다. 현재 Issue 밖 개선은 배치를 막지 않고 최종 보고의 non-blocking follow-up 후보로만 기록한다.

## Corrections

`CHANGES REQUIRED`를 받으면 Codex는 다음을 수행한다.

- 같은 Issue, branch와 PR을 유지한다.
- 지적된 in-scope 결함만 수정한다.
- 영향받는 검증과 Issue가 요구하는 전체 필수 검증을 다시 실행한다.
- 새 head SHA를 기록한다.
- GitHub CI가 terminal PASS가 된 뒤 새 complete diff와 결과로 다시 요청한다.

새 head에는 이전 APPROVE가 적용되지 않는다. 구현 결함 수정은 필요한 만큼 반복할 수 있지만, 수정 과정에서 계약 변경이 필요해지면 사람 결정을 요청한다.

## Merge confirmation and handoff

ChatGPT가 `MERGED`를 반환해도 Codex는 다음을 독립 확인한다.

1. PR이 GitHub에서 merged 상태다.
2. merge SHA가 존재한다.
3. 원격 `main`에 merge 결과가 포함되어 있다.
4. 현재 작업 트리에 미보존 변경이 없다.

확인 후 부모 Issue의 현재 항목을 완료 처리하고 다음 형식의 comment를 남긴다.

```text
BATCH RELAY MERGE RECORD

Child issue: #<issue>
Pull request: #<pr>
Reviewed head SHA: <sha>
Merge SHA: <sha>
Validation: <summary>
Next issue: #<issue> | FINAL REVIEW
```

그 다음 최신 `origin/main`을 fetch하고 새 Issue 브랜치를 만든다. attempted merge, pending merge 또는 대화상의 APPROVE만으로 다음 Issue를 시작하지 않는다.

## Final integration issue

부모 Issue의 마지막 항목은 배치 전체 통합 검증 Issue다. 최신 `main`에서 다음을 수행한다.

- 부모와 최종 Issue가 지정한 전체 type-check, lint, test와 build
- 필요한 실제 Chrome smoke 또는 E2E
- 하위 Issue 사이의 데이터·공개 동작·UI 흐름 연결 확인
- canonical documentation과 구현의 일치 확인
- clean working tree와 최종 `main` SHA 확인

통합 결함을 수정해야 하고 그 수정이 최종 Issue의 승인 범위 안이라면 최종 Issue branch와 PR을 만들어 일반 `BATCH RELAY REVIEW` loop를 따른다.

코드 변경 없이 검증만 완료되면 Codex는 다음 형식으로 ChatGPT에 요청한다.

```text
BATCH RELAY FINAL REVIEW

REPOSITORY
saramkim/play-plus

PARENT BATCH ISSUE
#<number>
<url>

FINAL INTEGRATION ISSUE
#<number>
<url>

FINAL MAIN
SHA: <sha>

COMPLETED ISSUES AND PRS
- #<issue> via #<pr>, merge <sha>

FINAL VALIDATION
- `<exact command>`: PASS / FAIL / NOT RUN
- Manual smoke: ...

UNKNOWN
- None
or
- ...

REQUEST
Verify the parent contract, merged PR set, final issue acceptance criteria,
current main SHA, and actual validation evidence.

Use the Play Plus Codex review format. If complete, return APPROVE with
BATCH RELAY HANDOFF Next issue: NONE. Do not perform release or deployment.
```

ChatGPT가 최종 `APPROVE`를 반환하고 human decision이 없으면 Codex는 최종 검증 Issue와 부모 Issue를 종료하고 `Control state`를 `COMPLETED`로 갱신한다.

## Human-decision boundaries

부모 Issue에서 구체적으로 이미 승인되지 않았다면 다음 경우 배치를 중지한다.

- 제품 목표, 사용자 흐름, Scope 또는 acceptance criteria 변경
- 현재 Issue에 없는 기능 추가
- Chrome permission 또는 host access 확대
- 개인정보 수집, telemetry, 계정, 결제 또는 외부 전송
- 손실 가능성이 있는 migration
- 공개 API, 메시지, 저장 형식 또는 호환성 계약 변경
- 새로운 외부 서비스
- 대규모 의존성 또는 빌드 체계 변경
- 보안 정책 완화
- 릴리스, version, tag, store submission 또는 production deployment
- 승인된 Issue 목록, 순서, merge method 또는 자동화 권한 변경
- 최종 검증 Issue가 허용하지 않은 통합 수정
- 필수 검증이 실행되지 않았는데 통과로 간주해야 하는 경우

이때 Codex는 구현과 merge progression을 중지하고 부모 Issue를 `PAUSED`로 갱신한다. ChatGPT는 `HUMAN DECISION REQUIRED`에 정확한 결정 사항, 근거와 권장안을 적는다.

## Stop, expiry, and recovery

`BATCH RELAY STOP #<parent>`를 받으면 Codex는 새 commit, push, PR 또는 다음 Issue 시작을 중지하고 부모 Issue를 `PAUSED`로 갱신한다. 안전한 상태 기록을 위한 comment 외의 외부 쓰기는 하지 않는다.

자동화 권한은 다음 중 하나가 발생하면 만료된다.

- 모든 승인된 Issue와 최종 통합 검증 완료
- 부모 Issue가 `COMPLETED` 또는 `CANCELLED`
- 사람이 권한을 철회
- 승인 목록, 순서, merge method, Scope, acceptance criteria 또는 경계의 실질적 변경
- 해결되지 않은 human decision
- 별도 승인 없는 릴리스 또는 배포 단계 진입

Codex 실행이 실제 도구·세션 제한으로 끝났다면 현재 Issue, PR, head SHA, CI와 부모 상태를 comment로 기록하고 `PAUSED`로 둔다. 사람은 같은 명령으로 새 Codex 세션에서 재개할 수 있다.

```text
BATCH RELAY RUN #<parent-batch-issue-number>
```

ChatGPT는 GitHub를 백그라운드에서 감시하지 않는다. Codex가 각 PR과 최종 검증을 현재 실행 중에 ChatGPT에 직접 전달해야 한다.

## Batch completion report

완료 시 Codex는 사람에게 다음 보고서를 제공한다.

```text
BATCH RELAY COMPLETION REPORT

PARENT BATCH ISSUE
#<number>

FINAL MAIN SHA
<sha>

COMPLETED ISSUES
- #<issue> via PR #<pr>, reviewed head <sha>, merge <sha>
- #<final-verification-issue>: completed without code changes

FINAL VALIDATION
- `<command>`: PASS / FAIL / NOT RUN

CORRECTION ROUNDS
- PR #<number>: <count>

HUMAN DECISIONS
- None
or
- ...

UNKNOWN
- None
or
- ...

NON-BLOCKING FOLLOW-UP CANDIDATES
- None
or
- ...

RELEASE / DEPLOYMENT
- Not performed
```

사람은 이 최종 보고와 GitHub 기록을 한 번에 확인한다.
