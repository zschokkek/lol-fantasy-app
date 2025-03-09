// backend/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    ref: 'User',
    required: true
  },
  conversation: {
    type: String,
    ref: 'Conversation',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  readBy: [{
    type: String,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for faster lookup by conversation
messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
