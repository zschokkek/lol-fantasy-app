// scripts/checkPlayerImages.js
require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');

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

// Check player images in the database
const checkPlayerImages = async () => {
  try {
    // Get players with images
    const playersWithImages = await Player.find({ imageUrl: { $exists: true, $ne: null, $ne: '' } })
      .sort({ name: 1 })
      .limit(20);

    // Get players without images
    const playersWithoutImages = await Player.find({ 
      $or: [
        { imageUrl: { $exists: false } },
        { imageUrl: null },
        { imageUrl: '' }
      ]
    })
      .sort({ name: 1 })
      .limit(20);

    // Get total counts
    const totalPlayers = await Player.countDocuments();
    const totalWithImages = await Player.countDocuments({ imageUrl: { $exists: true, $ne: null, $ne: '' } });
    const totalWithoutImages = totalPlayers - totalWithImages;
    
    // Show summary
    console.log('\n=== PLAYER IMAGE SUMMARY ===');
    console.log(`Total players in database: ${totalPlayers}`);
    console.log(`Players with images: ${totalWithImages} (${Math.round(totalWithImages/totalPlayers*100)}%)`);
    console.log(`Players without images: ${totalWithoutImages} (${Math.round(totalWithoutImages/totalPlayers*100)}%)`);
    
    // Show sample of players with images
    console.log('\n=== SAMPLE PLAYERS WITH IMAGES ===');
    playersWithImages.forEach(player => {
      console.log(`${player.name} (${player.team || 'Unknown team'}) - ${player.imageUrl}`);
    });
    
    // Show sample of players without images
    console.log('\n=== SAMPLE PLAYERS WITHOUT IMAGES ===');
    playersWithoutImages.forEach(player => {
      console.log(`${player.name} (${player.team || 'Unknown team'})`);
    });
  } catch (error) {
    console.error('Error checking player images:', error.message);
  }
};

// Main function
const main = async () => {
  try {
    const db = await connectDB();
    await checkPlayerImages();
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// Run the script
main();
