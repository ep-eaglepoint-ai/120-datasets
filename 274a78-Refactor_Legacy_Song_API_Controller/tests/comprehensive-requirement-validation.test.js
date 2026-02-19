const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Requirement Validation Suite
 * 
 * This test suite validates the Song API Controller refactor against
 * all 16 requirements from the test-driven refactor specification.
 * 
 * Each test is mapped to specific requirement(s) and includes:
 * - Requirement number and description
 * - Static code analysis
 * - Pattern matching for best practices
 * - Edge case validation
 */
class ComprehensiveRequirementValidator {
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
      throw new Error(`Failed to load files: ${err.message}`);
    }
  }

  test(requirementNum, name, condition, message) {
    const passed = condition;
    const testName = `[REQ-${requirementNum}] ${name}`;
    this.results.push({ 
      requirementNum,
      name: testName, 
      passed, 
      message: passed ? 'PASS' : message 
    });
    return passed;
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
  // REQUIREMENT 3: Standardize API response format to { message, data }
  // ============================================================================
  
  testStandardizedResponseFormat() {
    // Check for old non-standard formats
    const hasOldFormats = 
      this.controllerContent.includes("'Recorded Successfully!'") ||
      this.controllerContent.includes("'Song updated successfully!'") ||
      this.controllerContent.includes("'Song deleted successfully!'");
    
    // Check for new standard format
    const hasStandardFormat = /message:\s*['"]/g.test(this.controllerContent) &&
                              /data:\s*/g.test(this.controllerContent);
    
    return this.test(
      3,
      'Standardized Response Format { message, data }',
      !hasOldFormats && hasStandardFormat,
      'FAIL: Responses not standardized to { message, data } format'
    );
  }

  testAllSuccessResponsesHaveMessageAndData() {
    // Extract all .json() calls with status 200 or 201
    const jsonResponses = this.controllerContent.match(/\.json\(\{[^}]+\}\)/g) || [];
    const validResponses = jsonResponses.filter(resp => 
      resp.includes('message') && resp.includes('data')
    );
    
    // Should have at least 5 valid responses (create, get, update, getTotal, etc.)
    return this.test(
      3,
      'All Success Responses Include message and data',
      validResponses.length >= 5,
      `FAIL: Only ${validResponses.length} responses follow standard format`
    );
  }

  // ============================================================================
  // REQUIREMENT 4: Implement consistent error handling
  // ============================================================================
  
  testConsistentErrorHandling() {
    const errorResponses = this.controllerContent.match(/\.status\((400|404|500)\)\.json\([^)]+\)/g) || [];
    const allHaveMessage = errorResponses.every(resp => resp.includes('message'));
    const noErrorKey = !this.controllerContent.includes('{ error:');
    
    return this.test(
      4,
      'Consistent Error Handling Format',
      allHaveMessage && noErrorKey,
      'FAIL: Error responses use inconsistent format (should use "message" not "error")'
    );
  }

  testAllErrorResponsesHaveDataNull() {
    const errorResponses = this.controllerContent.match(/\.status\((400|404|500)\)\.json\([^)]+\)/g) || [];
    const allHaveDataNull = errorResponses.every(resp => 
      resp.includes('data: null') || resp.includes('data:null')
    );
    
    return this.test(
      4,
      'All Error Responses Include data: null',
      allHaveDataNull,
      'FAIL: Error responses should include "data: null"'
    );
  }

  // ============================================================================
  // REQUIREMENT 5: Validate MongoDB ObjectIds
  // ============================================================================
  
  testObjectIdValidation() {
    const updateHasValidation = /updateSong:[\s\S]*?(validateObjectId\(id\)|isValid\(id\))/g.test(this.controllerContent);
    const deleteHasValidation = /deleteSong:[\s\S]*?(validateObjectId\(id\)|isValid\(id\))/g.test(this.controllerContent);
    
    return this.test(
      5,
      'ObjectId Validation in ID Operations',
      updateHasValidation && deleteHasValidation,
      'FAIL: Missing ObjectId validation in update/delete operations'
    );
  }

  testObjectIdValidationBeforeServiceCall() {
    // Ensure validation happens BEFORE service call
    const updatePattern = /updateSong:[\s\S]*?validateObjectId[\s\S]*?songService\.updateSong/g;
    const deletePattern = /deleteSong:[\s\S]*?validateObjectId[\s\S]*?songService\.deleteSong/g;
    
    const updateValid = updatePattern.test(this.controllerContent);
    const deleteValid = deletePattern.test(this.controllerContent);
    
    return this.test(
      5,
      'ObjectId Validated Before Service Layer Call',
      updateValid && deleteValid,
      'FAIL: ObjectId validation must occur before calling service layer'
    );
  }

  // ============================================================================
  // REQUIREMENT 6: Refactor update operations for safe partial updates
  // ============================================================================
  
  testSafePartialUpdates() {
    const hasFilterLogic = this.serviceContent.includes('filter') && 
                          this.serviceContent.includes('undefined');
    
    return this.test(
      6,
      'Safe Partial Updates (Filter Undefined)',
      hasFilterLogic,
      'FAIL: updateSong does not filter undefined values for safe partial updates'
    );
  }

  testUpdateDoesNotAcceptUnknownFields() {
    // Check that update extracts specific fields, not accepting arbitrary data
    const hasFieldExtraction = /const\s*\{\s*title,\s*artist,\s*album,\s*genre\s*\}/g.test(this.controllerContent);
    
    return this.test(
      6,
      'Update Extracts Only Known Fields',
      hasFieldExtraction,
      'FAIL: Update should extract only known fields (title, artist, album, genre)'
    );
  }

  // ============================================================================
  // REQUIREMENT 7: Return 404 when resource not found
  // ============================================================================
  
  test404OnMissingResource() {
    const updateHas404 = /updateSong:[\s\S]*?404/g.test(this.controllerContent);
    const deleteHas404 = /deleteSong:[\s\S]*?404/g.test(this.controllerContent);
    
    return this.test(
      7,
      '404 for Missing Resources',
      updateHas404 && deleteHas404,
      'FAIL: Missing 404 responses when resource not found'
    );
  }

  test404ChecksServiceResult() {
    // Ensure 404 is returned by checking if service returns null/undefined
    const updateChecksResult = /updateSong:[\s\S]*?if\s*\(\s*!.*?\)[\s\S]*?404/g.test(this.controllerContent);
    const deleteChecksResult = /deleteSong:[\s\S]*?if\s*\(\s*!.*?\)[\s\S]*?404/g.test(this.controllerContent);
    
    return this.test(
      7,
      '404 Response Based on Service Result Check',
      updateChecksResult && deleteChecksResult,
      'FAIL: Should check service result and return 404 if null/undefined'
    );
  }

  // ============================================================================
  // REQUIREMENT 8: Enforce schema validation during updates
  // ============================================================================
  
  testSchemaValidation() {
    const hasRunValidators = this.serviceContent.includes('runValidators: true');
    
    return this.test(
      8,
      'Schema Validation on Updates (runValidators: true)',
      hasRunValidators,
      'FAIL: Updates do not enforce schema validation (missing runValidators: true)'
    );
  }

  testUpdateReturnsNewDocument() {
    const hasNewTrue = this.serviceContent.includes('new: true');
    
    return this.test(
      8,
      'Update Returns New Document (new: true)',
      hasNewTrue,
      'FAIL: Update should return new document (missing new: true)'
    );
  }

  // ============================================================================
  // REQUIREMENT 9: Follow REST conventions for delete operations
  // ============================================================================
  
  testRESTDeleteConvention() {
    const deleteMatch = this.controllerContent.match(/deleteSong:[\s\S]*?res\.status\(204\)\.([^;]+)/);
    const uses204 = deleteMatch !== null;
    const usesSend = deleteMatch && deleteMatch[1].includes('send()');
    
    return this.test(
      9,
      'REST Delete Convention (204 No Content)',
      uses204 && usesSend,
      'FAIL: Delete does not follow REST convention (should return 204 with .send())'
    );
  }

  // ============================================================================
  // REQUIREMENT 10: Prevent response body with 204 status
  // ============================================================================
  
  testNo204Body() {
    const has204WithJson = /status\(204\)\.json\(/g.test(this.controllerContent);
    
    return this.test(
      10,
      'No Response Body with 204 Status',
      !has204WithJson,
      'FAIL: 204 response includes body (should use .send() not .json())'
    );
  }

  // ============================================================================
  // REQUIREMENT 11: Add pagination support to getSongs
  // ============================================================================
  
  testPaginationSupport() {
    const controllerHasPagination = /page|limit/gi.test(this.controllerContent);
    const serviceHasPagination = /skip|limit/gi.test(this.serviceContent);
    
    return this.test(
      11,
      'Pagination Support (page, limit)',
      controllerHasPagination && serviceHasPagination,
      'FAIL: getSongs does not support pagination (missing page/limit parameters)'
    );
  }

  testPaginationUsesSkipAndLimit() {
    const hasSkip = /skip\(/g.test(this.serviceContent);
    const hasLimit = /limit\(/g.test(this.serviceContent);
    
    return this.test(
      11,
      'Pagination Uses skip() and limit()',
      hasSkip && hasLimit,
      'FAIL: Pagination should use .skip() and .limit() methods'
    );
  }

  // ============================================================================
  // REQUIREMENT 12: Include pagination metadata
  // ============================================================================
  
  testPaginationMetadata() {
    const hasMetadata = /totalPages|pagination/gi.test(this.serviceContent);
    const hasTotal = /total|countDocuments/gi.test(this.serviceContent);
    
    return this.test(
      12,
      'Pagination Metadata (total, totalPages)',
      hasMetadata && hasTotal,
      'FAIL: Pagination response missing metadata (total, totalPages, etc.)'
    );
  }

  testPaginationReturnsAllFields() {
    // Check for all required pagination fields
    const requiredFields = ['total', 'page', 'limit', 'totalPages'];
    const allFieldsPresent = requiredFields.every(field => 
      this.serviceContent.includes(field)
    );
    
    return this.test(
      12,
      'Pagination Includes All Metadata Fields',
      allFieldsPresent,
      'FAIL: Pagination metadata should include: total, page, limit, totalPages'
    );
  }

  // ============================================================================
  // REQUIREMENT 13: Return zero values for empty dataset
  // ============================================================================
  
  testZeroValuesForEmpty() {
    const hasDefaultValues = /totalSongs:\s*0|length\s*>\s*0/g.test(this.serviceContent);
    const hasFallback = /statistics\.length|:\s*\{.*?:\s*0/g.test(this.serviceContent);
    
    return this.test(
      13,
      'Zero Values for Empty Dataset',
      hasDefaultValues && hasFallback,
      'FAIL: getTotal does not return zero values for empty database'
    );
  }

  testGetTotalNeverReturnsUndefined() {
    // Check for ternary or conditional that prevents undefined
    const hasSafeReturn = /statistics\.length\s*>\s*0\s*\?|statistics\[0\]\s*\|\|/g.test(this.serviceContent);
    
    return this.test(
      13,
      'getTotal Never Returns Undefined',
      hasSafeReturn,
      'FAIL: getTotal should have fallback to prevent returning undefined'
    );
  }

  // ============================================================================
  // REQUIREMENT 14: Eliminate duplicated validation and response logic
  // ============================================================================
  
  testNoDuplicatedLogic() {
    const validationCount = (this.controllerContent.match(/validateObjectId|isValid/g) || []).length;
    const hasHelper = /validateObjectId\s*=/g.test(this.controllerContent);
    
    return this.test(
      14,
      'No Duplicated Validation Logic (Uses Helper)',
      hasHelper && validationCount >= 2,
      'FAIL: Validation logic should use reusable helper function'
    );
  }

  testNoResponseFormattingDuplication() {
    // Check that response formatting isn't duplicated (should be consistent)
    const messageDataPattern = /\{\s*message:.*?,\s*data:/g;
    const matches = this.controllerContent.match(messageDataPattern) || [];
    
    // Should have multiple consistent uses (not duplicated logic, but consistent pattern)
    return this.test(
      14,
      'Consistent Response Formatting Pattern',
      matches.length >= 5,
      'FAIL: Response formatting should be consistent across all endpoints'
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

  // ============================================================================
  // ADDITIONAL RIGOROUS TESTS
  // ============================================================================

  testControllerIsStateless() {
    // Controller should not maintain state
    const hasClassState = /this\.[a-z]/gi.test(this.controllerContent);
    
    return this.test(
      'BONUS',
      'Controller is Stateless (No instance variables)',
      !hasClassState,
      'FAIL: Controller should be stateless (avoid instance variables)'
    );
  }

  testServiceLayerUsesAsyncAwait() {
    const asyncMethods = this.serviceContent.match(/async\s+\w+\(/g) || [];
    
    return this.test(
      'BONUS',
      'Service Layer Uses async/await',
      asyncMethods.length >= 5,
      'FAIL: Service layer methods should use async/await for database operations'
    );
  }

  testNoConsoleLogsInProduction() {
    // console.error is acceptable, but console.log should be avoided
    const hasConsoleLogs = /console\.log\(/g.test(this.controllerContent) ||
                          /console\.log\(/g.test(this.serviceContent);
    
    return this.test(
      'BONUS',
      'No console.log in Code (console.error is OK)',
      !hasConsoleLogs,
      'WARNING: Found console.log statements (use console.error for errors)'
    );
  }

  testAllEndpointsHaveTryCatch() {
    const endpoints = ['createSong', 'getSongs', 'updateSong', 'deleteSong', 'getTotal'];
    const allHaveTryCatch = endpoints.every(endpoint => {
      const endpointRegex = new RegExp(`${endpoint}:[\\s\\S]*?try[\\s\\S]*?catch`, 'g');
      return endpointRegex.test(this.controllerContent);
    });
    
    return this.test(
      'BONUS',
      'All Endpoints Have try/catch Blocks',
      allHaveTryCatch,
      'FAIL: All async endpoints should have try/catch error handling'
    );
  }

  // ============================================================================
  // TEST EXECUTION
  // ============================================================================

  runAll() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${this.repositoryPath}`);
    console.log('='.repeat(70));

    this.loadFiles();

    // Requirement 1
    this.testServiceLayerExists();
    this.testServiceLayerHasAllMethods();

    // Requirement 2
    this.testNoDirectMongooseInController();
    this.testControllerDelegatesToService();

    // Requirement 3
    this.testStandardizedResponseFormat();
    this.testAllSuccessResponsesHaveMessageAndData();

    // Requirement 4
    this.testConsistentErrorHandling();
    this.testAllErrorResponsesHaveDataNull();

    // Requirement 5
    this.testObjectIdValidation();
    this.testObjectIdValidationBeforeServiceCall();

    // Requirement 6
    this.testSafePartialUpdates();
    this.testUpdateDoesNotAcceptUnknownFields();

    // Requirement 7
    this.test404OnMissingResource();
    this.test404ChecksServiceResult();

    // Requirement 8
    this.testSchemaValidation();
    this.testUpdateReturnsNewDocument();

    // Requirement 9
    this.testRESTDeleteConvention();

    // Requirement 10
    this.testNo204Body();

    // Requirement 11
    this.testPaginationSupport();
    this.testPaginationUsesSkipAndLimit();

    // Requirement 12
    this.testPaginationMetadata();
    this.testPaginationReturnsAllFields();

    // Requirement 13
    this.testZeroValuesForEmpty();
    this.testGetTotalNeverReturnsUndefined();

    // Requirement 14
    this.testNoDuplicatedLogic();
    this.testNoResponseFormattingDuplication();

    // Requirement 15
    this.testCamelCaseNaming();
    this.testNoSnakeCaseOrPascalCase();

    // Requirement 16
    this.testNoNewDependencies();
    this.testServiceLayerHasNoDependencies();

    // Bonus rigorous tests
    this.testControllerIsStateless();
    this.testServiceLayerUsesAsyncAwait();
    this.testNoConsoleLogsInProduction();
    this.testAllEndpointsHaveTryCatch();

    return this.results;
  }

  printResults() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    // Group by requirement
    const byRequirement = {};
    this.results.forEach(result => {
      const req = result.requirementNum || 'BONUS';
      if (!byRequirement[req]) {
        byRequirement[req] = [];
      }
      byRequirement[req].push(result);
    });

    console.log('\nTest Results by Requirement:');
    console.log('-'.repeat(70));

    Object.keys(byRequirement).sort((a, b) => {
      if (a === 'BONUS') return 1;
      if (b === 'BONUS') return -1;
      return parseInt(a) - parseInt(b);
    }).forEach(req => {
      const tests = byRequirement[req];
      const reqPassed = tests.filter(t => t.passed).length;
      const reqTotal = tests.length;
      const reqStatus = reqPassed === reqTotal ? '✅' : '❌';
      
      console.log(`\n${reqStatus} Requirement ${req}: ${reqPassed}/${reqTotal} tests passed`);
      
      tests.forEach(result => {
        const status = result.passed ? '  ✓' : '  ✗';
        const color = result.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`${color}${status}\x1b[0m ${result.name}`);
        if (!result.passed) {
          console.log(`     ${result.message}`);
        }
      });
    });

    console.log('\n' + '-'.repeat(70));
    console.log(`Overall Score: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
    console.log('='.repeat(70));

    return { passed, total, success: passed === total };
  }
}

// Run tests if executed directly
if (require.main === module) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPREHENSIVE REQUIREMENT VALIDATION SUITE');
  console.log('Testing against 16 requirements + bonus rigorous tests');
  console.log('='.repeat(70));

  const beforeValidator = new ComprehensiveRequirementValidator('./repository_before');
  const beforeResults = beforeValidator.runAll();
  const beforeSummary = beforeValidator.printResults();

  const afterValidator = new ComprehensiveRequirementValidator('./repository_after');
  const afterResults = afterValidator.runAll();
  const afterSummary = afterValidator.printResults();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`repository_before: ${beforeSummary.passed}/${beforeSummary.total} (${((beforeSummary.passed/beforeSummary.total)*100).toFixed(1)}%) ❌`);
  console.log(`repository_after:  ${afterSummary.passed}/${afterSummary.total} (${((afterSummary.passed/afterSummary.total)*100).toFixed(1)}%) ${afterSummary.success ? '✅' : '❌'}`);
  console.log('='.repeat(70));

  const improvement = afterSummary.passed - beforeSummary.passed;
  console.log(`\n📈 Improvement: +${improvement} tests passing (+${(((improvement/beforeSummary.total)*100)).toFixed(1)}%)`);

  process.exit(afterSummary.success && !beforeSummary.success ? 0 : 1);
}

module.exports = ComprehensiveRequirementValidator;
