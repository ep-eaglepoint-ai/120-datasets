package com.example.studentapi;

import org.junit.platform.engine.TestExecutionResult;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Custom JUnit listener that produces pytest-style output.
 * Output format: test_class::test_method PASSED/FAILED
 */
public class PytestStyleListener implements TestExecutionListener {
    
    private final AtomicInteger passed = new AtomicInteger(0);
    private final AtomicInteger failed = new AtomicInteger(0);
    private final AtomicInteger skipped = new AtomicInteger(0);
    
    @Override
    public void testPlanExecutionStarted(TestPlan testPlan) {
        System.out.println("\n" + "=".repeat(60));
        System.out.println("TEST SESSION STARTS");
        System.out.println("=".repeat(60) + "\n");
    }
    
    @Override
    public void executionFinished(TestIdentifier testIdentifier, TestExecutionResult testExecutionResult) {
        if (testIdentifier.isTest()) {
            String displayName = testIdentifier.getDisplayName();
            String parentName = testIdentifier.getParentId()
                    .map(id -> id.substring(id.lastIndexOf('/') + 1))
                    .map(id -> id.replace("[class:", "").replace("]", ""))
                    .orElse("unknown");
            
            // Extract simple class name
            String className = parentName.contains(".") 
                    ? parentName.substring(parentName.lastIndexOf('.') + 1) 
                    : parentName;
            
            String testPath = className + "::" + displayName;
            
            switch (testExecutionResult.getStatus()) {
                case SUCCESSFUL:
                    passed.incrementAndGet();
                    System.out.println(testPath + " PASSED");
                    break;
                case FAILED:
                    failed.incrementAndGet();
                    System.out.println(testPath + " FAILED");
                    testExecutionResult.getThrowable().ifPresent(t -> {
                        System.out.println("    Error: " + t.getMessage());
                    });
                    break;
                case ABORTED:
                    skipped.incrementAndGet();
                    System.out.println(testPath + " SKIPPED");
                    break;
            }
        }
    }
    
    @Override
    public void testPlanExecutionFinished(TestPlan testPlan) {
        int total = passed.get() + failed.get() + skipped.get();
        
        System.out.println("\n" + "=".repeat(60));
        System.out.println("TEST RESULTS SUMMARY");
        System.out.println("=".repeat(60));
        System.out.println("Total:   " + total);
        System.out.println("Passed:  " + passed.get());
        System.out.println("Failed:  " + failed.get());
        System.out.println("Skipped: " + skipped.get());
        System.out.println("=".repeat(60));
        
        if (failed.get() > 0) {
            System.out.println("RESULT: FAILED (" + failed.get() + " failures)");
        } else {
            System.out.println("RESULT: PASSED (all " + passed.get() + " tests passed)");
        }
        System.out.println("=".repeat(60) + "\n");
    }
}
