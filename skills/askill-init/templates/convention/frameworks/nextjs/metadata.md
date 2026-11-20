# Metadata

## When to read

Set App Router route titles, canonical URLs, or sharing previews that must work on a direct visit and for crawlers.

**Assumptions:** Next.js 15+ with awaited route params. Product slugs are canonical, and `findPublicProduct` returns only public data. The site's trusted origin is configured in the root layout.

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

// app/products/[slug]/page.tsx
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

Use a static `metadata` export when no lookup is needed. Share the page's public lookup rather than adding a separate waterfall; verify how your data adapter deduplicates calls. Dynamic metadata may stream on supported versions, so test crawlers with their actual user agent rather than assuming every response places it in the first chunk.

## Verification

1. Check a direct product visit and client navigation between two products; assert the title, canonical URL, and image identify the current product.
2. Fetch as a supported HTML-limited crawler and check resolved metadata. Open a missing product and confirm it produces the fallback, not another product's metadata.
