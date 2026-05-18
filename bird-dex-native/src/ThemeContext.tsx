import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { LIGHT, DARK, type ThemeColors } from './theme';

const ThemeContext = createContext<ThemeColors>(LIGHT);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <ThemeContext.Provider value={scheme === 'dark' ? DARK : LIGHT}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}
