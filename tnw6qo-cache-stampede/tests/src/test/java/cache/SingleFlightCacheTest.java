package cache;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;


@DisplayName("SingleFlightCache Tests")
public class SingleFlightCacheTest {
    
    private SingleFlightCache<String, String> cache;
    
    @BeforeEach
    void setUp() {
        cache = new SingleFlightCache<>();
    }
    
    // ========================================================================
    // REQ-01: The expensive computation must run only once per key
    // ========================================================================
    
    @Test
    @DisplayName("REQ-01: Computation executes only once for single thread")
    void testSingleThreadComputesOnce() throws InterruptedException {
        AtomicInteger computationCount = new AtomicInteger(0);
        
        String result = cache.get("key1", key -> {
            computationCount.incrementAndGet();
            return "value1";
        });
        
        assertEquals("value1", result);
        assertEquals(1, computationCount.get(), "Computation should execute exactly once");
    }
    
    @Test
    @DisplayName("REQ-01: Computation executes only once per key under concurrent access")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testConcurrentAccessComputesOnce() throws Exception {
        final int threadCount = 50;
        final AtomicInteger computationCount = new AtomicInteger(0);
        final CyclicBarrier barrier = new CyclicBarrier(threadCount);
        final List<String> results = Collections.synchronizedList(new ArrayList<>());
        final List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        
        try {
            List<Future<?>> futures = new ArrayList<>();
            
            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(() -> {
                    try {
                        barrier.await();
                        
                        String result = cache.get("sameKey", key -> {
                            computationCount.incrementAndGet();
                            Thread.sleep(100);
                            return "computedValue";
                        });
                        
                        results.add(result);
                    } catch (Exception e) {
                        errors.add(e);
                    }
                }));
            }
            
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
            
            assertTrue(errors.isEmpty(), "No errors should occur: " + errors);
            
            // REQ-01: Computation should execute exactly once
            assertEquals(1, computationCount.get(), 
                "Computation must execute only once per key under concurrent access");
            assertEquals(threadCount, results.size());
            for (String result : results) {
                assertEquals("computedValue", result);
            }
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    // ========================================================================
    // REQ-02: Concurrent callers must wait and receive the same result
    // ========================================================================
    
    @Test
    @DisplayName("REQ-02: All concurrent callers receive the same result")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testConcurrentCallersReceiveSameResult() throws Exception {
        final int threadCount = 20;
        final CyclicBarrier barrier = new CyclicBarrier(threadCount);
        final List<String> results = Collections.synchronizedList(new ArrayList<>());
        final AtomicReference<String> computedValue = new AtomicReference<>();
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        
        try {
            List<Future<?>> futures = new ArrayList<>();
            
            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(() -> {
                    try {
                        barrier.await();
                        
                        String result = cache.get("key", key -> {
                            String value = "value-" + System.nanoTime();
                            computedValue.set(value);
                            Thread.sleep(50);
                            return value;
                        });
                        
                        results.add(result);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                }));
            }
            
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
            
            // REQ-02: All callers should receive the exact same result
            assertEquals(threadCount, results.size());
            String expectedValue = computedValue.get();
            assertNotNull(expectedValue);
            
            for (String result : results) {
                assertEquals(expectedValue, result, 
                    "All concurrent callers must receive the same result");
            }
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    // ========================================================================
    // REQ-03: Failures must be propagated consistently to all callers
    // ========================================================================
    
    @Test
    @DisplayName("REQ-03: Failure is propagated to all concurrent callers")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testFailurePropagatedToAllCallers() throws Exception {
        final int threadCount = 20;
        final CyclicBarrier barrier = new CyclicBarrier(threadCount);
        final List<Throwable> caughtExceptions = Collections.synchronizedList(new ArrayList<>());
        final AtomicInteger exceptionCount = new AtomicInteger(0);
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        
        try {
            List<Future<?>> futures = new ArrayList<>();
            
            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(() -> {
                    try {
                        barrier.await();
                        
                        cache.get("failingKey", key -> {
                            Thread.sleep(50);
                            throw new RuntimeException("Intentional failure");
                        });
                        
                    } catch (ComputationException e) {
                        exceptionCount.incrementAndGet();
                        caughtExceptions.add(e);
                    } catch (Exception e) {
                    }
                }));
            }
            
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
            
            // REQ-03: All callers should receive the exception
            assertEquals(threadCount, exceptionCount.get(), 
                "All concurrent callers must receive the failure");
            
            for (Throwable t : caughtExceptions) {
                assertInstanceOf(ComputationException.class, t);
                assertNotNull(t.getCause());
                assertEquals("Intentional failure", t.getCause().getMessage());
            }
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    @Test
    @DisplayName("REQ-03: ComputationException wraps original exception")
    void testComputationExceptionWrapsOriginal() {
        RuntimeException originalException = new RuntimeException("Original error");
        
        ComputationException thrown = assertThrows(ComputationException.class, () -> {
            cache.get("key", key -> {
                throw originalException;
            });
        });
        
        assertSame(originalException, thrown.getCause());
    }
    
    // ========================================================================
    // REQ-04: Different keys must not block each other
    // ========================================================================
    
    @Test
    @DisplayName("REQ-04: Different keys can be computed in parallel")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testDifferentKeysDoNotBlock() throws Exception {
        final int keyCount = 10;
        final AtomicInteger simultaneousComputations = new AtomicInteger(0);
        final AtomicInteger maxSimultaneous = new AtomicInteger(0);
        final CountDownLatch startLatch = new CountDownLatch(keyCount);
        final CountDownLatch proceedLatch = new CountDownLatch(1);
        
        ExecutorService executor = Executors.newFixedThreadPool(keyCount);
        
        try {
            List<Future<String>> futures = new ArrayList<>();
            
            for (int i = 0; i < keyCount; i++) {
                final String key = "key" + i;
                futures.add(executor.submit(() -> {
                    return cache.get(key, k -> {
                        int current = simultaneousComputations.incrementAndGet();
                        maxSimultaneous.updateAndGet(max -> Math.max(max, current));
                        startLatch.countDown();
                        
                        try {
                            proceedLatch.await(5, TimeUnit.SECONDS);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                        }
                        
                        simultaneousComputations.decrementAndGet();
                        return "value-" + k;
                    });
                }));
            }
            
            boolean allStarted = startLatch.await(5, TimeUnit.SECONDS);
            
            proceedLatch.countDown();
            
            for (Future<String> future : futures) {
                future.get(5, TimeUnit.SECONDS);
            }
            
            // REQ-04: Multiple keys should be computed simultaneously
            assertTrue(allStarted, "All computations should have started");
            assertTrue(maxSimultaneous.get() > 1, 
                "Different keys must not block each other - max simultaneous: " + maxSimultaneous.get());
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    // ========================================================================
    // REQ-05: The solution must support high concurrency
    // ========================================================================
    
    @Test
    @DisplayName("REQ-05: High concurrency stress test with multiple keys")
    @Timeout(value = 30, unit = TimeUnit.SECONDS)
    void testHighConcurrencyMultipleKeys() throws Exception {
        final int threadCount = 100;
        final int keyCount = 10;
        final AtomicInteger[] computationCounts = new AtomicInteger[keyCount];
        final CyclicBarrier barrier = new CyclicBarrier(threadCount);
        final List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());
        
        for (int i = 0; i < keyCount; i++) {
            computationCounts[i] = new AtomicInteger(0);
        }
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        
        try {
            List<Future<?>> futures = new ArrayList<>();
            
            for (int i = 0; i < threadCount; i++) {
                final int threadId = i;
                futures.add(executor.submit(() -> {
                    try {
                        barrier.await();
                        
                        // Each thread requests a specific key (multiple threads per key)
                        int keyIndex = threadId % keyCount;
                        String key = "key" + keyIndex;
                        
                        String result = cache.get(key, k -> {
                            computationCounts[keyIndex].incrementAndGet();
                            Thread.sleep(20);
                            return "value-" + k;
                        });
                        
                        assertEquals("value-" + key, result);
                    } catch (Exception e) {
                        errors.add(e);
                    }
                }));
            }
            
            for (Future<?> future : futures) {
                future.get(30, TimeUnit.SECONDS);
            }
            
            assertTrue(errors.isEmpty(), "No errors should occur: " + errors);
            
            // REQ-05: Each key should be computed exactly once
            for (int i = 0; i < keyCount; i++) {
                assertEquals(1, computationCounts[i].get(), 
                    "Key " + i + " should be computed exactly once");
            }
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    // ========================================================================
    // REQ-06: Failure must not trigger repeated computation
    // ========================================================================
    
    @Test
    @DisplayName("REQ-06: Failure does not cause repeated computation during same request")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testFailureDoesNotRepeatDuringSameRequest() throws Exception {
        final int threadCount = 20;
        final AtomicInteger computationCount = new AtomicInteger(0);
        final CyclicBarrier barrier = new CyclicBarrier(threadCount);
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        
        try {
            List<Future<?>> futures = new ArrayList<>();
            
            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(() -> {
                    try {
                        barrier.await();
                        
                        cache.get("failingKey", key -> {
                            computationCount.incrementAndGet();
                            Thread.sleep(50);
                            throw new RuntimeException("Intentional failure");
                        });
                    } catch (ComputationException e) {
                    } catch (Exception e) {
                    }
                }));
            }
            
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
            
            // REQ-06: Even on failure, computation should happen only once
            assertEquals(1, computationCount.get(), 
                "Failed computation must not be repeated for concurrent callers");
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    @Test
    @DisplayName("REQ-06: Late arrivals during failure do not trigger repeated computation")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testLateArrivalsDuringFailureDoNotRecompute() throws Exception {
        final AtomicInteger computationCount = new AtomicInteger(0);
        final CountDownLatch computationStarted = new CountDownLatch(1);
        final CountDownLatch lateArrivalsReady = new CountDownLatch(1);
        final List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());
        
        final int lateThreadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(lateThreadCount + 1);
        
        try {
            // Thread 1: Start computation, signal when started, wait for late arrivals, then fail
            Future<?> computeFuture = executor.submit(() -> {
                try {
                    cache.get("key", k -> {
                        computationCount.incrementAndGet();
                        computationStarted.countDown();  
                        lateArrivalsReady.await(5, TimeUnit.SECONDS);  
                        Thread.sleep(50);  
                        throw new RuntimeException("Intentional failure");
                    });
                } catch (ComputationException e) {
                    exceptions.add(e);
                } catch (Exception e) {
                    exceptions.add(e);
                }
            });
            
            assertTrue(computationStarted.await(5, TimeUnit.SECONDS), "Computation should have started");
            
            List<Future<?>> lateFutures = new ArrayList<>();
            for (int i = 0; i < lateThreadCount; i++) {
                lateFutures.add(executor.submit(() -> {
                    try {
                        cache.get("key", k -> {
                            computationCount.incrementAndGet();
                            return "should not compute";
                        });
                    } catch (ComputationException e) {
                        exceptions.add(e);
                    } catch (Exception e) {
                        exceptions.add(e);
                    }
                }));
            }
            
            lateArrivalsReady.countDown();
            
            computeFuture.get(10, TimeUnit.SECONDS);
            for (Future<?> f : lateFutures) {
                f.get(10, TimeUnit.SECONDS);
            }
            
            assertEquals(lateThreadCount + 1, exceptions.size(), 
                "All threads should have gotten exceptions");
            
            assertEquals(1, computationCount.get(), 
                "Computation must run only once even with late arrivals during failure");
            
        } finally {
            executor.shutdownNow();
        }
    }
    
    // ========================================================================
    // REQ-07: Internal state must be cleaned up after completion
    // ========================================================================
    
    @Test
    @DisplayName("REQ-07: Internal state is cleaned up after successful completion")
    void testCleanupAfterSuccess() throws InterruptedException {
        cache.get("key", k -> "value");
        
        // REQ-07: After completion, the in-flight entry should be removed
        assertEquals(0, cache.getInflightCount(), 
            "Internal state must be cleaned up after successful completion");
        assertFalse(cache.isInflight("key"));
    }
    
    @Test
    @DisplayName("REQ-07: Internal state is cleaned up after failure")
    void testCleanupAfterFailure() throws InterruptedException {
        try {
            cache.get("key", k -> {
                throw new RuntimeException("Failure");
            });
        } catch (ComputationException e) {
            // Expected
        }

        // REQ-07: In-flight entry must be removed after failure (cleanup on success OR failure)
        assertEquals(0, cache.getInflightCount(),
            "Internal state must be cleaned up after failure");
        assertFalse(cache.isInflight("key"));

        // Failure is cached; no automatic retry. Explicit invalidate allows recomputation.
        cache.invalidate("key");
        String result = cache.get("key", k -> "success");
        assertEquals("success", result);
    }
    
    @Test
    @DisplayName("REQ-07: Invalidate allows subsequent computations")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testCleanupAllowsRetry() throws Exception {
        AtomicInteger computationCount = new AtomicInteger(0);

        try {
            cache.get("key", k -> {
                computationCount.incrementAndGet();
                throw new RuntimeException("First failure");
            });
        } catch (ComputationException e) {
        }

        assertEquals(1, computationCount.get());
        // Failure is cached; no automatic retry. Explicit invalidate allows new computation.
        cache.invalidate("key");

        String result = cache.get("key", k -> {
            computationCount.incrementAndGet();
            return "success";
        });

        assertEquals("success", result);
        assertEquals(2, computationCount.get(),
            "After invalidate, a new computation should be allowed");
        assertEquals(0, cache.getInflightCount());
    }
    
    // ========================================================================
    // Additional Edge Case Tests
    // ========================================================================
    
    @Test
    @DisplayName("Null key throws NullPointerException")
    void testNullKeyThrowsException() {
        assertThrows(NullPointerException.class, () -> {
            cache.get(null, k -> "value");
        });
    }
    
    @Test
    @DisplayName("Null compute function throws NullPointerException")
    void testNullComputeFunctionThrowsException() {
        assertThrows(NullPointerException.class, () -> {
            cache.get("key", null);
        });
    }
    
    @Test
    @DisplayName("Computation can return null value")
    void testNullValueAllowed() throws InterruptedException {
        String result = cache.get("key", k -> null);
        
        assertNull(result, "Computation should be allowed to return null");
    }
    
    @Test
    @DisplayName("Different keys have independent computations")
    void testDifferentKeysIndependent() throws InterruptedException {
        String result1 = cache.get("key1", k -> "value1");
        String result2 = cache.get("key2", k -> "value2");
        
        assertEquals("value1", result1);
        assertEquals("value2", result2);
    }
    
    @Test
    @DisplayName("Constructor with initial capacity works correctly")
    void testConstructorWithInitialCapacity() throws InterruptedException {
        SingleFlightCache<String, String> cacheWithCapacity = new SingleFlightCache<>(100);
        
        String result = cacheWithCapacity.get("key", k -> "value");
        
        assertEquals("value", result);
    }
    
    @Test
    @DisplayName("Constructor rejects negative initial capacity")
    void testConstructorRejectsNegativeCapacity() {
        assertThrows(IllegalArgumentException.class, () -> {
            new SingleFlightCache<>(-1);
        });
    }
    
    @Test
    @DisplayName("InterruptedException is properly propagated")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void testInterruptedExceptionPropagated() throws Exception {
        final CountDownLatch computationStarted = new CountDownLatch(1);
        final CountDownLatch interrupted = new CountDownLatch(1);
        
        Thread computeThread = new Thread(() -> {
            try {
                cache.get("key", k -> {
                    computationStarted.countDown();
                    try {
                        Thread.sleep(10000);
                    } catch (InterruptedException e) {
                        interrupted.countDown();
                        throw e;
                    }
                    return "value";
                });
            } catch (InterruptedException e) {
                // Expected
            }
        });
        
        computeThread.start();
        
        computationStarted.await(5, TimeUnit.SECONDS);
        
        computeThread.interrupt();
        
        assertTrue(interrupted.await(5, TimeUnit.SECONDS), 
            "Computation should have been interrupted");
        
        computeThread.join(5000);
    }
    
    @Test
    @DisplayName("Sequential requests with invalidate trigger separate computations")
    void testSequentialRequestsAreSeparate() throws InterruptedException {
        AtomicInteger computationCount = new AtomicInteger(0);

        String result1 = cache.get("key", k -> {
            computationCount.incrementAndGet();
            return "value1";
        });
        assertEquals("value1", result1);
        assertEquals(1, computationCount.get());

        // Cached outcome: second get() returns same result without recomputing
        String cached = cache.get("key", k -> {
            computationCount.incrementAndGet();
            return "value2";
        });
        assertEquals("value1", cached);
        assertEquals(1, computationCount.get(), "No recomputation without invalidate");

        // Explicit invalidate allows a new computation
        cache.invalidate("key");
        String result2 = cache.get("key", k -> {
            computationCount.incrementAndGet();
            return "value2";
        });
        assertEquals("value2", result2);
        assertEquals(2, computationCount.get(),
            "After invalidate, a new computation runs");
    }
}
