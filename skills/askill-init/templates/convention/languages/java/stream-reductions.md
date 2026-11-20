# Stream reductions

**Invariant:** An ordered reduction preserves encounter order and duplicates when promised, without sharing mutable accumulators across partitions.

**Compatibility:** Version-sensitive. Java 11+ can use [`String::strip`](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/lang/String.html#strip()) and [local `var`](https://openjdk.org/jeps/286). On Java 8–10, declare `List<String> names` and map `name -> name.replaceAll("\\A\\p{javaWhitespace}+|\\p{javaWhitespace}+\\z", "")`; keep the same [Java 8 collector](https://docs.oracle.com/javase/8/docs/api/java/util/stream/Collectors.html). In both versions check empty inputs, duplicates, order, Unicode edge whitespace, and the promised result mutability.

## When to read

Read when adding a reduction, switching to parallel streams, or using a pipeline to build a result in encounter order.

Error-prone: mutating a shared identity in `reduce` violates the reduction contract; parallel partitions may update the same list and the combiner may combine it with itself.

```java
var names = inputs.parallelStream().reduce(
        new java.util.ArrayList<String>(),
        (list, name) -> { list.add(name.strip()); return list; },
        (left, right) -> { left.addAll(right); return left; });
```

Recommended for non-null names from an ordered source and a caller-owned mutable list: use a collector with partition-local containers.

```java
var names = inputs.stream()
        .map(String::strip)
        .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
```

Use `reduce` for value reductions with a neutral identity and associative combination, not an externally shared accumulator. Encounter order is not worker execution order; do not hide writes or auditing in `map` or `peek`. Prefer a plain loop when early exit, checked errors, or stepwise effects define the operation. Parallelism is an option for sufficiently large, measured, independent CPU work; do not move blocking I/O to a shared pool merely by switching stream mode.

## Verification and pass criteria

Pass an empty ordered source and a list with whitespace and duplicate names. The result must be empty in the first case and preserve duplicates and input order in the second. If parallel execution is supported, compare both modes on a larger fixture against an independently computed result; measure before enabling it by default.
