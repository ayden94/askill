# Keep unrelated identifiers from becoming interchangeable

**Invariant:** A syntactically valid team ID can be created at the conversion boundary, but neither a plain string nor an invoice ID can reach a typed team API accidentally.

**Compatibility — portable within TypeScript 2.7+ with `strict` and ES2015+ runtimes:** [`unique symbol`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-7.html#unique-symbol) supplies declaration identity; the `declare` symbols and brands have no runtime representation or `Symbol()` dependency. The original regex used the ES2015 `u` flag; the ASCII-only grammar below needs no Unicode regex features.

## When to read

Read when APIs accept identifier strings from multiple namespaces and an accidental cross-call would be valid structurally.

## Decision

Brand identifiers with inaccessible `unique symbol` fields and create them at a trusted conversion point. Two aliases for `string` document meaning, but do not stop an ID from reaching the wrong API.

## Bad

```ts
type TeamId = string;
type InvoiceId = string;

function teamPath(id: TeamId): string {
  return `/teams/${id}`;
}

const invoice: InvoiceId = "invoice_42";
teamPath(invoice);
```

## Good

```ts
declare const teamTag: unique symbol;
declare const invoiceTag: unique symbol;

export type TeamId = string & { readonly [teamTag]: true };
export type InvoiceId = string & { readonly [invoiceTag]: true };

export function parseTeamId(raw: string): TeamId {
  if (!/^team_[0-9]+$/.test(raw)) {
    throw new TypeError("expected a team identifier");
  }
  return raw as TeamId;
}

export function teamPath(id: TeamId): string {
  return `/teams/${id}`;
}
```

## Assumptions and trade-offs

This format uses namespace prefixes. When IDs share a format, obtain the brand from a trusted source that establishes the namespace, not from syntax alone. The single localized assertion follows validation; the brand does not exist at runtime and does not establish existence or authorization. Reconstruct the type at deserialization. Use distinct wrapper objects if runtime tags are necessary.

## Verification

Compile a positive call with `parseTeamId("team_42")` and negative calls with a plain string and a declared `InvoiceId`. At runtime parse `"invoice_42"` and `"team_42\n"`. **Pass:** only the branded team ID typechecks, the valid path ends in `/team_42`, and both malformed strings are rejected.
