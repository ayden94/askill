# API and binary compatibility

## When to read

Read before changing a published Java library signature or distributing a new JAR to separately built callers. Identify which source, binary, and behavioral promises the project makes.

Assume v1 shipped `public boolean contains(String id)`. Error-prone: accepting `CharSequence` looks like widening at the source level, but removing the `String` descriptor breaks linkage for old binaries.

```java
public final class Catalog {
    public boolean contains(CharSequence id) {
        return id.length() != 0;
    }
}
```

Recommended: retain the original signature and behavior and extend the API without changing overload resolution for old calls.

```java
public final class Catalog {
    public boolean contains(String id) {
        return containsText(id);
    }

    public boolean containsText(CharSequence id) {
        return id.length() != 0;
    }
}
```

These example implementations assume v1 accepted nonempty IDs and rejected null with an exception; retain the real behavior, not only the signature. Check constructors, implementor obligations, callback interfaces, and reflective consumers as applicable. Old binary compatibility alone says nothing about ambiguous overloads when recompiling. An intentional breaking release may remove the old method under the project's versioning policy with a migration path. Keep examples and CI on the configured target release rather than only the build host JDK.

## Verification and pass criteria

Compile a consumer against the released v1 artifact, then run that same consumer binary with only v2 on the library classpath. Recompile its source against v2 and test the same calls, including the documented null behavior. Run a new caller against the new method and build on the minimum supported target.
