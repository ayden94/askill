# Testing crate contracts

**Invariant:** Public regressions and runnable documentation examples demonstrate the observable contract under every advertised feature configuration.

**Compatibility:** Version-sensitive in compiler MSRV, independently of Cargo's resolved features. On Rust 1.57+ the array assertion can use [`payload.as_slice()`](https://doc.rust-lang.org/std/primitive.array.html#method.as_slice); on Rust 1.56 (the first [Rust 2021 compiler](https://blog.rust-lang.org/2021/10/21/Rust-1.56.0/)) use `&payload[..]` for the same byte slice. The first test's [`matches!`](https://doc.rust-lang.org/std/macro.matches.html) requires Rust 1.42, below the Rust 2021 floor. Use the same public regression, byte-for-byte check, and feature/doctest matrix on both toolchains if both are supported.

## When to read

Read when adding a regression, changing a public crate interface, documenting an API, or editing `#[cfg(feature = ...)]` code. Use the repository's package names, supported feature combinations, targets, and minimum compiler. Name tests with unit, scenario, and expected behavior; separate Arrange, Act, and Assert with blank lines.

## Test what an external consumer can call and match

Error-prone: a child module inside the library tests a private helper and pins human-facing error text. It can still pass when the public parser stops exposing a useful error.

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_parse() {
        let error = super::parse_segment("_").unwrap_err();
        assert_eq!(error.to_string(), "segment is invalid");
    }
}
```

Recommended: in `tests/key_contract.rs`, compile against a public library crate. This example assumes `Key::parse` returns a `KeyError::InvalidSegment` variant with a zero-based label index.

```rust
use catalog_keys::{Key, KeyError};

#[test]
fn parse_invalid_second_segment_reports_its_index() {
    let raw = "catalog/_";

    let outcome = Key::parse(raw);

    assert!(matches!(outcome, Err(KeyError::InvalidSegment { index: 1, .. })));
}
```

Add a valid input case proving that a consumer can use the parsed key. Use in-module tests for intricate pure logic where direct coverage is useful, but keep public regressions at the consumer boundary. Only pin `Display` text when it is itself a documented interface; then isolate that formatting contract in a separate case.

## Make feature coverage explicit and verify published examples

Assume `compression` is opt-in and the crate's `encode()` API exists with and without it. Error-prone: this test silently disappears from default runs and merely checks that something was returned.

```rust
#[cfg(feature = "compression")]
#[test]
fn test_encode() {
    assert!(catalog_keys::encode(b"x").is_ok());
}
```

Recommended: for a format that must round-trip in every supported build, put a common consumer test outside feature gates. Add separate, feature-gated cases that specifically assert the extra codec behavior.

```rust
#[test]
fn encode_binary_payload_round_trips_without_loss() {
    let payload = b"\0\xffx";

    let encoded = catalog_keys::encode(payload).expect("encode binary fixture");

    assert_eq!(
        catalog_keys::decode(&encoded).expect("decode binary fixture").as_slice(),
        payload.as_slice()
    );
}
```

For this illustrative package, if default, minimal, and compression-only configurations are supported, run each:

```sh
cargo test -p catalog-keys
cargo test -p catalog-keys --no-default-features
cargo test -p catalog-keys --no-default-features --features compression
cargo test -p catalog-keys --doc --no-default-features --features compression
```

The last command targets doc tests specifically; it is useful when diagnosing a published API example or when the filtered CI task does not run docs. Documented usage should compile as a Rust doctest against the public exports; use `no_run` only when execution needs an external resource or has side effects, and `compile_fail` only to assert a forbidden use. Do not replace the supported matrix with `--all-features`: it misses disabled-feature behavior and may combine incompatible options. Confirm expected gated tests actually ran, not just that Cargo exited successfully.

## Verification and pass criteria

Run the public regression as a separate integration target, then in the supported matrix. Changing the returned invalid-segment index must fail the regression. A binary round-trip must preserve every byte; its feature-specific companion must run in the enabled configuration. Doc examples must compile and, where ordinary execution is permitted, pass using the public crate API. Tests must not depend on shared filesystem fixtures, environment mutations, or execution order.
