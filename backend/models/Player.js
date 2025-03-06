// models/Player.js
const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema({
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  assists: { type: Number, default: 0 },
  cs: { type: Number, default: 0 },
  visionScore: { type: Number, default: 0 },
  baronKills: { type: Number, default: 0 },
  dragonKills: { type: Number, default: 0 },
  turretKills: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 }
}, { _id: false });

const playerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true,
    enum: ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'NONE']
  },
  team: {
    type: String,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  homeLeague: {
    type: String,
    default: null
  },
  stats: {
    type: playerStatsSchema,
    default: () => ({})
  },
  fantasyPoints: {
    type: Number,
    default: 0
  },
  weeklyPoints: {
    type: Map,
    of: Number,
    default: new Map()
  },
  imageUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Methods from your current Player class
playerSchema.methods.updateStats = function(gameStats) {
  if (!gameStats) return;
  
  // Update stats
  this.stats.kills += gameStats.kills || 0;
  this.stats.deaths += gameStats.deaths || 0;
  this.stats.assists += gameStats.assists || 0;
  this.stats.cs += gameStats.cs || 0;
  this.stats.visionScore += gameStats.visionScore || 0;
  this.stats.baronKills += gameStats.baronKills || 0;
  this.stats.dragonKills += gameStats.dragonKills || 0;
  this.stats.turretKills += gameStats.turretKills || 0;
  this.stats.gamesPlayed += 1;
  
  // Calculate fantasy points for this game
  const gamePoints = this.calculateFantasyPoints(gameStats);
  
  // Update total fantasy points
  this.fantasyPoints += gamePoints;
  
  // Update weekly points if week is provided
  if (gameStats.week) {
    const currentWeekPoints = this.weeklyPoints.get(gameStats.week.toString()) || 0;
    this.weeklyPoints.set(gameStats.week.toString(), currentWeekPoints + gamePoints);
  }
};

playerSchema.methods.calculateFantasyPoints = function(gameStats) {
  if (!gameStats) return 0;
  
  // Fantasy point values
  const pointValues = {
    kill: 3,
    death: -1,
    assist: 1.5,
    cs: 0.02,
    baronKill: 2,
    dragonKill: 1,
    turretKill: 2
  };
  
  // Calculate points
  let points = 0;
  points += (gameStats.kills || 0) * pointValues.kill;
  points += (gameStats.deaths || 0) * pointValues.death;
  points += (gameStats.assists || 0) * pointValues.assist;
  points += (gameStats.cs || 0) * pointValues.cs;
  points += (gameStats.baronKills || 0) * pointValues.baronKill;
  points += (gameStats.dragonKills || 0) * pointValues.dragonKill;
  points += (gameStats.turretKills || 0) * pointValues.turretKill;
  
  return points;
};

playerSchema.methods.getAverageFantasyPoints = function() {
  if (!this.stats.gamesPlayed || this.stats.gamesPlayed === 0) {
    return 0;
  }
  return this.fantasyPoints / this.stats.gamesPlayed;
};

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
