import React, { createContext, useState, useEffect, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../constants/Colors';

// Define the shape of the context value
interface ThemeContextType {
  theme: 'light' | 'dark';
  colors: typeof lightColors | typeof darkColors;
  toggleTheme: () => void;
}

// Create the context with a default value
export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: lightColors,
  toggleTheme: () => {},
});

// Create the provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get the system's default color scheme
  const systemTheme = Appearance.getColorScheme() || 'light';
  const [theme, setTheme] = useState<'light' | 'dark'>(systemTheme);

  // Load the saved theme from AsyncStorage when the app starts
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) {
          setTheme(savedTheme as 'light' | 'dark');
        }
      } catch (error) {
        console.error('Failed to load theme from AsyncStorage', error);
      }
    };

    loadTheme();
  }, []);

  // Function to toggle the theme and save the preference
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Failed to save theme to AsyncStorage', error);
    }
  };

  // Determine which color palette to use based on the current theme
  const colors = useMemo(() => (theme === 'light' ? lightColors : darkColors), [theme]);

  // Provide the theme, colors, and toggle function to children
  const contextValue = useMemo(() => ({
    theme,
    colors,
    toggleTheme,
  }), [theme, colors]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};