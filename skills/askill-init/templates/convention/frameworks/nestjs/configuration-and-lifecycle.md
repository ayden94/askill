# Configuration and resource lifetime

**Invariant:** Invalid required configuration prevents serving requests; each shared client has one owner and is closed once after its consumers are done.

**Compatibility:** The singleton `OnModuleDestroy` example requires no particular HTTP adapter or `@nestjs/config` release. If you use `ConfigModule.forRoot({ validationSchema })`, the schema contract changes at **`@nestjs/config` 12.0.0**, independently of the framework major.

**Read when:** Creating a shared client, adding configuration, or changing startup and shutdown.

## Decision

Validate required configuration at startup. Let a provider own a reusable resource and close it once. Avoid lazy environment reads in request handlers and never put request-specific state on a singleton.

## Bad

```ts
async find(id: string) {
  const client = await connect(process.env.STORE_URL!);
  return client.find(id); // connection lifetime is unowned
}
```

## Good

```ts
@Injectable()
class StoreOwner implements OnModuleDestroy {
  constructor(@Inject(STORE_CLIENT) readonly client: StoreClient) {}
  async onModuleDestroy() { await this.client.close(); }
}
```

## Assumptions and exceptions

Here `STORE_CLIENT` is provided by an async factory using validated settings; the client implements `close()`. Choose either the library's lifecycle integration or a custom singleton owner, not both. Nest calls [shutdown hooks](https://docs.nestjs.com/fundamentals/lifecycle-events) on explicit `app.close()`; for `SIGTERM` enable `app.enableShutdownHooks()` or have the host call `app.close()`. A request-scoped provider is not an application lifecycle owner. Nest 12 changed [hook ordering](https://docs.nestjs.com/migration-guide#lifecycle-hook-ordering): if the client must outlive workers or active requests, explicitly coordinate stop-intake → drain → close instead of assuming sibling hooks run in that order.

### If the app uses Joi through `ConfigModule`

- **`@nestjs/config` 4.x:** pass a Joi schema as `validationSchema` and put Joi options directly in `validationOptions`, such as `{ allowUnknown: true, abortEarly: false }`.
- **`@nestjs/config` 12.x:** use Joi **18+** for its Standard Schema support, keep the same schema contract and put those options in `validationOptions: { libraryOptions: { allowUnknown: true, abortEarly: false } }`. See the [config 12 release](https://github.com/nestjs/config/releases/tag/12.0.0) and [migration example](https://docs.nestjs.com/migration-guide#config-module).

Both lines accept a project-owned synchronous `validate` function instead of `validationSchema`; this is also suitable if the project already has a configuration parser.

## Verification

On either config branch, verify the same valid environment is accepted with the same converted values, and that missing or malformed `STORE_URL` fails before listening or constructing the client. With a test client, process two requests and close the application; confirm a single owned client and one close. If the real host uses signals, exercise `SIGTERM` in a separate process with work in flight and verify that it drains before the client closes.
