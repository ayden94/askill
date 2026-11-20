# Resource visibility

## When to read

Read when an authenticated endpoint needs a policy for missing, hidden, and discoverable-but-forbidden resources.

## Decide discoverability before mapping action denial

**Wrong —** looking up a row globally then returning 403 for any denial exposes existence to callers who may not discover it.

```rust
let widget = state.widgets.find(id).await?.ok_or(ApiError::NotFound)?;
if !policy.may_export(&actor, &widget) {
    return Err(ApiError::Forbidden);
}
Ok(Json(widget.export_view()))
```

**Right —** use trusted actor scope in the lookup and distinguish action denial only within the set of visible rows.

```rust
async fn export_widget(
    State(state): State<AppState>,
    Extension(actor): Extension<Actor>,
    Path(id): Path<u64>,
) -> Result<Json<WidgetExport>, ApiError> {
    let widget = state.widgets.find_visible_to(&actor, id).await?
        .ok_or(ApiError::NotFound)?;
    if !state.policy.may_export(&actor, &widget) {
        return Err(ApiError::Forbidden);
    }
    Ok(Json(widget.export_view()))
}
```

## Tradeoffs and assumptions

The required authentication layer inserts the trusted actor on this route. The policy allows some actors to discover a widget without exporting it. `find_visible_to` applies the scope in the repository and returns `None` only when no visible row exists; backend errors remain separate. For mutations, enforce visibility and permission at the write boundary rather than relying on a stale read.

## Verification

Exercise the mounted route with an absent row, a row in another tenant, a visible row the actor cannot export, and an exportable row. Verify equal documented 404 responses for the first two, 403 for the third, and the intended view for the last. Check that no denied case runs export generation.
