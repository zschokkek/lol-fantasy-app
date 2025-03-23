/**
 * Test setup file for Jest
 * This file runs before all tests to set up the environment
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Create an in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  console.log(`MongoDB Memory Server started at ${mongoUri}`);
});

// Clean up after all tests
afterAll(async () => {
  await mongoose.disconnect();
  
  if (mongoServer) {
    await mongoServer.stop();
    console.log('MongoDB Memory Server stopped');
  }
});

// Clean up the database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  // Clear all collections
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
