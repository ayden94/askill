# Serde schema evolution

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
