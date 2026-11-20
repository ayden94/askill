# Build and runtime configuration

## When to read

Read deployment settings, expose a public setting, or promote the same Next.js artifact across environments.

**Assumptions:** The App Router route uses server runtime rendering and a version supporting `connection()` (stable in Next.js 15). The server's fulfillment origin varies by deploy, and its credential must never be sent to clients.

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
