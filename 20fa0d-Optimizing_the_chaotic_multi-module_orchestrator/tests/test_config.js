/**
 * Shared Test Configuration
 * Used by both test_before.spec.js and test_after.spec.js
 */

export const TEST_CONFIG = {
  // Server URLs
  BEFORE_URL: 'http://localhost:5174',
  AFTER_URL: 'http://localhost:5173',

  // Timeouts
  TIMEOUT_SHORT: 3000,
  TIMEOUT_MEDIUM: 5000,
  TIMEOUT_LONG: 10000,

  // Debounce delays
  DEBOUNCE_BEFORE: 0,      // Original had 0ms (bad)
  DEBOUNCE_AFTER: 300,     // Refactored has 300ms (good)

  // Test data
  ALPHA_DATA: [
    {
      id: 101,
      status: "Active",
      priority: "High",
      user: "Admin",
      _internal: "hidden",
    },
    { id: 102, status: "Pending", priority: "Low", user: "Guest" },
  ],

  TREE_ITEMS: [
    {
      id: 1,
      label: "System Core",
      children: [
        {
          id: 2,
          label: "Sub-Module A",
          children: [{ id: 3, label: "Node.js Environment" }],
        },
        { id: 4, label: "Sub-Module B" },
      ],
    },
    {
      id: 5,
      label: "Cloud Services",
      children: [{ id: 6, label: "AWS Lambda" }],
    },
  ],

  // Expected results
  GAMMA_EXPECTED_RESULT: 300, // (2+4+6+8+10)*10 = 300

  // Modes to test
  MODES: ['full', 'alpha', 'beta', 'gamma', 'delta', 'mixed'],

  // Performance thresholds
  MEMORY_LEAK_THRESHOLD_MB: 500, // Max acceptable memory growth
  RENDER_COUNT_THRESHOLD: 5,     // Max acceptable re-renders for simple update
};

export const SELECTORS = {
  // Mode buttons
  modeButton: (mode) => `button:has-text("${mode}")`,

  // Component sections
  header: '.chaotic-header, header',
  alphaSection: '.chaotic-alpha-section, .sub-alpha',
  betaSection: '.chaotic-beta-section, .sub-beta',
  gammaSection: '.chaotic-gamma-section, .sub-gamma',
  deltaSection: '.chaotic-delta-section, .sub-delta',
  debugSection: '.chaotic-debug, footer',

  // Alpha module
  alphaNode: '[data-idx]',
  alphaItem: 'span[data-idx]',

  // Beta module
  treeNode: '.sub-beta > div',
  expandableNode: '[style*="cursor: pointer"]',

  // Gamma module
  gammaLoading: '.gamma-loading',
  gammaResult: '.gamma-result',
  gammaError: '.gamma-error',

  // Delta module
  deltaForm: '.delta-form',
  deltaField: '.delta-field input',
  deltaError: '.delta-error',
  deltaHistory: '.delta-history',

  // Debug info
  cacheInfo: 'text=/CACHE|Cache/',
  flagInfo: 'text=/FLAG|Flags/',
  renderInfo: 'text=/TICK|Renders/',
  syncCounter: 'text=/SIG_Q|Sync/',
};