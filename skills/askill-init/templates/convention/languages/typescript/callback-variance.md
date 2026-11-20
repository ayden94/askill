# Let callback types reflect what the producer can emit

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

The producer can emit either notice. If the publisher supports filtered subscriptions, expose a separate typed registration tied to the requested event rather than forcing narrowing in every handler. This does not enable `strictFunctionTypes` in an existing project; check the relevant build flags before relying on it.

## Verification

Check both snippets with `strict`, separately. Replace the good handler with a function accepting only the saved variant. **Pass:** the good handler returns an uppercase path for `saved` and `"closed"` for `closed`; the replacement fails typechecking, while the original method-shaped bad example compiles and throws at runtime.
