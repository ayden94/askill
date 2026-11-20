# Java

- Expose domain behavior rather than mutable internal collections.
- Make resource ownership explicit with try-with-resources and preserve exception causes at service boundaries.

## Protect domain invariants

Use a constructor or factory that cannot return a partially initialized value. Returning an unmodifiable list does not make its mutable elements immutable; decide which side owns them.

## Define exception semantics

Distinguish an absent result from failed I/O. When translating an exception at a service boundary, keep its cause for diagnostics but do not expose driver messages in an API response.

## Control resource lifetime

Acquire streams and connections in the smallest useful scope. A stream backed by an open file cannot safely escape a try-with-resources block; return materialized data or transfer an explicitly documented close obligation.
