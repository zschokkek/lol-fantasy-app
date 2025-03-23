const request = require('supertest');
const mongoose = require('mongoose');
const { User } = require('../../models');
const { createTestUser } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Authentication API', () => {
  describe('POST /api/users/register', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // Check response
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');

      // Verify user was created in the database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.username).toBe(userData.username);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'incomplete' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if username is already taken', async () => {
      // Create a user first
      await createTestUser({ username: 'takenusername', email: 'unique@example.com' });
      
      // Try to register with the same username
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'takenusername',
          email: 'another@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Username');
    });

    it('should return 400 if email is already registered', async () => {
      // Create a user first
      await createTestUser({ username: 'uniqueuser', email: 'taken@example.com' });
      
      // Try to register with the same email
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'anotherusername',
          email: 'taken@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Email');
    });
  });

  describe('POST /api/users/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await createTestUser({
        username: 'loginuser',
        email: 'login@example.com',
        password: 'password123'
      });
    });

    it('should login a user with correct credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.username).toBe('loginuser');
      expect(response.body.user.email).toBe('login@example.com');
    });

    it('should return 400 if email is not provided', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ password: 'password123' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if password is not provided', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ email: 'login@example.com' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 if email is not found', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 if password is incorrect', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/users/me', () => {
    let token;
    let user;

    beforeEach(async () => {
      // Create a user and get token
      const testUser = await createTestUser({
        username: 'meuser',
        email: 'me@example.com'
      });
      token = testUser.token;
      user = testUser.user;
    });

    it('should return user profile when authenticated', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe(user.username);
      expect(response.body.email).toBe(user.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
