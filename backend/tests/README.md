# API Test Suite for LoL Fantasy App

This directory contains a comprehensive test suite for the LoL Fantasy App backend API. The tests use Jest as the test runner and Supertest for making HTTP requests to the API endpoints.

## Structure

- `setup.js`: Sets up the test environment, including the in-memory MongoDB database
- `testUtils.js`: Utility functions for creating test users and other common test operations
- `integration/`: Contains tests for API endpoints organized by functionality
  - `auth.test.js`: Authentication endpoints (register, login, user profile)
  - `leagues.test.js`: League management endpoints
  - `teams.test.js`: Team management endpoints
  - `players.test.js`: Player-related endpoints
  - `draft.test.js`: Draft functionality
  - `trades.test.js`: Trade management endpoints
  - `social.test.js`: Friend requests and messaging endpoints

## Running Tests

You can run the tests using the following npm commands:

```bash
# Run all tests
npm test

# Run tests in watch mode (rerun when files change)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Environment

The tests use a MongoDB Memory Server to create an in-memory database for testing. This ensures that tests don't affect your development or production database.

## Mock Data

Each test file sets up its own mock data in the `beforeEach` hooks. This approach ensures that tests are isolated and don't depend on the state from other tests.

## Authentication

Many of the tests require authentication. The `testUtils.js` file provides helper functions to create test users and generate authentication tokens.

## Coverage

Running tests with the coverage flag (`npm run test:coverage`) will generate a coverage report showing which parts of the codebase are covered by tests.

## Adding New Tests

When adding new tests, follow the existing patterns:

1. Use `describe` blocks to group related tests
2. Set up necessary data in `beforeEach` hooks
3. Clean up after tests in `afterEach` hooks if needed
4. Test both successful cases and error cases
5. Use assertions to verify the expected behavior

## Troubleshooting

If tests are failing, check:

1. That MongoDB Memory Server is running correctly
2. That the test data setup is correct
3. That the API endpoints are behaving as expected
4. That the assertions match the actual API response structure

## Continuous Integration

These tests can be integrated into a CI/CD pipeline to run automatically when changes are pushed to the repository.
