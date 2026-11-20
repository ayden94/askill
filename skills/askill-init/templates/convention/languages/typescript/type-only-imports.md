# Keep type-only imports out of the runtime graph

**Invariant:** A module used only for types does not appear in emitted imports and cannot run startup code through that dependency.

**Compatibility — portable spelling across the TypeScript 5.0 emit boundary:** In TypeScript 3.8–4.9 and TypeScript 5.0+ use a whole-statement [`import type`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export) for a type-only edge; it is erased in both ranges. Inline `type` specifiers need [4.5+](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html#type-modifiers-on-import-names), and with [`verbatimModuleSyntax` in 5.0+](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) an inline-only import becomes `import {} from ...`, not zero imports.

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

In scratch Node ESM builds with and without `verbatimModuleSyntax` (omit the option before 5.0), have the companion module throw on evaluation and import just `label` from the emitted module. **Pass:** in either build the good output contains no `reports.js` import and `label({ title: "Draft" })` returns `"Draft"`. In a 5.0+ build with the option enabled, the bad example retains the empty import and triggers the throw.
