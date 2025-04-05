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
    teams: {},
    chatMessages: []
  });
  
  // State to store chat messages for easier access
  const [chatMessages, setChatMessages] = useState([]);
  
  // Connect to WebSocket server when user is authenticated
  useEffect(() => {
    if (!user) return;
    
    // Create WebSocket connection to the main server
    // Determine WebSocket URL based on environment
    
    // Determine protocol based on current connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Use the /wss path for secure connections, /ws for non-secure
    // const wsPath = window.location.protocol === 'https:' ? '/wss' : '/ws';
    const wsUrl = `wss://egbfantasy.com:8443`;
    
    console.log(`Draft WebSocket connecting to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    
    // Add connection timeout and retry logic
    let connectionTimeout = setTimeout(() => {
      console.error(`WebSocket connection timeout to ${wsUrl}`);
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
      }
    }, 5000);
    
    ws.onopen = () => {
      console.log('Connected to draft room');
      clearTimeout(connectionTimeout);
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
    
    ws.onclose = (event) => {
      console.log('Disconnected from draft room', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setIsConnected(false);
      setSocket(null);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      console.error('WebSocket error details:', {
        url: ws.url,
        readyState: ws.readyState,
        bufferedAmount: ws.bufferedAmount,
        error: error.message || 'Unknown error'
      });
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
        // Update chat messages when draft state is loaded
        if (data.chatMessages && Array.isArray(data.chatMessages)) {
          setChatMessages(data.chatMessages);
        }
        break;
      case 'participantUpdate':
        setDraftState(prev => ({
          ...prev,
          participants: data.participants
        }));
        break;
      case 'chatMessage':
        // Add new chat message to the state
        setChatMessages(prev => [...prev, data]);
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
  
  // End the draft
  const endDraft = useCallback(() => {
    if (!socket || !user) return;
    
    socket.send(JSON.stringify({
      type: 'endDraft',
      data: { username: user.username }
    }));
  }, [socket, user]);
  
  // Send a chat message
  const sendChatMessage = useCallback((message) => {
    if (!socket || !user || !message.trim()) return;
    
    socket.send(JSON.stringify({
      type: 'chat',
      data: {
        username: user.username,
        message: message.trim()
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
        endDraft,
        hasUserJoined,
        isUserTurn,
        chatMessages,
        sendChatMessage
      }}
    >
      {children}
    </DraftRoomContext.Provider>
  );
};

export default DraftRoomContext;
