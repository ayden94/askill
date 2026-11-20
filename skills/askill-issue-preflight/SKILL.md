---
name: askill-issue-preflight
description: Bind one lane issue to an approved implementation contract and observable acceptance criteria before editing.
---

# Preflight one issue

이슈의 스냅샷과 기준 커밋을 확인한다. 프로젝트 문서가 있으면 먼저 적용한다. 없으면 합의된 이슈와 현재 관찰 가능한 동작·호출부·테스트를 읽되, 기존 동작을 자동으로 보장으로 승격하지 않는다.

`plan.convention`이 있으면 기준 커밋에서 색인을 읽고 변경 범위에 맞는 문서만 고른다. 출처와 적용 범위를 계약에 `conventions`로 기록한다. 색인과 연결 문서는 `git show <base_sha>:<path>`로 같은 커밋에서 읽는다. 색인이 없으면 기존 프로젝트 지침을 적용하고, 규칙이 충돌하면 preflight에서 해결한다.

목표, 변경 범위, 유지 조건, 비목표, 예상 변경 경로, 조건별 검증 방법과 기대 결과를 제시한다. 판단이 필요한 보장과 미결 결정을 구현 전에 확정한다. 문서 부재 자체는 차단 사유가 아니다.

승인된 계약을 이슈와 기준 커밋에 묶어 보관한다. 요구가 달라지거나 계약 범위 밖 수정이 필요하면 다시 preflight 한다. 코드를 수정하거나 권한을 부여하지 않는다.
