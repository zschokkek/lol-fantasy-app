// scripts/deleteLeagues.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');
const { League, FantasyTeam } = require('../models');
const chalk = require('chalk'); // For colored terminal output

// Load environment variables
dotenv.config();

// Color palette - gold theme
const colors = {
  primary: chalk.hex('#FFD700'), // Gold
  secondary: chalk.hex('#DAA520'), // GoldenRod
  error: chalk.hex('#FF6347'), // Tomato for errors
  success: chalk.hex('#32CD32'), // LimeGreen for success
  warning: chalk.yellowBright, // Warning messages
  info: chalk.white // Info messages
};

// Connect to MongoDB
const connectDB = async () => {
  // Check if MONGO_URI is defined
  if (!process.env.MONGO_URI) {
    console.error(colors.error('Error: MONGO_URI is not defined in your environment variables.'));
    console.log(colors.info('Please set MONGO_URI in your .env file or provide it as a parameter:'));
    console.log(colors.info('Example: MONGO_URI=mongodb://localhost:27017/yourdb node scripts/deleteLeagues.js'));
    process.exit(1);
  }
  
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(colors.success(`MongoDB Connected: ${conn.connection.host}`));
  } catch (error) {
    console.error(colors.error(`Error connecting to MongoDB: ${error.message}`));
    process.exit(1);
  }
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Delete a league by ID
 * @param {string} leagueId - The ID of the league to delete
 * @param {boolean} cleanup - Whether to clean up related data (teams, etc.)
 */
const deleteLeagueById = async (leagueId, cleanup = true) => {
  try {
    console.log(colors.info(`\nAttempting to delete league with ID: ${leagueId}`));
    
    // Find the league first to get related data
    const league = await League.findOne({ id: leagueId });
    
    if (!league) {
      console.log(colors.warning(`No league found with ID: ${leagueId}`));
      return false;
    }
    
    console.log(colors.info(`Found league: ${league.name}`));
    
    // If cleanup is enabled, handle related data
    if (cleanup && league.teams && league.teams.length > 0) {
      console.log(colors.info(`This league has ${league.teams.length} teams. Cleaning up...`));
      
      // Delete all related fantasy teams
      const deletedTeams = await FantasyTeam.deleteMany({ 
        id: { $in: league.teams }
      });
      
      console.log(colors.success(`Deleted ${deletedTeams.deletedCount} fantasy teams.`));
    }
    
    // Delete the league
    const result = await League.deleteOne({ id: leagueId });
    
    if (result.deletedCount === 1) {
      console.log(colors.success(`Successfully deleted league: ${league.name}`));
      return true;
    } else {
      console.log(colors.error(`Failed to delete league: ${league.name}`));
      return false;
    }
  } catch (error) {
    console.error(colors.error(`Error deleting league: ${error.message}`));
    return false;
  }
};

/**
 * Delete all leagues
 * @param {boolean} cleanup - Whether to clean up related data (teams, etc.)
 */
const deleteAllLeagues = async (cleanup = true) => {
  try {
    console.log(colors.info("\nAttempting to delete all leagues..."));
    
    // Find all leagues to get their IDs for cleanup
    const leagues = await League.find({});
    
    if (leagues.length === 0) {
      console.log(colors.warning("No leagues found in the database."));
      return false;
    }
    
    console.log(colors.info(`Found ${leagues.length} leagues.`));
    
    // If cleanup is enabled, delete related fantasy teams
    if (cleanup) {
      // Collect all team IDs from all leagues
      const teamIds = leagues.reduce((ids, league) => {
        return ids.concat(league.teams || []);
      }, []);
      
      if (teamIds.length > 0) {
        console.log(colors.info(`Found ${teamIds.length} teams across all leagues. Cleaning up...`));
        
        // Delete all related fantasy teams
        const deletedTeams = await FantasyTeam.deleteMany({ 
          id: { $in: teamIds }
        });
        
        console.log(colors.success(`Deleted ${deletedTeams.deletedCount} fantasy teams.`));
      }
    }
    
    // Delete all leagues
    const result = await League.deleteMany({});
    
    console.log(colors.success(`Successfully deleted ${result.deletedCount} leagues.`));
    return true;
  } catch (error) {
    console.error(colors.error(`Error deleting all leagues: ${error.message}`));
    return false;
  }
};

/**
 * List all leagues in the database
 */
const listAllLeagues = async () => {
  try {
    console.log(colors.primary("\n===== Listing All Leagues ====="));
    
    const leagues = await League.find({});
    
    if (leagues.length === 0) {
      console.log(colors.warning("No leagues found in the database."));
      return;
    }
    
    leagues.forEach((league, index) => {
      console.log(colors.info(`${index + 1}. ${colors.primary(league.name)} (ID: ${league.id}) - Teams: ${league.teams.length} - Regions: ${league.regions.join(', ')}`));
    });
    
    console.log(colors.primary(`\nTotal leagues: ${leagues.length}`));
  } catch (error) {
    console.error(colors.error(`Error listing leagues: ${error.message}`));
  }
};

/**
 * Main menu function to handle user input
 */
const showMainMenu = () => {
  console.log(colors.primary("\n======= League Deletion Tool ======="));
  console.log(colors.info("1. List All Leagues"));
  console.log(colors.info("2. Delete League by ID"));
  console.log(colors.info("3. Delete All Leagues"));
  console.log(colors.info("4. Exit"));
  console.log(colors.primary("==================================="));
  
  rl.question(colors.secondary("Please select an option (1-4): "), async (answer) => {
    switch (answer) {
      case "1":
        await listAllLeagues();
        showMainMenu();
        break;
      
      case "2":
        rl.question(colors.secondary("Enter the League ID to delete: "), async (leagueId) => {
          rl.question(colors.secondary("Clean up related data? (y/n, default: y): "), async (cleanupInput) => {
            const cleanup = cleanupInput.toLowerCase() !== 'n';
            await deleteLeagueById(leagueId, cleanup);
            showMainMenu();
          });
        });
        break;
      
      case "3":
        rl.question(colors.warning("Are you sure you want to delete ALL leagues? This cannot be undone. (y/n): "), async (confirmation) => {
          if (confirmation.toLowerCase() === 'y') {
            rl.question(colors.secondary("Clean up related data? (y/n, default: y): "), async (cleanupInput) => {
              const cleanup = cleanupInput.toLowerCase() !== 'n';
              await deleteAllLeagues(cleanup);
              showMainMenu();
            });
          } else {
            console.log(colors.info("Operation cancelled."));
            showMainMenu();
          }
        });
        break;
      
      case "4":
        console.log(colors.info("Exiting the application..."));
        rl.close();
        mongoose.connection.close();
        process.exit(0);
        break;
      
      default:
        console.log(colors.warning("Invalid option. Please try again."));
        showMainMenu();
        break;
    }
  });
};

// Main function to run the script
const main = async () => {
  await connectDB();
  showMainMenu();
};

// Run the main function
main().catch(err => {
  console.error(colors.error(`Error in main function: ${err.message}`));
  rl.close();
  mongoose.connection.close();
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log(colors.info("\nClosing connections and exiting..."));
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});
