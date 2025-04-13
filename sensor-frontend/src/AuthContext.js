import React, { createContext, useState, useEffect, useContext } from 'react';
import { signIn, signOut, currentAuthenticatedUser } from './authUtils';
import api from './apiService';

// Create the context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to get the current authenticated user
        const userData = await currentAuthenticatedUser();
        
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
          console.log('User authenticated:', userData.username);
        }
      } catch (err) {
        console.log('No authenticated user found');
        setUser(null);
        setIsAuthenticated(false);
        
        // Clear any stored tokens if authentication check fails
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };

    checkAuthentication();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the sign in function from authUtils
      const result = await signIn({
        username: credentials.email,
        password: credentials.password,
        ...(credentials.newPassword ? {
          newPassword: credentials.newPassword,
          requiredAttributes: credentials.requiredAttributes || {}
        } : {})
      });
      
      // Get user data after successful sign in
      const userData = await currentAuthenticatedUser();
      
      setUser(userData);
      setIsAuthenticated(true);
      
      console.log('Auth state updated in context:', {isAuthenticated: true, user: userData})
      return { 
        success: true, 
        user: userData,
        requiresNewPassword: false
      };
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed');
      
      // Handle new password required challenge
      if (err.name === 'NewPasswordRequiredError') {
        return {
          success: false,
          requiresNewPassword: true,
          challengeParameters: err.challengeParameters,
          requiredAttributes: err.requiredAttributes || []
        };
      }
      
      return { 
        success: false, 
        error: err.message || 'Authentication failed'
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);
      // Call the sign out function from authUtils
      await signOut();
      
      // Clear user state
      setUser(null);
      setIsAuthenticated(false);
      
      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message || 'Logout failed');
      
      return { 
        success: false, 
        error: err.message || 'Logout failed'
      };
    } finally {
      setLoading(false);
    }
  };

  // Values to be provided by the context
  const value = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;