# Evolving public data types

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
