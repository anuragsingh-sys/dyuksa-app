import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'DYUKSA_SETTINGS';

const defaults = {
  theme:           'Light',
  fontSize:        'Medium',
  dataMode:        'Local',
  projectView:     'Grid',
  collapseSidebar: false,
  desktopNotif:    true,
  emailNotif:      false,
  chatMention:     true,
  taskAssign:      true,
  notifSound:      true,
  sessionAlerts:   true,
};

export const ThemeContext = createContext({
  ...defaults,
  fontScale: 1,
  setSetting: () => {},
  // convenience setters kept for backward compat
  setTheme:    () => {},
  setFontSize: () => {},
});

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(defaults);
  const [loaded,   setLoaded]   = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) {
        try { setSettings(s => ({ ...s, ...JSON.parse(raw) })); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  // Persist on every change (after first load)
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, loaded]);

  const setSetting = (key, value) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const fontScale =
    settings.fontSize === 'Small' ? 0.88 :
    settings.fontSize === 'Large' ? 1.14 : 1;

  const value = {
    ...settings,
    fontScale,
    setSetting,
    // backward-compat helpers used by existing screens
    setTheme:    (v) => setSetting('theme',    v),
    setFontSize: (v) => setSetting('fontSize', v),
  };

  if (!loaded) return null; // wait for storage before rendering

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
