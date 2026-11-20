# Spring Boot startup runners and readiness

**Read when:** Adding a prerequisite that must finish before this application instance receives traffic.

## Decision

Make deployment-wide changes a deployment step, not an instance startup effect. For a small mandatory per-instance initialization, use a synchronous `ApplicationRunner` and propagate failure. Boot reaches accepting-traffic readiness after startup runners finish; starting a thread and returning tells Boot startup is complete prematurely.

## Bad

```java
@Bean
ApplicationRunner warmSearch(SearchIndex index, Executor executor) {
    return args -> executor.execute(index::loadRequiredSnapshot);
}
```

Traffic can arrive before the snapshot loads, and an exception on the background thread doesn't fail startup.

## Good

```java
import java.time.Duration;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;

@Bean
ApplicationRunner warmSearch(SearchIndex index) {
    return args -> index.loadRequiredSnapshot(Duration.ofSeconds(5));
}
```

## Assumptions and exceptions

This bean is declared in the app's configuration. `loadRequiredSnapshot` publishes the finished index atomically or throws, applying the budget to its actual I/O. The load balancer must use the Boot 3.5 readiness health group (Actuator probes enabled as appropriate): an open servlet port is not proof of readiness. Leave optional warmup out of this gate and serve its documented degraded behavior. Don't make liveness depend on an upstream.

## Verification

Start the packaged app locally with a fake loader held at a barrier and the actual readiness configuration. While blocked, verify readiness is not accepting traffic, then release it and verify a successful probe and a read from the loaded index. Make the loader fail and assert failed startup rather than permanent degraded service. Start two instances and verify the load has no shared write side effects.
