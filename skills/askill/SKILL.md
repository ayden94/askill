---
name: askill
description: Route repository work from scope agreement through issues, lane execution, review, and retrospective. Use to start or resume askill work.
---

# askill

대상 Git 프로젝트의 루트와 `.askill/config.json`을 확인한다. 설정이 없을 때만 프로젝트 최초 설정인 `askill-init`으로 안내한다. 이미 설정된 저장소에서 lane마다 초기화를 실행하거나 목적지를 다시 묻지 않는다. 설정 변경은 명시적으로 요청된 별도 작업이다.

| 상황 | 스킬 |
|---|---|
| 아직 해결할 문제나 이슈 범위가 미합의 | `askill-scope` |
| 이슈 초안이 합의됐거나 기존 이슈를 가져옴 | `askill-issues` |
| 확정된 이슈를 실행 단위로 묶음 | `askill-create-lane` |
| 준비된 lane을 시작하거나 재개 | `askill-execute-lane` |
| 모든 이슈가 종료된 lane에서 후속 추천 확인 | `askill-retro` |

단계 이름은 실행 권한이 아니다. 누락된 어댑터나 실행기는 건너뛰어 완료한 것으로 기록하지 않는다.

설치된 `askill-init` 스킬에서 CLI(`scripts/cli.mjs`)와 상세 명령(`references/cli.md`)을 찾는다. 하위 스킬의 `askill <command>`는 이 스크립트를 `node`로 실행한다는 뜻이다. 현재 단계가 끝났다는 답변만으로 다음 단계로 넘기지 말고 CLI에 기록된 결과를 확인한다.
