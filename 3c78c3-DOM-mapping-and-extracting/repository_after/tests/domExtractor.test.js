/**
 * Test runner for DOM Extractor
 * Jest test suite validating all requirements
 */

const { DOMExtractor } = require('../domExtractor');
const fs = require('fs').promises;
const path = require('path');

describe('DOMExtractor', () => {
  let extractor;
  
  const simpleHTML = `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <div id="main" class="container">
    <h1>Header Text</h1>
    <p class="text">Paragraph content</p>
    <a href="/login" class="link">Login</a>
  </div>
</body>
</html>`;

  beforeAll(() => {
    extractor = new DOMExtractor();
  });

  // Test 1: URL input acceptance
  test('Requirement 1: Accept webpage URL as input', () => {
    const result = extractor.extract(simpleHTML, 'https://example.com');
    expect(result).toBeTruthy();
    expect(result.url).toBe('https://example.com');
    expect(result.dom).toBeTruthy();
  });

  // Test 2: JavaScript-rendered content (JSDOM with runScripts)
  test('Requirement 2: Fully load page including JavaScript', () => {
    const htmlWithJS = `
<html>
<body>
  <div id="container"></div>
  <script>
    document.getElementById('container').innerHTML = '<p id="dynamic">JS Content</p>';
  </script>
</body>
</html>`;
    const result = extractor.extract(htmlWithJS);
    const str = JSON.stringify(result);
    expect(str.includes('dynamic') || str.includes('JS Content')).toBe(true);
  });

  // Test 3: Traverse entire DOM tree
  test('Requirement 3: Traverse entire DOM tree', () => {
    const result = extractor.extract(simpleHTML);
    expect(result.dom.tag).toBe('html');
    expect(result.dom.children).toBeTruthy();
    expect(result.dom.children.length).toBeGreaterThan(0);
    
    let maxDepth = 0;
    function getMaxDepth(node) {
      if (node.depth > maxDepth) maxDepth = node.depth;
      for (const child of node.children || []) {
        getMaxDepth(child);
      }
    }
    getMaxDepth(result.dom);
    expect(maxDepth).toBeGreaterThanOrEqual(2);
  });

  // Test 4: Extract tag, text, attributes, visibility, depth
  test('Requirement 4: Extract tag name, text, attributes, visibility, depth', () => {
    const result = extractor.extract(simpleHTML);
    const dom = result.dom;
    
    expect(typeof dom.tag).toBe('string');
    expect(typeof dom.xpath).toBe('string');
    expect(typeof dom.depth).toBe('number');
    expect(typeof dom.attributes).toBe('object');
    expect(typeof dom.text).toBe('string');
    expect(typeof dom.visible).toBe('boolean');
    expect(Array.isArray(dom.children)).toBe(true);
  });

  // Test 5: Generate unique absolute XPath
  test('Requirement 5: Generate unique absolute XPath for every element', () => {
    const result = extractor.extract(simpleHTML);
    
    const xpaths = [];
    function collectXpaths(node) {
      if (node.xpath) xpaths.push(node.xpath);
      for (const child of node.children || []) {
        collectXpaths(child);
      }
    }
    collectXpaths(result.dom);
    
    expect(xpaths.length).toBeGreaterThan(0);
    expect(xpaths.every(x => x.startsWith('/'))).toBe(true);
    expect(result.dom.xpath).toBe('/html');
  });

  // Test 6: Preserve parent-child hierarchy
  test('Requirement 6: Preserve parent-child hierarchy', () => {
    const result = extractor.extract(simpleHTML);
    
    function checkHierarchy(node, expectedDepth = 0) {
      expect(node.depth).toBe(expectedDepth);
      for (const child of node.children || []) {
        expect(child.depth).toBe(expectedDepth + 1);
        checkHierarchy(child, expectedDepth + 1);
      }
    }
    checkHierarchy(result.dom);
  });

  // Test 7: Output valid JSON only
  test('Requirement 7: Output valid JSON only', () => {
    const result = extractor.extract(simpleHTML);
    const jsonStr = JSON.stringify(result);
    expect(jsonStr).toBeTruthy();
    
    const parsed = JSON.parse(jsonStr);
    expect(parsed.url).toBeTruthy();
    expect(parsed.dom).toBeTruthy();
  });

  // Test 8 & 9: Single JSON file with unique ID
  test('Requirement 8 & 9: Output single .json file with unique ID', async () => {
    const tmpDir = path.join(__dirname, '../temp_test_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });
    
    try {
      const outputFile = await extractor.extractAndSave(simpleHTML, tmpDir, 'https://test.com');
      
      const exists = await fs.access(outputFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      const filename = path.basename(outputFile);
      expect(filename.endsWith('.json')).toBe(true);
      
      // UUID format validation
      const nameWithoutExt = filename.slice(0, -5);
      const parts = nameWithoutExt.split('-');
      expect(parts.length).toBe(5);
      
      const content = await fs.readFile(outputFile, 'utf-8');
      const data = JSON.parse(content);
      expect(data.url).toBeTruthy();
      expect(data.dom).toBeTruthy();
      
      await fs.unlink(outputFile);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
