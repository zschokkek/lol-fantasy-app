const request = require('supertest');
const mongoose = require('mongoose');
const { Trade, FantasyTeam, Player, League } = require('../../models');
const { createTestUser } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Trades API', () => {
  let userToken;
  let userId;
  let leagueId;
  let teamId1;
  let teamId2;
  let player1Id;
  let player2Id;
  let tradeId;

  beforeEach(async () => {
    // Create a test user
    const testUser = await createTestUser();
    userToken = testUser.token;
    userId = testUser.user._id.toString();

    // Create a test league
    const league = new League({
      name: 'Trade Test League',
      commissioner: userId,
      maxTeams: 8
    });
    await league.save();
    leagueId = league._id.toString();

    // Create two test teams
    const team1 = new FantasyTeam({
      name: 'Trade Team 1',
      owner: userId,
      league: leagueId,
      roster: {
        top: null,
        jungle: null,
        mid: null,
        adc: null,
        support: null,
        bench: []
      }
    });
    await team1.save();
    teamId1 = team1._id.toString();

    // For the second team, create a different owner
    const team2Owner = new mongoose.Types.ObjectId();
    const team2 = new FantasyTeam({
      name: 'Trade Team 2',
      owner: team2Owner,
      league: leagueId,
      roster: {
        top: null,
        jungle: null,
        mid: null,
        adc: null,
        support: null,
        bench: []
      }
    });
    await team2.save();
    teamId2 = team2._id.toString();

    // Update league with teams
    await League.findByIdAndUpdate(leagueId, {
      $push: { teams: [teamId1, teamId2] }
    });

    // Create test players
    const player1 = new Player({
      summonerName: 'TradePlayer1',
      realName: 'Trade Test Player 1',
      position: 'top',
      team: 'TSM',
      region: 'LCS'
    });
    await player1.save();
    player1Id = player1._id.toString();

    const player2 = new Player({
      summonerName: 'TradePlayer2',
      realName: 'Trade Test Player 2',
      position: 'mid',
      team: 'C9',
      region: 'LCS'
    });
    await player2.save();
    player2Id = player2._id.toString();

    // Assign players to teams
    await FantasyTeam.findByIdAndUpdate(teamId1, {
      'roster.top': player1Id
    });
    
    await FantasyTeam.findByIdAndUpdate(teamId2, {
      'roster.mid': player2Id
    });

    // Create a test trade
    const trade = new Trade({
      proposingTeam: teamId1,
      receivingTeam: teamId2,
      proposedPlayers: [player1Id],
      requestedPlayers: [player2Id],
      status: 'pending'
    });
    await trade.save();
    tradeId = trade._id.toString();
  });

  describe('POST /api/trades/propose', () => {
    it('should propose a new trade when authenticated', async () => {
      const tradeData = {
        proposingTeamId: teamId1,
        receivingTeamId: teamId2,
        proposedPlayers: [player1Id],
        requestedPlayers: [player2Id]
      };

      const response = await request(app)
        .post('/api/trades/propose')
        .set('Authorization', `Bearer ${userToken}`)
        .send(tradeData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('trade');
      expect(response.body.trade).toHaveProperty('id');
      expect(response.body.trade.proposingTeam).toBe(teamId1);
      expect(response.body.trade.status).toBe('pending');
      
      // Verify in database
      const createdTrade = await Trade.findById(response.body.trade.id);
      expect(createdTrade).toBeTruthy();
      expect(createdTrade.proposingTeam.toString()).toBe(teamId1);
      expect(createdTrade.receivingTeam.toString()).toBe(teamId2);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/trades/propose')
        .send({
          proposingTeamId: teamId1,
          receivingTeamId: teamId2,
          proposedPlayers: [player1Id],
          requestedPlayers: [player2Id]
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/trades/propose')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          proposingTeamId: teamId1,
          receivingTeamId: teamId2
          // Missing proposedPlayers and requestedPlayers
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 if user does not own the proposing team', async () => {
      // Create another user
      const anotherUser = await createTestUser({
        username: 'anotheruser',
        email: 'another@example.com'
      });
      
      const response = await request(app)
        .post('/api/trades/propose')
        .set('Authorization', `Bearer ${anotherUser.token}`)
        .send({
          proposingTeamId: teamId1, // Team owned by the original user
          receivingTeamId: teamId2,
          proposedPlayers: [player1Id],
          requestedPlayers: [player2Id]
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/trades/:tradeId', () => {
    it('should return a specific trade by ID when authenticated', async () => {
      const response = await request(app)
        .get(`/api/trades/${tradeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', tradeId);
      expect(response.body).toHaveProperty('proposingTeam');
      expect(response.body).toHaveProperty('receivingTeam');
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get(`/api/trades/${tradeId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if trade is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/trades/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/trades/:tradeId/accept', () => {
    it('should accept a trade when authenticated as receiving team owner', async () => {
      // First, set the owner of team2 to be our test user temporarily
      await FantasyTeam.findByIdAndUpdate(teamId2, { owner: userId });
      
      const response = await request(app)
        .post(`/api/trades/${tradeId}/accept`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('trade');
      expect(response.body.trade.status).toBe('accepted');
      
      // Verify in database
      const updatedTrade = await Trade.findById(tradeId);
      expect(updatedTrade.status).toBe('accepted');
      
      // Verify players were swapped
      const team1 = await FantasyTeam.findById(teamId1);
      const team2 = await FantasyTeam.findById(teamId2);
      
      expect(team1.roster.top).toBeNull();
      expect(team1.roster.mid.toString()).toBe(player2Id);
      expect(team2.roster.mid).toBeNull();
      expect(team2.roster.top.toString()).toBe(player1Id);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/trades/${tradeId}/accept`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 if user is not the owner of the receiving team', async () => {
      // Team2 has a different owner by default
      const response = await request(app)
        .post(`/api/trades/${tradeId}/accept`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if trade is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/trades/${fakeId}/accept`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/trades/:tradeId/reject', () => {
    it('should reject a trade when authenticated as receiving team owner', async () => {
      // First, set the owner of team2 to be our test user temporarily
      await FantasyTeam.findByIdAndUpdate(teamId2, { owner: userId });
      
      const response = await request(app)
        .post(`/api/trades/${tradeId}/reject`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('trade');
      expect(response.body.trade.status).toBe('rejected');
      
      // Verify in database
      const updatedTrade = await Trade.findById(tradeId);
      expect(updatedTrade.status).toBe('rejected');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/trades/${tradeId}/reject`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/trades/:tradeId/cancel', () => {
    it('should cancel a trade when authenticated as proposing team owner', async () => {
      const response = await request(app)
        .post(`/api/trades/${tradeId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('trade');
      expect(response.body.trade.status).toBe('cancelled');
      
      // Verify in database
      const updatedTrade = await Trade.findById(tradeId);
      expect(updatedTrade.status).toBe('cancelled');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/trades/${tradeId}/cancel`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 if user is not the owner of the proposing team', async () => {
      // Create another user and try to cancel with them
      const anotherUser = await createTestUser({
        username: 'canceluser',
        email: 'cancel@example.com'
      });
      
      const response = await request(app)
        .post(`/api/trades/${tradeId}/cancel`)
        .set('Authorization', `Bearer ${anotherUser.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });
  });
});
