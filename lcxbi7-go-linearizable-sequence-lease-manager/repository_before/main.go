package before

import (
	"context"
	"time"
)

// KeyValueStore represents a strongly-consistent distributed backend.
type KeyValueStore interface {
	// PutIfAbsent returns the current revision and success flag.
	PutIfAbsent(ctx context.Context, key string, val []byte, ttl time.Duration) (int64, bool, error)
	// CompareAndSwap updates only if the current revision matches 'oldRevision'.
	CompareAndSwap(ctx context.Context, key string, oldRevision int64, newVal []byte) (bool, error)
	// Watch blocks until the key is deleted or modified.
	Watch(ctx context.Context, key string) <-chan struct{}
	// Get returns the value and the current revision.
	Get(ctx context.Context, key string) ([]byte, int64, error)
}

type LeaseManager struct {
	store KeyValueStore
}

// Current implementation: Naive and lacks fencing or watch-based waiting.
func (lm *LeaseManager) AcquireAndHold(ctx context.Context, resourceID string) (context.Context, int64, error) {
	// TODO: Implement linearizable acquisition with fencing tokens and background renewal.
	return ctx, 0, nil
}
