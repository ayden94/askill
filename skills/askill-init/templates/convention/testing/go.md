# Testing Go

- Use table-driven subtests for distinct error and success cases; use t.TempDir for filesystem isolation.
- For concurrency changes, run relevant tests with the race detector when supported. Avoid sleeps as synchronization.

## Exercise cancellation deterministically

Arrange a worker that signals when it has started; cancel its context and wait for its completion signal with a bounded timeout. Sleeping for an estimated startup time cannot establish the same ordering.

## Choose meaningful table rows

Name each subtest for the boundary it covers, such as wrapped not-found versus transient failure. Compare public errors with errors.Is or errors.As and test the returned result, not the private call sequence.
