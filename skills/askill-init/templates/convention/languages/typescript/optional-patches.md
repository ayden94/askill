# Give omission and clearing different patch semantics

**Invariant:** Leave, clear, and assign (including `""`) are distinct operations; explicit `undefined` is not a valid command.

**Compatibility — compiler version/option boundary:** TypeScript 4.4+ with `strictNullChecks` and [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html#exact-optional-property-types---exactoptionalpropertytypes) enabled separately from `strict` can use the optional-key shape. For TypeScript 4.0–4.3, or 4.4+ with `strictNullChecks` but without that option, use the tagged operation below if you control the API shape. JavaScript execution does not enforce the compiler option.

## When to read

Read when a typed patch API must distinguish leaving a value alone, clearing it, and assigning a new value.

## Decision

Model clearing with a distinct value such as `null` and omission with an optional key. If the project uses `exactOptionalPropertyTypes`, an own property with `undefined` is not accepted unless the value type explicitly includes it. Falling back with `??` merges a deliberate clear with omission.

## Bad

```ts
type Profile = { nickname: string | null };

function applyPatch(profile: Profile, patch: Partial<Profile>): Profile {
  return { nickname: patch.nickname ?? profile.nickname };
}
```

## Good

```ts
type Profile = { nickname: string | null };
type ProfilePatch = { nickname?: string | null };

function applyPatch(profile: Profile, patch: ProfilePatch): Profile {
  return { nickname: patch.nickname === undefined ? profile.nickname : patch.nickname };
}
```

## Assumptions and trade-offs

Without the flag an optional property accepts explicit `undefined`; an `undefined` check alone can't enforce the input distinction. Instead, use required fields on distinct variants:

```ts
type Profile = { nickname: string | null };
type NicknamePatch =
  | { kind: "leave" }
  | { kind: "clear" }
  | { kind: "assign"; nickname: string };

function applyPatch(profile: Profile, patch: NicknamePatch): Profile {
  switch (patch.kind) {
    case "leave": return { nickname: profile.nickname };
    case "clear": return { nickname: null };
    case "assign": return { nickname: patch.nickname };
  }
}
```

If the wire shape must remain stable, validate its own property presence and value before translating to the operation. A wire adapter must validate untyped input with either design.

## Verification

Starting with `"old"`, apply `{}`, `{ nickname: null }`, and `{ nickname: "" }` or the corresponding `leave`, `clear`, and `assign` operations. Also typecheck an explicit `undefined` in the nickname value slot in each API. **Pass:** results are `"old"`, `null`, and `""`, and explicit `undefined` fails typechecking.
