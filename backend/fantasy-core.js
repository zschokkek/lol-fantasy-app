// backend/fantasy-core.js

// ===============================================
// DATA MODELS
// ===============================================

/**
 * Player class representing a League of Legends player
 */
class Player {
    constructor(id, name, position, team, region) {
      this.id = id;
      this.name = name;
      this.position = position; // TOP, JUNGLE, MID, ADC, SUPPORT
      this.team = team; // Professional team name
      this.region = region; // NORTH or SOUTH
      this.stats = {
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        visionScore: 0,
        baronKills: 0,
        dragonKills: 0,
        turretKills: 0,
        gamesPlayed: 0
      };
      this.fantasyPoints = 0;
    }
  
    /**
     * Updates player stats with new game data
     * @param {Object} gameStats - Stats from a single game
     */
    updateStats(gameStats) {
      this.stats.kills += gameStats.kills || 0;
      this.stats.deaths += gameStats.deaths || 0;
      this.stats.assists += gameStats.assists || 0;
      this.stats.cs += gameStats.cs || 0;
      this.stats.visionScore += gameStats.visionScore || 0;
      this.stats.baronKills += gameStats.baronKills || 0;
      this.stats.dragonKills += gameStats.dragonKills || 0;
      this.stats.turretKills += gameStats.turretKills || 0;
      this.stats.gamesPlayed++;
      
      this.calculateFantasyPoints(gameStats);
    }
  
    /**
     * Calculate fantasy points for a single game
     * @param {Object} gameStats - Stats from a single game
     */
    calculateFantasyPoints(gameStats) {
      // Example scoring system (can be customized)
      const points = 
        (gameStats.kills || 0) * 3 + 
        (gameStats.assists || 0) * 1.5 + 
        (gameStats.cs || 0) * 0.01 + 
        (gameStats.visionScore || 0) * 0.5 + 
        (gameStats.baronKills || 0) * 4 + 
        (gameStats.dragonKills || 0) * 2 + 
        (gameStats.turretKills || 0) * 3 - 
        (gameStats.deaths || 0) * 1;
  
      this.fantasyPoints += points;
      return points;
    }
  
    /**
     * Get average fantasy points per game
     */
    getAverageFantasyPoints() {
      if (this.stats.gamesPlayed === 0) return 0;
      return this.fantasyPoints / this.stats.gamesPlayed;
    }
  }
  
  /**
   * FantasyTeam class representing a user's fantasy team
   */
  class FantasyTeam {
    constructor(id, name, owner) {
      this.id = id;
      this.name = name;
      this.owner = owner;
      this.leagueId = null; // Reference to the league this team belongs to
      this.players = {
        TOP: null,
        JUNGLE: null,
        MID: null,
        ADC: null,
        SUPPORT: null,
        FLEX: null, // Additional flex position
        BENCH: [] // Bench slots
      };
      this.totalPoints = 0;
      this.weeklyPoints = {};
    }
  
    /**
     * Add a player to the team in their specified position
     * @param {Player} player - Player to add
     * @param {String} slot - Slot to place player (position or "FLEX" or "BENCH")
     */
    addPlayer(player, slot) {
      if (slot === "BENCH") {
        if (this.players.BENCH.length < 3) { // Max 3 bench slots
          this.players.BENCH.push(player);
          return true;
        }
        return false;
      }
      
      // For flex position, accept any role
      if (slot === "FLEX") {
        this.players.FLEX = player;
        return true;
      }
      
      // For specific positions, verify player's position matches
      if (player.position === slot) {
        this.players[slot] = player;
        return true;
      }
      
      return false;
    }
  
    /**
     * Remove a player from the team
     * @param {String} playerId - ID of player to remove
     */
    removePlayer(playerId) {
      // Check all positions
      for (const position of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"]) {
        if (this.players[position] && this.players[position].id === playerId) {
          this.players[position] = null;
          return true;
        }
      }
      
      // Check bench
      const benchIndex = this.players.BENCH.findIndex(p => p.id === playerId);
      if (benchIndex !== -1) {
        this.players.BENCH.splice(benchIndex, 1);
        return true;
      }
      
      return false;
    }
  
    /**
     * Calculate total fantasy points for the team in a given week
     * @param {Number} week - Week number to calculate points for
     */
    calculateWeeklyPoints(week) {
      let weeklyTotal = 0;
      const activePositions = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"];
      
      // Calculate points from all active players
      for (const position of activePositions) {
        if (this.players[position]) {
          const player = this.players[position];
          weeklyTotal += player.fantasyPoints;
        }
      }
      
      this.weeklyPoints[week] = weeklyTotal;
      this.totalPoints += weeklyTotal;
      
      return weeklyTotal;
    }
    
    /**
     * Check if team is valid (has all required positions filled)
     */
    isValid() {
      return this.players.TOP && 
             this.players.JUNGLE && 
             this.players.MID && 
             this.players.ADC && 
             this.players.SUPPORT;
    }
  }
  
  /**
   * League class representing the fantasy league
   */
  class League {
    constructor(name, maxTeams = 10, options = {}) {
      this.id = options.id || `league_${Date.now()}`;
      this.name = name;
      this.maxTeams = maxTeams;
      this.teams = [];
      this.schedule = []; // Array of weekly matchups
      this.currentWeek = 0;
      this.standings = []; // Sorted team standings
      this.playerPool = []; // Available players
      this.memberIds = []; // User IDs of members in this league
      this.creatorId = options.creatorId || null;
      this.description = options.description || '';
      this.isPublic = options.isPublic !== undefined ? options.isPublic : true;
      this.regions = options.regions || ['LCS', 'LEC']; // Default regions
      
      // Add creator as a member if provided
      if (options.creatorId) {
        this.addMember(options.creatorId);
      }
    }
  
    /**
     * Add a team to the league
     * @param {FantasyTeam} team - Team to add
     */
    addTeam(team) {
      // Ensure teams array is properly initialized
      if (!Array.isArray(this.teams)) {
        console.log(`DEBUG: League ${this.id} teams array is not properly initialized, fixing it`);
        this.teams = [];
      }
      
      // Check if team is already in the league
      if (this.teams.includes(team.id)) {
        console.log(`DEBUG: Team ${team.id} is already in league ${this.id}`);
        return false;
      }
      
      // Check if league is full
      console.log(`DEBUG: League ${this.id} has ${this.teams.length}/${this.maxTeams} teams before adding team ${team.id}`);
      
      if (this.teams.length < this.maxTeams) {
        // Only add the team ID to the teams array, not the entire team object
        this.teams.push(team.id);
        
        // Update team's leagueId
        team.leagueId = this.id;
        
        console.log(`DEBUG: Added team ${team.id} to league ${this.id}, now has ${this.teams.length}/${this.maxTeams} teams`);
        
        this.updateStandings();
        return true;
      }
      
      console.log(`DEBUG: Cannot add team ${team.id} to league ${this.id} because it is full (${this.teams.length}/${this.maxTeams})`);
      return false;
    }
  
    /**
     * Remove a team from the league
     * @param {String} teamId - ID of team to remove
     */
    removeTeam(teamId) {
      const index = this.teams.findIndex(t => t === teamId);
      if (index !== -1) {
        this.teams.splice(index, 1);
        this.updateStandings();
        return true;
      }
      return false;
    }
  
    /**
     * Add players to the available player pool
     * @param {Array} players - Array of Player objects
     */
    addPlayersToPool(players) {
      this.playerPool = this.playerPool.concat(players);
    }
  
    /**
     * Generate a full season schedule for all teams
     * @param {Number} weeksPerSeason - Number of weeks in the season
     */
    generateSchedule(weeksPerSeason = 9) {
      this.schedule = [];
      
      // Check if we have an even number of teams
      if (this.teams.length % 2 !== 0) {
        console.error("Need an even number of teams to generate a schedule");
        return false;
      }
      
      // Implementation of a round-robin tournament schedule
      const teams = [...this.teams];
      const halfSize = teams.length / 2;
      
      for (let week = 0; week < weeksPerSeason; week++) {
        const weeklyMatchups = [];
        
        // Create matchups for this week
        for (let i = 0; i < halfSize; i++) {
          const matchup = {
            id: `week${week + 1}_match${i + 1}`,
            week: week + 1,
            homeTeam: teams[i],
            awayTeam: teams[teams.length - 1 - i],
            homeScore: 0,
            awayScore: 0,
            completed: false
          };
          
          weeklyMatchups.push(matchup);
        }
        
        this.schedule.push(weeklyMatchups);
        
        // Rotate teams for next week (first team stays, others rotate)
        teams.splice(1, 0, teams.pop());
      }
      
      return true;
    }
  
    /**
     * Calculate scores for a specific week's matchups
     * @param {Number} week - Week number to calculate
     */
    calculateWeekScores(week) {
      if (week < 1 || week > this.schedule.length) {
        console.error("Invalid week number");
        return false;
      }
      
      const weekIndex = week - 1;
      const weeklyMatchups = this.schedule[weekIndex];
      
      for (const matchup of weeklyMatchups) {
        const homeTeamPoints = matchup.homeTeam.calculateWeeklyPoints(week);
        const awayTeamPoints = matchup.awayTeam.calculateWeeklyPoints(week);
        
        matchup.homeScore = homeTeamPoints;
        matchup.awayScore = awayTeamPoints;
        matchup.completed = true;
      }
      
      this.currentWeek = Math.max(this.currentWeek, week);
      this.updateStandings();
      
      return true;
    }
  
    /**
     * Update league standings based on team performance
     */
    updateStandings() {
      // Calculate wins, losses, and points for each team
      const teamStats = this.teams.map(teamId => {
        const team = new FantasyTeam(teamId, '', '');
        let wins = 0;
        let losses = 0;
        
        // Count wins and losses across all completed matchups
        for (const weeklyMatchups of this.schedule) {
          for (const matchup of weeklyMatchups) {
            if (!matchup.completed) continue;
            
            if (matchup.homeTeam === teamId) {
              if (matchup.homeScore > matchup.awayScore) wins++;
              else if (matchup.homeScore < matchup.awayScore) losses++;
            } else if (matchup.awayTeam === teamId) {
              if (matchup.awayScore > matchup.homeScore) wins++;
              else if (matchup.awayScore < matchup.homeScore) losses++;
            }
          }
        }
        
        return {
          teamId,
          wins,
          losses,
          totalPoints: team.totalPoints
        };
      });
      
      // Sort by wins, then by total points
      teamStats.sort((a, b) => {
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.totalPoints - a.totalPoints;
      });
      
      this.standings = teamStats;
      return teamStats;
    }
    
    /**
     * Get matchups for a specific week
     * @param {Number} week - Week number to get matchups for
     */
    getWeekMatchups(week) {
      if (week < 1 || week > this.schedule.length) {
        return [];
      }
      return this.schedule[week - 1];
    }
    
    /**
     * Add a member to the league
     * @param {String} userId - User ID to add as member
     */
    addMember(userId) {
      // Don't add null or undefined memberIds
      if (userId !== null && userId !== undefined && !this.memberIds.includes(userId)) {
        this.memberIds.push(userId);
        return true;
      }
      return false;
    }
    
    /**
     * Remove a member from the league
     * @param {String} userId - User ID to remove
     */
    removeMember(userId) {
      const index = this.memberIds.indexOf(userId);
      if (index !== -1) {
        this.memberIds.splice(index, 1);
        return true;
      }
      return false;
    }
    
    /**
     * Check if user is a member of the league
     * @param {String} userId - User ID to check
     */
    isMember(userId) {
      return this.memberIds.includes(userId);
    }
  }
  
  /**
   * Service for integrating with Riot Games API
   */
  class RiotApiService {
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.baseUrl = 'https://api.riotgames.com/lol';
      this.regionEndpoints = {
        'NORTH_AMERICA': 'na1.api.riotgames.com',
        'EUROPE': 'euw1.api.riotgames.com',
        'KOREA': 'kr.api.riotgames.com',
        'BRAZIL': 'br1.api.riotgames.com',
        // Add other regions as needed
      };
      this.headers = {
        'X-Riot-Token': this.apiKey,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Charset': 'application/x-www-form-urlencoded; charset=UTF-8',
      };
      this.requestQueue = [];
      this.rateLimits = {
        // Typical rate limits (adjust based on your API key tier)
        requestsPer10Seconds: 20,
        requestsPer10Minutes: 100
      };
      this.cacheExpiration = 60 * 60 * 1000; // 1 hour in milliseconds
      this.cache = new Map();
    }
  
    /**
     * Make a rate-limited API request to Riot
     * @param {String} endpoint - API endpoint
     * @param {String} region - Region code
     * @param {Object} params - Query parameters
     */
    async makeRequest(endpoint, region, params = {}) {
      // Check cache first
      const cacheKey = `${region}:${endpoint}:${JSON.stringify(params)}`;
      if (this.cache.has(cacheKey)) {
        const cachedData = this.cache.get(cacheKey);
        if (Date.now() < cachedData.expiration) {
          console.log(`[RiotAPI] Using cached data for ${endpoint}`);
          return cachedData.data;
        }
        // Cache expired, remove it
        this.cache.delete(cacheKey);
      }
  
      // Prepare the URL with query params
      const url = new URL(`https://${this.regionEndpoints[region]}/${endpoint}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
  
      try {
        // Implement rate limiting logic
        await this.checkRateLimit();
  
        console.log(`[RiotAPI] Fetching ${url}`);
        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });
  
        // Handle rate limit headers if available
        this.updateRateLimits(response.headers);
  
        if (!response.ok) {
          throw new Error(`Riot API error: ${response.status} ${response.statusText}`);
        }
  
        const data = await response.json();
        
        // Cache the response
        this.cache.set(cacheKey, {
          data,
          expiration: Date.now() + this.cacheExpiration
        });
        
        return data;
      } catch (error) {
        console.error(`[RiotAPI] Error in request to ${endpoint}:`, error);
        throw error;
      }
    }
  
    /**
     * Check and enforce rate limits
     */
    async checkRateLimit() {
      // Simple implementation - can be improved with actual Riot rate limit headers
      return new Promise(resolve => {
        // Add artificial delay to respect rate limits
        setTimeout(resolve, 500);
      });
    }
  
    /**
     * Update rate limit tracking based on response headers
     * @param {Headers} headers - Response headers
     */
    updateRateLimits(headers) {
      // Extract and update rate limit information from headers
      // Implementation depends on Riot's specific headers
    }
  
    /**
     * Get summoner data by name
     * @param {String} summonerName - Summoner name
     * @param {String} region - Region code
     */
    async getSummonerByName(summonerName, region) {
      const endpoint = 'summoner/v4/summoners/by-name/' + encodeURIComponent(summonerName);
      return await this.makeRequest(endpoint, region);
    }
  
    /**
     * Get league entries for a summoner
     * @param {String} summonerId - Summoner ID
     * @param {String} region - Region code
     */
    async getLeagueEntries(summonerId, region) {
      const endpoint = `league/v4/entries/by-summoner/${summonerId}`;
      return await this.makeRequest(endpoint, region);
    }
  
    /**
     * Get match list for an account
     * @param {String} puuid - Player PUUID
     * @param {String} region - Region code
     * @param {Number} count - Number of matches to retrieve
     */
    async getMatchList(puuid, region, count = 20) {
      const endpoint = `match/v5/matches/by-puuid/${puuid}/ids`;
      return await this.makeRequest(endpoint, region, { count });
    }
  
    /**
     * Get match details
     * @param {String} matchId - Match ID
     * @param {String} region - Region code
     */
    async getMatchDetails(matchId, region) {
      const endpoint = `match/v5/matches/${matchId}`;
      return await this.makeRequest(endpoint, region);
    }
  
    /**
     * Get champion mastery data
     * @param {String} summonerId - Summoner ID
     * @param {String} region - Region code
     */
    async getChampionMastery(summonerId, region) {
      const endpoint = `champion-mastery/v4/champion-masteries/by-summoner/${summonerId}`;
      return await this.makeRequest(endpoint, region);
    }
    
    /**
     * Get current game info for a summoner
     * @param {String} summonerId - Summoner ID
     * @param {String} region - Region code
     */
    async getCurrentGame(summonerId, region) {
      const endpoint = `spectator/v4/active-games/by-summoner/${summonerId}`;
      return await this.makeRequest(endpoint, region);
    }
    
    /**
     * Get static data for champions
     * @param {String} region - Region code
     */
    async getChampions(region) {
      // Note: Static data is now served via Data Dragon, not direct API
      // This is a simplified example
      const version = await this.getLatestVersion();
      const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
      return await response.json();
    }
    
    /**
     * Get latest game version
     */
    async getLatestVersion() {
      const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await response.json();
      return versions[0]; // Latest version
    }
    
    /**
     * Get pro player data from a community-maintained API
     * (Since Riot doesn't directly expose pro player data)
     */
    async getProPlayers() {
      try {
        // This is an example - you might need to find an actual community API or scrape data
        const response = await fetch('https://api.example.com/lol/proplayers');
        return await response.json();
      } catch (error) {
        console.error('Error fetching pro player data:', error);
        return [];
      }
    }
    
    /**
     * Get LTA North/South region players
     * This would need to be customized based on how LTA regions are defined
     * @param {String} region - "NORTH" or "SOUTH"
     */
    async getLTAPlayers(region) {
      try {
        // In a real implementation, this would likely involve:
        // 1. Getting a list of teams in the LTA North/South region
        // 2. Getting players from each team
        // 3. Mapping them to our internal format
        
        // Example implementation (would need to be customized)
        const proPlayers = await this.getProPlayers();
        
        // Filter and format players by region
        // This is hypothetical and would need actual implementation based on data source
        const ltaPlayers = proPlayers
          .filter(player => player.league === "LTA" && player.region === region)
          .map(player => ({
            id: player.id,
            name: player.ingameName,
            position: player.role.toUpperCase(),
            team: player.team,
            region: region
          }));
        
        return ltaPlayers;
      } catch (error) {
        console.error(`Error fetching LTA ${region} players:`, error);
        return [];
      }
    }
    
    /**
     * Get player stats from recent matches
     * @param {String} puuid - Player PUUID
     * @param {String} region - Region code
     * @param {Number} count - Number of matches to analyze
     */
    async getPlayerStats(puuid, region, count = 10) {
      try {
        // Get recent matches
        const matchIds = await this.getMatchList(puuid, region, count);
        
        // Aggregate stats
        const stats = {
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          visionScore: 0,
          baronKills: 0,
          dragonKills: 0,
          turretKills: 0,
          gamesPlayed: 0
        };
        
        // Process each match
        for (const matchId of matchIds) {
          const match = await this.getMatchDetails(matchId, region);
          
          // Find player in participants
          const participant = match.info.participants.find(p => p.puuid === puuid);
          if (participant) {
            stats.kills += participant.kills;
            stats.deaths += participant.deaths;
            stats.assists += participant.assists;
            stats.cs += participant.totalMinionsKilled + participant.neutralMinionsKilled;
            stats.visionScore += participant.visionScore;
            stats.baronKills += participant.baronKills;
            stats.dragonKills += participant.dragonKills;
            // Note: some stats like turretKills might need additional calculation
            stats.gamesPlayed++;
          }
        }
        
        return stats;
      } catch (error) {
        console.error(`Error getting player stats for ${puuid}:`, error);
        return null;
      }
    }
  }
  
  /**
   * Service for loading and managing player data
   */
  class PlayerService {
    constructor(riotApiService = null) {
      this.players = [];
      this.riotApiService = riotApiService;
      this.cache = {
        allPlayers: null,
        byRegion: {},
        byPosition: {},
        byId: {},
        lastUpdated: null
      };
      this.cacheExpiry = 15 * 60 * 1000; // 15 minutes
    }
  
    /**
     * Clear all caches
     */
    clearCache() {
      this.cache = {
        allPlayers: null,
        byRegion: {},
        byPosition: {},
        byId: {},
        lastUpdated: null
      };
    }

    /**
     * Check if cache is valid
     */
    isCacheValid() {
      if (!this.cache.lastUpdated) return false;
      return (Date.now() - this.cache.lastUpdated) < this.cacheExpiry;
    }

    /**
     * Load players from JSON data
     * @param {Array} playersData - Array of player data objects
     */
    loadPlayersFromData(playersData) {
      this.players = playersData.map(data => {
        const player = new Player(
          data.id,
          data.name,
          data.position,
          data.team,
          data.region
        );
        
        // Copy stats if they exist
        if (data.stats) {
          player.stats = { ...data.stats };
        }
        
        if (data.fantasyPoints) {
          player.fantasyPoints = data.fantasyPoints;
        }
        
        return player;
      });
      
      // Reset cache after loading new data
      this.clearCache();
      
      return this.players;
    }

    /**
     * Load players from JSON file
     * @param {String} filePath - Path to JSON file containing player data
     */
    loadPlayersFromFile(filePath) {
      // Implementation remains the same
      // ...
      
      // Reset cache after loading from file
      this.clearCache();
    }

    /**
     * Load players from Riot API for LTA North/South regions
     * @param {Array} regions - Regions to fetch ("NORTH", "SOUTH" or both)
     */
    loadPlayersFromRiotApi(regions = ["NORTH", "SOUTH"]) {
      // Implementation remains the same
      // ...
      
      // Reset cache after loading from API
      this.clearCache();
    }

    /**
     * Update player stats from Riot API
     * @param {String} playerId - Player ID
     */
    updatePlayerStatsFromRiotApi(playerId) {
      // Implementation remains the same
      // ...
      
      // Reset cache for this player
      if (this.cache.byId[playerId]) {
        delete this.cache.byId[playerId];
      }
      // Reset other caches that might contain this player
      this.cache.allPlayers = null;
      this.cache.byRegion = {};
      this.cache.byPosition = {};
    }

    /**
     * Get all players
     */
    getAllPlayers() {
      // Check cache first
      if (this.cache.allPlayers && this.isCacheValid()) {
        return this.cache.allPlayers;
      }
      
      // Cache miss, store in cache
      this.cache.allPlayers = [...this.players];
      this.cache.lastUpdated = Date.now();
      
      return this.cache.allPlayers;
    }

    /**
     * Get players by region
     * @param {String} region - "NORTH" or "SOUTH"
     */
    getPlayersByRegion(region) {
      // Check cache first
      if (this.cache.byRegion[region] && this.isCacheValid()) {
        return this.cache.byRegion[region];
      }
      
      // Cache miss, filter and store in cache
      const filteredPlayers = this.players.filter(player => {
        // Normalize region names to handle different formats
        const playerRegion = player.region.toUpperCase();
        const targetRegion = region.toUpperCase();
        
        // Check if player region contains target region or vice versa
        // Also handle special case where homeLeague matches region code
        return playerRegion === targetRegion || 
               (player.homeLeague && player.homeLeague.toUpperCase() === targetRegion);
      });
      
      this.cache.byRegion[region] = filteredPlayers;
      this.cache.lastUpdated = Date.now();
      
      return filteredPlayers;
    }

    /**
     * Get players by position
     * @param {String} position - "TOP", "JUNGLE", "MID", "ADC", or "SUPPORT"
     */
    getPlayersByPosition(position) {
      // Check cache first
      if (this.cache.byPosition[position] && this.isCacheValid()) {
        return this.cache.byPosition[position];
      }
      
      // Cache miss, filter and store in cache
      const filteredPlayers = this.players.filter(player => 
        player.position.toUpperCase() === position.toUpperCase()
      );
      
      this.cache.byPosition[position] = filteredPlayers;
      this.cache.lastUpdated = Date.now();
      
      return filteredPlayers;
    }

    /**
     * Get player by ID
     * @param {String} id - Player ID
     */
    getPlayerById(id) {
      // Check cache first
      if (this.cache.byId[id] && this.isCacheValid()) {
        return this.cache.byId[id];
      }
      
      // Cache miss, find and store in cache
      const player = this.players.find(player => player.id === id);
      
      if (player) {
        this.cache.byId[id] = player;
        this.cache.lastUpdated = Date.now();
      }
      
      return player;
    }

    /**
     * Update player stats with game data
     * @param {String} playerId - Player ID
     * @param {Object} gameStats - Stats from a single game
     */
    updatePlayerStats(playerId, gameStats) {
      const player = this.getPlayerById(playerId);
      
      if (player) {
        player.updateStats(gameStats);
        
        // Reset cache for this player
        if (this.cache.byId[playerId]) {
          delete this.cache.byId[playerId];
        }
        // Reset other caches that might contain this player
        this.cache.allPlayers = null;
        this.cache.byRegion = {};
        this.cache.byPosition = {};
        
        return true;
      }
      
      return false;
    }
  }
  
  /**
   * Service for managing fantasy teams
   */
  class TeamService {
    constructor() {
      this.teams = [];
    }
  
    /**
     * Create a new fantasy team
     * @param {String} name - Team name
     * @param {String} owner - Team owner
     */
    createTeam(name, owner, userId) {
        const id = `team_${Date.now()}`;
        const team = new FantasyTeam(id, name, owner);
        team.userId = userId; // Add this property to track ownership
        this.teams.push(team);
        return team;
      }
  
    /**
     * Load teams from JSON data
     * @param {Array} teamsData - Array of team data objects
     * @param {PlayerService} playerService - Service to lookup players
     */
    loadTeamsFromData(teamsData, playerService) {
      this.teams = teamsData.map(data => {
        const team = new FantasyTeam(
          data.id,
          data.name,
          data.owner
        );
        
        // Add players to positions
        for (const position of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"]) {
          if (data.players[position]) {
            const player = playerService.getPlayerById(data.players[position]);
            if (player) {
              team.addPlayer(player, position);
            }
          }
        }
        
        // Add bench players
        if (data.players.BENCH) {
          for (const benchPlayerId of data.players.BENCH) {
            const player = playerService.getPlayerById(benchPlayerId);
            if (player) {
              team.addPlayer(player, "BENCH");
            }
          }
        }
        
        return team;
      });
      
      return this.teams;
    }
    

      // Check if user owns the team
  isTeamOwner(teamId, userId) {
    const team = this.getTeamById(teamId);
    return team && team.userId === userId;
  }

  // Get teams by user ID
  getTeamsByUserId(userId) {
    return this.teams.filter(team => team.userId === userId);
  }
    /**
     * Get all teams
     */
    getAllTeams() {
      return this.teams;
    }
    
    /**
     * Get team by ID
     * @param {String} id - Team ID
     */
    getTeamById(id) {
      return this.teams.find(team => team.id === id);
    }
    
    /**
     * Save teams to JSON
     */
    teamsToJSON() {
      return this.teams.map(team => {
        const playersData = {};
        
        // Convert player references to IDs
        for (const position of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"]) {
          playersData[position] = team.players[position]?.id || null;
        }
        
        // Convert bench players to IDs
        playersData.BENCH = team.players.BENCH.map(player => player.id);
        
        return {
          id: team.id,
          name: team.name,
          owner: team.owner,
          userId: team.userId,
          leagueId: team.leagueId,
          players: playersData,
          totalPoints: team.totalPoints,
          weeklyPoints: team.weeklyPoints
        };
      });
    }
  }
  
  /**
   * Service for managing leagues
   */
  class LeagueService {
    constructor() {
      this.leagues = [];
    }
  
    /**
     * Create a new league
     * @param {String} name - League name
     * @param {Number} maxTeams - Maximum number of teams
     * @param {Object} options - Additional options for the league
     */
    createLeague(name, maxTeams = 10, options = {}) {
      console.log(`DEBUG: LeagueService.createLeague - Creating league "${name}" with options:`, options);
      const league = new League(name, maxTeams, options);
      
      // Ensure creator is added as member if creatorId is provided
      if (options.creatorId) {
        console.log(`DEBUG: LeagueService.createLeague - Adding creator ${options.creatorId} as member`);
        league.addMember(options.creatorId);
        console.log(`DEBUG: LeagueService.createLeague - After adding creator, memberIds: [${league.memberIds}]`);
      }
      
      this.leagues.push(league);
      console.log(`DEBUG: LeagueService.createLeague - League created with ID ${league.id}, memberIds: [${league.memberIds}]`);
      return league;
    }
    
    /**
     * Get all leagues
     */
    getAllLeagues() {
      return this.leagues;
    }
    
    /**
     * Get league by name
     * @param {String} name - League name
     */
    getLeagueByName(name) {
      return this.leagues.find(league => league.name === name);
    }
    
    /**
     * Load a league with teams and players
     * @param {Object} leagueData - League data
     * @param {TeamService} teamService - Team service for looking up teams
     * @param {PlayerService} playerService - Player service for populating player pool
     */
    loadLeagueFromData(leagueData, teamService, playerService) {
      // Create the league with options
      const league = this.createLeague(leagueData.name, leagueData.maxTeams, {
        id: leagueData.id || `league_${Date.now()}`,
        creatorId: leagueData.creatorId,
        description: leagueData.description,
        isPublic: leagueData.isPublic,
        regions: leagueData.regions || ['LCS', 'LEC'] // Load regions from data
      });
      
      // Set current week if available
      if (leagueData.currentWeek) {
        league.currentWeek = leagueData.currentWeek;
      }
      
      // Add teams to league
      // Handle both 'teams' and 'teamIds' for backward compatibility
      const teamIds = leagueData.teams || leagueData.teamIds || [];
      
      if (teamIds && teamIds.length > 0) {
        console.log(`DEBUG: Loading ${teamIds.length} teams for league ${league.id}`);
        for (const teamId of teamIds) {
          // Handle both team objects and team IDs
          const teamIdValue = teamId.id || teamId;
          const team = teamService.getTeamById(teamIdValue);
          if (team) {
            league.addTeam(team);
          } else {
            console.log(`DEBUG: Team with ID ${teamIdValue} not found`);
          }
        }
      }
      
      // Add members to league
      if (leagueData.memberIds) {
        for (const memberId of leagueData.memberIds) {
          // Skip null memberIds
          if (memberId !== null) {
            league.addMember(memberId);
          }
        }
      }
      
      // Populate player pool based on regions
      if (league.regions && league.regions.length > 0) {
        let allPlayersForLeague = [];
        
        // Fetch players for each region and combine them
        for (const region of league.regions) {
          const regionPlayers = playerService.getPlayersByRegion(region);
          if (regionPlayers && regionPlayers.length > 0) {
            allPlayersForLeague = [...allPlayersForLeague, ...regionPlayers];
          }
        }
        
        // Remove duplicates by ID
        const uniquePlayers = [];
        const uniqueIds = new Set();
        
        for (const player of allPlayersForLeague) {
          if (!uniqueIds.has(player.id)) {
            uniqueIds.add(player.id);
            uniquePlayers.push(player);
          }
        }
        
        league.addPlayersToPool(uniquePlayers);
      }
      // For backward compatibility
      else if (leagueData.playerPoolIds) {
        const players = leagueData.playerPoolIds.map(id => 
          playerService.getPlayerById(id)
        ).filter(player => player !== undefined);
        
        league.addPlayersToPool(players);
      }
      
      // Generate schedule if needed
      if (leagueData.weeksPerSeason) {
        league.generateSchedule(leagueData.weeksPerSeason);
      }
      
      return league;
    }
    
    /**
     * Load multiple leagues from an array of league data
     * @param {Array} leaguesData - Array of league data objects
     * @param {TeamService} teamService - Team service for looking up teams
     * @param {PlayerService} playerService - Player service for populating player pool
     */
    loadLeaguesFromData(leaguesData, teamService, playerService) {
      if (!Array.isArray(leaguesData)) {
        console.error('ERROR: leaguesData must be an array');
        return [];
      }
      
      const loadedLeagues = [];
      
      for (const leagueData of leaguesData) {
        try {
          const league = this.loadLeagueFromData(leagueData, teamService, playerService);
          loadedLeagues.push(league);
        } catch (error) {
          console.error(`ERROR: Failed to load league ${leagueData.name || 'unknown'}:`, error);
        }
      }
      
      console.log(`DEBUG: Loaded ${loadedLeagues.length} leagues`);
      return loadedLeagues;
    }
    
    /**
     * Update all league standings
     */
    updateAllLeagueStandings() {
      for (const league of this.leagues) {
        league.updateStandings();
      }
    }
    
    /**
     * Get league by ID
     * @param {String} id - League ID
     * @param {Boolean} resolveTeams - Whether to resolve team references to full objects
     * @param {Boolean} forceRefresh - Whether to force a refresh of cached data
     */
    getLeagueById(id, resolveTeams = true, forceRefresh = false) {
      // Log request for debugging
      console.log(`Getting league ${id} (resolveTeams=${resolveTeams}, forceRefresh=${forceRefresh})`);
      
      // Get league from in-memory cache
      const league = this.leagues.find(league => league.id === id);
      
      if (!league) {
        console.log(`League with ID ${id} not found`);
        return null;
      }
      
      // If we don't need to resolve teams or refresh, return as-is
      if (!resolveTeams && !forceRefresh) {
        return league;
      }
      
      // Create a safe, serializable copy of the league
      // Instead of using JSON.parse/stringify which can have issues with circular references,
      // manually create a new object with only the properties we need
      const leagueCopy = {
        id: league.id,
        name: league.name,
        maxTeams: league.maxTeams,
        currentWeek: league.currentWeek || 0,
        isPublic: Boolean(league.isPublic),
        memberIds: Array.isArray(league.memberIds) ? [...league.memberIds] : [],
        creatorId: league.creatorId,
        description: league.description || '',
        regions: Array.isArray(league.regions) ? [...league.regions] : [],
        teams: Array.isArray(league.teams) ? [...league.teams] : []  // Initial copy of team IDs
      };
      
      // If teams should be resolved, replace team IDs with actual team objects
      if (resolveTeams && Array.isArray(leagueCopy.teams)) {
        console.log(`Resolving ${leagueCopy.teams.length} team references for league ${id}`);
        
        // Get reference to the teamService from the global scope
        // In fantasy-core.js, we can't require the service from a path as it would cause circular dependencies
        const teamService = global.teamService;
        
        if (!teamService) {
          console.error('TeamService not found in global scope');
          return leagueCopy; // Return without resolving teams if service not available
        }
        
        // Replace team IDs with actual team objects
        leagueCopy.teams = leagueCopy.teams.map(teamId => {
          // Handle case where team might already be an object
          if (typeof teamId === 'object' && teamId !== null) {
            // Create a safe copy of the already resolved team object to avoid circular references
            return {
              id: teamId.id,
              name: teamId.name,
              owner: teamId.owner,
              leagueId: teamId.leagueId,
              totalPoints: teamId.totalPoints || 0
            };
          }
          
          // Try to get the team by ID
          const team = teamService.getTeamById(teamId);
          if (team) {
            // Create a safe copy of the team object with only needed properties
            return {
              id: team.id,
              name: team.name,
              owner: team.owner,
              leagueId: team.leagueId,
              totalPoints: team.totalPoints || 0,
              // Include only necessary properties to avoid circular references
            };
          } else {
            console.log(`Warning: Team ${teamId} not found when resolving for league ${id}`);
            // Return a placeholder to avoid null values
            return { id: teamId, name: 'Team not found', owner: 'Unknown' };
          }
        }).filter(team => team !== null && team !== undefined); // Filter out any null/undefined teams
        
        console.log(`Resolved ${leagueCopy.teams.length} teams for league ${id}`);
      }
      
      return leagueCopy;
    }
    
    /**
     * Get leagues by user ID (leagues the user is a member of)
     * @param {String} userId - User ID
     */
    getLeaguesByUserId(userId) {
      console.log(`DEBUG: LeagueService.getLeaguesByUserId - Finding leagues for user ${userId}`);
      
      if (!userId) {
        console.log(`DEBUG: LeagueService.getLeaguesByUserId - User ID is null or undefined`);
        return [];
      }
      
      const userLeagues = this.leagues.filter(league => {
        if (!league.memberIds) {
          return false;
        }
        
        // Filter out any null values in memberIds
        const validMemberIds = league.memberIds.filter(id => id !== null && id !== undefined);
        return validMemberIds.includes(userId);
      });
      
      console.log(`DEBUG: LeagueService.getLeaguesByUserId - Found ${userLeagues.length} leagues for user ${userId}`);
      return userLeagues;
    }
    
    /**
     * Add a member to a league
     * @param {String} leagueId - ID of the league to add member to
     * @param {String} userId - User ID to add as member
     */
    addMemberToLeague(leagueId, userId) {
      console.log(`DEBUG: LeagueService.addMemberToLeague - Adding user ${userId} to league ${leagueId}`);
      const league = this.getLeagueById(leagueId);
      
      if (!league) {
        console.log(`DEBUG: LeagueService.addMemberToLeague - League ${leagueId} not found`);
        return false;
      }
      
      if (!userId) {
        console.log(`DEBUG: LeagueService.addMemberToLeague - User ID is null or undefined`);
        return false;
      }
      
      // Add the member to the league
      const result = league.addMember(userId);
      console.log(`DEBUG: LeagueService.addMemberToLeague - Result: ${result}, memberIds: [${league.memberIds}]`);
      return result;
    }
    
    /**
     * Remove a member from a league
     * @param {String} leagueId - League ID
     * @param {String} userId - User ID to remove
     */
    removeMemberFromLeague(leagueId, userId) {
      const league = this.getLeagueById(leagueId);
      if (league) {
        return league.removeMember(userId);
      }
      return false;
    }
    
    /**
     * Add a team to a league
     * @param {String} leagueId - League ID
     * @param {String} teamId - Team ID to add
     * @param {TeamService} teamService - Team service for looking up teams (optional)
     */
    addTeamToLeague(leagueId, teamId, teamService) {
      const league = this.getLeagueById(leagueId);
      if (!league) return false;
      
      const team = teamService ? teamService.getTeamById(teamId) : teamId;
      if (team) {
        return league.addTeam(team);
      }
      return false;
    }
  }
  
  // ===============================================
  // AUTOMATIC STATS UPDATER
  // ===============================================
  
  /**
   * StatsUpdater class for automatically refreshing player stats
   */
  class StatsUpdater {
    constructor(league, riotApiService, updateInterval = 30 * 60 * 1000) { // Default 30 min
      this.league = league;
      this.riotApiService = riotApiService;
      this.updateInterval = updateInterval;
      this.timerId = null;
      this.isUpdating = false;
    }
    
    /**
     * Start automatic updates
     */
    start() {
      if (this.timerId) {
        console.log("Stats updater is already running");
        return;
      }
      
      console.log(`Starting automatic stats updates every ${this.updateInterval/60000} minutes`);
      
      // Do an initial update
      this.update();
      
      // Set up interval for future updates
      this.timerId = setInterval(() => this.update(), this.updateInterval);
    }
    
    /**
     * Stop automatic updates
     */
    stop() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
        console.log("Stopped automatic stats updates");
      }
    }
    
    /**
     * Run a single update cycle
     */
    async update() {
      if (this.isUpdating) {
        console.log("Update already in progress, skipping");
        return;
      }
      
      this.isUpdating = true;
      console.log("Updating player stats from Riot API...");
      
      try {
        await updateRealTimeStats(this.league, this.riotApiService);
        console.log("Stats update completed successfully");
      } catch (error) {
        console.error("Error during stats update:", error);
      } finally {
        this.isUpdating = false;
      }
    }
  }
  
  // ===============================================
  // UTILITIES
  // ===============================================
  
  /**
   * Utility to load player data from a JSON file
   * @param {String} filePath - Path to JSON file
   */
  async function loadPlayerDataFromFile(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error loading player data:", error);
      return null;
    }
  }
  
  /**
   * Utility to save league data to JSON
   * @param {League} league - League object to save
   */
  function saveLeagueToJSON(league) {
    const leagueData = {
      name: league.name,
      maxTeams: league.maxTeams,
      teams: league.teams.map(team => team.id),
      currentWeek: league.currentWeek,
      schedule: league.schedule,
      standings: league.standings.map(standing => ({
        teamId: standing.teamId,
        wins: standing.wins,
        losses: standing.losses,
        totalPoints: standing.totalPoints
      }))
    };
    
    return JSON.stringify(leagueData, null, 2);
  }
  
  /**
   * Utility to export fantasy team to CSV
   * @param {FantasyTeam} team - Team to export
   */
  function exportTeamToCSV(team) {
    let csv = "Position,Player Name,Team,Region,Kills,Deaths,Assists,CS,Vision Score,Fantasy Points\n";
    
    for (const position of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FLEX"]) {
      const player = team.players[position];
      if (player) {
        csv += `${position},${player.name},${player.team},${player.region},`;
        csv += `${player.stats.kills},${player.stats.deaths},${player.stats.assists},`;
        csv += `${player.stats.cs},${player.stats.visionScore},${player.fantasyPoints.toFixed(2)}\n`;
      }
    }
    
    return csv;
  }
  
  /**
   * Utility function to fetch real-time player stats from Riot API
   * @param {League} league - League object
   * @param {RiotApiService} riotApiService - RiotApiService instance
   */
  async function updateRealTimeStats(league, riotApiService) {
    if (!riotApiService) {
      console.error("RiotApiService is required for real-time updates");
      return false;
    }
    
    const playerService = new PlayerService(riotApiService);
    let updatedCount = 0;
    
    // Process all players in the league
    for (const player of league.playerPool) {
      try {
        // Convert player ID to summoner name and region format
        const summoner = await riotApiService.getSummonerByName(
          player.name,
          player.region === "NORTH" ? "NORTH_AMERICA" : "EUROPE" // Example mapping
        );
        
        if (summoner && summoner.puuid) {
          // Check if player is in an active game
          const currentGame = await riotApiService.getCurrentGame(summoner.id, 
            player.region === "NORTH" ? "NORTH_AMERICA" : "EUROPE"
          );
          
          // If player is in game, set a flag for live tracking
          if (currentGame) {
            console.log(`${player.name} is currently in a game!`);
            player.inGame = true;
            // You could implement live stat tracking here
          } else {
            player.inGame = false;
            
            // Update player with recent stats instead
            const stats = await riotApiService.getPlayerStats(
              summoner.puuid,
              player.region === "NORTH" ? "NORTH_AMERICA" : "EUROPE",
              5 // Last 5 matches
            );
            
            if (stats) {
              player.updateStats(stats);
              updatedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`Error updating stats for ${player.name}:`, error);
      }
    }
    
    console.log(`Updated stats for ${updatedCount} players`);
    
    // Recalculate fantasy points for all teams
    for (const team of league.teams) {
      for (const weeklyMatchups of league.schedule) {
        for (const matchup of weeklyMatchups) {
          if (matchup.completed) {
            matchup.homeScore = matchup.homeTeam.calculateWeeklyPoints(matchup.week);
            matchup.awayScore = matchup.awayTeam.calculateWeeklyPoints(matchup.week);
          }
        }
      }
    }
    
    // Update standings
    league.updateStandings();
    
    return true;
  }
  
  /**
   * Example function to initialize the fantasy app
   */
  async function initializeFantasyApp(useRiotApi = true, apiKey = null) {
    // Create services
    let riotApiService = null;
    
    if (useRiotApi && apiKey) {
      riotApiService = new RiotApiService(apiKey);
      console.log("Riot API service initialized");
    } else {
      console.log("Using sample data (Riot API not configured)");
    }
    
    const playerService = new PlayerService(riotApiService);
    const teamService = new TeamService();
    const leagueService = new LeagueService();
    
    // Load player data - either from Riot API or sample data
    if (useRiotApi && riotApiService) {
      try {
        console.log("Loading players from Riot API...");
        await playerService.loadPlayersFromRiotApi(["NORTH", "SOUTH"]);
        console.log(`Loaded ${playerService.players.length} players from Riot API`);
      } catch (error) {
        console.error("Error loading players from Riot API:", error);
        console.log("Falling back to sample data...");
        loadSamplePlayers();
      }
    } else {
      loadSamplePlayers();
    }
    
    // Create some fantasy teams
    const team1 = teamService.createTeam("Fantasy Fighters", "User1");
    const team2 = teamService.createTeam("LoL Legends", "User2");
    const team3 = teamService.createTeam("Summoner's Rift", "User3");
    const team4 = teamService.createTeam("Baron Nashor", "User4");
    
    // Add players to teams
    team1.addPlayer(playerService.getPlayerById("n1"), "TOP");
    team1.addPlayer(playerService.getPlayerById("n2"), "JUNGLE");
    team1.addPlayer(playerService.getPlayerById("s3"), "MID");
    team1.addPlayer(playerService.getPlayerById("s4"), "ADC");
    team1.addPlayer(playerService.getPlayerById("n5"), "SUPPORT");
    team1.addPlayer(playerService.getPlayerById("s6"), "FLEX");
    
    team2.addPlayer(playerService.getPlayerById("s1"), "TOP");
    team2.addPlayer(playerService.getPlayerById("s2"), "JUNGLE");
    team2.addPlayer(playerService.getPlayerById("n3"), "MID");
    team2.addPlayer(playerService.getPlayerById("n4"), "ADC");
    team2.addPlayer(playerService.getPlayerById("s5"), "SUPPORT");
    team2.addPlayer(playerService.getPlayerById("n6"), "FLEX");
    
    team3.addPlayer(playerService.getPlayerById("n6"), "TOP");
    team3.addPlayer(playerService.getPlayerById("n7"), "JUNGLE");
    team3.addPlayer(playerService.getPlayerById("n8"), "MID");
    team3.addPlayer(playerService.getPlayerById("s9"), "ADC");
    team3.addPlayer(playerService.getPlayerById("s10"), "SUPPORT");
    team3.addPlayer(playerService.getPlayerById("s1"), "FLEX");
    
    team4.addPlayer(playerService.getPlayerById("s6"), "TOP");
    team4.addPlayer(playerService.getPlayerById("s7"), "JUNGLE");
    team4.addPlayer(playerService.getPlayerById("s8"), "MID");
    team4.addPlayer(playerService.getPlayerById("n9"), "ADC");
    team4.addPlayer(playerService.getPlayerById("n10"), "SUPPORT");
    team4.addPlayer(playerService.getPlayerById("n1"), "FLEX");
    
    // Create a league and add teams
    const league = leagueService.createLeague("LTA North-South Fantasy League", 8);
    league.addTeam(team1);
    league.addTeam(team2);
    league.addTeam(team3);
    league.addTeam(team4);
    
    // Add all players to the player pool
    league.addPlayersToPool(playerService.getAllPlayers());
    
    // Generate a schedule for 6 weeks
    league.generateSchedule(6);
    
    return {
      playerService,
      teamService,
      leagueService,
      league,
      riotApiService
    };
  }
  
  // Export all classes and functions
  module.exports = {
    Player,
    FantasyTeam,
    League,
    PlayerService,
    TeamService,
    LeagueService,
    RiotApiService,
    StatsUpdater,
    initializeFantasyApp,
    loadPlayerDataFromFile,
    saveLeagueToJSON,
    exportTeamToCSV,
    updateRealTimeStats
  };