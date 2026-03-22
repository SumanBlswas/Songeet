import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Dimensions, Platform, StatusBar, Share, Alert, DeviceEventEmitter
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Theme } from '@/constants/Theme';
import { X, Music, Play, Share2, Heart, MoreVertical, Download, Plus } from 'lucide-react-native';
import { useAudio } from '@/context/AudioContext';
import { getAlbumDetails } from '@/services/saavnService';
import { downloadAlbum, isSongDownloaded, getDownloadedSongs } from '@/services/downloadService';
import PlaylistModal from '@/components/PlaylistModal';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown, FadeIn,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
  withTiming
} from 'react-native-reanimated';
import { Image } from 'expo-image';
const AnimatedImage = Animated.createAnimatedComponent(Image) as any;
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.72; // Dynamic height based on screen
const STICKY_HEADER_HEIGHT = Platform.OS === 'ios' ? 110 : 90;
const SAFE_TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10;

const getArtwork = (item: any) => {
  if (!item) return 'https://via.placeholder.com/500';
  const src = item.image || item.artwork;
  if (Array.isArray(src)) {
    return src.find((i: any) => i.quality === '500x500')?.link ||
      src.find((i: any) => i.quality === '150x150')?.link ||
      src[src.length - 1]?.link || 'https://via.placeholder.com/500';
  }
  return typeof src === 'string' ? src : 'https://via.placeholder.com/500';
};

const getArtist = (item: any) => {
  if (!item) return 'Unknown Artist';
  const src = item.primaryArtists || item.artist || item.subtitle;
  if (Array.isArray(src)) {
    return src.map((a: any) => a.name || a).join(', ');
  }
  return typeof src === 'string' ? src : 'Various Artists';
};

const TrackItem = React.memo(({ item, index, sectionData, accent, isActive, isPlaying, onPlay, onAddToPlaylist }: any) => {
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();
  const artist = getArtist(item);
  const duration = item.duration ? (Number(item.duration) / 60).toFixed(2).replace('.', ':') : '';

  return (
    <Animated.View entering={FadeInDown.delay(index * 30 + 400).duration(400)}>
      <Pressable
        style={[styles.trackItem, isActive && { backgroundColor: accent + '15' }]}
        onPress={() => onPlay(item, sectionData)}
      >
        <View style={styles.trackRankWrap}>
          {isActive && isPlaying ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Text style={[styles.trackRank, isActive && { color: accent }]}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, isActive && { color: accent }]} numberOfLines={1}>{title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{artist}</Text>
        </View>
        <Text style={styles.trackDuration}>{duration}</Text>
        <Pressable
          style={styles.moreBtn}
          onPress={(e) => {
            e.stopPropagation();
            onAddToPlaylist(item);
          }}
        >
          <Plus size={20} color={accent} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
});

export default function AlbumPage() {
  const { id, name: paramName, isLocal } = useLocalSearchParams<{ id: string, name: string, isLocal?: string }>();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [downloadingAlbum, setDownloadingAlbum] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, name: '' });
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [songToAdd, setSongToAdd] = useState<any>(null);
  const { currentTrack, isPlaying, playTrack } = useAudio();
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const accent = Theme.colors.accent;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const loadAlbum = useCallback(async () => {
    try {
      setLoading(true);

      // If local, try to load from downloads first
      if (isLocal === 'true') {
        const downloads = await getDownloadedSongs();
        const albumSongs = downloads.filter(s => s.collectionId === id);
        if (albumSongs.length > 0) {
          const first = albumSongs[0];
          setAlbum({
            id,
            name: first.collectionName || paramName,
            image: first.image,
            artist: getArtist(first),
            year: new Date(first.downloadedAt).getFullYear(),
            songs: albumSongs
          });
          // Also check favorite
          const favs = await AsyncStorage.getItem('favorite_albums');
          if (favs) {
            const parsed = JSON.parse(favs);
            setIsFavorite(parsed.some((a: any) => a.id === id));
          }
          setLoading(false);
          // Still try to fetch full metadata in background if possible
          getAlbumDetails(id).then(res => {
            if (res) {
              setAlbum((prev: any) => ({ ...res, songs: albumSongs })); // Keep local songs but update metadata
            }
          }).catch(() => { });
          return;
        }
      }

      const res = await getAlbumDetails(id);
      if (res) {
        setAlbum(res);
        // Check if favorite
        const favs = await AsyncStorage.getItem('favorite_albums');
        if (favs) {
          const parsed = JSON.parse(favs);
          setIsFavorite(parsed.some((a: any) => a.id === id));
        }
      }
    } catch (err) {
      console.error('Album fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, isLocal, paramName]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  const toggleFavorite = async () => {
    try {
      const favs = await AsyncStorage.getItem('favorite_albums');
      let parsed = favs ? JSON.parse(favs) : [];
      if (isFavorite) {
        parsed = parsed.filter((a: any) => a.id !== id);
      } else {
        parsed.push({
          id: album.id,
          name: album.name || album.title,
          image: getArtwork(album),
          artist: getArtist(album),
          year: album.year,
          songCount: album.songCount || album.songs?.length || 0,
          type: 'album'
        });
      }
      await AsyncStorage.setItem('favorite_albums', JSON.stringify(parsed));
      setIsFavorite(!isFavorite);
      DeviceEventEmitter.emit('favorite_updated');
    } catch (e) {
      console.error('Toggle favorite error:', e);
    }
  };

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

  const handleDownloadAlbum = async () => {
    if (!album || !songs.length) return;

    try {
      setDownloadingAlbum(true);
      const res = await downloadAlbum(
        songs,
        (current, total, name) => {
          setDownloadProgress({ current, total, name });
        },
        {
          collectionType: 'album',
          collectionName: album.name || album.title,
          collectionId: album.id
        }
      );

      Alert.alert(
        "Download Complete",
        `Successfully downloaded ${res.success} songs.${res.failed > 0 ? ` ${res.failed} failed.` : ''}`
      );
    } catch (e) {
      console.error('Download album error:', e);
      Alert.alert("Error", "Failed to download album.");
    } finally {
      setDownloadingAlbum(false);
    }
  };

  const shareAlbum = async () => {
    try {
      const url = album.url || `https://www.jiosaavn.com/album/${album.id}`;
      await Share.share({
        message: `Check out this album on Songeet: ${album.name || album.title}\n${url}`,
        url: url,
        title: album.name || album.title
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  // Animated Styles
  const headerImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.5]
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [1.5, 1, 1],
            Extrapolate.CLAMP
          ),
        },
      ],
      opacity: interpolate(
        scrollY.value,
        [0, HEADER_HEIGHT / 2],
        [1, 0.4],
        Extrapolate.CLAMP
      ),
    };
  });

  const stickyHeaderStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [HEADER_HEIGHT - 120, HEADER_HEIGHT - 60],
        [0, 1],
        Extrapolate.CLAMP
      ),
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [HEADER_HEIGHT - 120, HEADER_HEIGHT - 60],
            [20, 0],
            Extrapolate.CLAMP
          ),
        },
      ],
    };
  });

  const artworkScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(
            scrollY.value,
            [-100, 0, 200],
            [1.05, 1, 0.7],
            Extrapolate.CLAMP
          ),
        },
        {
          translateY: interpolate(
            scrollY.value,
            [0, 200],
            [0, 40],
            Extrapolate.CLAMP
          )
        }
      ],
      opacity: interpolate(
        scrollY.value,
        [0, 200],
        [1, 0],
        Extrapolate.CLAMP
      ),
    };
  });

  const playBtnStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: scrollY.value > 280 ? withTiming(0) : withTiming(1)
        }
      ]
    };
  });

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!album) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: '#fff' }}>Album not found</Text>
      </View>
    );
  }

  const songs = album.songs || [];
  const artwork = getArtwork(album);
  const artist = getArtist(album);
  const fullName = album.name || album.title || paramName;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* --- Sticky Header (Visible on Scroll) --- */}
      <Animated.View style={[styles.stickyHeader, stickyHeaderStyle]}>
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyContent}>
          <Text style={styles.stickyTitle} numberOfLines={1}>{fullName}</Text>
        </View>
      </Animated.View>

      {/* --- Background Parallax Image --- */}
      <Animated.View style={[styles.headerBgContainer, headerImageStyle]}>
        <Image source={{ uri: artwork }} style={styles.headerBg} contentFit="cover" blurRadius={40} />
        <LinearGradient
          colors={['#121212', 'rgba(18,18,18,0.8)', '#121212']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* --- Navigation Controls (Float) --- */}
      <View style={[styles.topControls, { top: SAFE_TOP }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <X size={26} color="#fff" />
        </Pressable>
      </View>

      <Animated.FlatList
        onScroll={onScroll}
        data={songs}
        keyExtractor={(item) => item.id}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.header}>
            <Animated.View style={[styles.artworkContainer, artworkScaleStyle]}>
              <AnimatedImage
                sharedTransitionTag={`album-art-${id}`}
                source={{ uri: artwork }}
                style={styles.artwork}
                contentFit="cover"
              />
            </Animated.View>

            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={2}>{fullName}</Text>
              <View style={styles.artistRow}>
                <Image source={{ uri: artwork }} style={styles.artistThumb} />
                <Text style={styles.artistName}>{artist}</Text>
              </View>
              <Text style={styles.metaData}>
                {album.year} • {songs.length} Tracks • {album.language}
              </Text>
              {downloadingAlbum && (
                <Text style={[styles.metaData, { color: accent, marginTop: 4 }]}>
                  Downloading: {downloadProgress.current}/{downloadProgress.total} - {downloadProgress.name}
                </Text>
              )}
            </View>

            <View style={styles.controlsRow}>
              <View style={styles.leftControls}>
                <Pressable style={styles.actionBtn} onPress={toggleFavorite}>
                  <Heart size={26} color={isFavorite ? accent : "#fff"} fill={isFavorite ? accent : "transparent"} />
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={shareAlbum}>
                  <Share2 size={26} color="#fff" />
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, downloadingAlbum && { opacity: 0.5 }]}
                  onPress={handleDownloadAlbum}
                  disabled={downloadingAlbum}
                >
                  {downloadingAlbum ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <Download size={26} color="#fff" />
                  )}
                </Pressable>
              </View>
              <Animated.View style={playBtnStyle}>
                <Pressable
                  style={[styles.playBtn, { backgroundColor: accent }]}
                  onPress={() => {
                    if (songs.length > 0) {
                      playTrack(songs[0], songs);
                      router.push('/player');
                    }
                  }}
                >
                  <Play size={28} color="#000" fill="#000" />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackItem
            item={item}
            index={index}
            sectionData={songs}
            accent={accent}
            isActive={currentTrack?.id === item.id}
            isPlaying={isPlaying}
            onPlay={(t: any, q: any) => {
              playTrack(t, q);
              router.push('/player');
            }}
            onAddToPlaylist={openPlaylistModal}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={<View style={{ height: 140 }} />}
      />

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
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  headerBgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT + 100,
  },
  headerBg: {
    width: '100%',
    height: '100%',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STICKY_HEADER_HEIGHT,
    zIndex: 100,
    justifyContent: 'flex-end',
    paddingBottom: 15,
  },
  stickyContent: {
    paddingHorizontal: 60,
    alignItems: 'center',
  },
  stickyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 34,
    left: 16,
    right: 16,
    zIndex: 110,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: SAFE_TOP + 30,
    paddingBottom: 32,
  },
  artworkContainer: {
    alignSelf: 'center',
    marginBottom: 38,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 40,
  },
  artwork: {
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    zIndex: 200,
  },
  infoContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1.2,
    lineHeight: 40,
    marginBottom: 12,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  artistThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  artistName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  metaData: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftControls: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  actionBtn: {
    opacity: 0.9,
  },
  playBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  listContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: height - HEADER_HEIGHT,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  trackRankWrap: {
    width: 35,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  trackRank: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  trackArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 3,
    fontWeight: '500',
  },
  trackDuration: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginHorizontal: 15,
    fontWeight: '600',
  },
  moreBtn: {
    padding: 6,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  }
});
