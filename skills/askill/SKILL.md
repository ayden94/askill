---
name: askill
description: Route repository work from setup and scope agreement through issue registration, lane planning, implementation, and review. Use to start or resume askill work.
---

# askill

대상 Git 프로젝트의 루트와 `.askill/config.json`을 확인한다. 저장소 규칙은 그 프로젝트에서 읽는다.

| 상황 | 스킬 |
|---|---|
| 준비가 없거나 목적지가 바뀜 | `askill-init` |
| 아직 해결할 문제나 이슈 범위가 미합의 | `askill-scope` |
| 이슈 초안이 합의됐거나 기존 이슈를 가져옴 | `askill-issues` |
| 확정된 이슈를 실행 단위로 묶음 | `askill-create-lane` |
| 준비된 lane을 시작하거나 재개 | `askill-execute-lane` |

단계 이름은 실행 권한이 아니다. 누락된 어댑터나 실행기는 건너뛰어 완료한 것으로 기록하지 않는다.

명령과 입력은 askill 배포 묶음의 `docs/cli.md`를 참조한다. 현재 단계가 끝났다는 답변만으로 다음 단계로 넘기지 말고 CLI에 기록된 결과를 확인한다.
