// backend/routes/draftRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const DraftRoom = require('../draftRoom');

let draftRoom = null;

// Initialize draft room if it doesn't exist
const initializeDraftRoom = (server) => {
  if (!draftRoom) {
    console.log('Initializing draft room WebSocket server');
    draftRoom = new DraftRoom(server);
  }
  return draftRoom;
};

// Route to initialize draft room when EGBDraft page is accessed
router.get('/init', auth, (req, res) => {
  try {
    // The actual initialization happens in server.js when this endpoint is hit
    res.json({ success: true, message: 'Draft room initialization requested' });
  } catch (error) {
    console.error('Error initializing draft room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current draft state
router.get('/state', auth, (req, res) => {
  try {
    if (!draftRoom) {
      return res.status(404).json({ success: false, error: 'Draft room not initialized' });
    }
    
    res.json({ success: true, draftState: draftRoom.getDraftState() });
  } catch (error) {
    console.error('Error getting draft state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, initializeDraftRoom };
