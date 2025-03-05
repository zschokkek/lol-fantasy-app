// frontend/src/context/LeagueContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useApi } from './ApiContext';
import { useAuth } from './AuthContext';

const LeagueContext = createContext();

export const LeagueProvider = ({ children }) => {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [userLeagues, setUserLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = useApi();
  const { isAuthenticated } = useAuth();

  // Load user leagues on mount
  useEffect(() => {
    const loadLeagues = async () => {
      // Only attempt to load leagues if the user is authenticated
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const leagues = await api.getUserLeagues();
        setUserLeagues(leagues);
        
        // Check for stored selected league
        const storedLeagueId = localStorage.getItem('selectedLeagueId');
        if (storedLeagueId && leagues.length > 0) {
          const league = leagues.find(l => l._id === storedLeagueId);
          if (league) {
            setSelectedLeague(league);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to load leagues:', error);
        setLoading(false);
      }
    };
    
    loadLeagues();
  }, [api, isAuthenticated]);
  
  // Set selected league and store in localStorage
  const selectLeague = (league) => {
    setSelectedLeague(league);
    if (league) {
      localStorage.setItem('selectedLeagueId', league._id);
    } else {
      localStorage.removeItem('selectedLeagueId');
    }
  };
  
  const clearSelectedLeague = () => {
    setSelectedLeague(null);
    localStorage.removeItem('selectedLeagueId');
  };
  
  return (
    <LeagueContext.Provider 
      value={{ 
        selectedLeague, 
        userLeagues, 
        loading,
        selectLeague,
        clearSelectedLeague
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
};

export const useLeague = () => useContext(LeagueContext);

export default LeagueContext;
