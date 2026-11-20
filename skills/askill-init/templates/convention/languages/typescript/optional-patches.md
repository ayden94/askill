# Give omission and clearing different patch semantics

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

This is a typed call with plain data, an ES2022 target, and `exactOptionalPropertyTypes` enabled separately from `strict`. A wire adapter still has to validate untyped input. When that flag is not enabled, the implementation treats explicit `undefined` as omission; use a tagged operation if the API must distinguish the two without the flag. `""` is a valid assignment here.

## Verification

Starting with `"old"`, apply `{}`, `{ nickname: null }`, and `{ nickname: "" }`. Typecheck a separate call with `{ nickname: undefined }` under the stated flags. **Pass:** the results are `"old"`, `null`, and `""`; the explicit `undefined` call is rejected by the compiler.
