# Keep type-only imports out of the runtime graph

## When to read

Read when a TypeScript module uses a contract from another module but not its values, particularly when the provider has startup side effects.

## Decision

Use a whole-statement `import type` for a purely type-level dependency. With TypeScript 5.0+ and `verbatimModuleSyntax`, an inline-only `type` specifier can emit an empty import that still loads the provider.

## Bad

```ts
import { type Report } from "./reports.js";

export function label(report: Report): string {
  return report.title;
}
```

## Good

```ts
import type { Report } from "./reports.js";

export function label(report: Report): string {
  return report.title;
}
```

## Assumptions and trade-offs

This example is a Node ESM TypeScript project that emits `.js`. The companion module exports `type Report = { title: string }`. Other compiler flags can elide the bad import, so use the actual build path when proving runtime behavior. If startup is intentional, import it explicitly at the composition root rather than relying on a type reference to retain it. Type-only imports cannot supply runtime values such as constructors.

## Verification

In a scratch build with `verbatimModuleSyntax`, have the companion module throw on evaluation and import just `label` from the emitted module. **Pass:** the good output contains no `reports.js` import, and calling `label({ title: "Draft" })` returns `"Draft"` without evaluating the companion.
