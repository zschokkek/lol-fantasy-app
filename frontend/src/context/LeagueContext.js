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

  // Reset league state
  const resetLeagueState = () => {
    console.log('Resetting league state');
    setSelectedLeague(null);
    setUserLeagues([]);
    localStorage.removeItem('selectedLeagueId');
  };

  // Listen for auth reset events
  useEffect(() => {
    const handleCompleteReset = () => {
      console.log('LeagueContext: Received complete reset event');
      resetLeagueState();
    };
    
    window.addEventListener('auth:completeReset', handleCompleteReset);
    
    return () => {
      window.removeEventListener('auth:completeReset', handleCompleteReset);
    };
  }, []);

  // Load user leagues on mount or when authentication changes
  useEffect(() => {
    const loadLeagues = async () => {
      // Only attempt to load leagues if the user is authenticated
      if (!isAuthenticated) {
        setLoading(false);
        resetLeagueState();
        return;
      }
      
      try {
        setLoading(true);
        const leagues = await api.getUserLeagues();
        setUserLeagues(leagues);
        
        // Check for stored selected league
        const storedLeagueId = localStorage.getItem('selectedLeagueId');
        if (storedLeagueId && leagues.length > 0) {
          const league = leagues.find(l => l._id === storedLeagueId || l.id === storedLeagueId);
          if (league) {
            setSelectedLeague(league);
          } else if (leagues.length > 0) {
            // If stored league not found but leagues exist, select the first one
            setSelectedLeague(leagues[0]);
            localStorage.setItem('selectedLeagueId', leagues[0]._id || leagues[0].id);
          }
        } else if (leagues.length > 0) {
          // If no stored league but leagues exist, select the first one
          setSelectedLeague(leagues[0]);
          localStorage.setItem('selectedLeagueId', leagues[0]._id || leagues[0].id);
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
      localStorage.setItem('selectedLeagueId', league._id || league.id);
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
