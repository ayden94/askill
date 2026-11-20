# Request and response boundaries

**Assumptions:** The JSON parser and `requirePrincipal` have run. `parseCreateOrder` rejects missing, incorrectly typed, out-of-range and extra fields. Resource permission and stock consistency belong to the use case. The snippet uses returned promise handling on Express 5; use the project's error-forwarding wrapper on Express 4.

`express.json()` decodes bytes; it does not prove shape, range or authorization. Parse body, params and query separately as needed and pass a narrow command into the application. Do not rely on a TypeScript assertion, pass `req` to the domain, or write a whole transport payload to storage. Return a response DTO rather than the persisted object.

## Bad

```js
router.post('/', async (req, res) => {
  res.status(201).json(await orders.insert(req.body));
});
```

## Good

```js
router.post('/', async (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ code: 'EXPECTED_JSON' });
  }
  const parsed = parseCreateOrder(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ code: 'INVALID_ORDER' });
  }
  const order = await placeOrder.execute(res.locals.actor, parsed.value);
  return res.status(201).json({ id: order.id, state: order.state });
});
```

Mapping both directions prevents new writable persistence fields and internal response fields from becoming public by accident. Parser errors are client failures; a database outage is not invalid input. Do not coerce empty strings or repeated query values into valid commands unless the API expressly defines that behavior.

**Exception:** A documented compatible API may ignore unknown fields. Still project only the accepted command fields; passthrough to storage is not forward compatibility.

## Verification

1. Send missing, null, string, fractional, zero and oversized quantity values plus an extra administrative field. Assert the API contract and no rows written for rejected inputs.
2. Send valid JSON with the wrong content type and verify the configured media-type contract.
3. Send an authorized valid command and verify the persisted owner came from the authenticated principal; ensure internal fields are absent from the response.
