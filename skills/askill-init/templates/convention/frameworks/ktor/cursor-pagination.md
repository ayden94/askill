# Cursor pagination

## When to read

Read when a list needs a continuation token that still works if earlier rows are removed.

## Use a strict, total order and bind the cursor to the query

**Wrong —** deleting a row from a prior page shifts the offset and skips an unseen row.

```kotlin
val page = widgets.list(actor.tenantId, offset = pageNumber * size, limit = size)
call.respond(page)
```

**Right —** fetch one extra item in key order and encode the last item actually returned.

```kotlin
val tokens = call.request.queryParameters.getAll("after")
val after = if (tokens == null) null else tokens.singleOrNull()
    ?.let { cursors.decode(it, actor.tenantId, filter) }
if (tokens != null && after == null) {
    call.respond(HttpStatusCode.BadRequest, ApiError("invalid_cursor"))
    return@get
}

val rows = widgets.listAfter(actor.tenantId, filter, after, size + 1)
val items = rows.take(size)
val next = if (rows.size > size) {
    cursors.encode(items.last().key, actor.tenantId, filter)
} else null
call.respond(WidgetPage(items, next))
```

## Tradeoffs and assumptions

`size` is already a bounded positive integer. The local codec verifies token authenticity, tenant and normalized filter, and returns null for invalid input. The repository uses a matching exclusive `(createdAt, id)` bound and deterministic order with immutable keys. A cursor is not a transaction spanning pages; use an explicit snapshot contract if the client needs point-in-time results.

## Verification

Page through rows with tied timestamps, deleting one previously delivered row before the next request. Assert each remaining expected row appears once and the terminal page has a null token. Change the filter and repeat the token parameter; both requests should return 400 without a list query.
