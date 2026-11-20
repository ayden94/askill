# Testing Java

- Run targeted tests with the repository build wrapper and isolate database or JVM-wide state.
- Exercise the public service contract in unit tests; use the configured integration suite for transaction boundaries.

## Keep fixture scope deliberate

Use a new fixture per case unless sharing is necessary and reset is explicit. If timing affects behavior, inject a Clock rather than comparing with the real current instant. Assert the externally visible state after the operation.

## Check durable effects

When testing persistence, flush or reopen the persistence context where appropriate so an in-memory identity map does not supply the result. A mocked repository cannot prove a unique constraint or transaction rollback.
