# Narrow untrusted values at runtime boundaries

**Invariant:** Only a fresh projection of validated own fields crosses into the typed application.

**Compatibility — independent compiler and runtime boundaries:** TypeScript 4.9+ can use [unlisted-property narrowing with `in`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#unlisted-property-narrowing-with-the-in-operator); TypeScript 3.0–4.8 (which has [`unknown`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html#new-unknown-top-type)) needs an explicit type predicate. Separately, the `Object.hasOwn` variant needs an ES2022 object library declaration and a runtime implementing [`Object.hasOwn`](https://tc39.es/ecma262/2022/multipage/fundamental-objects.html#sec-object.hasown); for an ES2015–ES2021 runtime without it, use `Object.prototype.hasOwnProperty.call`. Lowering `target` does not supply the method.

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

`in` supplies narrowing, while the own-property check rejects inherited values. For the older compiler or runtime use this predicate, and replace each pair of presence checks with `!hasOwnId(input)` or `!hasOwnQuantity(input)` respectively:

```ts
function hasOwnId(value: object): value is { id: unknown } {
  return Object.prototype.hasOwnProperty.call(value, "id");
}

function hasOwnQuantity(value: object): value is { quantity: unknown } {
  return Object.prototype.hasOwnProperty.call(value, "quantity");
}
```

The predicate narrows only the presence of one own key; the value checks remain unchanged. The ES2015 `Number.isSafeInteger` API is required independently. Explicit projection discards extra fields.

## Edge cases and exceptions

The decoding path starts from inert JSON data; this is not a way to safely inspect arbitrary live objects with getters or proxies. This API preserves the spelling of nonblank IDs and drops unknown keys. Specify normalization or rejection instead when the wire contract requires it. Keep malformed JSON (`SyntaxError`) distinguishable from a decoded payload that violates the contract; translate either at the caller that owns error reporting.

## Verification

Run the same checks for both paths. Decode `{"id":"O-1","quantity":2,"extra":true}`, then malformed JSON, `null`, a missing ID, a whitespace-only ID, string quantity, fractional quantity, and zero. Call `parseOrder` with an inherited ID as well. **Pass:** the valid value is exactly `{ id: "O-1", quantity: 2 }`; malformed JSON fails decoding, and every other invalid input fails validation before persistence.
