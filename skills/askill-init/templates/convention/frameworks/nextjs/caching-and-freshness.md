# Caching and freshness

**Invariant:** Private reads never enter a shared cache; committed public changes become visible under an explicit freshness policy independent of implicit defaults.

**Assumptions:** `/catalog` is public; `/account` is session-specific. `commitCatalogEdit` verifies permissions and returns only after commit. The first recipe is portable across App Router 14.x, 15.x and 16.x with Cache Components off and no conflicting segment overrides. These are App Router APIs, not Pages Router ISR.

Distinguish fetch data, rendered route output, browser navigation state, and upstream/CDN caching. In [14.x](https://nextjs.org/docs/14/app/building-your-application/caching), eligible `fetch` reads and eligible GET Route Handlers could cache by default; opting into dynamic behavior could change this. In [15.x–16.x](https://nextjs.org/docs/app/guides/upgrading/version-15#fetch-requests) without Cache Components, omitted fetch options are no longer an explicit Data Cache opt-in, and [GET handlers are uncached by default](https://nextjs.org/docs/app/guides/upgrading/version-15#route-handlers). Static prerendering is a separate decision. For a public GET Route Handler that should cache its output, use `export const dynamic = 'force-static'` in 15.x–16.x; in 14.x an eligible static GET can already cache, but use the same explicit setting. For a request-time GET use `export const dynamic = 'force-dynamic'` on both sides of the change.

## Bad

```ts
const response = await fetch(`${origin}/account`, { cache: 'force-cache' });
const account = await response.json();
// After a write, assume a client refresh will invalidate this server cache.
```

## Good

```ts
// Server-side read, with a credential obtained from the current request.
const response = await fetch(`${origin}/account`, {
  headers: { Authorization: `Bearer ${sessionToken}` },
  cache: 'no-store',
});
if (!response.ok) throw new Error('Account lookup failed');
const account = parseAccount(await response.json());

// Public catalog Server Component: opt the public read into the Data Cache.
const catalogResponse = await fetch(`${origin}/catalog`, { cache: 'force-cache' });
if (!catalogResponse.ok) throw new Error('Catalog lookup failed');
const catalog = parseCatalog(await catalogResponse.json());

// Inline in the catalog Server Component.
async function updateCatalog(data: FormData) {
  'use server';
  await commitCatalogEdit(data); // authenticates and authorizes this invocation
  revalidatePath('/catalog');
}
```

The private read must remain private through the deployment's HTTP cache too. `revalidatePath` targets a path; if multiple views share the same cached data, inventory those views and choose a supported tag-based mechanism where appropriate. Invalidating in a Route Handler marks a path for revalidation on its next visit; do not assume it updates an already-open browser immediately. Failed writes should not report refreshed data as a successful save.

**Cache Components (16.x with `cacheComponents: true`):** Keep the private request-time read in an async child under `<Suspense>` and outside any `'use cache'` scope. Instead of forcing an entire segment's mode, cache the public function and invalidate its tag after commit ([migration guide](https://nextjs.org/docs/app/guides/migrating-to-cache-components), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)):

```ts
import { cacheTag, updateTag } from 'next/cache';

async function readCatalog() {
  'use cache';
  cacheTag('catalog');
  return readPublicCatalog();
}

async function updateCatalog(data: FormData) {
  'use server';
  await commitCatalogEdit(data);
  updateTag('catalog');
}
```

In either mode, verify the edit is visible after commit from the editing flow, and a separate session never receives the first user's account data. Use private caching only with an explicit identity and authorization key, lifetime, and revocation policy.

## Verification

1. Build and run as deployed; warm the catalog, edit it, then check the currently displayed view and navigation away/back. Test every other view sharing the data.
2. Load the same account URL with two separate authenticated browser contexts and then logged out. Assert no identity crosses and check relevant response headers.
3. Cause the edit to fail. Verify persisted data and the visible status remain correct; diagnose staleness at the data, route, browser, or proxy layer rather than increasing reuse indiscriminately.
