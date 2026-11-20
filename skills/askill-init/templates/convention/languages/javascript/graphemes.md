# Truncate visible text at grapheme boundaries

## When to read

Read when UI text limits count user-perceived characters rather than UTF-16 code units, encoded bytes, or display columns.

## Decision

Use grapheme segmentation. `slice` can split a surrogate pair, and `[...text]` still splits sequences such as a flag or a letter with a combining accent.

## Bad

```js
function prefix(text, count) {
  return text.slice(0, count);
}
```

## Good

```js
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function prefix(text, count) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("count must be a nonnegative integer");
  }
  let seen = 0;
  for (const { index } of graphemes.segment(text)) {
    if (seen === count) {
      return text.slice(0, index);
    }
    seen += 1;
  }
  return text;
}
```

## Assumptions and trade-offs

The deployment runtime has `Intl.Segmenter`; verify this on the supported target before using it. This scans up to the requested boundary rather than building an array of all segments. Graphemes are not terminal columns and do not measure encoded size. If the limit is a storage limit, check bytes separately.

## Verification

Check a flag, an emoji joined with a zero-width joiner, and `e\u0301`, each followed by `X`. **Pass:** count `1` preserves the entire first cluster without `X`; count `0` returns an empty string; a count exceeding the length returns the original text.
