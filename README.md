# askill

이슈 하나 또는 여러 개를 **lane**으로 묶어 구현하고, 같은 커밋을 기준으로 검증하는 CLI와 에이전트 스킬이에요. 특정 에이전트 호스트나 GitHub에 묶이지 않아서 로컬 Git 저장소만으로도 시작할 수 있어요.

```text
프로젝트 설정 → 범위 합의 → 이슈 등록 → lane 생성
  → 이슈별 preflight → 구현 → 3축 리뷰 → 필요 시 PR/MR
```

## 빠른 시작

Node.js 22 이상과 Git이 필요해요. 의존성 설치나 원격 계정 없이 CLI를 실행할 수 있어요. 아래 예시는 기본 브랜치가 `main`이고 기준 커밋이 있는 로컬 저장소를 사용해요. 다른 브랜치라면 설정 예시의 `base_branch`를 수정하세요.

```bash
git clone https://github.com/ayden94/askill.git
cd askill
node src/cli.mjs --help

target=/absolute/path/to/your-repo
node src/cli.mjs init --root "$target" --input examples/local/config.json

printf '%s\n' '{"intake_id":"save","problem":"저장 중 중복 요청이 나간다","drafts":[{"draft_id":"prevent-duplicate","title":"중복 저장 방지"}]}' |
  node src/cli.mjs scope --root "$target" --input -
printf '%s\n' '{"artifact_id":"save","intake_id":"save"}' |
  node src/cli.mjs issues --root "$target" --input -
printf '%s\n' '{"lane_id":"save","artifact_id":"save","authority_scope":{"local_commit":true}}' |
  node src/cli.mjs create-lane --root "$target" --input -
printf '%s\n' '{"lane_id":"save"}' |
  node src/cli.mjs import-lane --root "$target" --input -
printf '%s\n' '{"lane_id":"save"}' |
  node src/cli.mjs plan-all --root "$target" --input -
```

위 예시는 로컬 이슈를 등록하고 lane의 다음 작업을 보여줘요. 구현이나 커밋을 바로 실행하지는 않아요. 에이전트 호스트에서는 [`skills/`](skills/)의 `askill`을 진입점으로 사용하세요. 호스트가 `plan`의 작업을 배정하고, CLI는 `record`로 받은 결과가 승인된 계약과 현재 커밋에 맞는지 검사해요. 명령별 입력은 [CLI 가이드](docs/cli.md)에 있어요.

## 프로젝트에 저장되는 파일

```text
.askill/
├── config.json               # 이슈·PR/MR·티켓 목적지와 프로젝트 정책
├── convention/               # 편집 가능한 공통·프론트엔드·백엔드·테스트 규칙
├── intakes/                  # 범위 합의와 이슈 초안
├── issues/                   # 확인된 이슈 목록
├── lanes/<lane-id>/
│   ├── plan.json             # 이슈 구성·의존성·실행 권한
│   └── state.json            # 실행 상태·재시도·검증 기록 참조
└── work/                     # 이슈별 계약과 검증 근거
```

`init`은 빠진 컨벤션 초안만 만들고 기존 편집을 덮어쓰지 않아요. 편집한 규칙을 기준 브랜치에 커밋하면 구현자와 리뷰어가 같은 버전을 읽어요. **Git에 포함할지는 사용자가 결정해요.** askill은 `.gitignore`나 `info/exclude`를 자동으로 바꾸지 않아요. 설정과 실행 기록을 공유하기 전에는 민감한 정보가 없는지 확인하세요.

이전 레이아웃에서 만든 lane은 `import-lane`을 다시 실행하면 기존 상태를 보존한 채 새 폴더로 가져와요. 기존 파일은 자동으로 삭제하지 않아요.

## 어떻게 검증하나요?

- **Preflight:** 무엇을 바꾸고 유지할지, 무엇을 관찰해야 완료인지 합의해요. 프로젝트 문서가 없는 경우에도 시작할 수 있어요.
- **3축 리뷰:** 독립 리뷰어가 같은 커밋에서 계약 충족, 코드 품질과 컨벤션 준수, 검증 근거를 확인해요. 수정해서 커밋이 바뀌면 이전 판정을 재사용하지 않아요.
- **선택 도구:** Open Code Review(`ocr`)는 설치되어 있고 diff 전송 권한이 있을 때만 추가로 실행해요. 원격 이슈나 PR/MR이 필요할 때만 `gh` 또는 `glab`을 사용해요. 머지와 정리는 호스트가 별도 권한으로 처리하고, 티켓은 목적지만 설정해요.

[워크플로 계약](docs/workflow.md) · [Fluo에서 가져온 구조](docs/fluo-port.md) · [로컬 예시](examples/local/)

개발 검증: `node --test`
