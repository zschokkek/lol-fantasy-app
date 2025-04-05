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
        return new User({
          id: user.id,
          username: user.username,
          email: user.email,
          passwordHash: user.passwordHash,
          teams: user.teams || [],
          leagues: user.leagues || [],
          isAdmin: user.isAdmin || false
        });
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
    
    console.log("USERSERVICE: Registration started for user:", username);
    
    // Create new user with Mongoose model
    // Note: We directly set passwordHash to the plain password
    // The User model's pre-save hook will handle the hashing
    const newUser = new User({
      id: uuidv4(),
      username,
      email,
      passwordHash: password, // This will be hashed by the pre-save hook
      teams: [],
      leagues: [],
      isAdmin: await User.countDocuments() === 0 // First user is admin
    });
    
    console.log("USERSERVICE: Created user object, saving to database");
    
    // Save to MongoDB
    await newUser.save();
    
    console.log("USERSERVICE: User saved to MongoDB successfully");
    
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
    try {
      // Find user in MongoDB instead of using in-memory array
      const user = await User.findOne({ id: userId });
      
      if (!user) {
        console.log(`DEBUG: User ${userId} not found in MongoDB`);
        // Create the user if not found
        console.log(`DEBUG: Creating user ${userId} in MongoDB`);
        const newUser = new User({
          id: userId,
          teams: action === 'add' ? [teamId] : []
        });
        await newUser.save();
        return true;
      }
      
      if (action === 'add') {
        // Add team if not already in the list
        if (!user.teams.includes(teamId)) {
          user.teams.push(teamId);
          console.log(`DEBUG: Added team ${teamId} to user ${userId}`);
        }
      } else if (action === 'remove') {
        // Remove team if in the list
        user.teams = user.teams.filter(id => id !== teamId);
        console.log(`DEBUG: Removed team ${teamId} from user ${userId}`);
      }
      
      await user.save();
      console.log(`DEBUG: Saved user ${userId} with teams [${user.teams}]`);
      return true;
    } catch (error) {
      console.error('Error updating user teams:', error);
      return false;
    }
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