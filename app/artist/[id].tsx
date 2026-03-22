import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ViewStyle, TextStyle, ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronDown, Play, Pause, Music, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Alert } from 'react-native';
import Animated, { FadeInDown, SlideInUp } from 'react-native-reanimated';
import { Theme } from '@/constants/Theme';
import { useAudio } from '@/context/AudioContext';
import { useSettings } from '@/context/SettingsContext';
import { searchSongs } from '@/services/saavnService';
import PlaylistModal from '@/components/PlaylistModal';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const PAGE_SIZE = 10;

function getArtwork(item: any): string {
  const src = item?.image || item?.album?.image;
  if (Array.isArray(src)) {
    return src.find((i: any) => i.quality === '500x500')?.link || src[src.length - 1]?.link || '';
  }
  return typeof src === 'string' ? src : '';
}

export default function ArtistScreen() {
  const { id, name, role, image } = useLocalSearchParams<{ id: string; name: string; role: string; image: string }>();
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const router = useRouter();

  const [songs, setSongs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [songToAdd, setSongToAdd] = useState<any>(null);

  const { primaryLanguage } = useSettings();
  const avatarUrl = image ? decodeURIComponent(image) : '';
  const isFetching = useRef(false);

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (isFetching.current) return;
    isFetching.current = true;

    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      // Use language to filter songs if available, else fallback to name only
      const query = name ? `${name} ${primaryLanguage} songs` : '';
      const res = await searchSongs(query, pageNum, PAGE_SIZE);
      if (res?.songs && res.songs.length > 0) {
        const normalised = res.songs.map((s: any) => ({ ...s, id: String(s.id) }));
        setSongs(prev => append ? [...prev, ...normalised] : normalised);
        setTotal(res.total || 0);
        setHasMore((res.total ?? 0) > pageNum * PAGE_SIZE);
      } else {
        // Fallback: If no language specific songs found, try just the name
        if (pageNum === 1 && !append) {
          const fallbackRes = await searchSongs(name || '', 1, PAGE_SIZE);
          if (fallbackRes?.songs && fallbackRes.songs.length > 0) {
            const normalised = fallbackRes.songs.map((s: any) => ({ ...s, id: String(s.id) }));
            setSongs(normalised);
            setTotal(fallbackRes.total || 0);
            setHasMore((fallbackRes.total ?? 0) > PAGE_SIZE);
            return;
          }
        }
        setHasMore(false);
      }
    } catch (e) {
      console.error('ArtistScreen fetch error:', e);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
      isFetching.current = false;
    }
  }, [name, primaryLanguage]);

  useEffect(() => {
    if (name) fetchPage(1, false);
  }, [name, fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, true);
  }, [hasMore, loadingMore, loading, page, fetchPage]);

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
      image: getArtwork(songToAdd)
    };

    playlists.push(newP);
    await AsyncStorage.setItem('user_playlists', JSON.stringify(playlists));
    DeviceEventEmitter.emit('playlist_updated');
    setPlaylistModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openPlaylistModal = (song: any) => {
    setSongToAdd(song);
    setPlaylistModalVisible(true);
  };

  const handlePlayAll = () => {
    if (songs.length > 0) playTrack(songs[0] as any, songs as any);
  };

  const renderSong = ({ item, index }: { item: any; index: number }) => {
    return <MemoizedSongRow
      item={item} index={index} songs={songs}
      isActive={currentTrack?.id === item.id} isPlaying={isPlaying}
      onPlay={(t: any, q: any) => {
        playTrack(t, q);
        router.push('/player');
      }}
      onAddToPlaylist={openPlaylistModal}
    />;
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Theme.colors.accent} />
        <Text style={styles.footerText}>Loading more…</Text>
      </View>
    );
  };

  // Memoize the header so it only animates in once
  const memoizedHeader = useMemo(() => (
    <>
      <Animated.View entering={SlideInUp.duration(500)} style={styles.hero}>
        <View style={styles.avatarRing}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <LinearGradient colors={[Theme.colors.accent, Theme.colors.ink]} style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.avatarInitial}>{(name || '?')[0]?.toUpperCase()}</Text>
            </LinearGradient>
          )}
        </View>
        <Text style={styles.artistName}>{name}</Text>
        <Text style={styles.artistRole}>{role || 'Artist'}</Text>
        {total > 0 && <Text style={styles.trackCount}>{total.toLocaleString()} songs</Text>}
        <Pressable style={styles.playAllBtn} onPress={handlePlayAll}>
          <Play size={18} color="#fff" fill="#fff" />
          <Text style={styles.playAllText}>Play All</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.songsHeaderRow}>
        <Music size={14} color={Theme.colors.accent} />
        <Text style={styles.songsHeaderText}>Top Songs</Text>
      </View>
    </>
  ), [avatarUrl, name, role, total, handlePlayAll]);

  return (
    <View style={styles.root}>
      {/* Blurred background */}
      <Image source={{ uri: avatarUrl }} style={styles.bgImg} contentFit="cover" blurRadius={40} />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.65)', Theme.colors.background]}
        locations={[0, 0.42, 0.72]}
        style={StyleSheet.absoluteFill}
      />

      {/* Back button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ChevronDown size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Song list with infinite scroll */}
      {loading ? (
        <>
          {memoizedHeader}
          <ActivityIndicator size="large" color={Theme.colors.accent} style={{ marginTop: 40 }} />
        </>
      ) : (
        <FlatList
          data={songs}
          renderItem={renderSong}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          ListHeaderComponent={memoizedHeader}
          ListFooterComponent={renderFooter()}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No songs found</Text>
          }
        />
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

const MemoizedSongRow = React.memo(({ item, index, songs, isActive, isPlaying, onPlay, onAddToPlaylist }: any) => {
  const artwork = getArtwork(item);
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();
  const album = item.album?.name || item.subtitle || '';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index % PAGE_SIZE, 8) * 50).duration(300)}>
      <Pressable
        style={[styles.songRow, isActive && styles.songRowActive]}
        onPress={() => onPlay(item, songs)}
      >
        <Text style={[styles.songIndex, isActive && { color: Theme.colors.accent }]}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Image source={{ uri: artwork }} style={styles.songArt} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.songTitle, isActive && { color: Theme.colors.accent }]} numberOfLines={1}>{title}</Text>
          <Text style={styles.songAlbum} numberOfLines={1}>{album}</Text>
        </View>
        <Pressable
          style={styles.plusBtn}
          onPress={(e) => {
            e.stopPropagation();
            onAddToPlaylist(item);
          }}
        >
          <Plus size={20} color={Theme.colors.accent} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.isActive === next.isActive &&
  (prev.isActive ? prev.isPlaying === next.isPlaying : true)
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' } as ViewStyle,
  bgImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' } as any,

  header: { position: 'absolute', top: 52, left: 20, zIndex: 20 } as ViewStyle,
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  } as ViewStyle,

  hero: { alignItems: 'center', paddingTop: 110, paddingBottom: 28 } as ViewStyle,
  avatarRing: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.55)',
    padding: 3, marginBottom: 18,
    elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 20,
  } as ViewStyle,
  avatar: { width: '100%', height: '100%', borderRadius: 999 } as any,
  avatarInitial: { fontSize: 52, fontWeight: '800', color: '#fff' } as TextStyle,
  artistName: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center' } as TextStyle,
  artistRole: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 5, textTransform: 'uppercase', letterSpacing: 1.5 } as TextStyle,
  trackCount: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontWeight: '500' } as TextStyle,
  playAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 22, backgroundColor: Theme.colors.accent,
    paddingHorizontal: 30, paddingVertical: 13, borderRadius: 30,
    elevation: 8, shadowColor: Theme.colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12,
  } as ViewStyle,
  playAllText: { color: '#fff', fontSize: 15, fontWeight: '800' } as TextStyle,

  songsHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.border,
  } as ViewStyle,
  songsHeaderText: { fontSize: 17, fontWeight: '800', color: Theme.colors.text } as TextStyle,

  listContent: { paddingBottom: 60 } as ViewStyle,

  songRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: Theme.colors.background,
  } as ViewStyle,
  songRowActive: { backgroundColor: `${Theme.colors.accent}10` } as ViewStyle,
  songIndex: { width: 30, fontSize: 13, fontWeight: '800', color: Theme.colors.textMuted, opacity: 0.4 } as TextStyle,
  songArt: { width: 50, height: 50, borderRadius: 12, marginRight: 14 } as any,
  songTitle: { fontSize: 15, fontWeight: '700', color: Theme.colors.text } as TextStyle,
  songAlbum: { fontSize: 12, color: Theme.colors.textMuted, marginTop: 2 } as TextStyle,
  plusBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  divider: { height: 0.5, backgroundColor: Theme.colors.border, marginLeft: 20 } as ViewStyle,

  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, backgroundColor: Theme.colors.background } as ViewStyle,
  footerText: { color: Theme.colors.textMuted, fontSize: 13, fontWeight: '600' } as TextStyle,

  emptyText: { textAlign: 'center', color: Theme.colors.textMuted, marginTop: 50, fontSize: 15 } as TextStyle,
});
