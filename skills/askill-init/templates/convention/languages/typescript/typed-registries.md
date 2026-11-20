# Check closed registries without widening their entries

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

This is a closed registry authored as a single literal on TypeScript 4.9+. The check is compile-time only. `satisfies` neither freezes the object nor makes arbitrary properties literal; the method retains its literal type here because the target is a union of literals. Use a runtime registry with an absence contract for plugin-defined keys.

## Verification

Compile the good snippet, then separately omit `hide`, add a misspelled `hied` key beside the valid keys, and change `show.method` to `"POST"`. **Pass:** the original compiles while each mutation produces a diagnostic at the registry or the typed lookup.
