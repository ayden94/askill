---
name: askill-retro
description: Produce one evidence-based retrospective after a lane finishes, recommending separate follow-up issues or project conventions.
---

# Review the completed lane

작업 중 범위 밖 발견이나 반복되는 검증 마찰이 보이면 진행을 억지로 확장하지 말고 `retro-note`로 근거와 다음 작업 후보를 남긴다. 현재 계약을 깨는 결함이나 필수 검증 누락은 회고로 미루지 않는다.

1. `retro-plan`을 실행한다. `wait-lane`이면 진행 중인 이슈를 먼저 마무리한다. `done`이면 기존 회고를 반환하고 다시 작성하지 않는다.
2. `retro`이면 완료 결과, 현행 검증 근거, 기록한 후보를 읽는다. PR/MR이 있는 경우에는 접근 가능한 리뷰·CI를 읽기 전용으로 확인하고, 확인하지 못한 것은 구분한다.
3. 근거 있는 후보만 우선순위대로 추천한다. 완료 lane에서 해결하지 못한 기능·버그는 `follow-up-issue`, 재발을 줄일 테스트·작성 규칙은 `convention-change`로 분류한다. 후보가 없으면 빈 배열을 기록한다.
4. `record-retro`로 요약과 추천을 저장한다. 추천은 실행 권한이 아니다. 이슈 등록, 컨벤션 수정, 댓글 게시, 후속 lane 생성은 별도 요청이 있을 때만 한다.
