---
name: askill-create-lane
description: Plan one lane from registered issues, with source provenance, evidence-backed dependencies, and scoped execution grants.
---

# Create a lane

확정 이슈 artifact, 명시한 이슈 ID, 설명으로 수집한 이슈 중 하나를 받는다. 세 경로 모두 이슈를 읽기 조회한 뒤 동일한 확정 artifact로 정규화한다. 빈 목록, 중복, 해석 불가 대상은 거부한다. 관련 이슈 추천은 요청한 경우에만 한다.

독립 이슈는 병렬로 둔다. A의 결과 없이는 B의 완료 조건을 만족할 수 없을 때만 의존성을 추가하고 이유를 남긴다. 예상 파일 충돌은 별도로 기록한다.

기준 브랜치, 원본 이슈 집합, 의존성, 재시도 정책, 부작용별 권한을 `.askill/lanes/<lane-id>/plan.json`에 고정한다. 브랜치·worktree 생성, 구현, push, 머지는 이 단계의 일이 아니다.
