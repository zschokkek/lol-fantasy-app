const request = require('supertest');
const mongoose = require('mongoose');
const { FantasyTeam, League, Player } = require('../../models');
const { createTestUser } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Teams API', () => {
  let userToken;
  let userId;
  let leagueId;
  let teamId;
  let playerId;

  beforeEach(async () => {
    // Create a test user
    const testUser = await createTestUser();
    userToken = testUser.token;
    userId = testUser.user._id.toString();

    // Create a test league
    const league = new League({
      name: 'Test League',
      commissioner: userId,
      maxTeams: 8,
      currentWeek: 1
    });
    await league.save();
    leagueId = league._id.toString();

    // Create a test team
    const team = new FantasyTeam({
      name: 'Test Team',
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
    await team.save();
    teamId = team._id.toString();

    // Add team to league
    await League.findByIdAndUpdate(leagueId, {
      $push: { teams: teamId }
    });

    // Create a test player
    const player = new Player({
      summonerName: 'TestPlayer',
      realName: 'Test Player',
      position: 'top',
      team: 'TSM',
      region: 'LCS'
    });
    await player.save();
    playerId = player._id.toString();
  });

  describe('GET /api/teams/:teamId', () => {
    it('should return a specific team by ID', async () => {
      const response = await request(app)
        .get(`/api/teams/${teamId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', teamId);
      expect(response.body).toHaveProperty('name', 'Test Team');
      expect(response.body).toHaveProperty('owner');
      expect(response.body).toHaveProperty('roster');
    });

    it('should return 404 if team is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/teams/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/teams', () => {
    it('should create a new team when authenticated', async () => {
      const teamData = {
        name: 'New Test Team',
        leagueId
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${userToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', teamData.name);
      expect(response.body).toHaveProperty('owner');
      expect(response.body).toHaveProperty('league', leagueId);
      
      // Check database
      const createdTeam = await FantasyTeam.findById(response.body.id);
      expect(createdTeam).toBeTruthy();
      expect(createdTeam.name).toBe(teamData.name);
      
      // Check league was updated
      const updatedLeague = await League.findById(leagueId);
      expect(updatedLeague.teams).toContainEqual(mongoose.Types.ObjectId(response.body.id));
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/teams')
        .send({ name: 'Unauthorized Team', leagueId })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/teams/:teamId/add-player', () => {
    it('should add a player to a team roster', async () => {
      const addPlayerData = {
        playerId,
        slot: 'top'
      };

      const response = await request(app)
        .post(`/api/teams/${teamId}/add-player`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(addPlayerData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('team');
      expect(response.body.team.roster.top).toBe(playerId);
      
      // Verify in database
      const updatedTeam = await FantasyTeam.findById(teamId);
      expect(updatedTeam.roster.top.toString()).toBe(playerId);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/add-player`)
        .send({ playerId, slot: 'top' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if team is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/teams/${fakeId}/add-player`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ playerId, slot: 'top' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/add-player`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/teams/:teamId/remove-player', () => {
    beforeEach(async () => {
      // Add player to team first
      await FantasyTeam.findByIdAndUpdate(teamId, {
        'roster.top': playerId
      });
    });

    it('should remove a player from a team roster', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/remove-player`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ playerId })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('team');
      expect(response.body.team.roster.top).toBeNull();
      
      // Verify in database
      const updatedTeam = await FantasyTeam.findById(teamId);
      expect(updatedTeam.roster.top).toBeNull();
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/remove-player`)
        .send({ playerId })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if team is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/teams/${fakeId}/remove-player`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ playerId })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if player ID is not provided', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/remove-player`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
