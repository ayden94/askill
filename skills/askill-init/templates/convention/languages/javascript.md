# JavaScript

- Keep return values and error behavior consistent across synchronous and asynchronous callers.
- Prefer module-local state; inject clocks or I/O at boundaries rather than modifying globals.

## Make coercion intentional

For an optional limit, `limit ?? defaultLimit` preserves a valid zero; `limit || defaultLimit` also replaces zero. Decide whether empty strings, missing properties, and null mean different things at the boundary.

## Own every asynchronous outcome

Use sequential awaits when operations depend on each other. Run independent reads concurrently only if failure and concurrency limits are understood. `items.forEach(async ...)` does not wait for completion; return an awaited operation to the caller.

## Keep mutation local

Do not sort a caller-owned array in place unless the API promises mutation. Review the order of writes when two async operations can overlap and what happens to the other operation if one rejects.
