# Fantasy LoL App Test Scripts

This directory contains test scripts for the Fantasy LoL application.

## Available Scripts

### `test-league-schedule.js`

This script automatically:
1. Creates a new fantasy league with 12 teams
2. Adds teams to the league using predefined team names
3. Generates an 11-week schedule for the league
4. Displays all matchups for each week

#### Prerequisites

- Node.js installed
- Fantasy LoL backend server running on http://localhost:5000
- Backend configured to allow unauthenticated requests for local testing

#### Setup

Install the required dependencies:

```bash
cd scripts
npm install
```

#### Usage

Run the script with:

```bash
node test-league-schedule.js
```

The script will automatically:
- Create a new league called "Test League"
- Create 12 teams with predefined names (TSM, Cloud9, etc.)
- Generate an 11-week schedule
- Display all matchups for each week

No user input is required - just run the script and watch the output.

#### Example Output

```
Creating new league "Test League"...
League created successfully! ID: abc123
Creating team "Team Solo Mid" in league abc123...
Team created successfully! ID: team1
Creating team "Cloud9" in league abc123...
Team created successfully! ID: team2
[...more teams...]

Created 12 teams in the league.
Generating 11 week schedule for league abc123...
Schedule generated successfully!

===== WEEK 1 MATCHUPS =====

Matchup #1:
Team Solo Mid vs. Cloud9

Matchup #2:
Team Liquid vs. 100 Thieves

[...additional matchups and weeks...]

Test completed successfully!

League ID: abc123
You can now view this league in the app.
```

#### Customization

If you want to change the default settings, you can modify these constants at the top of the script:
- `NUM_TEAMS`: Number of teams to create (default: 12)
- `NUM_WEEKS`: Number of weeks in the schedule (default: 11)
- `LEAGUE_NAME`: Name of the test league (default: "Test League")
- `TEAM_NAMES`: Array of team names to use

## Troubleshooting

- Make sure the backend server is running before executing the script
- If team creation fails, check the server logs for more details
- The script adds a small delay between team creations to avoid race conditions
- This script is designed for local testing only and assumes the backend allows unauthenticated requests
