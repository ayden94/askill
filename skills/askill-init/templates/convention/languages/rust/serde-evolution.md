# Serde schema evolution

**Invariant:** A schema rename keeps the promised write spelling and accepts supported old and new read spellings without treating absent, invalid, and duplicate fields alike.

**Compatibility:** Version-sensitive in `serde_derive`, not the Rust edition. The field alias arrived in [Serde 1.0.85](https://github.com/serde-rs/serde/compare/v1.0.84...v1.0.85) and is [read-only](https://serde.rs/field-attrs.html#alias). On an older supported Serde 1.0 release retain `Serialize` with `rename = "name"` and implement `Deserialize` with a `MapAccess` visitor: route `"name"` and `"display_name"` to one `Option<String>` slot and reject its second occurrence; read `"tags"` as `Vec<String>` (not `Option<Vec<_>>`), default it only if unseen, and handle unrecognized keys under the same schema policy. Require the name slot to be set. With 1.0.85+ derive both as shown. Check resolved Serde/derive versions, the `derive` feature or a direct derive dependency, and the selected format separately. Both branches must pass the same duplicate, null, omitted-field, and old-reader checks.

## When to read

Read when changing serialized fields, renaming external keys, or reading payloads or records across application versions. The examples assume an existing Serde derive dependency and a named-field format such as JSON.

Assume old applications read and write `name`. Error-prone: renaming the Rust field without a schema mapping breaks old records and changes output consumed by older readers.

```rust
#[derive(serde::Deserialize, serde::Serialize)]
struct Profile {
    display_name: String,
}
```

Recommended while old readers must still work: retain the established write name, accept the alternate name from an interoperating producer, and give a new field an explicit meaning when missing.

```rust
#[derive(serde::Deserialize, serde::Serialize)]
struct Profile {
    #[serde(rename = "name", alias = "display_name")]
    display_name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
}
```

`alias` adds a read spelling, not a second write spelling. Defaulting means that a missing `tags` field represents no tags; it does not make malformed data or explicit `null` valid for a vector. If older readers reject unknown fields, records with nonempty tags still require version negotiation or a separate legacy representation. For positional binary formats, do not assume name aliases preserve layout; verify that format specifically. Use a versioned schema rather than defaults where missing values cannot be safely inferred.

## Verification and pass criteria

Decode fixtures containing each name spelling, a missing `tags`, explicit `null`, and both name spellings together. Both valid spellings produce the same model, missing tags are empty, and null or duplicate logical names fail. Serialize and inspect exact keys, then feed the result to the supported old reader; verify the policy for both empty and nonempty tags.
