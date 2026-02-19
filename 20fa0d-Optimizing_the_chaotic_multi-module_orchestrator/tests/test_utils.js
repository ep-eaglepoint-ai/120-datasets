/**
 * Shared Test Utilities
 * Helper functions used across all tests
 */

export async function waitForElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

export async function getMemoryUsage(page) {
  return await page.evaluate(() => {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize / 1048576,
        totalJSHeapSize: performance.memory.totalJSHeapSize / 1048576,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit / 1048576,
      };
    }
    return null;
  });
}

export async function monitorMemoryGrowth(page, duration = 5000, samples = 5) {
  const measurements = [];
  const interval = duration / samples;
  
  for (let i = 0; i < samples; i++) {
    const memory = await getMemoryUsage(page);
    if (memory) {
      measurements.push(memory.usedJSHeapSize);
    }
    if (i < samples - 1) {
      await page.waitForTimeout(interval);
    }
  }
  
  return {
    measurements,
    initial: measurements[0],
    final: measurements[measurements.length - 1],
    growth: measurements[measurements.length - 1] - measurements[0],
    average: measurements.reduce((a, b) => a + b) / measurements.length,
  };
}

export async function getRenderCount(page) {
  return await page.evaluate(() => {
    const debugSection = document.querySelector('.chaotic-debug, footer');
    if (!debugSection) return null;
    const text = debugSection.textContent;
    const match = text.match(/(?:TICK_COUNT|Renders):\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  });
}

export async function getSyncCounter(page) {
  return await page.evaluate(() => {
    const text = document.body.textContent;
    const match = text.match(/(?:SIG_Q|Sync|Q):\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  });
}

export async function checkSourceCode(filePath, pattern) {
  const fs = await import('fs/promises');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return pattern.test(content);
  } catch (error) {
    console.error('Error reading file:', error.message);
    return false;
  }
}

export async function countPatternInSource(filePath, pattern) {
  const fs = await import('fs/promises');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  } catch (error) {
    return 0;
  }
}

export async function waitForConsoleMessage(page, pattern, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for console message'));
    }, timeout);
    
    const handler = (msg) => {
      if (pattern.test(msg.text())) {
        clearTimeout(timer);
        page.off('console', handler);
        resolve(msg.text());
      }
    };
    
    page.on('console', handler);
  });
}

export async function clickAndWaitForLog(page, selector, logPattern) {
  const consolePromise = waitForConsoleMessage(page, logPattern);
  await page.click(selector);
  return await consolePromise;
}

export async function elementExists(page, selector) {
  return (await page.$(selector)) !== null;
}

export function captureConsoleMessages(page, type = 'log') {
  const messages = [];
  page.on('console', msg => {
    if (msg.type() === type) {
      messages.push(msg.text());
    }
  });
  return messages;
}

export async function rapidModeSwitching(page, modes, iterations = 10) {
  for (let i = 0; i < iterations; i++) {
    const mode = modes[i % modes.length];
    await page.click('button:has-text("' + mode + '")');
    await page.waitForTimeout(100);
  }
}

export async function getPerformanceMetrics(page) {
  return await page.evaluate(() => {
    const perfData = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
      loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
      domInteractive: perfData.domInteractive - perfData.fetchStart,
    };
  });
}
