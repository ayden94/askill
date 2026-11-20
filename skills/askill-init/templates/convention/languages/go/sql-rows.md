# Check row iteration before publishing a SQL result

## When to read

Read when adding a multi-row query whose caller expects a complete result or an error.

## Decision

Close rows on all exits, handle each scan error, and check `Rows.Err()` after `Next()` returns false. `Next` alone cannot tell clean exhaustion from a late driver failure, so returning the accumulated slice can misreport a prefix as complete.

## Bad

```go
package inventory

import (
	"context"
	"database/sql"
)

func ActiveSKUs(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT sku FROM active_inventory`)
	if err != nil {
		return nil, err
	}
	var result []string
	for rows.Next() {
		var sku string
		if err := rows.Scan(&sku); err != nil {
			return nil, err
		}
		result = append(result, sku)
	}
	return result, nil
}
```

## Good

```go
package inventory

import (
	"context"
	"database/sql"
	"fmt"
)

func ActiveSKUs(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT sku FROM active_inventory`)
	if err != nil {
		return nil, fmt.Errorf("query active inventory: %w", err)
	}
	defer rows.Close()

	var result []string
	for rows.Next() {
		var sku string
		if err := rows.Scan(&sku); err != nil {
			return nil, fmt.Errorf("scan active SKU: %w", err)
		}
		result = append(result, sku)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate active SKUs: %w", err)
	}
	return result, nil
}
```

## Assumptions and trade-offs

This is one bounded, read-only result set with a nonnull text SKU column and no ordering guarantee. Use pagination with an explicit order instead of accumulating an unbounded result. Full exhaustion normally closes rows, but the deferred close covers an early return. This read-only contract does not treat deferred close as a separate success operation; statements with write effects may need explicit close error handling.

## Verification

Use the project's test driver to yield one valid row and then fail iteration with a sentinel. Separately return a value that cannot scan into `string`, and run a valid zero-row query. **Pass:** failures return no slice and release the rows, the late error remains matchable with `errors.Is`, and zero rows succeed.
