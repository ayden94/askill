# Keep fixed-unit monetary arithmetic exact

**Invariant:** Valid prices and quantities produce exact minor units, and excess decimal places are rejected rather than rounded.

**Compatibility — version boundary:** Use native [BigInt](https://v8.dev/features/bigint) on ES2020+ runtimes implementing it. For an ES2015–ES2019 baseline without BigInt, use an existing arbitrary-precision integer dependency such as [JSBI](https://github.com/GoogleChromeLabs/jsbi); changing the syntax target does not polyfill the operators or make `123n` parse on those runtimes.

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

Inputs are bounded strings and `bigint` quantities, in one currency with exactly two decimal places. For a JSBI implementation, keep the price validation, accept a validated nonnegative integer quantity as decimal text, and replace the arithmetic with:

```js
import JSBI from "jsbi";

function multiplyCents(whole, fraction, quantityText) {
  const cents = JSBI.BigInt(whole + fraction);
  return JSBI.multiply(cents, JSBI.BigInt(quantityText));
}
```

Use a decimal-string adapter on both paths when callers need the same wire contract; do not promise that JSBI values are native `bigint`. Do not convert through `Number`. This example does not handle refunds, rates, or mixed currencies. Define rounding separately at fractional operations such as tax.

## Verification

On either path calculate `"0.29"` × 1, `"0.10"` × 3, and `"90071992547409.93"` × 1 with quantities in that path's exact representation; also pass price `"1.005"`. **Pass:** the decimal strings are `"29"`, `"30"`, and `"9007199254740993"`; the extra precision is rejected.
