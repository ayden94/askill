# Next.js rulebook

Identify the actual router per route (`app/` or `pages/`), lockfile version, runtime, deployment target, and cache configuration before applying an example. The examples use the App Router; do not transplant App Router file conventions or caching APIs into Pages Router pages. For the Pages Router, verify the installed version's `getServerSideProps`, static generation/revalidation, and `pages/api` contracts as applicable.

| Task | Read |
| --- | --- |
| Add interaction to a server-rendered route or send data to the browser | [Server and client boundaries](server-client-boundaries.md) |
| Add a Route Handler or Server Action | [Request and mutation boundaries](routes-and-mutations.md) |
| Fix stale pages, invalidation, or identity isolation | [Caching and freshness](caching-and-freshness.md) |
| Verify runtime errors, browser navigation, or production rendering | [Route and browser testing](testing.md) |
| Set route titles, canonical URLs, or social previews | [Metadata](metadata.md) |
| Keep shared layout UI available during route failure | [Layouts and error recovery](layouts-and-errors.md) |
| Reveal a useful shell before independent slow content | [Streaming boundaries](streaming.md) |
| Gate a protected page or handle an expired session on navigation | [Request authentication](request-auth.md) |
| Deliver a responsive image or change the optimizer's source policy | [Image delivery](image-delivery.md) |
| Promote one build across environments or expose browser configuration | [Build and runtime configuration](configuration.md) |
| Package and smoke-test a self-hosted standalone artifact | [Standalone deployment](deployment.md) |
