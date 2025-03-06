/**
 * Test Script: Create League, Fill Schedule, Generate Matchups
 * 
 * This script demonstrates how to:
 * 1. Create a new fantasy league
 * 2. Add teams to the league
 * 3. Generate a schedule for the league
 * 4. View the generated matchups
 * 
 * For local testing only - no authentication required
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const NUM_TEAMS = 12;
const NUM_WEEKS = 11;
const LEAGUE_NAME = 'Test League';
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

// API client without authentication for local testing
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create a new league
const createLeague = async () => {
  try {
    console.log(`Creating new league "${LEAGUE_NAME}"...`);
    const response = await api.post('/leagues', {
      name: LEAGUE_NAME,
      maxTeams: NUM_TEAMS,
      regions: ['LCS', 'LEC'],
      description: 'Test league created by script',
      isPublic: true,
      owner: 'TestScript' // Add an owner for the league
    });
    console.log(`League created successfully! ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to create league:', error.response?.data?.message || error.message);
    throw error;
  }
};

// Create a team in a league
const createTeam = async (leagueId, teamName, index) => {
  try {
    console.log(`Creating team "${teamName}" in league ${leagueId}...`);
    
    // For all teams, use direct team creation
    const response = await api.post(`/leagues/${leagueId}/teams`, {
      name: teamName,
      owner: `Owner ${index + 1}`
    });
    
    console.log(`Team created successfully! ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to create team "${teamName}":`, error.response?.data?.message || error.message);
    // Continue with other teams even if one fails
    return null;
  }
};

// Generate a schedule for a league
const generateSchedule = async (leagueId, weeks) => {
  try {
    console.log(`Generating ${weeks} week schedule for league ${leagueId}...`);
    const response = await api.post(`/leagues/${leagueId}/schedule`, { weeks });
    console.log('Schedule generated successfully!');
    return response.data;
  } catch (error) {
    console.error('Failed to generate schedule:', error.response?.data?.message || error.message);
    throw error;
  }
};

// Get matchups for a specific week
const getMatchups = async (leagueId, week) => {
  try {
    console.log(`Getting matchups for league ${leagueId}, week ${week}...`);
    const response = await api.get(`/leagues/${leagueId}/matchups/${week}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get matchups:', error.response?.data?.message || error.message);
    return [];
  }
};

// Display matchups in a readable format
const displayMatchups = (matchups, week) => {
  console.log(`\n===== WEEK ${week} MATCHUPS =====`);
  if (!matchups || matchups.length === 0) {
    console.log('No matchups found for this week.');
    return;
  }

  matchups.forEach((matchup, index) => {
    console.log(`\nMatchup #${index + 1}:`);
    console.log(`${matchup.homeTeam.name} vs. ${matchup.awayTeam.name}`);
  });
};

// Main function to run the test
const runTest = async () => {
  try {
    // Step 1: Create a new league
    const league = await createLeague();
    
    // Step 2: Create teams in the league
    const teams = [];
    for (let i = 0; i < Math.min(NUM_TEAMS, TEAM_NAMES.length); i++) {
      const team = await createTeam(league.id, TEAM_NAMES[i], i);
      if (team) teams.push(team);
      
      // Small delay between team creations to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\nCreated ${teams.length} teams in the league.`);
    
    // Step 3: Generate a schedule
    await generateSchedule(league.id, NUM_WEEKS);
    
    // Step 4: Display matchups for each week
    for (let week = 1; week <= NUM_WEEKS; week++) {
      const matchups = await getMatchups(league.id, week);
      displayMatchups(matchups, week);
    }
    
    console.log('\nTest completed successfully!');
    console.log(`\nLeague ID: ${league.id}`);
    console.log('You can now view this league in the app.');
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
runTest();
