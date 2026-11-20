# Python

- Keep imports free of network calls and other process-wide side effects.
- Use context managers for owned resources and catch specific exceptions at the boundary that can handle them.

## Separate coordination from computation

Pass an iterable or a reader to parsing code instead of opening a hard-coded path inside the parser. Name functions for the result or effect; keep CLI parsing and process exit at the entry point.

## Avoid hidden shared state

Do not use a mutable default argument to accumulate request-local data. Allocate per call or make the shared cache and its lifecycle explicit. Document whether an iterator is single-use before consuming it twice.

## Map errors at a useful boundary

Translate an expected missing record where the caller can act on it. Do not catch every exception and return an empty collection: a database outage is not a successful empty result. Close files and clients on exceptional exits.
