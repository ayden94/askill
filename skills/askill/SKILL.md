---
name: askill
description: Route repository work from scope agreement through issues, lane execution, review, and retrospective. Use to start or resume askill work.
---

# askill

Check the target Git root and `.askill/config.json`. Route to `askill-init` only if the project has no configuration. Do not repeat setup or ask about destinations for each lane. Changing an existing configuration is a separate, explicitly requested task.

| Situation | Skill |
| --- | --- |
| The problem or scope is not yet agreed | `askill-scope` |
| Issue drafts are agreed, or existing issues need linking | `askill-issues` |
| Confirmed issues are ready to group | `askill-create-lane` |
| A lane is ready to start or resume | `askill-execute-lane` |
| All issues are done and follow-up recommendations are needed | `askill-retro` |

A stage name is not an authorization grant. If an adapter or runner is unavailable, do not mark the stage complete. Use `scripts/cli.mjs` and `references/cli.md` from the installed `askill-init` skill. In stage instructions, `askill <command>` means running that script with Node.js. Check the recorded result before advancing; a completion message alone is not evidence.
