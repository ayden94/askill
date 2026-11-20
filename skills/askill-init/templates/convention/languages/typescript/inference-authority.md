# Infer from the choices, not from their fallback

**Invariant:** The fallback cannot widen the inferred choices, and it must still be a member at runtime.

**Compatibility — compiler version boundary:** Use the built-in [`NoInfer`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html#the-noinfer-utility-type) on TypeScript 5.4+. On TypeScript 4.9–5.3 bind the choices and select the fallback in separate calls. Both examples use `strict`; `includes` independently requires an ES2016 array library declaration and a runtime implementation ([ECMAScript](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.includes)). For ES2015 use `indexOf(fallback) === -1` for these strings, with the same membership checks.

## When to read

Read when a generic call takes a set of allowed literals and a second value that must select from that set.

## Decision

Give the allowed values authority over inference. If both parameters infer `T`, an invalid fallback can become another member of `T` instead of failing a check.

## Bad

```ts
function configureChoices<T extends string>(choices: readonly T[], fallback: T) {
  return { choices, fallback };
}

const config = configureChoices(["low", "high"], "medium");
```

## Good

```ts
function configureChoices<T extends string>(
  choices: readonly T[],
  fallback: NoInfer<T>,
) {
  if (!choices.includes(fallback)) {
    throw new RangeError("fallback is not an available choice");
  }
  return { choices: [...choices], fallback };
}

const config = configureChoices(["low", "high"], "high");
```

## Assumptions and trade-offs

The two-stage API fixes `T` before it sees the fallback:

```ts
function bindChoices<T extends string>(choices: readonly T[]) {
  const allowed = [...choices];
  return (fallback: T) => {
    if (!allowed.includes(fallback)) {
      throw new RangeError("fallback is not an available choice");
    }
    return { choices: [...allowed], fallback };
  };
}

const config = bindChoices(["low", "high"])("high");
```

An empty list is invalid. Broad values such as `string[]` or explicit broad type arguments can still lose literal information; the runtime membership check covers them. Copying prevents later mutation of the input array from changing the accepted set.

## Verification

For either call shape, check that `config.fallback` is assignable to `"low" | "high"` and that a literal `"medium"` fallback fails to typecheck. Execute a call with a widened `string[]` containing only `"low"` and fallback `"medium"`. **Pass:** the literal misuse fails at compile time, the widened misuse throws, and the valid sample has fallback `"high"`.
