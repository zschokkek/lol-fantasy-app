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
    // Check if username or email already exists in MongoDB
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      throw new Error('Username or email already exists');
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    console.log("Registration - Generated hash:", passwordHash);
    
    // Create new user with Mongoose model
    const newUser = new User({
      id: uuidv4(),
      username,
      email,
      passwordHash,
      teams: [],
      leagues: [],
      isAdmin: await User.countDocuments() === 0 // First user is admin
    });
    
    // Save to MongoDB
    await newUser.save();
    
    // Also keep in memory for backward compatibility
    this.users.push(newUser);
    await this.saveUsers();
    
    return newUser;
  }
  async loginUser(username, password) {
    // Find user in MongoDB
    const user = await User.findOne({ username });
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    console.log("Login - User found:", user.username);
    console.log("Login - Stored hash:", user.passwordHash);
    
    const isMatch = await user.validatePassword(password);
    
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

  async updateUserLeagues(userId, leagueId, action) {
    try {
      // Find user in MongoDB
      const user = await User.findOne({ id: userId });
      
      if (!user) {
        console.error(`User ${userId} not found`);
        return false;
      }
      
      if (action === 'add') {
        // Add league if not already in the list
        if (!user.leagues.includes(leagueId)) {
          user.leagues.push(leagueId);
        }
      } else if (action === 'remove') {
        // Remove league if in the list
        user.leagues = user.leagues.filter(id => id !== leagueId);
      }
      
      // Save to MongoDB
      await user.save();
      
      // Also update in-memory user for backward compatibility
      const memoryUser = this.users.find(u => u.id === userId);
      if (memoryUser) {
        if (action === 'add') {
          if (!memoryUser.leagues.includes(leagueId)) {
            memoryUser.leagues.push(leagueId);
          }
        } else if (action === 'remove') {
          memoryUser.leagues = memoryUser.leagues.filter(id => id !== leagueId);
        }
        await this.saveUsers();
      }
      
      return true;
    } catch (error) {
      console.error('Error updating user leagues:', error);
      return false;
    }
  }
  
  async updateUserTeams(userId, teamId, action) {
    const user = await this.getUserById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (action === 'add') {
      // Add team if not already in the list
      if (!user.teams.includes(teamId)) {
        user.teams.push(teamId);
      }
    } else if (action === 'remove') {
      // Remove team if in the list
      user.teams = user.teams.filter(id => id !== teamId);
    }
    
    // Save to MongoDB
    await user.save();
    
    // Update in-memory cache
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.users[userIndex].teams = user.teams;
    }
    
    await this.saveUsers();
    return user;
  }
  
  async setUserAsAdmin(username) {
    // Find user in MongoDB
    const user = await User.findOne({ username });
    
    if (!user) {
      throw new Error(`User "${username}" not found`);
    }
    
    // Set as admin
    user.isAdmin = true;
    
    // Save to MongoDB
    await user.save();
    
    // Update in-memory cache
    const userIndex = this.users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      this.users[userIndex].isAdmin = true;
    }
    
    await this.saveUsers();
    return user;
  }
}

module.exports = UserService;