# Task ownership and interruption

**Invariant:** Interruption is not success: cancel exclusive child work when its waiter is interrupted, without letting a departing waiter cancel shared work.

**Compatibility:** Portable in the supported range. The example uses `Future.get`, `Future.cancel`, and thread interruption from the Java 5 concurrency API; it does not depend on newer executor lifecycles or task abstractions. The executor and worker still have to honor the ownership and cooperation contract.

## When to read

Read when waiting on futures, adapting blocking work, or defining who cancels or shuts down an executor.

Error-prone: the interrupted waiter treats cancellation as success, drops its interrupt, and leaves its exclusive child running.

```java
static String await(java.util.concurrent.Future<String> task)
        throws java.util.concurrent.ExecutionException {
    try {
        return task.get();
    } catch (InterruptedException ignored) {
        return "";
    }
}
```

Recommended when the waiter exclusively owns this task and the signature can propagate interruption:

```java
static String await(java.util.concurrent.Future<String> task)
        throws InterruptedException, java.util.concurrent.ExecutionException {
    try {
        return task.get();
    } catch (InterruptedException cancelled) {
        task.cancel(true);
        throw cancelled;
    }
}
```

Apply the same ownership decision on timeout; a timed wait by itself does not cancel the task. `cancel(true)` requests interruption where supported; it is not a join, a rollback, or proof that external I/O stopped. Tasks must cooperate or have resource-level deadlines. If the signature cannot throw `InterruptedException`, restore the flag with `Thread.currentThread().interrupt()` before reporting cancellation. Do not cancel a shared computation when one waiter leaves. Only the executor owner shuts it down; define admission, queue bounds and rejection behavior for work the service owns.

## Verification and pass criteria

Use a latch to establish that an interruptible child has started, interrupt its waiter, and await separate worker and waiter completion signals with time bounds. The caller gets cancellation, not an empty result, and the task's cleanup completes. For a shared task, verify that cancelling one waiter leaves its other waiter able to receive the result.
