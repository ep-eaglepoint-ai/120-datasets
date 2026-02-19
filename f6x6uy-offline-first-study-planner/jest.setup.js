// Jest setup file
// This file runs before each test file
require('@testing-library/jest-dom');

// Set test environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.DB_NAME = 'study_planner_test';
process.env.NODE_ENV = 'test';
process.env.MONGOMS_VERSION = '7.0.3';
