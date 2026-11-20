# Truncate visible text at grapheme boundaries

**Invariant:** Truncation ends at an extended grapheme boundary, never partway through a user-perceived character.

**Compatibility — runtime version boundary:** Native `Intl.Segmenter` ships in [Chrome 87+](https://github.com/tc39/notes/blob/main/meetings/2021-01/jan-25.md), [Safari 14.1+](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/), and [Firefox 125+](https://bugzilla.mozilla.org/show_bug.cgi?id=1883914). Below those cutoffs use a compatible segmentation dependency, not code-point iteration; in Node check the actual [Intl/ICU build](https://nodejs.org/api/intl.html) rather than borrowing browser version numbers.

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

When the runtime lacks `Intl.Segmenter`, for example load `import "@formatjs/intl-segmenter/polyfill.js";` in the application's bootstrap before this module evaluates, using a package build compatible with the target. The [FormatJS polyfill](https://formatjs.github.io/docs/polyfills/intl-segmenter/) provides the same API; keep the truncation loop unchanged. If the product requires identical boundaries for new Unicode sequences across hosts, pin and test the segmentation implementation and data rather than assuming native engines share one Unicode version.

The loop stops consuming segments at the requested boundary rather than building an array. Graphemes are not terminal columns or encoded bytes; measure those separately.

## Verification

Check the native and fallback paths with `"🇰🇷X"`, `"👩‍💻X"`, and `"e\u0301X"`. **Pass:** count `1` preserves the entire first cluster without `X`; count `0` returns an empty string; count `3` returns the original text.
