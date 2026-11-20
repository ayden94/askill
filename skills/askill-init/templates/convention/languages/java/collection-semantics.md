# Collection semantics

## When to read

Read when designing map keys, choosing between list/set/map, changing deduplication, or returning results in a documented order.

Error-prone: a mutable field contributes to key equality and hashing, so changing it after insertion can make the entry unreachable.

```java
record UserKey(java.util.List<String> names) {}

var names = new java.util.ArrayList<>(java.util.List.of("ops"));
var routes = new java.util.HashMap<UserKey, String>();
routes.put(new UserKey(names), "/ops");
names.add("review");
```

Recommended: keep a stable identifier in the key. If order is a separate public requirement, select it explicitly; this registry iterates by insertion order.

```java
record UserKey(String tenant, String id) {}

var routes = new java.util.LinkedHashMap<UserKey, String>();
routes.put(new UserKey("team-1", "user-17"), "/ops");
routes.put(new UserKey("team-1", "user-20"), "/review");
```

Define which repeated keys replace, reject, or accumulate values; plain `put` replaces. Do not assume `HashMap` or `Map.copyOf` preserves insertion order. In a sorted map, comparator equality determines key uniqueness, so use a tie-breaker consistent with identity when unequal keys must coexist. Object identity maps are legitimate for tracking visited instances in an object graph, but not for value-based identifiers.

## Verification and pass criteria

Look up a route using a separately constructed equal key; rename its display name and check the lookup still succeeds. Insert the same id in two tenants and verify neither entry is lost. Verify key iteration after replacing an existing entry and adding a new one.
