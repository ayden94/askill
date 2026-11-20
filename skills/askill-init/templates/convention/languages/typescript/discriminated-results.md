# Model mutually exclusive outcomes with discriminated unions

## When to read

Read when a status field controls which data is available, a result needs another branch, or an API uses nullable fields to imply mutually exclusive outcomes.

## Rules

- Use a literal discriminator and put required data on the variant that guarantees it. Avoid combinations of independent flags and optional fields when the options are exclusive.
- Narrow on that discriminator where a caller decides what to do. Put a `never` check on closed-union consumers whose decision must change if a case is added.
- Represent expected recoverable failures with useful fields at the level that can act on them. An internal exception or transport failure need not become a public variant unless the caller has a meaningful policy for it.

## Error-prone

```ts
type Lookup = { loading: boolean; title?: string; retryAfterMs?: number };

function describe(result: Lookup): string {
  if (result.loading) return "Loading";
  return result.title ?? "Unavailable";
}
```

This permits an item to be both loading and ready, and hides a retry instruction behind the same fallback as a genuinely missing item.

## Recommended

```ts
type Lookup =
  | { kind: "loading" }
  | { kind: "ready"; title: string }
  | { kind: "not-found" }
  | { kind: "retry"; retryAfterMs: number };

function unexpected(value: never): never {
  throw new Error(`Unexpected lookup result: ${String(value)}`);
}

function describe(result: Lookup): string {
  switch (result.kind) {
    case "loading": return "Loading";
    case "ready": return result.title;
    case "not-found": return "Item not found";
    case "retry": return `Try again in ${result.retryAfterMs} ms`;
    default: return unexpected(result);
  }
}
```

## Why and trade-offs

Each consumer handles the domain cases explicitly; optional checking does not leak into the ready branch. Exhaustiveness makes a new internal case a compile-time migration instead of a silent fallback, but adding a case to a published union can also break downstream consumers.

## Edge cases and exceptions

If a wire protocol is open-ended, validate and map unknown discriminators to a documented fallback before handing them to a closed union consumer. Conversely, if stale data while loading is a valid state, model it with a separate variant carrying the previous value; don't force the state into an inaccurate either/or.

## Verification

Call `describe` for all four cases, including a retry delay of `0`. In a scratch typecheck add `{ kind: "forbidden" }` to `Lookup` without updating `describe`. **Pass:** the original cases return their own messages, and the compiler rejects the incomplete decision at `unexpected(result)` until the new case is handled.
