# Next.js

- Keep server-only data and credentials out of client components.
- Check the affected route in the configured rendering mode, including navigation and caching behavior.

## Draw the server/client boundary

Keep interactive state close to its client component instead of turning the whole route into a client tree. Do not pass server models wholesale into serialized props. Read route conventions from the installed router and version before choosing data fetching or cache APIs.

## Prove freshness and isolation

After a mutation, navigate away and back and check the value actually shown. Exercise two different users when the result depends on identity; a fast cached response is wrong if it belongs to someone else. Distinguish a route test from a browser navigation test.
