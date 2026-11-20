# Additive Cargo features

**Invariant:** Adding an optional capability never removes or changes the behavior of a capability promised in every supported build.

**Compatibility:** Version-sensitive in Cargo manifest syntax. With [Cargo 1.60+](https://blog.rust-lang.org/2022/04/07/Rust-1.60.0/#new-syntax-for-cargo-features), declare `compression = ["dep:codec"]` under `[features]` and mark `codec` optional; this suppresses the implicit public `codec` feature. On older supported Cargo, use `compression = ["codec"]` with the same optional dependency and account for the implicit `codec` feature in the public contract. Keep the same Rust `cfg(feature = "compression")` and never gate `raw`. Check the [feature resolver](https://doc.rust-lang.org/cargo/reference/resolver.html#feature-resolver-version-2) separately from `rust-version` and edition; resolved features may be unified, so do not make shared capabilities subtractive. Run the same default, minimal, compression, and combined-consumer checks.

## When to read

Read when adding a feature, changing defaults, or gating a public API or optional dependency.

Assume a crate already publishes `raw` and is adding an optional codec. Error-prone: enabling `compression` removes the raw API for every caller sharing that resolved build of the crate.

```rust
#[cfg(not(feature = "compression"))]
pub fn raw(bytes: &[u8]) -> Vec<u8> {
    bytes.to_vec()
}
```

Recommended: retain shared capabilities in all builds, and gate only the added capability. The `compression` feature enables the optional dependency named `codec` in the manifest.

```rust
pub fn raw(bytes: &[u8]) -> Vec<u8> {
    bytes.to_vec()
}

#[cfg(feature = "compression")]
pub fn compressed(bytes: &[u8]) -> Result<Vec<u8>, codec::Error> {
    codec::encode(bytes)
}
```

Cargo can unify features requested by different dependents for one package build. Do not make an existing method silently emit a different wire format merely because another dependent enabled a flag. Use positive feature names, and check optional imports, examples, and re-exports under each supported configuration. Avoid exposing a third-party error type in a new public signature unless you intend to support it as part of that API. If two backends are truly incompatible, prefer separate crates, target selection, or explicit runtime selection; if exclusivity is unavoidable, emit a clear compile-time error and document the supported combinations.

## Verification and pass criteria

Build the consumer against default features, `--no-default-features`, and the supported compression combination. Assert `raw` returns identical bytes in every build. In a fixture with one dependency requesting compression and another requesting no defaults, build them together and verify the raw caller still succeeds. Inspect `cargo tree -e features` in that fixture to see which dependency enabled the codec.
