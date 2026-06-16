import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from '../lib/settings-storage';

export type Language = 'vi' | 'en' | 'ja';
export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsContextType {
  language: Language;
  theme: ThemeMode;
  themeMode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  colors: typeof lightColors;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isLoading: boolean;
}

export const lightColors = {
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  subtext: '#64748b',
  primary: '#4f46e5',
  border: '#e2e8f0',
};

export const darkColors = {
  background: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  subtext: '#cbd5e1',
  primary: '#818cf8',
  border: '#334155',
};

const SettingsContext = createContext<SettingsContextType>({
  language: 'vi',
  theme: 'light',
  themeMode: 'light',
  effectiveTheme: 'light',
  colors: lightColors,
  setLanguage: async () => {},
  setTheme: async () => {},
  setThemeMode: async () => {},
  isLoading: true,
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [language, setLanguageState] = useState<Language>('vi');
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedLang = await getSetting('app_language');
        if (storedLang === 'vi' || storedLang === 'en' || storedLang === 'ja') {
          setLanguageState(storedLang as Language);
        }

        const storedTheme = await getSetting('app_theme');
        if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
          setThemeState(storedTheme as ThemeMode);
        }
      } catch (err) {
        console.warn('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await setSetting('app_language', lang);
  };

  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    await setSetting('app_theme', mode);
  };

  const effectiveTheme = theme === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : theme;
  const colors = effectiveTheme === 'dark' ? darkColors : lightColors;

  return (
    <SettingsContext.Provider value={{ language, theme, themeMode: theme, effectiveTheme, colors, setLanguage, setTheme, setThemeMode: setTheme, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}
