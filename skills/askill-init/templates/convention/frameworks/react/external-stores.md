# External store snapshots

**Invariant:** Render a stable snapshot until the source changes, unsubscribe on teardown, and use the same neutral snapshot on the server and during hydration.

The three-argument [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) contract is portable across React 18.x and 19.x; browser availability belongs in the client snapshot, not the server snapshot.

## When to read

Adapt a browser API or other independently mutable store that React does not own.

**Assumptions:** Connectivity is only a hint for UI; `navigator.onLine` does not prove the app's backend is reachable. SSR starts with the same unknown state on both sides.

Use `useSyncExternalStore` for a source with subscribe, read and unsubscribe contracts. Keep callbacks stable and return the same snapshot under `Object.is` until data changes. For object snapshots, publish a cached immutable value on writes instead of cloning on each read or mutating a returned object.

## Bad

```tsx
const [online, setOnline] = useState(navigator.onLine);
useEffect(() => {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}, []);
```

## Good

```tsx
function subscribe(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}
function getSnapshot() {
  return navigator.onLine ? 'online' : 'offline';
}
function getServerSnapshot() {
  return 'unknown';
}

function ConnectionBadge() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <span>Network: {status}</span>;
}
```

The subscription API lets React recheck the source around commit rather than relying on the value read before an Effect attaches. Use the project's existing library adapter if it already guarantees this contract; keep local UI state in React instead of introducing a store just for this API.

## Verification

1. Hydrate the server's neutral badge in a browser with an offline snapshot; check no hydration error and an eventual offline badge. Flip connectivity and verify both transitions.
2. In a deterministic adapter test, change the source between the initial read and subscription; verify the committed UI catches up. In Strict Mode, unmount and verify all registered listeners are removed.
