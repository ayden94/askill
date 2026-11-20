# Standalone deployment

**Invariant:** The published artifact boots without the source workspace and serves its matching static assets and traced runtime dependencies.

The [standalone output contract](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) below is portable across Next.js 14.x–16.x with either router, for the stated single-package self-hosted Node layout. It is not a static export or an adapter deployment.

## When to read

Package a self-hosted Next.js build and verify the final artifact can run without the build workspace.

**Assumptions:** One package, default `.next` output path, a supported Node runtime, and a fresh `/artifact` directory for each build. This service hosts its own static assets rather than delegating them to a CDN.

Use one deployment model consistently. `output: 'standalone'` generates a traced server and its runtime dependencies; its minimal server doesn't copy `public` or `.next/static` for you. Keep artifact files from the same build together and run the generated `server.js` rather than assuming the build-time workspace will exist.

## Bad

```sh
npm run build
# Publishing only this tree leaves the standalone server without local assets.
cp -R .next/standalone /artifact
cd /artifact && npm run start
```

## Good

```js
// next.config.mjs (14.x–16.x)
/** @type {import('next').NextConfig} */
const config = { output: 'standalone' };
export default config;
```

```sh
set -eu
npm run build
mkdir -p /artifact
cp -R .next/standalone/. /artifact/
cp -R .next/static /artifact/.next/static
if [ -d public ]; then cp -R public /artifact/public; fi
cd /artifact && HOSTNAME=0.0.0.0 PORT=3000 node server.js
```

Supply environment values through the runtime; audit the artifact for copied environment files before publishing. For monorepos, check the emitted server path and trace root, and explicitly include runtime assets that tracing misses. On a managed adapter, use its packaging contract instead. Exercise streaming and image optimization in the final environment if the application depends on them.

## Verification

1. Boot a fresh artifact in a runtime without the original source or build dependencies. Visit a dynamic page and a public asset, and request a hashed script from its actual HTML.
2. Run startup and health probes through the real ingress. Smoke-test a route that reads a traced file or native dependency, if applicable, so a laptop with the full workspace can't mask missing files.
