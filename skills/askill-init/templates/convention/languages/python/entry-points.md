# Separate entry points from resource-free logic

**Invariant:** Import performs no CLI or file work; the code that opens a file closes it even when parsing fails.

**Compatibility:** Version-independent standard-library recipe on Python 3.9+; a framework may own startup instead of `__main__`.

## When to read

Read when adding an executable module, changing resource acquisition, or moving parsing out of a CLI, scheduled job, or framework callback.

## Rules

- Keep imports free from I/O, argument parsing, and process exit. Let the executable entry point receive arguments and decide exit status; imported functions should return values or raise exceptions.
- Pass an iterable or a reader to computation that does not need to own a path. If a function acquires a file, transaction, or client, express its lifetime with a context manager where the underlying API supports one.
- Don't close borrowed resources. If a function yields values backed by a resource, document who keeps the resource open for iteration, or finish consuming it before the owning context exits.

## Error-prone

```python
import sys

def read_ids(path):
    source = open(path, encoding="utf-8")
    ids = [int(line) for line in source if line.strip()]
    source.close()
    return ids

print(read_ids(sys.argv[1]))
```

A malformed line bypasses `close()`, and importing this module reads process arguments and opens a file.

## Recommended

```python
import argparse
from typing import Iterable, List

def parse_ids(lines: Iterable[str]) -> List[int]:
    return [int(line) for line in lines if line.strip()]

def read_ids(path: str) -> List[int]:
    with open(path, encoding="utf-8") as source:
        return parse_ids(source)

def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args(argv)
    print(read_ids(args.path))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

## Why and trade-offs

The parser is testable without a filesystem, and `with` closes the owned file whether parsing succeeds or raises. The returned list is independent of the file lifetime but consumes memory proportional to input size.

## Edge cases and exceptions

For streaming, consume the iterator within the caller's open-file context or provide a context-managed streaming API. A generator expression returned directly from the `with` block would attempt to read a closed file. `argparse` may call `SystemExit` for help or usage errors; this is appropriate at the CLI boundary, not in a library function.

## Verification

Import the module without CLI arguments and capture output; parse `["3\n", "\n", "4\n"]` directly. For the file-owning path, substitute an observable context-managed stream at the lookup site and make the second line invalid. **Pass:** import does no CLI work, the good input yields `[3, 4]`, and the bad input raises `ValueError` with the stream closed.
