# Streaming boundaries

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
