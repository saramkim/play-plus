# Play Plus 문서 안내

> **현재 문서와 과거 기록을 분리합니다.** 현재 작업에서는 최신 `main`, `AGENTS.md`와 승인된 Issue를 우선합니다. 오래된 설계·검증 기록은 별도 아카이브에 보존하며 자동으로 다시 실행하거나 승인된 제품 계약으로 취급하지 않습니다.

## 현재 사용하는 문서

| 문서 | 역할 |
| --- | --- |
| [프로젝트 README](../README.md) | 제품 소개, 개발 기준과 설치 안내 |
| [AGENTS.md](../AGENTS.md) | 현재 코드·Git·검증 작업 규칙 |
| [새 2.0 기획 초안](./play-plus-2.0-planning.md) | **DRAFT**: v1.12.0을 출발점으로 A 기능과 사용자 피드백을 정리. 개별 기능 구현 승인이 아님 |
| [피드백 서비스 운영](./feedback-service.md) | Issue #128의 API, 개인정보, 보관 및 운영·릴리스 게이트. 운영 상태는 사용 시점에 다시 확인 |
| [릴리스 스모크 체크리스트](./manual-smoke-test.md) | 다음 릴리스의 **빈 검증 양식**. 18개 기존 핵심 항목과 피드백 조건부 확인. 과거 PASS를 승계하지 않음 |

## 과거 기록: [docs/archive/](./archive/README.md)

| 기록 | 보관 위치 |
| --- | --- |
| v1.12.0 릴리스 실행 결과 (2026-10-13) | [릴리스 증거](./archive/releases/v1.12.0-smoke-test.md) |
| Issue #128 피드백 구현 당시 검증 (2026-10-15) | [피드백 검증](./archive/feedback/2026-10-15-issue-128-validation.md) |
| Coupang Play 영상 생명주기 설계 (2026-07-11) | [과거 설계](./archive/lifecycle/2026-07-11-coupang-video-lifecycle-design.md) |
| 해당 구현 계획과 에이전트 체크리스트 (2026-07-11) | [과거 계획](./archive/lifecycle/2026-07-11-coupang-video-lifecycle-plan.md) |

기존 미배포 2.0 전체 코드는 별도의 [archive/play-plus-2.0 브랜치](https://github.com/saramkim/play-plus/tree/archive/play-plus-2.0)에 보존되어 있습니다. 그 안의 [과거 2.0 canonical 계약](https://github.com/saramkim/play-plus/blob/archive/play-plus-2.0/docs/play-plus-2.0.md)은 **현재 제품 계약이 아닙니다.**

## 유지 원칙

1. `main`은 개발 기준이고 배포 버전은 별도의 릴리스 태그·실제 Chrome 웹 스토어 게시 상태로 구분합니다.
2. 2.0의 새 제품 결정은 우선 기획 초안에 기록하고 사용자 승인 후 별도 canonical 계약과 구현 Issue로 구체화합니다.
3. 아카이브는 당시 관찰·검증의 출처로만 사용합니다. PASS/NOT RUN, 환경, 과거 실행 지시는 현재 작업 결과나 권한을 대신하지 않습니다.
4. 새로운 릴리스는 [릴리스 체크리스트](./manual-smoke-test.md)에 **새 빌드의 실제 결과**를 기록하고 완료된 검증 기록을 아카이브에 보존합니다.
5. 피드백 기능의 코드 병합은 공개 배포·수집 개시를 뜻하지 않습니다. 운영 및 개인정보 승인 게이트를 별도로 확인합니다.
