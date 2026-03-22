import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions, ViewStyle, TextStyle, Alert, DeviceEventEmitter } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Theme } from '@/constants/Theme';
import { ChevronLeft, Music, Play, Shuffle, SortAsc, Calendar, Plus, Pause } from 'lucide-react-native';
import { useAudio } from '@/context/AudioContext';
import { searchSongs, searchArtists, searchAlbums, getHomePageData } from '@/services/saavnService';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { getDownloadedSongs, deleteDownloadedSong } from '@/services/downloadService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeleteModal from '@/components/DeleteModal';
import PlaylistModal from '@/components/PlaylistModal';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Helpers for data mapping
const getArtwork = (item: any) => {
  if (!item) return 'https://via.placeholder.com/150';
  const src = item.image || item.artwork;
  if (Array.isArray(src)) {
    return src[src.length - 1]?.link || src[src.length - 1]?.url || 'https://via.placeholder.com/150';
  }
  return typeof src === 'string' ? src : 'https://via.placeholder.com/150';
};

const getArtist = (item: any) => {
  if (!item) return 'Unknown Artist';
  const src = item.primaryArtists || item.artist || item.subtitle;
  if (Array.isArray(src)) {
    return src.map((a: any) => a.name || a).join(', ');
  }
  return typeof src === 'string' ? src : 'Various Artists';
};

// Reusing MemoizedListItem
const ListItem = React.memo(({ item, index, sectionData, accent, isActive, isPlaying, onPlay, onAddToPlaylist, onLongPress }: any) => {
  const artwork = getArtwork(item);
  const artist = getArtist(item);
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress(item);
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 600)).duration(400)}>
      <Pressable
        style={[styles.listItem, isActive && { borderColor: accent + '80', borderWidth: 1.5 }]}
        onPress={() => onPlay(item, sectionData)}
        onLongPress={handleLongPress}
      >
        <Text style={[styles.listRank, { color: accent }]}>{String(index + 1).padStart(2, '0')}</Text>
        <View style={styles.listImgWrap}>
          <Image source={{ uri: artwork }} style={styles.listImg} contentFit="cover" />
          {isActive && (
            <View style={[styles.listImgOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
              {isPlaying ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.listArtist} numberOfLines={1}>{artist}</Text>
        </View>
        <Pressable
          style={styles.addButton}
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

const PlaylistItem = ({ item, index, onPress }: any) => (
  <Animated.View entering={FadeInDown.delay(index * 50)}>
    <Pressable style={styles.playlistCard} onPress={onPress}>
      <View style={[styles.playlistImgWrap, { backgroundColor: '#F0F0F0' }]}>
        <Music size={28} color={Theme.colors.textMuted} opacity={0.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.playlistTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playlistMeta}>{item.songs?.length || 0} tracks</Text>
      </View>
    </Pressable>
  </Animated.View>
);

const AlbumItem = React.memo(({ item, index, accent }: any) => {
  const router = useRouter();
  const artwork = getArtwork(item);
  const title = (item.name || item.title || 'Untitled').split('(')[0].trim();
  const artist = getArtist(item);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 600)).duration(400)}>
      <Pressable
        style={styles.artistItem}
        onPress={() => router.push({
          pathname: '/album/[id]',
          params: {
            id: item.id,
            name: title,
            isLocal: item.isLocal ? 'true' : 'false'
          }
        })}
      >
        <Image source={{ uri: artwork }} style={[styles.artistImg, { borderRadius: 14 }]} contentFit="cover" />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.listTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.listArtist} numberOfLines={1}>{artist}</Text>
        </View>
        <View style={[styles.arrow, { borderColor: accent + '40' }]}>
          <ChevronLeft size={18} color={accent} style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

const ArtistItem = React.memo(({ item, index, accent }: any) => {
  const router = useRouter();
  const artwork = getArtwork(item);
  const name = item.name || item.title || 'Unknown';
  const role = item.role || 'Artist';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 600)).duration(400)}>
      <Pressable
        style={styles.artistItem}
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
        <Image source={{ uri: artwork }} style={styles.artistImg} contentFit="cover" />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.listTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.listArtist} numberOfLines={1}>{role}</Text>
        </View>
        <View style={[styles.arrow, { borderColor: accent + '40' }]}>
          <ChevronLeft size={18} color={accent} style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

export default function SectionPage() {
  const { id, title, query, accent = Theme.colors.accent, isArtist, isAlbum, lang = 'hindi' } = useLocalSearchParams<{
    id: string,
    title: string,
    query: string,
    accent: string,
    isArtist?: string,
    isAlbum?: string,
    lang?: string,
    filter?: string
  }>();
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeSubFilter, setActiveSubFilter] = useState<'albums' | 'tracks'>('albums');
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [originalSongs, setOriginalSongs] = useState<any[]>([]);
  const [activeSort, setActiveSort] = useState<'az' | 'newest' | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [songToAdd, setSongToAdd] = useState<any>(null);

  const { currentTrack, isPlaying, playTrack } = useAudio();
  const router = useRouter();

  const categorizeSongs = (list: any[]) => {
    const results = [];
    const albums = list.filter(s => s.type === 'album');
    const tracks = list.filter(s => s.type === 'song' || !s.type);

    if (albums.length > 0) {
      results.push({ type: 'header', title: 'Downloaded Albums' }, ...albums);
    }
    if (tracks.length > 0) {
      results.push({ type: 'header', title: 'Individual Tracks' }, ...tracks);
    }
    return results;
  };

  const createPlaylist = async () => {
    Alert.prompt(
      'New Playlist',
      'Enter a name for your playlist',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          onPress: async (name: any) => {
            if (!name) return;
            const playlistsJson = await AsyncStorage.getItem('user_playlists');
            const playlists = playlistsJson ? JSON.parse(playlistsJson) : [];
            const newPlaylist = {
              id: Date.now().toString(),
              name,
              image: null,
              songs: [],
              type: 'user_playlist'
            };
            const updated = [newPlaylist, ...playlists];
            await AsyncStorage.setItem('user_playlists', JSON.stringify(updated));
            setSongs(updated);
            DeviceEventEmitter.emit('playlist_updated');
          }
        }
      ]
    );
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

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteDownloadedSong(itemToDelete.id);
      setDeleteModalVisible(false);
      setItemToDelete(null);
      loadSongs(1);
      DeviceEventEmitter.emit('download_completed');
    }
  };

  const loadSongs = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const isLanguageMatch = (item: any, target: string) => {
        if (!target || target.toLowerCase() === 'english') return true;
        const itemLang = (item.language || item.more_info?.language || item.subtitle || '').toLowerCase();
        return itemLang.includes(target.toLowerCase().trim());
      };

      let results: any[] = [];

      if (id === 'user_playlists') {
        const playlistsJson = await AsyncStorage.getItem('user_playlists');
        results = playlistsJson ? JSON.parse(playlistsJson) : [];
      } else if (query?.startsWith('playlist_')) {
        const playlistsJson = await AsyncStorage.getItem('user_playlists');
        const playlists = playlistsJson ? JSON.parse(playlistsJson) : [];
        const targetId = query.replace('playlist_', '');
        const playlist = playlists.find((p: any) => p.id === targetId);
        results = playlist?.songs || [];
      } else if (id === 'downloaded_albums') {
        const allSongs = await getDownloadedSongs();
        const albumMap = new Map();
        allSongs.forEach(s => {
          if (s.collectionType === 'album' && s.collectionId) {
            if (!albumMap.has(s.collectionId)) {
              albumMap.set(s.collectionId, {
                id: s.collectionId,
                name: s.collectionName || 'Unknown Album',
                image: getArtwork(s),
                artist: getArtist(s),
                type: 'album',
                songs: []
              });
            }
            albumMap.get(s.collectionId).songs.push(s);
          }
        });
        results = Array.from(albumMap.values());
      } else if (id === 'downloaded' || query === 'local_collection') {
        const allSongs = await getDownloadedSongs();
        const albumsMap = new Map();
        const individualSongs: any[] = [];
        allSongs.forEach(s => {
          if (s.collectionType === 'album' && s.collectionId) {
            if (!albumsMap.has(s.collectionId)) {
              albumsMap.set(s.collectionId, {
                id: s.collectionId,
                name: s.collectionName || 'Unknown Album',
                image: getArtwork(s),
                artist: getArtist(s),
                type: 'album',
                isLocal: true,
                songs: []
              });
            }
            albumsMap.get(s.collectionId).songs.push(s);
          } else {
            individualSongs.push({ ...s, type: 'song' });
          }
        });
        results = [];
        if (Array.from(albumsMap.values()).length > 0) {
          results.push({ type: 'header', title: 'Downloaded Albums' });
          results.push(...Array.from(albumsMap.values()));
        }
        if (individualSongs.length > 0) {
          results.push({ type: 'header', title: 'Individual Tracks' });
          results.push(...individualSongs);
        }
      } else if (query === 'favorite_albums') {
        const favsJson = await AsyncStorage.getItem('favorite_albums');
        results = favsJson ? JSON.parse(favsJson) : [];
      } else if (query === 'favorite_songs') {
        const favsJson = await AsyncStorage.getItem('favorite_songs');
        const raw = favsJson ? JSON.parse(favsJson) : [];
        results = raw;
      } else if (id === 'trending' || query === 'trending') {
        const home = await getHomePageData(lang || 'english');
        results = (home?.trending?.songs || []).filter((s: any) => isLanguageMatch(s, lang || 'english'));
      } else if (id === 'top charts' || query === 'top charts') {
        const home = await getHomePageData(lang || 'english');
        const chart = home?.charts?.find((c: any) => Array.isArray(c.data)) || home?.charts?.[0];
        results = (chart?.data || []).filter((s: any) => isLanguageMatch(s, lang || 'english'));
      } else {
        const finalQuery = query && query !== title ? (`${query} ${lang}`) : (`${title} ${lang}`);
        if (isArtist === 'true') {
          const res = await searchArtists(query || title || 'popular', pageNum, 30);
          results = res?.artists || [];
          setHasMore(results.length === 30);
        } else if (isAlbum === 'true') {
          const res = await searchAlbums(finalQuery, pageNum, 50);
          results = res?.albums || [];
          setHasMore(results.length === 50);
        } else {
          const res = await searchSongs(finalQuery, pageNum, 60);
          results = res?.songs || [];
          setHasMore(results.length === 60);
        }
      }

      if (results.length > 0) {
        const finalResults = pageNum === 1 ? results : [...songs, ...results];
        setSongs(finalResults);
        if (pageNum === 1) {
          setOriginalSongs(finalResults);
          setActiveSort(null);
        }
        if (results.length < 30) setHasMore(false);
      } else if (pageNum === 1) {
        setSongs([]);
        setOriginalSongs([]);
        setActiveSort(null);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Section fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [id, query, title, isArtist, isAlbum, lang]);

  useEffect(() => {
    loadSongs(1);

    const downloadSub = DeviceEventEmitter.addListener('download_completed', () => loadSongs(1));
    const playlistSub = DeviceEventEmitter.addListener('playlist_updated', () => loadSongs(1));
    const favoriteSub = DeviceEventEmitter.addListener('favorite_updated', () => loadSongs(1));

    return () => {
      downloadSub.remove();
      playlistSub.remove();
      favoriteSub.remove();
    };
  }, [loadSongs]);

  const fetchMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadSongs(nextPage);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSub}>
              {(id === 'downloaded' || query === 'local_collection' || id === 'local_collection' || query === 'favorite_albums' || id === 'favorite_albums' || id === 'user_playlists' || query?.startsWith('playlist_'))
                ? (() => {
                  const total = songs.reduce((acc, s) => {
                    if (s.type === 'header') return acc;
                    const isAlbumOrPlaylist = s.type === 'album' || id === 'user_playlists' || isAlbum === 'true' || query === 'favorite_albums' || id === 'favorite_albums';
                    if (isAlbumOrPlaylist) {
                      const subtitleCount = s.subtitle?.match(/(\d+)\s+(songs|tracks)/i)?.[1];
                      const titleCount = (s.name || s.title || '').match(/\((\d+)\)/)?.[1];
                      const count = s.songs?.length || s.songCount || s.more_info?.song_count || s.track_count || subtitleCount || titleCount || (s.id ? 1 : 0);
                      return acc + Number(count);
                    }
                    return acc + 1; // It's an individual song
                  }, 0);
                  return `${total} ${total === 1 ? 'track' : 'tracks'} available`;
                })()
                : `${songs.length} ${songs.length === 1 ? 'track' : 'tracks'} available`
              }
            </Text>
          </View>
        </View>
      </View>

      {/* ── Pro Vault: Sub-Filters (Pills) ── */}
      {!loading && id !== 'downloaded_albums' && (id === 'downloaded' || query === 'local_collection') && (
        <View style={styles.subFilterBar}>
          {['albums', 'tracks'].map((f) => (
            <Pressable
              key={f}
              style={[styles.subFilterPill, activeSubFilter === f && { backgroundColor: Theme.colors.accent }]}
              onPress={() => setActiveSubFilter(f as any)}
            >
              <Text style={[styles.subFilterLabel, activeSubFilter === f && { color: '#fff' }]}>
                {f.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Vault Action Bar (Intelligent Controls) ── */}
      {!loading && songs.length > 0 && (id === 'downloaded' || query?.includes('favorite') || id === 'downloaded_albums' || query === 'local_collection') && (
        <Animated.View entering={FadeIn.delay(200)} style={styles.vaultActionBar}>
          <Pressable
            style={[styles.actionChip, { backgroundColor: accent }]}
            onPress={() => {
              // Intelligent Shuffle: If on All/Tracks, shuffle items. If on Albums, shuffle songs within.
              let toShuffle = [];
              if (activeSubFilter === 'albums') {
                toShuffle = songs.filter(s => s.type === 'album').flatMap(a => a.songs || []);
              } else {
                toShuffle = songs.filter(s => s.type === 'song' || !s.type);
              }

              if (toShuffle.length > 0) {
                const shuffled = [...toShuffle].sort(() => Math.random() - 0.5);
                playTrack(shuffled[0], shuffled);
                router.push('/player');
              }
            }}
          >
            <Shuffle size={14} color="#fff" />
            <Text style={[styles.chipLabel, { color: '#fff' }]}>SHUFFLE ALL</Text>
          </Pressable>

          {id === 'user_playlists' && (
            <Pressable
              style={[styles.actionChip, { backgroundColor: Theme.colors.accent, marginLeft: 8 }]}
              onPress={createPlaylist}
            >
              <Plus size={14} color="#fff" />
              <Text style={[styles.chipLabel, { color: '#fff' }]}>CREATE NEW</Text>
            </Pressable>
          )}

          <View style={styles.chipDivider} />

          <Pressable
            style={[styles.actionChipAlt, activeSort === 'az' && { backgroundColor: accent }]}
            onPress={() => {
              if (activeSort === 'az') {
                setSongs(originalSongs);
                setActiveSort(null);
                return;
              }

              const items = songs.filter(s => s.type !== 'header');
              const sorted = [...items].sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));
              setSongs(categorizeSongs(sorted));
              setActiveSort('az');
            }}
          >
            <SortAsc size={14} color={activeSort === 'az' ? '#fff' : Theme.colors.text} />
            <Text style={[styles.chipLabelAlt, activeSort === 'az' && { color: '#fff' }]}>A-Z</Text>
          </Pressable>

          <Pressable
            style={[styles.actionChipAlt, activeSort === 'newest' && { backgroundColor: accent }]}
            onPress={() => {
              if (activeSort === 'newest') {
                setSongs(originalSongs);
                setActiveSort(null);
                return;
              }

              const items = songs.filter(s => s.type !== 'header');
              const sorted = [...items].sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
              setSongs(categorizeSongs(sorted));
              setActiveSort('newest');
            }}
          >
            <Calendar size={14} color={activeSort === 'newest' ? '#fff' : Theme.colors.text} />
            <Text style={[styles.chipLabelAlt, activeSort === 'newest' && { color: '#fff' }]}>NEWEST</Text>
          </Pressable>
        </Animated.View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          data={((id === 'downloaded' || query === 'local_collection') && id !== 'downloaded_albums') ? songs.filter(item => {
            if (activeSubFilter === 'albums') return item.type === 'album';
            if (activeSubFilter === 'tracks') return item.type === 'song' || (!item.type && item.id);
            return false;
          }) : (
            songs
          )}
          keyExtractor={(item, index) => `${item.type || 's'}-${item.id}-${index}`}
          renderItem={({ item, index }) => (
            id === 'user_playlists' ? (
              <PlaylistItem
                item={item}
                index={index}
                onPress={() => router.push({
                  pathname: '/section/[id]',
                  params: { id: `playlist_${item.id}`, title: item.name, query: `playlist_${item.id}` }
                })}
              />
            ) : isArtist === 'true' ? (
              <ArtistItem item={item} index={index} accent={accent} />
            ) : item.type === 'album' || isAlbum === 'true' ? (
              <AlbumItem item={item} index={index} accent={accent} />
            ) : (
              <ListItem
                item={item}
                index={index}
                sectionData={songs.filter(s => s.type === 'song' || !s.type)}
                accent={accent}
                isActive={currentTrack?.id === item.id}
                isPlaying={isPlaying}
                onPlay={(t: any, q: any) => {
                  playTrack(t, q);
                  router.push('/player');
                }}
                onAddToPlaylist={openPlaylistModal}
                onLongPress={(it: any) => {
                  if (it.localPath || id === 'downloaded' || query === 'local_collection') {
                    setItemToDelete(it);
                    setDeleteModalVisible(true);
                  }
                }}
              />
            )
          )}
          contentContainerStyle={styles.listContent}
          onEndReached={fetchMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator color={accent} style={{ marginVertical: 20 }} />
          ) : <View style={{ height: 100 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Music size={48} color={Theme.colors.textMuted} opacity={0.3} />
              <Text style={styles.emptyText}>No songs found in this section</Text>
            </View>
          }
        />
      )}

      <DeleteModal
        visible={deleteModalVisible}
        onClose={() => {
          setDeleteModalVisible(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete?.name || itemToDelete?.title || 'Song'}
        itemImage={getArtwork(itemToDelete)}
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
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  listRank: {
    width: 30,
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.6,
  },
  listImgWrap: {
    position: 'relative',
    marginRight: 13,
  },
  listImg: {
    width: 52,
    height: 52,
    borderRadius: 13,
  },
  listImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  listArtist: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    color: Theme.colors.textMuted,
    fontSize: 16,
  },
  artistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 4,
  } as ViewStyle,
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  } as TextStyle,
  sectionHeaderLine: {
    width: 24,
    height: 3,
    backgroundColor: Theme.colors.accent,
    borderRadius: 1.5,
    marginTop: 4,
  } as ViewStyle,
  artistImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eee',
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vaultActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  } as ViewStyle,
  actionChip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 2,
  } as ViewStyle,
  actionChipAlt: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  chipLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  } as TextStyle,
  chipLabelAlt: {
    fontSize: 11,
    fontWeight: '800',
    color: Theme.colors.text,
  } as TextStyle,
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 4,
  } as ViewStyle,
  subFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
  } as ViewStyle,
  subFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  } as ViewStyle,
  subFilterLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: Theme.colors.text,
  } as TextStyle,
  playlistCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  } as ViewStyle,
  playlistImgWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  playlistImg: {
    width: '100%',
    height: '100%',
  } as any,
  playlistOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  playlistTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Theme.colors.text,
    flex: 1,
  } as TextStyle,
  playlistMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textMuted,
  } as TextStyle,
});
