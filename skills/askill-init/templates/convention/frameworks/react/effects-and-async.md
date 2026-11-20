# Effects and async lifetimes

**Invariant:** Only the active synchronization lifetime may publish results; replacement or unmount makes every earlier completion irrelevant.

The `useEffect` cleanup and relevance flag are portable across React 18.x and 19.x. Effects run only on the client; the extra setup–cleanup cycle in a development root under Strict Mode is a check, not a production scheduling guarantee ([`useEffect`](https://react.dev/reference/react/useEffect), [Strict Mode](https://react.dev/reference/react/StrictMode)).

**Assumptions:** Search is client-only, has no shared query cache, and empty text requires no request. `search` is a stable import that validates the response and accepts an `AbortSignal`. `SearchResults` is remounted for each query via `<SearchResults key={query} query={query} />` so old results aren't shown while the next Effect starts.

Use an Effect for synchronization tied to a committed UI subscription, timer or request. Pair setup with cleanup for replacement and unmount. Include reactive dependencies; hiding dependencies or bypassing development Strict Mode defeats the lifetime check. Start user-triggered writes from their handlers, not from render or a mount Effect.

## Bad

```tsx
useEffect(() => {
  search(query).then(rows => setResult({ kind: 'ready', rows }));
}, [query]);
```

## Good

```tsx
useEffect(() => {
  if (query === '') return;
  const request = new AbortController();
  let current = true;
  async function load() {
    try {
      const rows = await search(query, { signal: request.signal });
      if (current) setResult({ kind: 'ready', rows });
    } catch {
      if (current) setResult({ kind: 'error' });
    }
  }
  void load();
  return () => {
    current = false;
    request.abort();
  };
}, [query]);
```

Initialize result to pending on mount and render an empty prompt for empty input. Aborting releases resources when the adapter honors it; the relevance flag also protects against adapters or intermediate work that settle after cancellation. A current rejection is a visible error, not an empty result.

**Exception:** Prefer the installed router loader or query cache when it already manages cancellation, caching, and retry. If the results subtree must preserve local state, carry a request generation in the result instead of resetting the whole subtree with a key.

## Verification

1. Make A resolve after B; only B's rows appear. Repeat with a late rejection from A.
2. Reject the active request and assert a recoverable error; unmount while pending and assert cancellation.
3. With Strict Mode at the test root in development, verify setup–cleanup–setup leaves only one live request generation. Do not assert an exact transport call count.
