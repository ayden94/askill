# FFI buffer contracts

**Invariant:** A safe wrapper passes only the bytes covered by the live borrow and upholds the foreign function's ABI and lifetime requirements.

**Compatibility:** Version-sensitive in compiler and edition. A Rust 2021 crate targeting a compiler before 1.82 can use `extern "C"` as shown. [Rust 1.82](https://doc.rust-lang.org/edition-guide/rust-2024/unsafe-extern.html) permits `unsafe extern "C"` in all editions; [Rust 2024, available since 1.85](https://blog.rust-lang.org/2025/02/20/Rust-1.85.0/), requires it. On that branch change only the block header to `unsafe extern "C"`; leave `checksum` unsafe to call and keep the wrapper's checked pointer/length relationship. Link both against the same ABI-matched shim and check empty and nonempty lengths.

## When to read

Read when adapting a Rust slice to a synchronous foreign function that borrows a pointer and length. Confirm the actual ABI, pointer retention, mutation, and zero-length behavior in the foreign declaration.

Assume the C function uses `const uint8_t *`, accepts a `size_t` length including zero, and reads only during the call. Error-prone: the safe Rust wrapper accepts a length unrelated to the borrowed slice, allowing the foreign code to read beyond it.

```rust
extern "C" {
    fn checksum(data: *const u8, len: usize) -> u32;
}

pub fn frame_checksum(frame: &[u8], len: usize) -> u32 {
    unsafe { checksum(frame.as_ptr(), len) }
}
```

Recommended in a Rust 2021 crate: derive the count from the borrow and state why the one unsafe operation is valid.

```rust
extern "C" {
    fn checksum(data: *const u8, len: usize) -> u32;
}

pub fn frame_checksum(frame: &[u8]) -> u32 {
    // SAFETY: the function reads exactly the supplied bytes before returning;
    // it does not dereference the pointer for a zero-length slice.
    unsafe { checksum(frame.as_ptr(), frame.len()) }
}
```

If callers need a prefix, pass a checked subslice rather than a separate unchecked length. Match the actual foreign types and use checked conversions for narrower lengths. This wrapper assumes the foreign function does not unwind across the boundary or retain/mutate the input; if it retains the pointer, use an explicit owner that keeps storage alive for the full foreign lifetime. APIs requiring null for empty input need that special case at the wrapper, not a blanket null policy.

## Verification and pass criteria

Link the wrapper against the real library or an ABI-matched test shim. Check known outputs for empty, one-byte, embedded-zero, and prefix slices. For a shim, record that it receives exactly the slice length; run the boundary tests under the project's native memory diagnostic tooling where supported. Tests complement, not replace, confirming the foreign preconditions from its declaration and documentation.
