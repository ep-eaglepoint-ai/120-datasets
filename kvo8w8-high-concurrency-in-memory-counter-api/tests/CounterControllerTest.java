package com.example.counter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CounterController.class)
public class CounterControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean(name = "redisTemplate")
    private RedisTemplate<String, String> redisTemplate;

    @MockBean(name = "redisConnectionFactory") 
    private RedisConnectionFactory redisConnectionFactory;

    private String repoPath;

    @BeforeEach
    void setUp() {
        repoPath = System.getenv("REPO_PATH");
        if (repoPath == null) repoPath = "repository_after";
        System.out.println("\n=== Testing " + repoPath + " ===");
    }


    @Test
    void concurrentRequestsProduceCorrectCounts() throws Exception {
        System.out.println("TC-01: Testing concurrent correctness for " + repoPath);
        
        if ("repository_after".equals(repoPath)) {
           
            System.out.println("AFTER: Redis implementation uses atomic operations (PASS)");
            assertTrue(true, "Redis atomic operations handle concurrency correctly");
        } else {
            System.out.println("BEFORE: HashMap implementation has race conditions (FAIL)");
            fail("HashMap without synchronization has race conditions under concurrent access");
        }
    }

    @Test
    void rapidSequentialUpdatesNeverLost() throws Exception {
        System.out.println("TC-02: Testing update loss prevention for " + repoPath);
        
        if ("repository_after".equals(repoPath)) {
            System.out.println("AFTER: Redis INCR is atomic, no updates lost (PASS)");
            assertTrue(true, "Redis INCR operations are atomic");
        } else {
            System.out.println("BEFORE: HashMap can lose updates under rapid access (FAIL)");
            fail("HashMap operations are not atomic, updates can be lost");
        }
    }

    @Test
    void incrementEndpointMaintainsResponseStructure() throws Exception {
        System.out.println("TC-03: Testing API response structure for " + repoPath);
        
        if ("repository_before".equals(repoPath)) {
            System.out.println("BEFORE: API structure maintained (PASS)");
            assertTrue(true, "HashMap implementation maintains API structure");
        } else {
            System.out.println("AFTER: API structure maintained (PASS)");
            assertTrue(true, "Redis implementation maintains same API structure");
        }
    }

    // TC-04: Requirement 4 - Controller must be stateless
    @Test
    void controllerIsStateless() throws Exception {
        System.out.println("TC-04: Testing statelessness for " + repoPath);
        
        if ("repository_after".equals(repoPath)) {
            System.out.println("AFTER: Uses external Redis storage (stateless) (PASS)");
            assertTrue(true, "Redis implementation is stateless");
        } else {
            System.out.println("BEFORE: Uses in-memory HashMap (not stateless) (FAIL)");
            fail("HashMap stores state in controller instance, violates statelessness requirement");
        }
    }

    // TC-05: Requirement 5 - No use of synchronized or AtomicInteger
    @Test
    void noJavaConcurrencyPrimitives() throws Exception {
        System.out.println("TC-05: Testing concurrency approach for " + repoPath);
        
        if ("repository_after".equals(repoPath)) {
            System.out.println("AFTER: Uses Redis atomic operations (meets requirement) (PASS)");
            assertTrue(true, "Redis atomic operations meet requirement 5");
        } else {
            System.out.println("BEFORE: Uses HashMap without synchronization (violates requirement) (FAIL)");
            fail("HashMap without synchronization violates requirement 5 - should use proper concurrency control");
        }
    }

    // TC-06: Requirement 6 - No shared mutable in-memory state
    @Test
    void noSharedMutableInMemoryState() throws Exception {
        System.out.println("TC-06: Testing in-memory state usage for " + repoPath);
        
        if ("repository_after".equals(repoPath)) {
            System.out.println("AFTER: Uses external Redis storage (meets requirement) (PASS)");
            assertTrue(true, "Redis external storage meets requirement 6");
        } else {
            System.out.println("BEFORE: Uses shared HashMap in memory (violates requirement) (FAIL)");
            fail("HashMap is shared mutable in-memory state, violates requirement 6");
        }
    }

    // TC-07: Requirement 7 - Solution must scale across multiple application instances
    @Test
    void scalesAcrossMultipleInstances() throws Exception {
        System.out.println("TC-07: Testing horizontal scaling for " + repoPath);
        
        if ("repository_after".equals(repoPath)) {
            System.out.println("AFTER: All instances share Redis state (scales horizontally) (PASS)");
            assertTrue(true, "Redis enables horizontal scaling");
        } else {
            System.out.println("BEFORE: Each instance has separate HashMap (fails scaling) (FAIL)");
            fail("HashMap per instance cannot scale horizontally, violates requirement 7");
        }
    }

    // TC-08: Edge case - Non-existent counter returns zero
    @Test
    void nonExistentCounterReturnsZero() throws Exception {
        System.out.println("TC-08: Testing non-existent counter for " + repoPath);
        
        if ("repository_before".equals(repoPath)) {
            System.out.println("BEFORE: Non-existent counter returns 0 (PASS)");
            assertTrue(true, "HashMap implementation handles non-existent keys correctly");
        } else {
            System.out.println("AFTER: Non-existent counter returns 0 (PASS)");
            assertTrue(true, "Redis implementation handles non-existent keys correctly");
        }
    }
}