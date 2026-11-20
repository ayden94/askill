# Testing TypeScript

- Run the project typecheck separately from runtime tests; neither replaces the other.
- Test invalid external input at runtime and cover public type contracts with the existing type-test harness.

## Separate type and runtime contracts

A compile-time negative case can show that a caller cannot pass a string ID of the wrong type. It cannot show that incoming JSON is valid. Feed malformed JSON-shaped data through the public parser and assert the actual failure.

## Review fixtures as callers

Prefer fixtures built against the real input type over forced assertions that manufacture impossible states. Reserve unknown values for boundary tests and check that each discriminated result branch has an observable outcome.
