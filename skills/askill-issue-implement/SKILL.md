---
name: askill-issue-implement
description: Implement one approved issue or fix confirmed blockers in the assigned worktree without remote writes.
---

# Implement one issue

승인된 계약과 할당된 worktree를 확인한다. 해당 범위만 구현하고 정확한 검증 명령·종료 코드·관찰 결과·미실행 항목을 반환한다. 범위 밖 수정이 필요하면 멈추고 preflight로 돌려보낸다.

할당에 `convention`이 있으면 작업 전에 해당 `base_sha`의 색인과 계약에서 선택한 규칙 원문을 읽고 적용한다. 작업 브랜치에서 수정한 문서로 기준을 대체하지 않는다.

리뷰 대상은 확인 가능한 로컬 커밋이다. 커밋 권한이 있는 실행만 그 커밋을 만들고, 없으면 승인된 커밋을 기다린다. 이 단계는 push, PR 등록, 머지, 리뷰 통과 판정을 하지 않는다.
