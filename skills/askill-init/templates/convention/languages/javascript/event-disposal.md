# Dispose browser subscriptions at the mounting boundary

**Invariant:** Each mount owns its registration; disposal is idempotent and a later mount starts with exactly one listener.

**Compatibility — browser version boundary:** Use the [DOM `signal` listener option](https://dom.spec.whatwg.org/#dom-addeventlisteneroptions-signal) in Chrome 90+ ([Chromium status](https://chromestatus.com/feature/5658622220566528)) or Firefox 86+ ([Gecko implementation](https://bugzilla.mozilla.org/show_bug.cgi?id=1679204)). In Chrome 49–89 or Firefox 45–85, use the explicit removal example below. For other browser families, check whether abort actually removes the listener; having `AbortController` alone is insufficient. Explicit removal is also suitable across mixed targets.

## When to read

Read when a view or controller listens on an `EventTarget` that can outlive it.

## Decision

Return a disposer and tie subscriptions to their mount. Calling `removeEventListener` with another closure does not remove the registered callback, so remounts can accumulate duplicate handlers.

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

Without the listener option, retain the exact callback and capture setting:

```js
function mountResize(target, render) {
  const onResize = () => render();
  target.addEventListener("resize", onResize, false);
  return () => target.removeEventListener("resize", onResize, false);
}
```

An abort controller is convenient when several subscriptions share a lifetime; allocate a fresh one per mount and do not abort a caller-owned controller. Disposal prevents future callbacks but does not stop work a callback already started.

## Verification

Run the same check for either implementation on the target browser. Dispatch `resize`, dispose twice, dispatch again, then remount and dispatch once more. **Pass:** the initial and remounted dispatch each render once, while the dispatch between mounts never renders.
