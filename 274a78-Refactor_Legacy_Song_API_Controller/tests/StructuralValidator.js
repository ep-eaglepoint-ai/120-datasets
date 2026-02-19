const fs = require('fs');
const BaseValidator = require('./BaseValidator');

/**
 * Structural Validator
 * Covers Requirements 1, 2, 15, 16
 * - Service Layer existence
 * - No direct Mongoose in Controller
 * - Naming conventions
 * - Dependencies
 */
class StructuralValidator extends BaseValidator {
  run() {
    this.loadFiles();
    
    // REQ-1: Service Layer
    this.testServiceLayerExists();
    this.testServiceLayerHasAllMethods();

    // REQ-2: Separation of Concerns
    this.testNoDirectMongooseInController();
    this.testControllerDelegatesToService();

    // REQ-15: Naming Conventions
    this.testCamelCaseNaming();
    this.testNoSnakeCaseOrPascalCase();

    // REQ-16: Dependencies
    this.testNoNewDependencies();
    this.testServiceLayerHasNoDependencies();

    return this.results;
  }

  // ============================================================================
  // REQUIREMENT 1: Introduce a dedicated service layer
  // ============================================================================
  
  testServiceLayerExists() {
    const serviceExists = fs.existsSync(this.servicePath);
    const hasServiceClass = this.serviceContent.includes('class SongService');
    const hasConstructor = this.serviceContent.includes('constructor(');
    
    return this.test(
      1,
      'Service Layer Exists',
      serviceExists && hasServiceClass && hasConstructor,
      'FAIL: No dedicated service layer found (SongService.js with class SongService)'
    );
  }

  testServiceLayerHasAllMethods() {
    const requiredMethods = [
      'createSong',
      'getSongs',
      'updateSong',
      'deleteSong',
      'getTotal'
    ];
    
    const allMethodsExist = requiredMethods.every(method => 
      this.serviceContent.includes(`async ${method}(`) || 
      this.serviceContent.includes(`${method}(`)
    );
    
    return this.test(
      1,
      'Service Layer Contains All Required Methods',
      allMethodsExist,
      `FAIL: Service layer missing required methods: ${requiredMethods.join(', ')}`
    );
  }

  // ============================================================================
  // REQUIREMENT 2: Remove all direct Mongoose queries from controller
  // ============================================================================
  
  testNoDirectMongooseInController() {
    const mongoosePatterns = [
      /Song\.find\(/g,
      /Song\.findById\(/g,
      /Song\.findByIdAndUpdate\(/g,
      /Song\.findByIdAndDelete\(/g,
      /Song\.aggregate\(/g,
      /Song\.insertMany\(/g,
      /Song\.deleteMany\(/g,
      /Song\.countDocuments\(/g,
      /new Song\(/g,
      /\.save\(\)/g
    ];
    
    const violations = mongoosePatterns.filter(pattern => 
      pattern.test(this.controllerContent)
    );
    
    return this.test(
      2,
      'No Direct Mongoose Calls in Controller',
      violations.length === 0,
      `FAIL: Controller contains ${violations.length} direct Mongoose model calls`
    );
  }

  testControllerDelegatesToService() {
    const endpoints = ['createSong', 'getSongs', 'updateSong', 'deleteSong', 'getTotal'];
    const allDelegate = endpoints.every(endpoint => {
      const endpointRegex = new RegExp(`${endpoint}:[\\s\\S]*?songService\\.${endpoint}`, 'g');
      return endpointRegex.test(this.controllerContent);
    });
    
    return this.test(
      2,
      'Controller Delegates All Operations to Service',
      allDelegate,
      'FAIL: Not all controller methods delegate to service layer'
    );
  }

  // ============================================================================
  // REQUIREMENT 15: Apply consistent camelCase naming
  // ============================================================================
  
  testCamelCaseNaming() {
    const hasOldNaming = /NumberofAlbum/g.test(this.controllerContent) || 
                        /NumberofAlbum/g.test(this.serviceContent);
    const hasNewNaming = /numberOfAlbums/g.test(this.serviceContent);
    
    return this.test(
      15,
      'Consistent camelCase Naming',
      !hasOldNaming && (this.serviceContent ? hasNewNaming : false),
      'FAIL: Inconsistent naming (NumberofAlbum should be numberOfAlbums)'
    );
  }

  testNoSnakeCaseOrPascalCase() {
    // Check for common naming violations
    const hasSnakeCase = /[a-z]+_[a-z]+/g.test(this.controllerContent) ||
                        /[a-z]+_[a-z]+/g.test(this.serviceContent);
    
    return this.test(
      15,
      'No snake_case in Variable Names',
      !hasSnakeCase,
      'FAIL: Found snake_case naming (should use camelCase)'
    );
  }

  // ============================================================================
  // REQUIREMENT 16: Avoid introducing new external dependencies
  // ============================================================================
  
  testNoNewDependencies() {
    const allowedRequires = ['mongoose', 'db', 'SongService', '../utils/db', './SongService'];
    const requires = [...this.controllerContent.matchAll(/require\(['"]([^'"]+)['"]\)/g)];
    const allAllowed = requires.every(match => {
      const dep = match[1];
      return allowedRequires.some(allowed => dep.includes(allowed)) || dep.startsWith('.');
    });
    
    return this.test(
      16,
      'No New External Dependencies',
      allAllowed,
      'FAIL: New external dependencies added (should only use existing packages)'
    );
  }

  testServiceLayerHasNoDependencies() {
    if (!this.serviceContent) return true;
    
    const serviceRequires = [...this.serviceContent.matchAll(/require\(['"]([^'"]+)['"]\)/g)];
    const onlyMongoose = serviceRequires.every(match => 
      match[1] === 'mongoose' || match[1].startsWith('.')
    );
    
    return this.test(
      16,
      'Service Layer Uses Only Mongoose',
      onlyMongoose,
      'FAIL: Service layer should only require mongoose (no additional dependencies)'
    );
  }
}

module.exports = StructuralValidator;
