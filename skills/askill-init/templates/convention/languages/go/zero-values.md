# Make an empty collection's zero value safe to use

## When to read

Read when a struct's only required initialization is a map and callers naturally declare it as a variable or a field.

## Decision

If the zero value is supposed to represent an empty collection, allocate the map in the first writer and leave reads allocation-free. Nil map reads work, but assignment to a nil map panics.

## Bad

```go
package labels

type Set struct{ values map[string]struct{} }

func (s *Set) Add(key string) {
	s.values[key] = struct{}{}
}
```

## Good

```go
package labels

// Set is usable at its zero value. It must not be copied after first use
// or modified concurrently without synchronization.
type Set struct{ values map[string]struct{} }

func (s *Set) Add(key string) {
	if s.values == nil {
		s.values = make(map[string]struct{})
	}
	s.values[key] = struct{}{}
}

func (s *Set) Has(key string) bool {
	_, ok := s.values[key]
	return ok
}
```

## Assumptions and trade-offs

The empty state is meaningful and requires no external configuration. The zero value of `Set` is not a nil `*Set`; nil receivers are not supported. Lazy allocation is for unused instances, not synchronization. Copying an initialized struct aliases the map; add an explicit clone when independent copies are part of the contract. Use a constructor when you cannot establish validity from zero state alone.

## Verification

Declare two independent `var` instances without using a constructor. Read an absent key, add it twice to the first set, and check both sets. **Pass:** the first read is false, neither add panics, and only the first instance contains the key.
