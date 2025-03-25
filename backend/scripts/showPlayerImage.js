// scripts/showPlayerImage.js
require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const { exec } = require('child_process');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fantasy-lol');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Open a URL in the default browser
const openInBrowser = (url) => {
  // For Mac OS
  const command = `open "${url}"`;
  
  exec(command, (error) => {
    if (error) {
      console.error(`Error opening URL: ${error.message}`);
      return;
    }
    console.log(`Opened ${url} in your browser`);
  });
};

// Show a player image
const showPlayerImage = async () => {
  try {
    // Find a player with an image URL
    const player = await Player.findOne({ 
      imageUrl: { $exists: true, $ne: null, $ne: '' } 
    });
    
    if (!player) {
      console.log('No players with images found in the database');
      return;
    }
    
    console.log(`Found player: ${player.name} (${player.team || 'Unknown team'})`);
    console.log(`Image URL: ${player.imageUrl}`);
    
    // Open the image in the default browser
    openInBrowser(player.imageUrl);
    
    // Display more player details
    console.log('\nPlayer Details:');
    console.log(`ID: ${player._id}`);
    console.log(`Name: ${player.name}`);
    console.log(`Team: ${player.team || 'Unknown'}`);
    console.log(`Role: ${player.role || 'Unknown'}`);
    console.log(`Region: ${player.region || 'Unknown'}`);
    
  } catch (error) {
    console.error('Error showing player image:', error.message);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await showPlayerImage();
    
    // Keep the process alive for a moment to allow the browser to open
    setTimeout(async () => {
      // Disconnect from MongoDB
      await mongoose.disconnect();
      console.log('Database connection closed');
      process.exit(0);
    }, 3000);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Run the script
main();
