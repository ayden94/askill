# Configuration and resource lifetime

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

Here STORE_CLIENT is provided by an async factory using validated settings; the snippet shows ownership, not the full factory. Choose either the library-provided lifecycle integration or a custom owner, not both. Configure the real host shutdown path deliberately; a unit test calling close is not signal-handling evidence.

## Verification

Start with missing required config and verify failure before serving requests. With a test client, process two requests and close the application; confirm a single owned client and one close. For long-running workers also demonstrate what happens to in-flight work.
