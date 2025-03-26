const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const mkdirp = require('mkdirp');

// Convert fs functions to promise-based
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists);

// Directory for storing player images
const IMAGES_DIR = path.join(__dirname, '../public/images/players');

// Ensure the images directory exists
const ensureImagesDir = async () => {
  try {
    await mkdirp(IMAGES_DIR);
    console.log(`Ensured images directory exists: ${IMAGES_DIR}`);
    return true;
  } catch (error) {
    console.error('Error creating images directory:', error);
    return false;
  }
};

// Initialize the storage system
const init = async () => {
  return await ensureImagesDir();
};

// Check if an image is already stored locally
const isImageStored = async (playerId) => {
  const imagePath = path.join(IMAGES_DIR, `${playerId}.jpg`);
  return await exists(imagePath);
};

// Get the local path for a player image
const getLocalImagePath = (playerId) => {
  return `/public/images/players/${playerId}.jpg`;
};

// Download and store an image locally
const storeImage = async (playerId, imageUrl) => {
  try {
    // Ensure the directory exists
    await ensureImagesDir();
    
    // Check if image already exists
    if (await isImageStored(playerId)) {
      return getLocalImagePath(playerId);
    }
    
    // Download the image
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer'
    });
    
    // Save the image to disk
    const imagePath = path.join(IMAGES_DIR, `${playerId}.jpg`);
    await writeFile(imagePath, response.data);
    
    console.log(`Stored image for player ${playerId} at ${imagePath}`);
    return getLocalImagePath(playerId);
  } catch (error) {
    console.error(`Error storing image for player ${playerId}:`, error);
    return null;
  }
};

// Preload images for all players
const preloadPlayerImages = async (players) => {
  try {
    console.log(`Starting to store images for ${players.length} players`);
    
    // Ensure the directory exists
    await ensureImagesDir();
    
    let stored = 0;
    let failed = 0;
    
    // Process players in batches to avoid overwhelming the system
    const batchSize = 5;
    
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      // Process each player in the batch
      await Promise.all(batch.map(async (player) => {
        if (player.imageUrl) {
          try {
            // Skip if already stored
            if (await isImageStored(player.id)) {
              stored++;
              return;
            }
            
            // Store the image
            const localPath = await storeImage(player.id, player.imageUrl);
            if (localPath) {
              stored++;
            } else {
              failed++;
            }
          } catch (error) {
            console.error(`Error storing image for player ${player.id}:`, error);
            failed++;
          }
        }
      }));
      
      // Log progress
      console.log(`Stored ${stored}/${players.length} images (${failed} failed)`);
    }
    
    return { stored, failed };
  } catch (error) {
    console.error('Error preloading player images:', error);
    throw error;
  }
};

module.exports = {
  init,
  storeImage,
  isImageStored,
  getLocalImagePath,
  preloadPlayerImages
};
