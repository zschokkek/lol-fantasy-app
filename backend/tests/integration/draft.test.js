const request = require('supertest');
const mongoose = require('mongoose');
const { League, FantasyTeam, Player } = require('../../models');
const { createTestUser } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Draft API', () => {
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
      name: 'Draft Test League',
      commissioner: userId,
      maxTeams: 8,
      draftStatus: 'scheduled',
      currentDraftPick: 0,
      draftOrder: [],
      draftedPlayers: [],
      playerPool: []
    });
    await league.save();
    leagueId = league._id.toString();

    // Create a test team
    const team = new FantasyTeam({
      name: 'Draft Test Team',
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

    // Update league with team and draft order
    await League.findByIdAndUpdate(leagueId, {
      $push: { 
        teams: teamId,
        draftOrder: teamId 
      }
    });

    // Create a test player
    const player = new Player({
      summonerName: 'DraftTestPlayer',
      realName: 'Draft Test Player',
      position: 'top',
      team: 'TSM',
      region: 'LCS'
    });
    await player.save();
    playerId = player._id.toString();

    // Add player to league pool
    await League.findByIdAndUpdate(leagueId, {
      $push: { playerPool: playerId }
    });
  });

  describe('POST /api/leagues/:id/draft/start', () => {
    it('should start the draft when commissioner is authenticated', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft/start`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('league');
      expect(response.body.league.draftStatus).toBe('in_progress');
      
      // Verify in database
      const updatedLeague = await League.findById(leagueId);
      expect(updatedLeague.draftStatus).toBe('in_progress');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft/start`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 if user is not the commissioner', async () => {
      // Create another user who is not the commissioner
      const anotherUser = await createTestUser({
        username: 'noncommissioner',
        email: 'noncommissioner@example.com'
      });
      
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft/start`)
        .set('Authorization', `Bearer ${anotherUser.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/leagues/:id/draft', () => {
    beforeEach(async () => {
      // Set draft to in progress
      await League.findByIdAndUpdate(leagueId, {
        draftStatus: 'in_progress'
      });
    });

    it('should draft a player when authenticated', async () => {
      const draftData = {
        teamId,
        playerId
      };

      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(draftData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('league');
      expect(response.body).toHaveProperty('team');
      expect(response.body.league.draftedPlayers).toContain(playerId);
      
      // Verify in database
      const updatedLeague = await League.findById(leagueId);
      expect(updatedLeague.draftedPlayers.map(id => id.toString())).toContain(playerId);
      
      // Check the team roster was updated
      const updatedTeam = await FantasyTeam.findById(teamId);
      const playerInRoster = Object.values(updatedTeam.roster)
        .flat()
        .filter(id => id)
        .some(id => id.toString() === playerId);
      expect(playerInRoster).toBe(true);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft`)
        .send({ teamId, playerId })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if teamId or playerId is missing', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ teamId }) // Missing playerId
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if league is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/leagues/${fakeId}/draft`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ teamId, playerId })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if draft is not in progress', async () => {
      // Set draft status to completed
      await League.findByIdAndUpdate(leagueId, {
        draftStatus: 'completed'
      });
      
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/draft`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ teamId, playerId })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('draft');
    });
  });

  describe('POST /api/draft/pick', () => {
    it('should add a player to a team roster slot', async () => {
      const pickData = {
        teamId,
        playerId,
        position: 'top'
      };

      const response = await request(app)
        .post('/api/draft/pick')
        .send(pickData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('team');
      expect(response.body.team.roster.top.toString()).toBe(playerId);
      
      // Verify in database
      const updatedTeam = await FantasyTeam.findById(teamId);
      expect(updatedTeam.roster.top.toString()).toBe(playerId);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/draft/pick')
        .send({ teamId, playerId }) // Missing position
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if team is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/draft/pick')
        .send({ teamId: fakeId, playerId, position: 'top' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if player is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/draft/pick')
        .send({ teamId, playerId: fakeId, position: 'top' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });
});
