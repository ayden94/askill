# Responsive rendering

## When to read

Keep urgent input responsive when a measured bottleneck is rendering a secondary React view.

**Assumptions:** The search results are local, expensive to render, and allowed to lag briefly during typing. `Results` receives a stable `items` array; the example targets React 18+.

Profile the interaction before optimizing. Keep controlled input state immediate; defer the value that drives the slower, interruptible subtree. Avoid recreating props that defeat the memoized subtree's bailout. Tell users when the results are catching up if the difference is perceptible.

## Bad

```tsx
return <>
  <input aria-label="Filter reports" value={query} onChange={onChange} />
  <Results items={items} query={query} />
</>;
```

## Good

```tsx
const DeferredResults = memo(Results); // declared at module scope

function ReportSearch({ items }: { items: ReadonlyArray<Report> }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  return <>
    <input aria-label="Filter reports" value={query}
      onChange={event => setQuery(event.target.value)} />
    <p role="status">{query !== deferredQuery ? 'Updating results…' : ''}</p>
    <DeferredResults items={items} query={deferredQuery} />
  </>;
}
```

Deferring does not reduce total work or debounce requests. If one synchronous filter monopolizes the main thread, improve the algorithm, reduce the dataset, or move the computation off-thread. If rendering thousands of DOM rows dominates, consider windowing and preserve the keyboard and accessibility contract.

## Verification

1. Compare React and browser profiles for the same large fixture and rapid typing sequence with CPU throttling. Check input latency and whether results renders still block urgent commits.
2. Type rapidly, clear the input, and let rendering settle. Assert the input never rolls back, results match the final query, and the updating status clears.
