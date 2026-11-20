# Spring Boot transactions and persistence

## Context

Use this when a JPA or JDBC use case must commit multiple operations together, changes its rollback policy, or exposes a read that traverses relationships.

## Rules

- Own the transaction on an externally invoked, proxyable Spring service operation. In proxy mode, `this` calls don't pass through advice. Prefer constructor-injected collaborators to injecting a bean into itself.
- Check which exceptions trigger rollback. With the standard default, unchecked exceptions and `Error` roll back, checked exceptions don't; declare explicit `rollbackFor` when a checked failure should undo work. Do not catch a failure and return a success response from inside the transaction.
- Protect durable invariants with database constraints. JPA writes can fail at flush/commit, so `save` returning isn't proof of success. Treat a failed flush as a transaction failure, not an opportunity to continue issuing writes.
- Fetch the required read graph with explicit projections, joins, or entity graphs, and map it while inside the intended persistence boundary. Check actual SQL and pagination for collections; don't rely on incidental lazy loading during JSON rendering.
- Avoid remote calls in a transaction. Use an outbox for durable external work; an after-commit listener alone can lose the event on process failure.

## Wrong: annotating a self-invoked helper

```java
@Service
class Checkout {
    // Constructor and repositories omitted.
    public OrderId place(Cart cart) {
        return persist(cart);
    }

    @Transactional
    public OrderId persist(Cart cart) {
        var order = orders.save(Order.from(cart));
        reservations.reserve(order);
        return order.id();
    }
}
```

A caller entering `place` does not invoke the `persist` advice. Repository-level transactions can then commit the order independently of the reservation.

## Right: own the transaction at the public use-case entry

```java
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class Checkout {
    private final Orders orders;
    private final Reservations reservations;

    Checkout(Orders orders, Reservations reservations) {
        this.orders = orders;
        this.reservations = reservations;
    }

    @Transactional(rollbackFor = StockUnavailable.class)
    public OrderId place(Cart cart) throws StockUnavailable {
        var order = orders.save(Order.from(cart));
        reservations.reserve(order);
        return order.id();
    }
}
```

Assumes a Spring-managed caller, a shared transaction manager, and reservation writes that join the transaction. The checked exception rule makes the business failure explicit. A separate transaction would change atomicity, not just call structure.

## Exceptions

Use `TransactionTemplate` when a local block or explicit sequencing is clearer than proxy advice. Use `REQUIRES_NEW` only when effects must deliberately survive an outer rollback and the pool can supply another connection. Reactive transactions use a different context model; don't apply thread-bound JDBC assumptions to a reactive pipeline.

## Verification

1. Invoke the injected `Checkout` from a non-transactional test with a real database. Arrange an in-stock cart and assert both writes are durable after the call.
2. Seed a cart that fails reservation after saving the order. Pass only if the documented exception escapes and an independent read finds neither write. Flush explicitly in a repository test for a constraint whose violation is deferred to flush.
3. For projection changes, execute the paginated query on representative cardinalities, logging/counting SQL. Pass if size/order match the contract and query count doesn't grow with each rendered row.

Reference: [Spring Framework 6.2 transactional annotations](https://docs.spring.io/spring-framework/reference/6.2/data-access/transaction/declarative/annotations.html) and [rollback rules](https://docs.spring.io/spring-framework/reference/6.2/data-access/transaction/declarative/rolling-back.html).
