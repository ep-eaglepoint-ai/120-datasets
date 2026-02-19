/**
 * DOM Extractor - Complete webpage DOM structure extraction system
 * Extracts full DOM tree with XPath, attributes, visibility, and hierarchy preservation
 */

const { JSDOM } = require('jsdom');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DOMExtractor {
  /**
   * Generate unique absolute XPath for an element
   */
  _getXPath(element) {
    if (!element || element.nodeType !== 1) return '';
    if (element === element.ownerDocument.documentElement) return '/html';
    
    let xpath = '';
    let current = element;
    
    while (current && current.nodeType === 1 && current !== current.ownerDocument.documentElement) {
      let index = 1;
      let sibling = current.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      xpath = `/${tagName}[${index}]${xpath}`;
      current = current.parentNode;
    }
    
    return '/html' + xpath;
  }

  /**
   * Check if element is visible
   */
  _isVisible(element) {
    if (!element.style) return true;
    
    const style = element.style;
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    
    return true;
  }

  /**
   * Get direct text content of element (not including children)
   */
  _getElementText(element) {
    let text = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 3) { // TEXT_NODE
        text += node.textContent;
      }
    }
    return text.trim();
  }

  /**
   * Get all attributes of an element
   */
  _getAttributes(element) {
    const attributes = {};
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attributes[attr.name] = attr.value;
      }
    }
    return attributes;
  }

  /**
   * Extract complete information for a single element recursively
   */
  _extractElement(element, depth = 0) {
    if (!element || element.nodeType !== 1) return null;
    
    const tag = element.tagName.toLowerCase();
    const xpath = this._getXPath(element);
    const attributes = this._getAttributes(element);
    const text = this._getElementText(element);
    const visible = this._isVisible(element);
    
    const children = [];
    for (let i = 0; i < element.children.length; i++) {
      const childData = this._extractElement(element.children[i], depth + 1);
      if (childData) {
        children.push(childData);
      }
    }
    
    return {
      tag,
      xpath,
      depth,
      attributes,
      text,
      visible,
      children,
    };
  }

  /**
   * Extract complete DOM structure from HTML string
   */
  extract(html, url = 'html-string') {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const document = dom.window.document;
    const root = document.documentElement;
    
    const domStructure = this._extractElement(root, 0);
    
    return {
      url,
      dom: domStructure,
    };
  }

  /**
   * Extract DOM from file path
   */
  async extractFromFile(filePath) {
    const html = await fs.readFile(filePath, 'utf-8');
    return this.extract(html, `file://${filePath}`);
  }

  /**
   * Extract DOM and save to a JSON file with unique ID
   */
  async extractAndSave(html, outputDir = '.', url = 'html-string') {
    const domData = this.extract(html, url);
    
    const uniqueId = uuidv4();
    const filename = `${uniqueId}.json`;
    const filepath = path.join(outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(domData, null, 2), 'utf-8');
    
    return filepath;
  }
}

module.exports = { DOMExtractor };
