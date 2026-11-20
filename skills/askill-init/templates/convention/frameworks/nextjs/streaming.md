# Streaming boundaries

**Invariant:** A slow region cannot delay a useful shell, and any status that must be sent to the client is decided before the response starts streaming.

Suspense placement and [`loading.tsx`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) are portable across App Router 14.x–16.x. Their fallback is not a guarantee of streamed bytes: the read in this example must run at request time, not be fully satisfied during prerendering, and the deployed transport must not buffer it. With Cache Components enabled in 16.x, keep the uncached runtime read in the suspended child, not the shell. `loading.tsx` is not a Pages Router file convention.

## When to read

Release an App Router shell while an independent slow section loads, without concealing the status contract of the page.

**Assumptions:** The public status overview is always valid; only the incident history is slow. The deployed adapter can forward a streamed response.

Put the slow `await` in an async descendant under Suspense. Keep permanent headings and interactions outside that boundary. Use a meaningful fallback with space reserved for the result, and send failures to error UI rather than leaving the loader on screen.

## Bad

```tsx
export default async function StatusPage() {
  const incidents = await readIncidentHistory();
  return <main>
    <h1>Service status</h1>
    <Suspense fallback={<IncidentPlaceholder />}>
      <IncidentTable incidents={incidents} />
    </Suspense>
  </main>;
}
```

## Good

```tsx
async function IncidentHistory() {
  const incidents = await readIncidentHistory();
  return <IncidentTable incidents={incidents} />;
}

export default function StatusPage() {
  return <main>
    <h1>Service status</h1>
    <CurrentStatus />
    <Suspense fallback={<IncidentPlaceholder />}>
      <IncidentHistory />
    </Suspense>
  </main>;
}
```

Use `loading.tsx` when the whole segment needs a navigation fallback; use nested boundaries for independent regions. The response status cannot change after headers are sent. A status-critical lookup must resolve before any matching loading or Suspense boundary can flush; verify that contract on the direct HTTP response. Proxy buffering can defeat streaming even if local rendering is correct.

## Verification

1. Hold the incident read behind a controllable gate and request the deployed page through the ingress. Observe the shell and fallback before releasing it; then confirm the table replaces the fallback.
2. Reject the gated read and verify the intended recovery UI. For routes requiring a non-200 direct response, exercise those misses through the actual ingress and assert the status separately from visible UI.
