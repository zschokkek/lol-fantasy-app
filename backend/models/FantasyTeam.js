// models/FantasyTeam.js
const mongoose = require('mongoose');

const playerPositionSchema = new mongoose.Schema({
  playerId: { 
    type: String,
    ref: 'Player',
    default: null
  }
}, { _id: false });

const fantasyTeamSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true,
    default: 'unknown' // Provide a default value
  },
  userId: {
    type: String,
    ref: 'User',
    default: null
  },
  leagueId: {
    type: String,
    ref: 'League',
    default: null
  },
  players: {
    TOP: { type: playerPositionSchema, default: () => ({ playerId: null }) },
    JUNGLE: { type: playerPositionSchema, default: () => ({ playerId: null }) },
    MID: { type: playerPositionSchema, default: () => ({ playerId: null }) },
    ADC: { type: playerPositionSchema, default: () => ({ playerId: null }) },
    SUPPORT: { type: playerPositionSchema, default: () => ({ playerId: null }) },
    FLEX: { type: playerPositionSchema, default: () => ({ playerId: null }) },
    BENCH: { type: [String], default: [] }
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  weeklyPoints: {
    type: Map,
    of: Number,
    default: new Map()
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Methods from your current FantasyTeam class
fantasyTeamSchema.methods.addPlayer = function(player, slot) {
  if (!player) return false;
  
  // If player is already on the team, remove them first
  this.removePlayer(player.id);
  
  // Add player to the specified slot
  if (slot === 'BENCH') {
    this.players.BENCH.push(player.id);
  } else if (['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].includes(slot)) {
    this.players[slot] = { playerId: player.id };
  } else {
    return false;
  }
  
  return true;
};

fantasyTeamSchema.methods.removePlayer = function(playerId) {
  if (!playerId) return false;
  
  // Check all positions
  const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'];
  for (const pos of positions) {
    if (this.players[pos] && this.players[pos].playerId === playerId) {
      this.players[pos] = { playerId: null };
      return true;
    }
  }
  
  // Check bench
  const benchIndex = this.players.BENCH.indexOf(playerId);
  if (benchIndex !== -1) {
    this.players.BENCH.splice(benchIndex, 1);
    return true;
  }
  
  return false;
};

fantasyTeamSchema.methods.calculateWeeklyPoints = async function(week) {
  if (!week) return 0;
  
  const Player = mongoose.model('Player');
  let totalPoints = 0;
  const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'];
  
  // Calculate points for each starting position
  for (const pos of positions) {
    if (this.players[pos] && this.players[pos].playerId) {
      const player = await Player.findOne({ id: this.players[pos].playerId });
      if (player) {
        const weekPoints = player.weeklyPoints.get(week.toString()) || 0;
        totalPoints += weekPoints;
      }
    }
  }
  
  // Store weekly points
  this.weeklyPoints.set(week.toString(), totalPoints);
  
  // Update total points
  this.totalPoints += totalPoints;
  
  return totalPoints;
};

fantasyTeamSchema.methods.isValid = function() {
  // Check if all required positions are filled
  const requiredPositions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  for (const pos of requiredPositions) {
    if (!this.players[pos] || !this.players[pos].playerId) {
      return false;
    }
  }
  
  return true;
};

const FantasyTeam = mongoose.model('FantasyTeam', fantasyTeamSchema);

module.exports = FantasyTeam;
