# Publish a file only after the new contents are complete

## When to read

Read when refreshing an artifact that another process may read or that must retain its prior contents if a write fails.

## Decision

Write to a temporary file in the destination directory, close it, then replace the destination. Opening the live path for writing truncates it before the write or encoding can succeed.

## Bad

```python
from pathlib import Path

def publish(path: Path, chunks) -> None:
    with path.open("w", encoding="utf-8") as target:
        target.writelines(chunks)
```

## Good

```python
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

def publish(path: Path, chunks) -> None:
    staged = None
    try:
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as target:
            staged = Path(target.name)
            target.writelines(chunks)
        os.replace(staged, path)
    finally:
        if staged is not None:
            staged.unlink(missing_ok=True)
```

## Assumptions and trade-offs

The destination directory already exists and the filesystem supports atomic same-filesystem replacement. This protects publication from partial writes, not from power loss: crash durability may require syncing the new file and directory. Replacement changes the file identity and can change permissions; keep explicit metadata policy if those matter. Concurrent writers remain last-writer-wins unless coordinated.

## Verification

Create an existing file, then pass a generator that yields one chunk and raises before the next. After the failure, retry with two valid chunks. **Pass:** failed publication preserves the original text and leaves no staged file; successful publication makes exactly the full replacement visible.
