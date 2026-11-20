# Metadata

**Invariant:** A direct visit and a client navigation resolve title, canonical URL, and sharing metadata for the same current public record.

The Metadata API and trusted-origin pattern are portable across App Router 14.x–16.x; the route parameter signature and stream timing are not. On the Pages Router, use [`next/head`](https://nextjs.org/docs/pages/api-reference/components/head) with the page's data instead; `generateMetadata` is not a Pages Router export.

## When to read

Set App Router route titles, canonical URLs, or sharing previews that must work on a direct visit and for crawlers.

**Assumptions:** Product slugs are canonical, and `findPublicProduct` returns only public data. The site's trusted origin is configured in the root layout.

Use the server Metadata API, not a client Effect. Set `metadataBase` from a trusted site origin rather than the incoming request. Supply complete nested fields where needed: defining `openGraph` in a child replaces the parent's `openGraph` rather than deep-merging it.

## Bad

```tsx
'use client';
useEffect(() => {
  document.title = product.name;
}, [product.name]);
```

## Good

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://shop.example'),
  title: { default: 'Example Shop', template: '%s | Example Shop' },
};

// app/products/[slug]/page.tsx (Next.js 15.x–16.x)
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const product = await findPublicProduct((await params).slug);
  if (!product) notFound();
  const path = `/products/${encodeURIComponent(product.slug)}`;
  return {
    title: product.name,
    alternates: { canonical: path },
    openGraph: { title: product.name, url: path, images: [product.shareImage] },
  };
}
```

In 14.x type `params` as `{ slug: string }` and pass `params.slug` to the lookup. In 15.x–16.x type it as `Promise<{ slug: string }>` and await it as shown; 15.x offered temporary synchronous access, removed in 16.x ([15 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-15#params--searchparams), [16 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change)).

Use a static `metadata` export when no lookup is needed. Share the page's public lookup rather than adding a separate waterfall; verify how your data adapter deduplicates calls. In 14.x–15.1.x, `generateMetadata` does not stream; starting in 15.2.0 (through 16.x) dynamic metadata can stream for compatible clients, while recognized HTML-limited bots get blocking metadata ([version history and streaming behavior](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#streaming-metadata)). On either side assert the same resolved tags; on streaming versions use the settled DOM and a crawler's actual user agent rather than requiring metadata in the first chunk for all clients.

## Verification

1. Check a direct product visit and client navigation between two products; assert the title, canonical URL, and image identify the current product.
2. Fetch as a supported HTML-limited crawler and check resolved metadata. Open a missing product and confirm it produces the fallback, not another product's metadata.
