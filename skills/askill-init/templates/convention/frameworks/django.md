# Django

- Keep model constraints and migrations consistent with the data contract.
- Exercise affected views using the test client and test database, including permission failures.

## Keep integrity in the right layer

Forms and serializers explain invalid input; database constraints protect concurrent writes and non-HTTP callers. Do not depend on a view-level existence check to make a value unique. Keep schema and data migrations explicit and review their effects on existing rows.

## Verify query and transaction behavior

Exercise the affected view with an unauthorized and an authorized user. If list performance changed, measure queries with several related rows rather than a single fixture. Use transaction-aware tests when commit timing or concurrent writes are part of the claim.
