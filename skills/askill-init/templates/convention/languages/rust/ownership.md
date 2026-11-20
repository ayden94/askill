# Borrowing and ownership

## When to read

Read before changing a function signature or cloning data to get past the borrow checker. Find out whether the callee will only inspect the data, return a view, or retain it after the call.

## Accept a slice and return a view when the caller owns the data

Error-prone for a read-only lookup: the function consumes the entire vector and makes a new string even though the caller only needs to inspect a matching item.

```rust
fn first_queued(jobs: Vec<String>) -> Option<String> {
    jobs.iter().find(|job| job.starts_with("queued:")).cloned()
}
```

Recommended: borrow the slice and return a view into its first matching item.

```rust
fn first_queued(jobs: &[String]) -> Option<&str> {
    jobs.iter()
        .find(|job| job.starts_with("queued:"))
        .map(String::as_str)
}
```

This accepts vectors and arrays by reference, returns `None` if no job matches, and ties the result to `jobs`. While using that result, the caller cannot mutably borrow the underlying collection. If the caller must keep the selected job across mutation, copy that one value there; do not force every caller to allocate. Taking a `Vec<T>` intentionally is appropriate when consuming its allocation or moving its elements is part of the contract.

## Transfer ownership at a retention boundary

Error-prone when callers already own an allocated path: borrowing and then unconditionally copying makes them pay for another allocation.

```rust
use std::path::{Path, PathBuf};

struct ExportJob {
    target: PathBuf,
}

impl ExportJob {
    fn new(target: &Path) -> Self {
        Self { target: target.to_path_buf() }
    }
}
```

Recommended: accept an owned path and move it into the job. Borrowed callers make the retention copy explicitly.

```rust
use std::path::{Path, PathBuf};

struct ExportJob {
    target: PathBuf,
}

impl ExportJob {
    fn new(target: PathBuf) -> Self {
        Self { target }
    }

    fn target(&self) -> &Path {
        &self.target
    }
}
```

An `impl Into<PathBuf>` constructor can be useful if many call sites need conversions, but the stored field must still own the path. Do not assume paths are UTF-8; `Path`/`PathBuf` round-trip OS-native paths. Clone when multiple independent owners genuinely need their own value, or use `Arc` for a consciously shared lifetime—not just to silence a lifetime error.

## Verification and pass criteria

Call `first_queued` on an array and on a vector slice, covering empty, no-match, and multiple-match cases. The first match wins, and the caller can still use the original vector. Move an owned path into `ExportJob`, including an OS-native non-UTF-8 case on supported platforms; the accessor preserves the exact path without lossy string conversion or a second owned buffer in the constructor.
