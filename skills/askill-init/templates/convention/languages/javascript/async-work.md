# Asynchronous work and cancellation

## When to read

Read when introducing overlapping requests, iterating over asynchronous work, or connecting an operation to a request's lifetime. The HTTP examples use Node.js 22+ or a browser with `fetch` and `AbortController`; URLs are supplied by the caller.

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

Inject two controlled responses. Complete the second first, then the first; verify result order. Repeat with the first returning HTTP `503` while the second waits for abort. **Pass:** the second observes abort before the caller receives the `HTTP 503` failure; no successful result or detached rejection escapes. A pre-aborted caller signal reaches both reads already aborted.
