---
name: askill-init
description: Establish or check one project's independent issue, pull request, and ticket destinations before askill work.
---

# Initialize a project

Run the CLI from this installed skill, not from the target project:

```bash
node "<installed askill-init directory>/scripts/cli.mjs" init --root "<target Git project>" --input "<config JSON path>"
```

Use absolute paths, or `--input -` to pass JSON on stdin. See the [CLI reference and configuration example](references/cli.md).

1. Inspect the Git root, remotes, default branch, and existing project guidance without writing to them.
2. Confirm the issue tracker, PR/MR destination repository and branch, and ticket system separately. Local issues with no PR or ticket destination are valid.
3. Write only confirmed values to `.askill/config.json`. If existing settings differ from what you observe, show the difference before replacing anything. Never store tokens or keys.
4. `askill init` creates an index and editable common, frontend, backend, and testing guides in `.askill/convention/`. It preserves existing files. To share rules with implementers and reviewers, include the project-specific versions in the base branch.
5. The user decides what to track in Git. Do not edit `.gitignore` or Git's local excludes. Report missing host capabilities; do not install tools or write to a remote.
