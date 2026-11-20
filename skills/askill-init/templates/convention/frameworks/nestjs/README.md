# NestJS rulebook

Check the installed Nest packages and HTTP adapter, TypeScript decorator configuration, validation strategy and persistence adapter. Preserve the project's transport and transaction contracts rather than adding layers to mirror the examples.

| Task | Read |
| --- | --- |
| Add a provider, consume another feature, or fix a circular import | [Modules and dependency injection](modules-and-di.md) |
| Add an HTTP route or change which layer owns its behavior | [HTTP boundaries](http-and-dtos.md) |
| Change accepted fields, conversion, nested DTOs, or public response fields | [Validation and serialization](validation-and-serialization.md) |
| Change who may read or modify a particular resource | [Resource authorization](authorization.md) |
| Change exception mapping, public errors, logs, or correlation IDs | [Errors and observability](errors-and-observability.md) |
| Add configuration, startup checks, or a shared client with cleanup | [Configuration and lifecycle](configuration-and-lifecycle.md) |
| Coordinate writes, delivery or retries | [Transactions and retries](transactions-and-retries.md) |
| Prove a domain rule, provider wiring, or live transport behavior | [Unit, module and HTTP verification](testing.md) |
| Change list queries, pagination, ORM behavior, or schema compatibility | [Queries and migrations](query-and-migrations.md) |
| Change job delivery, consumer retries, or worker shutdown | [Queues and workers](queues-and-workers.md) |
| Change a GraphQL resolver, schema field, or batch loader | [GraphQL resolvers](graphql-resolvers.md) |

Installation makes all topics available; it does not make them all applicable. For a DTO-only change, read validation and serialization, plus HTTP testing if the wire behavior changes. Do not read queue or GraphQL guidance merely because its package is installed.
