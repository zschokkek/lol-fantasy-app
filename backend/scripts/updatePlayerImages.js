// scripts/updatePlayerImages.js
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Player = require('../models/Player');

// Helper function for timestamped logs
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Helper function for error logs
const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    console.error(`Details: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
  }
};

// Connect to MongoDB
const connectDB = async () => {
  log('Attempting to connect to MongoDB...');
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fantasy-lol');
    log(`MongoDB Connected: ${conn.connection.host}`);
    log(`Database name: ${conn.connection.name}`);
  } catch (error) {
    logError('Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

// Fetch player data from LoL Esports API
const fetchPlayersFromLoLEsportsAPI = async () => {
  log('Starting fetchPlayersFromLoLEsportsAPI function');
  try {
    // Base URL for LoL Esports API
    const baseUrl = 'https://esports-api.lolesports.com/persisted/gw';
    log(`Using API base URL: ${baseUrl}`);
    
    // Get leagues first to find their IDs
    log('Fetching leagues from LoL Esports API...');
    const leaguesResponse = await axios.get(`${baseUrl}/getLeagues?hl=en-US`, {
      headers: {
        'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z', // Public API key
        'Accept': 'application/json'
      }
    });
    
    const leagues = leaguesResponse.data.data.leagues;
    log(`Successfully retrieved ${leagues.length} leagues from API`);
    
    let allPlayers = [];
    let leagueMap = new Map();
    
    // Create a map of league names/codes to their region for later use
    leagues.forEach(league => {
      leagueMap.set(league.id, {
        name: league.name,
        region: league.region
      });
    });
    
    // Fetch all teams from all tournaments directly
    log('Fetching all teams from API...');
    const teamsResponse = await axios.get(`${baseUrl}/getTeams?hl=en-US`, {
      headers: {
        'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
        'Accept': 'application/json'
      }
    });
    
    if (!teamsResponse.data.data.teams) {
      log('No teams data found from API');
      return [];
    }
    
    const teams = teamsResponse.data.data.teams;
    log(`Successfully retrieved ${teams.length} teams from API`);
    
    // Extract players from all teams
    log('Extracting players from all teams...');
    for (const team of teams) {
      log(`Processing team: ${team.name} (ID: ${team.id})`);
      
      if (!team.players || team.players.length === 0) {
        log(`No players found for team ${team.name}. Skipping...`);
        continue;
      }
      
      log(`Found ${team.players.length} players in team ${team.name}`);
      
      // Log the first player's structure to debug image field
      if (team.players.length > 0 && allPlayers.length === 0) {
        const samplePlayer = team.players[0];
        log('Sample player data structure:');
        log(JSON.stringify(samplePlayer, null, 2));
        
        // Log all the property names to see what's available
        log('Available player properties:');
        for (const prop in samplePlayer) {
          log(`- ${prop}: ${typeof samplePlayer[prop]}`);
        }
      }
      
      // Add team and league information to each player
      const playersWithTeamInfo = team.players.map(player => {
        // Try to determine league and region from homeLeague if available
        let leagueName = "Unknown";
        let region = "Unknown";
        
        if (team.homeLeague && leagueMap.has(team.homeLeague.id)) {
          const leagueInfo = leagueMap.get(team.homeLeague.id);
          leagueName = leagueInfo.name;
          region = leagueInfo.region;
        }
        
        // Extract player name from appropriate field
        let playerName = player.summonerName || player.name || player.firstName || 'Unknown';
        if (playerName === 'Unknown') {
          log(`⚠️ Warning: Could not find name for player ID: ${player.id}`);
          // Try to inspect all properties to find the name
          for (const prop in player) {
            if (typeof player[prop] === 'string' && 
                prop.toLowerCase().includes('name') && 
                player[prop] !== '') {
              log(`Found potential name in property ${prop}: ${player[prop]}`);
              playerName = player[prop];
              break;
            }
          }
        }
        
        // Debug the image property for this player
        let imageUrl = null;
        if (player.photoUrl) {
          imageUrl = player.photoUrl;
          log(`Found image URL in photoUrl for ${playerName}: ${imageUrl}`);
        } else if (player.profilePhotoUrl) {
          imageUrl = player.profilePhotoUrl;
          log(`Found image URL in profilePhotoUrl for ${playerName}: ${imageUrl}`);
        } else if (player.profileImageUrl) {
          imageUrl = player.profileImageUrl;
          log(`Found image URL in profileImageUrl for ${playerName}: ${imageUrl}`);
        } else if (player.image) {
          imageUrl = player.image;
          log(`Found image URL in image for ${playerName}: ${imageUrl}`);
        } else {
          log(`No image URL found for player ${playerName}`);
        }
        
        // Only log if we have a valid name
        if (playerName !== 'Unknown') {
          log(`Adding metadata for player: ${playerName} (Role: ${player.role || 'Unknown'}, Team: ${team.name})`);
        }
        
        // Create a clean player object with all needed metadata
        return {
          name: playerName,
          summonerName: player.summonerName || null,
          firstName: player.firstName || null,
          lastName: player.lastName || null,
          role: player.role || null,
          teamName: team.name,
          teamCode: team.code || null,
          leagueName: leagueName,
          region: region,
          imageUrl: imageUrl
        };
      });
      
      allPlayers = [...allPlayers, ...playersWithTeamInfo];
    }
    
    log(`Total players collected from all teams: ${allPlayers.length}`);
    
    // Filter out players with no valid names
    const validPlayers = allPlayers.filter(player => player.name && player.name !== 'Unknown');
    log(`Valid players with names: ${validPlayers.length} (filtered out ${allPlayers.length - validPlayers.length} unnamed players)`);
    
    return validPlayers;
  } catch (error) {
    logError('Error in fetchPlayersFromLoLEsportsAPI', error);
    return [];
  }
};

// Update player images in the database
const updatePlayerImagesInDB = async (esportsPlayers) => {
  log('Starting updatePlayerImagesInDB function');
  try {
    // Get all players from database
    log('Fetching all players from database...');
    const dbPlayers = await Player.find({});
    log(`Found ${dbPlayers.length} players in database`);
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let alreadyUpdatedCount = 0;
    let multipleMatchesCount = 0;
    
    // Create various name format maps for better matching
    log('Creating player lookup maps for efficient name matching...');
    const nameMap = new Map();  // Standard names
    const noSpaceMap = new Map(); // Names without spaces
    const lowerMap = new Map();  // Lowercase names
    const altNameMap = new Map(); // Alternative names (summoner names, etc)
    
    esportsPlayers.forEach(player => {
      if (!player.name) {
        return;
      }
      
      // Store player by various name formats for flexible matching
      const stdName = player.name.trim();
      const lowerName = stdName.toLowerCase();
      const noSpaceName = lowerName.replace(/\s/g, '');
      
      // Add to the appropriate maps
      nameMap.set(stdName, player);
      lowerMap.set(lowerName, player);
      noSpaceMap.set(noSpaceName, player);
      
      // Add alternative names if available
      if (player.summonerName) {
        const summonerLower = player.summonerName.toLowerCase();
        altNameMap.set(summonerLower, player);
        altNameMap.set(summonerLower.replace(/\s/g, ''), player);
      }
      
      // Log the name variants we're trying to match
      log(`Added to lookup maps: ${stdName} / ${lowerName} / ${noSpaceName} (${player.teamName})`);
    });
    
    log(`Created lookup maps with ${nameMap.size}/${lowerMap.size}/${noSpaceMap.size}/${altNameMap.size} entries`);
    
    // Process each database player
    log('Beginning to process database players...');
    for (let i = 0; i < dbPlayers.length; i++) {
      const dbPlayer = dbPlayers[i];
      log(`Processing player ${i+1}/${dbPlayers.length}: ${dbPlayer.name} (ID: ${dbPlayer._id})`);
      
      // Try different name formats for matching, from most to least specific
      const standardName = dbPlayer.name.trim();
      const lowerName = standardName.toLowerCase();
      const noSpaceName = lowerName.replace(/\s/g, '');
      
      // Try to find an exact match first, then try fuzzy matching
      let esportsPlayer = nameMap.get(standardName) || 
                         lowerMap.get(lowerName) || 
                         noSpaceMap.get(noSpaceName) || 
                         altNameMap.get(lowerName) || 
                         altNameMap.get(noSpaceName);
      
      // If no match found, try to find a partial match
      if (!esportsPlayer) {
        // Try partial name matching (usually first name or nickname)
        const possibleMatches = [];
        
        for (const [mapName, mapPlayer] of nameMap.entries()) {
          if (mapName.includes(standardName) || standardName.includes(mapName)) {
            possibleMatches.push(mapPlayer);
          }
        }
        
        // Only use if we found exactly one match to avoid ambiguity
        if (possibleMatches.length === 1) {
          esportsPlayer = possibleMatches[0];
          log(`Found partial name match for ${dbPlayer.name}: ${esportsPlayer.name}`);
        } else if (possibleMatches.length > 1) {
          log(`Multiple possible matches found for ${dbPlayer.name}: ${possibleMatches.map(p => p.name).join(', ')}`);
          multipleMatchesCount++;
          continue;
        }
      }
      
      if (esportsPlayer) {
        log(`Match found for ${dbPlayer.name}: ${esportsPlayer.name} from ${esportsPlayer.teamName} (${esportsPlayer.leagueName})`);
        
        // Check for image URL in our explicitly stored property
        if (esportsPlayer.imageUrl) {
          // Check if the image URL is already set and the same
          if (dbPlayer.imageUrl === esportsPlayer.imageUrl) {
            log(`Image for ${dbPlayer.name} is already up-to-date (${esportsPlayer.imageUrl})`);
            alreadyUpdatedCount++;
          } else {
            // Update player with image URL
            log(`Updating image for ${dbPlayer.name}: ${esportsPlayer.imageUrl}`);
            
            try {
              await Player.updateOne(
                { _id: dbPlayer._id },
                { $set: { 
                  imageUrl: esportsPlayer.imageUrl,
                  team: esportsPlayer.teamName,
                  teamCode: esportsPlayer.teamCode,
                  role: esportsPlayer.role || dbPlayer.role
                } }
              );
              
              log(`Successfully updated image and metadata for ${dbPlayer.name}`);
              updatedCount++;
            } catch (error) {
              logError(`Error updating player ${dbPlayer.name}`, error);
              notFoundCount++;
            }
          }
        } else {
          log(`Match found for ${dbPlayer.name}, but no image URL available from API`);
          notFoundCount++;
        }
      } else {
        log(`No match found for ${dbPlayer.name} in esports data`);
        notFoundCount++;
      }
      
      // Log progress periodically
      if ((i + 1) % 10 === 0 || i === dbPlayers.length - 1) {
        log(`Progress: ${i + 1}/${dbPlayers.length} players processed (${Math.round((i + 1) / dbPlayers.length * 100)}%)`);
      }
    }
    
    log(`
=== Update Summary ===
Total players in database: ${dbPlayers.length}
Players updated with new images: ${updatedCount}
Players with images already up-to-date: ${alreadyUpdatedCount}
Players with no match or no image: ${notFoundCount}
Multiple possible matches: ${multipleMatchesCount}
===================
    `);
  } catch (error) {
    logError('Error in updatePlayerImagesInDB', error);
  }
};

// Main function
const main = async () => {
  log('=== Starting updatePlayerImages script ===');
  try {
    log('Connecting to database...');
    await connectDB();
    
    log('Fetching players from LoL Esports API...');
    const startTime = Date.now();
    const esportsPlayers = await fetchPlayersFromLoLEsportsAPI();
    const apiTime = Date.now() - startTime;
    log(`API fetch completed in ${apiTime/1000} seconds`);
    log(`Found ${esportsPlayers.length} players from LoL Esports API`);
    
    if (esportsPlayers.length > 0) {
      log('Updating player images in database...');
      const dbStartTime = Date.now();
      await updatePlayerImagesInDB(esportsPlayers);
      const dbTime = Date.now() - dbStartTime;
      log(`Database update completed in ${dbTime/1000} seconds`);
    } else {
      log('No players found from API. Skipping database update.');
    }
    
    log('Script completed successfully.');
    process.exit(0);
  } catch (error) {
    logError('Error in main function', error);
    process.exit(1);
  }
};

// Run the script
log('Initializing updatePlayerImages script...');
main();
