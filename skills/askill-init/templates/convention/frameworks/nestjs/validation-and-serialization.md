# Input validation and response projection

**Invariant:** Only values allowed by the public input contract reach the command, and only explicitly public fields appear on the wire.

**Compatibility:** Explicit command mapping and a plain response projection work on either HTTP adapter. A class DTO requires Nest's `ValidationPipe`, `class-validator`, `class-transformer`, and runtime DTO metadata; its TypeScript type alone is not validation. Built-in Standard Schema integration starts in Nest 12, without replacing class DTOs.

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

If existing clients may send unknown fields, do not switch from ignoring them to rejecting them as an incidental cleanup. With the class pipe, set `whitelist: true` to strip properties without validation decorators and add `forbidNonWhitelisted: true` to reject them instead. For nested class arrays, use `@IsArray()`, `@ValidateNested({ each: true })` and `@Type(() => ChildDto)` along with decorators on the children. Decide separately what happens to null, missing fields and string-to-number conversion. With `ClassSerializerInterceptor`, return the configured class instance (or explicitly configure its type); a plain object's TypeScript return type does not run class-transformer decorators.

### Select the validation path

- **Schema-first, Nest 10–11:** pass a local schema pipe to `@Body(new CreateUserSchemaPipe())` that returns the parsed value or maps schema issues to the documented `400`. Project public fields explicitly as above.
- **Schema-first, Nest 12.x:** use `@Body({ schema: createUserSchema })` with a Standard Schema-compatible schema and register `new StandardSchemaValidationPipe()` as a global pipe. The decorator alone does not validate. Use the same unknown-key, coercion and error contract as the local pipe. Explicit projection still works; if opting into response schemas, use `StandardSchemaSerializerInterceptor` and `@SerializeOptions({ schema: userResponseSchema })` and assert the actual serialized shape. See the [Nest 12 migration](https://docs.nestjs.com/migration-guide#route-decorator-schemas).
- **Class DTOs on either branch:** direct `class-validator` calls default `forbidUnknownValues` to off in **0.13.x** and on in **0.14.x**; this concerns objects or validation groups without applicable metadata, not extra keys. If such objects must be rejected, ensure groups have rules and explicitly set `{ forbidUnknownValues: true }` rather than relying on defaults. Nest's [`ValidationPipe` in 11.0.0](https://github.com/nestjs/nest/blob/v11.0.0/packages/common/pipes/validation.pipe.ts) and [12.0.0](https://github.com/nestjs/nest/blob/v12.0.0/packages/common/pipes/validation.pipe.ts) defaults that option to `false` unless supplied. See the [`class-validator` 0.14.0 changelog](https://github.com/typestack/class-validator/blob/v0.14.0/CHANGELOG.md#breaking-changes).

## Verification

Run the same wire cases on every supported validation path: valid input reaches the command with the same parsed values, malformed input returns the same safe `400` with no write, and an extra internal-only field is rejected or stripped per the documented policy. Include null, missing fields and an invalid nested item where relevant. Assert the exact serialized public body and absence of internal fields; for direct class-validator callers, also check metadata-free input or a nonmatching group.
