---
name: askill-init
description: Establish or check one project's independent issue, pull request, and ticket destinations before askill work.
---

# Initialize a project

1. Git 루트, remote, 기본 브랜치, 기존 프로젝트 지침을 읽기 전용으로 확인한다.
2. 사용자에게 이슈 등록처, PR/MR 대상 저장소와 브랜치, 티켓 관리처를 별개로 확인한다. 로컬 이슈와 PR·티켓 미사용도 정상이다.
3. 확인된 값만 `.askill/config.json`에 기록한다. 기존 설정과 관찰이 다르면 덮기 전에 차이를 보여준다. 토큰이나 키는 저장하지 않는다.
4. 실행 기록의 Git 제외 여부를 확인한다. 필요한 호스트 기능을 보고하되 도구를 자동 설치하거나 원격 쓰기를 하지 않는다.
