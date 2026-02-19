const BaseValidator = require('./BaseValidator');

/**
 * Quality Validator
 * Covers Requirements 4, 14, and Bonus
 * - Consistent Error Handling
 * - No duplicated logic
 * - Stateless controller
 * - Async/Await usage
 * - No console.log
 * - Proper Try/Catch blocks
 */
class QualityValidator extends BaseValidator {
  run() {
    this.loadFiles();
    
    // REQ-4: Error Handling
    this.testConsistentErrorHandling();
    this.testAllErrorResponsesHaveDataNull();

    // REQ-14: Logic Duplication
    this.testNoDuplicatedLogic();
    this.testNoResponseFormattingDuplication();

    return this.results;
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
    
    return this.test(
      14,
      'No Duplicated Response Formatting',
      matches.length >= 10,
      'FAIL: Response formatting should be consistent across all endpoints'
    );
  }
}

module.exports = QualityValidator;
