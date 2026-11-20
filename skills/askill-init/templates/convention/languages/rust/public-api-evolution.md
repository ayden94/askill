# Evolving public data types

**Invariant:** An API expected to gain cases must leave downstream code a documented fallback without breaking supported external callers.

**Compatibility:** Version-sensitive in compiler MSRV. From [Rust 1.40](https://blog.rust-lang.org/2019/12/19/Rust-1.40.0/), use `#[non_exhaustive]` on a new extensible public enum; the example's [`matches!`](https://doc.rust-lang.org/std/macro.matches.html) separately requires 1.42. On 1.40–1.41 write `match result { ScanResult::Findings { count } => *count > 0, _ => false }`. A new API targeting Rust 1.39 or older can instead expose `pub struct ScanResult(PrivateResult);` with public construction methods and stable queries such as `has_findings`, keeping the enum and all matching internal. For either public shape, introduce an internal/new case and rebuild the same downstream fixture; it must take its documented fallback without exposing a false success. The opaque type is not a compatible retrofit of a public enum.

## When to read

Read when publishing a data type or adding enum variants or fields used by downstream crates.

Error-prone if future variants are intentionally allowed in minor releases: this initial declaration enables exhaustive matches in downstream crates.

```rust
pub enum ScanResult {
    Clean,
    Findings { count: usize },
}
```

Recommended from the first release when the case set is open:

```rust
#[non_exhaustive]
pub enum ScanResult {
    Clean,
    Findings { count: usize },
}

pub fn has_findings(result: &ScanResult) -> bool {
    matches!(result, ScanResult::Findings { count } if *count > 0)
}
```

Document how downstream consumers should handle unrecognized variants; a wildcard is not automatically a safe success case. For a struct whose fields may evolve, use private fields plus a constructor and accessors; for a growable struct-like enum variant, review the variant's own construction and destructuring separately. Retrofitting `#[non_exhaustive]` can itself break existing source. Keep intentionally closed enums exhaustive so callers can rely on compile-time handling of every case.

## Verification and pass criteria

Build a downstream fixture matching with a fallback, then add a variant in a test version of the crate and rebuild without editing the fixture. Also verify an exhaustive external match without a wildcard fails to compile against the open enum. Test the chosen fallback behavior independently; successful compilation does not prove that behavior is safe.
