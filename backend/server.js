// backend/server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');
const http = require('http');
const WebSocket = require('ws');

// Load environment variables
dotenv.config();
console.log("JWT Secret value:", process.env.JWT_SECRET);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

// Import models
const { Player, FantasyTeam, League, User, Trade, FriendRequest, Conversation, Message } = require('./models');

// Import fantasy league core modules
const { 
  PlayerService,
  TeamService,
  LeagueService,
  RiotApiService,
  StatsUpdater
} = require('./fantasy-core');

// Import image utilities
const { downloadImage, imageExistsLocally } = require('./helpers/imageUtils');

// Middleware
app.use(express.json({
  type: ['application/json', 'text/plain'],
  strict: false
}));
app.use(morgan('dev'));

// Additional body parsers for different content types
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());

// Update your CORS settings in server.js
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Replace with your frontend URL
    credentials: true
  }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
const riotApiService = new RiotApiService(process.env.RIOT_API_KEY);
const playerService = new PlayerService(riotApiService);
const teamService = new TeamService();
const leagueService = new LeagueService();

// Make services globally available for cross-referencing
// This allows teamService to be accessible in leagueService methods
global.teamService = teamService;
global.leagueService = leagueService;
global.playerService = playerService;

console.log('Services initialized and made globally available')

// Cache control middleware
const cacheControl = (req, res, next) => {
  // Set Cache-Control header for API responses
  res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
  next();
};

// Apply cache control to all API routes
app.use('/api', cacheControl);

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const LEAGUE_FILE = path.join(DATA_DIR, 'league.json');

const auth= require('./middleware/auth'); // Use destructuring to get the auth function
// const adminOnly = auth.adminOnly; // Get the adminOnly function if needed



const UserService = require('./services/UserService'); // Adjust path as needed to where you created the UserService
const userService = new UserService();

// Ensure data directory exists
async function ensureDataDir() {
  console.log(`DEBUG: ensureDataDir - Starting to create directory at ${DATA_DIR}`);
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Data directory created at ${DATA_DIR}`);
    console.log(`DEBUG: ensureDataDir - Directory creation successful`);
  } catch (error) {
    console.error('DEBUG: ensureDataDir - Error:', error);
    console.error('Error creating data directory:', error);
  }
}

// Load data from disk or initialize with defaults
async function initializeData() {
  console.log('DEBUG: Starting initializeData()');
  await ensureDataDir();
  console.log('DEBUG: Data directory ensured');
  
  try {
    // Try to load players from MongoDB
    console.log('DEBUG: About to load player data from MongoDB');
    const playerCount = await Player.countDocuments();
    
    if (playerCount > 0) {
      console.log(`Loading ${playerCount} players from MongoDB`);
      const players = await Player.find();
      playerService.loadPlayersFromData(players);
      console.log('DEBUG: Players loaded from MongoDB');
    } else {
      console.log('No player data found in MongoDB, loading sample players...');
      await loadSamplePlayers();
      console.log('DEBUG: Sample players loaded');
    }
    
    // Try to load teams from MongoDB
    console.log('DEBUG: About to load team data from MongoDB');
    const teamCount = await FantasyTeam.countDocuments();
    
    if (teamCount > 0) {
      console.log(`Loading ${teamCount} teams from MongoDB`);
      const teams = await FantasyTeam.find();
      teamService.loadTeamsFromData(teams, playerService);
      console.log('DEBUG: Teams loaded from MongoDB');
    }
    
    // Load leagues from MongoDB
    try {
      const leagueCount = await League.countDocuments();
      
      if (leagueCount > 0) {
        console.log(`DEBUG: Loading ${leagueCount} leagues from MongoDB`);
        const leagues = await League.find();
        leagueService.loadLeaguesFromData(leagues, teamService, playerService);
      } else {
        console.log('DEBUG: No leagues found in MongoDB, creating a default league');
        // Create a default league
        const defaultLeague = leagueService.createLeague('LTA Fantasy League', 12);
        
        // Add some sample teams
        for (let i = 1; i <= 8; i++) {
          const team = teamService.createTeam(`Team ${i}`, `owner${i}`);
          defaultLeague.addTeam(team);
        }
        
        // Add players to the league pool
        defaultLeague.addPlayersToPool(playerService.getAllPlayers());
        
        // Generate a schedule if we have at least 2 teams
        if (defaultLeague.teams.length >= 2) {
          defaultLeague.generateSchedule(9); // 9-week season
        }
      }
    } catch (error) {
      console.error('DEBUG: Error loading leagues:', error);
      console.error('Error loading leagues:', error);
    }
    
    // Set up stats updater for real-time updates
    console.log('DEBUG: Checking if auto updates are enabled');
    if (process.env.ENABLE_AUTO_UPDATES === 'true') {
      console.log('Setting up automatic stats updates');
      const leagues = leagueService.getAllLeagues();
      if (leagues && leagues.length > 0) {
        const statsUpdater = new StatsUpdater(
          leagues[0], 
          riotApiService, 
          parseInt(process.env.UPDATE_INTERVAL || 1800000) // Default: 30 minutes
        );
        statsUpdater.start();
        console.log('DEBUG: Stats updater started');
      } else {
        console.log('DEBUG: No leagues found, cannot start stats updater');
      }
    } else {
      console.log('DEBUG: Auto updates are disabled');
    }
    
    console.log('Data initialization complete');
  } catch (error) {
    console.error('DEBUG: Error in initializeData:', error);
    console.error('Error initializing data:', error);
  }
}

// One-time function to fix existing league data with null memberIds
async function fixLeagueData() {
  console.log('DEBUG: Fixing existing league data with null memberIds');
  try {
    // Load current league data
    const leagueData = await League.find();
    
    if (!leagueData || !Array.isArray(leagueData)) {
      console.log('DEBUG: No league data found or not an array');
      return;
    }
    
    // Fix each league
    for (const league of leagueData) {
      // Remove null memberIds
      const memberIds = Array.isArray(league.memberIds) 
        ? league.memberIds.filter(id => id !== null && id !== undefined)
        : [];
      
      // If creator exists but not in memberIds, add them
      if (league.creatorId && !memberIds.includes(league.creatorId)) {
        memberIds.push(league.creatorId);
      }
      
      league.memberIds = memberIds;
      
      await league.save();
    }
    
    console.log('DEBUG: League data fixed and saved');
  } catch (error) {
    console.error('DEBUG: Error fixing league data:', error);
  }
}

// API ENDPOINTS

// Special endpoint to make "shark" user an admin (for development purposes)
app.get('/api/admin/setup-shark', async (req, res) => {
  try {
    const result = await userService.setUserAsAdmin('shark');
    
    return res.status(200).json({ 
      message: 'User "shark" has been set as a global admin',
      user: result.toSafeJSON()
    });
  } catch (error) {
    console.error('Error setting up admin user:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Admin endpoint to fill a league with teams and generate a schedule
app.post('/api/admin/fill-league/:leagueId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized. Admin access required.' });
    }
    
    const { leagueId } = req.params;
    
    // Get the league
    const league = leagueService.getLeagueById(leagueId);
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    console.log(`DEBUG: Filling league ${leagueId}`);
    
    // Ensure maxTeams is a number
    let maxTeams = 8; // Default value
    if (typeof league.maxTeams === 'number') {
      maxTeams = league.maxTeams;
    } else if (typeof league.maxTeams === 'string') {
      // Try to extract a number from the string
      const match = league.maxTeams.match(/(\d+)/);
      if (match) {
        maxTeams = parseInt(match[1], 10);
      }
    }
    
    // Make sure we have an array of teams
    if (!Array.isArray(league.teams)) {
      league.teams = [];
    }
    
    // Count existing teams
    const existingTeamCount = league.teams.length;
    
    // Calculate how many teams we need to add
    const teamsToAdd = Math.max(0, maxTeams - existingTeamCount);
    
    console.log(`DEBUG: League has ${existingTeamCount}/${maxTeams} teams, adding ${teamsToAdd} more`);
    
    if (teamsToAdd <= 0) {
      return res.status(200).json({ 
        message: `League already has ${existingTeamCount}/${maxTeams} teams. No need to add more.`,
        league: league
      });
    }
    
    // Team names for auto-filling
    const TEAM_NAMES = [
      'Team Solo Mid',
      'Cloud9',
      'Team Liquid',
      '100 Thieves',
      'Evil Geniuses',
      'Counter Logic Gaming',
      'Immortals',
      'FlyQuest',
      'Golden Guardians',
      'Dignitas',
      'G2 Esports',
      'Fnatic'
    ];
    
    // Create teams and add to league
    const createdTeams = [];
    
    for (let i = 0; i < teamsToAdd; i++) {
      const teamIndex = i % TEAM_NAMES.length;
      const teamName = `${TEAM_NAMES[teamIndex]} ${existingTeamCount + i + 1}`;
      const owner = `Bot ${existingTeamCount + i + 1}`;
      
      // Create the team
      const team = {
        id: `team_${Date.now() + i}`,
        name: teamName,
        owner: owner,
        leagueId: leagueId,
        players: {},
        totalPoints: 0
      };
      
      // Add team to league
      league.teams.push(team);
      
      // Also add to teamService
      teamService.teams.push(team);
      
      // Save team to MongoDB
      try {
        const newTeam = new FantasyTeam({
          id: team.id,
          name: team.name,
          owner: team.owner,
          userId: null, // Bot teams don't have a real user
          leagueId: leagueId,
          players: {}
        });
        
        await newTeam.save();
        console.log(`DEBUG: Saved team ${team.id} to MongoDB`);
      } catch (err) {
        console.error(`Error saving team ${team.id} to MongoDB:`, err);
      }
      
      createdTeams.push(team);
    }
    
    // Generate a schedule for the league
    const numWeeks = 11; // Standard season length
    
    // Clear existing schedule
    league.schedule = [];
    
    // Only generate a schedule if we have at least 2 teams
    if (league.teams.length >= 2) {
      // Use the async generateSchedule function
      await generateSchedule(league, numWeeks);
      console.log(`DEBUG: Generated schedule with ${league.schedule.length} weeks`);
    } else {
      console.log(`DEBUG: Not enough teams to generate a schedule`);
    }
    
    // Update league in MongoDB
    try {
      // Make sure maxTeams is a number before saving
      league.maxTeams = maxTeams;
      
      const leagueDoc = await League.findOne({ id: leagueId });
      if (leagueDoc) {
        leagueDoc.teams = league.teams.map(team => team.id);
        leagueDoc.schedule = league.schedule;
        leagueDoc.maxTeams = maxTeams;
        await leagueDoc.save();
      } else {
        const newLeague = new League({
          id: league.id,
          name: league.name,
          maxTeams: maxTeams,
          teams: league.teams.map(team => team.id),
          schedule: league.schedule,
          currentWeek: league.currentWeek || 1,
          memberIds: league.memberIds || [],
          creatorId: league.creatorId,
          description: league.description || '',
          isPublic: league.isPublic !== false,
          regions: league.regions || ['AMERICAS', 'EMEA']
        });
        await newLeague.save();
      }
      
      console.log(`DEBUG: Saved league ${leagueId} to MongoDB`);
    } catch (error) {
      console.error('Error saving league to database:', error);
      // Continue anyway to return what we've done so far
    }
    
    // Return the updated league and created teams
    return res.status(200).json({
      message: `Successfully filled league with ${createdTeams.length} teams and generated a ${league.schedule ? league.schedule.length : 0}-week schedule`,
      league,
      createdTeams
    });
  } catch (error) {
    console.error('Error filling league:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API endpoint to set a schedule for a league
app.post('/api/leagues/:id/schedule', auth, async (req, res) => {
  const { id } = req.params;
  const { weeks } = req.body;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    console.log(`League ${id} not found`);
    return res.status(404).json({ message: 'League not found' });
  }
  
  console.log(`League ${id} found with ${league.teams?.length || 0} teams`);
  
  if (league.creatorId !== req.user.id && !req.user.isAdmin) {
    console.log(`User ${req.user.id} not authorized to set schedule for league ${id}`);
    return res.status(403).json({ message: 'Not authorized to set schedule' });
  }
  
  // Generate the schedule
  try {
    console.log(`Calling generateSchedule for league ${id}`);
    await generateSchedule(league, weeks || 9);
    console.log(`Schedule generated for league ${id}`);
    console.log(`League now has ${league.schedule?.length || 0} weeks in schedule`);
    
    if (league.schedule && league.schedule.length > 0) {
      console.log(`Week 1 has ${league.schedule[0]?.matchups?.length || 0} matchups`);
      if (league.schedule[0]?.matchups?.length > 0) {
        console.log(`First matchup: ${JSON.stringify(league.schedule[0].matchups[0])}`);
      }
    }
    
    // Save the updated league data
    await saveLeagueData();
    console.log(`League data saved to MongoDB`);
    
    // Return the schedule
    res.json(league.schedule);
  } catch (error) {
    console.error(`Failed to generate schedule for league ${id}:`, error);
    res.status(500).json({ message: 'Failed to generate schedule', error: error.message });
  }
});

// Authentication routes
app.post('/api/users/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      console.log('Register:', req.body);

      const user = await userService.registerUser(username, email, password);

      // Generate JWT token
      const token = user.generateToken();
      
      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: user.toJSON()
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // Login
  app.post('/api/users/login', async (req, res) => {
    console.log('Login attempt:', req.body);
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      const user = await userService.loginUser(username, password);
    
      // Generate JWT token
      const token = user.generateToken();
      
      res.json({
        message: 'Login successful',
        token,
        user: user.toJSON()
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  

  // Get current user profile
  app.get('/api/users/me', auth, async (req, res) => {
    res.json(req.user.toJSON());
  });

// Draft a player to a team
app.post('/api/draft/pick', async (req, res) => {
    const { teamId, playerId, position } = req.body;
    
    if (!teamId || !playerId || !position) {
      return res.status(400).json({ message: 'Team ID, player ID, and position are required' });
    }
    
    const team = teamService.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    const player = playerService.getPlayerById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    try {
      // Check if player is already drafted
      let isDrafted = false;
      for (const existingTeam of leagueService.getAllLeagues()[0].teams) {
        // Check main positions
        for (const pos of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"]) {
          if (existingTeam.players[pos] && existingTeam.players[pos].id === playerId) {
            isDrafted = true;
            break;
          }
        }
        
        // Check bench
        if (!isDrafted && existingTeam.players.BENCH) {
          for (const benchPlayer of existingTeam.players.BENCH) {
            if (benchPlayer.id === playerId) {
              isDrafted = true;
              break;
            }
          }
        }
        
        if (isDrafted) break;
      }
      
      if (isDrafted) {
        return res.status(400).json({ message: 'Player has already been drafted' });
      }
      
      // Add player to team
      const success = team.addPlayer(player, position);
      if (!success) {
        return res.status(400).json({ message: `Cannot add player to ${position} position` });
      }
      
      // Mark the player as drafted in the main league
      player.drafted = true;
      
      // Save teams to MongoDB
      const existingTeam = await FantasyTeam.findOneAndUpdate(
        { id: teamId },
        { 
          $set: {
            id: teamId,
            name: team.name,
            owner: team.owner,
            userId: team.userId, // Ensure userId is saved
            leagueId: team.leagueId || league.id, // Ensure leagueId is set
            totalPoints: team.totalPoints,
            weeklyPoints: team.weeklyPoints
          }
        },
        { upsert: true, new: true }
      );
      
      // Save league to database after each team is added
      const updatedLeague = await League.findOneAndUpdate(
        { id: league.id },
        { 
          $set: {
            teams: league.teams,
            maxTeams: league.maxTeams,
            name: league.name,
            description: league.description,
            isPublic: league.isPublic,
            regions: league.regions,
            memberIds: league.memberIds,
            creatorId: league.creatorId,
            currentWeek: league.currentWeek,
            playerPool: league.playerPool,
            standings: league.standings
          }
        },
        { upsert: true, new: true }
      );
      
      createdTeams.push(team);
    } catch (error) {
      console.error(`Error during draft:`, error);
      res.status(500).json({ message: 'Error during draft operation', error: error.message });
    }
  });
  
  // Get draft status and available players
  app.get('/api/draft/status', (req, res) => {
    // Get the league ID from the query parameter or use a default
    const leagueId = req.query.leagueId;
    const league = leagueService.getLeagueById(leagueId);
    
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    const availablePlayers = league.playerPool.filter(player => !player.drafted);
    
    // Calculate how many players each team has drafted
    const teamDraftCounts = league.teams.map(team => {
      const draftedCount = Object.values(team.players).filter(p => p !== null && !Array.isArray(p)).length;
      return {
        id: team.id,
        name: team.name,
        owner: team.owner,
        draftedCount
      };
    });
    
    res.json({
      availablePlayers,
      teamDraftCounts,
      draftComplete: availablePlayers.length === 0 || teamDraftCounts.every(t => t.draftedCount >= 5)
    });
  });

// Get all players
app.get('/api/players', (req, res) => {
  const players = playerService.getAllPlayers();
  res.json(players);
});

// Clear cache (admin only)
app.post('/api/admin/clear-cache', auth, (req, res) => {
  // Check if user is admin (you'd need to implement this check)
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  
  // Clear player service cache
  playerService.clearCache();
  
  // You could clear other caches here too
  
  res.json({ message: 'Cache cleared successfully' });
});

// Get players by region
app.get('/api/players/region/:region', (req, res) => {
  const { region } = req.params;
  const players = playerService.getPlayersByRegion(region);
  res.json(players);
});

// Get players by position
app.get('/api/players/position/:position', (req, res) => {
  const { position } = req.params;
  const players = playerService.getPlayersByPosition(position);
  res.json(players);
});

// Get player by ID
app.get('/api/players/:id', (req, res) => {
  const { id } = req.params;
  const player = playerService.getPlayerById(id);
  
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }
  
  res.json(player);
});

// Update player stats from Riot API
app.post('/api/players/:id/update', async (req, res) => {
  const { id } = req.params;
  try {
    const success = await playerService.updatePlayerStatsFromRiotApi(id);
    
    if (!success) {
      return res.status(404).json({ message: 'Player not found or stats update failed' });
    }
    
    // Save updated player data
    const existingPlayer = await Player.findOne({ id: playerService.getPlayerById(id).id });
    
    if (existingPlayer) {
      console.log(`DEBUG: Updating existing player ${id}`);
      existingPlayer.stats = playerService.getPlayerById(id).stats;
      
      await existingPlayer.save()
        .then(() => {
          console.log(`DEBUG: Updated player ${id} with stats`);
        });
    } else {
      console.log(`DEBUG: Creating new player ${id}`);
      const newPlayer = new Player({
        id: playerService.getPlayerById(id).id,
        name: playerService.getPlayerById(id).name,
        position: playerService.getPlayerById(id).position,
        team: playerService.getPlayerById(id).team,
        region: playerService.getPlayerById(id).region,
        homeLeague: playerService.getPlayerById(id).homeLeague,
        firstName: playerService.getPlayerById(id).firstName,
        lastName: playerService.getPlayerById(id).lastName,
        stats: playerService.getPlayerById(id).stats,
        fantasyPoints: playerService.getPlayerById(id).fantasyPoints
      });
      await newPlayer.save()
        .then(() => {
          console.log(`DEBUG: Created new player ${id} with stats`);
        });
    }
    
    res.json({ message: 'Player stats updated successfully' });
  } catch (error) {
    console.error(`Error updating player ${id}:`, error);
    res.status(500).json({ message: 'Error updating player stats', error: error.message });
  }
});

// API endpoint to update player image
app.post('/api/players/:id/update-image', auth, async (req, res) => {
  const { id } = req.params;
  const { imageUrl } = req.body;
  
  if (!imageUrl) {
    return res.status(400).json({ message: 'Image URL is required' });
  }
  
  try {
    const player = playerService.getPlayerById(id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    // Update player image in memory
    player.imageUrl = imageUrl;
    
    // Save updated player data to MongoDB
    const playerDoc = await Player.findOne({ id: player.id });
    if (playerDoc) {
      playerDoc.imageUrl = imageUrl;
      await playerDoc.save()
        .then(() => {
          console.log(`DEBUG: Updated player ${id} with image URL`);
        });
      res.json({ message: 'Player image updated successfully', player: { id, imageUrl } });
    } else {
      return res.status(404).json({ message: 'Player not found in database' });
    }
  } catch (error) {
    console.error('Error updating player image:', error);
    res.status(500).json({ message: 'Error updating player image' });
  }
});

// Get all teams
app.get('/api/teams', (req, res) => {
  const teams = teamService.getAllTeams();
  res.json(teams);
});

// Get user's teams
app.get('/api/teams/my-teams', auth, async (req, res) => {
  console.log('Fetching teams for user:', req.user.id);
  
  try {
    const userTeams = teamService.getTeamsByUserId(req.user.id);
    console.log(`Found ${userTeams.length} teams for user ${req.user.id}`);
    
    // Enhance teams with league information
    const enhancedTeams = userTeams.map(team => {
      let leagueInfo = { leagueName: 'Not assigned', leagueId: null };
      
      if (team.leagueId) {
        try {
          const league = leagueService.getLeagueById(team.leagueId);
          if (league) {
            leagueInfo = {
              leagueName: league.name,
              leagueId: league.id
            };
          } else {
            console.log(`League ${team.leagueId} not found for team ${team.id}`);
          }
        } catch (error) {
          console.error(`Error fetching league ${team.leagueId} for team ${team.id}:`, error);
        }
      }
      
      // Ensure team has players object and totalPoints
      if (!team.players) {
        team.players = {};
      }
      
      if (team.totalPoints === undefined) {
        team.totalPoints = 0;
      }
      
      return {
        ...team,
        ...leagueInfo
      };
    });
    
    res.json(enhancedTeams);
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({ message: 'Error fetching teams', error: error.message });
  }
});

// Get team by ID
app.get('/api/teams/:id', (req, res) => {
  const { id } = req.params;
  const team = teamService.getTeamById(id);
  
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  
  res.json(team);
});

// Get all leagues
app.get('/api/leagues', (req, res) => {
  const leagues = leagueService.getAllLeagues();
  res.json(leagues);
});

// Get user's leagues
app.get('/api/leagues/my-leagues', auth, async (req, res) => {
  console.log('Fetching leagues for user:', req.user.id);
  
  try {
    // Get all leagues
    const allLeagues = leagueService.getAllLeagues();
    
    // Filter leagues where user is a member
    const userLeagues = allLeagues.filter(league => {
      return league.memberIds && league.memberIds.includes(req.user.id);
    });
    
    console.log(`Found ${userLeagues.length} leagues for user ${req.user.id}`);
    res.json(userLeagues);
  } catch (error) {
    console.error('Error fetching user leagues:', error);
    res.status(500).json({ message: 'Error fetching leagues', error: error.message });
  }
});

// Get league by ID
app.get('/api/leagues/:id', (req, res) => {
  const { id } = req.params;
  
  // Try to get the league with exact matching first
  let league = leagueService.getLeagueById(id);
  
  // If not found and id is valid, try more flexible matching
  if (!league && id) {
    const normalizedId = id.toString().trim().toLowerCase();
    
    // Try to find the league with more flexible matching
    league = leagueService.getAllLeagues().find(l => 
      l.id && l.id.toString().trim().toLowerCase() === normalizedId
    );
  }
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  // Convert circular structure to JSON
  const safeLeague = {
    id: league.id,
    name: league.name,
    maxTeams: league.maxTeams,
    description: league.description || '',
    isPublic: league.isPublic,
    regions: league.regions || [],
    creatorId: league.creatorId,
    memberIds: league.memberIds || [],
    currentWeek: league.currentWeek || 1,
    teams: Array.isArray(league.teams) ? league.teams.map(team => {
      // If team is an object, extract just the necessary properties
      if (typeof team === 'object' && team !== null) {
        return {
          id: team.id,
          name: team.name,
          owner: team.owner,
          userId: team.userId,
          leagueId: team.leagueId || league.id
        };
      }
      // If team is just an ID, return it as is
      return team;
    }) : [],
    schedule: league.schedule || [],
    standings: league.standings || [],
    playerPool: Array.isArray(league.playerPool) ? league.playerPool.map(player => {
      // If player is an object, extract just the necessary properties
      if (typeof player === 'object' && player !== null) {
        return {
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          region: player.region,
          homeLeague: player.homeLeague
        };
      }
      // If player is just an ID, return it as is
      return player;
    }) : []
  };
  
  res.json(safeLeague);
});

// Join a league - with enhanced error handling
app.post('/api/leagues/:id/join', auth, async (req, res) => {
  console.log('======= JOIN LEAGUE API CALL START =======');
  const { id } = req.params;
  const userId = req.user.id;
  const { teamName } = req.body;
  
  console.log(`Join league request: ID=${id}, userId=${userId}, teamName=${teamName}`);
  
  if (!teamName) {
    console.log('Error: Team name is required');
    return res.status(400).json({ message: 'Team name is required' });
  }
  
  try {
    console.log(`User ${userId} is joining league ${id} with team name "${teamName}"`);
    
    // First check if the league exists in MongoDB
    const mongoLeague = await League.findOne({ id });
    if (!mongoLeague) {
      console.log(`League with ID ${id} not found in MongoDB`);
      return res.status(404).json({ message: 'League not found' });
    }
    
    console.log(`MongoDB League details:
    - ID: ${mongoLeague.id}
    - Name: ${mongoLeague.name}
    - maxTeams: ${mongoLeague.maxTeams} (type: ${typeof mongoLeague.maxTeams})
    - Current teams: ${mongoLeague.teams?.length || 0}
    `);
    
    // Get the league from the service
    const league = leagueService.getLeagueById(id, false);
    if (!league) {
      return res.status(404).json({ message: 'League not found in service' });
    }
    
    // Ensure maxTeams is correctly set from MongoDB
    if (mongoLeague.maxTeams && typeof mongoLeague.maxTeams === 'number' && mongoLeague.maxTeams > 0) {
      league.maxTeams = mongoLeague.maxTeams;
      console.log(`Updated league.maxTeams to ${league.maxTeams} from MongoDB`);
    } else if (typeof league.maxTeams !== 'number' || league.maxTeams <= 0) {
      league.maxTeams = 12; // Default value
      console.log(`Set default maxTeams value of 12 for league ${league.id}`);
    }
    
    // Log detailed league info
    console.log(`League details after update:
    - ID: ${league.id}
    - Name: ${league.name}
    - maxTeams: ${league.maxTeams} (type: ${typeof league.maxTeams})
    - Current teams: ${league.teams?.length || 0}
    - Teams array is Array: ${Array.isArray(league.teams)}
    - memberIds: ${league.memberIds?.length || 0}
    `);
    
    // Ensure teams array is properly initialized
    if (!Array.isArray(league.teams)) {
      console.log(`League ${league.id} teams array is not properly initialized, fixing it`);
      league.teams = [];
    }
    
    // Check if league is full
    console.log(`League ${league.id} has ${league.teams.length}/${league.maxTeams} teams`);
    
    if (league.teams.length >= league.maxTeams) {
      console.log(`ERROR: League ${league.id} is full (${league.teams.length}/${league.maxTeams})`);
      return res.status(400).json({ 
        message: 'League is full', 
        teamCount: league.teams.length,
        maxTeams: league.maxTeams 
      });
    }
    
    // Check if user is already in the league
    const userTeamInLeague = league.teams.find(team => {
      const t = teamService.getTeamById(typeof team === 'object' ? team.id : team);
      console.log(`Checking team ${typeof team === 'object' ? team.id : team}: userId=${t?.userId}, comparing to ${userId}`);
      return t && t.userId === userId;
    });
    
    if (userTeamInLeague) {
      console.log(`ERROR: User ${userId} already has a team in league ${id}`);
      return res.status(400).json({ message: 'You already have a team in this league' });
    }
    
    // Add user to league members if not already a member
    if (!league.memberIds.includes(userId)) {
      console.log(`Adding user ${userId} to league members`);
      league.addMember(userId);
    }
    
    // Create a new team for the user
    console.log(`Creating new team for user ${userId} with name "${teamName}" in league ${id}`);
    const team = teamService.createTeam(teamName, req.user.username, req.user.id, id);
    console.log(`Created new team ${team.id} for user ${userId}`);
    
    // Add to league
    if (typeof league.addTeam === 'function') {
      // Use the method if available
      const added = league.addTeam(team);
      console.log(`DEBUG: Added team to league using addTeam method: ${added}`);
    } else {
      // Manually add the team if the method is not available
      console.log(`DEBUG: league.addTeam is not a function, adding team manually`);
      
      // Initialize teams array if it doesn't exist
      if (!Array.isArray(league.teams)) {
        league.teams = [];
      }
      
      // Check if team is already in the league
      const teamExists = league.teams.some(t => 
        (typeof t === 'object' && t.id === team.id) || t === team.id
      );
      
      if (teamExists) {
        console.log(`DEBUG: Team ${team.id} is already in league ${league.id}`);
      } else {
        // Check if league is full
        if (league.teams.length < league.maxTeams) {
          // Add the team ID to the teams array (not the full object)
          league.teams.push(team.id);
          console.log(`DEBUG: Added team ${team.id} to league ${league.id}, now has ${league.teams.length}/${league.maxTeams} teams`);
        } else {
          console.log(`DEBUG: Cannot add team ${team.id} to league ${league.id} because it is full (${league.teams.length}/${league.maxTeams})`);
        }
      }
    }
    
    // Save the league data to MongoDB FIRST and await completion
    try {
      console.log(`Saving league data to MongoDB...`);
      await saveLeagueData();
      console.log(`DEBUG: Successfully saved league data to MongoDB`);
    } catch (saveError) {
      console.error('Error saving league data:', saveError);
      return res.status(500).json({ message: 'Error saving league data', error: saveError.message });
    }
    
    // Save the team to MongoDB
    try {
      // Create or update team in MongoDB
      const existingTeam = await FantasyTeam.findOne({ id: team.id });
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${team.id}`);
        existingTeam.name = team.name;
        existingTeam.owner = team.owner;
        existingTeam.players = team.players;
        existingTeam.leagueId = team.leagueId;
        existingTeam.userId = team.userId;
        
        await existingTeam.save()
          .then(() => {
            console.log(`DEBUG: Updated team ${team.id} in MongoDB`);
          });
      } else {
        console.log(`DEBUG: Creating new team ${team.id}`);
        const newTeam = new FantasyTeam({
          id: team.id,
          name: team.name,
          owner: team.owner,
          userId: req.user.id, // Add the user ID from the auth token
          leagueId: id, // Use the leagueId parameter directly
          players: team.players
        });
        
        await newTeam.save()
          .then(() => {
            console.log(`DEBUG: Created new team ${team.id} in MongoDB`);
          });
      }
      
      // Verify MongoDB changes were applied
      const verifyTeam = await FantasyTeam.findOne({ id: team.id });
      if (verifyTeam) {
        console.log(`Verified team ${team.id} exists in MongoDB`);
      } else {
        console.log(`WARNING: Could not verify team ${team.id} in MongoDB after save`);
      }
      
      // Get a completely fresh league with teams fully resolved
      const updatedLeague = leagueService.getLeagueById(id, true, true);
      console.log(`After save, league ${id} has ${updatedLeague.teams.length}/${updatedLeague.maxTeams} teams`);
      
      // Create a safe serializable team object to avoid circular references
      const safeTeam = {
        id: team.id,
        name: team.name,
        owner: team.owner,
        leagueId: team.leagueId,
        userId: team.userId,
        totalPoints: team.totalPoints || 0,
        players: team.players || {}
      };
      
      // Return both the safe team and updated league info for immediate UI update
      res.status(201).json({
        message: 'Successfully joined league',
        team: safeTeam,
        league: updatedLeague
      });
    } catch (error) {
      console.error('Error saving team/league data:', error);
      res.status(500).json({ message: 'Error joining league', error: error.message });
    }
  } catch (error) {
    console.error('ERROR JOINING LEAGUE:', error);
    // Send a properly formatted error response
    return res.status(500).json({ 
      message: 'Error joining league', 
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack 
    });
  } finally {
    console.log('======= JOIN LEAGUE API CALL END =======');
  }
});

// Create a new team (requires league membership)
app.post('/api/teams', auth, async (req, res) => {
    const { name, leagueId } = req.body;
    console.log(`DEBUG: Creating team "${name}" in league ${leagueId} for user ${req.user.id}`);
    
    if (!name) {
      return res.status(400).json({ message: 'Team name is required' });
    }
    
    if (!leagueId) {
      return res.status(400).json({ message: 'League ID is required' });
    }
    
    // Check if user is a member of the league
    const league = leagueService.getLeagueById(leagueId);
    if (!league) {
      console.log(`DEBUG: League ${leagueId} not found`);
      return res.status(404).json({ message: 'League not found' });
    }
    
    console.log(`DEBUG: League ${leagueId} found. League.memberIds: [${league.memberIds}], user.id: ${req.user.id}`);
    
    // Filter out null values in memberIds
    const validMemberIds = league.memberIds.filter(id => id !== null && id !== undefined);
    
    // If the user created this league, automatically make them a member if they aren't already
    if (league.creatorId === req.user.id && !validMemberIds.includes(req.user.id)) {
      console.log(`DEBUG: User ${req.user.id} is the creator but not a member. Adding them as a member.`);
      leagueService.addMemberToLeague(leagueId, req.user.id);
      console.log(`DEBUG: After adding creator, league.memberIds: [${league.memberIds}]`);
    }
    
    // Check membership again after potential auto-adding
    if (!validMemberIds.includes(req.user.id)) {
      console.log(`DEBUG: User ${req.user.id} is not a member of league ${leagueId}`);
      return res.status(403).json({ message: 'You must join this league before creating a team' });
    }
    
    // Use the authenticated user's username as the owner
    const owner = req.user.username;
    
    const team = teamService.createTeam(name, owner, req.user.id, leagueId);
    // Removed redundant leagueId assignment since it's now handled in the createTeam method
    // team.leagueId = leagueId; // Associate team with league
    
    // Update user's teams
    userService.updateUserTeams(req.user.id, team.id, 'add');
    
    // Add to league
    if (typeof league.addTeam === 'function') {
      // Use the method if available
      const added = league.addTeam(team);
      console.log(`DEBUG: Added team to league using addTeam method: ${added}`);
    } else {
      // Manually add the team if the method is not available
      console.log(`DEBUG: league.addTeam is not a function, adding team manually`);
      
      // Initialize teams array if it doesn't exist
      if (!Array.isArray(league.teams)) {
        league.teams = [];
      }
      
      // Check if team is already in the league
      const teamExists = league.teams.some(t => 
        (typeof t === 'object' && t.id === team.id) || t === team.id
      );
      
      if (teamExists) {
        console.log(`DEBUG: Team ${team.id} is already in league ${league.id}`);
      } else {
        // Check if league is full
        if (league.teams.length < league.maxTeams) {
          // Add the team ID to the teams array (not the full object)
          league.teams.push(team.id);
          console.log(`DEBUG: Added team ${team.id} to league ${league.id}, now has ${league.teams.length}/${league.maxTeams} teams`);
        } else {
          console.log(`DEBUG: Cannot add team ${team.id} to league ${league.id} because it is full (${league.teams.length}/${league.maxTeams})`);
        }
      }
    }
    
    await saveLeagueData()
      .then(() => {
        console.log(`DEBUG: Saved league data to MongoDB`);
      });
    res.status(201).json(team);
  });

// Add player to team
app.post('/api/teams/:teamId/players', auth, async (req, res) => {
  const { teamId } = req.params;
  const { playerId, slot } = req.body;
  
  if (!playerId || !slot) {
    return res.status(400).json({ message: 'Player ID and slot are required' });
  }
  
  const team = teamService.getTeamById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  
    // Check ownership
    if (team.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'You do not own this team' });
     }
  const player = playerService.getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }
  
  const success = team.addPlayer(player, slot);
  if (!success) {
    return res.status(400).json({ message: `Cannot add player to ${slot} slot` });
  }
  
  // Save teams to MongoDB
  FantasyTeam.findOne({ id: teamId })
    .then(existingTeam => {
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${teamId}`);
        existingTeam.players = team.players;
        return existingTeam.save()
          .then(() => {
            console.log(`DEBUG: Updated team ${teamId} in MongoDB`);
          });
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        // Get the league ID from the team object
        const league = leagueService.getLeagueByTeamId(teamId);
        if (!league) {
          return res.status(404).json({ message: 'League not found for this team' });
        }
        
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          userId: req.user.id, // Add the user ID from the auth token
          leagueId: league.id, // Add the league ID
          players: team.players
        });
        
        return newTeam.save()
          .then(() => {
            console.log(`DEBUG: Created new team ${teamId} in MongoDB`);
          });
      }
    })
    .then(() => {
      res.json(team);
    })
    .catch(error => {
      console.error('Error saving team:', error);
      res.status(500).json({ message: 'Error saving team' });
    });
});

// Remove player from team
app.post('/api/teams/:teamId/remove-player', auth, async (req, res) => {
  const { teamId } = req.params;
  const { playerId } = req.body;
  
  const team = teamService.getTeamById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  
  // Check ownership
  if (team.userId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'You do not own this team' });
  }
  
  const success = team.removePlayer(playerId);
  if (!success) {
    return res.status(404).json({ message: 'Player not found on team' });
  }
  
  // Save teams to MongoDB
  FantasyTeam.findOne({ id: teamId })
    .then(existingTeam => {
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${teamId}`);
        existingTeam.players = team.players;
        return existingTeam.save()
          .then(() => {
            console.log(`DEBUG: Updated team ${teamId} in MongoDB`);
          });
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          players: team.players
        });
        return newTeam.save()
          .then(() => {
            console.log(`DEBUG: Created new team ${teamId} in MongoDB`);
          });
      }
    })
    .then(() => {
      res.json(team);
    })
    .catch(error => {
      console.error('Error saving team:', error);
      res.status(500).json({ message: 'Error saving team' });
    });
});

// Get league info with fully resolved team objects - with enhanced error handling
app.get('/api/leagues/:id', async (req, res) => {
  console.log('======= GET LEAGUE API CALL START =======');
  const { id } = req.params;
  
  // Get forceRefresh query parameter (optional)
  const forceRefresh = req.query.refresh === 'true';
  
  console.log(`GET /api/leagues/${id} (forceRefresh=${forceRefresh})`);
  
  try {
    // Check if league exists first
    const leagueExists = leagueService.leagues.some(league => league.id === id);
    if (!leagueExists) {
      console.log(`League with ID ${id} not found in service`);
      return res.status(404).json({ message: 'League not found' });
    }
    
    // Use enhanced getLeagueById with team resolution and optional force refresh
    console.log(`Fetching league ${id} with resolveTeams=true, forceRefresh=${forceRefresh}`);
    const league = leagueService.getLeagueById(id, true, forceRefresh);
    
    if (!league) {
      console.log(`League ${id} not returned from getLeagueById`);
      return res.status(404).json({ message: 'League not found' });
    }
    
    // Verify the league has the expected structure before sending
    if (typeof league !== 'object') {
      console.error(`Invalid league object type: ${typeof league}`);
      return res.status(500).json({ message: 'Invalid league data format' });
    }
    
    // Make a safe copy for sending as JSON
    const safeLeague = {
      id: league.id,
      name: league.name,
      teams: Array.isArray(league.teams) ? league.teams : [],
      maxTeams: league.maxTeams,
      currentWeek: league.currentWeek,
      isPublic: league.isPublic,
      memberIds: Array.isArray(league.memberIds) ? league.memberIds : [],
      creatorId: league.creatorId,
      description: league.description,
      regions: league.regions
    };
    
    // Return fully resolved league with team objects (not just IDs)
    console.log(`Successfully returning league ${id} with ${safeLeague.teams.length} teams`);
    res.json(safeLeague);
  } catch (error) {
    console.error('ERROR GETTING LEAGUE:', error);
    res.status(500).json({ 
      message: 'Error getting league', 
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack 
    });
  } finally {
    console.log('======= GET LEAGUE API CALL END =======');
  }
});

// Get league standings
app.get('/api/leagues/:id/standings', (req, res) => {
  console.log(`Getting standings for league ${req.params.id}`);
  const { id } = req.params;
  
  try {
    // Get the original league from the in-memory store, not the serialized version
    const originalLeague = leagueService.leagues.find(league => league.id === id);
    
    if (!originalLeague) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    // Use the original league instance which has class methods
    const standings = originalLeague.updateStandings ? originalLeague.updateStandings() : [];
    
    console.log(`Successfully retrieved standings for league ${id}`);
    res.json(standings);
  } catch (error) {
    console.error(`Error getting standings for league ${id}:`, error);
    res.status(500).json({ message: 'Error getting league standings', error: error.message });
  }
});

// Get league matchups for a specific week
app.get('/api/leagues/:id/matchups/:week', (req, res) => {
  console.log(`Getting matchups for league ${req.params.id} week ${req.params.week}`);
  const { id, week } = req.params;
  
  try {
    // Get the original league from the in-memory store, not the serialized version
    const originalLeague = leagueService.leagues.find(league => league.id === id);
    
    if (!originalLeague) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    const weekNumber = parseInt(week) || originalLeague.currentWeek || 1;
    
    // Use the original league instance which has class methods
    const matchups = originalLeague.getWeekMatchups ? originalLeague.getWeekMatchups(weekNumber) : [];
    
    console.log(`Successfully retrieved matchups for league ${id} week ${weekNumber}`);
    res.json(matchups);
  } catch (error) {
    console.error(`Error getting matchups for league ${id} week ${week}:`, error);
    res.status(500).json({ message: 'Error getting league matchups', error: error.message });
  }
});

// Calculate scores for a specific week
app.post('/api/leagues/:id/calculate/:week', (req, res) => {
  console.log(`Calculating scores for league ${req.params.id} week ${req.params.week}`);
  const { id, week } = req.params;
  
  try {
    // Get the original league from the in-memory store, not the serialized version
    const originalLeague = leagueService.leagues.find(league => league.id === id);
    
    if (!originalLeague) {
      console.log(`League ${id} not found`);
      return res.status(404).json({ message: 'League not found' });
    }
    
    const weekNumber = parseInt(week) || originalLeague.currentWeek || 1;
    
    // Calculate scores for the week
    const success = originalLeague.calculateWeekScores ? originalLeague.calculateWeekScores(weekNumber) : false;
    
    if (!success) {
      return res.status(400).json({ message: 'Failed to calculate scores' });
    }
    
    // Update standings after calculating scores
    if (originalLeague.updateStandings) {
      originalLeague.updateStandings();
    }
    
    // Get the updated matchups
    const matchups = originalLeague.getWeekMatchups ? originalLeague.getWeekMatchups(weekNumber) : [];
    res.json(matchups);
    console.log(`Successfully calculated scores for league ${id} week ${weekNumber}`);
  } catch (error) {
    console.error(`Error calculating scores for league ${id} week ${week}:`, error);
    res.status(500).json({ message: 'Error calculating scores', error: error.message });
  }
});

// Generate a schedule for the league
app.post('/api/leagues/:id/schedule', async (req, res) => {
  const { id } = req.params;
  const { weeks } = req.body;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  const success = await generateSchedule(league, weeks || 9);
  
  if (!success) {
    return res.status(400).json({ 
      message: 'Failed to generate schedule. Need at least 2 teams in the league.'
    });
  }
  
  await saveLeagueData()
    .then(() => {
      console.log(`DEBUG: Saved league data to MongoDB`);
    });
  res.json(league.schedule);
});

// Update all player stats
app.post('/api/leagues/:id/update-stats', async (req, res) => {
  const { id } = req.params;
  const league = leagueService.getLeagueById(id);
  
  if (!league || !riotApiService) {
    return res.status(404).json({ message: 'League or Riot API service not found' });
  }
  
  try {
    await updateRealTimeStats(league, riotApiService);
    // Save updated player data
    for (const player of playerService.getAllPlayers()) {
      const existingPlayer = await Player.findOne({ id: player.id });
      
      if (existingPlayer) {
        console.log(`DEBUG: Updating existing player ${player.id}`);
        existingPlayer.stats = playerService.getPlayerById(player.id).stats;
        
        await existingPlayer.save()
          .then(() => {
            console.log(`DEBUG: Updated player ${player.id} with stats`);
          });
      } else {
        console.log(`DEBUG: Creating new player ${player.id}`);
        const newPlayer = new Player({
          id: player.id,
          name: playerService.getPlayerById(player.id).name,
          position: playerService.getPlayerById(player.id).position,
          team: playerService.getPlayerById(player.id).team,
          region: playerService.getPlayerById(player.id).region,
          homeLeague: playerService.getPlayerById(player.id).homeLeague,
          firstName: playerService.getPlayerById(player.id).firstName,
          lastName: playerService.getPlayerById(player.id).lastName,
          stats: playerService.getPlayerById(player.id).stats,
          fantasyPoints: playerService.getPlayerById(player.id).fantasyPoints
        });
        await newPlayer.save()
          .then(() => {
            console.log(`DEBUG: Created new player ${player.id} with stats`);
          });
      }
    }
    // Save updated league data
    await saveLeagueData()
      .then(() => {
        console.log(`DEBUG: Saved league data to MongoDB`);
      });
    res.json({ message: 'Player stats updated successfully' });
  } catch (error) {
    console.error('Error updating player stats:', error);
    res.status(500).json({ message: 'Error updating player stats', error: error.message });
  }
});

// API endpoint to advance the league to the next week
app.post('/api/leagues/:id/advance-week', auth, (req, res) => {
  const { id } = req.params;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  // Check if user is authorized (league creator or admin)
  if (league.creatorId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to advance week' });
  }
  
  // Advance the week
  league.currentWeek += 1;
  
  // Update standings if needed
  if (league.currentWeek > 1) {
    league.updateStandings();
  }
  
  // Save league data
  saveLeagueData()
    .then(() => {
      console.log(`DEBUG: Saved league data to MongoDB`);
    })
    .then(() => {
      res.json({
        message: 'Week advanced successfully',
        currentWeek: league.currentWeek
      });
    })
    .catch(error => {
      console.error('Error saving league data:', error);
      res.status(500).json({ message: 'Error saving league data' });
    });
});

// API endpoint to generate a schedule for a league
app.post('/api/leagues/:id/generate-schedule', auth, async (req, res) => {
  const { id } = req.params;
  const { weeks } = req.body;
  
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  // Check if user is authorized (league creator or admin)
  if (league.creatorId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to generate schedule' });
  }
  
  // Generate the schedule
  try {
    await generateSchedule(league, weeks || 9);
  } catch (error) {
    return res.status(400).json({
      message: 'Failed to generate schedule',
      error: error.message
    });
  }
  
  saveLeagueData()
    .then(() => {
      console.log(`DEBUG: Saved league data to MongoDB`);
    })
    .then(() => {
      res.json(league.schedule);
    })
    .catch(error => {
      console.error('Error saving league data:', error);
      res.status(500).json({ message: 'Error saving league data' });
    });
});

// API endpoint to update player stats from live games
app.post('/api/leagues/:id/update-stats', auth, (req, res) => {
  const { id } = req.params;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  // Check if user is authorized (league creator or admin)
  if (league.creatorId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to update stats' });
  }
  
  updateRealTimeStats(league, riotApiService)
    .then(() => {
      // Save updated player data
      const promises = playerService.getAllPlayers().map(player => {
        return Player.findOne({ id: player.id })
          .then(existingPlayer => {
            if (existingPlayer) {
              console.log(`DEBUG: Updating existing player ${player.id}`);
              existingPlayer.stats = player.stats;
              return existingPlayer.save()
                .then(() => {
                  console.log(`DEBUG: Updated player ${player.id} with stats`);
                });
            } else {
              console.log(`DEBUG: Creating new player ${player.id}`);
              const newPlayer = new Player({
                id: player.id,
                name: player.name,
                position: player.position,
                team: player.team,
                region: player.region,
                homeLeague: player.homeLeague,
                firstName: player.firstName,
                lastName: player.lastName,
                stats: player.stats,
                fantasyPoints: player.fantasyPoints
              });
              return newPlayer.save()
                .then(() => {
                  console.log(`DEBUG: Created new player ${player.id} with stats`);
                });
            }
          });
      });
      
      return Promise.all(promises)
        .then(() => saveLeagueData())
        .then(() => {
          console.log(`DEBUG: Saved league data to MongoDB`);
        })
        .then(() => {
          res.json({ message: 'Player stats updated successfully' });
        });
    })
    .catch(error => {
      console.error('Error updating stats:', error);
      res.status(500).json({ message: 'Error updating stats' });
    });
});

// API endpoint to add a player to a team
app.post('/api/teams/:teamId/add-player', auth,(req, res) => {
  const { teamId } = req.params;
  const { playerId, slot } = req.body;
  
  if (!playerId || !slot) {
    return res.status(400).json({ message: 'Player ID and slot are required' });
  }
  
  const team = teamService.getTeamById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  
    // Check if user is authorized (team owner or admin)
    if (team.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to modify this team' });
     }
  const player = playerService.getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }
  
  const success = team.addPlayer(player, slot);
  if (!success) {
    return res.status(400).json({ message: `Cannot add player to ${slot} slot` });
  }
  
  // Save teams to MongoDB
  FantasyTeam.findOne({ id: teamId })
    .then(existingTeam => {
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${teamId}`);
        existingTeam.players = team.players;
        return existingTeam.save()
          .then(() => {
            console.log(`DEBUG: Updated team ${teamId} in MongoDB`);
          });
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        // Get the league ID from the team object
        const league = leagueService.getLeagueByTeamId(teamId);
        if (!league) {
          return res.status(404).json({ message: 'League not found for this team' });
        }
        
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          userId: req.user.id, // Add the user ID from the auth token
          leagueId: league.id, // Add the league ID
          players: team.players
        });
        
        return newTeam.save()
          .then(() => {
            console.log(`DEBUG: Created new team ${teamId} in MongoDB`);
          });
      }
    })
    .then(() => {
      res.json(team);
    })
    .catch(error => {
      console.error('Error saving team:', error);
      res.status(500).json({ message: 'Error saving team' });
    });
});

// API endpoint to remove a player from a team
app.post('/api/teams/:teamId/remove-player', auth, async (req, res) => {
  const { teamId } = req.params;
  const { playerId } = req.body;
  
  const team = teamService.getTeamById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  
  // Check if user is authorized (team owner or admin)
  if (team.userId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to modify this team' });
  }
  
  const success = team.removePlayer(playerId);
  if (!success) {
    return res.status(404).json({ message: 'Player not found on team' });
  }
  
  // Save teams to MongoDB
  FantasyTeam.findOne({ id: teamId })
    .then(existingTeam => {
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${teamId}`);
        existingTeam.players = team.players;
        return existingTeam.save()
          .then(() => {
            console.log(`DEBUG: Updated team ${teamId} in MongoDB`);
          });
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          players: team.players
        });
        return newTeam.save()
          .then(() => {
            console.log(`DEBUG: Created new team ${teamId} in MongoDB`);
          });
      }
    })
    .then(() => {
      res.json(team);
    })
    .catch(error => {
      console.error('Error saving team:', error);
      res.status(500).json({ message: 'Error saving team' });
    });
});

// Get league info
app.get('/api/league', (req, res) => {
  // Get the first league as the default
  const leagues = leagueService.getAllLeagues();
  
  if (!leagues || leagues.length === 0) {
    return res.status(404).json({ message: 'No leagues found' });
  }
  
  res.json(leagues[0]);
});

// Trade System Endpoints

// Propose a trade
app.post('/api/trades/propose', auth, async (req, res) => {
  try {
    const { proposingTeamId, receivingTeamId, proposedPlayers, requestedPlayers } = req.body;
    
    if (!proposingTeamId || !receivingTeamId || !proposedPlayers || !requestedPlayers) {
      return res.status(400).json({ message: 'Missing required trade information' });
    }
    
    // Check if both teams exist
    const proposingTeam = teamService.getTeamById(proposingTeamId);
    const receivingTeam = teamService.getTeamById(receivingTeamId);
    
    if (!proposingTeam || !receivingTeam) {
      return res.status(404).json({ message: 'One or both teams not found' });
    }
    
    // Check if user owns the proposing team
    if (proposingTeam.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only propose trades for your own team' });
    }
    
    // Check if teams are in the same league
    if (proposingTeam.leagueId !== receivingTeam.leagueId) {
      return res.status(400).json({ message: 'Teams must be in the same league to trade' });
    }
    
    // Validate that the proposing team has all the proposed players
    for (const playerInfo of proposedPlayers) {
      const position = playerInfo.position;
      const playerId = playerInfo.id;
      
      // Check if the player is in the roster at the specified position
      const playerAtPosition = proposingTeam.players[position];
      if (!playerAtPosition || playerAtPosition.id !== playerId) {
        return res.status(400).json({ 
          message: `Invalid player trade: Player ${playerId} is not in position ${position} on proposing team` 
        });
      }
    }
    
    // Validate that the receiving team has all the requested players
    for (const playerInfo of requestedPlayers) {
      const position = playerInfo.position;
      const playerId = playerInfo.id;
      
      // Check if the player is in the roster at the specified position
      const playerAtPosition = receivingTeam.players[position];
      if (!playerAtPosition || playerAtPosition.id !== playerId) {
        return res.status(400).json({ 
          message: `Invalid player request: Player ${playerId} is not in position ${position} on receiving team` 
        });
      }
    }
    
    // Create a new trade proposal
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newTrade = new Trade({
      id: tradeId,
      proposingTeamId: proposingTeamId,
      receivingTeamId: receivingTeamId,
      proposedPlayers: proposedPlayers,
      requestedPlayers: requestedPlayers,
      status: 'pending',
      leagueId: proposingTeam.leagueId,
      createdBy: req.user.id,
      createdAt: new Date()
    });
    
    await newTrade.save()
      .then(() => {
        console.log(`DEBUG: Saved new trade proposal ${tradeId}`);
      });
    
    res.status(201).json({ 
      message: 'Trade proposal submitted successfully', 
      trade: newTrade 
    });
  } catch (error) {
    console.error('Error creating trade proposal:', error);
    res.status(500).json({ message: 'Failed to create trade proposal' });
  }
});

// Get all trades for a team
app.get('/api/trades/team/:teamId', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = teamService.getTeamById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user owns the team or is league commissioner
    if (team.userId !== req.user.id) {
      // Check if user is league commissioner
      const league = leagueService.getLeagueByTeamId(teamId);
      if (!league || league.commissioner !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to view trades for this team' });
      }
    }
    
    // Find all trades for this team (either proposing or receiving)
    const trades = await Trade.find({
      $or: [
        { proposingTeamId: teamId },
        { receivingTeamId: teamId }
      ]
    }).sort({ createdAt: -1 });
    
    res.json(trades);
  } catch (error) {
    console.error('Error fetching team trades:', error);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
});

// Get all trades for a league
app.get('/api/trades/league/:leagueId', auth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const league = leagueService.getLeagueById(leagueId);
    
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    // Find all trades for this league
    const trades = await Trade.find({ leagueId }).sort({ createdAt: -1 });
    
    res.json(trades);
  } catch (error) {
    console.error('Error fetching league trades:', error);
    res.status(500).json({ message: 'Failed to fetch trades' });
  }
});

// Get a specific trade
app.get('/api/trades/:tradeId', auth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    
    const trade = await Trade.findOne({ id: tradeId });
    
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    res.json(trade);
  } catch (error) {
    console.error('Error fetching trade:', error);
    res.status(500).json({ message: 'Failed to fetch trade' });
  }
});

// Accept a trade
app.post('/api/trades/:tradeId/accept', auth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    
    // Find the trade proposal
    const trade = await Trade.findOne({ id: tradeId });
    
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    // Get the teams involved
    const proposingTeam = teamService.getTeamById(trade.proposingTeamId);
    const receivingTeam = teamService.getTeamById(trade.receivingTeamId);
    
    if (!proposingTeam || !receivingTeam) {
      return res.status(404).json({ message: 'One or both teams not found' });
    }
    
    // Check if user owns the receiving team or is league commissioner
    if (receivingTeam.userId !== req.user.id) {
      // Check if user is league commissioner
      const league = leagueService.getLeagueById(receivingTeam.leagueId);
      if (!league || league.commissioner !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to accept this trade' });
      }
    }
    
    // Check if the trade is still pending
    if (trade.status !== 'pending') {
      return res.status(400).json({ message: `Trade cannot be accepted because it is ${trade.status}` });
    }
    
    // Execute the trade - swap players between teams
    const proposedPlayersCopy = [...trade.proposedPlayers];
    const requestedPlayersCopy = [...trade.requestedPlayers];
    
    // Swap players from proposing team to receiving team
    for (const playerInfo of proposedPlayersCopy) {
      const position = playerInfo.position;
      const player = proposingTeam.players[position];
      receivingTeam.addPlayerToPosition(player, position);
      proposingTeam.removePlayerFromPosition(position);
    }
    
    // Swap players from receiving team to proposing team
    for (const playerInfo of requestedPlayersCopy) {
      const position = playerInfo.position;
      const player = receivingTeam.players[position];
      proposingTeam.addPlayerToPosition(player, position);
      receivingTeam.removePlayerFromPosition(position);
    }
    
    // Update trade status
    trade.status = 'accepted';
    trade.completedAt = new Date();
    await trade.save()
      .then(() => {
        console.log(`DEBUG: Updated trade ${tradeId} to accepted`);
      });
    
    // Save teams to DB
    const proposingTeamDoc = await FantasyTeam.findOne({ id: proposingTeam.id });
    if (proposingTeamDoc) {
      proposingTeamDoc.players = proposingTeam.players;
      proposingTeamDoc.save()
        .then(() => {
          console.log(`DEBUG: Updated team ${proposingTeam.id} in MongoDB`);
        });
    }
    
    const receivingTeamDoc = await FantasyTeam.findOne({ id: receivingTeam.id });
    if (receivingTeamDoc) {
      receivingTeamDoc.players = receivingTeam.players;
      receivingTeamDoc.save()
        .then(() => {
          console.log(`DEBUG: Updated team ${receivingTeam.id} in MongoDB`);
        });
    }
    
    res.json({ 
      message: 'Trade accepted and executed successfully',
      trade: trade
    });
  } catch (error) {
    console.error('Error accepting trade:', error);
    res.status(500).json({ message: 'Failed to accept trade' });
  }
});

// Reject a trade
app.post('/api/trades/:tradeId/reject', auth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    
    // Find the trade proposal
    const trade = await Trade.findOne({ id: tradeId });
    
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    // Get the receiving team
    const receivingTeam = teamService.getTeamById(trade.receivingTeamId);
    
    if (!receivingTeam) {
      return res.status(404).json({ message: 'Receiving team not found' });
    }
    
    // Check if user owns the receiving team or is league commissioner
    if (receivingTeam.userId !== req.user.id) {
      // Check if user is league commissioner
      const league = leagueService.getLeagueById(receivingTeam.leagueId);
      if (!league || league.commissioner !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to reject this trade' });
      }
    }
    
    // Check if the trade is still pending
    if (trade.status !== 'pending') {
      return res.status(400).json({ message: `Trade cannot be rejected because it is ${trade.status}` });
    }
    
    // Update trade status
    trade.status = 'rejected';
    trade.completedAt = new Date();
    await trade.save()
      .then(() => {
        console.log(`DEBUG: Updated trade ${tradeId} to rejected`);
      });
    
    res.json({ 
      message: 'Trade rejected successfully',
      trade: trade
    });
  } catch (error) {
    console.error('Error rejecting trade:', error);
    res.status(500).json({ message: 'Failed to reject trade' });
  }
});

// Cancel a trade (by the proposing team)
app.post('/api/trades/:tradeId/cancel', auth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    
    // Find the trade proposal
    const trade = await Trade.findOne({ id: tradeId });
    
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    // Get the proposing team
    const proposingTeam = teamService.getTeamById(trade.proposingTeamId);
    
    if (!proposingTeam) {
      return res.status(404).json({ message: 'Proposing team not found' });
    }
    
    // Check if user owns the proposing team or is league commissioner
    if (proposingTeam.userId !== req.user.id && !req.user.isAdmin) {
      // Check if user is league commissioner
      const league = leagueService.getLeagueById(proposingTeam.leagueId);
      if (!league || league.commissioner !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to cancel this trade' });
      }
    }
    
    // Check if the trade is still pending
    if (trade.status !== 'pending') {
      return res.status(400).json({ message: `Trade cannot be cancelled because it is ${trade.status}` });
    }
    
    // Update trade status
    trade.status = 'cancelled';
    trade.completedAt = new Date();
    await trade.save()
      .then(() => {
        console.log(`DEBUG: Updated trade ${tradeId} to cancelled`);
      });
    
    res.json({ 
      message: 'Trade cancelled successfully',
      trade: trade
    });
  } catch (error) {
    console.error('Error cancelling trade:', error);
    res.status(500).json({ message: 'Failed to cancel trade' });
  }
});

// FRIEND REQUEST ENDPOINTS

// Send a friend request
app.post('/api/friends/request', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.id;
    
    if (!recipientId) {
      return res.status(400).json({ message: 'Recipient ID is required' });
    }
    
    // Check if recipient exists
    const recipient = await User.findOne({ id: recipientId });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    // Check if sender is trying to add themselves
    if (senderId === recipientId) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
    }
    
    // Check if there's an existing request between these users
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId }
      ]
    });
    
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'A friend request already exists between these users' });
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({ message: 'These users are already friends' });
      }
    }
    
    // Create a new friend request
    const friendRequest = new FriendRequest({
      id: `fr-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      sender: senderId,
      recipient: recipientId,
      status: 'pending'
    });
    
    await friendRequest.save()
      .then(() => {
        console.log(`DEBUG: Saved new friend request ${friendRequest.id}`);
      });
    
    return res.status(201).json({ message: 'Friend request sent successfully', friendRequest });
  } catch (error) {
    console.error('Error sending friend request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get all friend requests for a user
app.get('/api/friends/requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all requests where the user is either sender or recipient
    const requests = await FriendRequest.find({
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    }).sort({ createdAt: -1 });
    
    return res.json(requests);
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Respond to a friend request (accept or reject)
app.put('/api/friends/requests/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    const userId = req.user.id;
    
    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Valid status (accepted or rejected) is required' });
    }
    
    // Find the request
    const request = await FriendRequest.findOne({ id: requestId });
    
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    // Make sure the user is the recipient of the request
    if (request.recipient !== userId) {
      return res.status(403).json({ message: 'Only the recipient can respond to a friend request' });
    }
    
    // Update request status
    request.status = status;
    await request.save()
      .then(() => {
        console.log(`DEBUG: Updated friend request ${requestId} to ${status}`);
      });
    
    return res.json({ message: `Friend request ${status}`, request });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get friend list
app.get('/api/friends', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all accepted friend requests where the user is either sender or recipient
    const friendRequests = await FriendRequest.find({
      status: 'accepted',
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    });
    
    // Extract friend IDs
    const friendIds = friendRequests.map(request => {
      return request.sender === userId ? request.recipient : request.sender;
    });
    
    // Get friend user objects
    const friends = await User.find({ id: { $in: friendIds } })
      .select('-password');
    
    return res.json(friends);
  } catch (error) {
    console.error('Error getting friend list:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Remove a friend
app.delete('/api/friends/:friendId', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id;
    
    // Find the friendship
    const friendRequest = await FriendRequest.findOne({
      status: 'accepted',
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId }
      ]
    });
    
    if (!friendRequest) {
      return res.status(404).json({ message: 'Friendship not found' });
    }
    
    // Delete the friendship
    await FriendRequest.deleteOne({ _id: friendRequest._id })
      .then(() => {
        console.log(`DEBUG: Deleted friend request ${friendRequest.id}`);
      });
    
    return res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// MESSAGING ENDPOINTS

// Get user conversations
app.get('/api/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all conversations where the user is a participant
    const conversations = await Conversation.find({
      participants: userId
    }).populate('lastMessage').sort({ updatedAt: -1 });
    
    // For each conversation, determine other participants
    const populatedConversations = await Promise.all(conversations.map(async (conv) => {
      const otherParticipants = await User.find({
        id: { $in: conv.participants.filter(id => id !== userId) }
      }).select('id username');
      
      return {
        ...conv.toObject(),
        otherParticipants,
        unreadCount: (conv.unreadCounts && conv.unreadCounts.get(userId)) || 0
      };
    }));
    
    return res.json(populatedConversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Create a new conversation
app.post('/api/conversations', auth, async (req, res) => {
  try {
    const { participantIds, initialMessage } = req.body;
    const userId = req.user.id;
    
    if (!participantIds || !participantIds.length) {
      return res.status(400).json({ message: 'At least one participant ID is required' });
    }
    
    // Make sure the current user is included in participants
    const allParticipants = Array.from(new Set([userId, ...participantIds]));
    
    // Check if participants exist
    const participantCount = await User.countDocuments({
      id: { $in: allParticipants }
    });
    
    if (participantCount !== allParticipants.length) {
      return res.status(404).json({ message: 'One or more participants not found' });
    }
    
    // Check if a conversation already exists with the same participants
    const existingConversation = await Conversation.findOne({
      participants: { $size: allParticipants.length, $all: allParticipants }
    });
    
    if (existingConversation) {
      // If initialMessage is provided, add it to the existing conversation
      if (initialMessage) {
        const newMessage = new Message({
          sender: userId,
          conversation: existingConversation.id,
          content: initialMessage,
          readBy: [userId]
        });
        
        await newMessage.save()
          .then(() => {
            console.log(`DEBUG: Saved new message ${newMessage.id}`);
          });
        
        // Update the conversation's lastMessage
        existingConversation.lastMessage = newMessage._id;
        await existingConversation.save()
          .then(() => {
            console.log(`DEBUG: Updated conversation ${existingConversation.id} with lastMessage`);
          });
      }
      
      return res.json({
        message: 'Existing conversation found',
        conversation: existingConversation
      });
    }
    
    // Create a new conversation
    const conversation = new Conversation({
      id: `conv-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      participants: allParticipants,
      unreadCounts: new Map(allParticipants.filter(p => p !== userId).map(p => [p, 0]))
    });
    
    await conversation.save()
      .then(() => {
        console.log(`DEBUG: Saved new conversation ${conversation.id}`);
      });
    
    // If initialMessage is provided, create it
    if (initialMessage) {
      const message = new Message({
        sender: userId,
        conversation: conversation.id,
        content: initialMessage,
        readBy: [userId]
      });
      
      await message.save()
        .then(() => {
          console.log(`DEBUG: Saved new message ${message.id}`);
        });
      
      // Update conversation's lastMessage and increment unread counts
      conversation.lastMessage = message._id;
      
      // Increment unread count for all participants except sender
      conversation.participants.forEach(participantId => {
        if (participantId !== userId) {
          const currentCount = conversation.unreadCounts.get(participantId) || 0;
          conversation.unreadCounts.set(participantId, currentCount + 1);
        }
      });
      
      await conversation.save()
        .then(() => {
          console.log(`DEBUG: Updated conversation ${conversation.id} with lastMessage and unread counts`);
        });
    }
    
    return res.status(201).json({
      message: 'Conversation created successfully',
      conversation
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a conversation
app.get('/api/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { limit = 20, before } = req.query;
    
    // Find the conversation
    const conversation = await Conversation.findOne({ id: conversationId });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Make sure the user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'You are not a participant in this conversation' });
    }
    
    // Build query for messages
    const query = { conversation: conversationId };
    if (before) {
      const beforeMessage = await Message.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }
    
    // Get messages
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'id username');
    
    // Mark messages as read
    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    )
      .then(() => {
        console.log(`DEBUG: Marked messages as read for conversation ${conversationId}`);
      });
    
    // Reset unread count for this user in the conversation
    if (conversation.unreadCounts) {
      conversation.unreadCounts.set(userId, 0);
      await conversation.save()
        .then(() => {
          console.log(`DEBUG: Reset unread count for user ${userId} in conversation ${conversationId}`);
        });
    }
    
    return res.json(messages.reverse()); // Return in chronological order
  } catch (error) {
    console.error('Error getting messages:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
app.post('/api/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    // Find the conversation
    const conversation = await Conversation.findOne({ id: conversationId });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Make sure the user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'You are not a participant in this conversation' });
    }
    
    // Create the message
    const message = new Message({
      sender: userId,
      conversation: conversationId,
      content,
      readBy: [userId]
    });
    
    await message.save()
      .then(() => {
        console.log(`DEBUG: Saved new message ${message.id}`);
      });
    
    // Update conversation's lastMessage and increment unread counts
    conversation.lastMessage = message._id;
    
    // Increment unread count for all participants except sender
    conversation.participants.forEach(participantId => {
      if (participantId !== userId) {
        const currentCount = conversation.unreadCounts.get(participantId) || 0;
        conversation.unreadCounts.set(participantId, currentCount + 1);
      }
    });
    
    await conversation.save()
      .then(() => {
        console.log(`DEBUG: Updated conversation ${conversationId} with lastMessage and unread counts`);
      });
    
    // Return the message
    return res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Mark conversation as read
app.put('/api/conversations/:conversationId/read', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Find the conversation
    const conversation = await Conversation.findOne({ id: conversationId });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Make sure the user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'You are not a participant in this conversation' });
    }
    
    // Mark all messages as read
    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    )
      .then(() => {
        console.log(`DEBUG: Marked messages as read for conversation ${conversationId}`);
      });
    
    // Reset unread count
    if (conversation.unreadCounts) {
      conversation.unreadCounts.set(userId, 0);
      await conversation.save()
        .then(() => {
          console.log(`DEBUG: Reset unread count for user ${userId} in conversation ${conversationId}`);
        });
    }
    
    return res.json({ message: 'Conversation marked as read' });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Player Image API Endpoints
app.get('/api/players/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the player by ID
    const player = await Player.findOne({ id });
    
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    // Get image path from player (prioritizes local path)
    const imageUrl = player.getImageUrl();
    const isLocalImage = !!player.localImagePath && imageUrl === player.localImagePath;
    
    return res.json({
      id: player.id,
      name: player.name,
      imageUrl: imageUrl,
      isLocalImage: isLocalImage,
      hasCustomImage: !!player.imageUrl || !!player.localImagePath
    });
  } catch (error) {
    console.error('Error getting player image:', error);
    return res.status(500).json({ message: 'Server error getting player image' });
  }
});

// Alternative endpoint that redirects directly to the image
app.get('/api/players/:id/image-redirect', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the player by ID
    const player = await Player.findOne({ id });
    
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    // Get the image URL with fallback to default
    const imageUrl = player.getImageUrl();
    
    // Redirect to the actual image URL
    return res.redirect(imageUrl);
  } catch (error) {
    console.error('Error redirecting to player image:', error);
    return res.status(500).json({ message: 'Server error redirecting to player image' });
  }
});

// Update player image endpoint
app.post('/api/players/:id/update-image', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }
    
    // Find the player by ID
    const player = await Player.findOne({ id });
    
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    // Update player image in memory
    player.imageUrl = imageUrl;
    
    // Save updated player data to MongoDB
    const playerDoc = await Player.findOne({ id: player.id });
    if (playerDoc) {
      playerDoc.imageUrl = imageUrl;
      await playerDoc.save()
        .then(() => {
          console.log(`DEBUG: Updated player ${id} with image URL`);
        });
      res.json({ message: 'Player image updated successfully', player: { id, imageUrl } });
    } else {
      return res.status(404).json({ message: 'Player not found in database' });
    }
  } catch (error) {
    console.error('Error updating player image:', error);
    res.status(500).json({ message: 'Error updating player image' });
  }
});

// Create a new league
app.post('/api/leagues', auth, async (req, res) => {
  console.log('DEBUG: /api/leagues POST received', req.body);
  const { name, maxTeams, description, isPublic, regions } = req.body;
  
  if (!name) {
    console.log('DEBUG: League name is required but was missing');
    return res.status(400).json({ message: 'League name is required' });
  }
  
  console.log(`DEBUG: Creating league "${name}" with maxTeams=${maxTeams}, regions=[${regions}]`);
  // Use auth user as creator
  const league = leagueService.createLeague(name, maxTeams || 12, {
    creatorId: req.user.id,
    description,
    isPublic: isPublic === undefined ? true : isPublic,
    regions: regions || ['AMERICAS', 'EMEA'] // Default to AMERICAS and EMEA if not specified
  });
  
  console.log(`DEBUG: League created with ID ${league.id}`);
  // Add creator as first member - make sure we're passing the actual user ID
  if (req.user && req.user.id) {
    const added = leagueService.addMemberToLeague(league.id, req.user.id);
    console.log(`DEBUG: Added creator ${req.user.id} as first member: ${added}`);
    console.log(`DEBUG: League memberIds after adding creator: [${league.memberIds}]`);
  } else {
    console.log(`DEBUG: Warning - Unable to add creator as member, user ID is undefined`);
  }

  // Initialize league players from the selected regions
  const allPlayers = playerService.getAllPlayers();
  
  if (typeof league.initializePlayersFromRegions === 'function') {
    // Use the method if available
    const success = league.initializePlayersFromRegions(allPlayers);
    console.log(`DEBUG: Initialized league players from regions ${league.regions.join(', ')}: ${success ? 'success' : 'failed'}`);
  } else {
    // Manually initialize players if the method is not available
    console.log(`DEBUG: league.initializePlayersFromRegions is not a function, initializing players manually`);
    
    // Define region mappings for the new region names
    const regionMappings = {
      'AMERICAS': ['LCS', 'LLA', 'CBLOL', 'NA'],
      'EMEA': ['LEC', 'LFL', 'LVP', 'EU'],
      'CHINA': ['LPL'],
      'KOREA': ['LCK']
    };
    
    // Filter players by the league's regions
    const regionPlayers = allPlayers.filter(player => {
      // Check if player's region matches any of the league's regions
      // or if player's homeLeague matches any of the league's regions
      return league.regions.some(region => {
        const regionUpper = region.toUpperCase();
        const playerRegion = player.region?.toUpperCase() || '';
        const playerHomeLeague = player.homeLeague?.toUpperCase() || '';
        
        // Direct match
        if (playerRegion === regionUpper || playerHomeLeague === regionUpper) {
          return true;
        }
        
        // Check if the region is one of the new region groups
        if (regionMappings[regionUpper]) {
          // Check if player's region or homeLeague is in the mapped regions
          return regionMappings[regionUpper].some(r => 
            playerRegion === r || playerHomeLeague === r
          );
        }
        
        return false;
      });
    });
    
    console.log(`Found ${regionPlayers.length} players for regions: ${league.regions.join(', ')}`);
    
    // Store player IDs in the league's players array
    league.players = regionPlayers.map(player => player.id);
  }

  // Save the league to the database with its initialized players
  const newLeague = new League({
    id: league.id,
    name: league.name,
    maxTeams: league.maxTeams,
    description: league.description || '',
    isPublic: league.isPublic,
    regions: league.regions,
    creatorId: req.user.id,
    memberIds: league.memberIds,
    players: league.players,
    teams: league.teams || [] // Ensure teams are saved
  });

  await newLeague.save()
    .then(() => {
      console.log(`DEBUG: Saved league to database with ${league.players.length} players`);
    });
  
  // Update user's leagues
  userService.updateUserLeagues(req.user.id, league.id, 'add');
  console.log(`DEBUG: Updated user leagues for ${req.user.id}`);
  
  // Prompt for team creation by returning a flag in the response
  res.status(201).json({ 
    ...league, 
    promptCreateTeam: true 
  });
});

// Helper function to save league data
async function saveLeagueData() {
  console.log('DEBUG: Starting saveLeagueData function');
  const allLeagues = leagueService.getAllLeagues();
  console.log(`DEBUG: Got ${allLeagues.length} leagues from leagueService`);
  
  // Save leagues to MongoDB
  for (const league of allLeagues) {
    console.log(`DEBUG: Processing league ${league.id} - ${league.name}`);
    console.log(`DEBUG: League memberIds before saving: [${league.memberIds}]`);
    
    // Filter out null values from memberIds
    const validMemberIds = Array.isArray(league.memberIds) 
      ? league.memberIds.filter(id => id !== null && id !== undefined)
      : [];
      
    console.log(`DEBUG: Filtered memberIds: [${validMemberIds}]`);
    
    // Ensure teams array is properly formatted
    let teamsArray = [];
    if (Array.isArray(league.teams)) {
      // Store team IDs instead of full team objects
      teamsArray = league.teams
        .filter(team => team !== null && team !== undefined)
        .map(team => {
          // If it's an object, extract the ID
          if (typeof team === 'object' && team !== null) {
            return team.id;
          }
          // If it's already an ID, return it as is
          return team;
        });
    }
    console.log(`DEBUG: League teams before saving: ${teamsArray.length} teams (IDs only)`);
    
    // Check if league exists in MongoDB
    const existingLeague = await League.findOne({ id: league.id });
    
    if (existingLeague) {
      console.log(`DEBUG: Updating existing league ${league.id}`);
      existingLeague.name = league.name;
      existingLeague.maxTeams = league.maxTeams;
      existingLeague.teams = teamsArray;
      existingLeague.regions = league.regions || ['AMERICAS', 'EMEA'];
      existingLeague.currentWeek = league.currentWeek || 1;
      existingLeague.memberIds = validMemberIds;
      existingLeague.creatorId = league.creatorId;
      existingLeague.description = league.description || '';
      existingLeague.isPublic = league.isPublic !== undefined ? league.isPublic : true;
      
      // Make sure schedule has the required week field
      if (league.schedule && Array.isArray(league.schedule)) {
        existingLeague.schedule = league.schedule.map(weekSchedule => ({
          week: weekSchedule.week || 1, // Ensure week is always set
          matchups: weekSchedule.matchups || []
        }));
      }
      
      await existingLeague.save();
      console.log(`DEBUG: Successfully updated league ${league.id} with teams: [${existingLeague.teams}]`);
    } else {
      console.log(`DEBUG: Creating new league ${league.id}`);
      const newLeague = new League({
        id: league.id,
        name: league.name,
        maxTeams: league.maxTeams,
        teams: teamsArray,
        regions: league.regions || ['AMERICAS', 'EMEA'],
        currentWeek: league.currentWeek || 1,
        memberIds: validMemberIds,
        creatorId: league.creatorId,
        description: league.description || '',
        isPublic: league.isPublic !== undefined ? league.isPublic : true,
        // Make sure schedule has the required week field
        schedule: league.schedule && Array.isArray(league.schedule) ? 
          league.schedule.map(weekSchedule => ({
            week: weekSchedule.week || 1, // Ensure week is always set
            matchups: weekSchedule.matchups || []
          })) : []
      });
      
      await newLeague.save();
      console.log(`DEBUG: Saved new league ${league.id} with teams: [${newLeague.teams}]`);
    }
  }
  
  console.log(`DEBUG: Saved ${allLeagues.length} leagues to MongoDB`);
  return true;
}

// Helper function to generate a schedule for a league
async function generateSchedule(league, weeksPerSeason = 9) {
  console.log(`\n========== GENERATING SCHEDULE ==========`);
  console.log(`League: ${league.id} (${league.name})`);
  console.log(`Weeks: ${weeksPerSeason}`);
  console.log(`Teams: ${league.teams.length}`);
  
  if (!league.teams || league.teams.length < 2) {
    console.error('Cannot generate schedule: League needs at least 2 teams');
    throw new Error('Cannot generate schedule: League needs at least 2 teams');
  }
  
  // Create a map of team IDs to team names for better logging
  const teamMap = {};
  league.teams.forEach(team => {
    teamMap[team.id] = team.name || 'Unknown Team';
  });
  
  console.log('\nTeams in league:');
  league.teams.forEach(team => {
    console.log(`- ${team.id}: ${team.name || 'Unknown Team'}`);
  });
  
  const teams = league.teams.map(team => team.id);
  
  // Generate round-robin schedule
  const schedule = [];
  
  // If odd number of teams, add a "bye" team
  if (teams.length % 2 !== 0) {
    teams.push('bye');
    console.log('\nAdded BYE team for odd number of teams');
  }
  
  const totalRounds = teams.length - 1;
  const matchesPerRound = teams.length / 2;
  
  console.log(`\nGenerating ${Math.min(totalRounds, weeksPerSeason)} weeks with ${matchesPerRound} matches per week`);
  
  // Create rounds
  for (let round = 0; round < totalRounds && round < weeksPerSeason; round++) {
    const weekSchedule = {
      week: round + 1,
      matchups: []
    };
    
    console.log(`\n----- WEEK ${round + 1} MATCHUPS -----`);
    
    // Create matches for this round
    for (let match = 0; match < matchesPerRound; match++) {
      const home = teams[match];
      const away = teams[teams.length - 1 - match];
      
      // Skip matches involving the "bye" team
      if (home !== 'bye' && away !== 'bye') {
        const matchup = {
          teamA: home,
          teamB: away,
          scoreA: 0,
          scoreB: 0,
          winner: null
        };
        
        weekSchedule.matchups.push(matchup);
        
        // Log the matchup with team names
        console.log(`Matchup ${match + 1}: ${teamMap[home] || home} vs ${teamMap[away] || away} (${home} vs ${away})`);
      } else {
        // Log the bye
        const teamWithBye = home === 'bye' ? away : home;
        console.log(`BYE: ${teamMap[teamWithBye] || teamWithBye} (${teamWithBye})`);
      }
    }
    
    // Rotate teams for next round (first team stays fixed, others rotate)
    teams.splice(1, 0, teams.pop());
    
    schedule.push(weekSchedule);
  }
  
  console.log(`\n========== SCHEDULE SUMMARY ==========`);
  console.log(`Generated ${schedule.length} weeks of matchups`);
  
  // Print a summary of all matchups by week
  schedule.forEach(week => {
    console.log(`\nWeek ${week.week} (${week.matchups.length} matchups):`);
    week.matchups.forEach((matchup, idx) => {
      console.log(`  ${idx + 1}. ${teamMap[matchup.teamA]} vs ${teamMap[matchup.teamB]} (${matchup.teamA} vs ${matchup.teamB})`);
    });
  });
  
  // Save the schedule to the league
  league.schedule = schedule;
  
  // Save to MongoDB
  try {
    const leagueDoc = await League.findOne({ id: league.id });
    if (leagueDoc) {
      console.log(`\nUpdating league ${league.id} in MongoDB with new schedule`);
      leagueDoc.schedule = schedule;
      await leagueDoc.save();
      console.log(`Successfully saved schedule to MongoDB for league ${league.id}`);
      console.log(`MongoDB league now has ${leagueDoc.schedule.length} weeks in schedule`);
    } else {
      console.log(`\nLeague ${league.id} not found in MongoDB, creating new document`);
      const newLeague = new League({
        id: league.id,
        name: league.name,
        schedule: schedule
      });
      await newLeague.save();
      console.log(`Created new league document in MongoDB with schedule`);
    }
    
    console.log(`\n========== SCHEDULE GENERATION COMPLETE ==========`);
  } catch (error) {
    console.error(`\nError saving schedule for league ${league.id} to MongoDB:`, error);
  }
  
  return true;
}

// Get league matchups for a specific week
app.get('/api/leagues/:id/matchups/:week', (req, res) => {
  console.log(`Getting matchups for league ${req.params.id} week ${req.params.week}`);
  const { id, week } = req.params;
  
  try {
    // Get the original league from the in-memory store, not the serialized version
    const originalLeague = leagueService.leagues.find(league => league.id === id);
    
    if (!originalLeague) {
      console.log(`League ${id} not found in memory`);
      return res.status(404).json({ message: 'League not found' });
    }
    
    console.log(`League ${id} found in memory with ${originalLeague.teams?.length || 0} teams`);
    console.log(`League has schedule: ${!!originalLeague.schedule}`);
    if (originalLeague.schedule) {
      console.log(`Schedule has ${originalLeague.schedule.length} weeks`);
    }
    
    const weekNumber = parseInt(week) || originalLeague.currentWeek || 1;
    console.log(`Looking for matchups for week ${weekNumber}`);
    
    // Check if the league has a schedule
    if (!originalLeague.schedule || !Array.isArray(originalLeague.schedule) || originalLeague.schedule.length === 0) {
      console.log(`League ${id} has no schedule in memory. Attempting to find in MongoDB.`);
      
      // Try to get the schedule from MongoDB
      League.findOne({ id: id })
        .then(leagueDoc => {
          console.log(`MongoDB lookup result: ${!!leagueDoc}`);
          if (leagueDoc) {
            console.log(`MongoDB league has schedule: ${!!leagueDoc.schedule}`);
            if (leagueDoc.schedule) {
              console.log(`MongoDB schedule has ${leagueDoc.schedule.length} weeks`);
            }
          }
          
          if (leagueDoc && leagueDoc.schedule && Array.isArray(leagueDoc.schedule) && leagueDoc.schedule.length > 0) {
            // Found schedule in MongoDB, update the in-memory league
            console.log(`Found schedule in MongoDB for league ${id}`);
            originalLeague.schedule = leagueDoc.schedule;
            
            // Now get the matchups for the requested week
            const weekSchedule = originalLeague.schedule.find(w => w.week === weekNumber);
            console.log(`Week ${weekNumber} found in schedule: ${!!weekSchedule}`);
            
            const matchups = weekSchedule ? weekSchedule.matchups : [];
            console.log(`Retrieved ${matchups.length} matchups for league ${id} week ${weekNumber} from MongoDB`);
            
            if (matchups.length > 0) {
              console.log(`Sample matchup: ${JSON.stringify(matchups[0])}`);
            }
            
            return res.json(matchups);
          } else {
            console.log(`No schedule found in MongoDB for league ${id}`);
            return res.json([]);
          }
        })
        .catch(error => {
          console.error(`Error getting schedule from MongoDB for league ${id}:`, error);
          return res.status(500).json({ message: 'Error getting league schedule from database', error: error.message });
        });
    } else {
      // League has a schedule in memory, get matchups for the requested week
      console.log(`League ${id} has schedule in memory with ${originalLeague.schedule.length} weeks`);
      
      // First try to use the getWeekMatchups method if available
      if (typeof originalLeague.getWeekMatchups === 'function') {
        const matchups = originalLeague.getWeekMatchups(weekNumber);
        console.log(`Retrieved ${matchups.length} matchups using getWeekMatchups for league ${id} week ${weekNumber}`);
        
        if (matchups.length > 0) {
          console.log(`Sample matchup: ${JSON.stringify(matchups[0])}`);
        }
        
        return res.json(matchups);
      }
      
      // Otherwise, get the matchups directly from the schedule
      const weekSchedule = originalLeague.schedule.find(w => w.week === weekNumber);
      console.log(`Week ${weekNumber} found in schedule: ${!!weekSchedule}`);
      
      if (weekSchedule && Array.isArray(weekSchedule.matchups)) {
        console.log(`Retrieved ${weekSchedule.matchups.length} matchups directly from schedule for league ${id} week ${weekNumber}`);
        
        if (weekSchedule.matchups.length > 0) {
          console.log(`Sample matchup: ${JSON.stringify(weekSchedule.matchups[0])}`);
        }
        
        return res.json(weekSchedule.matchups);
      } else {
        console.log(`No matchups found for league ${id} week ${weekNumber}`);
        return res.json([]);
      }
    }
  } catch (error) {
    console.error(`Error getting matchups for league ${id} week ${week}:`, error);
    res.status(500).json({ message: 'Error getting league matchups', error: error.message });
  }
});

// Start server
const server = http.createServer(app);
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize data
  await initializeData();
  
  // Set up auto-save for data persistence
  const SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  setInterval(async () => {
    console.log('Auto-saving data...');
    try {
      // Save leagues
      for (const league of leagueService.leagues) {
        try {
          await saveLeagueData(league);
        } catch (error) {
          console.error(`Error saving league ${league.id}:`, error);
        }
      }
      
      // Save teams
      for (const team of teamService.teams) {
        try {
          const existingTeam = await FantasyTeam.findOne({ id: team.id });
          if (existingTeam) {
            // Update existing team
            Object.assign(existingTeam, {
              name: team.name,
              owner: team.owner,
              userId: team.userId,
              leagueId: team.leagueId,
              players: team.players,
              totalPoints: team.totalPoints || 0,
              weeklyPoints: team.weeklyPoints || {}
            });
            await existingTeam.save();
          } else {
            // Create new team
            const newTeam = new FantasyTeam({
              id: team.id,
              name: team.name,
              owner: team.owner,
              userId: team.userId,
              leagueId: team.leagueId,
              players: team.players || {},
              totalPoints: team.totalPoints || 0,
              weeklyPoints: team.weeklyPoints || {}
            });
            await newTeam.save();
          }
        } catch (error) {
          console.error(`Error saving team ${team.id}:`, error);
        }
      }
      
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }, SAVE_INTERVAL);
});

// Initialize WebSocket server for draft room
const wss = new WebSocket.Server({ server });

// Draft room state
let draftRoom = {
  clients: new Map(),
  draftState: {
    participants: [],
    draftStarted: false,
    draftComplete: false,
    draftOrder: [],
    currentPickIndex: 0,
    draftHistory: [],
    teams: {}
  },
  
  // Save draft state to file
  saveDraftState: function() {
    const dataDir = path.join(__dirname, 'data');
    const draftStatePath = path.join(dataDir, 'draftState.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write draft state to file
    fs.writeFile(draftStatePath, JSON.stringify(this.draftState, null, 2))
      .catch(err => console.error('Error saving draft state:', err));
  },
  
  // Load draft state from file
  loadDraftState: async function() {
    const dataDir = path.join(__dirname, 'data');
    const draftStatePath = path.join(dataDir, 'draftState.json');
    
    try {
      // Check if file exists
      await fs.access(draftStatePath);
      
      // Read and parse file
      const data = await fs.readFile(draftStatePath, 'utf8');
      this.draftState = JSON.parse(data);
      console.log('Loaded existing draft state');
    } catch (error) {
      console.log('No existing draft state found, using default');
    }
  },
  
  // Broadcast message to all connected clients
  broadcast: function(message) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  },
  
  // Broadcast draft state to all clients
  broadcastDraftState: function() {
    this.broadcast(JSON.stringify({
      type: 'draftState',
      data: this.draftState
    }));
  },
  
  // Broadcast participant status to all clients
  broadcastParticipantStatus: function() {
    this.broadcast(JSON.stringify({
      type: 'participantUpdate',
      data: {
        participants: this.draftState.participants
      }
    }));
  },
  
  // Handle a user joining the draft
  handleJoin: function(ws, data) {
    const { username } = data;
    
    // Store client information
    this.clients.set(ws, { username });
    
    // Add to participants if not already there
    if (!this.draftState.participants.includes(username)) {
      this.draftState.participants.push(username);
      
      // Initialize empty team for new participant
      this.draftState.teams[username] = {
        name: username,
        players: {
          TOP: null,
          JUNGLE: null,
          MID: null,
          ADC: null,
          SUPPORT: null,
          FLEX: null,
          BENCH: []
        }
      };
      
      // Save updated state
      this.saveDraftState();
    }
    
    // Broadcast updated participant list
    this.broadcastParticipantStatus();
    
    console.log(`User joined draft room: ${username}`);
  },
  
  // Handle starting the draft
  handleStartDraft: function(data) {
    const { username } = data;
    
    // Need at least 2 participants
    if (this.draftState.participants.length < 2) {
      return;
    }
    
    // Set draft order (randomized)
    const shuffledParticipants = [...this.draftState.participants].sort(() => Math.random() - 0.5);
    
    this.draftState.draftOrder = shuffledParticipants;
    this.draftState.draftStarted = true;
    this.draftState.currentPickIndex = 0;
    this.draftState.draftHistory = [];
    
    // Save and broadcast updated state
    this.saveDraftState();
    this.broadcastDraftState();
    
    console.log(`Draft started by ${username}`);
  },
  
  // Calculate next pick index for snake draft
  calculateNextPickIndex: function() {
    const totalParticipants = this.draftState.draftOrder.length;
    const historyLength = this.draftState.draftHistory.length;
    const currentIndex = this.draftState.currentPickIndex;
    
    const roundNumber = Math.floor(historyLength / totalParticipants);
    const isEvenRound = roundNumber % 2 === 1; // 0-indexed round numbers, so odd number = even round
    
    if (isEvenRound) {
      // Even rounds go backward
      if (currentIndex > 0) {
        return currentIndex - 1;
      } else {
        // Reached the beginning, start next round
        return 0;
      }
    } else {
      // Odd rounds go forward
      if (currentIndex < totalParticipants - 1) {
        return currentIndex + 1;
      } else {
        // Reached the end, start going backward
        return totalParticipants - 1;
      }
    }
  },
  
  // Handle drafting a player
  handleDraftPlayer: function(data) {
    const { username, player } = data;
    
    // Validate draft is in progress
    if (!this.draftState.draftStarted || this.draftState.draftComplete) {
      return;
    }
    
    // Validate it's the user's turn
    const currentDrafter = this.draftState.draftOrder[this.draftState.currentPickIndex];
    if (username !== currentDrafter) {
      return;
    }
    
    // Determine best position for player
    const team = this.draftState.teams[currentDrafter];
    let positionToFill = '';
    
    // Try to place in primary position first
    if (!team.players[player.position]) {
      positionToFill = player.position;
    } 
    // Try FLEX position
    else if (!team.players.FLEX) {
      positionToFill = 'FLEX';
    }
    // Try bench
    else if (team.players.BENCH.length < 3) {
      positionToFill = 'BENCH';
    } else {
      // No valid position
      return;
    }
    
    // Update team
    if (positionToFill === 'BENCH') {
      team.players.BENCH.push(player);
    } else {
      team.players[positionToFill] = player;
    }
    
    // Add to draft history
    const draftPick = {
      round: Math.floor(this.draftState.draftHistory.length / this.draftState.draftOrder.length) + 1,
      pick: this.draftState.draftHistory.length + 1,
      user: currentDrafter,
      player: player,
      position: positionToFill
    };
    
    this.draftState.draftHistory.push(draftPick);
    
    // Calculate next drafter index for snake draft
    const nextIndex = this.calculateNextPickIndex();
    this.draftState.currentPickIndex = nextIndex;
    
    // Check if draft is complete (each user gets 6 picks)
    const totalPicks = this.draftState.draftOrder.length * 6;
    if (this.draftState.draftHistory.length >= totalPicks) {
      this.draftState.draftComplete = true;
    }
    
    // Save and broadcast updated state
    this.saveDraftState();
    this.broadcastDraftState();
    
    console.log(`Player drafted: ${player.name} by ${username}`);
  }
};

// Load draft state on startup
draftRoom.loadDraftState();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected to draft room');
  
  // Send current draft state to new client
  ws.send(JSON.stringify({
    type: 'draftState',
    data: draftRoom.draftState
  }));
  
  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { type, data: messageData } = data;
      
      switch (type) {
        case 'join':
          draftRoom.handleJoin(ws, messageData);
          break;
        case 'startDraft':
          draftRoom.handleStartDraft(messageData);
          break;
        case 'draftPlayer':
          draftRoom.handleDraftPlayer(messageData);
          break;
        default:
          console.log(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    if (draftRoom.clients.has(ws)) {
      const userData = draftRoom.clients.get(ws);
      console.log(`Client disconnected from draft room: ${userData.username}`);
      
      // Note: We don't remove participants when they disconnect
      // This allows them to reconnect and continue drafting
      
      draftRoom.clients.delete(ws);
      
      // Broadcast updated client list
      draftRoom.broadcastParticipantStatus();
    }
  });
});
