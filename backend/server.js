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

// Import fantasy league core modules
const { 
  Player,
  FantasyTeam,
  League,
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
    origin: 'http://localhost:3000', // Replace with your frontend URL
    credentials: true
  }));
  
// Initialize services
const riotApiService = new RiotApiService(process.env.RIOT_API_KEY);
const playerService = new PlayerService(riotApiService);
const teamService = new TeamService();
const leagueService = new LeagueService();

// Cache control middleware
const cacheControl = (req, res, next) => {
  // Set Cache-Control header for API responses
  res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
  next();
};

// Apply cache control to all API routes
app.use('/api', cacheControl);

// Main fantasy league instance
let mainLeague = null;
let statsUpdater = null;

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
    // Try to load saved player data
    console.log('DEBUG: About to load player data');
    const playerData = await loadJsonFile(PLAYERS_FILE);
    console.log('DEBUG: Player data loaded or not found');
    
    if (playerData && playerData.length > 0) {
      console.log(`Loading ${playerData.length} players from disk`);
      playerService.loadPlayersFromData(playerData);
      console.log('DEBUG: Players loaded from disk');
    } else {
      console.log('No player data found, loading sample players...');
      await loadSamplePlayers();
      console.log('DEBUG: Sample players loaded');
    }
    
    // Try to load saved team data
    console.log('DEBUG: About to load team data');
    const teamData = await loadJsonFile(TEAMS_FILE);
    console.log('DEBUG: Team data loaded or not found');
    
    if (teamData && teamData.length > 0) {
      console.log(`Loading ${teamData.length} teams from disk`);
      teamService.loadTeamsFromData(teamData, playerService);
      console.log('DEBUG: Teams loaded from disk');
    }
    
    // Try to load saved league data
    console.log('DEBUG: About to load league data');
    const leagueData = await loadJsonFile(LEAGUE_FILE);
    console.log('DEBUG: League data loaded or not found');
    
    if (leagueData) {
      console.log(`Loading ${Array.isArray(leagueData) ? leagueData.length : 1} leagues from disk`);
      
      // Check if leagueData is an array (multiple leagues) or a single league object
      if (Array.isArray(leagueData)) {
        // Load each league from the array
        leagueData.forEach(league => {
          console.log(`Loading league "${league.name}" from disk`);
          leagueService.loadLeagueFromData(league, teamService, playerService);
        });
        
        // Set mainLeague to the first one for backward compatibility
        if (leagueData.length > 0) {
          mainLeague = leagueService.getLeagueById(leagueData[0].id);
        }
      } else {
        // Single league object (older format)
        console.log(`Loading single league "${leagueData.name}" from disk`);
        mainLeague = leagueService.loadLeagueFromData(leagueData, teamService, playerService);
      }
      
      console.log('DEBUG: League(s) loaded from disk');
    } else {
      console.log('No league data found, creating default league');
      mainLeague = leagueService.createLeague('LTA Fantasy League', 12);
      console.log('DEBUG: Default league created');
      
      // Add available teams to the league
      teamService.getAllTeams().forEach(team => {
        mainLeague.addTeam(team);
      });
      console.log('DEBUG: Teams added to league');
      
      // Add all players to the player pool
      mainLeague.addPlayersToPool(playerService.getAllPlayers());
      console.log('DEBUG: Players added to pool');
      
      // Generate a default schedule
      if (mainLeague.teams.length >= 2) {
        mainLeague.generateSchedule(9); // 9-week season
        console.log('DEBUG: Schedule generated');
      }
      
      // Save to disk
      await saveLeagueData();
      console.log('DEBUG: League data saved');
    }
    
    // Set up stats updater for real-time updates
    console.log('DEBUG: Checking if auto updates are enabled');
    if (process.env.ENABLE_AUTO_UPDATES === 'true') {
      console.log('Setting up automatic stats updates');
      statsUpdater = new StatsUpdater(
        mainLeague, 
        riotApiService, 
        parseInt(process.env.UPDATE_INTERVAL || 1800000) // Default: 30 minutes
      );
      statsUpdater.start();
      console.log('DEBUG: Stats updater started');
    } else {
      console.log('DEBUG: Auto updates are disabled');
    }
    
    console.log('Data initialization complete');
  } catch (error) {
    console.error('DEBUG: Error in initializeData:', error);
    console.error('Error initializing data:', error);
  }
}

// Helper function to load sample players
async function loadSamplePlayers() {
  console.log('DEBUG: Loading players from pro_teams.json');
  try {
    // Load pro_teams.json
    const proTeamsData = await loadJsonFile(path.join(DATA_DIR, 'pro_teams.json'));
    
    if (!proTeamsData || !Array.isArray(proTeamsData)) {
      console.error('DEBUG: Failed to load pro_teams.json or invalid format');
      return;
    }
    
    console.log(`DEBUG: Loaded ${proTeamsData.length} teams from pro_teams.json`);
    
    // Filter teams from specified home leagues
    const targetLeagues = ['LTA North', 'LTA South', 'LEC', 'LCK', 'LPL'];
    const filteredTeams = proTeamsData.filter(team => 
      team.homeLeague && 
      targetLeagues.includes(team.homeLeague.name) && 
      team.players && 
      team.players.length > 0
    );
    
    console.log(`DEBUG: Found ${filteredTeams.length} teams from target leagues: ${targetLeagues.join(', ')}`);
    
    // Extract and transform players from these teams
    const players = [];
    let playerId = 1;
    
    filteredTeams.forEach(team => {
      console.log(`DEBUG: Processing team ${team.name} with ${team.players.length} players from ${team.homeLeague.name}`);
      
      team.players.forEach(player => {
        // Map role to position format used in the app
        let position = player.role ? player.role.toUpperCase() : 'UNKNOWN';
        if (position === 'BOTTOM') position = 'ADC';
        
        players.push({
          id: `p${playerId++}`,
          name: player.summonerName || player.name,
          position: position,
          team: team.name,
          region: team.homeLeague.region,
          homeLeague: team.homeLeague.name,
          firstName: player.firstName || '',
          lastName: player.lastName || '',
          stats: {
            kills: Math.floor(Math.random() * 50) + 20,
            deaths: Math.floor(Math.random() * 30) + 10,
            assists: Math.floor(Math.random() * 70) + 30,
            cs: Math.floor(Math.random() * 2000) + 2000,
            visionScore: Math.floor(Math.random() * 200) + 100,
            baronKills: Math.floor(Math.random() * 5),
            dragonKills: Math.floor(Math.random() * 5),
            turretKills: Math.floor(Math.random() * 10) + 5,
            gamesPlayed: 15
          },
          fantasyPoints: Math.floor(Math.random() * 200) + 100
        });
      });
    });
    
    console.log(`DEBUG: Extracted ${players.length} players from target leagues`);
    
    // Load player data
    playerService.loadPlayersFromData(players);
    console.log('DEBUG: Players loaded into playerService');
    
    // Save the players to disk for future use
    await saveJsonFile(PLAYERS_FILE, players);
    console.log('DEBUG: Players saved to disk');
    
  } catch (error) {
    console.error('DEBUG: Error loading players from pro_teams.json:', error);
    
    // Fallback to default sample players if there's an error
    console.log('DEBUG: Using fallback sample players');
    const samplePlayers = [
      // LCK (Korea)
      { id: "lck1", name: "LCKTop1", position: "TOP", team: "T1", region: "LCK", homeLeague: "LCK", stats: { kills: 42, deaths: 28, assists: 54, cs: 3420, visionScore: 230, baronKills: 3, dragonKills: 2, turretKills: 12, gamesPlayed: 15 }, fantasyPoints: 294.5 },
      { id: "lck2", name: "LCKJungle1", position: "JUNGLE", team: "T1", region: "LCK", homeLeague: "LCK", stats: { kills: 42, deaths: 28, assists: 54, cs: 3420, visionScore: 230, baronKills: 3, dragonKills: 2, turretKills: 12, gamesPlayed: 15 }, fantasyPoints: 294.5 },
      { id: "lck3", name: "LCKMid1", position: "MID", team: "T1", region: "LCK", homeLeague: "LCK", stats: { kills: 42, deaths: 28, assists: 54, cs: 3420, visionScore: 230, baronKills: 3, dragonKills: 2, turretKills: 12, gamesPlayed: 15 }, fantasyPoints: 294.5 },
      { id: "lck4", name: "LCKADC1", position: "ADC", team: "T1", region: "LCK", homeLeague: "LCK", stats: { kills: 42, deaths: 28, assists: 54, cs: 3420, visionScore: 230, baronKills: 3, dragonKills: 2, turretKills: 12, gamesPlayed: 15 }, fantasyPoints: 294.5 },
      { id: "lck5", name: "LCKSupport1", position: "SUPPORT", team: "T1", region: "LCK", homeLeague: "LCK", stats: { kills: 42, deaths: 28, assists: 54, cs: 3420, visionScore: 230, baronKills: 3, dragonKills: 2, turretKills: 12, gamesPlayed: 15 }, fantasyPoints: 294.5 },
      
      // LEC (Europe)
      { id: "lec1", name: "LECTop1", position: "TOP", team: "G2 Esports", region: "LEC", homeLeague: "LEC", stats: { kills: 38, deaths: 25, assists: 45, cs: 3300, visionScore: 210, baronKills: 2, dragonKills: 3, turretKills: 10, gamesPlayed: 15 }, fantasyPoints: 270.5 },
      { id: "lec2", name: "LECJungle1", position: "JUNGLE", team: "G2 Esports", region: "LEC", homeLeague: "LEC", stats: { kills: 38, deaths: 25, assists: 45, cs: 3300, visionScore: 210, baronKills: 2, dragonKills: 3, turretKills: 10, gamesPlayed: 15 }, fantasyPoints: 270.5 },
      { id: "lec3", name: "LECMid1", position: "MID", team: "G2 Esports", region: "LEC", homeLeague: "LEC", stats: { kills: 38, deaths: 25, assists: 45, cs: 3300, visionScore: 210, baronKills: 2, dragonKills: 3, turretKills: 10, gamesPlayed: 15 }, fantasyPoints: 270.5 },
      { id: "lec4", name: "LECADC1", position: "ADC", team: "G2 Esports", region: "LEC", homeLeague: "LEC", stats: { kills: 38, deaths: 25, assists: 45, cs: 3300, visionScore: 210, baronKills: 2, dragonKills: 3, turretKills: 10, gamesPlayed: 15 }, fantasyPoints: 270.5 },
      { id: "lec5", name: "LECSupport1", position: "SUPPORT", team: "G2 Esports", region: "LEC", homeLeague: "LEC", stats: { kills: 38, deaths: 25, assists: 45, cs: 3300, visionScore: 210, baronKills: 2, dragonKills: 3, turretKills: 10, gamesPlayed: 15 }, fantasyPoints: 270.5 },
      
      // LPL (China)
      { id: "lpl1", name: "LPLTop1", position: "TOP", team: "JD Gaming", region: "LPL", homeLeague: "LPL", stats: { kills: 45, deaths: 30, assists: 50, cs: 3500, visionScore: 220, baronKills: 4, dragonKills: 2, turretKills: 11, gamesPlayed: 15 }, fantasyPoints: 280.5 },
      { id: "lpl2", name: "LPLJungle1", position: "JUNGLE", team: "JD Gaming", region: "LPL", homeLeague: "LPL", stats: { kills: 45, deaths: 30, assists: 50, cs: 3500, visionScore: 220, baronKills: 4, dragonKills: 2, turretKills: 11, gamesPlayed: 15 }, fantasyPoints: 280.5 },
      { id: "lpl3", name: "LPLMid1", position: "MID", team: "JD Gaming", region: "LPL", homeLeague: "LPL", stats: { kills: 45, deaths: 30, assists: 50, cs: 3500, visionScore: 220, baronKills: 4, dragonKills: 2, turretKills: 11, gamesPlayed: 15 }, fantasyPoints: 280.5 },
      { id: "lpl4", name: "LPLADC1", position: "ADC", team: "JD Gaming", region: "LPL", homeLeague: "LPL", stats: { kills: 45, deaths: 30, assists: 50, cs: 3500, visionScore: 220, baronKills: 4, dragonKills: 2, turretKills: 11, gamesPlayed: 15 }, fantasyPoints: 280.5 },
      { id: "lpl5", name: "LPLSupport1", position: "SUPPORT", team: "JD Gaming", region: "LPL", homeLeague: "LPL", stats: { kills: 45, deaths: 30, assists: 50, cs: 3500, visionScore: 220, baronKills: 4, dragonKills: 2, turretKills: 11, gamesPlayed: 15 }, fantasyPoints: 280.5 },
      
      // LCS (North America)
      { id: "lcs1", name: "LCSTop1", position: "TOP", team: "Cloud9", region: "LCS", homeLeague: "LCS", stats: { kills: 35, deaths: 22, assists: 48, cs: 3250, visionScore: 205, baronKills: 2, dragonKills: 3, turretKills: 9, gamesPlayed: 15 }, fantasyPoints: 265.5 },
      { id: "lcs2", name: "LCSJungle1", position: "JUNGLE", team: "Cloud9", region: "LCS", homeLeague: "LCS", stats: { kills: 35, deaths: 22, assists: 48, cs: 3250, visionScore: 205, baronKills: 2, dragonKills: 3, turretKills: 9, gamesPlayed: 15 }, fantasyPoints: 265.5 },
      { id: "lcs3", name: "LCSMid1", position: "MID", team: "Cloud9", region: "LCS", homeLeague: "LCS", stats: { kills: 35, deaths: 22, assists: 48, cs: 3250, visionScore: 205, baronKills: 2, dragonKills: 3, turretKills: 9, gamesPlayed: 15 }, fantasyPoints: 265.5 },
      { id: "lcs4", name: "LCSADC1", position: "ADC", team: "Cloud9", region: "LCS", homeLeague: "LCS", stats: { kills: 35, deaths: 22, assists: 48, cs: 3250, visionScore: 205, baronKills: 2, dragonKills: 3, turretKills: 9, gamesPlayed: 15 }, fantasyPoints: 265.5 },
      { id: "lcs5", name: "LCSSupport1", position: "SUPPORT", team: "Cloud9", region: "LCS", homeLeague: "LCS", stats: { kills: 35, deaths: 22, assists: 48, cs: 3250, visionScore: 205, baronKills: 2, dragonKills: 3, turretKills: 9, gamesPlayed: 15 }, fantasyPoints: 265.5 }
    ];
    
    // Load player data
    playerService.loadPlayersFromData(samplePlayers);
  }
}

// Helper function to load JSON file
async function loadJsonFile(filePath) {
  console.log(`DEBUG: loadJsonFile - Starting to load ${filePath}`);
  try {
    console.log(`DEBUG: loadJsonFile - About to read ${filePath}`);
    const data = await fs.readFile(filePath, 'utf8');
    console.log(`DEBUG: loadJsonFile - File read successful for ${filePath}`);
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`File not found: ${filePath}`);
      return null;
    }
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Helper function to save JSON data to a file
async function saveJsonFile(filePath, data) {
  try {
    console.log(`DEBUG: saveJsonFile - Starting to save to ${filePath}`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`DEBUG: saveJsonFile - Successfully saved to ${filePath}`);
    console.log(`Data saved to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`DEBUG: saveJsonFile - Error:`, error);
    console.error(`Error writing file ${filePath}:`, error);
    return false;
  }
}

// Helper function to save league data
async function saveLeagueData() {
  console.log('DEBUG: Starting saveLeagueData function');
  const allLeagues = leagueService.getAllLeagues();
  console.log(`DEBUG: Got ${allLeagues.length} leagues from leagueService`);
  
  // Format leagues for storage
  const leaguesData = allLeagues.map(league => {
    console.log(`DEBUG: Processing league ${league.id} - ${league.name}`);
    console.log(`DEBUG: League memberIds before saving: [${league.memberIds}]`);
    
    // Filter out null values from memberIds
    const validMemberIds = Array.isArray(league.memberIds) 
      ? league.memberIds.filter(id => id !== null && id !== undefined)
      : [];
      
    console.log(`DEBUG: Filtered memberIds: [${validMemberIds}]`);
    
    return {
      id: league.id,
      name: league.name,
      maxTeams: league.maxTeams,
      teamIds: league.teams ? league.teams.map(team => typeof team === 'object' ? team.id : team) : [],
      regions: league.regions || ['LCS', 'LEC'],
      currentWeek: league.currentWeek || 1,
      weeksPerSeason: league.schedule ? league.schedule.length : 10,
      memberIds: validMemberIds,
      creatorId: league.creatorId,
      description: league.description || '',
      isPublic: league.isPublic !== undefined ? league.isPublic : true
    };
  });
  
  console.log(`DEBUG: Formatted ${leaguesData.length} leagues for storage`);
  console.log(`DEBUG: Saving leagues to ${LEAGUE_FILE}`);
  return await saveJsonFile(LEAGUE_FILE, leaguesData);
}

// One-time function to fix existing league data with null memberIds
async function fixLeagueData() {
  console.log('DEBUG: Fixing existing league data with null memberIds');
  try {
    // Load current league data
    const leagueData = await loadJsonFile(LEAGUE_FILE);
    
    if (!leagueData || !Array.isArray(leagueData)) {
      console.log('DEBUG: No league data found or not an array');
      return;
    }
    
    // Fix each league
    const fixedLeagueData = leagueData.map(league => {
      // Remove null memberIds
      const memberIds = Array.isArray(league.memberIds) 
        ? league.memberIds.filter(id => id !== null && id !== undefined)
        : [];
      
      // If creator exists but not in memberIds, add them
      if (league.creatorId && !memberIds.includes(league.creatorId)) {
        memberIds.push(league.creatorId);
      }
      
      return {
        ...league,
        memberIds
      };
    });
    
    // Save the fixed data
    await saveJsonFile(LEAGUE_FILE, fixedLeagueData);
    console.log('DEBUG: League data fixed and saved');
  } catch (error) {
    console.error('DEBUG: Error fixing league data:', error);
  }
}

// API ENDPOINTS

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
  app.get('/api/users/me', auth, (req, res) => {
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
      for (const existingTeam of mainLeague.teams) {
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
      
      // Save teams to disk
      await saveJsonFile(TEAMS_FILE, teamService.teamsToJSON());
      
      // Save player data
      await saveJsonFile(PLAYERS_FILE, playerService.getAllPlayers());
      
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
    if (!mainLeague) {
      return res.status(404).json({ message: 'League not found' });
    }
    
    // Get all undrafted players
    const availablePlayers = mainLeague.playerPool.filter(player => !player.drafted);
    
    // Count how many players have been drafted per team
    const teamDraftCounts = mainLeague.teams.map(team => {
      let count = 0;
      
      // Count main positions
      for (const position of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"]) {
        if (team.players[position]) {
          count++;
        }
      }
      
      // Count bench
      if (team.players.BENCH) {
        count += team.players.BENCH.length;
      }
      
      return {
        team: team,
        draftedCount: count
      };
    });
    
    res.json({
      availablePlayers: availablePlayers,
      teamDraftCounts: teamDraftCounts,
      draftComplete: teamDraftCounts.every(item => item.draftedCount >= 6) // Check if all teams have at least 6 players
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
    await saveJsonFile(PLAYERS_FILE, playerService.getAllPlayers());
    
    res.json({ message: 'Player stats updated successfully' });
  } catch (error) {
    console.error(`Error updating player ${id}:`, error);
    res.status(500).json({ message: 'Error updating player stats', error: error.message });
  }
});

// Get all teams
app.get('/api/teams', (req, res) => {
  const teams = teamService.getAllTeams();
  res.json(teams);
});

// Get user's teams
app.get('/api/teams/my-teams', auth, (req, res) => {
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
app.get('/api/leagues/user', auth, (req, res) => {
  const userLeagues = leagueService.getLeaguesByUserId(req.user.id);
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

// Join a league
app.post('/api/leagues/:id/join', auth, (req, res) => {
  const { id } = req.params;
  const league = leagueService.getLeagueById(id);
  
  if (!league) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  // Check if already a member
  if (league.memberIds.includes(req.user.id)) {
    return res.status(400).json({ message: 'Already a member of this league' });
  }
  
  // Add user as member
  leagueService.addMemberToLeague(id, req.user.id);
  
  // Update user's leagues
  userService.updateUserLeagues(req.user.id, id, 'add');
  
  // Save league data
  saveLeagueData();
  
  res.json({ message: 'Successfully joined league', league });
});

// Create a new team (requires league membership)
app.post('/api/teams', auth, (req, res) => {
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
    
    // Check if user already has a team in this league
    const userAlreadyHasTeam = league.teams.some(team => team.userId === req.user.id);
    if (userAlreadyHasTeam) {
      return res.status(400).json({ message: 'You already have a team in this league' });
    }
    
    // Use the authenticated user's username as the owner
    const owner = req.user.username;
    
    const team = teamService.createTeam(name, owner, req.user.id);
    team.leagueId = leagueId; // Associate team with league
    
    // Update user's teams
    userService.updateUserTeams(req.user.id, team.id, 'add');
    
    // Add to league
    league.addTeam(team);
    saveLeagueData();
    
    // Save teams to disk
    saveJsonFile(TEAMS_FILE, teamService.teamsToJSON());
    
    res.status(201).json(team);
  });

// Add player to team
app.post('/api/teams/:teamId/players', auth, (req, res) => {
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
  
  // Save teams to disk
  saveJsonFile(TEAMS_FILE, teamService.teamsToJSON());
  
  res.json(team);
});

// Remove player from team
app.delete('/api/teams/:teamId/players/:playerId', auth, (req, res) => {
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
  
  // Save teams to disk
  saveJsonFile(TEAMS_FILE, teamService.teamsToJSON());
  
  res.json(team);
});

// Get league info
app.get('/api/league', (req, res) => {
  if (!mainLeague) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  res.json(mainLeague);
});

// Get league standings
app.get('/api/league/standings', (req, res) => {
  if (!mainLeague) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  const standings = mainLeague.updateStandings();
  res.json(standings);
});

// Get matchups for a specific week
app.get('/api/league/matchups/:week', (req, res) => {
  if (!mainLeague) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  const { week } = req.params;
  const weekNumber = parseInt(week);
  
  if (isNaN(weekNumber) || weekNumber < 1) {
    return res.status(400).json({ message: 'Invalid week number' });
  }
  
  const matchups = mainLeague.getWeekMatchups(weekNumber);
  res.json(matchups);
});

// Calculate scores for a specific week
app.post('/api/league/calculate/:week', (req, res) => {
  if (!mainLeague) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  const { week } = req.params;
  const weekNumber = parseInt(week);
  
  if (isNaN(weekNumber) || weekNumber < 1) {
    return res.status(400).json({ message: 'Invalid week number' });
  }
  
  const success = mainLeague.calculateWeekScores(weekNumber);
  if (!success) {
    return res.status(400).json({ message: 'Failed to calculate scores' });
  }
  
  // Save updated league data
  saveLeagueData();
  
  const matchups = mainLeague.getWeekMatchups(weekNumber);
  res.json(matchups);
});

// Generate a new schedule
app.post('/api/league/schedule', (req, res) => {
  if (!mainLeague) {
    return res.status(404).json({ message: 'League not found' });
  }
  
  const { weeksPerSeason } = req.body;
  const weeks = weeksPerSeason || 9; // Default 9 weeks
  
  const success = mainLeague.generateSchedule(weeks);
  if (!success) {
    return res.status(400).json({ 
      message: 'Failed to generate schedule. Need an even number of teams.'
    });
  }
  
  // Save updated league data
  saveLeagueData();
  
  res.json(mainLeague.schedule);
});

// Update all player stats from Riot API
app.post('/api/league/update-stats', async (req, res) => {
  if (!mainLeague || !riotApiService) {
    return res.status(404).json({ message: 'League or Riot API service not found' });
  }
  
  try {
    await updateRealTimeStats(mainLeague, riotApiService);
    
    // Save updated player data
    await saveJsonFile(PLAYERS_FILE, playerService.getAllPlayers());
    
    // Save updated league data
    await saveLeagueData();
    
    res.json({ message: 'Player stats updated successfully' });
  } catch (error) {
    console.error('Error updating player stats:', error);
    res.status(500).json({ message: 'Error updating player stats', error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('DEBUG: About to initialize data...');
  try {
    await initializeData();
    console.log('DEBUG: Data initialization complete');
  } catch (error) {
    console.error('DEBUG: Error during initialization:', error);
  }
  
  // Fix existing league data
  await fixLeagueData();
});