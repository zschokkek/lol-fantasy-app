# League of Legends Fantasy App

A full-stack fantasy sports application for League of Legends esports, allowing users to create leagues, draft players, manage teams, and compete based on real professional player performance.

![League of Legends Fantasy](https://lol-fantasy-app.com/logo.png)

## Features

- **League Management**: Create, join, and manage fantasy leagues with customizable settings
- **Team Management**: Build and manage your fantasy roster with players from different regions
- **Live Scoring**: Real-time scoring based on professional LoL matches
- **Matchups**: Compete head-to-head against other managers in your league
- **Player Stats**: Comprehensive player statistics and performance tracking
- **Trading System**: Propose and accept trades with other team managers
- **Social Features**: Friend system and in-app messaging
- **Region Filtering**: Filter available players by region (LCS, LEC, LPL, LCK)

## Tech Stack

### Backend
- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- RESTful API
- Riot Games API Integration

### Frontend
- React.js
- Chakra UI with custom gold theme
- React Router
- Context API for state management
- Axios for API requests

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Riot Games API Key (for player data)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/lol-fantasy-app.git
cd lol-fantasy-app
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Create a `.env` file in the backend directory with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/lol-fantasy
JWT_SECRET=your_jwt_secret
RIOT_API_KEY=your_riot_api_key
CORS_ORIGIN=http://localhost:3000
ENABLE_AUTO_UPDATES=true
UPDATE_INTERVAL=1800000
```

### Running the Application

1. Start the backend server
```bash
cd backend
npm run dev
```

2. Start the frontend development server
```bash
cd frontend
npm start
```

3. Access the application at `http://localhost:3000`

## Project Structure

```
lol-fantasy-app/
├── backend/
│   ├── config/         # Database and app configuration
│   ├── data/           # Sample data and seed files
│   ├── fantasy-core/   # Core fantasy league logic
│   ├── helpers/        # Utility functions
│   ├── middleware/     # Express middleware
│   ├── models/         # Mongoose models
│   ├── public/         # Static files
│   ├── scripts/        # Utility scripts
│   ├── services/       # Business logic
│   ├── tests/          # Test files
│   └── server.js       # Entry point
├── frontend/
│   ├── public/         # Static assets
│   └── src/
│       ├── components/ # Reusable UI components
│       ├── context/    # React context providers
│       ├── layouts/    # Page layouts
│       └── pages/      # Application pages
└── scripts/            # Project-wide utility scripts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Riot Games API for providing player and match data
- The League of Legends esports community
