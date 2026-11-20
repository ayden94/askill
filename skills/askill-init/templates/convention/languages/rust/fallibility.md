# Fallibility at boundaries

## When to read

Read when parsing configuration, returning a lookup result, introducing `?`, or handling failed I/O. Identify which failures an ordinary caller can recover from and which are actual invariant violations.

## Represent missing input separately from malformed input

Error-prone: this panics on invalid input and admits a port that this particular config forbids.

```rust
fn configured_port(raw: Option<&str>) -> Option<u16> {
    raw.map(|text| text.parse::<u16>().unwrap())
}
```

Recommended: omission is `Ok(None)`; present values must be ASCII decimal digits, fit `u16`, and be nonzero.

```rust
#[derive(Debug, PartialEq, Eq)]
enum PortError {
    InvalidDecimal,
    OutOfRange,
}

fn configured_port(raw: Option<&str>) -> Result<Option<u16>, PortError> {
    raw.map(|text| {
        if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(PortError::InvalidDecimal);
        }
        let port = text.parse::<u16>().map_err(|_| PortError::OutOfRange)?;
        if port == 0 {
            return Err(PortError::OutOfRange);
        }
        Ok(port)
    })
    .transpose()
}
```

After the digit check, a failed `u16` parse is an overflow. `transpose` changes `Option<Result<…>>` to `Result<Option<…>>`, making it hard to confuse error and absence. The example rejects `0` intentionally; a listener asking the OS for an ephemeral port should accept it instead. Apply defaults after handling the `Result`, and only trim whitespace if the input contract allows it.

## Convert only the specific error that means absence

Error-prone: calling `.ok()` treats permission errors, read failures, and invalid UTF-8 as if the optional file were missing.

```rust
fn load_note(path: &std::path::Path) -> Option<String> {
    std::fs::read_to_string(path).ok()
}
```

Recommended: map only `NotFound` to absence and let all other errors retain their kind and cause.

```rust
use std::{fs, io, path::Path};

fn load_note(path: &Path) -> io::Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}
```

This treats a missing parent or dangling link reported as `NotFound` as absence too; require a stronger filesystem contract if deployment must distinguish those cases. Do not check `exists()` and then read: the file can change between operations, and the initial check may discard permissions information. At service boundaries, add operation context without replacing the original error; at public boundaries, avoid exposing internal paths. Reserve `expect`/panic for a documented programmer invariant, not malformed external data.

## Verification and pass criteria

Pass `None`, empty input, `+1`, non-ASCII digits, `0`, `1`, `65535`, and `65536` to the parser and assert the specific outcome of each. For the filesystem case, use an isolated directory with a missing path, an existing empty file, and an invalid UTF-8 file. Only the missing path produces `Ok(None)`; empty content is a successful value, and decoding failure is still an error.
