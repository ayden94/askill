# Outbound HTTP: deadlines and dependency failures

**Invariant:** Only a documented upstream absence yields `null`; caller cancellation or budget expiry stops the active call, and no retry receives a fresh budget.

**Compatibility:** This is a Node Fetch example, not `@nestjs/axios` or an inbound adapter API. Node 18+ exposes `fetch` by default; Node 21 removed its experimental status. Signal composition has its own cutoff; use the older recipe below when `AbortSignal.any` is absent. See the [Node globals history](https://nodejs.org/api/globals.html#fetch).

**Read when:** A Nest provider calls another service and the change affects response time, retries, cancellation, or the meaning of “not found.”

## Keep transport policy at the adapter

The controller should not choose a different timeout for each call to the same operation by accident. Give the adapter an operation budget from validated configuration; pass a shorter caller deadline when one exists. Distinguish a documented upstream `404` from a timeout, invalid response, or unavailable service. A dependency outage must not look like a successful empty result.

### Error-prone

```ts
async function quote(sku: string) {
  try {
    const res = await fetch(`${pricingUrl}/quotes/${sku}`);
    return await res.json();
  } catch {
    return null; // caller treats "could not check price" as "no price"
  }
}
```

`fetch` need not reject on an HTTP error. A JSON error body from a `503` could be accepted as a quote, and a slow server can occupy the request long after it is useful.

### Preferred

```ts
async function readQuote(sku: string, signal: AbortSignal): Promise<Quote | null> {
  const url = new URL(`/quotes/${encodeURIComponent(sku)}`, pricingUrl);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    await res.body?.cancel();
    if (res.status === 404) return null; // an explicit upstream contract
    throw new PricingUnavailable(res.status);
  }
  return parseQuote(await res.json()); // validate external data before returning it
}
```

Use a validated base origin and a positive integer millisecond budget within Node's timer range. Apply one signal around the entire operation (including response-body reading and any permitted retries):

- **Node 18.17–18.x, 20.3–20.x and 21+:** `await readQuote(sku, AbortSignal.any([callerSignal, AbortSignal.timeout(budgetMs)]))`. The [Node API history](https://nodejs.org/api/globals.html#static-method-abortsignalanysignals) records the 18.x backport and the original 20.3 release.
- **Node 18.0–18.16, 19.x and 20.0–20.2:** compose manually, including an already-aborted caller and cleanup. On a runtime without usable global `fetch`, use the project's installed abort-capable client with the same deadline and response handling instead of this Fetch function.

```ts
const controller = new AbortController();
const cancel = () => controller.abort(callerSignal.reason);
if (callerSignal.aborted) {
  cancel();
} else {
  callerSignal.addEventListener('abort', cancel, { once: true });
}
const timer = setTimeout(() => {
  controller.abort(new DOMException('The operation timed out', 'TimeoutError'));
}, budgetMs);
try {
  return await readQuote(sku, controller.signal);
} finally {
  clearTimeout(timer);
  callerSignal.removeEventListener('abort', cancel);
}
```

Here `parseQuote` owns the payload contract. The caller or exception mapper decides how to surface an aborted or unavailable dependency; it does not swallow it or log authorization headers. A timeout represents an unknown outcome for a remote write. Do not retry a charge or order creation on timeout unless the remote protocol makes replay safe. For read retries, consume the original time budget instead of granting a fresh budget per attempt.

## Verification

Run the same HTTP fixture on each supported signal branch: valid success, documented `404`, `503`, malformed success body, and a stalled response body. Only `404` may produce `null`. Test an already-aborted caller, caller cancellation while stalled, and budget expiry without caller cancellation; the call must stop with no extra attempt after cancellation or budget expiry. For a retried write, test a remote commit followed by a lost response; verify one durable effect or leave retries disabled.
