# Error boundaries

**Invariant:** An unexpected descendant render failure replaces only the chart subtree; a successful retry remounts it with replacement data while adjacent controls remain usable.

The class boundary and key-based reset are portable across React 18.x and 19.x. Report in `componentDidCatch` for this recipe; do not require identical console output or root-level error hooks across versions.

## When to read

Contain an unexpected descendant render failure without taking down adjacent tools, and define what Retry remounts.

**Assumptions:** The chart is independently replaceable; `TrendChart` reads its supplied data in render. `reportRenderError` is non-throwing and redacts diagnostics. The shell uses an existing boundary component or the class API below.

Wrap the failing subtree, not the entire application when the rest can still work. Offer a generic fallback and report the cause internally. Reset only after replacing bad input or making an explicit retry; avoid a retry loop for deterministic failures.

## Bad

```tsx
try {
  return <TrendChart data={data} />;
} catch {
  return <p>Chart unavailable.</p>;
}
```

## Good

```tsx
class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportRenderError(error, info.componentStack);
  }
  render() {
    return this.state.failed
      ? <p role="alert">Chart unavailable.</p>
      : this.props.children;
  }
}

// Retry invokes the parent's reload; a successful reload advances revision.
return <>
  <button type="button" onClick={handleReload}>Reload chart data</button>
  <ChartBoundary key={revision}><TrendChart data={data} /></ChartBoundary>
</>;
```

Constructing an element does not render its descendants inside the caller's `try`. The parent owns pending/rejected reload feedback and advances `revision` only on successful replacement. Remounting discards chart-local state; move valuable drafts outside the boundary. Handle rejected event work and server-rendering failures through their own error paths rather than relying on this client render boundary.

## Verification

1. Inject a child render exception; verify the generic alert, a recorded diagnostic, and a working control outside the boundary.
2. Reject a reload, then resolve one with valid data. Confirm the first attempt keeps the fallback and the second restores the chart while the surrounding UI remains mounted.
