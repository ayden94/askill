# askill

저장소별 운영 정책과 실행 환경을 분리한 이슈 → lane 작업 스킬 묶음.

```text
init → scope → issues → create-lane
                           └─ execute-lane
                                ├─ issue-preflight
                                ├─ issue-implement
                                ├─ review-head (필수 3축 + 선택 OCR)
                                └─ sync-pr (별도 권한)
```

- [`skills/`](skills/): `askill` 진입점과 단계별 `SKILL.md`. 배포 시 등록된 스킬 간 이름을 해석할 수 있게 묶음 전체를 사용한다.
- [`src/`](src/): CLI, 상태 저장, intake, lane 실행기, 원격·OCR 어댑터.
- [`docs/cli.md`](docs/cli.md): 설정부터 로컬 리뷰 완료까지 명령과 JSON 입력.
- [`docs/workflow.md`](docs/workflow.md): 각 단계의 입력·출력, 상태·승인 경계.
- [`docs/fluo-port.md`](docs/fluo-port.md): Fluo에서 그대로 유지할 구조와 교체할 환경 의존성.
- [`examples/local/`](examples/local/): 문서 없는 로컬 프로젝트의 설정·이슈·lane·preflight 예시. 실제 실행 증거가 아니다.

대상 프로젝트의 `.askill/config.json`에는 공유 가능한 목적지와 정책만 둔다. `.askill/intakes/`, `issues/`, `lanes/`, `lanes-v4/`, `work/`의 실행 데이터는 기본적으로 Git에서 제외한다. 회사별 규칙은 대상 프로젝트에서 읽고 비밀값은 기존 호스트 자격 증명 저장소에 둔다.

Node.js 22 이상과 Git이 필요하다. 추가 패키지 없이 `node src/cli.mjs --help`와 `node --test`를 실행할 수 있다. `--root`로 대상 프로젝트를 지정하고, 에이전트 호스트에서는 `skills/`와 CLI를 함께 사용한다. 독립 리뷰어 호출은 호스트가 맡고, CLI는 실제 결과가 현재 계약과 커밋에 맞는지 판정한다.

로컬 흐름은 원격 CLI 없이 작동한다. 원격 등록은 설정에 따라 `gh` 또는 `glab`, 추가 리뷰는 설치된 `ocr`를 사용한다. 티켓 목적지는 독립적으로 기록하며, 이슈/PR 어댑터가 티켓을 자동 수정하지는 않는다.
