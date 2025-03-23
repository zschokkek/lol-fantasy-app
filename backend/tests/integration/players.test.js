const request = require('supertest');
const mongoose = require('mongoose');
const { Player } = require('../../models');
const { createTestUser, createTestAdmin } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Players API', () => {
  let userToken;
  let adminToken;
  let playerId;

  beforeEach(async () => {
    // Create a regular user and admin user for tests
    const user = await createTestUser();
    const admin = await createTestAdmin();
    
    userToken = user.token;
    adminToken = admin.token;

    // Create a test player
    const player = new Player({
      summonerName: 'TestPlayer',
      realName: 'Test Player',
      position: 'top',
      team: 'TSM',
      region: 'LCS',
      stats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        games: 0
      }
    });
    
    await player.save();
    playerId = player._id.toString();
  });

  describe('GET /api/players', () => {
    it('should return all players', async () => {
      const response = await request(app)
        .get('/api/players')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('summonerName');
      expect(response.body[0]).toHaveProperty('position');
    });

    it('should filter players by region when query param is provided', async () => {
      // Create players from different regions
      await Player.create({
        summonerName: 'EUPlayer',
        realName: 'EU Player',
        position: 'mid',
        team: 'FNC',
        region: 'LEC'
      });

      const response = await request(app)
        .get('/api/players?region=LCS')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(player => player.region === 'LCS')).toBe(true);
    });

    it('should filter players by position when query param is provided', async () => {
      // Create players for different positions
      await Player.create({
        summonerName: 'JunglePlayer',
        realName: 'Jungle Player',
        position: 'jungle',
        team: 'TSM',
        region: 'LCS'
      });

      const response = await request(app)
        .get('/api/players?position=top')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(player => player.position === 'top')).toBe(true);
    });
  });

  describe('GET /api/players/:id', () => {
    it('should return a specific player by ID', async () => {
      const response = await request(app)
        .get(`/api/players/${playerId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', playerId);
      expect(response.body).toHaveProperty('summonerName', 'TestPlayer');
      expect(response.body).toHaveProperty('position', 'top');
    });

    it('should return 404 if player is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/players/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/players/:id/update-stats', () => {
    it('should update player stats when user is admin', async () => {
      const statsUpdate = {
        stats: {
          kills: 10,
          deaths: 2,
          assists: 8,
          cs: 200,
          games: 1
        }
      };

      const response = await request(app)
        .post(`/api/players/${playerId}/update-stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statsUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('player');
      expect(response.body.player.stats).toMatchObject(statsUpdate.stats);
      
      // Verify in database
      const updatedPlayer = await Player.findById(playerId);
      expect(updatedPlayer.stats.kills).toBe(statsUpdate.stats.kills);
      expect(updatedPlayer.stats.deaths).toBe(statsUpdate.stats.deaths);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/players/${playerId}/update-stats`)
        .send({
          stats: { kills: 10, deaths: 5, assists: 15 }
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 if user is not admin', async () => {
      const response = await request(app)
        .post(`/api/players/${playerId}/update-stats`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          stats: { kills: 10, deaths: 5, assists: 15 }
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if player is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/players/${fakeId}/update-stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stats: { kills: 10, deaths: 5, assists: 15 }
        })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });
});
