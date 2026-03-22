import { Stack } from 'expo-router';
import { Theme } from '@/constants/Theme';
import { AudioProvider } from '@/context/AudioContext';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Platform, NativeModules } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TrackPlayer from 'react-native-track-player';
import playbackService from '@/services/playbackService';
import DynamicIsland from '@/components/DynamicIsland';
import { SettingsProvider } from '@/context/SettingsContext';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { checkAppStatus, AppConfig } from '@/services/configService';

// Multilingual translations for the "Songeet" brand name
const SONGEET_TRANSLATIONS: Record<string, string> = {
  english: 'Songeet',
  bengali: 'সঙ্গীত',
  hindi: 'संगीत',
  punjabi: 'ਸੰਗੀਤ',
  telugu: 'సంగీతం',
  tamil: 'சங்கீத்',
  marathi: 'संगीत',
  gujarati: 'સંગીત',
  haryanvi: 'संगीत',
  rajasthani: 'संगीत',
  odia: 'ସଙ୍ଗୀତ',
  assamese: 'সংগীত',
  bhojpuri: 'संगीत',
};

// Register TrackPlayer playback service
TrackPlayer.registerPlaybackService(() => playbackService);

// Prevent auto-hide to show our custom branded splash
SplashScreen.preventAutoHideAsync().catch(() => { });

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [revokedMessage, setRevokedMessage] = useState('');
  const [displayLang, setDisplayLang] = useState('english');
  const [loaded, error] = useFonts({
    'Serif': { uri: 'https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay-Regular.ttf' },
    'Sans': { uri: 'https://github.com/google/fonts/raw/main/ofl/inter/Inter-Regular.ttf' },
  });

  useEffect(() => {
    async function prepare() {
      // 1. Fetch saved language for the splash screen
      try {
        const savedLang = await AsyncStorage.getItem('user_primary_language');
        if (savedLang) {
          setDisplayLang(savedLang);
          // Sync to Native SharedPreferences for the next cold start
          if (NativeModules.SongeetSync) {
            NativeModules.SongeetSync.saveLanguage(savedLang);
            // DO NOT HIDE YET - We will hide it after React is truly ready
          }
        }
      } catch (e) {
        console.warn('Failed to load splash language', e);
      }

      // 2. Check for Revocation / IP Block
      try {
        const status = await checkAppStatus();
        if (status.revoked) {
          setIsRevoked(true);
          setRevokedMessage(status.message || 'Access Revoked');
          setAppReady(true); // Don't hang on splash
          SplashScreen.hideAsync().catch(() => { });
          return;
        }
      } catch (e) {
        console.warn('Status check failed, allowing offline mode');
      }

      // 3. Wait for fonts and settings
      if (loaded || error) {
        // HIDE the Expo Static Splash IMMEDIATELY
        // (It's black-on-black, so invisible behind our native splash)
        await SplashScreen.hideAsync().catch(() => { });

        // Native splash auto-dismisses after 2 seconds via Handler.postDelayed
        // React splash is already rendered behind it, so transition is seamless
        
        // Show React splash briefly, then reveal main app
        const timer = setTimeout(() => {
          setAppReady(true);
        }, 800); // Short delay since native splash already showed for 2s
        return () => clearTimeout(timer);
      }
    }
    prepare();
  }, [loaded, error]);

  if (isRevoked) {
    return (
      <View style={styles.revokedContainer}>
        <StatusBar style="light" />
        <LinearGradient colors={['#FF4757', '#000']} style={StyleSheet.absoluteFill} />
        <View style={styles.splashContent}>
          <Text style={styles.revokedTitle}>ACCESS REVOKED</Text>
          <View style={[styles.splashDivider, { backgroundColor: '#fff' }]} />
          <Text style={styles.revokedMsg}>{revokedMessage}</Text>
          <Text style={[styles.splashTagline, { marginTop: 40 }]}>Contact Developer</Text>
        </View>
      </View>
    );
  }

  if (!appReady) {
    const brandName = SONGEET_TRANSLATIONS[displayLang] || 'Songeet';
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="light" />
        <Animated.View entering={FadeIn.duration(800)} exiting={FadeOut.duration(500)} style={styles.splashContent}>
          <Text style={[styles.splashLogo, displayLang !== 'english' && { fontSize: 62, fontFamily: Platform.OS === 'ios' ? 'Kohinoor Devanagari' : 'serif' }]}>
            {brandName}
          </Text>
          <View style={styles.splashDivider} />
          <Text style={styles.splashTagline}>PREMIUM INDIAN MUSIC</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <SettingsProvider>
      <AudioProvider>
        <View style={styles.container}>
          <StatusBar style="dark" />
          <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Theme.colors.background },
            animation: 'fade_from_bottom',
          }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="player" options={{ presentation: 'modal' }} />
            <Stack.Screen name="album/[id]" options={{ headerShown: false, animation: 'fade' }} />
          </Stack>
          <DynamicIsland />
        </View>
      </AudioProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#000', // Premium dark splash
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 52,
    fontFamily: 'Serif',
    color: '#fff',
    letterSpacing: -1,
    fontWeight: '800',
  },
  splashDivider: {
    width: 40,
    height: 3,
    backgroundColor: '#7D8C69', // Theme accent
    marginVertical: 15,
    borderRadius: 2,
  },
  splashTagline: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  revokedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  revokedTitle: {
    fontSize: 28,
    fontFamily: 'Serif',
    color: '#FF4757',
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  revokedMsg: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
    fontWeight: '600',
  }
});
