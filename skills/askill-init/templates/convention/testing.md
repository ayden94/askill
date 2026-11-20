# Testing and verification

- Verify behavior through a public or otherwise observable boundary. Include meaningful failure cases, not only the happy path.
- For refactors, establish the behavior to preserve before editing and repeat the same checks afterward.
- Record what ran, the result, and any missing environment or evidence. Do not report unexecuted checks as passing.

## Choose the boundary that can fail

A unit test can prove a pricing rule, not that the database rejected a duplicate write. Use the smallest boundary that includes the suspected failure. Give each test one scenario, distinct fixtures, and an expected outcome independent of the production calculation.

## Make failure observable

Before fixing a bug, run a reproduction against the unchanged base. Record which assertion fails. After the change, run the same case plus a neighboring case that should stay unchanged. Use a controlled clock or synchronization event instead of sleeps.

## Ask for evidence, not coverage theater

For a retry, verify the final persisted count, not just how often a mock received a call. For a refactor, compare outputs, side effects, and error handling with the same inputs on both versions. Separate untested paths from confirmed failures.
