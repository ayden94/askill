# Image delivery

**Invariant:** An image reserves its layout slot, advertises a matching responsive size, and is optimized only from the intended source policy.

`Image` sizing and reserved geometry are portable across App and Pages Routers in Next.js 14.x–16.x. Strict query-free remote optimization below uses `remotePatterns.search`, which requires 14.2.14–14.x, 15.x, or 16.x. On 14.0.0–14.2.13 use a controlled local path such as `/catalog/widget.jpg` as `src` and omit the remote pattern rather than silently permitting query variants. In either version, the intended asset loads with reserved geometry and query-bearing URLs on the CDN are not admitted by the optimizer. See the [image API version history](https://nextjs.org/docs/app/api-reference/components/image#version-history).

## When to read

Add a responsive image whose transferred size, visual stability, or origin policy matters.

**Assumptions:** A product image fills a full-width mobile slot and a 50%-viewport desktop slot; CSS implements that layout. The public CDN serves a known 4:3 source without query parameters. The deployment supports the Next.js image optimizer.

Use intrinsic dimensions or a reserved aspect-ratio container. Set `sizes` to the actual layout slot so the browser can select from the generated source set. Constrain `remotePatterns` to the required protocol, hostname, path, and query policy.

## Bad

```tsx
<img src={product.photoUrl} className="product-photo" alt={product.photoAlt} />
```

## Good

```tsx
// next.config.mjs (merge with the existing config)
/** @type {import('next').NextConfig} */
export default {
  images: {
    remotePatterns: [{
      protocol: 'https', hostname: 'cdn.example.com', port: '',
      pathname: '/catalog/**', search: '',
    }],
  },
};

// Product media component; class matches the slot in sizes.
<Image src={product.photoUrl} alt={product.photoAlt}
  className="product-photo" width={1200} height={900}
  sizes="(max-width: 700px) 100vw, 50vw" />
```

Use meaningful alt text or `alt=""` for decoration. Start with default loading. If measurement warrants head preloading for one known LCP image, use `priority` on 14.x–15.x or `preload` on 16.x (`priority` deprecated); verify the critical image starts early and secondary images remain lazy in either branch ([image API](https://nextjs.org/docs/app/api-reference/components/image#preload)). The default optimizer does not forward authorization headers: choose a supported loader or unoptimized delivery if the image access contract requires a different authenticated path.

## Verification

1. In a production browser at mobile and desktop widths, inspect `currentSrc`, transfer size and reserved geometry with a throttled network. Check that layout and visual quality stay acceptable.
2. Confirm a valid configured source loads through the deployed optimizer, and an out-of-scope test URL is rejected. Verify below-the-fold images aren't eagerly loaded by a blanket priority policy.
