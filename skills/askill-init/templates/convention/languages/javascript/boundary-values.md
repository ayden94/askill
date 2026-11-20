# Boundary values and coercion

## When to read

Read when accepting query or environment strings, applying defaults, or turning data from an adapter into domain values. The input contract decides what missing, blank, repeated, and out-of-range values mean.

## Rules

- Apply defaults only to the absence representation the adapter actually returns. `URLSearchParams.get()` returns `null` when no entry matches but returns `""` for `?limit=`. For typed options where `null` and `undefined` both mean absent, use `??`; it preserves a valid `0`, `false`, or empty string.
- Validate the textual format before conversion if the public syntax matters. `Number("")` and `Number(" ")` produce zero, while `parseInt("12px", 10)` accepts the numeric prefix. A successful conversion is not a range check.
- Give duplicate values an explicit policy. A single-value field should not accidentally inherit the parser's first-match behavior. Keep parse errors distinct from legitimate defaults; map errors to client feedback once, at the transport layer.

## Error-prone

```js
function pageLimit(params) {
  return Number(params.get("limit")) || 25;
}
```

## Recommended

```js
function pageLimit(params) {
  const limits = params.getAll("limit");
  if (limits.length === 0) return 25;
  if (limits.length !== 1 || !/^(?:0|[1-9][0-9]*)$/.test(limits[0])) {
    throw new TypeError("expected one unsigned decimal limit");
  }

  const limit = Number(limits[0]);
  if (!Number.isSafeInteger(limit) || limit > 100) {
    throw new RangeError("limit must be between 0 and 100");
  }
  return limit;
}
```

## Why and trade-offs

The adapter distinguishes absence, invalid syntax, and invalid range before downstream code starts work. An explicit grammar costs an extra check, but it avoids silently accepting a different input language from the API contract.

## Edge cases and exceptions

Here `0` deliberately requests zero results, and leading zeroes, signs, and scientific notation are invalid. If compatibility requires accepting any of those spellings, adjust the grammar and tests together. Do not reuse this parser for JSON numbers: that boundary already presents a value of a different runtime type. For a list-valued query field, repeated keys may be the correct representation.

## Verification

Pass real `URLSearchParams` instances built from `""`, `"limit=0"`, `"limit=100"`, `"limit="`, `"limit=+0"`, `"limit=2&limit=3"`, and `"limit=101"`. **Pass:** the first three produce `25`, `0`, and `100`; blank, decoded whitespace, and duplicates fail as syntax; the last fails as range. Rejected values never reach the data fetch.
