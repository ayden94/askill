---
name: askill-init
description: Establish or check one project's independent issue, pull request, and ticket destinations before askill work.
---

# Initialize a project

1. Git 루트, remote, 기본 브랜치, 기존 프로젝트 지침을 읽기 전용으로 확인한다.
2. 사용자에게 이슈 등록처, PR/MR 대상 저장소와 브랜치, 티켓 관리처를 별개로 확인한다. 로컬 이슈와 PR·티켓 미사용도 정상이다.
3. 확인된 값만 `.askill/config.json`에 기록한다. 기존 설정과 관찰이 다르면 덮기 전에 차이를 보여준다. 토큰이나 키는 저장하지 않는다.
4. `askill init`은 `.askill/convention/`에 색인과 공통·프론트엔드·백엔드·테스트 초안을 만든다. 기존 파일은 보존한다. 프로젝트에 맞게 편집하고 기준 브랜치에 포함해야 lane이 같은 버전을 참조한다.
5. Git에 포함할 파일은 사용자가 결정한다. `.gitignore`나 Git 로컬 제외 설정을 자동 수정하지 않는다. 필요한 호스트 기능은 보고하되 도구를 설치하거나 원격에 쓰지 않는다.
