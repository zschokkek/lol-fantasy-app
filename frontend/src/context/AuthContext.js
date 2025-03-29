// frontend/src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Debug logging for user state changes
  useEffect(() => {
    if (user) {
      console.log('AUTH CONTEXT: User state changed:', {
        id: user.id,
        username: user.username,
        email: user.email
      });
    } else {
      console.log('AUTH CONTEXT: User state is null');
    }
  }, [user]);
  
  // Debug logging for token changes
  useEffect(() => {
    console.log('AUTH CONTEXT: Token changed:', token ? 'Token exists' : 'No token');
    console.log('AUTH CONTEXT: localStorage token:', localStorage.getItem('authToken') ? 'Token exists in localStorage' : 'No token in localStorage');
  }, [token]);
  
  // Load user on initial load
  useEffect(() => {
    const loadUser = async () => {
      console.log('AUTH CONTEXT: Loading user with token:', token ? 'Token exists' : 'No token');
      
      if (token) {
        try {
          console.log('AUTH CONTEXT: Fetching user data from API');
          const response = await fetch(`${API_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('AUTH CONTEXT: User data received from API:', {
              id: userData.id,
              username: userData.username,
              email: userData.email
            });
            setUser(userData);
          } else {
            console.log('AUTH CONTEXT: Invalid token, logging out');
            // Token is invalid
            logout();
          }
        } catch (error) {
          console.error('AUTH CONTEXT: Error loading user:', error);
          logout();
        }
      } else {
        console.log('AUTH CONTEXT: No token available, user remains null');
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
      console.log('AUTH CONTEXT: Registering new user:', username);
      
      // First, completely clear any existing user data
      // This ensures we don't mix data between different users
      await forceCompleteReset();
      
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.log('AUTH CONTEXT: Registration failed:', data.message);
        throw new Error(data.message || 'Registration failed');
      }
      
      console.log('AUTH CONTEXT: Registration successful for user:', {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email
      });
      
      // Save token and user
      localStorage.setItem('authToken', data.token);
      console.log('AUTH CONTEXT: Token saved to localStorage');
      
      setToken(data.token);
      setUser(data.user);
      
      setLoading(false);
      return data;
    } catch (error) {
      console.error('AUTH CONTEXT: Registration error:', error.message);
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
      console.log('AUTH CONTEXT: Login attempt for user:', username);
      
      // First, completely clear any existing user data
      // This ensures we don't mix data between different users
      console.log('AUTH CONTEXT: Performing complete reset before login');
      await forceCompleteReset();
      
      console.log('AUTH CONTEXT: Reset complete, sending login request');
      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.log('AUTH CONTEXT: Login failed:', data.message);
        throw new Error(data.message || 'Login failed');
      }
      
      console.log('AUTH CONTEXT: Login successful for user:', {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email
      });
      
      // Save token and user
      console.log('AUTH CONTEXT: Saving token to localStorage');
      localStorage.setItem('authToken', data.token);
      
      console.log('AUTH CONTEXT: Setting token and user state');
      setToken(data.token);
      setUser(data.user);
      
      setLoading(false);
      return data;
    } catch (error) {
      console.error('AUTH CONTEXT: Login error:', error.message);
      setError(error.message);
      setLoading(false);
      throw error;
    }
  };
  
  // Force a complete reset of all application state
  const forceCompleteReset = async () => {
    console.log('AUTH CONTEXT: Performing complete application reset');
    
    // Clear all browser storage
    console.log('AUTH CONTEXT: Clearing localStorage');
    localStorage.clear();
    
    console.log('AUTH CONTEXT: Clearing sessionStorage');
    sessionStorage.clear();
    
    // Reset React state
    console.log('AUTH CONTEXT: Resetting token state to null');
    setToken(null);
    
    console.log('AUTH CONTEXT: Resetting user state to null');
    setUser(null);
    
    // Clear API cache
    if (window.clearApiCache && typeof window.clearApiCache === 'function') {
      console.log('AUTH CONTEXT: Calling window.clearApiCache()');
      window.clearApiCache();
    }
    
    // Dispatch events for other components to clear their state
    console.log('AUTH CONTEXT: Dispatching auth:clearCache event');
    window.dispatchEvent(new CustomEvent('auth:clearCache'));
    
    console.log('AUTH CONTEXT: Dispatching auth:completeReset event');
    window.dispatchEvent(new CustomEvent('auth:completeReset'));
    
    // Small delay to ensure all async operations complete
    console.log('AUTH CONTEXT: Waiting for reset operations to complete');
    return new Promise(resolve => setTimeout(resolve, 100));
  };
  
  // Helper function to clear all caches
  const clearAllCaches = () => {
    console.log('AUTH CONTEXT: Clearing all caches');
    
    // Clear all localStorage except auth token
    console.log('AUTH CONTEXT: Clearing localStorage');
    localStorage.clear();
    
    // Clear session storage
    console.log('AUTH CONTEXT: Clearing session storage');
    sessionStorage.clear();
    
    // Clear any API cache if the ApiContext has exposed a method for it
    if (window.clearApiCache && typeof window.clearApiCache === 'function') {
      console.log('AUTH CONTEXT: Calling window.clearApiCache()');
      window.clearApiCache();
    }
    
    // Dispatch a custom event that ApiContext can listen for
    console.log('AUTH CONTEXT: Dispatching auth:clearCache event');
    window.dispatchEvent(new CustomEvent('auth:clearCache'));
  };
  
  // Logout user
  const logout = async () => {
    console.log('AUTH CONTEXT: Logging out user');
    if (user) {
      console.log('AUTH CONTEXT: Current user being logged out:', {
        id: user.id,
        username: user.username,
        email: user.email
      });
    }
    
    // Perform a complete reset
    await forceCompleteReset();
    
    // Force a page reload to ensure all components are reset
    console.log('AUTH CONTEXT: Redirecting to login page');
    window.location.href = '/login';
  };
  
  const value = {
    user,
    token,
    loading,
    error,
    register,
    login,
    logout,
    clearAllCaches,
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