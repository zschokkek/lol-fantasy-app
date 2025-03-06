// scripts/migrateToMongoDB.js
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const connectDB = require('../config/db');
const { Player, FantasyTeam, League, User } = require('../models');

// Data storage paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const LEAGUE_FILE = path.join(DATA_DIR, 'league.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

/**
 * Load JSON file
 * @param {string} filePath - Path to JSON file
 */
async function loadJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`No data found at ${filePath} or invalid JSON`);
    return null;
  }
}

/**
 * Migrate players from JSON to MongoDB
 */
async function migratePlayers() {
  console.log('Migrating players...');
  const playerData = await loadJsonFile(PLAYERS_FILE);
  
  if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
    console.log('No player data found or invalid format');
    return [];
  }
  
  console.log(`Found ${playerData.length} players to migrate`);
  
  // Clear existing players
  await Player.deleteMany({});
  
  // Insert new players
  const players = await Player.insertMany(playerData);
  console.log(`Successfully migrated ${players.length} players`);
  
  return players;
}

/**
 * Migrate teams from JSON to MongoDB
 */
async function migrateTeams() {
  console.log('Migrating teams...');
  const teamData = await loadJsonFile(TEAMS_FILE);
  
  if (!teamData || !Array.isArray(teamData) || teamData.length === 0) {
    console.log('No team data found or invalid format');
    return [];
  }
  
  console.log(`Found ${teamData.length} teams to migrate`);
  
  // Filter out teams that don't have required fields
  const validTeams = teamData.filter(team => {
    const hasRequiredFields = team.id && team.name && team.owner;
    if (!hasRequiredFields) {
      console.log(`Skipping team with missing required fields: ${JSON.stringify(team)}`);
    }
    return hasRequiredFields;
  });
  
  console.log(`${validTeams.length} teams have all required fields`);
  
  // Clear existing teams
  await FantasyTeam.deleteMany({});
  
  if (validTeams.length === 0) {
    console.log('No valid teams to migrate');
    return [];
  }
  
  // Insert new teams
  const teams = await FantasyTeam.insertMany(validTeams);
  console.log(`Successfully migrated ${teams.length} teams`);
  
  return teams;
}

/**
 * Migrate leagues from JSON to MongoDB
 */
async function migrateLeagues() {
  console.log('Migrating leagues...');
  const leagueData = await loadJsonFile(LEAGUE_FILE);
  
  if (!leagueData || !Array.isArray(leagueData) || leagueData.length === 0) {
    console.log('No league data found or invalid format');
    return [];
  }
  
  console.log(`Found ${leagueData.length} leagues to migrate`);
  
  // Filter out leagues that don't have required fields
  const validLeagues = leagueData.filter(league => {
    const hasRequiredFields = league.id && league.name;
    if (!hasRequiredFields) {
      console.log(`Skipping league with missing required fields: ${JSON.stringify(league)}`);
    }
    return hasRequiredFields;
  });
  
  console.log(`${validLeagues.length} leagues have all required fields`);
  
  // Clear existing leagues
  await League.deleteMany({});
  
  if (validLeagues.length === 0) {
    console.log('No valid leagues to migrate');
    return [];
  }
  
  // Filter out null values from memberIds
  const cleanedLeagueData = validLeagues.map(league => {
    if (league.memberIds) {
      league.memberIds = league.memberIds.filter(id => id !== null && id !== undefined);
    }
    return league;
  });
  
  // Insert new leagues
  const leagues = await League.insertMany(cleanedLeagueData);
  console.log(`Successfully migrated ${leagues.length} leagues`);
  
  return leagues;
}

/**
 * Migrate users from JSON to MongoDB
 */
async function migrateUsers() {
  console.log('Migrating users...');
  const userData = await loadJsonFile(USERS_FILE);
  
  if (!userData || !Array.isArray(userData) || userData.length === 0) {
    console.log('No user data found or invalid format');
    return [];
  }
  
  console.log(`Found ${userData.length} users to migrate`);
  
  // Filter out users that don't have required fields
  const validUsers = userData.filter(user => {
    const hasRequiredFields = user.id && user.username && user.email && user.passwordHash;
    if (!hasRequiredFields) {
      console.log(`Skipping user with missing required fields: ${JSON.stringify(user)}`);
    }
    return hasRequiredFields;
  });
  
  console.log(`${validUsers.length} users have all required fields`);
  
  // Clear existing users
  await User.deleteMany({});
  
  if (validUsers.length === 0) {
    console.log('No valid users to migrate');
    return [];
  }
  
  // Insert new users
  const users = await User.insertMany(validUsers);
  console.log(`Successfully migrated ${users.length} users`);
  
  return users;
}

/**
 * Run the migration
 */
async function runMigration() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Migrate data
    await migratePlayers();
    await migrateTeams();
    await migrateLeagues();
    await migrateUsers();
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
