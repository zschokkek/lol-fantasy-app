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
    
    setLoading(true);
    setError(null);
    
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
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
          } catch (jsonError) {
            // If JSON parsing fails, get the text and check if it's HTML
            const errorText = await response.text();
            if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
              throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
            }
            throw new Error(`Server error: ${response.status}. Response was not valid JSON.`);
          }
        } else {
          // Not JSON, get as text
          const errorText = await response.text();
          if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
            throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
          }
          throw new Error(`Server error: ${response.status}. ${errorText.substring(0, 100)}`);
        }
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
      
      setLoading(false);
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
      
      setError(errorMessage);
      setLoading(false);
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
    // Always bypass cache when refresh is true
    return fetchData(endpoint, {}, !refresh);
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
    setSchedule: generateSchedule,
    updateAllStats,
    
    // Draft methods
    getDraftStatus,
    draftPlayer,
    
    // User-specific methods
    getUserTeams,
    updateUserProfile,
    getUserRights,
    transferTeamOwnership
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