# Decode exactly one bounded JSON request value

**Invariant:** A successful decode consumed one non-null note within the byte cap; unknown fields, trailing values, and oversized bodies fail without returning a partial note.

**Compatibility:** Version-independent `encoding/json` v1 recipe on Go 1.20+; `http.MaxBytesError`, used at the handler boundary, is available from [Go 1.19](https://go.dev/doc/go1.19#nethttppkgnethttp).

## When to read

Read when an HTTP endpoint accepts one JSON object and intends to reject unknown keys and trailing data.

## Decision

Bound the request before decoding, set the field policy explicitly, and verify EOF after one value. One successful `Decode` alone accepts a valid prefix even when other bytes follow it. Decode into a pointer here so JSON `null` can be rejected.

## Bad

```go
package notes

import (
	"encoding/json"
	"net/http"
)

type Note struct {
	Title string `json:"title"`
}

func Decode(r *http.Request) (Note, error) {
	var note Note
	err := json.NewDecoder(r.Body).Decode(&note)
	return note, err
}
```

## Good

```go
package notes

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

type Note struct {
	Title string `json:"title"`
}

func Decode(w http.ResponseWriter, r *http.Request) (Note, error) {
	body := http.MaxBytesReader(w, r.Body, 16<<10)
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	var note *Note
	if err := dec.Decode(&note); err != nil {
		return Note{}, err
	}
	var extra json.RawMessage
	if err := dec.Decode(&extra); err != io.EOF {
		if err != nil {
			return Note{}, err
		}
		return Note{}, errors.New("expected one JSON value")
	}
	if note == nil || note.Title == "" {
		return Note{}, errors.New("expected a note with a nonempty title")
	}
	return *note, nil
}
```

## Assumptions and trade-offs

This runs inside a server handler; `net/http` closes the request body. The handler classifies `*http.MaxBytesError` as a size error and maps other decode failures to client errors. Unknown fields are intentionally rejected, which may impede forward compatibility. The legacy standard decoder still accepts duplicate keys and case-insensitive field matches; if those must be rejected, choose a decoder or token-validation path that enforces that stronger contract. This example allows whitespace-only titles.

## Verification

Send one valid object and a version followed by whitespace. Also send an unknown field, `null`, a second value, a missing title, and a valid object followed by padding beyond the cap. **Pass:** only the first two succeed; oversize padding yields a `*http.MaxBytesError` rather than quietly bypassing the cap.
