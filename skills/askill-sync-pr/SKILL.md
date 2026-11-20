---
name: askill-sync-pr
description: Publish the reviewed head to an authorized PR or MR destination without granting merge authority.
---

# Publish one reviewed head

설정된 목적지, 원격 쓰기 권한, 현재 head의 필수 검증 결과를 다시 확인한다. 이슈에 연결된 기존 PR/MR을 찾아 재개 시 중복 생성하지 않는다. push와 PR/MR 생성은 권한 범위 내에서만 수행하고 실제 원격 head와 ID를 다시 조회한다.

PR 목적지가 없는 로컬 프로젝트는 로컬 판정을 결과로 남긴다. 공개 승인, CI 통과, 머지, cleanup은 서로 별개다.
