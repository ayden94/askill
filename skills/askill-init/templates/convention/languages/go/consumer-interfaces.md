# Put small interfaces at the consumer boundary

## When to read

Read when a service depends on storage or another adapter, when a public constructor becomes hard to use, or when a test double must implement methods the code never calls.

## Rules

- Start with a concrete type when there is no meaningful seam. If a consumer needs to substitute an implementation or isolate I/O, define the smallest useful interface next to that consumer.
- Keep the method's semantic contract, not just its signature, explicit. Document absence and cancellation expectations; pass a `context.Context` to operations that may block.
- Implementations generally return concrete types so another consumer can depend on a different subset of methods. Add interfaces per stable capability, not one shared interface collecting every operation offered by an adapter.

## Error-prone

```go
package display

import "context"

type User struct{ Name string }

type UserRepository interface {
	Find(context.Context, string) (User, error)
	Save(context.Context, User) error
	Delete(context.Context, string) error
}

func DisplayName(ctx context.Context, repo UserRepository, id string) (string, error) {
	user, err := repo.Find(ctx, id)
	return user.Name, err
}
```

A read-only adapter can't be passed without inventing write methods, and a nonzero partial result leaks when the lookup fails.

## Recommended

```go
package display

import "context"

type User struct{ Name string }

// UserFinder returns an error for an unavailable user or a canceled lookup.
type UserFinder interface {
	Find(ctx context.Context, id string) (User, error)
}

func DisplayName(ctx context.Context, finder UserFinder, id string) (string, error) {
	user, err := finder.Find(ctx, id)
	if err != nil {
		return "", err
	}
	return user.Name, nil
}
```

## Why and trade-offs

Go's implicit interface satisfaction lets read-only concrete adapters serve this consumer without changing their package or widening capabilities. A new interface adds an exported contract in this example, so if the consumer doesn't need a seam, adding one preemptively creates needless indirection.

## Edge cases and exceptions

A provider-owned standard protocol such as `io.Reader` can already be the right interface; reuse it rather than cloning it. If `Find` has a pointer receiver, use the pointer as the adapter. A nil pointer inside an interface is not a nil interface; avoid promising that `finder == nil` detects an adapter's invalid receiver.

## Verification

Pass a fake with only `Find` that records the ID and context. Repeat with a fake that returns both a nonzero user and a known failure. **Pass:** no write-method stubs are required, the original arguments reach the adapter, and the failing call returns an empty name and the original error.
