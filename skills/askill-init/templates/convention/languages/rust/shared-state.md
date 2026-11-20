# Lock scope and stale results

**Invariant:** Do expensive work outside the lock, but publish its result only if the generation read under that lock is still current.

**Compatibility:** Portable in the supported range of Rust 2018 and later editions. `std::sync::Mutex`, lexical guard scope, owned cloning, and `Result` propagation are sufficient; the example requires no async runtime or feature. Async callers still must avoid holding this synchronous guard across suspension.

## When to read

Read before adding a `Mutex`, moving expensive work outside a critical section, or changing concurrent read/update semantics. Decide what is protected together and whether a delayed result may overwrite newer state.

## Snapshot under the lock, do I/O after releasing it

Here `state` is `Mutex<Manifest>`, `Manifest` is cloneable, and `write_manifest` performs blocking I/O. Error-prone: the guard stays alive through an operation unrelated to the mutex's protected memory.

```rust
fn export(state: &Mutex<Manifest>) -> Result<(), ExportError> {
    let guard = state.lock().map_err(|_| ExportError::StateUnavailable)?;
    write_manifest(&guard)
}
```

Recommended when exporting a point-in-time manifest is the contract:

```rust
fn export(state: &Mutex<Manifest>) -> Result<(), ExportError> {
    let snapshot = {
        let guard = state.lock().map_err(|_| ExportError::StateUnavailable)?;
        (*guard).clone()
    };
    write_manifest(&snapshot)
}
```

Choose a cheap immutable snapshot (possibly an `Arc` with immutable contents) if copying under the lock is expensive. Snapshot semantics do not order writes by competing exporters; if the destination must always contain the latest version, serialize publication or use a version-aware mechanism. In async code a synchronous mutex can protect a short, non-awaiting critical section when contention is low; do not keep its guard across `.await` or do blocking I/O on the executor thread. On poison, return a named error unless the project has a concrete way to repair the protected invariant before accepting the state.

## Revalidate before publishing a computed result

Assume every change to `items` takes the same lock, invalidates `total`, and advances a generation that never wraps or resets while work is in flight. Error-prone: calculation no longer blocks writers, but an old result can overwrite the current total.

```rust
fn refresh(state: &Mutex<Inventory>) -> Result<(), RefreshError> {
    let items = {
        let guard = state.lock().map_err(|_| RefreshError::StateUnavailable)?;
        guard.items.clone()
    };
    let total = calculate_total(&items)?;
    state.lock().map_err(|_| RefreshError::StateUnavailable)?.total = Some(total);
    Ok(())
}
```

Recommended: take generation and data from the same snapshot, then compare and publish under one guard.

```rust
fn refresh(state: &Mutex<Inventory>) -> Result<(), RefreshError> {
    let (generation, items) = {
        let guard = state.lock().map_err(|_| RefreshError::StateUnavailable)?;
        (guard.generation, guard.items.clone())
    };
    let total = calculate_total(&items)?;
    let mut guard = state.lock().map_err(|_| RefreshError::StateUnavailable)?;
    if guard.generation != generation {
        return Err(RefreshError::StaleSnapshot);
    }
    guard.total = Some(total);
    Ok(())
}
```

Calculation must use only generation-covered inputs. If two computations for the same snapshot can have different outputs and order matters, the generation check alone is insufficient. A pure computation can be retried under a bounded policy; do not repeat non-idempotent side effects on a stale-result retry. When the computation is genuinely tiny, a single critical section may be simpler than versioning.

## Verification and pass criteria

Use a test double or channels to pause the export writer after it receives its snapshot. Another worker must be able to update the manifest before the writer resumes; the export still contains the old consistent snapshot. Pause total calculation after snapshot, update items and generation, then finish calculation. `StaleSnapshot` is returned and the old total is not written. A no-change run must publish the expected total. Use bounded receives instead of sleeps and join both workers on cleanup.
