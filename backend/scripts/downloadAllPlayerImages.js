// backend/scripts/downloadAllPlayerImages.js
require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const { downloadImage } = require('../helpers/imageUtils');
const { connectDB } = require('../config/db');

async function downloadAllPlayerImages() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // Find all players with image URLs but without local paths
    const players = await Player.find({
      imageUrl: { $ne: null, $exists: true },
      $or: [
        { localImagePath: null },
        { localImagePath: { $exists: false } }
      ]
    });
    
    console.log(`Found ${players.length} players with remote images that need to be downloaded`);
    
    // Download images for each player
    let successCount = 0;
    let failCount = 0;
    
    for (const player of players) {
      console.log(`Processing ${player.name} (${player.id})`);
      
      try {
        if (!player.imageUrl) {
          console.log(`Skipping ${player.name} - no image URL`);
          continue;
        }
        
        console.log(`Downloading image for ${player.name} from ${player.imageUrl}`);
        const localPath = await downloadImage(player.imageUrl, player.id);
        
        if (localPath) {
          player.localImagePath = localPath;
          await player.save();
          console.log(`✓ Successfully saved local image for ${player.name}: ${localPath}`);
          successCount++;
        } else {
          console.log(`✗ Failed to download image for ${player.name}`);
          failCount++;
        }
      } catch (error) {
        console.error(`Error processing player ${player.name}:`, error);
        failCount++;
      }
    }
    
    console.log('\n--- Download Summary ---');
    console.log(`Total Players: ${players.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('------------------------\n');
    
    console.log('Finished downloading all player images');
  } catch (error) {
    console.error('Error in downloadAllPlayerImages script:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Execute the function
downloadAllPlayerImages();
