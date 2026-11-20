# Treat dynamic lookup keys as data

**Invariant:** Any string key starts absent, and occurrences are counted without consulting an object prototype.

**Compatibility — portable within ES2015+ engines:** Use the same [ES2015 `Map`](https://262.ecma-international.org/6.0/#sec-map-objects) and test its insertion-ordered entries. The string-to-count contract never stores `undefined`, so an equality check is enough and avoids ES2020 `??`, which appears only in the anti-example.

## When to read

Read when building a counter or registry keyed by externally selected strings, including names that overlap with object properties.

## Decision

Use `Map` when the collection is a lookup table, rather than reading arbitrary keys from a prototype-bearing object. For example, an unseen `"toString"` key reads the inherited function instead of the missing value.

## Bad

```js
function countLabels(labels) {
  const counts = {};
  for (const label of labels) {
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}
```

## Good

```js
function countLabels(labels) {
  const counts = new Map();
  for (const label of labels) {
    const count = counts.get(label);
    counts.set(label, (count === undefined ? 0 : count) + 1);
  }
  return counts;
}
```

## Assumptions and trade-offs

Labels are strings, and counts fit safe integers. `Map` tracks insertion order and distinguishes an absent key with `has()` when `undefined` is a legal value. It is not directly a JSON object: encode entries or project to the documented wire shape. A null-prototype object can fit an object-shaped contract, but its callers cannot rely on inherited methods.

## Verification

Pass `["toString", "__proto__", "toString", "a"]`. **Pass:** entries in order are `["toString", 2]`, `["__proto__", 1]`, and `["a", 1]`; `counts.has("constructor")` is false.
