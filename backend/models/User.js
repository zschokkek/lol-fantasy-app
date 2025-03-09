// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  teams: [{
    type: String,
    ref: 'FantasyTeam'
  }],
  leagues: [{
    type: String,
    ref: 'League'
  }],
  friends: [{
    type: String,
    ref: 'User'
  }],
  isAdmin: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline'
  }
}, {
  timestamps: true
});

// Check if password matches
userSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

// Generate JWT token
userSchema.methods.generateToken = function() {
  const secret = process.env.JWT_SECRET;
  return jwt.sign(
    { id: this.id, userId: this.id, username: this.username, isAdmin: this.isAdmin },
    secret,
    { expiresIn: '24h' }
  );
};

// Create a safe version of user data (no password)
userSchema.methods.toSafeJSON = function() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    teams: this.teams,
    leagues: this.leagues,
    friends: this.friends,
    isAdmin: this.isAdmin,
    avatar: this.avatar,
    status: this.status
  };
};

// For compatibility with the existing code
userSchema.methods.toJSON = function() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    teams: this.teams,
    leagues: this.leagues,
    friends: this.friends,
    isAdmin: this.isAdmin,
    avatar: this.avatar,
    status: this.status
  };
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;