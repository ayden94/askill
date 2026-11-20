# Authentication and authorization

**Invariant:** Only a verified principal with the required capability reaches tenant-scoped data access, and verifier unavailability is not reported as bad credentials.

The authorization decisions, `res.locals`, and response APIs are portable across Express 4.x and 5.x. The registration below is native on 5.x; on 4.x register `app.get('/reports', forwardAsync(requireActor), forwardAsync(listReports))` using the [explicit forwarding adapter](errors-and-responses.md#good). Rejections from either function must reach the same error mapper exactly once ([Express migration guide](https://expressjs.com/en/guide/migrating-5.html#rejected-promises-handled-from-middleware-and-handlers)).

## When to read

Integrate a credential verifier or change the distinction between invalid credentials, insufficient access, and verifier outage.

**Assumptions:** The project's bearer verifier returns a discriminated `valid` or `invalid` result and raises `VerifierUnavailable` on a dependency outage. The router's error middleware maps uncaught errors.

Verify credentials before constructing the principal. End the request on invalid credentials; don't treat a dependency outage as a signed-out user or admit a caller provisionally. Apply the capability check separately, then scope data access to the verified tenant.

## Bad

```js
async function listReports(req, res) {
  const result = await verifyBearer(req.get('authorization'))
    .catch(() => ({ kind: 'invalid' }));
  if (result.kind === 'invalid') return res.sendStatus(401);
  return res.json(await reports.listAll());
}
```

## Good

```js
async function requireActor(req, res, next) {
  let result;
  try {
    result = await verifyBearer(req.get('authorization'));
  } catch (error) {
    if (!(error instanceof VerifierUnavailable)) throw error;
    recordVerifierOutage(); // internal, redacted, non-throwing
    return res.status(503).json({ code: 'AUTH_UNAVAILABLE' });
  }
  if (result.kind === 'invalid') {
    return res.set('WWW-Authenticate', 'Bearer')
      .status(401).json({ code: 'UNAUTHENTICATED' });
  }
  res.locals.actor = result.actor;
  next();
}

async function listReports(_req, res) {
  const actor = res.locals.actor;
  if (!actor.permissions.includes('reports:read')) {
    return res.status(403).json({ code: 'FORBIDDEN' });
  }
  return res.json(await reports.listVisibleTo(actor));
}
app.get('/reports', requireActor, listReports);
```

The verifier owns credential validity; the data access operation owns tenant and record visibility. An API may intentionally return `404` for inaccessible individual resources. Keep that choice consistent and do not put a token or verifier detail into responses or logs.

## Verification

1. Request the real mount with missing and expired test credentials, then with a valid actor without the capability. Assert the `401` challenge versus `403`, with no list query.
2. Give a permitted actor fixtures in another tenant and verify they are absent from the result. Make the verifier unavailable and assert `503` with no list query, then restore it and confirm the valid request succeeds.
3. In either Express registration, reject unexpectedly from the verifier and then from the list call; each request reaches the error mapper once and returns its safe failure response.
