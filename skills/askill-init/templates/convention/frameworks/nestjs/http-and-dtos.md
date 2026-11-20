# Controllers, DTOs, guards and filters

**Invariant:** Credentials and an approved, runtime-validated command must reach the use case before any write; the controller exposes only the public response fields.

**Compatibility:** This JSON-body example uses `ValidationPipe` from `@nestjs/common`, `class-validator` decorators, `class-transformer`, and a DTO class emitted as runtime decorator metadata. It uses no native request or response API and needs no Express/Fastify branch for the shown `POST`. Nest 12 also supports [route-decorator schemas](validation-and-serialization.md); it does not remove class DTOs.

**Assumptions:** `SessionGuard` verifies the credential and supplies a trusted actor via `CurrentActor`; `placeOrder` checks resource-level authorization and availability.

Use guards for admission, pipes for transport validation, controllers for mapping, and filters for transport error responses. Guards run before pipes: guard code reading raw inputs cannot assume DTO validation has run. Keep resource decisions in the use case so a queue consumer cannot sidestep them. DTOs, domain commands and response views are distinct contracts.

## Bad

```ts
@Post()
create(@Body() dto: { accountId: string; quantity: number }) {
  return this.repository.save(dto);
}
```

## Good

```ts
export class CreateOrderDto {
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

// Apply at bootstrap using the same setup for HTTP tests.
app.useGlobalPipes(new ValidationPipe({
  transform: true, whitelist: true, forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: false },
}));

@Controller('orders')
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(private readonly placeOrder: PlaceOrder) {}

  @Post()
  async create(@CurrentActor() actor: Actor, @Body() dto: CreateOrderDto) {
    const order = await this.placeOrder.execute(actor, { quantity: dto.quantity });
    return { id: order.id, state: order.state };
  }
}
```

Import DTO classes as runtime values when metadata requires them. If DTOs become nested, configure and test nested validation and transformation explicitly. Map typed application errors to the documented status and body with a filter at the appropriate scope; preserve unexpected causes in internal diagnostics, not the response.

**Exception:** A schema pipe can replace decorator DTO validation when the project already uses it; retain runtime checks and explicit projection. Use a native adapter response only when required (e.g., streaming); document who sends the response and test with that adapter.

### If the route accepts nested query parameters

The [Nest 10→11 upgrade](https://docs.nestjs.com/v11/migration-guide) moved the bundled Express adapter to Express 5 and the Fastify adapter to Fastify 5. Choose by the resolved adapter, not `@nestjs/core` alone:

- **Express 4.x:** retain the `extended` parser for an existing `filter[state]=open` contract.
- **Express 5.x:** the default is `simple`. If the contract still expects `{ filter: { state: 'open' } }`, set `app.set('query parser', 'extended')` on the `NestExpressApplication` before initialization. See the [Express migration guide](https://expressjs.com/en/guide/migrating-5.html#reqquery) and [Nest Express recipe](https://docs.nestjs.com/recipes/express-migration).
- **Fastify 4.x and 5.0–5.4:** use `new FastifyAdapter({ querystringParser: parseNestedQuery })`, where `parseNestedQuery` is the project's nested parser.
- **Fastify 5.5–5.x:** use `new FastifyAdapter({ routerOptions: { querystringParser: parseNestedQuery } })`; the top-level option is deprecated. See [Fastify 5.5.0](https://github.com/fastify/fastify/releases/tag/v5.5.0) and its [router option handling](https://github.com/fastify/fastify/blob/v5.5.0/lib/route.js). Do not change the adapter-wide parser just to support an endpoint that promises only flat keys.

## Verification

1. Send missing credentials and then a valid credential without resource permission. Verify distinct contract outcomes and no writes.
2. Send missing, extra, null, string and out-of-range fields through the configured pipe. If nested, exercise a malformed child and confirm no partial write.
3. Send a valid request and check projection; cause a domain conflict and an unexpected database error and verify the filter returns safe, distinct failures.
4. For an existing nested-query contract, send the same encoded query on each supported adapter/version. Assert the same validated filter reaches the use case and the same invalid values fail; a flat key must not silently drop the filter.
