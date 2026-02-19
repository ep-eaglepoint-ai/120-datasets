const fs = require('fs');
const path = require('path');

/**
 * Base Validator Class
 * Shared logic for file loading and result tracking.
 */
class BaseValidator {
  constructor(repositoryPath) {
    this.repositoryPath = repositoryPath;
    this.controllerPath = path.join(repositoryPath, 'SongController.js');
    this.servicePath = path.join(repositoryPath, 'SongService.js');
    this.controllerContent = '';
    this.serviceContent = '';
    this.results = [];
  }

  loadFiles() {
    try {
      this.controllerContent = fs.readFileSync(this.controllerPath, 'utf8');
      if (fs.existsSync(this.servicePath)) {
        this.serviceContent = fs.readFileSync(this.servicePath, 'utf8');
      }
    } catch (err) {
      // It's okay if service doesn't exist for legacy code, but controller is required
      if (err.code !== 'ENOENT' || !err.path.includes('SongService.js')) {
        throw new Error(`Failed to load files: ${err.message}`);
      }
    }
  }

  test(requirementNum, name, condition, message) {
    const passed = condition;
    const testName = requirementNum === 'BONUS' 
      ? `[BONUS] ${name}` 
      : `[REQ-${requirementNum}] ${name}`;
      
    this.results.push({ 
      requirementNum,
      name: testName, 
      passed, 
      message: passed ? 'PASS' : message 
    });
    return passed;
  }

  getResults() {
    return this.results;
  }
}

module.exports = BaseValidator;
