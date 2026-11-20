# Keep fixed-unit monetary arithmetic exact

## When to read

Read when computing totals from decimal prices where binary floating-point rounding would change an observable amount.

## Decision

Parse the agreed decimal format into integer minor units once. Multiply and sum integers rather than multiplying decimal amounts in `Number` and guessing how to round them back.

## Bad

```js
function totalCents(price, quantity) {
  return Number(price) * Number(quantity) * 100;
}
```

## Good

```js
function totalCents(price, quantity) {
  const parts = /^([0-9]+)\.([0-9]{2})$/u.exec(price);
  if (!parts || parts[0] !== price) {
    throw new TypeError("expected a decimal price with two places");
  }
  if (typeof quantity !== "bigint" || quantity < 0n) {
    throw new TypeError("expected a nonnegative integer quantity");
  }
  const [, whole, fraction] = parts;
  return (BigInt(whole) * 100n + BigInt(fraction)) * quantity;
}
```

## Assumptions and trade-offs

Inputs are bounded strings and `bigint` quantities, in one currency with exactly two decimal places. This example does not handle refunds, rates, or mixed currencies. Define rounding separately at fractional operations such as tax. `BigInt` avoids the safe-integer ceiling, but JSON does not serialize it by default; use a documented decimal-string encoding for transport.

## Verification

Calculate `0.29` × `1n`, `0.10` × `3n`, and `90071992547409.93` × `1n`; also pass an unsupported `1.005` price. **Pass:** results are `29n`, `30n`, and `9007199254740993n`; the extra precision is rejected rather than rounded.
