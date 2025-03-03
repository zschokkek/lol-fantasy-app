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
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      
      // Cache successful GET responses
      if (useCache) {
        setCachedData(cacheKey, data, cacheTime);
      }
      
      setLoading(false);
      return data;
    } catch (error) {
      setError(error.message);
      setLoading(false);
      throw error;
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
  const getLeague = useCallback(() => fetchData('/league', {}, true), [fetchData]);
  
  const getStandings = useCallback(() => 
    fetchData('/league/standings', {}, true), [fetchData]);
  
  const getMatchups = useCallback((week) => 
    fetchData(`/league/matchups/${week}`, {}, true), [fetchData]);
  
  const calculateWeekScores = useCallback((week) => 
    fetchData(`/league/calculate/${week}`, {
      method: 'POST'
    }, false), [fetchData]);
  
  const generateSchedule = useCallback((weeksPerSeason) => 
    fetchData('/league/schedule', {
      method: 'POST',
      body: JSON.stringify({ weeksPerSeason })
    }, false), [fetchData]);
  
  const updateAllStats = useCallback(() => 
    fetchData('/league/update-stats', {
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

  const getLeagueById = useCallback((id) => 
    fetchData(`/leagues/${id}`, {}, true), [fetchData]);

  const createLeague = useCallback((leagueData) => 
    fetchData('/leagues', { 
      method: 'POST',
      body: JSON.stringify(leagueData)
    }, false), [fetchData]);

  const joinLeague = useCallback((leagueId) => 
    fetchData(`/leagues/${leagueId}/join`, {
      method: 'POST'
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
    
    // Original league methods
    getLeague,
    getStandings,
    getMatchups,
    calculateWeekScores,
    generateSchedule,
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