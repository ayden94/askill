# Test side effects at an isolated boundary

**Invariant:** The test detects a malformed second row and proves that no parsed prefix replaced the pre-existing destination.

**Compatibility:** Version-independent `unittest` recipe on Python 3.9+; keep the project runner and do not reinterpret this as a guarantee of atomic writes.

## When to read

Read when adding filesystem or configuration tests, reproducing failures after partial processing, or patching I/O. Keep the installed runner; this example can run under `unittest` without dependencies.

## Rules

- Give each test independent files and configuration. Use a temporary directory or the existing fixture. For environment tests, patch or inject values so absent, blank, and invalid settings are not supplied by the developer's shell; restore global state even after failures.
- Exercise real parsing when testing the input contract. Replace only the external seam that makes the test nondeterministic. When patching, patch the symbol where the module under test looks it up, not where it was originally defined.
- Assert the observable error and agreed commit behavior. To catch premature writes, put a valid row before an invalid one and check the destination after the exception.

## Error-prone

```python
from pathlib import Path
from unittest import TestCase

class ImportTest(TestCase):
    def test_import(self):
        source = Path("rows.txt")
        source.write_text("42\n", encoding="utf-8")
        self.assertTrue(source.read_text(encoding="utf-8"))
```

This writes to the working directory and can pass without exercising the importer.

## Recommended

```python
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main

class InvalidRow(ValueError):
    def __init__(self, row: int):
        super().__init__(f"invalid integer on row {row}")
        self.row = row

def import_ids(source: Path, destination: Path) -> None:
    ids = []
    with source.open(encoding="utf-8") as rows:
        for row, value in enumerate(rows, start=1):
            try:
                ids.append(int(value))
            except ValueError as exc:
                raise InvalidRow(row) from exc
    destination.write_text("".join(f"{value}\n" for value in ids), encoding="utf-8")

class ImportTest(TestCase):
    def test_import_ids_invalid_second_row_preserves_destination(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / "input.txt"
            destination = Path(directory) / "output.txt"
            source.write_text("42\ninvalid\n", encoding="utf-8")
            destination.write_text("7\n", encoding="utf-8")

            with self.assertRaises(InvalidRow) as raised:
                import_ids(source, destination)

            self.assertEqual(raised.exception.row, 2)
            self.assertEqual(destination.read_text(encoding="utf-8"), "7\n")

if __name__ == "__main__":
    main()
```

## Why and trade-offs

The test checks a single rejection contract: identify the invalid row and publish no parsed rows. Real temporary files cover encoding and file behavior without depending on a workstation path. The sample buffers valid rows; it guarantees destination preservation on parse failure, not atomicity if a write fails halfway.

## Edge cases and exceptions

Use a transactional store or write to a sibling temporary file and replace only on success when the contract also covers output failures. If partial writes are intended, assert the precise prefix instead of requiring rollback. Tests that patch global environment values should not overlap in the same process; use injected environment mappings or isolated processes where needed.

## Verification

Run the example alone and in the project suite. In a scratch variant, truncate the destination before parsing and rerun. **Pass:** the original reliably reports row 2 and leaves `"7\n"` untouched; the premature-write variant fails the destination assertion.
