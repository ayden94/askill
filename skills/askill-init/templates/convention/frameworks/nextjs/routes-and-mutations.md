# Request and mutation boundaries

**Invariant:** Every invocation validates input and checks access to the URL's target before it writes, regardless of how the invocation was reached.

Validation and authorization are portable across Next.js 14.x–16.x; this is an App Router Route Handler, not a Pages Router `pages/api` route. In 14.x use `ctx: { params: { id: string } }` and `ctx.params.id`. In 15.x–16.x use the promised type and `await` below; 15.x temporarily supported synchronous access, which 16.x removed ([15 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-15#route-handlers), [16 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change)). A PATCH to a valid route with a conflicting body ID must never change a different record on either branch.

**Assumptions:** The session uses a bearer credential in this example, and `renameProject` checks ownership and returns `missing` for inaccessible projects by contract. `NextResponse.json` from `next/server` works without relying on the installed TypeScript version's static `Response.json` typings ([14.x Route Handler reference](https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers)).

Treat each Route Handler and Server Action as a callable entry point. Validate route params, body, search params or `FormData` with the configured parser; check identity and resource authorization independently of UI visibility. Map expected outcomes explicitly. Let unexpected failures surface through configured server reporting and a safe error response, not raw messages.

## Bad

```ts
export async function PATCH(request: Request) {
  const body = await request.json();
  return Response.json(await projects.update(body.id, body));
}
```

## Good

```ts
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await authenticateBearer(request);
  if (!actor) return NextResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 });

  const id = parseProjectId((await ctx.params).id);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }
  const command = parseRename(input); // null unless valid; allow only `name`
  if (!id || !command) return NextResponse.json({ code: 'INVALID_INPUT' }, { status: 400 });
  const result = await renameProject(actor, id, command);
  if (result.kind === 'missing') {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ id: result.project.id, name: result.project.name });
}
```

The URL identifies the target, not an unchecked body field. The use case owns resource authorization so other transports cannot omit it. Cookie-authenticated handlers also need the application's appropriate CSRF protections; a Server Action's framework protections do not remove the need for authorization.

**Exception:** Prefer a Server Action for an internal form when the route doesn't need a reusable HTTP API. Perform equivalent parsing and authorization inside the action and return a typed feedback state for expected errors; use a Route Handler for an independent HTTP consumer.

## Verification

1. Call the endpoint without credentials and under a different owner; assert the contract and no persisted change.
2. Send invalid JSON, a malformed route ID, a missing name, and an extra persistence-like field. Verify the accepted field policy and no writes on rejection.
3. Submit valid input and inspect the stored row and response projection. Cause a persistence failure and check that the response does not leak its cause.
