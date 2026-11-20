# Rust rulebook

Start with the workspace's `Cargo.toml`, toolchain file, minimum supported Rust version (MSRV), supported feature sets, and CI commands. The examples assume Rust 2021 syntax and the standard library unless stated otherwise. Do not change the edition, MSRV, or dependencies just to adopt an example.

| If you are changing… | Read |
| --- | --- |
| Function parameters, returned data, or a worker that stores its input | [Borrowing and ownership](ownership.md) |
| External parsing, lookups, or error translation | [Fallibility at boundaries](fallibility.md) |
| Shared mutation, lock scopes, or expensive work against a snapshot | [Lock scope and stale results](shared-state.md) |
| Regressions, public APIs, feature gates, or documentation examples | [Testing crate contracts](testing.md) |

When adding a shared cache, design the snapshot and commit separately, then test the public behavior with the relevant Cargo feature sets.
