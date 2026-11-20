# Check closed registries without widening their entries

**Invariant:** The authored registry has exactly the declared keys, and a keyed lookup retains its entry's method literal.

**Compatibility — compiler version boundary:** In TypeScript 4.9+ with `strict`, use [`satisfies`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator). In TypeScript 4.0–4.8 with `strict`, use a constrained identity function that also rejects extra keys, as below. The latter emits a function call; neither performs runtime validation or requires a runtime library.

## When to read

Read when declaring a registry whose keys must cover a closed set while callers depend on literal information from specific entries.

## Decision

Use `satisfies` to check a literal registry against a `Record` without replacing the inferred entry types. A variable annotation can detect omitted keys but turn every lookup into the same broad union.

## Bad

```ts
type Action = "show" | "hide";
type Route = { method: "GET" | "POST"; path: string };
const routes: Record<Action, Route> = {
  show: { method: "GET", path: "/view" },
  hide: { method: "POST", path: "/view/hide" },
};
// routes.show.method has type "GET" | "POST" at every call site.
```

## Good

```ts
type Action = "show" | "hide";
type Route = { method: "GET" | "POST"; path: string };
const routes = {
  show: { method: "GET", path: "/view" },
  hide: { method: "POST", path: "/view/hide" },
} satisfies Record<Action, Route>;

const showMethod: "GET" = routes.show.method;
```

## Assumptions and trade-offs

For TypeScript 4.0–4.8, reuse the `Action` and `Route` types:

```ts
function defineRoutes<T extends Record<Action, Route>>(
  routes: T & Record<Exclude<keyof T, Action>, never>,
): T {
  return routes;
}

const routes = defineRoutes({
  show: { method: "GET", path: "/view" },
  hide: { method: "POST", path: "/view/hide" },
});
const showMethod: "GET" = routes.show.method;
```

The constraint requires every action, and the extra-keys check rejects an inferred key outside `Action`. Keep the literal at the check site; neither route can recover keys erased by an earlier annotation. `satisfies` neither freezes the object nor makes arbitrary properties literal; the method retains its literal type here because the target is a union of literals. Use a runtime registry with an absence contract for plugin-defined keys.

## Verification

Compile both implementations, then separately omit `hide`, add a misspelled `hied` key beside the valid keys, and change `show.method` to `"POST"`. **Pass:** each original compiles and each mutation produces a diagnostic at the registry or the typed lookup.
