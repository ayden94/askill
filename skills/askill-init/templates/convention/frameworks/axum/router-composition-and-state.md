# Router composition and state

**Invariant:** Compose routers against one missing-state type and scope the identity guard to routes that require it.

**Compatibility:** Stable state composition in Axum 0.6–0.8; middleware request types change at 0.7, and path registration changes at 0.8. See the [Axum changelog](https://github.com/tokio-rs/axum/blob/axum-v0.8.0/axum/CHANGELOG.md).

**Acceptance check:** The assembled router keeps health public and misses unguarded; only authorized requests can call protected operations, including at parameterized paths.

## When to read

Read when splitting or nesting routers, introducing application state, or changing which endpoints a middleware layer covers.

## Leave subrouters missing state until the composition root

**Wrong —** cloning the router builder does not solve mismatched missing-state types. These two routers cannot be merged as written.

```rust
let reads: Router<AppState> = Router::new().route("/widgets", get(list));
let writes: Router<()> = Router::new()
    .route("/widgets", post(create))
    .with_state(state);
let app = reads.merge(writes);
```

**Right —** compose routers that still need the same state, then provide it once. `Router<AppState>` means the router is missing `AppState`; `Router` is shorthand for `Router<()>`.

```rust
fn widgets_routes() -> Router<AppState> {
    Router::new().route("/widgets", get(list).post(create))
}

fn app(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(health))
        .nest("/v1", widgets_routes())
        .with_state(state)
}
```

Use `State` for dependencies that exist for every request. When a handler only needs one collaborator, extract a narrow substate using `FromRef<AppState>` rather than reaching into unrelated state. Request identity belongs in request extensions or a dedicated extractor, not shared application state.

## Scope authorization to matched protected routes

**Wrong —** wrapping the entire service with a rejecting layer can change unmatched requests from 404 to 401 and inadvertently block health checks.

```rust
let app = Router::new()
    .route("/widgets", post(create))
    .route("/healthz", get(health))
    .layer(middleware::from_fn(require_actor));
```

**Right —** register the protected routes first and use `route_layer` on that subrouter before merging public routes.

```rust
let protected = Router::new()
    .route("/widgets", post(create))
    .route_layer(middleware::from_fn(require_actor));
let app = Router::new()
    .route("/healthz", get(health))
    .merge(protected);

async fn require_actor(mut req: Request, next: Next) -> Response {
    let Some(actor) = authenticate(req.headers()) else {
        return unauthorized_response();
    };
    req.extensions_mut().insert(actor);
    next.run(req).await
}
```

Here `Request` is `axum::extract::Request`, `Next` is `axum::middleware::Next`, and the local `unauthorized_response` supplies the agreed status, body, and any required challenge. `route_layer` only applies to routes already configured. Use `from_fn_with_state` when the middleware itself needs shared state.

- **Axum 0.6.x:** Use `async fn require_actor<B>(mut req: axum::http::Request<B>, next: Next<B>) -> Response`; keep the same guard body. Register dynamic paths as `/widgets/:id` and catchalls as `/assets/*tail`.
- **Axum 0.7.x:** Use the non-generic middleware signature above. Keep `/widgets/:id` and `/assets/*tail`.
- **Axum 0.8.x:** Keep the 0.7 middleware signature, but register `/widgets/{id}` and `/assets/{*tail}`. Disabling old-syntax checks does not restore old capture behavior; migrate route strings and test actual extraction.

## Exceptions and tradeoffs

A deliberate global denial policy or global tracing across misses may need a wider layer than `route_layer`. A nested router may supply its own state if it owns an independent subsystem, but ensure missing state types agree at the merge and dependency lifetimes are explicit. Do not rely on middleware ordering alone for row-level authorization; the application operation still checks actor-to-resource permissions.

## Verification and pass criteria

Construct the exact router used to serve requests. Send a public health request, an unknown path under the API mount, and authenticated and unauthenticated requests to the protected route. Pass when health succeeds, the miss follows the chosen fallback (404 in this example), denied requests never call the write, and an accepted request reads the injected actor and uses the injected service instance exactly once.
