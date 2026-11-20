# Spring Boot JPA slices and projections

**Invariant:** A window returns only authorized public columns, with deterministic order and a next-window flag without a total-count query.

**Scope:** Portable for Spring Data JPA's `Slice` and explicit JPQL constructor projection across the Boot trains; the example uses Java 17 record DTOs and a production-engine query check.

**Read when:** Adding a JPA “load more” endpoint that needs a next-page indication but not a total count.

## Decision

Use `Slice` with a bounded `Pageable` when the contract only exposes `hasNext`, and select the public columns with an explicit projection. Include a unique ordering tie-breaker. Keep the read scoped in the query; counting or filtering rows after fetching breaks paging and may reveal data.

## Bad

```java
Page<Article> findByWorkspaceId(UUID workspaceId, Pageable pageable);

// The endpoint uses only these two values; it doesn't publish totals.
return new ArticleWindow(page.getContent().stream().map(this::toSummary).toList(),
                         page.hasNext());
```

`Page` may execute a count query even though the client never uses the total. Entity mapping can add lazy loads after the base query.

## Good

```java
// ArticleSummary is a public record in com.example.catalog.
interface ArticleRepository extends Repository<Article, UUID> {
    @Query("""
        select new com.example.catalog.ArticleSummary(a.id, a.title)
        from Article a
        where a.workspaceId = :workspace
        order by a.publishedAt desc, a.id desc
        """)
    Slice<ArticleSummary> newest(@Param("workspace") UUID workspace, Pageable pageable);
}

Slice<ArticleSummary> result =
    articles.newest(actor.workspaceId(), PageRequest.of(pageNumber, pageSize));
return new ArticleWindow(result.getContent(), result.hasNext());
```

## Assumptions and exceptions

Spring Data JPA is already used; the application has checked page number and size and does not accept a caller-supplied sort here. `publishedAt` is non-null and IDs are uniquely orderable on the intended backend. Offset slices can shift on concurrent inserts and be slow at deep offsets. Use keyset pagination for deep mutable lists, or `Page` when exact totals are part of the API.

## Verification

Against the production database type, seed tied timestamps, a foreign workspace, and `pageSize + 1` visible rows. Check both windows for exact IDs and `hasNext` values. Capture executed SQL on the full first window: expect the narrow ordered select, no count, and no lazy queries from response rendering. Inspect the representative query plan for the filter/order combination.
