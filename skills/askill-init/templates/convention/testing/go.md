# Testing Go

- Use table-driven subtests for distinct error and success cases; use t.TempDir for filesystem isolation.
- For concurrency changes, run relevant tests with the race detector when supported. Avoid sleeps as synchronization.
