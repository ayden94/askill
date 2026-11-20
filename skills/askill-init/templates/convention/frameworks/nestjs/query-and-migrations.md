# Queries and schema changes

**Invariant:** A stable tenant-scoped list has a deterministic page order with no gaps or repeats, and both deployed application versions can use the schema during a rolling migration.

**Compatibility:** The SQL uses PostgreSQL [row comparison](https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON) with non-null keys; it has no Nest or ORM API dependency. The `:name` bind markers are query-layer notation, not raw `pg` parameters. If your project uses TypeORM, migration invocation is selected by **TypeORM**, not by `@nestjs/core`.

**Read when:** Only when a change affects persistence queries, pagination, indexes, or migrations.

## Decision

Use the project ORM or SQL layer. Check actual query shape, not just the number of repository calls. Give paginated queries a unique tie breaker and order the cursor by the same fields. Plan schema changes around old and new application versions coexisting.

## Bad

```sql
SELECT id, created_at FROM orders
ORDER BY created_at DESC LIMIT 20;
```

## Good

```sql
SELECT id, created_at FROM orders
WHERE tenant_id = :tenant
  AND (created_at, id) < (:cursor_time, :cursor_id)
ORDER BY created_at DESC, id DESC LIMIT 20;
```

## Assumptions and exceptions

The example shows a subsequent page; for the first page omit the cursor predicate but keep the tenant filter and the same order. Where the query layer cannot express the tuple comparison, use `created_at < :cursor_time OR (created_at = :cursor_time AND id < :cursor_id)` inside the tenant predicate. Bind values and preserve full cursor timestamp precision. For a schema change, add compatible storage before switching readers; destructive cleanup belongs after old readers are retired.

### If running migrations with the installed TypeORM CLI

- **TypeORM 0.2.x:** configure the connection in the project's `ormconfig` and run `typeorm migration:run` against compiled migrations; see the [0.2 migration guide](https://github.com/typeorm/typeorm/blob/0.2.45/docs/migrations.md).
- **TypeORM 0.3.x:** export the project `DataSource` from a module and run `typeorm migration:run -d ./dist/data-source.js`, pointing at the actual compiled path; see the [0.3.0 CLI source](https://github.com/typeorm/typeorm/blob/0.3.0/src/commands/MigrationRunCommand.ts). In both cases target the same intended database with explicit migration execution, not production `synchronize`.

## Verification

Seed two tenants and multiple rows with identical timestamps across a page boundary. Fetch sequential pages and check no duplicates, gaps, or foreign-tenant rows on a stable dataset. Inspect the query plan on representative data. On either migration recipe, apply the migration to a copy of the previous schema and verify that both old and new readers return the same expected records from the intermediate schema.
