# Input validation and response projection

**Read when:** Changing accepted fields, nested payloads, defaults, or the response model.

## Decision

Wire DTO validation at the transport boundary. Map approved input fields into a command; return an explicit public projection. A TypeScript annotation neither removes extra fields nor controls JSON serialization.

## Bad

```ts
async register(dto: CreateUserDto) {
  return this.users.save({ ...dto }); // entity and transport contract are now coupled
}
```

## Good

```ts
async register(dto: CreateUserDto): Promise<UserView> {
  const user = await this.registerUser.execute({ email: dto.email });
  return { id: user.id, email: user.email };
}
```

## Assumptions and exceptions

If existing clients may send unknown fields, do not switch from ignoring them to rejecting them as an incidental cleanup. Nested arrays, null, missing fields and implicit type conversion each need an explicit contract. A serializer interceptor is an alternative only if exercised in the same configuration as production.

## Verification

Send a payload containing an internal-only field; check the documented accept/reject behavior and stored record. On success inspect the actual serialized body, not the controller return type. Include a nested invalid value when the route accepts collections.
