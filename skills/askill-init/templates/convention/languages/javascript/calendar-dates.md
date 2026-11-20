# Keep calendar dates separate from instants

**Invariant:** Advancing a validated date-only string yields the same Gregorian day in every host time zone.

**Compatibility — portable within ES2015+ hosts implementing the [ECMAScript date-time string format](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date-time-string-format):** The explicit `Z`, UTC setters, and ISO formatting provide the needed semantics without an Intl API, Temporal, or a local time-zone calculation. Do not substitute locale-dependent parsing on older hosts.

## When to read

Read when advancing a date-only field such as a booking day or an invoice due date.

## Decision

For a date-only ISO contract, keep the public value a date string and use UTC consistently for intermediate calendar arithmetic. Mixing a UTC parse of `YYYY-MM-DD` with local setters can produce the wrong day across daylight-saving transitions.

## Bad

```js
function nextDay(isoDay) {
  const date = new Date(isoDay);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
```

## Good

```js
function nextDay(isoDay) {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
```

## Assumptions and trade-offs

The boundary has already validated an actual Gregorian date in canonical four-digit ISO form and the next date stays in that year range. UTC here is an implementation detail, not a claim that the business day begins at midnight UTC. A deadline at local midnight requires an explicit business time zone and a policy for ambiguous or nonexistent local times.

## Verification

Run in both `UTC` and `America/New_York` with `2024-03-10`, `2024-02-28`, and `2024-12-31`. **Pass:** both runs yield `2024-03-11`, `2024-02-29`, and `2025-01-01` respectively.
