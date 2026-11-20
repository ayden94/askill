# Snapshot mutable inputs before validating a value dataclass

## When to read

Read when a dataclass is meant to be a stable value but is constructed from a mutable collection.

## Decision

Snapshot caller-owned data, validate the snapshot, then store data with no mutable aliases. `frozen=True` blocks normal attribute reassignment but cannot prevent someone mutating the list held by the attribute.

## Bad

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class ExportColumns:
    names: list[str]

    def __post_init__(self):
        if not self.names or len(set(self.names)) != len(self.names):
            raise ValueError("expected nonempty unique columns")
```

## Good

```python
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class ExportColumns:
    names: tuple[str, ...]

    def __post_init__(self):
        if not self.names or len(set(self.names)) != len(self.names):
            raise ValueError("expected nonempty unique columns")

    @classmethod
    def from_names(cls, names: Iterable[str]) -> "ExportColumns":
        return cls(tuple(names))
```

## Assumptions and trade-offs

Callers use `from_names` for arbitrary iterables and pass an actual tuple to the direct typed constructor. Type annotations do not enforce this at runtime; normalize in the constructor if it must accept untyped callers. Tuple conversion is shallow, which is sufficient for strings, and consumes the input once. It is not suitable for an unbounded iterator.

## Verification

Build a value from `["id", "name"]`, then overwrite the first list entry. Attempt construction from an empty iterator and from repeated `"id"` values. **Pass:** stored names stay `("id", "name")`, and both invalid inputs raise `ValueError`.
