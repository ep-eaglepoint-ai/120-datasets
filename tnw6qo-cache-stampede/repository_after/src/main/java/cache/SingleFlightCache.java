package cache;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

/**
 * Single-flight cache: at most one computation per key in progress; completed outcomes
 * (success or failure) are cached so later callers do not recompute.
 *
 * Requirements mapping:
 * <ul>
 *   <li>1. Computation runs only once per key: putIfAbsent + completed cache; no recomputation unless invalidate.</li>
 *   <li>2. Concurrent callers wait and receive same result: followers wait on shared future via future.get().</li>
 *   <li>3. Failures propagated consistently: leader completes future exceptionally; waiters get same cause; Outcome stores failure for later callers.</li>
 *   <li>4. Different keys do not block each other: per-key maps (inFlight/completed); no cross-key lock.</li>
 *   <li>5. High concurrency: ConcurrentHashMap, putIfAbsent; no global lock.</li>
 *   <li>6. Failure must not trigger repeated computation: failed Outcome cached in completed; no remove-and-retry.</li>
 *   <li>7. Internal state cleaned up after completion: inFlight.remove in finally on both success and failure.</li>
 *   <li>8. No busy waiting: waiters block on future.get() (park/unpark), no spin loops.</li>
 *   <li>9. No background threads or thread pools: caller threads only; no Executor/Thread.</li>
 *   <li>10. No global synchronization: per-key structure; no static or single Lock.</li>
 *   <li>11. Java standard library only: java.util.*, java.util.concurrent.*.</li>
 * </ul>
 */
public class SingleFlightCache<K, V> {

    private final ConcurrentHashMap<K, CompletableFuture<V>> inFlight;
    private final ConcurrentHashMap<K, Outcome<V>> completed;

    public SingleFlightCache() {
        this.inFlight = new ConcurrentHashMap<>();
        this.completed = new ConcurrentHashMap<>();
    }

    public SingleFlightCache(int initialCapacity) {
        if (initialCapacity < 0) {
            throw new IllegalArgumentException("Initial capacity must be non-negative: " + initialCapacity);
        }
        this.inFlight = new ConcurrentHashMap<>(initialCapacity);
        this.completed = new ConcurrentHashMap<>(initialCapacity);
    }

    /**
     * Returns the cached outcome (success or failure). If absent, computes exactly once per key.
     *
     * Requirements satisfied:
     * - Single-flight per key: inFlight.putIfAbsent
     * - Waiters share same future
     * - Failure cached (no repeated computation)
     * - In-flight entry cleaned up in finally (success or failure)
     * - No busy-wait, no background threads, no global locks
     */
    public V get(K key, ComputeFunction<K, V> computeFunction) throws InterruptedException {
        Objects.requireNonNull(key, "Key must not be null");
        Objects.requireNonNull(computeFunction, "Compute function must not be null");

        // 1) Fast path: completed (including failures) => no recomputation
        Outcome<V> cached = completed.get(key);
        if (cached != null) {
            return cached.unwrap(key);
        }

        // 2) Single-flight: create or join an in-flight computation for this key
        CompletableFuture<V> newFuture = new CompletableFuture<>();
        CompletableFuture<V> existing = inFlight.putIfAbsent(key, newFuture);

        if (existing != null) {
            // Someone else is computing; wait for that result
            return waitForResult(key, existing);
        }

        // 3) We are the leader for this key: compute, complete the future, cache outcome
        try {
            V result = computeFunction.compute(key);

            // Cache success first (so even if followers arrive after we remove inFlight,
            // they still won't recompute)
            completed.putIfAbsent(key, Outcome.success(result));

            newFuture.complete(result);
            return result;

        } catch (InterruptedException e) {
            // Preserve interrupt status and propagate to all waiters
            Thread.currentThread().interrupt();

            Outcome<V> out = Outcome.failure(e);
            completed.putIfAbsent(key, out);

            newFuture.completeExceptionally(e);
            throw e;

        } catch (Exception e) {
            Outcome<V> out = Outcome.failure(e);
            completed.putIfAbsent(key, out);

            // Make waiters see a consistent failure; leader throws ComputationException too
            ComputationException wrapped = new ComputationException("Computation failed for key: " + key, e);
            newFuture.completeExceptionally(wrapped);
            throw wrapped;

        } finally {
            // 4) Always clean up in-flight state after completion (success OR failure)
            inFlight.remove(key, newFuture);
        }
    }

    private V waitForResult(K key, CompletableFuture<V> future) throws InterruptedException {
        try {
            return future.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();

            // If leader completed exceptionally with an InterruptedException, propagate it
            if (cause instanceof InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw ie;
            }

            if (cause instanceof ComputationException ce) {
                throw ce;
            }

            // Normalize any other exception type
            throw new ComputationException("Computation failed for key: " + key, cause);
        }
    }

    /**
     * Allows explicit recomputation after a failure or a stale value.
     * This is the ONLY way to allow recomputation, preserving "failure must not cause repeated computation".
     */
    public void invalidate(K key) {
        completed.remove(key);
    }

    /** Returns true if there is an active (not yet completed) computation for this key. */
    public boolean isInflight(K key) {
        return inFlight.containsKey(key);
    }

    /** Returns the number of keys currently in-flight (actively being computed). */
    public int getInflightCount() {
        return inFlight.size();
    }

    /** Returns the number of keys with cached outcomes (success or failure). */
    public int getCompletedCount() {
        return completed.size();
    }

    /** Represents a terminal cached outcome (success or failure). */
    private static final class Outcome<V> {
        private final V value;
        private final Throwable failure;

        private Outcome(V value, Throwable failure) {
            this.value = value;
            this.failure = failure;
        }

        static <V> Outcome<V> success(V value) {
            return new Outcome<>(value, null);
        }

        static <V> Outcome<V> failure(Throwable failure) {
            return new Outcome<>(null, Objects.requireNonNull(failure));
        }

        V unwrap(Object key) throws InterruptedException {
            if (failure == null) return value;

            if (failure instanceof InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw ie;
            }

            if (failure instanceof ComputationException ce) {
                throw ce;
            }

            throw new ComputationException("Computation failed for key: " + key, failure);
        }
    }
}
