// models/League.js
const mongoose = require('mongoose');

const matchupSchema = new mongoose.Schema({
  teamA: { type: String, ref: 'FantasyTeam' },
  teamB: { type: String, ref: 'FantasyTeam' },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  winner: { type: String, default: null }
}, { _id: false });

const weekScheduleSchema = new mongoose.Schema({
  week: { type: Number, required: true },
  matchups: [matchupSchema]
}, { _id: false });

const standingSchema = new mongoose.Schema({
  teamId: { type: String, ref: 'FantasyTeam' },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  points: { type: Number, default: 0 }
}, { _id: false });

const leagueSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  maxTeams: {
    type: Number,
    default: 10
  },
  teams: [{
    type: String,
    ref: 'FantasyTeam'
  }],
  schedule: [weekScheduleSchema],
  currentWeek: {
    type: Number,
    default: 0
  },
  standings: [standingSchema],
  playerPool: [{
    type: String,
    ref: 'Player'
  }],
  memberIds: [{
    type: String,
    ref: 'User'
  }],
  creatorId: {
    type: String,
    ref: 'User',
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  regions: {
    type: [String],
    default: ['LCS', 'LEC']
  }
}, {
  timestamps: true
});

// League model methods
leagueSchema.methods.addTeam = function(team) {
  // Validate inputs
  if (!team) {
    console.error('Cannot add null or undefined team to league');
    return false;
  }
  
  // Check if league is at capacity
  if (this.teams.length >= this.maxTeams) {
    console.error(`League ${this.id} is at capacity (${this.teams.length}/${this.maxTeams})`);
    return false;
  }
  
  // Normalize the team ID regardless of whether we received a team object or just an ID
  const teamId = typeof team === 'object' ? team.id : team;
  
  if (!teamId) {
    console.error('Team ID is missing or invalid');
    return false;
  }
  
  // Check if team is already in the league (more robust comparison)
  const isTeamAlreadyInLeague = this.teams.some(existingTeam => {
    // Handle both string IDs and object references
    const existingId = typeof existingTeam === 'object' ? 
      (existingTeam.id || existingTeam._id?.toString()) : 
      existingTeam?.toString();
    
    return existingId === teamId.toString();
  });
  
  if (isTeamAlreadyInLeague) {
    console.log(`Team ${teamId} is already in league ${this.id}`);
    return false;
  }
  
  // Add team to league (store as string ID for consistency)
  console.log(`Adding team ${teamId} to league ${this.id}`);
  this.teams.push(teamId.toString());
  
  // Update team's leagueId if we received a team object
  if (typeof team === 'object') {
    team.leagueId = this.id;
    console.log(`Updated team ${team.id} with leagueId ${this.id}`);
  }
  
  return true;
};

leagueSchema.methods.removeTeam = function(teamId) {
  // Check if team is in the league
  const index = this.teams.indexOf(teamId);
  
  if (index === -1) return false;
  
  // Remove team from league
  this.teams.splice(index, 1);
  
  return true;
};

leagueSchema.methods.addPlayersToPool = function(players) {
  if (!players || !Array.isArray(players)) return false;
  
  for (const player of players) {
    if (!this.playerPool.includes(player.id)) {
      this.playerPool.push(player.id);
    }
  }
  
  return true;
};

leagueSchema.methods.generateSchedule = function(weeksPerSeason = 9) {
  if (this.teams.length < 2) return false;
  
  this.schedule = [];
  
  // Create a copy of teams array for scheduling
  const teams = [...this.teams];
  
  // If odd number of teams, add a "bye" team
  if (teams.length % 2 !== 0) {
    teams.push('BYE');
  }
  
  const numTeams = teams.length;
  const numRounds = numTeams - 1;
  const halfSize = numTeams / 2;
  
  // Initialize schedule
  for (let week = 1; week <= weeksPerSeason; week++) {
    this.schedule.push({
      week,
      matchups: []
    });
  }
  
  // Generate round-robin schedule
  const teamIndices = teams.map((_, i) => i).slice(1);
  
  for (let round = 0; round < numRounds; round++) {
    const weekSchedule = [];
    
    // First team vs last team
    const firstTeam = teams[0];
    const lastTeam = teams[teamIndices[teamIndices.length - 1]];
    
    if (firstTeam !== 'BYE' && lastTeam !== 'BYE') {
      weekSchedule.push({
        teamA: firstTeam,
        teamB: lastTeam,
        scoreA: 0,
        scoreB: 0,
        winner: null
      });
    }
    
    // Rest of the teams
    for (let i = 0; i < halfSize - 1; i++) {
      const teamA = teams[teamIndices[i]];
      const teamB = teams[teamIndices[teamIndices.length - 1 - i]];
      
      if (teamA !== 'BYE' && teamB !== 'BYE') {
        weekSchedule.push({
          teamA,
          teamB,
          scoreA: 0,
          scoreB: 0,
          winner: null
        });
      }
    }
    
    // Add matchups to the schedule (distribute across weeks)
    for (let i = 0; i < weekSchedule.length; i++) {
      const weekIndex = (round + i) % weeksPerSeason;
      this.schedule[weekIndex].matchups.push(weekSchedule[i]);
    }
    
    // Rotate teams (except first team)
    teamIndices.unshift(teamIndices.pop());
  }
  
  return true;
};

leagueSchema.methods.calculateWeekScores = async function(week) {
  if (!week || week <= 0 || week > this.schedule.length) return false;
  
  const weekSchedule = this.schedule[week - 1];
  if (!weekSchedule) return false;
  
  const FantasyTeam = mongoose.model('FantasyTeam');
  
  // Calculate scores for each matchup
  for (const matchup of weekSchedule.matchups) {
    // Get teams
    const teamA = await FantasyTeam.findOne({ id: matchup.teamA });
    const teamB = await FantasyTeam.findOne({ id: matchup.teamB });
    
    if (!teamA || !teamB) continue;
    
    // Calculate weekly points
    const scoreA = await teamA.calculateWeeklyPoints(week);
    const scoreB = await teamB.calculateWeeklyPoints(week);
    
    // Update matchup scores
    matchup.scoreA = scoreA;
    matchup.scoreB = scoreB;
    
    // Determine winner
    if (scoreA > scoreB) {
      matchup.winner = teamA.id;
    } else if (scoreB > scoreA) {
      matchup.winner = teamB.id;
    } else {
      matchup.winner = 'TIE';
    }
  }
  
  // Update standings after calculating scores
  await this.updateStandings();
  
  return true;
};

leagueSchema.methods.updateStandings = async function() {
  // Initialize standings
  this.standings = [];
  
  // Create a map for quick lookup
  const standingsMap = new Map();
  
  // Initialize standings for all teams
  for (const teamId of this.teams) {
    standingsMap.set(teamId, {
      teamId,
      wins: 0,
      losses: 0,
      points: 0
    });
  }
  
  // Calculate standings based on matchups
  for (const weekSchedule of this.schedule) {
    for (const matchup of weekSchedule.matchups) {
      if (matchup.winner === null || matchup.winner === 'TIE') continue;
      
      // Update winner
      const winnerStanding = standingsMap.get(matchup.winner);
      if (winnerStanding) {
        winnerStanding.wins += 1;
        winnerStanding.points += matchup.winner === matchup.teamA ? matchup.scoreA : matchup.scoreB;
      }
      
      // Update loser
      const loserId = matchup.winner === matchup.teamA ? matchup.teamB : matchup.teamA;
      const loserStanding = standingsMap.get(loserId);
      if (loserStanding) {
        loserStanding.losses += 1;
        loserStanding.points += matchup.winner === matchup.teamA ? matchup.scoreB : matchup.scoreA;
      }
    }
  }
  
  // Convert map to array and sort by wins (descending), then points (descending)
  this.standings = Array.from(standingsMap.values())
    .sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      return b.points - a.points;
    });
  
  return this.standings;
};

leagueSchema.methods.getWeekMatchups = function(week) {
  if (!week || week <= 0 || week > this.schedule.length) return [];
  
  return this.schedule[week - 1].matchups;
};

leagueSchema.methods.addMember = function(userId) {
  if (!userId) return false;
  
  // Check if user is already a member
  if (this.memberIds.includes(userId)) return false;
  
  // Add user to members
  this.memberIds.push(userId);
  
  return true;
};

leagueSchema.methods.removeMember = function(userId) {
  if (!userId) return false;
  
  // Find user index
  const index = this.memberIds.indexOf(userId);
  if (index === -1) return false;
  
  // Remove user from members
  this.memberIds.splice(index, 1);
  
  return true;
};

leagueSchema.methods.isMember = function(userId) {
  if (!userId) return false;
  
  return this.memberIds.includes(userId);
};

const League = mongoose.model('League', leagueSchema);

module.exports = League;
