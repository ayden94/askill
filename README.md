# askill

askill helps coding agents take an issue from an agreed scope to a reviewed commit. Group related issues into a **lane**: each issue gets its own implementation contract and worktree, and the lane keeps enough state to resume in a new session.

## Install once

You need Node.js 22 or later, Git, and GitHub credentials with access to this private repository. Install the full skill set globally and select your agent when prompted:

```bash
npx skills@latest add ayden94/askill --global --skill '*'
```

The `askill-init` skill includes the CLI and templates. You do not need to clone askill or install an npm package in your project.

## Start in a project

1. **Once per Git repository:** ask your agent, “Use `askill-init` to set up this project.” Confirm the project type, languages, frameworks, and destinations for issues, pull or merge requests, and tickets. Local-only work is supported.
2. **For each new task:** ask, for example, “Use `askill` to prevent duplicate saves.” Agree on the scope, register or link issues, and group them into a lane.
3. **To resume:** ask the agent to continue the existing lane. It checks Git and the configured provider before choosing the next action.

## What counts as done?

Before implementation, **preflight** records what must change, what must stay the same, and how to check both. Three independent reviewers then assess the **contract**, **code quality**, and **verification evidence** against the same commit. A fix produces a new head and requires fresh review. Open Code Review (`ocr`) is an optional extra, not a substitute for any reviewer.

A local lane can finish at the verified commit. Remote publication requires separate permission. Once all issues finish, one retrospective recommends follow-up work without opening issues or changing project rules.

## Project files

askill stores configuration, conventions, lane plans, and evidence under `.askill/`. Initialization seeds shared rules plus only the selected project, language, and framework guides. Each language has its own testing guide: a Python API using FastAPI does not get frontend or JavaScript rules. Edit `.askill/convention/` and commit the rules you want implementers and reviewers to share. Initialization preserves existing edits and leaves your Git ignore rules alone.

[CLI reference](skills/askill-init/references/cli.md) · [Workflow and state layout](docs/workflow.md) · [Local example](examples/local/)

To run the test suite from the askill repository: `node --test`.
