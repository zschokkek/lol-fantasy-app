// frontend/src/context/DraftRoomContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const DraftRoomContext = createContext();

export const useDraftRoom = () => useContext(DraftRoomContext);

export const DraftRoomProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [draftState, setDraftState] = useState({
    participants: [],
    draftStarted: false,
    draftComplete: false,
    draftOrder: [],
    currentPickIndex: 0,
    draftHistory: [],
    teams: {}
  });
  
  // Connect to WebSocket server when user is authenticated
  useEffect(() => {
    if (!user) return;
    
    // Create WebSocket connection to the main server
    const ws = new WebSocket(`ws://${window.location.hostname}:5000`);
    
    ws.onopen = () => {
      console.log('Connected to draft room');
      setIsConnected(true);
      setSocket(ws);
      
      // Join the draft room
      ws.send(JSON.stringify({
        type: 'join',
        data: { username: user.username }
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('Disconnected from draft room');
      setIsConnected(false);
      setSocket(null);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // Clean up on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [user]);
  
  const handleMessage = (message) => {
    const { type, data } = message;
    
    switch (type) {
      case 'draftState':
        setDraftState(data);
        break;
      case 'participantUpdate':
        setDraftState(prev => ({
          ...prev,
          participants: data.participants
        }));
        break;
      default:
        console.log(`Unknown message type: ${type}`);
    }
  };
  
  // Join the draft
  const joinDraft = useCallback(() => {
    if (!socket || !user) return;
    
    socket.send(JSON.stringify({
      type: 'join',
      data: { username: user.username }
    }));
  }, [socket, user]);
  
  // Start the draft
  const startDraft = useCallback(() => {
    if (!socket || !user) return;
    
    socket.send(JSON.stringify({
      type: 'startDraft',
      data: { username: user.username }
    }));
  }, [socket, user]);
  
  // Draft a player
  const draftPlayer = useCallback((player) => {
    if (!socket || !user) return;
    
    socket.send(JSON.stringify({
      type: 'draftPlayer',
      data: {
        username: user.username,
        player
      }
    }));
  }, [socket, user]);
  
  // Check if current user has already joined
  const hasUserJoined = useCallback(() => {
    return draftState.participants.includes(user?.username);
  }, [draftState.participants, user]);
  
  // Check if it's current user's turn
  const isUserTurn = useCallback(() => {
    if (!user || !draftState.draftStarted || draftState.draftComplete) return false;
    
    const currentDrafter = draftState.draftOrder[draftState.currentPickIndex];
    return user.username === currentDrafter;
  }, [user, draftState]);
  
  return (
    <DraftRoomContext.Provider
      value={{
        isConnected,
        draftState,
        joinDraft,
        startDraft,
        draftPlayer,
        hasUserJoined,
        isUserTurn
      }}
    >
      {children}
    </DraftRoomContext.Provider>
  );
};

export default DraftRoomContext;
