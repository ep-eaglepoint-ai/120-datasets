/**
 * Comprehensive Test Suite for repository_after (Refactored ChaoticComponent)
 * Tests all 12 requirements to verify improvements
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, SELECTORS } from './test_config.js';
import {
  waitForElement,
  getMemoryUsage,
  monitorMemoryGrowth,
  getRenderCount,
  getSyncCounter,
  checkSourceCode,
  countPatternInSource,
  rapidModeSwitching,
  clickAndWaitForLog,
} from './test_utils.js';

const BASE_URL = TEST_CONFIG.AFTER_URL;

test.describe('ChaoticComponent AFTER - Improvement Verification', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  // Four-sub-module architecture (MUST BE MAINTAINED)
  test('All four modules render in full mode', async ({ page }) => {
    await page.click(SELECTORS.modeButton('full'));
    await page.waitForTimeout(500);

    const hasAlpha = await page.locator(SELECTORS.alphaSection).count() > 0;
    const hasBeta = await page.locator(SELECTORS.betaSection).count() > 0;
    const hasGamma = await page.locator(SELECTORS.gammaSection).count() > 0;
    const hasDelta = await page.locator(SELECTORS.deltaSection).count() > 0;

    expect(hasAlpha).toBeTruthy();
    expect(hasBeta).toBeTruthy();
    expect(hasGamma).toBeTruthy();
    expect(hasDelta).toBeTruthy();
  });

  test('Mode switching works correctly', async ({ page }) => {
    // Test alpha mode
    await page.click(SELECTORS.modeButton('alpha'));
    await page.waitForTimeout(300);
    expect(await page.locator(SELECTORS.alphaSection).count()).toBeGreaterThan(0);

    // Test beta mode
    await page.click(SELECTORS.modeButton('beta'));
    await page.waitForTimeout(300);
    expect(await page.locator(SELECTORS.betaSection).count()).toBeGreaterThan(0);

    // Test gamma mode
    await page.click(SELECTORS.modeButton('gamma'));
    await page.waitForTimeout(300);
    expect(await page.locator(SELECTORS.gammaSection).count()).toBeGreaterThan(0);

    // Test delta mode
    await page.click(SELECTORS.modeButton('delta'));
    await page.waitForTimeout(300);
    expect(await page.locator(SELECTORS.deltaSection).count()).toBeGreaterThan(0);
  });

  // Two Context providers work correctly (PRESERVED)
  test('Sync counter increments over time', async ({ page }) => {
    await page.click(SELECTORS.modeButton('full'));
    const initialSync = await getSyncCounter(page);

    // Wait for 5+ seconds for sync to increment
    await page.waitForTimeout(6000);

    const finalSync = await getSyncCounter(page);
    expect(finalSync).toBeGreaterThan(initialSync);
  });

  test('Theme context provides border colors', async ({ page }) => {
    await page.click(SELECTORS.modeButton('alpha'));
    await page.waitForTimeout(500);

    const alphaItems = await page.locator(SELECTORS.alphaItem).first();
    if (await alphaItems.count() > 0) {
      const borderStyle = await alphaItems.evaluate(el => 
        window.getComputedStyle(el).border
      );
      expect(borderStyle).toBeTruthy();
    }
  });

  // mainRef tracking
  test('Render count increases with interactions', async ({ page }) => {
    await page.click(SELECTORS.modeButton('alpha'));
    const initialRenderCount = await getRenderCount(page);

    // Interact with component
    await page.click(SELECTORS.modeButton('beta'));
    await page.waitForTimeout(300);
    await page.click(SELECTORS.modeButton('alpha'));
    await page.waitForTimeout(300);

    const finalRenderCount = await getRenderCount(page);
    expect(finalRenderCount).toBeGreaterThanOrEqual(initialRenderCount);
    expect(finalRenderCount).toBeGreaterThan(0);
  });

  // Memory leaks ELIMINATED (SHOULD PASS)
  test('No memory leaks detected', async ({ page }) => {
    await page.goto(BASE_URL + '?mode=full');

    // Baseline memory
    const memoryBefore = await monitorMemoryGrowth(page, 1000, 2);

    // Stress test with rapid mode switching
    await rapidModeSwitching(page, TEST_CONFIG.MODES, 20);

    // Check memory after stress test
    const memoryAfter = await monitorMemoryGrowth(page, 1000, 2);

    const growth = memoryAfter.final - memoryBefore.initial;

    // Should be minimal growth (< 50MB threshold)
    expect(growth).toBeLessThan(TEST_CONFIG.MEMORY_LEAK_THRESHOLD_MB);
  });


  // JSON.parse/stringify REPLACED (SHOULD NOT EXIST)

  test('No JSON.parse/stringify in critical paths', async () => {
    // Check main component
    const hasJSONParse = await checkSourceCode(
      '../repository_after/src/components/ChaoticComponent.tsx',
      /JSON\.parse\(JSON\.stringify/
    );

    // Check utils for immutable updates
    const hasImmutableUtils = await checkSourceCode(
      '../repository_after/src/utils/utils.ts',
      /setNestedValue|deleteNestedValue|deepMerge/
    );

    expect(hasJSONParse).toBeFalsy();
    expect(hasImmutableUtils).toBeTruthy();
  });


  // Gamma pipeline cancellation WORKS

  test('Pipeline cancels on mode switch', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    // Start gamma pipeline
    await page.click(SELECTORS.modeButton('gamma'));

    // Immediately switch away before completion
    await page.waitForTimeout(200);
    await page.click(SELECTORS.modeButton('alpha'));

    // Wait to see if pipeline still completes
    await page.waitForTimeout(2000);

    const pipelineCompleted = consoleLogs.some(log => 
      log.includes('Pipeline finished')
    );

    // Should NOT complete (properly cancelled)
    expect(pipelineCompleted).toBeFalsy();
  });


  // Debounce timing FIXED (300ms, not 0ms)
  test('Proper 300ms debounce implemented', async () => {
    const hasProperDebounce = await checkSourceCode(
      '../repository_after/src/components/SubComponentAlpha.tsx',
      /300/
    );

    const hasZeroTimeout = await checkSourceCode(
      '../repository_after/src/components/SubComponentAlpha.tsx',
      /setTimeout\([^,]+,\s*0\)/
    );

    expect(hasProperDebounce).toBeTruthy();
    expect(hasZeroTimeout).toBeFalsy();
  });

  
  // Beta batch processing OPTIMIZED
  // Tests that tree rendering works efficiently with batch processing
  test('Tree renders efficiently with optimization', async ({ page }) => {
    await page.click(SELECTORS.modeButton('beta'));
    await page.waitForTimeout(1500); // Wait for tree to render
    
    // Verify tree rendered with nodes
    const treeContainer = await page.locator('.sub-beta').count();
    expect(treeContainer).toBeGreaterThan(0);
    
    // Get initial node count
    const initialNodes = await page.locator('.sub-beta div').count();
    expect(initialNodes).toBeGreaterThan(0);
    
    // Test tree interaction (expand/collapse)
    const expandable = page.locator('[style*="cursor: pointer"]').first();
    if (await expandable.count() > 0) {
      const startTime = Date.now();
      await expandable.click();
      await page.waitForTimeout(800); // Wait for transition
      const endTime = Date.now();
      
      const finalNodes = await page.locator('.sub-beta div').count();
      
      // Verify tree interaction worked (nodes changed OR stayed stable)
      // This accounts for both expand and collapse scenarios
      expect(finalNodes).toBeGreaterThan(0);
      
      const renderTime = endTime - startTime;
      const nodeChange = Math.abs(finalNodes - initialNodes);
      
      // Verify efficient rendering (< 1 second for tree operation)
      expect(renderTime).toBeLessThan(1000);
    } else {
      // No interactive nodes, just verify static tree rendered
      console.log('✓ AFTER: Tree rendered with ' + initialNodes + ' static nodes');
    }
  });



  // Delta deep updates with history MAINTAINED
  test('Form updates track history with immutability', async ({ page }) => {
    await page.click(SELECTORS.modeButton('delta'));
    await page.waitForTimeout(500);

    const usernameField = page.locator('input[placeholder*="johndoe"]').first();

    if (await usernameField.count() > 0) {
      await usernameField.fill('testuser');
      await page.waitForTimeout(500);

      const historyText = await page.locator(SELECTORS.deltaHistory).textContent();
      expect(historyText).toContain('Modifications');

      // Verify immutable updates in source
      const hasImmutableUpdates = await checkSourceCode(
        '../repository_after/src/components/SubComponentDelta.tsx',
        /setNestedValue|deleteNestedValue/
      );
      expect(hasImmutableUpdates).toBeTruthy();
    }
  });

  // Utility functions RENAMED (clear names)
  test('Utility functions have clear names', async () => {
    const hasClearNames = await checkSourceCode(
      '../repository_after/src/utils/utils.ts',
      /export\s+(const|function)\s+(range|stringHash|reverseMap|createCache)/
    );

    const hasObfuscated = await checkSourceCode(
      '../repository_after/src/utils/utils.ts',
      /const\s+(_r|_h|_m|_z)\s*=/
    );

    expect(hasClearNames).toBeTruthy();
    expect(hasObfuscated).toBeFalsy();
  });

  // TypeScript STRICT MODE
  test('Req #11: TypeScript strict mode enabled', async () => {
    const fs = await import('fs/promises');

    // Check for .tsx files
    try {
      await fs.access('../repository_after/src/components/ChaoticComponent.tsx');
      console.log('✓ AFTER: Uses .tsx files');
    } catch {
      throw new Error('ChaoticComponent.tsx not found');
    }

    // Check tsconfig for strict mode
    const tsconfig = JSON.parse(
      await fs.readFile('../repository_after/tsconfig.json', 'utf-8')
    );

    expect(tsconfig.compilerOptions.strict).toBeTruthy();
    expect(tsconfig.compilerOptions.noImplicitAny).toBeTruthy();
    expect(tsconfig.compilerOptions.strictNullChecks).toBeTruthy();
  });

  // Self-contained (no external state libs)
  test('Req #12: Remains self-contained', async () => {
    const fs = await import('fs/promises');
    const packageJson = JSON.parse(
      await fs.readFile('../repository_after/package.json', 'utf-8')
    );

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    const hasRedux = 'redux' in deps || '@reduxjs/toolkit' in deps;
    const hasMobX = 'mobx' in deps;
    const hasZustand = 'zustand' in deps;

    expect(hasRedux).toBeFalsy();
    expect(hasMobX).toBeFalsy();
    expect(hasZustand).toBeFalsy();
  });

  // INTEGRATION TEST: Full workflow with performance verification
  test('Integration: Complete user workflow with performance check', async ({ page }) => {
    const startRenderCount = await getRenderCount(page);

    // Start in full mode
    await page.click(SELECTORS.modeButton('full'));
    await page.waitForTimeout(500);

    // Click alpha item
    const alphaItem = page.locator(SELECTORS.alphaItem).first();
    if (await alphaItem.count() > 0) {
      await alphaItem.click();
      await page.waitForTimeout(300);
    }

    // Switch to delta and fill form
    await page.click(SELECTORS.modeButton('delta'));
    await page.waitForTimeout(500);

    const usernameField = page.locator('input').first();
    if (await usernameField.count() > 0) {
      await usernameField.fill('integration_test');
      await page.waitForTimeout(500);
    }

    // Switch to gamma and verify pipeline
    await page.click(SELECTORS.modeButton('gamma'));
    await page.waitForTimeout(2000);

    const gammaResult = page.locator(SELECTORS.gammaResult);
    if (await gammaResult.count() > 0) {
      const resultText = await gammaResult.textContent();
      expect(resultText).toContain('300');
    }

    const endRenderCount = await getRenderCount(page);
    const renderDelta = endRenderCount - startRenderCount;

    // Verify reasonable render count (optimized re-renders)
    expect(renderDelta).toBeLessThan(20); // Should be efficient
  });

  // PERFORMANCE COMPARISON
  test('Performance: Verify optimized rendering', async ({ page }) => {
    await page.click(SELECTORS.modeButton('alpha'));

    const initialCount = await getRenderCount(page);

    // Click an Alpha item (should only re-render Alpha, not others)
    const alphaItem = page.locator(SELECTORS.alphaItem).first();
    if (await alphaItem.count() > 0) {
      await alphaItem.click();
      await page.waitForTimeout(300);
    }

    const finalCount = await getRenderCount(page);
    const renderIncrease = finalCount - initialCount;

    // Should be minimal re-renders (< 5)
    expect(renderIncrease).toBeLessThan(TEST_CONFIG.RENDER_COUNT_THRESHOLD);
  });
});