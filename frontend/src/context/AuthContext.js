// frontend/src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load user on initial load
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await fetch(`${API_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token is invalid
            logout();
          }
        } catch (error) {
          console.error('Error loading user:', error);
          logout();
        }
      }
      setLoading(false);
    };
    
    loadUser();
  }, [token]);
  
  // Register user
  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      // Clear any existing cached data before registration
      clearAllCaches();
      
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      
      // Save token and user
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      setUser(data.user);
      
      setLoading(false);
      return data;
    } catch (error) {
      setError(error.message);
      setLoading(false);
      throw error;
    }
  };
  
  // Login user
  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    try {
      // Clear any existing cached data before login
      clearAllCaches();
      
      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Save token and user
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      setUser(data.user);
      
      setLoading(false);
      return data;
    } catch (error) {
      setError(error.message);
      setLoading(false);
      throw error;
    }
  };
  
  // Helper function to clear all caches
  const clearAllCaches = () => {
    // Clear localStorage items that might contain user-specific data
    const authToken = localStorage.getItem('authToken'); // Save auth token temporarily
    
    // Clear all localStorage items except those we want to keep
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Skip the auth token if we're not logging out
      if (key !== 'authToken') {
        localStorage.removeItem(key);
      }
    }
    
    // Clear session storage as well
    sessionStorage.clear();
    
    // Clear any API cache if the ApiContext has exposed a method for it
    if (window.clearApiCache && typeof window.clearApiCache === 'function') {
      window.clearApiCache();
    }
    
    // Dispatch a custom event that ApiContext can listen for
    window.dispatchEvent(new CustomEvent('auth:clearCache'));
  };
  
  // Logout user
  const logout = () => {
    // Clear all caches first
    clearAllCaches();
    
    // Then remove auth token and reset user state
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };
  
  const value = {
    user,
    token,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: !!user
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};