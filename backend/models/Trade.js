const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  proposingTeamId: {
    type: String,
    required: true
  },
  receivingTeamId: {
    type: String,
    required: true
  },
  proposedPlayers: [{
    id: String,
    position: String,
    name: String
  }],
  requestedPlayers: [{
    id: String,
    position: String,
    name: String
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  leagueId: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Trade', TradeSchema);
