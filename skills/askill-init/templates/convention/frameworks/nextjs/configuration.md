# Build and runtime configuration

**Invariant:** One build can read server settings from the deployment that runs it, and no secret enters public output or a client bundle.

## When to read

Read deployment settings, expose a public setting, or promote the same Next.js artifact across environments.

**Assumptions:** This App Router example runs on a server, not a static export. The server's fulfillment origin varies by deploy, and its credential must never be sent to clients.

Configuration validation and the public projection are portable across Next.js 14.x–16.x; opting into request-time rendering differs. In App Router 14.x, add `export const dynamic = 'force-dynamic'` to the page and omit `await connection()` ([14.x segment configuration](https://nextjs.org/docs/14/app/api-reference/file-conventions/route-segment-config#dynamic)). In 15.x–16.x use [`connection()`](https://nextjs.org/docs/app/api-reference/functions/connection), stable from 15.0.0; if 16.x Cache Components is enabled and the read is under a prerendered shell, put `connection()` and the runtime read in a child under Suspense. In the Pages Router, put the runtime read in [`getServerSideProps`](https://nextjs.org/docs/pages/api-reference/functions/get-server-side-props), not in the page component. Static export cannot satisfy the same-artifact runtime-setting test below.

Classify settings as build-time public, runtime public, or server-only before choosing where to read them. Direct references to `NEXT_PUBLIC_*` in client code are inlined at build time. Read runtime server settings after opting into request-time rendering and validate them at the boundary rather than relying on non-null assertions.

## Bad

```ts
// Browser module; changing the container environment cannot update this bundle.
const fulfillmentOrigin = process.env.NEXT_PUBLIC_FULFILLMENT_ORIGIN!;
```

## Good

```tsx
// fulfillment-config.ts
import 'server-only';

export function readFulfillmentConfig() {
  const origin = process.env.FULFILLMENT_ORIGIN;
  const token = process.env.FULFILLMENT_TOKEN;
  if (!origin || !token) throw new Error('Fulfillment configuration is missing');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) {
    throw new Error('FULFILLMENT_ORIGIN must be an HTTPS origin');
  }
  return { origin: url.origin, token };
}

// app/delivery/page.tsx; import connection from next/server
export default async function DeliveryPage() {
  await connection();
  const summary = await readPublicDeliverySummary(readFulfillmentConfig());
  return <DeliverySummary summary={summary} />;
}
```

`readPublicDeliverySummary` returns a browser-safe projection, not configuration or upstream headers. The runtime read prevents static reuse of the entire route; if configuration is intentionally public and fixed per build, inlining is simpler. For runtime public settings, serialize just the approved fields into the response.

## Verification

1. Run the same artifact twice with different configured test origins and assert each route reaches its own upstream. Repeat with missing or invalid configuration and confirm a diagnosable failure.
2. Set a synthetic token marker and confirm it appears in neither static assets nor HTML, browser payloads or user-facing errors.
