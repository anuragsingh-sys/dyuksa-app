import React, { createContext, useState } from 'react';

export const ThemeContext = createContext({
  theme: 'Light',
  setTheme: () => {},
  fontSize: 'Medium',
  setFontSize: () => {},
  fontScale: 1,
});

export function ThemeProvider({ children }) {
  const [theme,    setTheme]    = useState('Light');
  const [fontSize, setFontSize] = useState('Medium');

  const fontScale = fontSize === 'Small' ? 0.88 : fontSize === 'Large' ? 1.14 : 1;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontSize, setFontSize, fontScale }}>
      {children}
    </ThemeContext.Provider>
  );
}
