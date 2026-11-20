# TypeScript

- Narrow unknown external values before they enter typed domain code. Do not use assertions to silence a boundary mismatch.
- Represent distinct result states with discriminated unions and handle all cases at the caller.

## Model valid states

Instead of `{loading, error?, data?}`, use alternatives such as `{kind: "ready", data}` and `{kind: "failed", error}`. Narrow at the decision point so adding a new case exposes unfinished handling.

## Validate at runtime once

Accept external JSON as unknown. Parse it with the existing boundary parser, then pass a domain value inward. `payload as Order` proves nothing about missing fields or invalid units. Avoid duplicating the same validation across every internal function.

## Choose types for callers

Prefer a concrete signature over a generic whose caller must guess the type parameter. Expose readonly views where callers should not mutate state; remember that compile-time readonly does not freeze a runtime object.
