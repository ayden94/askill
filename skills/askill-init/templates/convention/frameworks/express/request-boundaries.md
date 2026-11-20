# Request and response boundaries

**Invariant:** Only an authenticated request with a valid, explicitly projected command reaches the use case, and the response exposes only the advertised fields.

`express.json()` and `res.status().json()` in this recipe are portable across Express 4.16.0–4.x and 5.x. Pass `req.body` to the parser without relying on an empty-object sentinel: an unparsed body in 5.x may be `undefined` where a 4.x parser path supplied `{}` ([`express.json()` introduction](https://github.com/expressjs/express/releases/tag/4.16.0), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html#reqbody)). Use `router.post('/', forwardAsync(postOrder))` on 4.x with the [explicit forwarding adapter](errors-and-responses.md#good); register the async function directly on 5.x.

**Assumptions:** The JSON parser and `requirePrincipal` have run. `parseCreateOrder` rejects non-objects, missing, incorrectly typed, out-of-range and extra fields. Resource permission and stock consistency belong to the use case.

`express.json()` decodes bytes; it does not prove shape, range or authorization. Parse body, params and query separately as needed and pass a narrow command into the application. Do not rely on a TypeScript assertion, pass `req` to the domain, or write a whole transport payload to storage. Return a response DTO rather than the persisted object.

## Bad

```js
router.post('/', async (req, res) => {
  res.status(201).json(await orders.insert(req.body));
});
```

## Good

```js
async function postOrder(req, res) {
  if (!req.is('application/json')) {
    return res.status(415).json({ code: 'EXPECTED_JSON' });
  }
  const parsed = parseCreateOrder(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ code: 'INVALID_ORDER' });
  }
  const order = await placeOrder.execute(res.locals.actor, parsed.value);
  return res.status(201).json({ id: order.id, state: order.state });
}
router.post('/', postOrder);
```

Mapping both directions prevents new writable persistence fields and internal response fields from becoming public by accident. Parser errors are client failures; a database outage is not invalid input. Do not coerce empty strings or repeated query values into valid commands unless the API expressly defines that behavior.

**Exception:** A documented compatible API may ignore unknown fields. Still project only the accepted command fields; passthrough to storage is not forward compatibility.

## Verification

1. Send missing, null, string, fractional, zero and oversized quantity values plus an extra administrative field. Assert the API contract and no rows written for rejected inputs.
2. Send valid JSON with the wrong content type and verify the configured media-type contract.
3. Send an authorized valid command and verify the persisted owner came from the authenticated principal; ensure internal fields are absent from the response.
4. On either major, assert `{}` cannot write and that an unexpected use-case rejection produces the same safe error response exactly once.
