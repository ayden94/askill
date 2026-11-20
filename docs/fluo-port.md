# Porting the Fluo lane

The port uses FluoJS as its reference, pinned in [NOTICE-Fluo.md](../NOTICE-Fluo.md). It does not import from a local Fluo checkout at runtime. It adapts the lane contracts and decision order, rather than copying Fluo-specific CLI and test infrastructure as an opaque dependency.

| Fluo source | Port boundary |
|---|---|
| `.agents/skills/create-lane/` and `.agents/workflow-contracts/` | Keep canonical intake, plan validation, approved-plan provenance, dependency reasons, and atomic publication. Parameterize the state root and issue identity. |
| `.agents/skills/execute-lane/scripts/lane-v4.mjs` | Port the pure decision engine and its relevant existing tests before changing policy. Preserve the observe → plan → act → record interface, bounded retries, and decision semantics. |
| `.agents/skills/execute-lane/scripts/lane-v4-cli.mjs` | Preserve CLI, file, and observation boundaries. Split provider-specific observation and writes from Git facts and locked ledger storage. |
| `workflow-preparation.mjs` and the preflight, implement, and review contracts | Keep issue/base binding, exact-head evidence, input admission, and review invalidation. Replace Fluo-owned docs roots and package/CI policies with project policy and locally observable evidence. |
| `dispatch-targets.mjs` and `sync-pr` | Map role IDs and provider operations at host/forge boundaries rather than baking registered agents and GitHub into the engine. |

Deliberate differences: `.askill/` replaces the runtime root; GitHub is not mandatory; OCR adds a separately recorded review receipt; three independent fresh axes are required rather than Fluo's selective-axis or explanatory-doc retention policy. Preserve planning-to-execution import rather than collapsing both ledgers without test evidence.

Port acceptance: run the imported decision-engine cases and one local-only lane in a temporary Git repository with no project docs, forge, or OCR; restart the coordinator mid-lane; fail a review then fix back; verify no stale review admits a changed head and no unauthorized remote action is proposed.
