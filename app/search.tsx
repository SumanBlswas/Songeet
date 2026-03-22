import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, FlatList,
  ViewStyle, TextStyle, ActivityIndicator, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Search, X, Play, ChevronDown, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Alert } from 'react-native';
import { Theme } from '@/constants/Theme';
import { useAudio } from '@/context/AudioContext';
import { searchSongs } from '@/services/saavnService';
import PlaylistModal from '@/components/PlaylistModal';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

function getArtwork(item: any): string {
  const src = item?.image || item?.album?.image;
  if (Array.isArray(src)) {
    return src.find((i: any) => i.quality === '500x500')?.link || src[src.length - 1]?.link || '';
  }
  return typeof src === 'string' ? src : '';
}

function getArtist(item: any): string {
  const src = item?.primaryArtists || item?.subtitle;
  if (Array.isArray(src)) return src.map((a: any) => a.name || a).join(', ');
  if (typeof src === 'string') return src;
  return 'Various Artists';
}

const PAGE_SIZE = 20;

export default function SearchScreen() {
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [songToAdd, setSongToAdd] = useState<any>(null);

  const openPlaylistModal = (song: any) => {
    setSongToAdd(song);
    setPlaylistModalVisible(true);
  };

  const doSearch = useCallback(async (q: string, pageNum = 1, append = false) => {
    if (!q.trim()) return;
    Keyboard.dismiss();

    if (append) setLoadingMore(true);
    else { setLoading(true); setSongs([]); }

    try {
      const res = await searchSongs(q.trim(), pageNum, PAGE_SIZE);
      const normalised = (res?.songs || []).map((s: any) => ({ ...s, id: String(s.id) }));
      setSongs(prev => append ? [...prev, ...normalised] : normalised);
      setTotal(res?.total || 0);
      setSearched(true);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleSelectPlaylist = async (playlistId: string) => {
    const playlistsJson = await AsyncStorage.getItem('user_playlists');
    const playlists = playlistsJson ? JSON.parse(playlistsJson) : [];
    const p = playlists.find((pl: any) => pl.id === playlistId);

    if (p && songToAdd) {
      p.songs = p.songs || [];
      if (p.songs.find((s: any) => s.id === songToAdd.id)) {
        Alert.alert('Info', 'Song already in playlist');
        return;
      }
      // Automate artwork if first song
      if (!p.image) {
        p.image = getArtwork(songToAdd);
      }
      p.songs.push(songToAdd);
      await AsyncStorage.setItem('user_playlists', JSON.stringify(playlists));
      DeviceEventEmitter.emit('playlist_updated');
      setPlaylistModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCreatePlaylist = async (name: string) => {
    if (!songToAdd) return;
    const playlistsJson = await AsyncStorage.getItem('user_playlists');
    const playlists = playlistsJson ? JSON.parse(playlistsJson) : [];

    const newP = {
      id: Date.now().toString(),
      name,
      songs: [songToAdd],
      image: getArtwork(songToAdd) // First song artwork
    };

    playlists.push(newP);
    await AsyncStorage.setItem('user_playlists', JSON.stringify(playlists));
    DeviceEventEmitter.emit('playlist_updated');
    setPlaylistModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const loadMore = useCallback(() => {
    if (loadingMore || loading || songs.length >= total) return;
    const next = page + 1;
    setPage(next);
    doSearch(query, next, true);
  }, [loadingMore, loading, songs.length, total, page, query, doSearch]);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const artwork = getArtwork(item);
    const artist = getArtist(item);
    const title = (item.name || item.title || 'Untitled').split('(')[0].trim();
    const isActive = currentTrack?.id === item.id;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index % PAGE_SIZE, 10) * 40).duration(300)}>
        <Pressable
          style={[styles.resultItem, isActive && styles.resultItemActive]}
          onPress={() => { playTrack(item as any, songs as any); router.push('/player'); }}
        >
          <Image source={{ uri: artwork }} style={styles.resultArt} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.resultTitle, isActive && { color: Theme.colors.accent }]} numberOfLines={1}>{title}</Text>
            <Text style={styles.resultArtist} numberOfLines={1}>{artist}</Text>
          </View>
          <Pressable
            style={styles.plusBtn}
            onPress={(e) => {
              e.stopPropagation();
              openPlaylistModal(item);
            }}
          >
            <Plus size={20} color={Theme.colors.accent} />
          </Pressable>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[Theme.colors.accentLight + '18', Theme.colors.background]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <ChevronDown size={26} color={Theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search box */}
      <View style={styles.searchBox}>
        <Search size={18} color={Theme.colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.input}
          placeholder="Songs, artists, albums…"
          placeholderTextColor={Theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => { setPage(1); doSearch(query); }}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setSongs([]); setSearched(false); }} hitSlop={8}>
            <X size={18} color={Theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.accent} style={{ marginTop: 80 }} />
      ) : searched && songs.length === 0 ? (
        <View style={styles.empty}>
          <Search size={48} color={Theme.colors.textMuted} opacity={0.25} />
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      ) : !searched ? (
        <View style={styles.empty}>
          <Search size={52} color={Theme.colors.textMuted} opacity={0.15} />
          <Text style={styles.emptyText}>Search for your favourite songs</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>{total.toLocaleString()} results</Text>
          <FlatList
            data={songs}
            renderItem={renderItem}
            keyExtractor={(item, i) => `${item.id}-${i}`}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={loadingMore ? (
              <ActivityIndicator size="small" color={Theme.colors.accent} style={{ padding: 20 }} />
            ) : null}
            contentContainerStyle={{ paddingBottom: 60 }}
          />
        </>
      )}

      <PlaylistModal
        visible={playlistModalVisible}
        onClose={() => setPlaylistModalVisible(false)}
        onSelect={handleSelectPlaylist}
        onCreateNew={handleCreatePlaylist}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.background } as ViewStyle,

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 } as ViewStyle,
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.colors.white, justifyContent: 'center', alignItems: 'center', marginRight: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 } as ViewStyle,
  headerTitle: { fontSize: 28, fontWeight: '800', color: Theme.colors.text, letterSpacing: -0.8 } as TextStyle,

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Theme.colors.white,
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 6,
    borderWidth: 1.5, borderColor: Theme.colors.border,
  } as ViewStyle,
  input: { flex: 1, fontSize: 16, color: Theme.colors.text, fontWeight: '500' } as TextStyle,

  resultCount: { fontSize: 13, color: Theme.colors.textMuted, fontWeight: '600', paddingHorizontal: 20, paddingVertical: 10 } as TextStyle,

  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 11,
    backgroundColor: Theme.colors.background,
  } as ViewStyle,
  resultItemActive: { backgroundColor: Theme.colors.accent + '08' } as ViewStyle,
  resultArt: { width: 52, height: 52, borderRadius: 12, marginRight: 14, backgroundColor: Theme.colors.border } as any,
  resultTitle: { fontSize: 15, fontWeight: '700', color: Theme.colors.text } as TextStyle,
  resultArtist: { fontSize: 12, color: Theme.colors.textMuted, marginTop: 2 } as TextStyle,
  plusBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  playBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' } as ViewStyle,

  empty: { alignItems: 'center', marginTop: 100 } as ViewStyle,
  emptyText: { marginTop: 16, color: Theme.colors.textMuted, fontSize: 16, textAlign: 'center', paddingHorizontal: 40 } as TextStyle,
});
