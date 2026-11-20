---
name: askill-execute-lane
description: Resume a lane by observing current state, taking one authorized action, and recording contract- and head-bound evidence.
---

# Execute a lane

계획 장부를 정확한 출처와 함께 실행 장부 `.askill/lanes-v4/<lane-id>.json`으로 가져온다. 가져오기는 권한을 확장하거나 실행 중 장부를 초기화하지 않는다.

1. Git과 설정된 제공자에서 상태를 새로 관찰한다.
2. 엔진이 고른 행동 하나를 단계에 전달한다. 독립 이슈는 각 worktree에서 병렬 실행할 수 있다.
3. 리드만 결과를 검증해 공유 장부에 기록한다. 다시 관찰하고 다음 행동을 고른다.

단계: `askill-issue-preflight` → `askill-issue-implement` → `askill-review-head` → 권한과 목적지가 있을 때 `askill-sync-pr`. 구현 결함은 같은 이슈 작업 공간에서 수정하고 새 head를 다시 리뷰한다. 입력·호스트 오류는 코드 결함으로 돌리지 않는다.

`askill import-lane` 후 `askill plan` / `askill plan-all`을 사용하고, 실제 결과는 `askill record`로 입력한다. CLI가 설치되지 않았다면 askill 프로젝트의 `node src/cli.mjs`를 사용한다. 해당 명령과 JSON 예시는 배포 묶음의 `docs/cli.md`에 있다. 에이전트 호출 도구가 없으면 승인된 독립 사람 리뷰를 받을 수 있지만, 같은 작업자가 세 역할을 대신했다고 기록하지 않는다.
