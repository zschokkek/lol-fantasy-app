// services/UserService.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const fs = require('fs').promises;
const path = require('path');

class UserService {
  constructor() {
    this.users = [];
    this.usersFile = path.join(__dirname, '../data/users.json');
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8');
      const userData = JSON.parse(data);
      
      this.users = userData.map(user => {
        return new User(
          user.id,
          user.username,
          user.email,
          user.passwordHash
        );
      });
      
      // Restore additional properties
      this.users.forEach((user, index) => {
        user.teams = userData[index].teams || [];
        user.leagues = userData[index].leagues || [];
        user.isAdmin = userData[index].isAdmin || false;
      });
      
      console.log(`Loaded ${this.users.length} users from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading users:', error);
      } else {
        console.log('No users file found, starting with empty user list');
      }
      this.users = [];
    }
  }

  async saveUsers() {
    try {
      const usersDir = path.dirname(this.usersFile);
      await fs.mkdir(usersDir, { recursive: true });
      
      await fs.writeFile(this.usersFile, JSON.stringify(this.users, null, 2), 'utf8');
      console.log('Users saved to disk');
      return true;
    } catch (error) {
      console.error('Error saving users:', error);
      return false;
    }
  }

  async registerUser(username, email, password) {
    // Check if username or email already exists
    const existingUser = this.users.find(
      user => user.username === username || user.email === email
    );
    
    if (existingUser) {
      throw new Error('Username or email already exists');
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    console.log("Registration - Generated hash:", passwordHash);
    
    // Create new user
    const newUser = new User(
      uuidv4(),
      username,
      email,
      passwordHash
    );
    
    // The first user is automatically an admin
    if (this.users.length === 0) {
      newUser.isAdmin = true;
    }
    
    this.users.push(newUser);
    await this.saveUsers();
    
    return newUser;
  }
  async loginUser(username, password) {
    const user = this.users.find(user => user.username === username);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    console.log("Login - User found:", user.username);
    console.log("Login - Stored hash:", user.passwordHash);
    
    const isMatch = await user.validatePassword(password);
    console.log("Login - Password match:", isMatch);
    
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }
    
    return user;
  }
  
  getUserById(id) {
    return this.users.find(user => user.id === id);
  }

  getUserByUsername(username) {
    return this.users.find(user => user.username === username);
  }

  updateUserTeams(userId, teamId, action) {
    const user = this.getUserById(userId);
    
    if (!user) {
      return false;
    }
    
    if (action === 'add') {
      if (!user.teams.includes(teamId)) {
        user.teams.push(teamId);
      }
    } else if (action === 'remove') {
      user.teams = user.teams.filter(id => id !== teamId);
    }
    
    this.saveUsers();
    return true;
  }
  
  /**
   * Update a user's leagues (add/remove leagues)
   * @param {String} userId - User ID
   * @param {String} leagueId - League ID
   * @param {String} action - 'add' or 'remove'
   * @returns {Boolean} - Success status
   */
  updateUserLeagues(userId, leagueId, action) {
    const user = this.getUserById(userId);
    
    if (!user) {
      return false;
    }
    
    if (action === 'add') {
      if (!user.leagues.includes(leagueId)) {
        user.leagues.push(leagueId);
      }
    } else if (action === 'remove') {
      user.leagues = user.leagues.filter(id => id !== leagueId);
    }
    
    this.saveUsers();
    return true;
  }
}

module.exports = UserService;