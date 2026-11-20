# Testing Python

- Use the project runner and isolate filesystem and environment changes with temporary resources.
- Exercise exception types and observable effects; patch external I/O where the code under test looks it up.

## Isolate side effects

Use a temporary directory and an isolated environment for configuration tests. Test both a missing setting and a present but invalid one if they have different outcomes; do not let a developer machine supply a fallback.

## Check the failure path

For a file importer, provide an invalid second row. Assert the reported row and the agreed partial-write or rollback behavior. Mock the transport rather than the parser when the claim is about parsing real input.
