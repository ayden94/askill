# Axum

- Keep extractor failures, shared state, and response conversions explicit.
- Exercise the configured router as a service to verify status, headers, and body together.

## Type the boundary explicitly

Use extractors for transport inputs and convert them to domain values before invoking business logic. Keep shared state small; do not hold a lock through an awaited network call without a specific synchronization requirement. Centralize error-to-response mappings.

## Prove rejection and routing behavior

Exercise the assembled router with missing state-independent inputs or invalid payloads as applicable. Check that extraction failure does not call the write operation and that application failures retain the intended status and response body.
