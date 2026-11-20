# Cursor pagination

**Invariant:** A continuation resumes strictly after the last returned key in the same authenticated query scope.

**Compatibility:** Stable application and database policy; the Gin 1.x example uses [`GetQueryArray`](https://pkg.go.dev/github.com/gin-gonic/gin@v1.11.0#Context.GetQueryArray) only to preserve scalar parameter multiplicity. Neither cursor encoding nor keyset ordering depends on Gin.

**Acceptance check:** Traverse tied keys with an intervening newer insertion without repeating or skipping original rows; reject a tampered, repeated, or cross-scope token before querying.

## When to read

Read when clients traverse a list that can change between requests.

## Continue from a stable ordering key

**Wrong —** inserting a newer row shifts offsets; sorting only by a timestamp also makes equal-timestamp rows unstable.

```go
rows, err := h.store.ListByCreatedAt(c.Request.Context(), page*size, size)
writePage(c, rows, err)
```

**Right —** validate a continuation token against the current scope and filter, and query after its composite key.

```go
var token string
if values, present := c.GetQueryArray("after"); present {
    if len(values) != 1 || values[0] == "" {
        c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_cursor"})
        return
    }
    token = values[0]
}
after, err := h.cursors.Decode(token, actor.TenantID, filter)
if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_cursor"})
    return
}
rows, err := h.store.ListAfter(c.Request.Context(), actor.TenantID, filter, after, size+1)
if err != nil {
    writeListError(c, err)
    return
}
next := ""
if len(rows) > size {
    rows = rows[:size]
    next = h.cursors.Encode(actor.TenantID, filter, rows[size-1].Key())
}
c.JSON(http.StatusOK, gin.H{"items": rows, "next": next})
```

## Tradeoffs and assumptions

`size` is already validated and positive; the token codec treats absence as the first page and validates authenticity and scope for nonempty tokens. `Key()` contains immutable `(created_at, id)`; descending traversal filters strictly below that tuple using the same ordering and tenant filter. Match the index to the query. This is not snapshot isolation and does not support arbitrary page jumps.

## Verification

Seed tied timestamps across a page boundary. Traverse with page size two, insert a newer row between pages, and assert the original rows are visited once in order. Assert an empty or repeated token, a different filter, or a different tenant is rejected before querying, and the terminal page has no continuation.
