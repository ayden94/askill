# Cursor pagination

## When to read

Add a next-page contract for a long, ordered collection that can gain or lose rows.

**Assumptions:** Express 5 with a validated query parser. Tenant, filter, timestamp and unique ID use consistent storage comparison semantics; timestamps are immutable. This endpoint promises forward traversal, not snapshot isolation.

Sort on a unique tuple with a tie-breaker; encode that same tuple in the cursor, including full stored precision. Bind cursors to the filter, ordering and authorized scope. Bound the page size and reject malformed or incompatible cursors before querying. Request one extra row to determine whether there is more.

## Bad

```js
const rows = await orders.find({
  createdBefore: req.query.cursor,
  orderBy: ['created_at DESC'],
  limit: Number(req.query.limit),
});
```

## Good

```js
app.get('/orders', requireActor, async (req, res) => {
  const actor = res.locals.actor;
  // Returns null for bad input, a limit outside 1–100, or mismatched cursor scope.
  const page = parseOrdersPage(req.query, actor.tenantId);
  if (!page) return res.status(400).json({ code: 'INVALID_PAGE' });

  // SQL contract: tenant/filter predicates AND (created_at, id) < (:time, :id)
  // when after is present; ORDER BY created_at DESC, id DESC.
  const rows = await orders.listVisibleTo(actor, {
    filter: page.filter, after: page.after, limit: page.limit + 1,
  });
  const items = rows.slice(0, page.limit);
  const nextCursor = rows.length > page.limit
    ? encodeOrdersCursor(items.at(-1), page.filter, actor.tenantId)
    : null;
  return res.json({ items: items.map(toOrderSummary), nextCursor });
});
```

The cursor describes the last returned row, not the extra one. The repository still applies actor scope on every read; a cursor is not authorization. Offset pagination can be reasonable for small lists that require jumping to a page. If an export needs an immutable view, use an explicit snapshot contract instead of assuming a cursor freezes the dataset.

## Verification

1. Seed several rows with identical timestamps across a page boundary. Traverse with a small limit and assert every authorized row appears exactly once in order and the last cursor is null.
2. Insert a newer row and remove the previous boundary row between requests; confirm the continuation still uses the tuple. Verify parser rejection for malformed, over-limit and mismatched-filter cursors.
