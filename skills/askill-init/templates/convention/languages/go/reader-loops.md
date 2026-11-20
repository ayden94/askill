# Process bytes before interpreting a reader error

**Invariant:** Every returned byte contributes to the count before EOF or a non-EOF error determines whether the result is complete.

**Compatibility:** Version-independent `io.Reader` contract and recipe on Go 1.20+; the reader's progress guarantees, not the compiler version, determine whether a no-progress policy is needed.

## When to read

Read when replacing `io.Copy` with a custom loop for incremental parsing, hashing, or accounting.

## Decision

Handle `n > 0` before inspecting `err`. `io.Reader` is allowed to return the last chunk and `io.EOF` together; checking for EOF first silently loses that chunk.

## Bad

```go
package tally

import "io"

func CountByte(r io.Reader, target byte) (int64, error) {
	buf := make([]byte, 4096)
	var count int64
	for {
		n, err := r.Read(buf)
		if err == io.EOF {
			return count, nil
		}
		if err != nil {
			return count, err
		}
		for _, value := range buf[:n] {
			if value == target {
				count++
			}
		}
	}
}
```

## Good

```go
package tally

import (
	"bytes"
	"io"
)

func CountByte(r io.Reader, target byte) (int64, error) {
	buf := make([]byte, 4096)
	var count int64
	for {
		n, err := r.Read(buf)
		count += int64(bytes.Count(buf[:n], []byte{target}))
		switch err {
		case nil:
			continue
		case io.EOF:
			return count, nil
		default:
			return count, err
		}
	}
}
```

## Assumptions and trade-offs

Reads over nonempty buffers eventually progress or fail. A zero-byte nil-error read is not EOF; if the reader can stall repeatedly, define a no-progress limit or enforce deadlines at the owning transport. This API deliberately returns the partial count for non-EOF errors. It borrows the reader and does not close it. Use `io.Copy` for plain forwarding instead of reimplementing its loop.

## Verification

Use `testing/iotest.DataErrReader` over `strings.NewReader("xox")` to return data and EOF together. Repeat with a fake returning the same bytes and a sentinel error in one call. **Pass:** both return count `2`; the first completes successfully and the second preserves the sentinel.
