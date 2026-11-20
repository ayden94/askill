# Translate only expected exceptions at the owning boundary

## When to read

Read when absence is a recoverable outcome, an adapter wraps an exception, or an I/O error must reach a CLI or request handler.

## Rules

- Catch the narrow exception around the operation that can legitimately produce it. `FileNotFoundError`, `PermissionError`, and `IsADirectoryError` are all `OSError` subclasses but imply different recovery actions.
- Add domain context only where it helps a caller act. Use `raise ... from exc` when translating so diagnostics preserve the cause; log or present the failure once at the owning boundary.
- Define successful empty data independently from failed I/O and malformed content. Do not catch `Exception` and turn every unexpected failure into a default.

## Error-prone

```python
import json
from pathlib import Path

def load_aliases(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
```

## Recommended

```python
import json
from pathlib import Path

class AliasesMissing(Exception):
    pass

class AliasesInvalid(Exception):
    pass

def load_aliases(path: Path) -> dict[str, str]:
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise AliasesMissing(f"aliases file unavailable: {path}") from exc
    except UnicodeDecodeError as exc:
        raise AliasesInvalid("aliases file must be UTF-8") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AliasesInvalid("aliases file must contain JSON") from exc

    if not isinstance(data, dict) or not all(isinstance(v, str) for v in data.values()):
        raise AliasesInvalid("aliases must be an object with string values")
    return data
```

## Why and trade-offs

The caller can treat `AliasesMissing` as optional configuration without ignoring corruption or unrelated I/O errors. Two domain exception types add surface area; an internal helper with just one caller might let built-in exceptions propagate and classify them at that caller instead.

## Edge cases and exceptions

A missing parent directory or dangling symlink can also cause `FileNotFoundError`; the example treats them as unavailable, not proof that the final path component never existed. If partial configuration is allowed, define which keys may be ignored separately from parsing errors. Avoid returning raw exception causes or filesystem paths to an untrusted client even when retaining them for internal diagnostics.

## Verification

Use a new temporary directory. Try a missing path, the directory itself as the file, a malformed JSON file, invalid UTF-8, JSON with a non-string value, and `{}`. **Pass:** only the missing path yields `AliasesMissing`; malformed contents yield `AliasesInvalid`; the directory error propagates; only the valid empty object yields `{}`.
