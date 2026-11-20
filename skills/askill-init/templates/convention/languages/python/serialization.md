# Encode the wire record, not the dataclass layout

## When to read

Read when exposing an internal record through JSON or persisting it beyond the lifetime of the current release.

## Decision

Project documented external fields explicitly and give non-JSON types deliberate encodings. Serializing `asdict` with `default=str` lets new internal fields leak into the wire contract and silently stringifies unsupported objects.

## Bad

```python
import json
from dataclasses import asdict, dataclass
from decimal import Decimal

@dataclass
class Quote:
    amount: Decimal
    currency: str
    calculation_note: str

def encode_quote(quote: Quote) -> str:
    return json.dumps(asdict(quote), default=str)
```

## Good

```python
import json
from dataclasses import dataclass
from decimal import Decimal

@dataclass
class Quote:
    amount: Decimal
    currency: str
    calculation_note: str

def encode_quote(quote: Quote) -> str:
    if not quote.amount.is_finite():
        raise ValueError("quote amount must be finite")
    return json.dumps({
        "version": 1,
        "amount": format(quote.amount, "f"),
        "currency": quote.currency,
    })
```

## Assumptions and trade-offs

Consumers agree that the amount is a decimal string in fixed-point notation; `Decimal("12.30")` retains its trailing zero. The domain bounds the scale and size, since fixed-point formatting expands large exponents. Currency validation is upstream. A separate decoder should dispatch on supported versions and reject unrecognized versions instead of constructing the current dataclass from arbitrary JSON keys.

## Verification

Decode the produced JSON for a quote with amount `Decimal("12.30")` and a nonempty internal note. Separately attempt to encode `Decimal("NaN")`. **Pass:** the record has exactly `version`, `amount`, and `currency`, with `"12.30"` unchanged; NaN is rejected before serialization.
