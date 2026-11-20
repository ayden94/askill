# Decimal precision

**Invariant:** Parse decimal input exactly and apply the declared scale and rounding policy at the documented boundary, not at an implicit binary conversion.

**Compatibility:** Portable in the supported range. `BigDecimal(String)` and `setScale(int, RoundingMode)` are available on Java 8 and later, with no newer language or library features. Currency scale and rounding policy are contract choices, not JDK-version choices.

## When to read

Read when parsing exact decimal quantities or changing rounding, equality, and storage of money or rates.

Error-prone for a decimal amount: converting via `double` introduces binary approximation, including at ties.

```java
static java.math.BigDecimal invoiceTotal(String raw) {
    return new java.math.BigDecimal(Double.parseDouble(raw))
            .setScale(2, java.math.RoundingMode.HALF_EVEN);
}
```

Recommended for an invoice contract that rounds the final USD total once, to cents with ties to even:

```java
static java.math.BigDecimal invoiceTotal(String raw) {
    return new java.math.BigDecimal(raw)
            .setScale(2, java.math.RoundingMode.HALF_EVEN);
}
```

Validate the accepted decimal syntax and magnitude before parsing external text; Java's parser is not a wire schema. Carry the currency separately, keep intermediate precision according to the contract, and declare precision and rounding for non-terminating division. `equals` includes scale; use `compareTo` for numeric comparisons or normalize to the prescribed scale before hashing amounts. If an entered value must not have fractional cents, use exact conversion (`setScale(2, UNNECESSARY)` rejects any value that would actually need rounding); separately validate syntax if even trailing zero digits are forbidden. Not every currency or settlement rule uses scale 2.

## Verification and pass criteria

Assert `1.005` becomes `1.00`, `1.015` becomes `1.02`, and `-1.015` becomes `-1.02`. Check equality and hashing for normalized `2.0` and `2.00`; round-trip the maximum supported value through the configured database column without extra rounding.
