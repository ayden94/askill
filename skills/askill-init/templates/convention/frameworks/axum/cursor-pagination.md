# Cursor pagination

**Invariant:** Resume after the last returned key, not the lookahead row, and bind the cursor to the original query scope.

**Compatibility:** Stable application/store policy in Axum 0.6–0.8. [`Query<T>`](https://docs.rs/axum/0.8.0/axum/extract/struct.Query.html) decodes a DTO; `after: Option<String>` is a field of the DTO, not an optional Axum extractor. Keep `Query<ListParams>` required even when the token is absent.

**Acceptance check:** With tied keys, each lookahead row starts the next page and the terminal page has no token; changed-scope tokens fail before any list call.

## When to read

Read when a list needs reproducible continuation across requests rather than numbered pages.

## Carry the last returned key, not the lookahead row

**Wrong —** encoding the extra row as the exclusive starting point skips that row on the next request.

```rust
let mut rows = state.widgets.list_after(&scope, after, size + 1).await?;
let next = if rows.len() > size {
    rows.pop().map(|extra| state.cursors.encode(&scope, extra.key()))
} else {
    None
};
Ok(Json(WidgetPage { items: rows, next }))
```

**Right —** validate the token against the same query scope and encode the last retained row.

```rust
let after = params.after.as_deref()
    .map(|token| state.cursors.decode(&scope, token))
    .transpose()
    .map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "invalid_cursor"))?;
let mut rows = state.widgets.list_after(&scope, after, size + 1).await?;
let has_more = rows.len() > size;
rows.truncate(size);
let next = if has_more {
    rows.last().map(|row| state.cursors.encode(&scope, row.key()))
} else {
    None
};
Ok(Json(WidgetPage { items: rows, next }))
```

## Tradeoffs and assumptions

This snippet sits after extraction of `Query<ListParams>` and validation of a bounded positive `size`. The scope includes authenticated tenant and normalized filters; the codec checks scope and token authenticity. Use a strict, indexed `(created_at, id)` order with immutable keys. This yields stable continuation relative to the key, not a snapshot of membership or visibility.

## Verification

Create five rows including tied timestamps and page with size two. Assert exact ordered IDs on all three pages, including each lookahead row on the next page, and no token on the last page. Reuse a token with a changed filter and assert 400 before the repository is called.
