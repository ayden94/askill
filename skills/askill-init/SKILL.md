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
2. **Infer the stack before asking questions.** Follow the [stack discovery guide](references/stack-discovery.md) in the target repository, including active workspace packages. Build `convention_profile` from the supported frameworks and implementation languages you find and pass it to `init`; do not ask the user to reconfirm clear evidence or classify the project as frontend or backend. Report the selection and its source paths. If a consequential ambiguity remains, ask only about that choice. Respect explicit overrides. Separately confirm unresolved destinations for issues, PRs/MRs, and tickets; source dependencies do not establish those destinations.
3. Write only confirmed values to `.askill/config.json`. If existing settings differ from what you observe, show the difference before replacing anything. Never store tokens or keys.
4. `askill init` writes an index and editable common guidance plus only the selected framework, language, and language-specific testing guides. Existing files are preserved. To share rules with implementers and reviewers, include the project-specific versions in the base branch.
5. The user decides what to track in Git. Do not edit `.gitignore` or Git's local excludes. Report missing host capabilities; do not install tools or write to a remote.
