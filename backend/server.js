// backend/server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');

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
    
    // Check if league exists in MongoDB
    const existingLeague = await League.findOne({ id: league.id });
    
    if (existingLeague) {
      console.log(`DEBUG: Updating existing league ${league.id}`);
      existingLeague.name = league.name;
      existingLeague.maxTeams = league.maxTeams;
      existingLeague.teams = league.teams ? league.teams.map(team => typeof team === 'object' ? team.id : team) : [];
      existingLeague.regions = league.regions || ['LCS', 'LEC'];
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
    } else {
      console.log(`DEBUG: Creating new league ${league.id}`);
      const newLeague = new League({
        id: league.id,
        name: league.name,
        maxTeams: league.maxTeams,
        teams: league.teams ? league.teams.map(team => typeof team === 'object' ? team.id : team) : [],
        regions: league.regions || ['LCS', 'LEC'],
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
    }
  }
  
  console.log(`DEBUG: Saved ${allLeagues.length} leagues to MongoDB`);
  return true;
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
    const { numTeams = 12, numWeeks = 11 } = req.body;
    
    // Get the league
    const league = leagueService.getLeagueById(leagueId);
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
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
    
    // Check how many teams we need to create
    const existingTeamCount = league.teams.length;
    const teamsToCreate = Math.min(numTeams - existingTeamCount, TEAM_NAMES.length);
    
    if (teamsToCreate <= 0) {
      return res.status(400).json({ 
        message: `League already has ${existingTeamCount} teams. Cannot add more teams.`,
        league: league
      });
    }
    
    // Create teams and add to league
    const createdTeams = [];
    for (let i = 0; i < teamsToCreate; i++) {
      const teamName = TEAM_NAMES[i % TEAM_NAMES.length];
      const owner = `Bot Owner ${i + 1}`;
      
      try {
        // Create the team
        const team = teamService.createTeam(`${teamName} ${i + 1}`, owner);
        console.log(`DEBUG: Created team ${team.name} with ID ${team.id}`);
        
        // Add to league (using the correct method that handles the team ID)
        const added = league.addTeam(team);
        console.log(`DEBUG: Added team to league, league now has ${league.teams.length} teams`);
        
        // Save team to database
        await FantasyTeam.findOneAndUpdate(
          { id: team.id },
          { 
            $set: {
              id: team.id,
              name: team.name,
              owner: team.owner,
              players: team.players,
              leagueId: team.leagueId,
              totalPoints: team.totalPoints,
              weeklyPoints: team.weeklyPoints
            }
          },
          { upsert: true, new: true }
        );
        
        // Save league to database after each team is added
        await League.findOneAndUpdate(
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
        console.error(`Error creating team ${i + 1}:`, error);
      }
    }
    
    // Generate schedule
    try {
      console.log(`DEBUG: Generating schedule for ${numWeeks} weeks with ${league.teams.length} teams`);
      league.generateSchedule(numWeeks);
      console.log(`DEBUG: Schedule generated with ${league.schedule.length} weeks`);
      
      // Save league to database with the schedule
      await League.findOneAndUpdate(
        { id: league.id },
        { 
          $set: {
            teams: league.teams,
            schedule: league.schedule,
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
      console.log(`DEBUG: Final league saved with schedule`);
    } catch (error) {
      console.error('Error generating schedule:', error);
      return res.status(500).json({ 
        message: 'Error generating schedule',
        error: error.message,
        createdTeams
      });
    }
    
    return res.status(200).json({
      message: `Successfully added ${createdTeams.length} teams and generated a ${numWeeks}-week schedule`,
      league: league,
      createdTeams
    });
  } catch (error) {
    console.error('Error filling league:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
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
      const existingTeam = await FantasyTeam.findOne({ id: teamId });
      
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${teamId}`);
        existingTeam.players = team.players;
        
        await existingTeam.save();
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          players: team.players
        });
        
        await newTeam.save();
      }
      
      // Save player data
      const existingPlayer = await Player.findOne({ id: playerId });
      
      if (existingPlayer) {
        console.log(`DEBUG: Updating existing player ${playerId}`);
        existingPlayer.drafted = true;
        
        await existingPlayer.save();
      } else {
        console.log(`DEBUG: Creating new player ${playerId}`);
        const newPlayer = new Player({
          id: playerId,
          name: player.name,
          position: player.position,
          team: player.team,
          region: player.region,
          homeLeague: player.homeLeague,
          firstName: player.firstName,
          lastName: player.lastName,
          stats: player.stats,
          fantasyPoints: player.fantasyPoints,
          drafted: true
        });
        
        await newPlayer.save();
      }
      
      res.json({
        message: 'Player successfully drafted',
        team: team,
        player: player
      });
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
    const existingPlayer = await Player.findOne({ id });
    
    if (existingPlayer) {
      console.log(`DEBUG: Updating existing player ${id}`);
      existingPlayer.stats = playerService.getPlayerById(id).stats;
      
      await existingPlayer.save();
    } else {
      console.log(`DEBUG: Creating new player ${id}`);
      const newPlayer = new Player({
        id,
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
      
      await newPlayer.save();
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
    const playerDoc = await Player.findOne({ id });
    if (playerDoc) {
      playerDoc.imageUrl = imageUrl;
      await playerDoc.save();
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
  const userTeams = teamService.getTeamsByUserId(req.user.id);
  
  // Enhance teams with league information
  const enhancedTeams = userTeams.map(team => {
    if (team.leagueId) {
      const league = leagueService.getLeagueById(team.leagueId);
      if (league) {
        return {
          ...team,
          leagueName: league.name
        };
      }
    }
    return team;
  });
  
  res.json(enhancedTeams);
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
app.get('/api/leagues/user', auth, async (req, res) => {
  const userLeagues = await leagueService.getLeaguesByUserId(req.user.id);
  res.json(userLeagues);
});

// Get league by ID
app.get('/api/leagues/:id', (req, res) => {
  const { id } = req.params;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  res.json(league);
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
    regions: regions || ['LCS', 'LEC'] // Default to North America and Europe if not specified
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
  
  // Update user's leagues
  userService.updateUserLeagues(req.user.id, league.id, 'add');
  console.log(`DEBUG: Updated user leagues for ${req.user.id}`);
  
  // Save league data
  try {
    await saveLeagueData();
    console.log(`DEBUG: Successfully saved league data`);
    console.log(`DEBUG: Final league state before sending response: 
      id: ${league.id}
      memberIds: [${league.memberIds}]
      creatorId: ${league.creatorId}
    `);
    
    // Prompt for team creation by returning a flag in the response
    res.status(201).json({ 
      ...league, 
      promptCreateTeam: true 
    });
  } catch (error) {
    console.error('DEBUG: Error saving league data:', error);
    res.status(500).json({ message: 'Failed to save league data' });
  }
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
    
    // Get the league - don't resolve teams yet for efficiency
    const league = leagueService.getLeagueById(id, false);
    if (!league) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    // Check if league is full
    console.log(`League ${league.id} has ${league.teams?.length || 0}/${league.maxTeams} teams`);
    
    // Ensure teams array is properly initialized
    if (!Array.isArray(league.teams)) {
      console.log(`League ${league.id} teams array is not properly initialized, fixing it`);
      league.teams = [];
    }
    
    if (league.teams.length >= league.maxTeams) {
      return res.status(400).json({ 
        message: 'League is full', 
        teamCount: league.teams.length,
        maxTeams: league.maxTeams 
      });
    }
    
    // Check if user is already in the league
    const userTeamInLeague = league.teams.find(team => {
      const t = teamService.getTeamById(typeof team === 'object' ? team.id : team);
      return t && t.userId === userId;
    });
    
    if (userTeamInLeague) {
      return res.status(400).json({ message: 'You already have a team in this league' });
    }
    
    // Add user to league members if not already a member
    if (!league.memberIds.includes(userId)) {
      console.log(`Adding user ${userId} to league members`);
      league.addMember(userId);
    }
    
    // Create a new team for the user
    const team = teamService.createTeam(teamName, req.user.username);
    team.userId = userId;
    team.leagueId = id;
    
    console.log(`Created new team ${team.id} for user ${userId}`);
    
    // Add team to league
    const added = league.addTeam(team);
    
    if (!added) {
      return res.status(400).json({ message: 'Failed to add team to league' });
    }
    
    // Add team to teamService
    teamService.teams.push(team);
    console.log(`Added team ${team.id} to teamService, now has ${teamService.teams.length} teams`);
    
    // Make sure leagueService has the updated league
    const leagueIndex = leagueService.leagues.findIndex(l => l.id === id);
    if (leagueIndex !== -1) {
      leagueService.leagues[leagueIndex] = league;
      console.log(`Updated league ${id} in leagueService`);
    }
    
    // Save the team to MongoDB first
    try {
      // Create or update team in MongoDB
      const existingTeam = await FantasyTeam.findOne({ id: team.id });
      if (existingTeam) {
        console.log(`Updating existing team ${team.id} in MongoDB`);
        existingTeam.name = team.name;
        existingTeam.owner = team.owner;
        existingTeam.players = team.players;
        existingTeam.leagueId = team.leagueId;
        existingTeam.userId = team.userId;
        await existingTeam.save();
      } else {
        console.log(`Creating new team ${team.id} in MongoDB`);
        const newTeam = new FantasyTeam({
          id: team.id,
          name: team.name,
          owner: team.owner,
          players: team.players,
          leagueId: team.leagueId,
          userId: team.userId
        });
        await newTeam.save();
      }
      
      // Save the updated league to MongoDB
      await saveLeagueData();
      console.log(`Saved league and team data to MongoDB`);
      
      // Verify MongoDB changes were applied
      const verifyTeam = await FantasyTeam.findOne({ id: team.id });
      if (verifyTeam) {
        console.log(`Verified team ${team.id} exists in MongoDB`);
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
    
    const team = teamService.createTeam(name, owner, req.user.id);
    team.leagueId = leagueId; // Associate team with league
    
    // Update user's teams
    userService.updateUserTeams(req.user.id, team.id, 'add');
    
    // Add to league
    league.addTeam(team);
    await saveLeagueData();
    
    // Save teams to MongoDB
    const existingTeam = await FantasyTeam.findOne({ id: team.id });
    
    if (existingTeam) {
      console.log(`DEBUG: Updating existing team ${team.id}`);
      existingTeam.name = team.name;
      existingTeam.owner = team.owner;
      existingTeam.players = team.players;
      existingTeam.leagueId = team.leagueId;
      
      await existingTeam.save();
    } else {
      console.log(`DEBUG: Creating new team ${team.id}`);
      const newTeam = new FantasyTeam({
        id: team.id,
        name: team.name,
        owner: team.owner,
        players: team.players,
        leagueId: team.leagueId
      });
      
      await newTeam.save();
    }
    
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
  const existingTeam = await FantasyTeam.findOne({ id: teamId });
  
  if (existingTeam) {
    console.log(`DEBUG: Updating existing team ${teamId}`);
    existingTeam.players = team.players;
    
    await existingTeam.save();
  } else {
    console.log(`DEBUG: Creating new team ${teamId}`);
    const newTeam = new FantasyTeam({
      id: teamId,
      name: team.name,
      owner: team.owner,
      players: team.players
    });
    
    await newTeam.save();
  }
  
  res.json(team);
});

// Remove player from team
app.delete('/api/teams/:teamId/players/:playerId', auth, async (req, res) => {
  const { teamId, playerId } = req.params;
  
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
  const existingTeam = await FantasyTeam.findOne({ id: teamId });
  
  if (existingTeam) {
    console.log(`DEBUG: Updating existing team ${teamId}`);
    existingTeam.players = team.players;
    
    await existingTeam.save();
  } else {
    console.log(`DEBUG: Creating new team ${teamId}`);
    const newTeam = new FantasyTeam({
      id: teamId,
      name: team.name,
      owner: team.owner,
      players: team.players
    });
    
    await newTeam.save();
  }
  
  res.json(team);
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
      console.log(`League ${id} not found for score calculation`);
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
  
  const success = league.generateSchedule(weeks || 9);
  
  if (!success) {
    return res.status(400).json({ 
      message: 'Failed to generate schedule. Need at least 2 teams in the league.'
    });
  }
  
  await saveLeagueData();
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
        existingPlayer.stats = player.stats;
        
        await existingPlayer.save();
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
        await newPlayer.save();
      }
    }
    // Save updated league data
    await saveLeagueData();
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
  saveLeagueData().then(() => {
    res.json({
      message: 'Week advanced successfully',
      currentWeek: league.currentWeek
    });
  }).catch(error => {
    console.error('Error saving league data:', error);
    res.status(500).json({ message: 'Error saving league data' });
  });
});

// API endpoint to generate a schedule for a league
app.post('/api/leagues/:id/generate-schedule', auth, (req, res) => {
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
    league.generateSchedule(weeks || 9);
  } catch (error) {
    return res.status(400).json({
      message: 'Failed to generate schedule',
      error: error.message
    });
  }
  
  saveLeagueData().then(() => {
    res.json(league.schedule);
  }).catch(error => {
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
  
  updateRealTimeStats(league, riotApiService).then(() => {
    // Save updated player data
    const promises = playerService.getAllPlayers().map(player => {
      return Player.findOne({ id: player.id })
        .then(existingPlayer => {
          if (existingPlayer) {
            console.log(`DEBUG: Updating existing player ${player.id}`);
            existingPlayer.stats = player.stats;
            return existingPlayer.save();
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
            return newPlayer.save();
          }
        });
    });
    
    return Promise.all(promises)
      .then(() => saveLeagueData())
      .then(() => {
        res.json({ message: 'Player stats updated successfully' });
      });
  }).catch(error => {
    console.error('Error updating stats:', error);
    res.status(500).json({ message: 'Error updating stats' });
  });
});

// API endpoint to add a player to a team
app.post('/api/teams/:teamId/add-player', auth, (req, res) => {
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
        
        await existingTeam.save();
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          players: team.players
        });
        
        await newTeam.save();
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
app.post('/api/teams/:teamId/remove-player', auth, (req, res) => {
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
        
        await existingTeam.save();
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          players: team.players
        });
        
        await newTeam.save();
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

// API endpoint to draft a player to a team
app.post('/api/leagues/:id/draft', auth, (req, res) => {
  const { id } = req.params;
  const { teamId, playerId } = req.body;
  
  if (!teamId || !playerId) {
    return res.status(400).json({ message: 'Team ID and Player ID are required' });
  }
  
  const league = leagueService.getLeagueById(id);
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  const team = teamService.getTeamById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  
  // Check if user is authorized (team owner or admin)
  if (team.userId !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to draft for this team' });
  }
  
  const player = playerService.getPlayerById(playerId);
  if (!player) {
    return res.status(404).json({ message: 'Player not found' });
  }
  
  // Check if player is already drafted
  if (player.drafted) {
    return res.status(400).json({ message: 'Player already drafted' });
  }
  
  // Check if it's a valid draft (e.g., draft order, etc.)
  // This would depend on your specific draft rules
  
  // Add player to team (to bench by default)
  const success = team.addPlayer(player, 'BENCH');
  if (!success) {
    return res.status(400).json({ message: 'Failed to add player to team' });
  }
  
  // Mark the player as drafted in the main league
  player.drafted = true;
  
  // Save teams to MongoDB
  FantasyTeam.findOne({ id: teamId })
    .then(existingTeam => {
      if (existingTeam) {
        console.log(`DEBUG: Updating existing team ${teamId}`);
        existingTeam.name = team.name;
        existingTeam.owner = team.owner;
        existingTeam.players = team.players;
        existingTeam.leagueId = team.leagueId;
        return existingTeam.save();
      } else {
        console.log(`DEBUG: Creating new team ${teamId}`);
        const newTeam = new FantasyTeam({
          id: teamId,
          name: team.name,
          owner: team.owner,
          players: team.players,
          leagueId: team.leagueId
        });
        return newTeam.save();
      }
    })
    .then(() => {
      // Save player data
      return Player.findOne({ id: playerId })
        .then(existingPlayer => {
          if (existingPlayer) {
            console.log(`DEBUG: Updating existing player ${playerId}`);
            existingPlayer.drafted = true;
            return existingPlayer.save();
          } else {
            console.log(`DEBUG: Creating new player ${playerId}`);
            const newPlayer = new Player({
              id: playerId,
              name: player.name,
              position: player.position,
              team: player.team,
              region: player.region,
              homeLeague: player.homeLeague,
              firstName: player.firstName,
              lastName: player.lastName,
              stats: player.stats,
              fantasyPoints: player.fantasyPoints,
              drafted: true
            });
            return newPlayer.save();
          }
        });
    })
    .then(() => {
      res.json({
        message: 'Player successfully drafted',
        team: team,
        player: player
      });
    })
    .catch(error => {
      console.error('Error drafting player:', error);
      res.status(500).json({ message: 'Error drafting player' });
    });
});

// API endpoint to update player stats manually
app.post('/api/players/:id/update-stats', auth, (req, res) => {
  const { id } = req.params;
  const { stats } = req.body;
  
  // Check if user is admin
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Not authorized to update player stats' });
  }
  
  try {
    const player = playerService.getPlayerById(id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    // Update player stats
    player.stats = {
      ...player.stats,
      ...stats
    };
    
    // Calculate fantasy points
    player.calculateFantasyPoints();
    
    // Save updated player data
    Player.findOne({ id })
      .then(existingPlayer => {
        if (existingPlayer) {
          console.log(`DEBUG: Updating existing player ${id}`);
          existingPlayer.stats = playerService.getPlayerById(id).stats;
          return existingPlayer.save();
        } else {
          console.log(`DEBUG: Creating new player ${id}`);
          const newPlayer = new Player({
            id,
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
          return newPlayer.save();
        }
      })
      .then(() => {
        res.json({ message: 'Player stats updated successfully' });
      })
      .catch(error => {
        console.error('Error updating player stats:', error);
        res.status(500).json({ message: 'Error updating player stats' });
      });
  } catch (error) {
    console.error('Error updating player stats:', error);
    res.status(500).json({ message: 'Error updating player stats' });
  }
});

// API endpoint to get all leagues
app.get('/api/leagues', auth, (req, res) => {
  const leagues = leagueService.getAllLeagues();
  res.json(leagues);
});

// API endpoint to get league by ID
app.get('/api/leagues/:id', auth, (req, res) => {
  const { id } = req.params;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  res.json(league);
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
    
    await newTrade.save();
    
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
      const league = leagueService.getLeagueById(team.leagueId);
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
      const league = leagueService.getLeagueById(proposingTeam.leagueId);
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
    await trade.save();
    
    // Save teams to DB
    const proposingTeamDoc = await FantasyTeam.findOne({ id: proposingTeam.id });
    if (proposingTeamDoc) {
      proposingTeamDoc.players = proposingTeam.players;
      await proposingTeamDoc.save();
    }
    
    const receivingTeamDoc = await FantasyTeam.findOne({ id: receivingTeam.id });
    if (receivingTeamDoc) {
      receivingTeamDoc.players = receivingTeam.players;
      await receivingTeamDoc.save();
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
    await trade.save();
    
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
    if (proposingTeam.userId !== req.user.id) {
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
    await trade.save();
    
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
    
    await friendRequest.save();
    
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
    await request.save();
    
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
    await FriendRequest.deleteOne({ _id: friendRequest._id });
    
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
        
        await newMessage.save();
        
        // Update the conversation's lastMessage
        existingConversation.lastMessage = newMessage._id;
        await existingConversation.save();
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
    
    await conversation.save();
    
    // If initialMessage is provided, create it
    if (initialMessage) {
      const message = new Message({
        sender: userId,
        conversation: conversation.id,
        content: initialMessage,
        readBy: [userId]
      });
      
      await message.save();
      
      // Update the conversation's lastMessage
      conversation.lastMessage = message._id;
      await conversation.save();
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
    );
    
    // Reset unread count for this user in the conversation
    if (conversation.unreadCounts) {
      conversation.unreadCounts.set(userId, 0);
      await conversation.save();
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
    
    await message.save();
    
    // Update conversation's lastMessage and increment unread counts
    conversation.lastMessage = message._id;
    
    // Increment unread count for all participants except sender
    conversation.participants.forEach(participantId => {
      if (participantId !== userId) {
        const currentCount = conversation.unreadCounts.get(participantId) || 0;
        conversation.unreadCounts.set(participantId, currentCount + 1);
      }
    });
    
    await conversation.save();
    
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
    );
    
    // Reset unread count
    if (conversation.unreadCounts) {
      conversation.unreadCounts.set(userId, 0);
      await conversation.save();
    }
    
    return res.json({ message: 'Conversation marked as read' });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize data
  await initializeData();
  
  // Set up auto-save for data persistence
  const SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  setInterval(async () => {
    console.log('Auto-saving data...');
    try {
      await saveLeagueData();
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }, SAVE_INTERVAL);
});