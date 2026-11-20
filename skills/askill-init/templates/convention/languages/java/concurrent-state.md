# Concurrent state transitions

## When to read

Read when multiple threads register a key, acquire an in-process claim, or update a shared invariant.

Error-prone: the individual map operations are safe, but two callers can both pass the check and both report success.

```java
static boolean claim(java.util.concurrent.ConcurrentMap<String, String> owners,
                     String key, String owner) {
    if (owners.containsKey(key)) return false;
    owners.put(key, owner);
    return true;
}
```

Recommended for a map of non-null owners such as `ConcurrentHashMap`: elect the winner with one atomic operation.

```java
static boolean claim(java.util.concurrent.ConcurrentMap<String, String> owners,
                     String key, String owner) {
    return owners.putIfAbsent(key, owner) == null;
}
```

Specify whether a repeat claim by the same owner succeeds; here it does not. Use an atomic conditional removal or replacement if ownership can change between read and write; if owner identifiers can be reused, give each claim a unique token. For an invariant spanning keys or collections, use one lock around all participants or one transaction with appropriate isolation. A map cannot coordinate multiple processes. Plain check-then-put is fine for thread-confined data.

## Verification and pass criteria

Release two workers against the same empty key with a barrier and bounded joins. Exactly one returns true and the stored owner is that winner. Also verify that distinct keys succeed and a repeated claim does not overwrite the first one. Stress runs supplement, but do not replace, checking that every writer uses the same atomic protocol.
