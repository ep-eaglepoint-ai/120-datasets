const StructuralValidator = require('./StructuralValidator');
const FunctionalValidator = require('./FunctionalValidator');
const QualityValidator = require('./QualityValidator');
const fs = require('fs');

/**
 * Comprehensive Requirement Validation Suite
 * 
 * Orchestrates:
 * 1. Structural Validation (Layers, naming, deps)
 * 2. Functional Validation (Logic, API, REST)
 * 3. Quality Validation (Error handling, patterns)
 */
class ComprehensiveSuite {
  constructor(repositoryPath) {
    this.repositoryPath = repositoryPath;
    this.structural = new StructuralValidator(repositoryPath);
    this.functional = new FunctionalValidator(repositoryPath);
    this.quality = new QualityValidator(repositoryPath);
  }

  loadFiles() {
    this.structural.loadFiles();
    this.functional.loadFiles();
    this.quality.loadFiles();
  }

  runAll() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${this.repositoryPath}`);
    console.log('='.repeat(70));

    // Run all validators
    const structuralResults = this.structural.run();
    const functionalResults = this.functional.run();
    const qualityResults = this.quality.run();

    // Aggregate results
    return [...structuralResults, ...functionalResults, ...qualityResults];
  }

  printResults() {
    // Collect all results
    const allResults = [
      ...this.structural.getResults(),
      ...this.functional.getResults(),
      ...this.quality.getResults()
    ];

    const passed = allResults.filter(r => r.passed).length;
    const total = allResults.length;

    // Group by requirement
    const byRequirement = {};
    allResults.forEach(result => {
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

    return { passed, total, success: passed === total, results: allResults };
  }
}

// Run tests if executed directly
if (require.main === module) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPREHENSIVE REQUIREMENT VALIDATION SUITE (Modular)');
  console.log('Testing against 16 requirements + bonus rigorous tests');
  console.log('='.repeat(70));

  const beforeValidator = new ComprehensiveSuite('./repository_before');
  const beforeResults = beforeValidator.runAll();
  const beforeSummary = beforeValidator.printResults();

  const afterValidator = new ComprehensiveSuite('./repository_after');
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

module.exports = ComprehensiveSuite;
