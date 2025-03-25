// backend/helpers/imageUtils.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// Create public/images/players directory
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const PLAYERS_DIR = path.join(IMAGES_DIR, 'players');

// Create directories if they don't exist
function ensureDirectoriesExist() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR);
  }
  
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
  }
  
  if (!fs.existsSync(PLAYERS_DIR)) {
    fs.mkdirSync(PLAYERS_DIR);
  }
}

ensureDirectoriesExist();

/**
 * Download an image from a URL and save it locally
 * @param {string} imageUrl - The URL of the image to download
 * @param {string} playerId - The player ID to use in the filename
 * @returns {Promise<string|null>} - A promise that resolves to the local path of the saved image or null on error
 */
async function downloadImage(imageUrl, playerId) {
  if (!imageUrl) return null;
  
  try {
    // Create a unique filename based on the URL to avoid duplicates
    const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 8);
    const filename = `${playerId}_${urlHash}.jpg`;
    const localPath = path.join(PLAYERS_DIR, filename);
    const publicPath = `/images/players/${filename}`;
    
    // Skip download if file already exists
    if (fs.existsSync(localPath)) {
      console.log(`Image already exists for player ${playerId}: ${localPath}`);
      return publicPath;
    }
    
    // Download the image
    console.log(`Downloading image for player ${playerId} from ${imageUrl}`);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });
    
    // Pipe the image data to a file
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Successfully saved image for player ${playerId}: ${localPath}`);
        resolve(publicPath);
      });
      writer.on('error', (error) => {
        console.error(`Error saving image for player ${playerId}:`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error downloading image for player ${playerId}:`, error);
    return null;
  }
}

/**
 * Check if an image exists locally
 * @param {string} localPath - The local path of the image
 * @returns {boolean} - Whether the image exists locally
 */
function imageExistsLocally(localPath) {
  if (!localPath) return false;
  const fullPath = path.join(__dirname, '..', localPath.replace(/^\//, ''));
  return fs.existsSync(fullPath);
}

module.exports = {
  downloadImage,
  imageExistsLocally,
  PLAYERS_DIR
};
