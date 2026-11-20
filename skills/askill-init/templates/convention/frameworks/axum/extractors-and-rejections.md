# Extractors and rejections

## When to read

Read when changing handler arguments, accepting a body, validating decoded inputs, or promising a custom validation response.

## Put parts extractors before the single body consumer

**Wrong —** this handler does not satisfy `Handler`: `Json` consumes the body and is not last.

```rust
async fn replace(
    Json(input): Json<ReplaceBody>,
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<StatusCode, ApiError> {
    state.widgets.replace(id, input.name).await?;
    Ok(StatusCode::NO_CONTENT)
}
```

**Right —** extract shared state and parts first, then the body. Convert transport values to domain inputs before the write.

```rust
async fn replace(
    State(state): State<AppState>,
    Path(id): Path<u64>,
    Json(input): Json<ReplaceBody>,
) -> Result<StatusCode, ApiError> {
    let id = WidgetId::try_from(id)?;
    let name = WidgetName::parse(input.name)?;
    state.widgets.replace(id, name).await?;
    Ok(StatusCode::NO_CONTENT)
}
```

A numeric `Path` rejects invalid integer syntax before the handler runs; it does not enforce that zero is invalid in the domain. Setting a body size limit is a separate decision from validating fields.

## Preserve meaningful rejection categories

**Wrong —** a bare extractor is fine for Axum's default rejection, but it bypasses the handler's custom `ApiError` mapping on extraction failure.

```rust
async fn create(Json(input): Json<CreateBody>) -> Result<StatusCode, ApiError> {
    create_widget(input).await?;
    Ok(StatusCode::CREATED)
}
```

**Right —** when promising a stable JSON error, receive a `Result` for the relevant extractor and define how to translate the rejection. This endpoint deliberately preserves Axum's status and replaces the rejection body with a stable code.

```rust
use axum::extract::rejection::JsonRejection;

async fn create(
    body: Result<Json<CreateBody>, JsonRejection>,
) -> Result<StatusCode, ApiError> {
    let Json(input) = body.map_err(|rejection| {
        ApiError::new(rejection.status(), "invalid_widget_body")
    })?;
    create_widget(input).await?;
    Ok(StatusCode::CREATED)
}
```

`Result` handles only the extractor it wraps. If a path or query also promises the custom envelope, translate that extractor's rejection separately. An endpoint that repeats this policy can use a shared custom extractor. Do not put raw rejection text or input into the public response by default.

## Exceptions and tradeoffs

The default extractor response is sufficient when it is the intended contract. Raw byte or streaming handlers replace, rather than precede, the JSON extractor; streaming readers need a limit appropriate to their read path instead of assuming the default buffered-extractor limit applies. Apply a small explicit limit with `DefaultBodyLimit::max` for endpoints using buffered extraction when the API requires one.

## Verification and pass criteria

Send missing JSON content type, malformed JSON, wrong field types, a body over the configured limit, invalid path syntax, and valid input through the assembled router. For Axum's JSON status policy, expect 415, 400, 422, and 413 for the four JSON failures respectively; assert the custom code where configured. Pass only if the path failure uses its documented response, all rejections cause zero writes, and the valid body reaches the operation with validated domain values.
