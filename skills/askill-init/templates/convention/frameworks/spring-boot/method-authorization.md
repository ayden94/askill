# Spring Security service method authorization

**Read when:** A privileged use case can be called from several controllers or from a non-MVC entry point.

## Decision

When Spring Security is already in use, activate method security explicitly and put capability checks on externally invoked service methods. Route rules establish the transport floor, not permission on every caller path. A method authority also doesn't grant access to arbitrary tenant rows; scope the actual lookup or mutation.

## Bad

```java
@PreAuthorize("hasAuthority('articles:publish')")
void publishFromMenu(UUID id) {
    this.publish(id);
}

public void publish(UUID id) {
    articles.publishById(id);
}
```

Another entry point can call `publish` directly. A security annotation on an internal helper would not fix self-invocation either.

## Good

```java
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
class CatalogAuthorization {}

@Service
class ArticlePublisher {
    private final Articles articles;
    private final CurrentActor currentActor;

    ArticlePublisher(Articles articles, CurrentActor currentActor) {
        this.articles = articles;
        this.currentActor = currentActor;
    }

    @PreAuthorize("hasAuthority('articles:publish')")
    public void publish(UUID id) {
        var actor = currentActor.requireAuthenticated();
        if (!articles.publishInWorkspace(id, actor.workspaceId())) {
            throw new ArticleNotFound();
        }
    }
}
```

## Assumptions and exceptions

`CurrentActor` reads trusted authentication and the repository's mutation includes the workspace predicate. Call the injected, proxyable bean; don't instantiate it or call the advised method through `this`. A background process without a user principal should have an explicit system use case and policy, not bypass the user check by inventing an identity.

## Verification

Invoke the injected service with authenticated contexts for missing authority, correct authority in a foreign workspace, and correct authority in the owning workspace. Assert denied/missing cases leave both workspaces unchanged and the authorized case publishes exactly one article. Confirm controller and non-MVC entry points both use the injected service.
