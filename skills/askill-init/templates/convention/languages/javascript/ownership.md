# Ownership and mutation

**Invariant:** Ranking returns isolated records in numeric order, with source order preserved for equal priorities.

**Compatibility — version boundary:** ES2019+ guarantees [stable `Array.prototype.sort`](https://v8.dev/features/stable-sort). On ES2015–ES2018 give the projected entry an explicit source-index tie-break, as shown below; copying alone cannot guarantee tie order. Both paths assume a dense array.

## When to read

Read when a function sorts, reverses, caches, or returns a collection, or exposes records owned by a caller. Decide which object references may leave the boundary and who can mutate them.

## Rules

- Treat input as borrowed unless the API documents that ownership is transferred or mutations are part of the contract. `sort`, `reverse`, and `splice` mutate the receiver.
- Copy at the level the output owns. A new array does not copy its record elements; spread creates only a shallow copy. Prefer a projection when callers need only a few fields and no shared nested references.
- Specify sort semantics. The default sort compares values as strings; use a numeric comparator for numbers and define tie order. An ordering comparator must not mutate records or depend on the time of comparison.
- Keep mutable state scoped to an instance or request unless process-wide sharing is intentional. If an async read-modify-write crosses `await`, copying alone does not make the write atomic; serialize it or use an atomic store operation.

## Error-prone

```js
function rankedJobs(jobs) {
  return jobs.sort((a, b) => a.priority - b.priority);
}
```

## Recommended

```js
function rankedJobs(jobs) {
  return jobs
    .map(({ id, priority }) => ({ id, priority }))
    .sort((a, b) => a.priority - b.priority);
}
```

## Why and trade-offs

The function sorts only the new array and exposes new records; here `id` is a string and `priority` a finite number validated upstream. It allocates one object per job, but callers can edit the view without editing the source. Where stability is not guaranteed:

```js
function rankedJobs(jobs) {
  return jobs
    .map(({ id, priority }, index) => ({ id, priority, index }))
    .sort((a, b) => (a.priority - b.priority) || (a.index - b.index))
    .map(({ id, priority }) => ({ id, priority }));
}
```

If source order itself varies and output must be deterministic across inputs, specify an independent tie-breaker instead.

## Edge cases and exceptions

If only array ownership needs to change and elements are intentionally shared, use `[...jobs].sort(...)` on ES2019–ES2022, or optionally use [`toSorted`](https://tc39.es/ecma262/2023/multipage/indexed-collections.html#sec-array.prototype.tosorted) on ES2023+ runtimes providing it. For dense arrays both must yield a new, sorted array without changing the original, while retaining the original element identities. If mutable nested metadata later becomes part of the public projection, decide which branches are copied. In-place sorting is appropriate for a privately owned buffer and may be appropriate for a documented mutating API.

## Verification

Run this for each ranking implementation. Arrange input priorities `10`, `2`, `2` with distinct IDs and retain the original references. Call `rankedJobs`, then change the first output record's priority. **Pass:** output was numerically sorted with equal priorities in input order; input order, records, and values did not change.
