# Testing Rust

- Use module tests for focused behavior and integration tests for public crate interfaces.
- Run relevant feature combinations and doc tests where the changed API is exposed; check error variants as well as success.

## Use consumer-facing integration cases

Compile an integration test as a separate consumer for public APIs. Exercise both successful parsing and the relevant error variant on malformed data; avoid pinning Display prose unless it is a documented interface.

## Account for feature gates

Run the repository-supported feature sets affected by conditional code, not only the developer default. For filesystem behavior use independent temporary paths and assert cleanup after an early error.
