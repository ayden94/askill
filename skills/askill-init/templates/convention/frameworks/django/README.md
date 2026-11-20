# Django rulebook

Read the smallest set of leaves that covers the change. Use the installed Django version, settings, database backend, and existing app conventions as the source of truth. Examples use Django core; adapt the HTTP adapter if the project uses Django REST Framework.

| Task | Read |
| --- | --- |
| Change a form, view, permission check, or object lookup | [Request boundaries](request-boundaries.md) |
| Add a constraint, backfill rows, or roll out a schema change | [Schema and migrations](schema-and-migrations.md) |
| Change multi-write workflows, locking, callbacks, or list queries | [Transactions and queries](transactions-and-queries.md) |
| Write a regression or choose a client, transaction, or live-server harness | [Testing](testing.md) |

Combine request boundaries and testing for every changed write endpoint. Add schema and transaction guidance when an invariant must survive concurrent or non-HTTP writers.
