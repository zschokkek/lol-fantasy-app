const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Creates a test user in the database and returns user details
 * @param {Object} userData - User data to create
 * @returns {Object} Created user object and auth token
 */
const createTestUser = async (userData = {}) => {
  // Default test user data
  const defaultUserData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    isAdmin: false,
    ...userData
  };
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(defaultUserData.password, salt);
  
  // Create the user in the database
  const user = await User.create({
    ...defaultUserData,
    password: hashedPassword
  });
  
  // Generate auth token
  const token = jwt.sign(
    { id: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET || 'testsecret',
    { expiresIn: '24h' }
  );
  
  return {
    user: user.toObject(),
    token
  };
};

/**
 * Creates a test admin user in the database
 * @returns {Object} Created admin user object and auth token
 */
const createTestAdmin = async () => {
  return createTestUser({
    username: 'admin',
    email: 'admin@example.com',
    isAdmin: true
  });
};

module.exports = {
  createTestUser,
  createTestAdmin
};
