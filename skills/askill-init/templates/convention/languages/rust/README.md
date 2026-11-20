# Rust rulebook

Read only the leaves that apply to the change; choose multiple rows when contracts overlap. Start with the workspace's `Cargo.toml`, toolchain file, minimum supported Rust version (MSRV), supported feature sets, and CI commands. The examples assume Rust 2021 syntax and the standard library unless stated otherwise. Do not change the edition, MSRV, or dependencies just to adopt an example.

| If you are changing… | Read |
| --- | --- |
| Function parameters, returned data, or a worker that stores its input | [Borrowing and ownership](ownership.md) |
| External parsing, lookups, or error translation | [Fallibility at boundaries](fallibility.md) |
| Shared mutation, lock scopes, or expensive work against a snapshot | [Lock scope and stale results](shared-state.md) |
| Regressions, public APIs, feature gates, or documentation examples | [Testing crate contracts](testing.md) |
| Implementor obligations, trait objects, or public bounds | [Trait boundaries](trait-boundaries.md) |
| Public enums, structs, or downstream matching | [Evolving public data types](public-api-evolution.md) |
| Lazy traversal, fallible items, or early exit | [Iterator contracts](iterator-contracts.md) |
| Competing futures, timed I/O, or cancellation | [Async cancellation and partial progress](async-cancellation.md) |
| Cargo feature flags or optional dependencies | [Additive Cargo features](cargo-features.md) |
| Renaming or adding persisted or wire fields | [Serde schema evolution](serde-evolution.md) |
| FFI inputs, raw pointers, or safe wrappers over unsafe calls | [FFI buffer contracts](ffi-boundaries.md) |

When adding a shared cache, design the snapshot and commit separately, then test the public behavior with the relevant Cargo feature sets.
