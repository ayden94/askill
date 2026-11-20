# Immutable state snapshots

## When to read

Read when exposing state through `StateFlow`, copying nested state, or accepting updates from multiple callbacks.

Error-prone: the copy reuses the list that was just mutated, so old snapshots change and `StateFlow` can suppress an equal update.

```kotlin
data class CartState(val items: MutableList<String> = mutableListOf())

fun add(id: String) {
    val before = cart.value
    before.items.add(id)
    cart.value = before.copy()
}
```

Recommended on JVM when exposing a list even to Java callers: publish a new snapshot with immutable elements and an unmodifiable list backed by an exclusively owned copy.

```kotlin
import java.util.Collections
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class CartState(val items: List<String> = emptyList())

class Cart {
    private val mutableState = MutableStateFlow(CartState())
    val state: StateFlow<CartState> = mutableState.asStateFlow()

    fun add(id: String) = mutableState.update { before ->
        val items = ArrayList(before.items)
        items.add(id)
        CartState(Collections.unmodifiableList(items))
    }
}
```

`update` can reevaluate its lambda under contention; keep it pure apart from locally owned construction. A data class `copy` is shallow, and a Kotlin `List` alone is only a read-only interface. Snapshot mutable elements too, and copy incoming collections on ingress if callers retain them. Use existing immutable collection types if they suit the target and copying cost matters. A thread-confined reducer may assign a newly built value directly; use something other than `StateFlow` alone when every distinct event must be delivered.

## Verification and pass criteria

Capture the old snapshot, add an item, and assert the old snapshot stays empty and the new value contains the item. Test that Java mutation through the published list fails. Run two simultaneous additions and assert both IDs are present, without assuming collector emission count or update order.
