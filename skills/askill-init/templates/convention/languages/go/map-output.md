# Sort map keys at reproducible output boundaries

## When to read

Read when turning a map into human-readable output, a golden fixture, or another representation whose order observers compare.

## Decision

Sort keys at the output boundary. Go range order for maps is unspecified, so direct iteration is not a reproducible text format even if a small fixture seems stable.

## Bad

```go
package report

import "fmt"

func Lines(counts map[string]int) []string {
	lines := make([]string, 0, len(counts))
	for key, count := range counts {
		lines = append(lines, fmt.Sprintf("%s: %d", key, count))
	}
	return lines
}
```

## Good

```go
package report

import (
	"fmt"
	"sort"
)

func Lines(counts map[string]int) []string {
	keys := make([]string, 0, len(counts))
	for key := range counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, key := range keys {
		lines = append(lines, fmt.Sprintf("%s: %d", key, counts[key]))
	}
	return lines
}
```

## Assumptions and trade-offs

Keys are single-line labels, bytewise string ordering is the intended policy, and the map is not changed while formatting. Sorting needs extra storage and work; leave iteration unordered when callers do not observe order. Locale-aware order or canonical serialization for signing requires its own precise format, not this display function.

## Verification

Pass maps with the same entries inserted in different orders, including `"b"`, `"aa"`, and `"A"`. **Pass:** each produces the same lines with keys in order `"A"`, `"aa"`, `"b"`; nil and empty maps produce zero lines.
