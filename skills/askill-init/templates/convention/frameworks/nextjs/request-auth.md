# Request authentication for protected pages

**Invariant:** Every private read uses the current request's verified identity and an owner-scoped query, even under a reused navigation shell.

The owner-scoped server access pattern is portable across App Router 14.x–16.x; the cookie accessor changes. Use `cookies().get('session')?.value` in 14.x, and `(await cookies()).get('session')?.value` in 15.x–16.x. Synchronous compatibility was temporary in 15.x and removed in 16.x ([15 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-15#cookies), [16 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change)). In the Pages Router, verify the cookie from `context.req` in `getServerSideProps` and pass only authorized data to the page.

## When to read

Protect App Router page rendering against a missing or expired session, including after client navigation beneath a reused layout.

**Assumptions:** `verifySession` validates the cookie and checks expiry and revocation; it returns null for an invalid session and throws on a dependency outage. `readInvoicesForOwner` constrains the lookup to the supplied owner.

Treat layout redirects and Proxy or Middleware checks as navigation conveniences, not authorization for data. Verify the current request inside the server-side data access path. Redirect outside any catch that would swallow Next's redirect signal, and keep verifier outages distinct from signed-out users.

For an optional early check, use `middleware.ts` and a named `middleware` export on 14.x–15.x. On 16.x use `proxy.ts` and a named `proxy` export for Node-based checks; Next.js 16 still documents `middleware` for an Edge-runtime check ([16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy)). The expired-session test below must still pass if this optional check is bypassed.

## Bad

```tsx
// app/account/layout.tsx
if (!(await cookies()).has('session')) redirect('/sign-in');

// app/account/invoices/page.tsx, relying on the shared layout check
const invoices = await readInvoicesForOwner(routeOwnerId);
```

## Good

```tsx
// account-data.ts
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function readOwnInvoices() {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/sign-in');
  return readInvoicesForOwner(session.userId);
}

// app/account/invoices/page.tsx
export default async function InvoicePage() {
  return <InvoiceList invoices={await readOwnInvoices()} />;
}
```

Check access to a specific invoice as part of its scoped lookup too. Keep private results out of shared caches. A fresh server check does not erase content already delivered to the browser; make logout refresh or replace authenticated navigation state using the application's session flow. For handlers and actions, also apply the separate [mutation boundary](routes-and-mutations.md) contract.

## Verification

1. Open a protected URL directly without a valid session; verify the sign-in redirect and no private payload. Sign in and confirm only the current owner's invoices appear.
2. While the account shell remains mounted, expire the session and trigger a fresh server render on a sibling navigation; assert no new private data is sent. Exercise logout and back navigation separately and confirm verifier outages go to error UI rather than a sign-in loop.
