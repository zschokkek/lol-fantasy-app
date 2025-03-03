// backend/models/User.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class User {
  constructor(id, username, email, passwordHash) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;
    this.teams = []; // IDs of teams owned by this user
    this.leagues = []; // IDs of leagues user belongs to
    this.isAdmin = false;
  }

  // Check if password matches
  async validatePassword(password) {
    return await bcrypt.compare(password, this.passwordHash);
  }

  // Generate JWT token
  generateToken() {
    const secret = process.env.JWT_SECRET;
    return jwt.sign(
      { id: this.id, username: this.username, isAdmin: this.isAdmin },
      secret,
      { expiresIn: '24h' }
    );
  }

  // Create a safe version of user data (no password)
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      teams: this.teams,
      leagues: this.leagues,
      isAdmin: this.isAdmin
    };
  }
}

module.exports = User;