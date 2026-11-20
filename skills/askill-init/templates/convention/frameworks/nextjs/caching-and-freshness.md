# Caching and freshness

**Assumptions:** The examples use standard App Router data caching without Cache Components. `/catalog` is a public view; `/account` is session-specific. `commitCatalogEdit` verifies permissions and returns only after commit.

Distinguish a repeated data read, cached route output, browser navigation state, and upstream/CDN caching. Next.js 15 changed default `fetch` and GET Route Handler caching behavior; explicitly declare policy where the outcome matters and inspect the installed version and settings. Keep identity-dependent data out of shared caches by default. Public reads may be cached if their stale interval and update behavior are explicit.

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

// Server Component file; the public catalog page opts into caching.
async function updateCatalog(data: FormData) {
  'use server';
  await commitCatalogEdit(data); // authenticates and authorizes this invocation
  revalidatePath('/catalog');
}
```

The private read must remain private through the deployment's HTTP cache too. `revalidatePath` targets a path; if multiple views share the same cached data, inventory those views and choose a supported tag-based mechanism where appropriate. Invalidating in a Route Handler marks a path for revalidation on its next visit; do not assume it updates an already-open browser immediately. Failed writes should not report refreshed data as a successful save.

**Exception:** Use a private caching mechanism only after defining the identity and authorization key, lifetime, and revocation behavior. For Cache Components, use the project's supported cache directives and invalidation APIs rather than copying this recipe.

## Verification

1. Build and run as deployed; warm the catalog, edit it, then check the currently displayed view and navigation away/back. Test every other view sharing the data.
2. Load the same account URL with two separate authenticated browser contexts and then logged out. Assert no identity crosses and check relevant response headers.
3. Cause the edit to fail. Verify persisted data and the visible status remain correct; diagnose staleness at the data, route, browser, or proxy layer rather than increasing reuse indiscriminately.
