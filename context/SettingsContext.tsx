import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export type Language = {
  code: string;
  name: string;
  nativeName: string;
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'english', name: 'English', nativeName: 'English' },
  { code: 'bengali', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'hindi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'telugu', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'tamil', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'bhojpuri', name: 'Bhojpuri', nativeName: 'भोजपुरी' },
  { code: 'marathi', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'haryanvi', name: 'Haryanvi', nativeName: 'हरियाणवी' },
  { code: 'rajasthani', name: 'Rajasthani', nativeName: 'राजस्थानी' },
  { code: 'odia', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'assamese', name: 'Assamese', nativeName: 'অসমীয়া' },
];

export type AudioQuality = '12kbps' | '48kbps' | '96kbps' | '160kbps' | '320kbps';

interface SettingsContextType {
  primaryLanguage: string;
  setPrimaryLanguage: (lang: string) => Promise<void>;
  audioQuality: AudioQuality;
  setAudioQuality: (quality: AudioQuality) => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<string>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [primaryLanguage, _setPrimaryLanguage] = useState<string>('english');
  const [audioQuality, _setAudioQuality] = useState<AudioQuality>('320kbps');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedLang = await AsyncStorage.getItem('user_primary_language');
      const savedQuality = await AsyncStorage.getItem('user_audio_quality');
      
      if (savedLang) {
        _setPrimaryLanguage(savedLang);
      } else {
        // First run: ensure english is saved as default
        _setPrimaryLanguage('english');
        await AsyncStorage.setItem('user_primary_language', 'english');
      }
      
      if (savedQuality) {
        // Upgrade from old 96kbps default to new 320kbps Extreme default
        if (savedQuality === '96kbps') {
          _setAudioQuality('320kbps');
          await AsyncStorage.setItem('user_audio_quality', '320kbps');
        } else {
          _setAudioQuality(savedQuality as AudioQuality);
        }
      } else {
        // First run: ensure 320kbps is saved
        _setAudioQuality('320kbps');
        await AsyncStorage.setItem('user_audio_quality', '320kbps');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setAudioQuality = async (quality: AudioQuality) => {
    try {
      await AsyncStorage.setItem('user_audio_quality', quality);
      _setAudioQuality(quality);
    } catch (error) {
      console.error('Failed to save audio quality:', error);
    }
  };

  const clearCache = async () => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        await Promise.all(files.map(file => 
          FileSystem.deleteAsync(cacheDir + file, { idempotent: true })
        ));
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const getCacheSize = async (): Promise<string> => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return '0 MB';
      
      const info = await FileSystem.getInfoAsync(cacheDir);
      if (!info.exists) return '0 MB';
      
      // Basic estimation if size is not provided directly (common on some platforms)
      const size = (info as any).size || 0;
      if (size === 0) {
        // Fallback: sum up file sizes
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        let total = 0;
        for (const file of files) {
          const fInfo = await FileSystem.getInfoAsync(cacheDir + file);
          if (fInfo.exists) total += (fInfo as any).size || 0;
        }
        return (total / (1024 * 1024)).toFixed(1) + ' MB';
      }
      
      return (size / (1024 * 1024)).toFixed(1) + ' MB';
    } catch (error) {
       return '0 MB';
    }
  };

  const setPrimaryLanguage = async (lang: string) => {
    try {
      await AsyncStorage.setItem('user_primary_language', lang);
      _setPrimaryLanguage(lang);
    } catch (error) {
      console.error('Failed to save language setting:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      primaryLanguage, 
      setPrimaryLanguage, 
      audioQuality, 
      setAudioQuality,
      clearCache,
      getCacheSize,
      isLoading 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
