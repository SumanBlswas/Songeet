import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ViewStyle, TextStyle, ActivityIndicator, Dimensions, Alert, DeviceEventEmitter
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
const AnimatedImage = Animated.createAnimatedComponent(Image) as any;
import { Theme } from '@/constants/Theme';
import { useAudio, Track } from '@/context/AudioContext';
import { useRouter } from 'expo-router';
import { Music, Play, Pause, Search as SearchIcon, Heart, Settings as SettingsIcon, Download, Plus } from 'lucide-react-native';
import { getHomePageData, searchSongs, searchArtists, searchAlbums } from '@/services/saavnService';
import { getDownloadedSongs, deleteDownloadedSong } from '@/services/downloadService';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '@/context/SettingsContext';
import { useNetworkStatus } from '@/services/networkService';
import DeleteModal from '@/components/DeleteModal';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeInRight,
  withTiming,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
type FilterType = 'trending' | 'downloaded';

interface Section {
  title: string;
  subtitle?: string;
  type: 'featured' | 'artist' | 'list' | 'pill' | 'album';
  data: any[];
  accentColor?: string;
  query?: string;
}

function getArtwork(item: any): string {
  if (!item) return '';
  const src = item?.image || item?.album?.image || item?.artwork;
  if (Array.isArray(src)) {
    return (
      src.find((i: any) => i.quality === '500x500')?.link ||
      src.find((i: any) => i.quality === '150x150')?.link ||
      src[src.length - 1]?.link || ''
    );
  }

  if (typeof src === 'string') {
    // Ensure absolute local paths are prefixed correctly for expo-image
    if (src.includes('/data/') && !src.startsWith('http') && !src.startsWith('file://')) {
      return `file://${src}`;
    }
    return src;
  }
  return '';
};

export const getArtist = (item: any): string => {
  if (!item) return 'Unknown Artist';
  const artistSource = item.primaryArtists || item.artists?.primary || item.artists || item.subtitle || item.artist;
  if (Array.isArray(artistSource)) {
    return artistSource.map((a: any) => a.name || a).join(', ');
  }
  if (typeof artistSource === 'string') return artistSource;
  return 'Various Artists';
};

function normaliseSongs(arr: any[] = []): any[] {
  return arr
    .filter(Boolean)
    .map(s => ({ ...s, id: String(s.id || s.songId || '') }))
    .filter(s => s.id);
}

export default function HomeScreen() {
  const { primaryLanguage, isLoading } = useSettings();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useAudio();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('trending');
  const [favAlbums, setFavAlbums] = useState<any[]>([]);
  const [favSongs, setFavSongs] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  // Smart Offline Mode: Force downloaded filter when offline
  useEffect(() => {
    if (!isOnline && activeFilter === 'trending') {
      setActiveFilter('downloaded');
    }
  }, [isOnline, activeFilter]);

  const fetchData = useCallback(async () => {
    if (isLoading) return; // Wait for settings to load from AsyncStorage

    setLoading(true);
    try {
      // Always fetch common vault statistics for the Home Tile Grid
      const [localSongs, favsJson, favSongsJson, playlistsJson] = await Promise.all([
        getDownloadedSongs(),
        AsyncStorage.getItem('favorite_albums'),
        AsyncStorage.getItem('favorite_songs'),
        AsyncStorage.getItem('user_playlists')
      ]);

      const parsedFavAlbums = favsJson ? JSON.parse(favsJson) : [];
      const parsedFavSongs = favSongsJson ? JSON.parse(favSongsJson) : [];
      const userPlaylists = playlistsJson ? JSON.parse(playlistsJson) : [];

      setDownloads(localSongs || []);
      setFavAlbums(parsedFavAlbums);
      setFavSongs(parsedFavSongs);
      setPlaylists(userPlaylists);

      if (activeFilter === 'downloaded') {
        const local = localSongs;

        const parsedFavAlbums = favsJson ? JSON.parse(favsJson) : [];
        const parsedFavSongs = favSongsJson ? JSON.parse(favSongsJson) : [];
        const userPlaylists = playlistsJson ? JSON.parse(playlistsJson) : [];

        setFavAlbums(parsedFavAlbums);
        setFavSongs(parsedFavSongs);
        setDownloads(local || []);
        setPlaylists(userPlaylists);

        const newCollections: Section[] = [];

        if (local && local.length > 0) {
          newCollections.push({
            title: 'Your Downloads',
            subtitle: `${local.length} songs offline`,
            type: 'list',
            data: normaliseSongs(local),
            query: 'local_collection',
          });
        }

        if (parsedFavSongs && parsedFavSongs.length > 0) {
          newCollections.push({
            title: 'Favorite Songs',
            subtitle: `${parsedFavSongs.length} tracks saved`,
            type: 'list',
            data: normaliseSongs(parsedFavSongs),
            query: 'favorite_songs',
          });
        }

        if (parsedFavAlbums && parsedFavAlbums.length > 0) {
          newCollections.push({
            title: 'Favorite Albums',
            subtitle: `${parsedFavAlbums.length} saved`,
            type: 'album',
            data: parsedFavAlbums,
            query: 'favorite_albums',
          });
        }

        setSections(newCollections);
        setLoading(false);
        return;
      }

      const [homeRes, arijitRes, bollywoodRes, chillRes, artistsRes, albumRes] = await Promise.allSettled([
        getHomePageData(primaryLanguage),
        searchSongs('arijit singh', 1, 10),
        searchSongs('new bollywood 2024', 1, 10),
        searchSongs('lofi chill beats', 1, 8),
        searchArtists('playback singer', 1, 10),
        searchAlbums(`latest ${primaryLanguage} albums 2024`, 1, 40),
      ]);

      const home = homeRes.status === 'fulfilled' ? homeRes.value : null;
      const newSections: Section[] = [];

      // ── 1. Featured Trending ──────────────────────────────────────────────
      if (home?.trending?.songs && Array.isArray(home.trending.songs)) {
        newSections.push({
          title: '🔥 Trending Now',
          subtitle: 'What everyone is listening to',
          accentColor: '#FF6B6B',
          type: 'featured',
          data: normaliseSongs(home.trending.songs).slice(0, 10),
          query: 'trending',
        });
      }

      // ── 1.5. Albums (Priority: Search Results [See All sync] -> Filtered Home Modules) ──────────
      const filterAlbums = (list: any[]) => {
        const seenIds = new Set();
        const seenTitles = new Set();
        return (list || []).filter(a => {
          if (!a || !a.id || seenIds.has(a.id)) return false;
          const rawTitle = (a.name || a.title || '').trim();
          const normTitle = rawTitle.toLowerCase().split('(')[0].trim();
          if (seenTitles.has(normTitle)) return false;
          if (a.songCount === '1' || a.songCount === 1 || a.type === 'song') return false;
          if (rawTitle.length < 2 || !a.image) return false;
          seenIds.add(a.id);
          seenTitles.add(normTitle);
          return true;
        });
      };

      // Priority 1: Search results (Sync with "See All")
      let albums = filterAlbums(albumRes.status === 'fulfilled' ? (albumRes.value?.albums || []) : []);

      // Priority 2: Home modules (Supplementary)
      if (albums.length < 10) {
        const homeAlbumsRaw = [...(home?.new_albums?.data || []), ...(home?.trending?.albums || [])];
        const homeAlbums = filterAlbums(homeAlbumsRaw);
        const existingIds = new Set(albums.map(a => a.id));
        const uniqueNew = homeAlbums.filter(a => !existingIds.has(a.id));
        albums = [...albums, ...uniqueNew];
      }

      // Sort by playCount (popularity)
      albums.sort((a, b) => {
        const pA = parseInt(String(a.playCount || '0').replace(/,/g, '')) || 0;
        const pB = parseInt(String(b.playCount || '0').replace(/,/g, '')) || 0;
        return pB - pA;
      });

      // (Calculation done, push moved down)

      // ── 2. Artist Spotlight ── fetch real photos per singer based on language ──────
      const REGIONAL_SPOTLIGHT: Record<string, { name: string; role: string }[]> = {
        english: [
          { name: 'Taylor Swift', role: 'Global Icon' },
          { name: 'Ed Sheeran', role: 'Singer & Songwriter' },
          { name: 'Justin Bieber', role: 'Singer' },
          { name: 'Dua Lipa', role: 'Pop Icon' },
          { name: 'The Weeknd', role: 'Singer' },
        ],
        bengali: [
          { name: 'Arijit Singh', role: 'Playback Singer' },
          { name: 'Shreya Ghoshal', role: 'Playback Singer' },
          { name: 'Anupam Roy', role: 'Singer & Composer' },
          { name: 'Shaan', role: 'Playback Singer' },
          { name: 'Kishore Kumar', role: 'Legendary' },
          { name: 'Manna Dey', role: 'Legendary' },
          { name: 'Hemanta Mukherjee', role: 'Legendary' },
        ],
        punjabi: [
          { name: 'Diljit Dosanjh', role: 'Singer & Actor' },
          { name: 'Sidhu Moose Wala', role: 'Legendary' },
          { name: 'AP Dhillon', role: 'Singer' },
          { name: 'Karan Aujla', role: 'Singer' },
          { name: 'Guru Randhawa', role: 'Singer' },
          { name: 'Ammy Virk', role: 'Singer' },
        ],
        telugu: [
          { name: 'Sid Sriram', role: 'Playback Singer' },
          { name: 'S.P. Balasubrahmanyam', role: 'Legendary' },
          { name: 'Anurag Kulkarni', role: 'Playback Singer' },
          { name: 'Armaan Malik', role: 'Playback Singer' },
          { name: 'Shreya Ghoshal', role: 'Playback Singer' },
        ],
        tamil: [
          { name: 'Anirudh Ravichander', role: 'Composer & Singer' },
          { name: 'A.R. Rahman', role: 'Legendary' },
          { name: 'Sid Sriram', role: 'Playback Singer' },
          { name: 'Yuvan Shankar Raja', role: 'Composer' },
          { name: 'Dhee', role: 'Singer' },
        ],
        bhojpuri: [
          { name: 'Pawan Singh', role: 'Singer & Actor' },
          { name: 'Khesari Lal Yadav', role: 'Singer & Actor' },
          { name: 'Shilpi Raj', role: 'Playback Singer' },
          { name: 'Dinesh Lal Yadav', role: 'Singer & Actor' },
        ],
        marathi: [
          { name: 'Ajay-Atul', role: 'Composers' },
          { name: 'Swapnil Bandodkar', role: 'Singer' },
          { name: 'Adarsh Shinde', role: 'Singer' },
          { name: 'Bela Shende', role: 'Playback Singer' },
        ],
        gujarati: [
          { name: 'Jigardan Gadhavi', role: 'Singer' },
          { name: 'Kinjal Dave', role: 'Singer' },
          { name: 'Geeta Rabari', role: 'Singer' },
          { name: 'Aditya Gadhvi', role: 'Singer' },
        ],
        haryanvi: [
          { name: 'Gulzaar Chhaniwala', role: 'Singer' },
          { name: 'Sumit Goswami', role: 'Singer' },
          { name: 'Renuka Panwar', role: 'Singer' },
          { name: 'Masoom Sharma', role: 'Singer' },
        ],
        rajasthani: [
          { name: 'Mame Khan', role: 'Folk Singer' },
          { name: 'Swaroop Khan', role: 'Singer' },
          { name: 'Seema Mishra', role: 'Folk Singer' },
        ],
        odia: [
          { name: 'Humane Sagar', role: 'Playback Singer' },
          { name: 'Ananya Sritam Nanda', role: 'Singer' },
          { name: 'Asima Panda', role: 'Playback Singer' },
        ],
        assamese: [
          { name: 'Zubeen Garg', role: 'Legendary' },
          { name: 'Papon', role: 'Singer' },
          { name: 'Kalpana Patowary', role: 'Singer' },
        ],
      };

      const defaultSingers = [
        { name: 'Arijit Singh', role: 'Playback Singer' },
        { name: 'Shreya Ghoshal', role: 'Playback Singer' },
        { name: 'Sonu Nigam', role: 'Playback Singer' },
        { name: 'Jubin Nautiyal', role: 'Playback Singer' },
        { name: 'Neha Kakkar', role: 'Playback Singer' },
        { name: 'Pritam', role: 'Composer' },
      ];

      const famousSingers = REGIONAL_SPOTLIGHT[primaryLanguage] || defaultSingers;

      const artistResults = await Promise.allSettled(
        famousSingers.map(s =>
          fetch(`https://suman-api.vercel.app/search/artists?query=${encodeURIComponent(s.name)}&limit=1`)
            .then(r => r.json())
            .then(json => {
              const result = json?.data?.results?.[0];
              return result
                ? { ...s, id: result.id, image: result.image }
                : { ...s, id: s.name };
            })
            .catch(() => ({ ...s, id: s.name }))
        )
      );

      const artistData = artistResults.map((r, i) =>
        r.status === 'fulfilled' ? r.value : { ...famousSingers[i], id: famousSingers[i].name }
      );

      newSections.push({
        title: '🎤 Artist Spotlight',
        subtitle: `Top ${primaryLanguage.charAt(0).toUpperCase() + primaryLanguage.slice(1)} singers`,
        accentColor: '#7D8C69',
        type: 'artist',
        data: artistData,
        query: `${primaryLanguage} artists`,
      });

      // ── 3. Top Charts ─────────────────────────────────────────────────────
      if (Array.isArray(home?.charts)) {
        const chart = home.charts.find((c: any) => Array.isArray(c.data));
        if (chart?.data) {
          newSections.push({
            title: '🏆 Top Charts',
            subtitle: chart.title || 'Billboard India',
            accentColor: '#FFD700',
            type: 'list',
            data: normaliseSongs(chart.data).slice(0, 6),
            query: 'top charts',
          });
        }
      }

      // ── 4. Arijit Singh / Shreya Ghoshal Fallback ──────────────────────────
      let specificSingerSongs = arijitRes.status === 'fulfilled' ? arijitRes.value?.songs : [];
      let singerName = 'Arijit Singh';
      let singerEmoji = '💔';

      // If playing non-Hindi/Bengali, or low results, try matching language
      const localizedArijit = await searchSongs(`arijit singh ${primaryLanguage} hits`, 1, 8);

      if (localizedArijit?.songs && localizedArijit.songs.length >= 3) {
        specificSingerSongs = localizedArijit.songs;
      } else {
        // Fallback to Shreya Ghoshal
        const shreyaSongs = await searchSongs(`shreya ghoshal ${primaryLanguage} hits`, 1, 8);
        if (shreyaSongs?.songs && shreyaSongs.songs.length >= 3) {
          specificSingerSongs = shreyaSongs.songs;
          singerName = 'Shreya Ghoshal';
          singerEmoji = '✨';
        } else {
          // Both failed for this language, maybe it's too obscure
          specificSingerSongs = [];
        }
      }

      if (specificSingerSongs && specificSingerSongs.length > 0) {
        newSections.push({
          title: `${singerEmoji} ${singerName} Hits`,
          subtitle: `Best of ${singerName} in ${primaryLanguage}`,
          accentColor: '#E88CAE',
          type: 'featured',
          data: normaliseSongs(specificSingerSongs).slice(0, 8),
          query: `${singerName} ${primaryLanguage} best`,
        });
      }

      // ── 5. New Albums (Moved here to be before New Release) ──────────────────
      if (albums && albums.length > 0) {
        newSections.push({
          title: 'Albums',
          subtitle: `Curated ${primaryLanguage} collections`,
          accentColor: '#457B9D',
          type: 'album',
          data: albums.slice(0, 10),
          query: `latest ${primaryLanguage} albums 2024`,
        });
      }

      // ── 5. Regional Branding (New Bollywood/Tollywowd/Pollywood) ──────────────
      const REGIONAL_BRAND: Record<string, string> = {
        hindi: '🎬 New Bollywood',
        bengali: '🍿 New Tollywowd',
        punjabi: '🚜 New Pollywood',
        telugu: '🌟 New Tollywood',
        tamil: '🎙️ New Kollywood',
        bhojpuri: '🎥 New Bhojiwood',
        marathi: '🏰 New Marathi',
        gujarati: '💎 New Gujarati',
        odia: '🌊 New Ollywood',
        assamese: '🍵 New Assamese',
      };

      const branding = REGIONAL_BRAND[primaryLanguage] || '🎵 New Releases';
      const regionalSearch = await searchSongs(`latest ${primaryLanguage} songs 2024`, 1, 10);
      const regionalSongs = regionalSearch?.songs || [];

      if (regionalSongs.length > 0) {
        newSections.push({
          title: branding,
          subtitle: `Latest ${primaryLanguage} releases`,
          accentColor: '#F4A261',
          type: 'list',
          data: normaliseSongs(regionalSongs).slice(0, 6),
          query: `latest ${primaryLanguage} songs`,
        });
      }

      // ── 6. Chill Vibes ────────────────────────────────────────────────────
      const chillResLocalized = await searchSongs(`lofi chill beats`, 1, 8);
      const chillSongs = chillResLocalized?.songs || [];
      if (chillSongs.length > 0) {
        newSections.push({
          title: '😌 Chill Vibes',
          subtitle: `Lofi & easy listening`,
          accentColor: '#A2C4C9',
          type: 'pill',
          data: normaliseSongs(chillSongs).slice(0, 10),
          query: `chill lofi`,
        });
      }

      setSections(newSections);
    } catch (err) {
      console.error('Home fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, primaryLanguage, isLoading]);

  useEffect(() => {
    fetchData();

    // Vault refresh listeners
    const dSub = DeviceEventEmitter.addListener('download_completed', () => fetchData());
    const pSub = DeviceEventEmitter.addListener('playlist_updated', () => fetchData());
    const fSub = DeviceEventEmitter.addListener('favorite_updated', () => fetchData());

    return () => {
      dSub.remove();
      pSub.remove();
      fSub.remove();
    };
  }, [fetchData]);

  const handleLongPress = useCallback((item: any) => {
    if (item.localPath || activeFilter === 'downloaded') {
      setItemToDelete(item);
      setDeleteModalVisible(true);
    }
  }, [activeFilter]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDownloadedSong(itemToDelete.id);
      setDeleteModalVisible(false);
      setItemToDelete(null);
      if (activeFilter === 'downloaded') {
        fetchData();
      }
    } catch (e) {
      console.error("Failed to delete song:", e);
      Alert.alert("Error", "Could not delete the song.");
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setItemToDelete(null);
  };

  const renderLibraryDashboard = () => {
    const downloads = sections.find(s => s.query === 'local_collection')?.data || [];
    const favSongs = sections.find(s => s.query === 'favorite_songs')?.data || [];
    const favAlbums = sections.find(s => s.query === 'favorite_albums')?.data || [];

    // Calculate Downloaded Albums count
    const downloadedAlbums = downloads.reduce((acc: any[], current: any) => {
      if (current.collectionType === 'album' && current.collectionId) {
        if (!acc.some(a => a.id === current.collectionId)) {
          acc.push({ id: current.collectionId, name: current.collectionName });
        }
      }
      return acc;
    }, []);

    const totalPlaylistTracks = playlists.reduce((acc: number, p: any) => acc + (p.songs?.length || 0), 0);
    const totalAlbumTracks = favAlbums.reduce((acc: number, a: any) => {
      const count = a.songCount || a.songs?.length || 1;
      return acc + Number(count);
    }, 0);
    if (downloads.length === 0 && favSongs.length === 0 && favAlbums.length === 0) {
      return (
        <View style={styles.empty}>
          <Music size={52} color={Theme.colors.accent} opacity={0.3} />
          <Text style={styles.emptyText}>Empty Library</Text>
          <Text style={{ color: Theme.colors.textMuted, fontSize: 13, marginTop: 12, textAlign: 'center', opacity: 0.7 }}>Collect music to unlock the vault.</Text>
        </View>
      );
    }

    return (
      <Animated.View entering={FadeIn.duration(500)} style={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        {/* ── Music Vault: Header ── */}
        <View style={{ marginBottom: 24, paddingHorizontal: 4 }}>
          <Text style={styles.vaultTitle}>Music Vault</Text>
          <View style={styles.vaultLine} />
        </View>

        {/* ── 2x2 Strategic Grid ── */}
        <View style={styles.vaultGrid2x2}>
          {/* Row 1 */}
          <View style={styles.vaultRow}>
            <Pressable
              style={[styles.vaultTile, { backgroundColor: '#F9F6EE', height: 140 }]}
              onPress={() => router.push({ pathname: '/section/[id]', params: { id: 'favorite_songs', title: 'Loved Tracks', query: 'favorite_songs' } })}
            >
              <Heart size={24} color={Theme.colors.text} fill={Theme.colors.text} />
              <View>
                <Text style={styles.vaultTileLabel}>Loved</Text>
                <Text style={styles.vaultTileCount}>{favSongs.length} tracks</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.vaultTile, { backgroundColor: '#EBF5E1', height: 140 }]}
              onPress={() => router.push({ pathname: '/section/[id]', params: { id: 'local_collection', title: 'Offline Vault', query: 'local_collection' } })}
            >
              <Download size={24} color={Theme.colors.text} />
              <View>
                <Text style={styles.vaultTileLabel}>Offline</Text>
                <Text style={styles.vaultTileCount}>{downloads.length} {downloads.length === 1 ? 'track' : 'tracks'}</Text>
              </View>
            </Pressable>
          </View>

          {/* Row 2 */}
          <View style={[styles.vaultRow, { marginTop: 14 }]}>
            <Pressable
              style={[styles.vaultTile, { backgroundColor: '#E1F2F9', height: 140 }]}
              onPress={() => router.push({ pathname: '/section/[id]', params: { id: 'favorite_albums', title: 'Saved Albums', query: 'favorite_albums', isAlbum: 'true' } })}
            >
              <Music size={24} color={Theme.colors.text} />
              <View>
                <Text style={styles.vaultTileLabel}>Albums</Text>
                <Text style={styles.vaultTileCount}>{totalAlbumTracks} {totalAlbumTracks === 1 ? 'track' : 'tracks'}</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.vaultTile, { backgroundColor: '#F9EBEB', height: 140 }]}
              onPress={() => router.push({ pathname: '/section/[id]', params: { id: 'user_playlists', title: 'Playlists', query: 'user_playlists' } })}
            >
              <Plus size={24} color={Theme.colors.text} />
              <View>
                <Text style={styles.vaultTileLabel}>Playlists</Text>
                <Text style={styles.vaultTileCount}>{totalPlaylistTracks} {totalPlaylistTracks === 1 ? 'track' : 'tracks'}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Global Intelligent Actions ── */}
        <View style={{ marginTop: 32, paddingHorizontal: 4 }}>
          <Pressable
            style={styles.vaultShuffle}
            onPress={() => {
              const all = [...downloads, ...favSongs];
              if (all.length > 0) {
                const shuffled = [...all].sort(() => Math.random() - 0.5);
                playTrack(shuffled[0], shuffled);
                router.push('/player');
              }
            }}
          >
            <LinearGradient colors={[Theme.colors.text, '#333']} style={StyleSheet.absoluteFill} />
            <Play size={18} color="#fff" fill="#fff" />
            <Text style={styles.vaultShuffleText}>SHUFFLE ENTIRE COLLECTION</Text>
          </Pressable>
        </View>

        {/* ── Quick Pulse (Intelligence) ── */}
        {downloads.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <View style={{ marginBottom: 16, paddingHorizontal: 4 }}>
              <Text style={[styles.vaultSubTitle, { fontSize: 16 }]}>Recent in Vault</Text>
            </View>
            <View style={{ gap: 8 }}>
              {downloads.slice(0, 2).map((item, i) => (
                <MemoizedListItem key={item.id} item={item} index={i} sectionData={downloads} accent={Theme.colors.accent} isActive={currentTrack?.id === item.id} isPlaying={isPlaying} onPlay={playTrack} onLongPress={handleLongPress} />
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderSection = React.useCallback((section: Section, sIdx: number) => {
    const accent = section.accentColor || Theme.colors.accent;
    return (
      <Animated.View key={sIdx} entering={FadeInDown.delay(sIdx * 100).duration(400)} style={styles.section}>
        <View style={styles.secHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.secTitle}>{section.title}</Text>
            {section.subtitle ? <Text style={styles.secSub}>{section.subtitle}</Text> : null}
          </View>
          <Pressable
            style={[styles.seeAllBtn, { borderColor: accent + '40', backgroundColor: accent + '12' }]}
            onPress={() => router.push({
              pathname: '/section/[id]',
              params: {
                id: section.query || section.title,
                title: section.title,
                query: section.query || section.title,
                accent: accent,
                isArtist: section.type === 'artist' ? 'true' : 'false',
                isAlbum: section.type === 'album' ? 'true' : 'false',
                lang: primaryLanguage
              }
            })}
          >
            <Text style={[styles.seeAllText, { color: accent }]}>See all</Text>
          </Pressable>
        </View>

        {section.type === 'featured' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} style={{ overflow: 'visible' }}>
            {section.data.map((item, i) => (
              <MemoizedFeaturedCard key={item.id} item={item} index={i} sectionData={section.data} accent={accent} isActive={currentTrack?.id === item.id} isPlaying={isPlaying} onPlay={playTrack} onLongPress={handleLongPress} />
            ))}
          </ScrollView>
        )}

        {section.type === 'artist' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} style={{ overflow: 'visible' }}>
            {section.data.map((item: any, i: number) => (
              <MemoizedArtistCard key={item.id} item={item} index={i} />
            ))}
          </ScrollView>
        )}

        {section.type === 'list' && (
          <View style={styles.listContainer}>
            {section.data.map((item, i) => (
              <MemoizedListItem key={item.id} item={item} index={i} sectionData={section.data} accent={accent} isActive={currentTrack?.id === item.id} isPlaying={isPlaying} onPlay={playTrack} onLongPress={handleLongPress} />
            ))}
          </View>
        )}

        {section.type === 'pill' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} style={{ overflow: 'visible' }}>
            {section.data.map((item, i) => (
              <MemoizedPillItem key={item.id} item={item} index={i} sectionData={section.data} isActive={currentTrack?.id === item.id} isPlaying={isPlaying} onPlay={playTrack} onLongPress={handleLongPress} />
            ))}
          </ScrollView>
        )}

        {section.type === 'album' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} style={{ overflow: 'visible' }}>
            {section.data.map((item, i) => (
              <MemoizedAlbumCard key={item.id} item={item} index={i} />
            ))}
          </ScrollView>
        )}
      </Animated.View>
    );
  }, [currentTrack?.id, isPlaying, playTrack, handleLongPress, primaryLanguage]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#DAD7CD20', Theme.colors.background, Theme.colors.background]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />

      {/* ─── Glassy Header ─── */}
      <BlurView intensity={30} style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Evening 👋</Text>
          <Text style={styles.appName}>Songeet</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={styles.searchBtn} hitSlop={12} onPress={() => router.push('/search')}>
            <SearchIcon size={20} color={Theme.colors.text} />
          </Pressable>
        </View>
      </BlurView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 148 }}>
        {/* Filter pills */}
        <View style={[styles.filterRow, { alignItems: 'center' }]}>
          {(['trending', 'downloaded'] as FilterType[]).map(f => {
            // Hide Trending/Explore chip when offline
            if (f === 'trending' && !isOnline) return null;

            return (
              <Pressable key={f} style={[styles.chip, activeFilter === f && styles.chipActive]} onPress={() => setActiveFilter(f)}>
                <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>
                  {f === 'trending' ? '✦  EXPLORE' : '↓  COLLECTION'}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.chip, { marginLeft: 'auto', marginRight: 0, paddingHorizontal: 12, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }]}
            onPress={() => router.push('/settings')}
          >
            <SettingsIcon size={16} color={Theme.colors.textMuted} />
          </Pressable>
        </View>

        {loading
          ? <ActivityIndicator size="large" color={Theme.colors.accent} style={{ marginTop: 120 }} />
          : activeFilter === 'downloaded'
            ? renderLibraryDashboard()
            : sections.length === 0
              ? <View style={styles.empty}><Music size={52} color={Theme.colors.textMuted} opacity={0.25} /><Text style={styles.emptyText}>Nothing here yet</Text></View>
              : sections.map((s, i) => renderSection(s, i))}
      </ScrollView>

      {/* ─── Premium Mini Player ─── */}
      {currentTrack && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.playerWrap}>
          <BlurView intensity={85} tint="dark" experimentalBlurMethod="dimezisBlurView" style={styles.playerBlur}>
            <Pressable style={styles.playerInner} onPress={() => router.push('/player')}>
              <Image source={{ uri: currentTrack.artwork }} style={styles.miniArt} contentFit="cover" />
              <LinearGradient colors={['transparent', Theme.colors.accent + '33', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={{ flex: 1, paddingHorizontal: 16 }}>
                <Text style={styles.miniTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.miniSub} numberOfLines={1}>{currentTrack.artist}</Text>
              </View>
              <Pressable onPress={e => { e.stopPropagation(); togglePlayPause(); }} style={styles.miniPlay}>
                {isPlaying
                  ? <Pause size={24} color={Theme.colors.background} fill={Theme.colors.background} />
                  : <Play size={24} color={Theme.colors.background} fill={Theme.colors.background} style={{ marginLeft: 2 }} />}
              </Pressable>
            </Pressable>
          </BlurView>

        </Animated.View>
      )}
      <DeleteModal
        visible={deleteModalVisible}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        itemName={itemToDelete?.name || itemToDelete?.title || 'this song'}
        itemImage={getArtwork(itemToDelete)}
      />
    </View>
  );
}

const CARD_W = Math.round(width * 0.62);

// ─── Memoized Renderers to prevent re-animation on state changes ───────────

const MemoizedFeaturedCard = React.memo(({ item, index, sectionData, accent, isActive, isPlaying, onPlay, onLongPress }: any) => {
  const router = useRouter();
  const artwork = getArtwork(item);
  const artist = getArtist(item);
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();

  return (
    <Animated.View entering={FadeInRight.delay(index * 75).duration(350)}>
      <Pressable
        style={styles.featCard}
        onPress={() => { onPlay(item, sectionData); router.push('/player'); }}
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={350}
      >
        <Image source={{ uri: artwork }} style={styles.featImg} contentFit="cover" />
        <LinearGradient
          colors={['transparent', `${accent}cc`, 'rgba(0,0,0,0.88)']}
          locations={[0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
        {isActive && isPlaying && (
          <View style={[styles.liveChip, { backgroundColor: accent }]}>
            <Music size={9} color="#fff" />
            <Text style={styles.liveText}>NOW</Text>
          </View>
        )}
        <View style={styles.featInfo}>
          <Text style={styles.featTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.featArtist} numberOfLines={1}>{artist}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.isActive === next.isActive &&
  (prev.isActive ? prev.isPlaying === next.isPlaying : true) &&
  prev.onLongPress === next.onLongPress
);

// ─── Memoized Album Card (Super Fresh Floating Design) ───
const MemoizedAlbumCard = React.memo(({ item, index }: any) => {
  const router = useRouter();
  const artwork = getArtwork(item);
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();
  const artist = getArtist(item);

  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(400)}>
      <Pressable
        style={styles.albumCard}
        onPress={() => router.push({
          pathname: '/album/[id]',
          params: { id: item.id, name: title }
        })}
      >
        <AnimatedImage
          sharedTransitionTag={`album-art-${item.id}`}
          source={{ uri: artwork }}
          style={styles.albumImg}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
          style={styles.albumOverlay}
        />
        <View style={styles.albumInfo}>
          <Text style={styles.albumTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.albumSub} numberOfLines={1}>{artist}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const MemoizedArtistCard = React.memo(({ item, index }: any) => {
  const router = useRouter();
  const artwork = getArtwork(item);
  const name = item.name || item.title || '?';
  const role = item.role || 'Artist';

  return (
    <Animated.View entering={FadeInRight.delay(index * 80).duration(350)}>
      <Pressable
        style={styles.artistCard}
        onPress={() => router.push({
          pathname: '/artist/[id]',
          params: {
            id: item.id || item.name,
            name: name,
            role: role,
            image: encodeURIComponent(artwork),
          },
        })}
      >
        <View style={styles.artistAvatarWrap}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.artistAvatar} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#7D8C69', '#344E41']}
              style={[styles.artistAvatar, styles.artistAvatarFallback]}
            >
              <Text style={styles.artistInitial}>{name[0]?.toUpperCase()}</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={styles.artistAvatarOverlay}
          />
        </View>
        <Text style={styles.artistName} numberOfLines={1}>{name}</Text>
        <Text style={styles.artistRole} numberOfLines={1}>{role}</Text>
      </Pressable>
    </Animated.View>
  );
}, (prev, next) => prev.item.id === next.item.id);

const MemoizedListItem = React.memo(({ item, index, sectionData, accent, isActive, isPlaying, onPlay, onLongPress }: any) => {
  const artwork = getArtwork(item);
  const artist = getArtist(item);
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        style={[styles.listItem, isActive && { borderColor: accent + '80', borderWidth: 1.5 }]}
        onPress={() => onPlay(item, sectionData)}
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={350}
      >
        <Text style={[styles.listRank, { color: accent }]}>{String(index + 1).padStart(2, '0')}</Text>
        <View style={styles.listImgWrap}>
          <Image source={{ uri: artwork }} style={styles.listImg} contentFit="cover" />
          {isActive && <View style={[styles.listImgOverlay, { backgroundColor: accent + '99' }]}><Play size={14} color="#fff" fill="#fff" /></View>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.listTitle, isActive && { color: accent }]} numberOfLines={1}>{title}</Text>
          <Text style={styles.listArtist} numberOfLines={1}>{artist}</Text>
        </View>
        <View style={[styles.listPlayBtn, { backgroundColor: isActive ? accent : accent + '18' }]}>
          {isPlaying && isActive
            ? <Pause size={14} color={isActive ? '#fff' : accent} fill={isActive ? '#fff' : accent} />
            : <Play size={14} color={isActive ? '#fff' : accent} fill={isActive ? '#fff' : accent} style={{ marginLeft: 1 }} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.isActive === next.isActive &&
  (prev.isActive ? prev.isPlaying === next.isPlaying : true) &&
  prev.onLongPress === next.onLongPress
);

const MemoizedPillItem = React.memo(({ item, index, sectionData, isActive, isPlaying, onPlay, onLongPress }: any) => {
  const router = useRouter();
  const artwork = getArtwork(item);
  const title = (item.name || item.title || '?').split('(')[0].trim();

  return (
    <Animated.View entering={FadeInRight.delay(index * 65).duration(300)}>
      <Pressable
        style={styles.pillCard}
        onPress={() => { onPlay(item, sectionData); router.push('/player'); }}
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={350}
      >
        <View style={[styles.pillImgWrap, isActive && styles.pillImgWrapActive]}>
          <Image source={{ uri: artwork }} style={styles.pillImg} contentFit="cover" />
          {isActive && isPlaying && (
            <View style={styles.pillPlayOverlay}><Music size={16} color="#fff" /></View>
          )}
        </View>
        <Text style={styles.pillTitle} numberOfLines={2}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.isActive === next.isActive &&
  (prev.isActive ? prev.isPlaying === next.isPlaying : true) &&
  prev.onLongPress === next.onLongPress
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.background } as ViewStyle,

  // Header
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 } as ViewStyle,
  greeting: { fontSize: 12, color: Theme.colors.textMuted, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' } as TextStyle,
  appName: { fontSize: 34, fontWeight: '800', color: Theme.colors.text, letterSpacing: -1.5, marginTop: 1 } as TextStyle,
  searchBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: Theme.colors.white, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 } as ViewStyle,

  // Filter
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 22, marginBottom: 30 } as ViewStyle,
  chip: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, marginRight: 12, backgroundColor: 'transparent', borderWidth: 1, borderColor: Theme.colors.textMuted } as ViewStyle,
  chipActive: { backgroundColor: Theme.colors.text, borderColor: Theme.colors.text } as ViewStyle,
  chipText: { fontSize: 13, fontWeight: '800', color: Theme.colors.textMuted, letterSpacing: 0.5 } as TextStyle,
  chipTextActive: { color: Theme.colors.background } as TextStyle,

  // Section
  section: { marginBottom: 40 } as ViewStyle,
  secHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 18 } as ViewStyle,
  secTitle: { fontSize: 20, fontWeight: '800', color: Theme.colors.text, letterSpacing: -0.4 } as TextStyle,
  secSub: { fontSize: 12, color: Theme.colors.textMuted, marginTop: 3, fontWeight: '500' } as TextStyle,
  seeAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, marginLeft: 10 } as ViewStyle,
  seeAllText: { fontSize: 12, fontWeight: '700' } as TextStyle,
  hScroll: { paddingHorizontal: 18, paddingVertical: 12 } as ViewStyle,

  // Featured cards
  featCard: { width: CARD_W, height: Math.round(CARD_W * 1.3), borderRadius: 26, overflow: 'hidden', marginHorizontal: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 18, backgroundColor: '#ddd' } as ViewStyle,
  featImg: { width: '100%', height: '100%' },
  featInfo: { position: 'absolute', bottom: 22, left: 18, right: 18 } as ViewStyle,
  featTitle: { color: '#fff', fontSize: 19, fontWeight: '800', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 } as TextStyle,
  featArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' } as TextStyle,
  liveChip: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 } as ViewStyle,
  liveText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 } as TextStyle,

  // Artist section
  artistCard: { width: 110, marginHorizontal: 8, alignItems: 'center' } as ViewStyle,
  artistAvatarWrap: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, marginBottom: 10, backgroundColor: '#ddd' } as ViewStyle,
  artistAvatar: { width: '100%', height: '100%' },
  artistAvatarFallback: { justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  artistAvatarOverlay: { ...StyleSheet.absoluteFillObject } as ViewStyle,
  artistInitial: { fontSize: 36, fontWeight: '800', color: '#fff' } as TextStyle,
  artistName: { fontSize: 13, fontWeight: '700', color: Theme.colors.text, textAlign: 'center' } as TextStyle,
  artistRole: { fontSize: 10, fontWeight: '500', color: Theme.colors.textMuted, textAlign: 'center', marginTop: 2 } as TextStyle,

  // List
  listContainer: { paddingHorizontal: 20 } as ViewStyle,
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.white, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 } as ViewStyle,
  listRank: { width: 30, fontSize: 14, fontWeight: '800', opacity: 0.6 } as TextStyle,
  listImgWrap: { position: 'relative', marginRight: 13 } as ViewStyle,
  listImg: { width: 52, height: 52, borderRadius: 13 } as any,
  listImgOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 13, justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  listTitle: { fontSize: 15, fontWeight: '700', color: Theme.colors.text } as TextStyle,
  listArtist: { fontSize: 12, color: Theme.colors.textMuted, marginTop: 2, fontWeight: '500' } as TextStyle,
  listPlayBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 8 } as ViewStyle,

  // Pill
  pillCard: { width: 128, marginHorizontal: 7 } as ViewStyle,
  pillImgWrap: { width: 128, height: 128, borderRadius: 20, overflow: 'hidden', marginBottom: 9, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, backgroundColor: '#ddd' } as ViewStyle,
  pillImgWrapActive: { borderWidth: 2.5, borderColor: Theme.colors.accent } as ViewStyle,
  pillImg: { width: '100%', height: '100%' } as any,
  pillPlayOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  pillTitle: { fontSize: 12, fontWeight: '700', color: Theme.colors.text, lineHeight: 17 } as TextStyle,

  // Mini Player
  playerWrap: { position: 'absolute', bottom: 26, left: 16, right: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24 } as ViewStyle,
  playerBlur: { borderRadius: 34, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' } as ViewStyle,
  playerInner: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingRight: 14 } as ViewStyle,
  miniArt: { width: 54, height: 54, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)' } as any,
  miniTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginBottom: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as TextStyle,
  miniSub: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6 } as TextStyle,
  miniPlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.text,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  } as ViewStyle,

  // Album Card (Super Fresh Redesign)
  albumCard: {
    width: 154,
    height: 200,
    marginHorizontal: 7,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#222',
  } as ViewStyle,
  albumImg: {
    width: '100%',
    height: '100%',
  } as any,
  albumOverlay: {
    ...StyleSheet.absoluteFillObject,
  } as ViewStyle,
  albumInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingBottom: 16,
  } as ViewStyle,
  albumTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: -0.3,
  } as TextStyle,
  albumSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,

  // Music Vault Redesign (Technical & Intelligent)
  vaultTitle: { fontSize: 26, fontWeight: '900', color: Theme.colors.text, textTransform: 'uppercase', letterSpacing: 1.5 } as TextStyle,
  vaultLine: { width: 40, height: 4, backgroundColor: Theme.colors.accent, borderRadius: 2, marginTop: 4 } as ViewStyle,
  vaultGrid2x2: { paddingHorizontal: 4 } as ViewStyle,
  vaultRow: { flexDirection: 'row', gap: 14 } as ViewStyle,
  vaultTile: { flex: 1, borderRadius: 28, padding: 24, justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, overflow: 'hidden' } as ViewStyle,
  vaultTileLabel: { fontSize: 16, fontWeight: '900', color: Theme.colors.text, marginBottom: 2 } as TextStyle,
  vaultTileCount: { fontSize: 11, fontWeight: '800', color: Theme.colors.text, opacity: 0.5, textTransform: 'uppercase' } as TextStyle,
  vaultShuffle: { height: 60, borderRadius: 30, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15 } as ViewStyle,
  vaultShuffleText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 } as TextStyle,
  vaultSubTitle: { fontSize: 18, fontWeight: '900', color: Theme.colors.text, letterSpacing: -0.5 } as TextStyle,

  // Empty
  empty: { alignItems: 'center', marginTop: 130 } as ViewStyle,
  emptyText: { marginTop: 16, color: Theme.colors.textMuted, fontSize: 16, textAlign: 'center', fontWeight: '700' } as TextStyle,
});
