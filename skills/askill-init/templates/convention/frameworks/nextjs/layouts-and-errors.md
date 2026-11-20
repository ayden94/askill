# Layouts and error recovery

**Invariant:** The boundary that owns a failed reports layout replaces that region, not its healthy workspace shell; a fresh read can restore the reports view.

Boundary placement is portable across App Router 14.x–16.x, not a Pages Router convention. Retrying server reads differs at 16.2.0 and 16.3.0 ([`error.js` version history](https://nextjs.org/docs/app/api-reference/file-conventions/error#version-history)).

## When to read

Choose which App Router shell survives a render failure and which boundary recovers a failed load.

**Assumptions:** The workspace chrome is stable, but loading the reports-area layout can fail. The failed read is request-time and not pinned to stale cached data.

A segment's `error.tsx` sits below its own layout and template. Put error-prone layout reads in a child segment if the shared shell must remain available. Let an ancestor segment catch failures in the child layout. Use a generic fallback; keep sensitive causes in server reporting.

## Bad

```tsx
// app/workspace/layout.tsx
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const menu = await readReportsMenu();
  return <WorkspaceChrome menu={menu}>{children}</WorkspaceChrome>;
}
// app/workspace/error.tsx cannot catch a failure in this same layout.
```

## Good

```tsx
// app/workspace/layout.tsx
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceChrome>{children}</WorkspaceChrome>;
}
```

```tsx
// app/workspace/reports/layout.tsx
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <ReportsNavigation menu={await readReportsMenu()}>{children}</ReportsNavigation>;
}
```

```tsx
// app/workspace/error.tsx (Next.js 16.3.0–16.x)
'use client';
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return <section>
    <h2>This workspace view did not load</h2>
    <button type="button" onClick={() => retry()}>Try again</button>
  </section>;
}
```

- **14.x, 15.x and 16.0.0–16.1.x:** [`reset()`](https://nextjs.org/docs/15/app/api-reference/file-conventions/error#reset) retries boundary rendering, not necessarily the server data read. To guarantee a new document request for this request-time read, use `onClick={() => window.location.reload()}` instead of the injected `retry` prop. The shell is usable while fallback is shown but remounts on full reload.
- **16.2.x:** Select `{ unstable_retry: () => void }` and call `unstable_retry()` in place of `retry()` ([16.2 release](https://github.com/vercel/next.js/releases/tag/v16.2.0)).
- **16.3.0–16.x:** Use `retry()` as shown to refetch and rerender the boundary's children.

All three branches must restore the view once the same failed server read becomes healthy. Root layout failures need `app/global-error.tsx` with its own `<html>` and `<body>`. Use `notFound()` or normal feedback for expected outcomes instead of throwing every unhappy path into this boundary.

## Verification

1. In a production build, inject failure in the reports layout; assert workspace navigation still works and reports render after the read recovers and Retry is clicked.
2. Fail the workspace layout itself and verify the ancestor fallback takes over. Check production error UI doesn't reveal the injected exception text.
