# Collection semantics

**Invariant:** Keys keep stable equality and hashing for their time in the map; iteration follows the explicitly promised order.

**Compatibility:** Version-sensitive. Below Java 16, replace the [record](https://openjdk.org/jeps/395) key with a final class with final `tenant` and `id` fields, a constructor, and `equals`/`hashCode` over exactly those two fields (e.g. `Objects.equals` and `Objects.hash`). Keep `LinkedHashMap` in both branches. At Java 16+ the record supplies that value equality. In the examples, use declared local types below [Java 10 `var`](https://openjdk.org/jeps/286), and `Collections.singletonList("ops")` as the `ArrayList` input below [Java 9 `List.of`](https://docs.oracle.com/javase/9/docs/api/java/util/List.html). In both branches, check lookup by an independently constructed equal key and insertion order after replacement.

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

Define which repeated keys replace, reject, or accumulate values; plain `put` replaces. Do not assume `HashMap` or [Java 10+ `Map.copyOf`](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/Map.html#copyOf(java.util.Map)) preserves insertion order. In a sorted map, comparator equality determines key uniqueness, so use a tie-breaker consistent with identity when unequal keys must coexist. Object identity maps are legitimate for tracking visited instances in an object graph, but not for value-based identifiers.

## Verification and pass criteria

Look up a route using a separately constructed equal key; rename its display name and check the lookup still succeeds. Insert the same id in two tenants and verify neither entry is lost. Verify key iteration after replacing an existing entry and adding a new one.
