// frontend/src/context/ApiContext.js
import React, { createContext, useState, useContext, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const ApiContext = createContext();
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Cache configuration
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const PLAYER_CACHE_TIME = 15 * 60 * 1000; // 15 minutes for player data

export const ApiProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { token } = useAuth();
  
  // Cache storage using useRef to persist between renders
  const cacheRef = useRef({});
  
  // Cache helper functions
  const getCachedData = (cacheKey) => {
    const cachedItem = cacheRef.current[cacheKey];
    if (!cachedItem) return null;
    
    const now = Date.now();
    if (now > cachedItem.expiry) {
      // Cache expired, remove it
      delete cacheRef.current[cacheKey];
      return null;
    }
    
    return cachedItem.data;
  };
  
  const setCachedData = (cacheKey, data, expiryTime) => {
    cacheRef.current[cacheKey] = {
      data,
      expiry: Date.now() + expiryTime
    };
  };
  
  const clearCache = () => {
    cacheRef.current = {};
  };
  
  const fetchData = useCallback(async (endpoint, options = {}, useCache = true, cacheTime = DEFAULT_CACHE_TIME) => {
    // Skip cache for non-GET requests
    const isGetRequest = !options.method || options.method === 'GET';
    useCache = useCache && isGetRequest;
    
    // Generate cache key from endpoint and any query parameters
    const cacheKey = endpoint + (options.body ? JSON.stringify(options.body) : '');
    
    // Check cache first if it's a GET request
    if (useCache) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }
    
    // Only set loading to true if this is not a background refresh
    // This prevents the UI from showing loading indicators for background operations
    if (!options.backgroundRefresh) {
      setLoading(true);
      setError(null);
    }
    
    try {
      const url = `${API_URL}${endpoint}`;
      
      // Add authorization header if token exists
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        ...options.headers
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // First check if the response is OK
      if (!response.ok) {
        // Try to parse as JSON first
        const contentType = response.headers.get('content-type');
        let errorMessage = `Server error: ${response.status}`;
        
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText && !errorText.includes('<!DOCTYPE') && !errorText.includes('<html')) {
              errorMessage = `${errorMessage}. ${errorText.substring(0, 100)}`;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          // Keep the default error message if parsing fails
        }
        
        // Create a custom error with the error message
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }
      
      // Check for valid JSON content-type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`Warning: Response does not have JSON content-type: ${contentType}`);
      }
      
      // Try to parse the response as JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // Handle HTML response or invalid JSON
        const responseText = await response.clone().text();
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          throw new Error('Server returned HTML instead of JSON. The server may be down or returning an error page.');
        }
        throw new Error(`Invalid JSON response: ${jsonError.message}`);
      }
      
      // Cache successful GET responses
      if (useCache) {
        setCachedData(cacheKey, data, cacheTime);
      }
      
      // Only update loading state if this is not a background refresh
      if (!options.backgroundRefresh) {
        setLoading(false);
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('<!DOCTYPE') || error.message.includes('<html')) {
        errorMessage = 'Server returned an HTML error page instead of JSON. The server may be experiencing issues.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to the server. Please check your internet connection.';
      }
      
      // Only update error state if this is not a background refresh
      if (!options.backgroundRefresh) {
        setError(errorMessage);
        setLoading(false);
      }
      
      throw new Error(errorMessage);
    }
  }, [token]);
  
  // API methods for players with caching
  const getPlayers = useCallback(() => 
    fetchData('/players', {}, true, PLAYER_CACHE_TIME), [fetchData]);
  
  const getPlayersByRegion = useCallback((region) => 
    fetchData(`/players/region/${region}`, {}, true, PLAYER_CACHE_TIME), [fetchData]);
  
  const getPlayersByPosition = useCallback((position) => 
    fetchData(`/players/position/${position}`, {}, true, PLAYER_CACHE_TIME), [fetchData]);
  
  const getPlayerById = useCallback((id) => 
    fetchData(`/players/${id}`, {}, true, PLAYER_CACHE_TIME), [fetchData]);
  
  const updatePlayerStats = useCallback((id) => 
    fetchData(`/players/${id}/update`, { method: 'POST' }, false), [fetchData]);
  
  const updatePlayerImage = useCallback((id, imageUrl) => 
    fetchData(`/players/${id}/update-image`, { 
      method: 'POST',
      body: JSON.stringify({ imageUrl })
    }, false), [fetchData]);
  
  const getPlayerImage = useCallback((id) => 
    fetchData(`/players/${id}/image`, {}, true, PLAYER_CACHE_TIME), [fetchData]);
  
  // API methods for teams
  const getTeams = useCallback(() => fetchData('/teams', {}, true), [fetchData]);
  
  const getMyTeams = useCallback(() => 
    fetchData('/teams/my-teams', {}, true), [fetchData]);
  
  const getTeamById = useCallback((id) => 
    fetchData(`/teams/${id}`, {}, true), [fetchData]);
  
  const createTeam = useCallback((teamData) => 
    fetchData('/teams', { 
      method: 'POST',
      body: JSON.stringify(teamData)
    }, false), [fetchData]);
  
  const addPlayerToTeam = useCallback((teamId, playerId, slot) => 
    fetchData(`/teams/${teamId}/players`, {
      method: 'POST',
      body: JSON.stringify({ playerId, slot })
    }, false), [fetchData]);
  
  const removePlayerFromTeam = useCallback((teamId, playerId) => 
    fetchData(`/teams/${teamId}/players/${playerId}`, {
      method: 'DELETE'
    }, false), [fetchData]);
  
  // API methods for league
  const getLeague = useCallback((leagueId) => fetchData(`/leagues/${leagueId}`, {}, true), [fetchData]);
  
  const getStandings = useCallback((leagueId) => 
    fetchData(`/leagues/${leagueId}/standings`, {}, true), [fetchData]);
  
  const getMatchups = useCallback((leagueId, week) => 
    fetchData(`/leagues/${leagueId}/matchups/${week}`, {}, true), [fetchData]);
  
  const calculateWeekScores = useCallback((leagueId, week) => 
    fetchData(`/leagues/${leagueId}/calculate/${week}`, {
      method: 'POST'
    }, false), [fetchData]);
  
  const evaluateMatchupWins = useCallback((leagueId, week) => 
    fetchData(`/leagues/${leagueId}/matchups/${week}/evaluate-wins`, {
      method: 'POST'
    }, false), [fetchData]);
  
  const generateSchedule = useCallback((leagueId, weeks) => 
    fetchData(`/leagues/${leagueId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ weeks })
    }, false), [fetchData]);
  
  const updateAllStats = useCallback((leagueId) => 
    fetchData(`/leagues/${leagueId}/update-stats`, {
      method: 'POST'
    }, false), [fetchData]);
  
  // API methods for draft
  const getDraftStatus = useCallback(() => 
    fetchData('/draft/status', {}, true), [fetchData]);
  
  const draftPlayer = useCallback((teamId, playerId, position) => 
    fetchData('/draft/pick', {
      method: 'POST',
      body: JSON.stringify({ teamId, playerId, position })
    }, false), [fetchData]);
  
  // League related API methods
  const getLeagues = useCallback(() => 
    fetchData('/leagues', {}, true), [fetchData]);

  const getUserLeagues = useCallback(() => 
    fetchData('/leagues/user', {}, true), [fetchData]);

  const getLeagueById = useCallback((id, refresh = false) => {
    // If refresh is true, add a query param to bust cache and get fresh data
    const endpoint = refresh ? `/leagues/${id}?refresh=true` : `/leagues/${id}`;
    
    // Set backgroundRefresh option if this is a refresh request
    // This prevents loading indicators from showing during background refreshes
    const options = refresh ? { backgroundRefresh: true } : {};
    
    // Always bypass cache when refresh is true
    return fetchData(endpoint, options, !refresh);
  }, [fetchData]);

  const createLeague = useCallback((leagueData) => 
    fetchData('/leagues', { 
      method: 'POST',
      body: JSON.stringify(leagueData)
    }, false), [fetchData]);

  const joinLeague = useCallback(async (leagueId, teamName) => {
    // Make the API call to join the league
    const result = await fetchData(`/leagues/${leagueId}/join`, {
      method: 'POST',
      body: JSON.stringify({ teamName })
    }, false);
    
    // Invalidate related caches to ensure fresh data on next fetch
    // Clear specific cache entries rather than the entire cache
    delete cacheRef.current[`/leagues/${leagueId}`];
    delete cacheRef.current[`/leagues/${leagueId}/standings`];
    delete cacheRef.current[`/teams/my-teams`];
    delete cacheRef.current[`/leagues/user`];
    
    console.log('Cache invalidated for league, standings, and teams after joining league');
    
    return result;
  }, [fetchData]);

  const scheduleDraft = useCallback((leagueId, draftDateTime, draftType) => 
    fetchData(`/leagues/${leagueId}/schedule-draft`, {
      method: 'POST',
      body: JSON.stringify({ draftDateTime, draftType })
    }, false), [fetchData]);
    
  // User-related API methods
  const getUserTeams = useCallback(() => 
    fetchData('/users/teams', {}, true), [fetchData]);
  
  const updateUserProfile = useCallback((userData) => 
    fetchData('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData)
    }, false), [fetchData]);
  
  const getUserRights = useCallback((teamId) => 
    fetchData(`/users/rights/${teamId}`, {}, true), [fetchData]);
  
  const transferTeamOwnership = useCallback((teamId, newOwnerId) => 
    fetchData(`/teams/${teamId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerId })
    }, false), [fetchData]);
    
  // Friends-related API methods
  const getFriends = useCallback(() => 
    fetchData('/friends', {}, true), [fetchData]);
    
  const getFriendRequests = useCallback(() => 
    fetchData('/friends/requests', {}, true), [fetchData]);
    
  const sendFriendRequest = useCallback((userId) => 
    fetchData('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }, false), [fetchData]);
    
  const acceptFriendRequest = useCallback((requestId) => 
    fetchData(`/friends/request/${requestId}/accept`, {
      method: 'POST'
    }, false), [fetchData]);
    
  const rejectFriendRequest = useCallback((requestId) => 
    fetchData(`/friends/request/${requestId}/reject`, {
      method: 'POST'
    }, false), [fetchData]);
    
  const removeFriend = useCallback((friendId) => 
    fetchData(`/friends/${friendId}`, {
      method: 'DELETE'
    }, false), [fetchData]);
    
  const searchUsers = useCallback((query) => 
    fetchData(`/users/search?q=${encodeURIComponent(query)}`, {}, false), [fetchData]);
    
  // Messages-related API methods
  const getConversations = useCallback(() => 
    fetchData('/messages/conversations', {}, false), [fetchData]);
    
  const getConversation = useCallback((conversationId) => 
    fetchData(`/messages/conversations/${conversationId}`, {}, false), [fetchData]);
    
  const getMessages = useCallback((conversationId, page = 1, limit = 20) => 
    fetchData(`/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`, {}, false), [fetchData]);
    
  const sendMessage = useCallback((conversationId, content) => 
    fetchData(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }, false), [fetchData]);
    
  const createConversation = useCallback((userId) => 
    fetchData('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }, false), [fetchData]);
    
  const markConversationAsRead = useCallback((conversationId) => 
    fetchData(`/messages/conversations/${conversationId}/read`, {
      method: 'POST'
    }, false), [fetchData]);
  
  const value = {
    loading,
    error,
    clearCache, // Expose cache clearing function
    // Player methods
    getPlayers,
    getPlayersByRegion,
    getPlayersByPosition,
    getPlayerById,
    updatePlayerStats,
    updatePlayerImage,
    getPlayerImage,
    // Team methods
    getTeams,
    getMyTeams,
    getTeamById,
    createTeam,
    addPlayerToTeam,
    removePlayerFromTeam,
    
    // New league methods
    getLeagues,
    getUserLeagues,
    getLeagueById,
    createLeague,
    joinLeague,
    scheduleDraft,
    
    // Original league methods
    getLeague,
    getStandings,
    getMatchups,
    calculateWeekScores,
    evaluateMatchupWins,
    setSchedule: generateSchedule,
    updateAllStats,
    
    // Draft methods
    getDraftStatus,
    draftPlayer,
    
    // User-specific methods
    getUserTeams,
    updateUserProfile,
    getUserRights,
    transferTeamOwnership,
    
    // Friends methods
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    searchUsers,
    
    // Messaging methods
    getConversations,
    getConversation,
    getMessages,
    sendMessage,
    createConversation,
    markConversationAsRead
  };
  
  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};