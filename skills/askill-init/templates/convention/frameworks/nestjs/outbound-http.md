# Outbound HTTP: deadlines and dependency failures

**Read when:** A Nest provider calls another service and the change affects response time, retries, cancellation, or the meaning of “not found.” Use the installed transport and its cancellation facility. The example uses Node's Fetch API and a provider-owned base URL.

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

// At the operation boundary, on a runtime supporting AbortSignal.any:
const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(budgetMs)]);
const quote = await readQuote(sku, signal);
```

Here `parseQuote` owns the payload contract. The caller or exception mapper decides how to surface an aborted or unavailable dependency; it does not swallow it or log authorization headers. A timeout represents an unknown outcome for a remote write. Do not retry a charge or order creation on timeout unless the remote protocol makes replay safe. For read retries, consume the original time budget instead of granting a fresh budget per attempt.

## Verification

Use a controllable HTTP fixture with success, documented not-found, `503`, malformed success body, and stalled response cases. Only `404` may produce `null`. Cancel the caller while the response is stalled and observe that the request ends without another attempt. For a retried write, test the case where the remote side commits but its response never reaches the client; verify one durable effect or leave retries disabled.
