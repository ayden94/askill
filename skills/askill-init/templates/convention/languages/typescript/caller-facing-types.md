# Use caller-facing types that preserve useful relationships

**Invariant:** Each valid key determines its return type, and a returned snapshot cannot mutate the source.

**Compatibility — portable within TypeScript 4.9+ with `strict` and ES2015+ runtimes:** [`keyof` and indexed access](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html#keyof-and-lookup-types) date to TS 2.1; no newer inference helper is needed. Compile the object spread for the selected runtime target. `Readonly` is erased; the copy and `Object.freeze` enforce this primitive-only snapshot at runtime.

## When to read

Read when exporting a new signature, replacing an assertion with a generic, or deciding whether to share data with a caller.

## Rules

- Start with the actual set of supported inputs. Use a generic when its parameter connects inputs to outputs or another input, not when a caller is merely invited to assert what return type they want.
- For key-based lookup over a finite object, constrain the key with `keyof` and preserve the association with indexed access `T[K]`. Untrusted dynamic strings still need a separate runtime check.
- Distinguish borrowed read-only data from an independent snapshot. A `Readonly` type is usually shallow and compile-time only, and does not prevent mutation through another reference.

## Error-prone

```ts
const defaults = { retries: 3, mode: "safe" };

function defaultFor<T>(key: string): T {
  return (defaults as Record<string, unknown>)[key] as T;
}

const attempts = defaultFor<number>("mode");
```

`attempts` is a string at runtime; an unknown key could also produce `undefined` despite the claimed return type.

## Recommended

```ts
type Settings = { retries: number; mode: "fast" | "safe" };
const defaults: Readonly<Settings> = { retries: 3, mode: "safe" };

function defaultFor<K extends keyof Settings>(key: K): Settings[K] {
  return defaults[key];
}

function settingsSnapshot(): Readonly<Settings> {
  return Object.freeze({ ...defaults });
}

const attempts = defaultFor("retries"); // number
const mode = defaultFor("mode"); // "fast" | "safe"
```

## Why and trade-offs

The caller gets a type determined by the key and cannot invent that type independently. The example also exposes a separate snapshot contract: a fresh object avoids aliasing and shallow freezing is sufficient for these primitive-valued fields. If only individual defaults are needed, there is no reason to export the snapshot function or pay for copies.

## Edge cases and exceptions

For nested settings, `Object.freeze` on the outer object is not a deep freeze. Copy or freeze the specific owned nested branches, or explicitly expose shared references. A union of valid keys returns a union of corresponding values; use a concrete signature if that is all the API needs. Open dictionaries may not contain a given key: return `undefined` or make absence otherwise explicit; don't assume a string index signature guarantees runtime presence.

## Verification

Compile with `strict`: assign `defaultFor("retries")` to a `number` and reject a misspelling and assignment of `defaultFor("mode")` to a number. Check `Object.isFrozen` and distinct identities for successive snapshots. **Pass:** known keys infer matching types, invalid calls are compile errors, and snapshots are frozen and independent.
