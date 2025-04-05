// backend/draftRoom.js
const WebSocket = require('ws');
const fs = require('fs-extra');
const path = require('path');

class DraftRoom {
  constructor(server) {
    // If server is provided, set up WebSocket handling for /ws path
    if (server) {
      this.wss = new WebSocket.Server({ server, path: '/ws' });
    } else {
      // Create a standalone WebSocket server for use with draftServer.js
      this.wss = null; // Will be set by setupWebSocketServer method
    }
    this.clients = new Map(); // Maps client WebSocket to user data
    this.draftState = {
      participants: [],
      draftStarted: false,
      draftComplete: false,
      draftOrder: [],
      currentPickIndex: 0,
      draftHistory: [],
      teams: {},
      draftMode: 'timed', // Default draft mode with time constraints
      chatMessages: [] // Store chat messages
    };
    
    // Path to store draft state
    this.dataDir = path.join(__dirname, 'data');
    this.draftStatePath = path.join(this.dataDir, 'draftState.json');
    
    // Ensure data directory exists
    fs.ensureDirSync(this.dataDir);
    
    // Reset draft state on server restart (don't load previous state)
    this.resetDraftStateFile();
    
    // Set up WebSocket connection handling
    this.setupWebSocketServer();
    
    console.log('Draft room WebSocket server initialized with server');
  }
  
  loadDraftState() {
    try {
      if (fs.existsSync(this.draftStatePath)) {
        const data = fs.readFileSync(this.draftStatePath, 'utf8');
        this.draftState = JSON.parse(data);
        console.log('Loaded existing draft state');
      }
    } catch (error) {
      console.error('Error loading draft state:', error);
      // Continue with empty draft state
    }
  }
  
  resetDraftStateFile() {
    try {
      // Write the empty draft state to the file
      fs.writeFileSync(this.draftStatePath, JSON.stringify(this.draftState, null, 2));
      console.log('Reset draft state file');
    } catch (error) {
      console.error('Error resetting draft state file:', error);
    }
  }
  
  saveDraftState() {
    try {
      fs.writeFileSync(this.draftStatePath, JSON.stringify(this.draftState, null, 2));
    } catch (error) {
      console.error('Error saving draft state:', error);
    }
  }
  
  setupWebSocketServer(port) {
    // If this is being used with a standalone port (draftServer.js), create a new WebSocket server
    if (port) {
      this.wss = new WebSocket.Server({ port });
      console.log(`Draft WebSocket server running on port ${port}`);
    }
    
    // Skip setup if wss is not initialized yet
    if (!this.wss) return;
    
    this.wss.on('connection', (ws) => {
      console.log('New client connected to draft room');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
      
      ws.on('close', () => {
        // Handle client disconnection
        if (this.clients.has(ws)) {
          const userData = this.clients.get(ws);
          console.log(`Client disconnected: ${userData.username}`);
          
          // Note: We don't remove participants when they disconnect
          // This allows them to reconnect and continue drafting
          
          this.clients.delete(ws);
          
          // Broadcast updated client list
          this.broadcastParticipantStatus();
        }
      });
      
      // Send current draft state to new client
      ws.send(JSON.stringify({
        type: 'draftState',
        data: this.draftState
      }));
    });
  }
  
  handleMessage(ws, message) {
    const { type, data } = message;
    
    switch (type) {
      case 'join':
        this.handleJoin(ws, data);
        break;
      case 'startDraft':
        this.handleStartDraft(data);
        break;
      case 'draftPlayer':
        this.handleDraftPlayer(data);
        break;
      case 'setDraftMode':
        this.handleSetDraftMode(data);
        break;
      case 'endDraft':
        this.handleEndDraft(data);
        break;
      case 'chat':
        this.handleChat(data);
        break;
      default:
        console.log(`Unknown message type: ${type}`);
    }
  }
  
  handleSetDraftMode(data) {
    const { username, mode } = data;
    
    // Only user 'shark' can change draft mode
    if (username !== 'shark') {
      return;
    }
    
    // Ensure mode is valid
    if (mode !== 'timed' && mode !== 'untimed') {
      return;
    }
    
    // Update draft mode
    this.draftState.draftMode = mode;
    
    // Save and broadcast updated state
    this.saveDraftState();
    this.broadcastDraftState();
    
    console.log(`Draft mode set to ${mode} by ${username}`);
  }
  
  handleJoin(ws, data) {
    const { username } = data;
    
    // Store client information
    this.clients.set(ws, { username });
    
    // Add to participants if not already there
    if (!this.draftState.participants.includes(username)) {
      this.draftState.participants.push(username);
      
      // Initialize empty team for new participant
      this.draftState.teams[username] = {
        name: username,
        players: {
          TOP: null,
          JUNGLE: null,
          MID: null,
          ADC: null,
          SUPPORT: null,
          FLEX: null,
          BENCH: []
        }
      };
      
      // Save updated state
      this.saveDraftState();
    }
    
    // Broadcast updated participant list
    this.broadcastParticipantStatus();
    
    console.log(`User joined: ${username}`);
  }
  
  handleStartDraft(data) {
    const { username, mode } = data;
    
    // Only user 'shark' can start the draft
    if (username !== 'shark') {
      return;
    }
    
    // Need at least 2 participants
    if (this.draftState.participants.length < 2) {
      return;
    }
    
    // Set draft mode if provided
    if (mode === 'timed' || mode === 'untimed') {
      this.draftState.draftMode = mode;
    }
    
    // Set draft order (randomized)
    const shuffledParticipants = [...this.draftState.participants].sort(() => Math.random() - 0.5);
    
    this.draftState.draftOrder = shuffledParticipants;
    this.draftState.draftStarted = true;
    this.draftState.currentPickIndex = 0;
    this.draftState.draftHistory = [];
    
    // Save and broadcast updated state
    this.saveDraftState();
    this.broadcastDraftState();
    
    console.log(`Draft started by ${username} in ${this.draftState.draftMode} mode`);
  }
  
  handleDraftPlayer(data) {
    const { username, player } = data;
    
    // Validate draft is in progress
    if (!this.draftState.draftStarted || this.draftState.draftComplete) {
      return;
    }
    
    // In untimed mode, any participant can draft when it's their turn
    // In timed mode, validate it's the user's turn
    let allowDraft = false;
    const currentDrafter = this.draftState.draftOrder[this.draftState.currentPickIndex];
    
    if (this.draftState.draftMode === 'untimed') {
      // In untimed mode, allow any participant to draft when it's their turn
      if (username === currentDrafter) {
        allowDraft = true;
      }
    } else {
      // In timed mode, strict enforcement of current drafter
      if (username === currentDrafter) {
        allowDraft = true;
      }
    }
    
    if (!allowDraft) {
      return;
    }
    
    // Determine best position for player
    const team = this.draftState.teams[currentDrafter];
    let positionToFill = '';
    
    // Try to place in primary position first
    if (!team.players[player.position]) {
      positionToFill = player.position;
    } 
    // Try FLEX position
    else if (!team.players.FLEX) {
      positionToFill = 'FLEX';
    }
    // Try bench
    else if (team.players.BENCH.length < 3) {
      positionToFill = 'BENCH';
    } else {
      // No valid position
      return;
    }
    
    // Update team
    if (positionToFill === 'BENCH') {
      team.players.BENCH.push(player);
    } else {
      team.players[positionToFill] = player;
    }
    
    // Add to draft history
    const draftPick = {
      round: Math.floor(this.draftState.draftHistory.length / this.draftState.draftOrder.length) + 1,
      pick: this.draftState.draftHistory.length + 1,
      user: currentDrafter,
      player: player,
      position: positionToFill
    };
    
    this.draftState.draftHistory.push(draftPick);
    
    // Calculate next drafter index for snake draft
    const nextIndex = this.calculateNextPickIndex();
    this.draftState.currentPickIndex = nextIndex;
    
    // Check if draft is complete (each user gets 6 picks)
    const totalPicks = this.draftState.draftOrder.length * 6;
    if (this.draftState.draftHistory.length >= totalPicks) {
      this.draftState.draftComplete = true;
    }
    
    // Save and broadcast updated state
    this.saveDraftState();
    this.broadcastDraftState();
    
    console.log(`Player drafted: ${player.name} by ${username}`);
  }
  
  calculateNextPickIndex() {
    const totalParticipants = this.draftState.draftOrder.length;
    const historyLength = this.draftState.draftHistory.length;
    const currentIndex = this.draftState.currentPickIndex;
    
    const roundNumber = Math.floor(historyLength / totalParticipants);
    const isEvenRound = roundNumber % 2 === 1; // 0-indexed round numbers, so odd number = even round
    
    if (isEvenRound) {
      // Even rounds go backward
      if (currentIndex > 0) {
        return currentIndex - 1;
      } else {
        // Reached the beginning, start next round
        return 0;
      }
    } else {
      // Odd rounds go forward
      if (currentIndex < totalParticipants - 1) {
        return currentIndex + 1;
      } else {
        // Reached the end, start going backward
        return totalParticipants - 1;
      }
    }
  }
  
  broadcastParticipantStatus() {
    const message = JSON.stringify({
      type: 'participantUpdate',
      data: {
        participants: this.draftState.participants
      }
    });
    
    this.broadcast(message);
  }
  
  broadcastDraftState() {
    const message = JSON.stringify({
      type: 'draftState',
      data: this.draftState
    });
    
    this.broadcast(message);
  }
  
  broadcast(message) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Get the current draft state
  getDraftState() {
    return this.draftState;
  }
  
  handleEndDraft(data) {
    const { username } = data;
    
    // Only user 'shark' can end the draft
    if (username !== 'shark') {
      return;
    }
    
    // Mark the draft as complete
    this.draftState.draftComplete = true;
    
    // Save and broadcast updated state
    this.saveDraftState();
    this.broadcastDraftState();
    
    // Save each user's team to a text file
    this.saveTeamsToFiles();
    
    console.log(`Draft ended by ${username}`);
  }
  
  saveTeamsToFiles() {
    try {
      // Ensure a directory exists for team exports
      const teamsDir = path.join(this.dataDir, 'teamExports');
      fs.ensureDirSync(teamsDir);
      
      // Get the current date and time for the filename
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      
      // For each participant, create a file with their team info
      Object.keys(this.draftState.teams).forEach(username => {
        const team = this.draftState.teams[username];
        const filePath = path.join(teamsDir, `${username}_team_${timestamp}.txt`);
        
        // Format the team data
        let content = `Fantasy Team for ${username}\n`;
        content += `Draft Date: ${new Date().toLocaleString()}\n\n`;
        
        // Add position players
        ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].forEach(position => {
          const player = team.players[position];
          content += `${position}: ${player ? `${player.name} (${player.team})` : 'Empty'}\n`;
        });
        
        // Add bench players
        content += `\nBENCH:\n`;
        if (team.players.BENCH && team.players.BENCH.length > 0) {
          team.players.BENCH.forEach((player, index) => {
            content += `${index + 1}. ${player.name} (${player.team}) - ${player.position}\n`;
          });
        } else {
          content += 'No bench players\n';
        }
        
        // Write the file
        fs.writeFileSync(filePath, content);
        console.log(`Saved team file for ${username} at ${filePath}`);
      });
    } catch (error) {
      console.error('Error saving team files:', error);
    }
  }
  
  handleChat(data) {
    const { username, message } = data;
    
    // Make sure the message isn't empty
    if (!message || !message.trim()) return;
    
    // Create a chat message object
    const chatMessage = {
      username,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Add to chat messages
    this.draftState.chatMessages.push(chatMessage);
    
    // Only keep the most recent 100 messages
    if (this.draftState.chatMessages.length > 100) {
      this.draftState.chatMessages = this.draftState.chatMessages.slice(-100);
    }
    
    // Save draft state with new chat messages
    this.saveDraftState();
    
    // Broadcast the chat message to all clients
    this.broadcastChatMessage(chatMessage);
    
    console.log(`Chat message from ${username}: ${message}`);
  }
  
  broadcastChatMessage(chatMessage) {
    const message = JSON.stringify({
      type: 'chatMessage',
      data: chatMessage
    });
    
    this.broadcast(message);
  }
}

module.exports = DraftRoom;
