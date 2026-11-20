# Infer from the choices, not from their fallback

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

The fallback must belong to the supplied list; an empty list is therefore invalid. This example uses built-in `NoInfer` from TypeScript 5.4+. On an older supported compiler, split the API into a choice-binding call and a selection call rather than upgrading just for the utility. Broad values such as `string[]` or explicit broad type arguments can still lose literal information; the runtime membership check covers them at the cost of a scan. The copy keeps later mutations to the input array from invalidating the initial configuration.

## Verification

Check that `config.fallback` is assignable to `"low" | "high"` and that a call with a literal `"medium"` fallback fails to typecheck. Execute a call with a widened `string[]` containing only `"low"` and fallback `"medium"`. **Pass:** the literal misuse fails at compile time, the widened misuse throws, and the valid sample has fallback `"high"`.
