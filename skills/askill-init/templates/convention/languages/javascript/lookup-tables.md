# Treat dynamic lookup keys as data

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
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}
```

## Assumptions and trade-offs

Labels are strings, and counts fit safe integers. `Map` tracks insertion order and distinguishes an absent key with `has()` when `undefined` is a legal value. It is not directly a JSON object: encode entries or project to the documented wire shape. A null-prototype object can fit an object-shaped contract, but its callers cannot rely on inherited methods.

## Verification

Pass `["toString", "__proto__", "toString", "a"]`. **Pass:** entries in order are `["toString", 2]`, `["__proto__", 1]`, and `["a", 1]`; `counts.has("constructor")` is false.
