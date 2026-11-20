# Queries and schema changes

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
WHERE (created_at, id) < (:cursor_time, :cursor_id)
ORDER BY created_at DESC, id DESC LIMIT 20;
```

## Assumptions and exceptions

The example assumes PostgreSQL-style tuple comparison, non-null immutable ordering keys and a subsequent page. Use your dialect’s equivalent and retain tenant filters. For a schema change, add compatible storage before switching readers; destructive cleanup belongs after old readers are retired.

## Verification

Seed multiple rows with identical timestamps across a page boundary. Fetch sequential pages and check no duplicates or gaps on a stable dataset. Inspect the query plan on representative data. For migrations, run the previous and new reader against the intermediate schema.
