# Asynchronous work and cancellation

**Invariant:** The caller receives ordered results or the original failure, and owned reads have settled before that failure escapes.

**Compatibility — version boundary (HTTP transport):** Node 18+ can use the global `fetch` without an experimental flag (stable from Node 21). On Node 16.14–16.x or 17.2–17.x, drop the `= fetch` default and pass the project's Fetch-compatible transport explicitly; it must honor the supplied signal through body consumption. These legacy ranges have abort reasons; omit earlier releases from this contract. See [Node globals](https://nodejs.org/api/globals.html#fetch) and [abort reason history](https://nodejs.org/api/globals.html#abortsignalreason).

## When to read

Read when introducing overlapping requests, iterating over asynchronous work, or connecting an operation to a request's lifetime. Browsers need [Fetch](https://fetch.spec.whatwg.org/), [reason-aware AbortController](https://dom.spec.whatwg.org/#aborting-ongoing-activities), and [Promise.allSettled](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.allsettled), independently of the syntax target. If a browser lacks abort reasons and the public contract does not expose them, use `group.abort()` at both sites while keeping `throw error`; if reason identity is required, require a compatible signal and transport rather than dropping it. URLs are supplied by the caller.

## Rules

- An `async` API must return a promise that represents its full promised effect. `forEach` ignores the callback return value; an `async` callback does not make the loop awaitable.
- Use `for...of` with `await` for ordered effects or backpressure. Use `Promise.all` only for independent, bounded work with an all-or-error result. Its rejection is early notification, not cancellation or rollback.
- Forward the caller's `AbortSignal` into every owned I/O operation. When the coordinator also needs to abort siblings, give it an owned controller and detach forwarding listeners in `finally`. Preserve the original failure; cancellation should not hide it.
- Check HTTP status before consuming a successful payload contract. `fetch` resolves for HTTP 4xx and 5xx; transport failures and aborts reject.

## Error-prone

```js
async function loadPair(urls) {
  const results = [];
  urls.forEach(async (url) => {
    const response = await fetch(url);
    results.push(await response.json());
  });
  return results;
}
```

## Recommended

The pair has exactly two independent reads and is invalid if either read fails.

```js
async function loadPair([first, second], signal, request = fetch) {
  const group = new AbortController();
  const cancel = () => group.abort(signal.reason);
  if (signal.aborted) cancel();
  else signal.addEventListener("abort", cancel, { once: true });

  async function read(url) {
    const response = await request(url, { signal: group.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  const reads = [read(first), read(second)];
  try {
    return await Promise.all(reads);
  } catch (error) {
    group.abort(error);
    await Promise.allSettled(reads);
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
```

## Why and trade-offs

`Promise.all` preserves input order even when the second response arrives first. Joining settled reads after abort means the returned promise also accounts for cleanup of the owned operations, at the cost of waiting for a cancellation-aware transport to settle.

## Edge cases and exceptions

- An injected transport must honor the signal throughout body consumption and settle promptly; aborting a controller cannot stop arbitrary promise work. Configure a transport deadline rather than using a race that only abandons the wait.
- For a user-sized batch, set a concurrency bound rather than starting everything with `map`. For independent partial success, expose each outcome explicitly. Aborting a request cannot undo a write the server already accepted.

## Verification

Use the same controlled transport under both Node entry points and the browser variant. Complete the second response first, then the first; verify result order. Repeat with the first returning HTTP `503` while the second waits for abort. **Pass:** the second observes abort before the caller receives the `HTTP 503` failure; no successful result or detached rejection escapes. A pre-aborted caller signal reaches both reads already aborted; where reason identity is promised, both see the original reason.
