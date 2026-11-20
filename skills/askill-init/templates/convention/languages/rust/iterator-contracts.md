# Iterator contracts

## When to read

Read when accepting a lazy input, aggregating fallible items, or handing processing control to the caller.

Error-prone for a strict import: the `ok` conversion silently discards invalid rows, and collecting first adds an unnecessary allocation.

```rust
fn total<'a>(rows: impl IntoIterator<Item = &'a str>) -> u64 {
    let amounts: Vec<u64> = rows.into_iter()
        .filter_map(|row| row.parse().ok())
        .collect();
    amounts.into_iter().sum()
}
```

Recommended for a finite input of unsigned integers whose total must fit:

```rust
#[derive(Debug, PartialEq, Eq)]
enum TotalError {
    InvalidRow { line: usize },
    Overflow { line: usize },
}

fn total<'a>(rows: impl IntoIterator<Item = &'a str>) -> Result<u64, TotalError> {
    rows.into_iter().enumerate().try_fold(0_u64, |sum, (index, row)| {
        let line = index + 1;
        let value = row.parse::<u64>().map_err(|_| TotalError::InvalidRow { line })?;
        sum.checked_add(value).ok_or(TotalError::Overflow { line })
    })
}
```

The first invalid or overflowing row ends traversal; empty input sums to zero. State whether an iterator may consume I/O or have side effects, and do not claim every item was inspected if consumers can stop early. Validate lexical rules separately if the format forbids syntax that Rust integer parsing accepts. A lenient import may skip rows, but report dropped rows if that is part of its contract. Materialize only when a bounded snapshot, second pass, or reusable ordering is needed.

## Verification and pass criteria

Check empty input, a valid stream, a malformed second row, and a value followed by a row that makes the sum overflow. Assert the one-based row number on each failure. Use an iterator with a call counter and assert it does not advance beyond the failing row.
