# Consume iterables once and keep accumulators call-local

**Invariant:** A one-shot input is consumed once without mutating the caller's seed or sharing state across calls; strict pairing must not silently drop a row.

**Compatibility:** The accumulation recipe is version-independent on Python 3.9+; the strict sequence pairing recipe below splits at Python 3.10.

## When to read

Read when introducing an iterable parameter, aggregating streamed records, or passing an optional collection of caller-owned state.

## Rules

- If an API accepts `Iterable[T]`, allow a one-shot iterator. Compute independent aggregates in one pass where possible. If replay or length is essential, accept a stronger contract or explicitly materialize once at a well-bounded point.
- Default to `None` rather than a mutable object. Python evaluates default arguments when defining a function, not on each call.
- Separate an omitted starting value from an explicit empty one. Treat caller-supplied containers as borrowed unless the API advertises an in-place update.

## Error-prone

```python
from collections import Counter

def summarize(labels, counts=Counter()):
    counts.update(labels)
    return sum(1 for _ in labels), counts
```

With a generator, the second traversal sees no records. Repeated calls also update the same default object.

## Recommended

```python
from collections import Counter
from typing import Iterable, Mapping, Optional

def summarize(
    labels: Iterable[str], seed: Optional[Mapping[str, int]] = None
) -> tuple[int, Counter[str]]:
    counts: Counter[str] = Counter(seed) if seed is not None else Counter()
    seen = 0
    for label in labels:
        counts[label] += 1
        seen += 1
    return seen, counts
```

## Why and trade-offs

The count of consumed labels excludes seed entries, and the returned `Counter` belongs to this call. One pass avoids retaining every label; memory still grows with the number of distinct labels, and seeding copies the mapping to avoid aliasing.

## Edge cases and exceptions

An empty iterator still returns the seed's counts in a new object. A failure mid-iteration leaves the input partially consumed, but does not commit partial counts to the caller's seed. For a deliberately shared cache, give it an explicit owner and invalidation policy; don't hide it in a default argument. Do not buffer unbounded input just to support repeated passes.

## Verification

Summarize a generator producing `"a", "b", "a"` with seed `{"a": 4}`, then summarize fresh empty input twice without a seed and mutate one result. **Pass:** the first result is `(3, Counter({"a": 6, "b": 1}))`, the seed is unchanged, and the unseeded results share no state.

## Compatibility: pairing two finite sequences without losing a row

Use this rule only when the contract requires equal lengths. For two ordinary, stable sequences, choose by the minimum supported runtime, not by the developer workstation. `zip(strict=True)` was added in Python 3.10 ([Python 3.10 release notes](https://docs.python.org/3.10/whatsnew/3.10.html#other-language-changes), [PEP 618](https://peps.python.org/pep-0618/)).

```python
# Python >= 3.10
pairs = list(zip(names, values, strict=True))
```

```python
# Python 3.9 within this rulebook's support range
if len(names) != len(values):
    raise ValueError("names and values must have equal lengths")
pairs = list(zip(names, values))
```

Do not use the length check for one-shot iterators: they need a streaming mismatch check or a different input contract. For either sequence implementation, verify matching inputs keep order, two empty inputs succeed, and unequal lengths raise with either side shorter. If one portable implementation meets the entire support range, a runtime version switch is unnecessary.
