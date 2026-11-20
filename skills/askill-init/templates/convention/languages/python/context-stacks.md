# Roll back partially acquired resources with ExitStack

**Invariant:** Every successfully entered context is exited in reverse acquisition order, including when a later acquisition fails.

**Compatibility:** Version-independent synchronous recipe on Python 3.9+. Use `AsyncExitStack` for async managers; neither stack owns cleanup for a context whose entry itself fails.

## When to read

Read when opening a runtime-sized collection of files or entering a group of optional context managers.

## Decision

Register each context as it is acquired. Building a list of files before entering `try` leaves earlier files outside the cleanup path when a later open fails.

## Bad

```python
def first_lines(paths):
    sources = [open(path, encoding="utf-8") for path in paths]
    try:
        return [source.readline() for source in sources]
    finally:
        for source in sources:
            source.close()
```

## Good

```python
from contextlib import ExitStack

def first_lines(paths, *, opener=open):
    with ExitStack() as stack:
        sources = [
            stack.enter_context(opener(path, encoding="utf-8"))
            for path in paths
        ]
        return [source.readline() for source in sources]
```

## Assumptions and trade-offs

This batch needs all sources open together and is small enough for the process's descriptor limit. The resulting lines are independent of the files. `ExitStack` unwinds entered contexts in reverse order; a context manager that raises during its own `__enter__` remains responsible for cleaning up anything it acquired internally. For independent files, prefer opening and processing one at a time.

## Verification

Provide an opener returning two tracked context managers and raising `FileNotFoundError` on the third open. **Pass:** contexts two and one exit in that order, their `readline` methods are not called, and the caller receives the acquisition error.
