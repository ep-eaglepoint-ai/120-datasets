const BaseValidator = require('./BaseValidator');

/**
 * Functional Validator
 * Covers Requirements 3, 5, 6, 7, 8, 9, 10, 11, 12, 13
 * - Response formats
 * - ID Validation
 * - Partial updates
 * - 404 behavior
 * - Schema validation
 * - REST conventions
 * - Pagination logic (support, metadata, empty sets)
 */
class FunctionalValidator extends BaseValidator {
  run() {
    this.loadFiles();

    // REQ-3: Standardized Response
    this.testStandardizedResponseFormat();
    this.testAllSuccessResponsesHaveMessageAndData();

    // REQ-5: ObjectId Validation
    this.testObjectIdValidation();
    this.testObjectIdValidationBeforeServiceCall();

    // REQ-6: Partial Updates
    this.testSafePartialUpdates();
    this.testUpdateDoesNotAcceptUnknownFields();

    // REQ-7: 404 Handling
    this.test404OnMissingResource();
    this.test404ChecksServiceResult();

    // REQ-8: Schema Validation
    this.testSchemaValidation();
    this.testUpdateReturnsNewDocument();

    // REQ-9: REST Delete
    this.testRESTDeleteConvention();

    // REQ-10: 204 Body
    this.testNo204Body();

    // REQ-11: Pagination Support
    this.testPaginationSupport();
    this.testPaginationUsesSkipAndLimit();

    // REQ-12: Pagination Metadata
    this.testPaginationMetadata();
    this.testPaginationReturnsAllFields();

    // REQ-13: Empty Dataset Handling
    this.testZeroValuesForEmpty();
    this.testGetTotalNeverReturnsUndefined();

    return this.results;
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
}

module.exports = FunctionalValidator;
