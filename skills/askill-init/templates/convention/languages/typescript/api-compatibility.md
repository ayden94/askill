# Preserve public call shapes when adding an option

## When to read

Read before changing the declaration of a published function when existing consumers import it without coordinated upgrades.

## Decision

Compare old consumer calls and observable behavior against the built replacement. Adding an options object by replacing a positional parameter breaks existing calls even if the resulting implementation can perform the same operation.

## Bad

```ts
// Replaces the previously published formatLabel(label: string): string.
export function formatLabel(options: { label: string; uppercase?: boolean }): string {
  return options.uppercase ? options.label.toUpperCase() : options.label;
}
```

## Good

```ts
export type LabelOptions = { uppercase?: boolean };

export function formatLabel(label: string, options?: LabelOptions): string {
  return options?.uppercase ? label.toUpperCase() : label;
}
```

## Assumptions and trade-offs

The existing function returned its input unchanged and consumers do not reflect on its arity. An optional trailing argument is an additive call shape here. If the old form is inadequate, keep it as a documented adapter or plan a breaking release. Do not assume every additive declaration change is compatible: adding alternatives to a returned union can break exhaustive consumers.

## Verification

Build declarations and execute a fixture importing through the public package entry, not the source file. Include an unchanged one-argument caller and a new caller using `uppercase`. **Pass:** both typecheck against the shipped declarations and return `"Draft"` and `"DRAFT"` respectively for `"Draft"`.
