# Narrow untrusted values at runtime boundaries

## When to read

Read when turning data from JSON, storage, or an untyped SDK into a value that typed application code will trust.

## Rules

- Accept data as `unknown` at the boundary, even when an API such as `JSON.parse` returns `any`. The return annotation describes success; it cannot establish success.
- Narrow shape before fields: reject `null` and arrays when expecting a JSON object; require actual fields with appropriate primitive types. Separately enforce domain constraints such as integer quantities or allowed units.
- Construct the internal value from validated fields. Use the project's schema parser if one exists, and reuse its inferred output type where possible rather than maintaining a parallel cast-based type. Pass the result inward without reparsing it at every call.

## Error-prone

```ts
type Order = { id: string; quantity: number };

function decodeOrder(body: string): Order {
  return JSON.parse(body) as Order;
}
```

## Recommended

```ts
type Order = { id: string; quantity: number };

function parseOrder(input: unknown): Order {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("expected an order object");
  }
  if (!("id" in input) || !Object.hasOwn(input, "id") ||
      typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new TypeError("expected an own, nonblank order ID");
  }
  if (!("quantity" in input) || !Object.hasOwn(input, "quantity") ||
      typeof input.quantity !== "number" ||
      !Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new TypeError("expected an own, positive integer quantity");
  }
  return { id: input.id, quantity: input.quantity };
}

function decodeOrder(body: string): Order {
  const input: unknown = JSON.parse(body);
  return parseOrder(input);
}
```

## Why and trade-offs

`in` supplies the TypeScript 4.9+ narrowing, while `Object.hasOwn` enforces own fields instead of accepting inherited values. Explicit projection discards extra fields. Unlike an assertion, validation pays a runtime cost but prevents invalid external data from reaching code that assumes the invariant.

## Edge cases and exceptions

The decoding path starts from inert JSON data; this is not a way to safely inspect arbitrary live objects with getters or proxies. This API preserves the spelling of nonblank IDs and drops unknown keys. Specify normalization or rejection instead when the wire contract requires it. Keep malformed JSON (`SyntaxError`) distinguishable from a decoded payload that violates the contract; translate either at the caller that owns error reporting.

## Verification

Decode a valid order with an extra key, then malformed JSON, `null`, a missing ID, a whitespace-only ID, string quantity, fractional quantity, and zero. Call `parseOrder` with an inherited ID as well. **Pass:** the valid value contains only `id` and `quantity`; all invalid inputs fail in the expected decoding or validation stage before any persistence call.
