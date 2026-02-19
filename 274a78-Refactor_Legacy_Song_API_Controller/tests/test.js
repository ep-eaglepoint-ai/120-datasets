#!/usr/bin/env node
const path = require('path');

const repositoryArg = process.argv[2];

if (!repositoryArg) {
  console.error('Error: Repository folder argument required');
  console.error('Usage: node test.js <repository_folder>');
  console.error('Example: node test.js repository_before');
  process.exit(1);
}

const ComprehensiveSuite = require('./ComprehensiveSuite.js');
const validator = new ComprehensiveSuite(`./${repositoryArg}`);

try {
  validator.loadFiles();
  validator.runAll();
  const summary = validator.printResults();
  process.exit(summary.success ? 0 : 1);
} catch (err) {
  console.error('\nERROR:', err.message);
  process.exit(1);
}
