# Controllers, DTOs, guards and filters

**Assumptions:** This Nest HTTP app uses the decorator-based `ValidationPipe` strategy. `SessionGuard` verifies the credential and supplies a trusted actor via `CurrentActor`; `placeOrder` checks resource-level authorization and availability. Use the installed adapter and validation-library versions when checking behavior.

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

## Verification

1. Send missing credentials and then a valid credential without resource permission. Verify distinct contract outcomes and no writes.
2. Send missing, extra, null, string and out-of-range fields through the configured pipe. If nested, exercise a malformed child and confirm no partial write.
3. Send a valid request and check projection; cause a domain conflict and an unexpected database error and verify the filter returns safe, distinct failures.
