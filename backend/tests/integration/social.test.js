const request = require('supertest');
const mongoose = require('mongoose');
const { FriendRequest, Conversation, Message, User } = require('../../models');
const { createTestUser } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Social API', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;
  let requestId;
  let conversationId;

  beforeEach(async () => {
    // Create two test users
    const user1 = await createTestUser({
      username: 'social_user1',
      email: 'social1@example.com'
    });
    
    const user2 = await createTestUser({
      username: 'social_user2',
      email: 'social2@example.com'
    });
    
    user1Token = user1.token;
    user1Id = user1.user._id.toString();
    user2Token = user2.token;
    user2Id = user2.user._id.toString();

    // Create a test friend request
    const friendRequest = new FriendRequest({
      sender: user1Id,
      recipient: user2Id,
      status: 'pending'
    });
    await friendRequest.save();
    requestId = friendRequest._id.toString();

    // Create a test conversation
    const conversation = new Conversation({
      participants: [user1Id, user2Id],
      lastMessage: null
    });
    await conversation.save();
    conversationId = conversation._id.toString();

    // Add a test message
    const message = new Message({
      conversation: conversationId,
      sender: user1Id,
      content: 'Hello, this is a test message',
      read: false
    });
    await message.save();

    // Update conversation with last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id
    });
  });

  describe('POST /api/friends/requests', () => {
    it('should send a friend request when authenticated', async () => {
      // Create a third user to send request to
      const user3 = await createTestUser({
        username: 'social_user3',
        email: 'social3@example.com'
      });
      const user3Id = user3.user._id.toString();

      const response = await request(app)
        .post('/api/friends/requests')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ recipientId: user3Id })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('request');
      expect(response.body.request.sender).toBe(user1Id);
      expect(response.body.request.recipient).toBe(user3Id);
      expect(response.body.request.status).toBe('pending');
      
      // Verify in database
      const request = await FriendRequest.findById(response.body.request._id);
      expect(request).toBeTruthy();
      expect(request.status).toBe('pending');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/friends/requests')
        .send({ recipientId: user2Id })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if recipientId is missing', async () => {
      const response = await request(app)
        .post('/api/friends/requests')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/friends/requests', () => {
    it('should return friend requests when authenticated', async () => {
      const response = await request(app)
        .get('/api/friends/requests')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('sender');
      expect(response.body[0]).toHaveProperty('status', 'pending');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/friends/requests')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/friends/requests/:requestId', () => {
    it('should accept a friend request when authenticated', async () => {
      const response = await request(app)
        .put(`/api/friends/requests/${requestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'accepted' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('request');
      expect(response.body.request.status).toBe('accepted');
      
      // Verify in database
      const updatedRequest = await FriendRequest.findById(requestId);
      expect(updatedRequest.status).toBe('accepted');
      
      // Verify friendship was established in both users
      const user1 = await User.findById(user1Id);
      const user2 = await User.findById(user2Id);
      
      expect(user1.friends).toContainEqual(mongoose.Types.ObjectId(user2Id));
      expect(user2.friends).toContainEqual(mongoose.Types.ObjectId(user1Id));
    });

    it('should reject a friend request when authenticated', async () => {
      const response = await request(app)
        .put(`/api/friends/requests/${requestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'rejected' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('request');
      expect(response.body.request.status).toBe('rejected');
      
      // Verify in database
      const updatedRequest = await FriendRequest.findById(requestId);
      expect(updatedRequest.status).toBe('rejected');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .put(`/api/friends/requests/${requestId}`)
        .send({ status: 'accepted' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 if user is not the recipient of the request', async () => {
      const response = await request(app)
        .put(`/api/friends/requests/${requestId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'accepted' })
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/conversations', () => {
    it('should return user conversations when authenticated', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('_id');
      expect(response.body[0]).toHaveProperty('participants');
      expect(response.body[0].participants).toContain(user1Id);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation when authenticated', async () => {
      // Create a third user
      const user3 = await createTestUser({
        username: 'conv_user3',
        email: 'conv3@example.com'
      });
      const user3Id = user3.user._id.toString();

      const conversationData = {
        participantIds: [user1Id, user3Id],
        initialMessage: 'Hello, this is a new conversation'
      };

      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(conversationData)
        .expect(201);

      expect(response.body).toHaveProperty('conversation');
      expect(response.body).toHaveProperty('message');
      expect(response.body.conversation.participants).toContain(user1Id);
      expect(response.body.conversation.participants).toContain(user3Id);
      expect(response.body.message.content).toBe(conversationData.initialMessage);
      
      // Verify in database
      const conversation = await Conversation.findById(response.body.conversation._id);
      expect(conversation).toBeTruthy();
      expect(conversation.participants.map(p => p.toString())).toContain(user1Id);
      expect(conversation.participants.map(p => p.toString())).toContain(user3Id);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          participantIds: [user1Id, user2Id],
          initialMessage: 'Test'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          participantIds: [user1Id, user2Id]
          // Missing initialMessage
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/conversations/:conversationId/messages', () => {
    it('should return conversation messages when authenticated', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('sender', user1Id);
      expect(response.body[0]).toHaveProperty('content');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if conversation is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/conversations/${fakeId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/conversations/:conversationId/messages', () => {
    it('should add a message to a conversation when authenticated', async () => {
      const messageData = {
        content: 'This is a new test message'
      };

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(messageData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toHaveProperty('sender', user1Id);
      expect(response.body.message).toHaveProperty('content', messageData.content);
      expect(response.body.message).toHaveProperty('read', false);
      
      // Verify in database
      const message = await Message.findById(response.body.message._id);
      expect(message).toBeTruthy();
      expect(message.content).toBe(messageData.content);
      
      // Verify conversation was updated
      const conversation = await Conversation.findById(conversationId);
      expect(conversation.lastMessage.toString()).toBe(response.body.message._id);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .send({ content: 'Unauthorized message' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if conversation is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/conversations/${fakeId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Message to nowhere' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if content is missing', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
