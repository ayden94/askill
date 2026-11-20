# Routing and middleware order

**Invariant:** The actual mounted method and path run admission and parsing before the write; a denial, parser failure or missing route never executes it.

The literal route and pathless 404 are portable across Express 4.16.0–4.x and 5.x with [`express.json()`](https://github.com/expressjs/express/releases/tag/4.16.0). If `requirePrincipal` or `createOrder` returns a promise, also apply [the major-specific forwarding rule](errors-and-responses.md).

**Assumptions:** This router exposes an authenticated JSON write; checking its credential requires headers only. `createOrder` expects an authenticated principal and parsed JSON. Any inherited global middleware runs before this mount.

Write middleware in dependency order. End the chain on denial; call `next()` only on continuation. Put a catch-all 404 after all normal routes and error middleware after the stack it handles. Name the mount, method and final path during review so a test exercises the same match as production.

## Bad

```js
const orders = express.Router();
orders.post('/', createOrder);
orders.use(requirePrincipal, express.json());
app.use('/api/orders', orders);
```

## Good

```js
const orders = express.Router();
orders.post('/', requirePrincipal, express.json({ limit: '32kb' }), createOrder);
app.use('/api/orders', orders);
app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND' }));
app.use(reportAndMapError);
```

A handler that owns the response does not fall through to the later auth/parser middleware. Scope parsers to the routes needing them, set contract-appropriate limits, and test errors produced before the handler.

Use the pathless 404 above on both majors. If a specific GET wildcard must include `/` as well as descendants, Express 4.x uses `app.get('/*', fallback)`; Express 5.x uses `app.get('/{*splat}', fallback)`. `/*splat` in 5.x excludes `/`, and the wildcard parameter shape changes; do not reuse code that reads `req.params[0]` without adapting it ([Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html#path-route-matching-syntax)). For either pattern, verify `/` and `/nested/path` reach that GET fallback without overshadowing an earlier explicit route.

**Exception:** A signed-webhook route may require raw request bytes before signature verification. Scope its raw parser and size limit to that route, mount it before normal JSON parsing, and prohibit writes until verification succeeds.

## Verification

1. Request `POST /api/orders` without credentials, then with valid credentials and malformed JSON; assert the documented failures and no write.
2. Send valid JSON with valid credentials; assert one persisted write. Exercise size and media-type boundaries using the real mount.
3. Try a missing path and any overlapping static/parameter routes. If changing wildcard syntax, test both the root and nested paths against the installed major.
