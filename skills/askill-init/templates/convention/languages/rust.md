# Rust

- Borrow when the caller retains ownership; clone only where an owned value is needed.
- Return Result for recoverable failures and reserve panics for documented invariants.

## Design ownership at the interface

Accept a borrowed slice when only reading a collection. Take ownership when transferring it into a long-lived value. Do not clone just to hide a lifetime problem without explaining who now owns the data.

## Make fallibility visible

Use Option for ordinary absence and Result when the caller needs a reason. An unwrap in a request handler can turn malformed input into a panic; parse at the boundary and propagate an actionable error.

## Keep critical sections small

Do not hold a lock across unrelated I/O when a snapshot or short mutation is sufficient. If state can change after releasing the lock, validate the invariant again before committing the result.
