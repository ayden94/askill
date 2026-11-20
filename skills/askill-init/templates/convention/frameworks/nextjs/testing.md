# Route and browser testing

**Assumptions:** The repository already uses Playwright and can run against a production build of its App Router app. The test fixtures provision an isolated record and authenticated context; navigation uses real links.

Test the smallest layer that can fail: unit-test a parser, request-test the real endpoint for HTTP behavior, and browser-test rendering, hydration and navigation. An async Server Component called as a function does not run the Next.js router or test framework rendering. Verify cold entry as well as client transitions, which can reuse different state.

## Bad

```ts
const result = await PATCH(fakeRequest, fakeContext);
expect(result.status).toBe(200); // Not evidence that the page shows the update.
```

## Good

```ts
test('shows the saved title after navigating away and back', async ({ page }) => {
  await page.goto('/projects/test-project');
  await page.getByRole('textbox', { name: 'Title' }).fill('Updated');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByRole('link', { name: 'Project list' }).click();
  await page.getByRole('link', { name: 'Updated' }).click();
  await expect(page.getByRole('heading', { name: 'Updated' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Updated' })).toBeVisible();
});
```

This test fails if the status says success while the list or detail renders stale data. A separate route request should still assert failure shape and persistence; the browser test must not replace the server call with fixture JSON when proving freshness.

**Exception:** Unit-test synchronous leaf components without Next's runtime for local interactions. Use an environment matching the configured adapter or host when deployment caching, middleware/proxy matching, or runtime APIs are part of the change.

## Verification

1. Run targeted request tests for malformed, unauthorized and authorized requests; check response shape and writes.
2. Run browser tests against production configuration, including cold load, client navigation, back/forward, and reload. Assert meaningful state rather than sleeping.
3. Inject a recoverable failure and verify feedback and recovery; if an `error.tsx` boundary is involved, trigger a failure in its actual scope. Repeat identity-sensitive scenarios in isolated contexts.
