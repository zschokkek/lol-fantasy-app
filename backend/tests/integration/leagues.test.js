const request = require('supertest');
const mongoose = require('mongoose');
const { League, FantasyTeam } = require('../../models');
const { createTestUser, createTestAdmin } = require('../testUtils');

// Get express app
let app;

beforeAll(() => {
  // Import the app after the MongoDB connection is established
  app = require('../../server');
});

describe('Leagues API', () => {
  let userToken;
  let adminToken;
  let userId;
  let leagueId;

  beforeEach(async () => {
    // Create a regular user and admin user for tests
    const user = await createTestUser();
    const admin = await createTestAdmin();
    
    userToken = user.token;
    adminToken = admin.token;
    userId = user.user._id.toString();

    // Create a test league
    const league = new League({
      name: 'Test League',
      commissioner: userId,
      maxTeams: 8,
      teams: [],
      settings: {
        draftType: 'snake',
        scoringType: 'standard',
        startWeek: 1,
        endWeek: 9
      }
    });
    
    await league.save();
    leagueId = league._id.toString();
  });

  describe('GET /api/leagues', () => {
    it('should return all leagues', async () => {
      const response = await request(app)
        .get('/api/leagues')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });
  });

  describe('GET /api/leagues/:id', () => {
    it('should return a specific league by ID', async () => {
      const response = await request(app)
        .get(`/api/leagues/${leagueId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', leagueId);
      expect(response.body).toHaveProperty('name', 'Test League');
      expect(response.body).toHaveProperty('commissioner');
    });

    it('should return 404 if league is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/leagues/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/leagues', () => {
    it('should create a new league when authenticated', async () => {
      const leagueData = {
        name: 'New Test League',
        maxTeams: 10,
        settings: {
          draftType: 'snake',
          scoringType: 'standard',
          startWeek: 1,
          endWeek: 9
        }
      };

      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${userToken}`)
        .send(leagueData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', leagueData.name);
      expect(response.body).toHaveProperty('commissioner');
      expect(response.body.teams).toEqual([]);
      
      // Check database
      const createdLeague = await League.findById(response.body.id);
      expect(createdLeague).toBeTruthy();
      expect(createdLeague.name).toBe(leagueData.name);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/leagues')
        .send({ name: 'Unauthorized League', maxTeams: 8 })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/leagues')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/leagues/:id/join', () => {
    it('should allow a user to join a league with a new team', async () => {
      const joinData = {
        teamName: 'My Test Team'
      };

      const response = await request(app)
        .post(`/api/leagues/${leagueId}/join`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(joinData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('league');
      expect(response.body).toHaveProperty('team');
      expect(response.body.team.name).toBe(joinData.teamName);
      
      // Verify in database
      const updatedLeague = await League.findById(leagueId);
      expect(updatedLeague.teams.length).toBe(1);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/join`)
        .send({ teamName: 'Unauthorized Team' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if league is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/leagues/${fakeId}/join`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ teamName: 'Test Team' })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/leagues/:id/teams', () => {
    beforeEach(async () => {
      // Add a team to the league
      const team = new FantasyTeam({
        name: 'Test Team',
        owner: userId,
        league: leagueId
      });
      await team.save();
      
      // Update league with team
      await League.findByIdAndUpdate(leagueId, {
        $push: { teams: team._id }
      });
    });

    it('should return all teams in a league', async () => {
      const response = await request(app)
        .get(`/api/leagues/${leagueId}/teams`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('name', 'Test Team');
      expect(response.body[0]).toHaveProperty('owner');
    });

    it('should return 404 if league is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/leagues/${fakeId}/teams`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/leagues/:id/matchups/:week', () => {
    beforeEach(async () => {
      // Set up league with matchups for testing
      const team1 = new FantasyTeam({ name: 'Team 1', owner: userId });
      const team2 = new FantasyTeam({ name: 'Team 2', owner: userId });
      await team1.save();
      await team2.save();
      
      // Add matchups to league
      await League.findByIdAndUpdate(leagueId, {
        $push: { 
          teams: [team1._id, team2._id],
          schedule: {
            week: 1,
            matchups: [
              {
                homeTeam: team1._id,
                awayTeam: team2._id,
                homeScore: 0,
                awayScore: 0
              }
            ]
          }
        }
      });
    });

    it('should return matchups for a specific week', async () => {
      const response = await request(app)
        .get(`/api/leagues/${leagueId}/matchups/1`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('homeTeam');
      expect(response.body[0]).toHaveProperty('awayTeam');
    });

    it('should return 404 if league is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/leagues/${fakeId}/matchups/1`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/leagues/:id/advance-week', () => {
    it('should advance the current week of a league', async () => {
      // First set the currentWeek to 1
      await League.findByIdAndUpdate(leagueId, {
        currentWeek: 1
      });
      
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/advance-week`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('currentWeek', 2);
      
      // Verify in database
      const updatedLeague = await League.findById(leagueId);
      expect(updatedLeague.currentWeek).toBe(2);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/api/leagues/${leagueId}/advance-week`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 if league is not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/leagues/${fakeId}/advance-week`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });
});
