/**
 * This script updates all existing leagues to include the correct players in their data structure
 * based on the league's regions.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const League = require('../models/League');
const Player = require('../models/Player');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

async function updateLeaguesWithPlayers() {
  try {
    // Get all leagues
    const leagues = await League.find({});
    console.log(`Found ${leagues.length} leagues to update`);

    // Get all players
    const players = await Player.find({});
    console.log(`Found ${players.length} players total`);

    // Process each league
    for (const league of leagues) {
      // If league has no regions defined, set default regions
      if (!league.regions || league.regions.length === 0) {
        league.regions = ['LCS', 'LEC'];
        console.log(`League ${league.name} (${league.id}) had no regions, setting defaults: ${league.regions.join(', ')}`);
      }

      // Find players that match this league's regions
      const matchingPlayers = players.filter(player => {
        return league.regions.some(region => 
          player.region?.toUpperCase() === region?.toUpperCase() || 
          player.homeLeague?.toUpperCase() === region?.toUpperCase()
        );
      });

      // Update the league's players
      league.players = matchingPlayers.map(player => player.id);
      
      // Save the updated league
      await league.save();
      console.log(`Updated league ${league.name} (${league.id}) with ${league.players.length} players from regions: ${league.regions.join(', ')}`);
    }

    console.log('All leagues have been updated successfully!');
  } catch (error) {
    console.error('Error updating leagues:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

// Run the update function
updateLeaguesWithPlayers()
  .then(() => {
    console.log('League update script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in league update script:', err);
    process.exit(1);
  });
