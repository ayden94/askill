# Trait boundaries

## When to read

Read when adding a public trait method, changing generic bounds, or supporting a collection of implementations selected at runtime.

Error-prone for a decoder intended to support `&dyn Decode`: its generic convenience method makes the trait unsuitable as a trait object.

```rust
pub trait Decode {
    fn decode(&self, frame: &[u8]) -> Option<String>;
    fn from_text<T: AsRef<str>>(&self, input: T) -> Option<String> {
        self.decode(input.as_ref().as_bytes())
    }
}
```

Recommended: keep the core method usable on trait objects and put generic conveniences outside the trait.

```rust
pub trait Decode {
    fn decode(&self, frame: &[u8]) -> Option<String>;
}

pub fn decode_text<T: AsRef<str>>(decoder: &dyn Decode, input: T) -> Option<String> {
    decoder.decode(input.as_ref().as_bytes())
}
```

A helper method with `where Self: Sized` is also valid if trait-object callers do not need that method. Put `Send` and `Sync` bounds at the use site when only worker code requires them; imposing them on all implementations rules out otherwise valid local types. If callers never need runtime heterogeneity or a trait-object boundary, a generic `&impl Decode` can be simpler. For published traits, check whether downstream crates may implement them before adding required methods or blanket implementations.

## Verification and pass criteria

In an external consumer, implement the trait for two local types, place references in an array of `&dyn Decode`, and call `decode` on both; also pass each object to the generic helper. If local implementations need not be thread-safe, include one backed by `Rc`. Compile existing implementor fixtures against the new crate.
