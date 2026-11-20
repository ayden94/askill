# Preserve error identity where callers act on it

**Invariant:** Callers can match the public absence sentinel and inspect intentionally exposed causes without relying on error text.

**Compatibility:** Version-independent recipe on Go 1.20+; `%w`, `errors.Is`, and `errors.As` date to [Go 1.13](https://go.dev/doc/go1.13#error_wrapping), and `os.ReadFile` and `io/fs` to [Go 1.16](https://go.dev/doc/go1.16#library).

## When to read

Read when adding context to an error, classifying a dependency failure, or deciding whether a resulting error should be part of a package's public contract.

## Rules

- Use `%w` when a caller should classify an underlying error with `errors.Is` or `errors.As`. `%v` includes its text without preserving identity. Avoid comparing error strings or depending on exact wrapping depth.
- Deliberately translate implementation-specific errors at a stable abstraction boundary. Returning a wrapped dependency error can commit callers to that identity even after implementation changes.
- Add action-oriented context, propagate actionable failures, and let the boundary with the recovery policy log or report them once. If returning an error renders the result unusable, return the zero value unless the contract explicitly supports partial results.

## Error-prone

```go
package config

import (
	"fmt"
	"os"
	"strings"
)

func ReadOptional(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		wrapped := fmt.Errorf("read local overrides: %v", err)
		if strings.Contains(wrapped.Error(), "no such file") {
			return nil, nil
		}
		return nil, wrapped
	}
	return data, nil
}
```

## Recommended

This API translates filesystem absence into a portable package sentinel, while intentionally allowing diagnostics and callers to inspect other I/O failures.

```go
package config

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
)

var ErrOverridesAbsent = errors.New("local overrides absent")

func ReadOverrides(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("read local overrides: %w", ErrOverridesAbsent)
	}
	if err != nil {
		return nil, fmt.Errorf("read local overrides: %w", err)
	}
	return data, nil
}
```

## Why and trade-offs

`os.ReadFile` can report a `*fs.PathError` wrapping a platform-specific cause. `errors.Is` classifies the cause without relying on wording; `errors.As` can recover typed context from the unexpected-error branch. Translating absence drops filesystem-specific details from that branch but makes absence independent of the adapter.

## Edge cases and exceptions

A dangling symlink or an absent parent can also produce `fs.ErrNotExist`; don't describe the sentinel as proof that only the final component is absent. Empty but readable data is not absence. Use `%v` instead of wrapping only when the dependency identity is intentionally private and the text is safe for its audience. Prefer a stable typed error when callers need a structured field, not several string variants.

## Verification

On a platform where reading a directory as a file fails, call `ReadOverrides` with a missing path, a directory, and a readable empty file in a temporary directory. **Pass:** only the first matches `ErrOverridesAbsent`; the directory error still supports `errors.As` to `*fs.PathError`; the empty file is a successful zero-length result.
