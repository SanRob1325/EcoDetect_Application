import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

// Define the theme colors
export const colors = {
  light: {
    primary: '#388E3C',
    secondary: '#4CAF50',
    background: '#F1F8E9',
    card: '#FFFFFF',
    text: '#333333',
    border: '#E0E0E0',
    notification: '#FF9800',
    error: '#F44336',
    success: '#8BC34A',
    warning: '#FFC107',
  },
  dark: {
    primary: '#2E7D32',
    secondary: '#388E3C',
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    border: '#2C2C2C',
    notification: '#FF9800',
    error: '#F44336',
    success: '#8BC34A',
    warning: '#FFC107',
  },
};

// Define the theme context type
type ThemeContextType = {
  theme: keyof typeof colors;
  toggleTheme: () => void;
  colors: typeof colors.light | typeof colors.dark;
};

// Create the context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceTheme = useColorScheme() || 'light';
  const [theme, setTheme] = useState<keyof typeof colors>(deviceTheme as keyof typeof colors);

  // Toggle between light and dark theme
  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Get the current theme colors
  const currentColors = colors[theme];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: currentColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;