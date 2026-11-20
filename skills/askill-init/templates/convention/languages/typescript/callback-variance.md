# Let callback types reflect what the producer can emit

**Invariant:** Registration rejects a handler that cannot handle every notice the producer may emit.

**Compatibility — compiler-option boundary:** In TypeScript 4.9+ with [`strictFunctionTypes`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-6.html#strict-function-types) enabled (introduced in 2.6, included in `strict`), use a function-valued property. On the same compiler with `strictNullChecks` on but `strictFunctionTypes` off, do not rely on an assignment check; validate the inferred handler parameter at the registration boundary instead (below). Neither check exists at runtime.

## When to read

Read when exposing a listener or plugin handler that the producer may call with more than one event shape.

## Decision

Declare the callback as a function-valued property. Under `strictFunctionTypes`, a handler needing a narrower input cannot occupy that slot. Method declarations are exempt from that parameter check, so using method syntax can admit a handler that crashes on another valid event.

## Bad

```ts
type Notice = { kind: "saved"; path: string } | { kind: "closed" };
type Saved = Extract<Notice, { kind: "saved" }>;
type Listener = { handle(event: Notice): string };

const listener: Listener = {
  handle(event: Saved) { return event.path.toUpperCase(); },
};
listener.handle({ kind: "closed" });
```

## Good

```ts
type Notice = { kind: "saved"; path: string } | { kind: "closed" };
type Listener = { handle: (event: Notice) => string };

const listener: Listener = {
  handle: (event) => event.kind === "saved" ? event.path.toUpperCase() : "closed",
};
```

## Assumptions and trade-offs

If the variance flag cannot be enabled, this registration API compares the producer's union directly to the candidate handler's argument using a [conditional type](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html), instead of comparing function types:

```ts
type Handler = (event: Notice) => string;

function register<F extends Handler>(
  handle: F & ([Notice] extends [Parameters<F>[0]] ? unknown : never),
): Listener {
  return { handle };
}

const registered = register((event: Notice) =>
  event.kind === "saved" ? event.path.toUpperCase() : "closed");
```

This fallback is for an inferred, single-signature, one-argument handler; do not widen a candidate to `Handler` before registration, since erased parameter information cannot be recovered. If the publisher supports filtered subscriptions, expose a separate registration tied to the selected event.

## Verification

Check the property with the flag on and `register` with it off. In each case supply a handler explicitly accepting only `Saved`. **Pass:** a full handler returns `"/DRAFT"` for saved path `"/draft"` and `"closed"` for closed, while the narrower candidate fails typechecking. Separately, the method-shaped bad example compiles even with the flag on and throws at runtime.
