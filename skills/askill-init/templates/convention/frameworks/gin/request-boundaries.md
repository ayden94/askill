# Request boundaries

**Invariant:** Validate media type, bytes and decoded input before any write; only an absent scalar takes its default.

**Compatibility:** Stable Gin 1.x [binding choice](https://pkg.go.dev/github.com/gin-gonic/gin@v1.11.0#Context.ShouldBindJSON); the typed 413 branch is gated by the **Go standard library**, not Gin. Use the Gin release's toolchain minimum as well (e.g. [Gin 1.10.0](https://github.com/gin-gonic/gin/blob/v1.10.0/go.mod) requires Go 1.20; [1.11.0](https://github.com/gin-gonic/gin/blob/v1.11.0/go.mod) requires Go 1.23).

**Acceptance check:** Valid JSON reaches the service once; unsupported media, invalid input and overflow return their distinct documented statuses with no write. Empty or repeated scalar values do not take the default.

## When to read

Read when adding input fields, accepting another media type, or changing defaults for path or query parameters.

## Choose the decoder and own the failure response

**Wrong —** `BindJSON` can commit a 400 before the handler writes its documented response. Ignoring the failure also lets execution continue.

```go
var input createWidgetBody
_ = c.BindJSON(&input)
widgets.Create(c.Request.Context(), input.Name)
c.Status(http.StatusCreated)
```

**Right —** for this JSON-only route, validate the media type separately and use `ShouldBindJSON` to retain control of the response. Limit the bytes before binding.

```go
type createWidgetBody struct {
    Name string `json:"name" binding:"required,max=80"`
}

mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
if err != nil || mediaType != "application/json" {
    c.JSON(http.StatusUnsupportedMediaType, gin.H{"code": "json_required"})
    return
}
c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
var input createWidgetBody
if err := c.ShouldBindJSON(&input); err != nil {
    var oversized *http.MaxBytesError
    if errors.As(err, &oversized) {
        c.JSON(http.StatusRequestEntityTooLarge, gin.H{"code": "body_too_large"})
    } else {
        c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_widget"})
    }
    return
}
```

`ShouldBindJSON` explicitly selects JSON; it does not enforce the media type. This pattern limits bytes the decoder reads; it is not a check for trailing JSON values. If the contract requires exactly one value or rejects unknown keys, use an endpoint-owned `json.Decoder` with a bounded reader, check for EOF on a second decode, and run DTO validation explicitly.

- **Go 1.19 or newer:** [`http.MaxBytesError`](https://go.dev/doc/go1.19#nethttppkgnethttp) allows the streaming decoder above to classify an over-limit read. For an entire-body cap, consume through EOF, even if the decoder finishes early.
- **Go before 1.19, with a compatible Gin pin:** For a small JSON DTO, read `io.LimitReader(c.Request.Body, cap+1)` into a bounded buffer; map `len(raw) > cap` to 413 without matching error strings. Reject read failures, then `json.Unmarshal(raw, &input)` and run DTO validation explicitly before invoking the service. This also rejects trailing JSON values.

## Default only missing values

**Wrong —** both an invalid integer and a legitimate zero can end up taking the default.

```go
limit, _ := strconv.Atoi(c.Query("limit"))
if limit == 0 {
    limit = 20
}
```

**Right —** distinguish absence from an explicit value and reject ambiguous repeats for a scalar contract.

```go
limit := 20
if raw, present := c.GetQueryArray("limit"); present {
    if len(raw) != 1 {
        c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_limit"})
        return
    }
    n, err := strconv.Atoi(raw[0])
    if err != nil || n < 1 || n > 100 {
        c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_limit"})
        return
    }
    limit = n
}
```

## Exceptions and tradeoffs

Apply the media-type list in the published contract, including vendor JSON types if supported. Do not turn a list-valued parameter into a scalar just to reuse the example. Use pointer fields when omitted and explicit zero must be distinguished; distinguish omission from explicit `null` separately when the contract needs all three states. Validate business invariants in the use case, not only with binding tags.

## Verification and pass criteria

Send valid JSON with a charset parameter, a wrong media type, malformed JSON, a missing name, and a single oversized JSON string through the mounted route. Pass if the responses are respectively the documented success, 415, 400, 400, and 413 with the expected codes, and no rejected case invokes a write. For `limit`, exercise omission, empty, repeated, 0, 1, 100, and 101. Only omission selects 20; only the explicit in-range single values reach the query operation.
