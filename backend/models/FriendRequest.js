// backend/models/FriendRequest.js
const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  sender: {
    type: String,
    ref: 'User',
    required: true
  },
  recipient: {
    type: String,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for faster lookup of pending requests between users
friendRequestSchema.index({ sender: 1, recipient: 1, status: 1 });

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

module.exports = FriendRequest;
