# Layouts and error recovery

## When to read

Choose which App Router shell survives a render failure and which boundary recovers a failed load.

**Assumptions:** The workspace chrome is stable, but loading the reports-area layout can fail. The retry example uses the stable `retry` prop documented for Next.js 16.3+; check the installed version's boundary props.

A segment's `error.tsx` sits below its own layout and template. Put error-prone layout reads in a child segment if the shared shell must remain available. Let an ancestor segment catch failures in the child layout. Use a generic fallback; keep sensitive causes in server reporting.

## Bad

```tsx
// app/workspace/layout.tsx
export default async function WorkspaceLayout({ children }: LayoutProps) {
  const menu = await readReportsMenu();
  return <WorkspaceChrome menu={menu}>{children}</WorkspaceChrome>;
}
// app/workspace/error.tsx cannot catch a failure in this same layout.
```

## Good

```tsx
// app/workspace/layout.tsx
export default function WorkspaceLayout({ children }: LayoutProps) {
  return <WorkspaceChrome>{children}</WorkspaceChrome>;
}

// app/workspace/reports/layout.tsx
export default async function ReportsLayout({ children }: LayoutProps) {
  return <ReportsNavigation menu={await readReportsMenu()}>{children}</ReportsNavigation>;
}

// app/workspace/error.tsx
'use client';
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return <section>
    <h2>This workspace view did not load</h2>
    <button type="button" onClick={() => retry()}>Try again</button>
  </section>;
}
```

On older versions, use the supported recovery API and verify it reruns the failed read; clearing boundary state alone may not refetch it. Root layout failures need `app/global-error.tsx` with its own `<html>` and `<body>`. Use `notFound()` or normal feedback for expected outcomes instead of throwing every unhappy path into this boundary.

## Verification

1. In a production build, inject failure in the reports layout; assert workspace navigation still works and reports render after the read recovers and Retry is clicked.
2. Fail the workspace layout itself and verify the ancestor fallback takes over. Check production error UI doesn't reveal the injected exception text.
