# Image delivery

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
// next.config.ts (merge with the existing config)
export default {
  images: {
    remotePatterns: [{
      protocol: 'https', hostname: 'cdn.example.com', port: '',
      pathname: '/catalog/**', search: '',
    }],
  },
} satisfies NextConfig;

// Product media component; class matches the slot in sizes.
<Image src={product.photoUrl} alt={product.photoAlt}
  className="product-photo" width={1200} height={900}
  sizes="(max-width: 700px) 100vw, 50vw" />
```

Use meaningful alt text or `alt=""` for decoration. Start with default loading; only prioritize a measured critical image using the installed version's API. The built-in optimizer does not forward authorization headers: choose a supported loader or unoptimized delivery if the image access contract requires a different authenticated path.

## Verification

1. In a production browser at mobile and desktop widths, inspect `currentSrc`, transfer size and reserved geometry with a throttled network. Check that layout and visual quality stay acceptable.
2. Confirm a valid configured source loads through the deployed optimizer, and an out-of-scope test URL is rejected. Verify below-the-fold images aren't eagerly loaded by a blanket priority policy.
