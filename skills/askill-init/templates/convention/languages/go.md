# Go

- Return errors with useful context and preserve error identity when callers must inspect it.
- Pass cancellation through blocking operations; document who stops each goroutine and closes each channel.

## Keep interfaces at the consumer

A consumer needing one lookup need not depend on a repository interface with ten methods. Start with concrete values; add the small interface when another implementation or boundary actually needs it.

## Own goroutines and channels

For a worker that sends on a channel, specify the sender that closes it and the event that stops it if the consumer exits early. Propagate context through blocking calls rather than starting detached work from a request.

## Return useful errors

Wrap an underlying error when callers should inspect it with errors.Is or errors.As. Do not detect a missing resource by matching the human-readable error text. Avoid logging and returning the same error at every layer.
