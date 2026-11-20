# Dispose browser subscriptions at the mounting boundary

## When to read

Read when a view or controller listens on an `EventTarget` that can outlive it.

## Decision

Return a disposer and tie subscriptions from one mount to one owned abort signal. Calling `removeEventListener` with another closure does not remove the registered callback, so remounts can accumulate duplicate handlers.

## Bad

```js
function mountResize(target, render) {
  target.addEventListener("resize", () => render());
  return () => target.removeEventListener("resize", () => render());
}
```

## Good

```js
function mountResize(target, render) {
  const lifetime = new AbortController();
  target.addEventListener("resize", () => render(), {
    signal: lifetime.signal,
  });
  return () => lifetime.abort();
}
```

## Assumptions and trade-offs

The browser supports the `signal` listener option. Otherwise retain the exact callback and capture setting and remove it explicitly. An abort controller is convenient when several subscriptions share a lifetime; allocate a fresh one per mount and do not abort a caller-owned controller. Disposal prevents future callbacks but does not stop work a callback already started.

## Verification

Dispatch `resize`, dispose twice, dispatch again, then remount and dispatch once more. **Pass:** the initial and remounted dispatch each render once, while the dispatch between mounts never renders.
