// backend/models/TrashTalk.js
const mongoose = require('mongoose');

const trashTalkSchema = new mongoose.Schema({
  author: {
    type: String,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  league: {
    type: String,
    ref: 'League',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  teamId: {
    type: String,
    ref: 'FantasyTeam'
  },
  teamName: String,
  likes: [{
    type: String,
    ref: 'User'
  }],
  parent: {
    type: String,
    ref: 'TrashTalk',
    default: null
  },
  isReply: {
    type: Boolean,
    default: false
  },
  mentions: [{
    type: String,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for faster lookup by league
trashTalkSchema.index({ league: 1, createdAt: -1 });

const TrashTalk = mongoose.model('TrashTalk', trashTalkSchema);

module.exports = TrashTalk;
