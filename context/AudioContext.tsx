import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  State,
  usePlaybackState,
  useProgress,
  Event,
  useTrackPlayerEvents,
  RepeatMode
} from 'react-native-track-player';
import * as Haptics from 'expo-haptics';
import { DeviceEventEmitter } from 'react-native';
import { ApiSong } from '@/services/apiTypes';
import { setupPlayer } from '@/services/playbackService';
import { isOnline } from '../services/networkService';
import { downloadSong, isSongDownloaded, getDecryptedFileUri, getDownloadedSongs } from '@/services/downloadService';
import { useSettings } from './SettingsContext';
import { searchAlbums, searchSongs, getAlbumDetails } from '@/services/saavnService';
import { useRef } from 'react';

export interface Track extends ApiSong {
  isDownloaded?: boolean;
  artwork?: string;
  artist?: string;
}

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isAdPlaying: boolean;
  position: number;
  duration: number;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (position: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  downloadCurrentTrack: () => Promise<void>;
  checkDownloadStatus: (songId: string) => Promise<boolean>;
  skipAd: () => void;
  isDownloading: boolean;
  downloadProgress: number;
  downloadTitle: string;
  downloadSuccess: boolean;
  favoriteSongs: Track[];
  toggleFavoriteSong: (track: Track) => Promise<void>;
  isFavorite: (songId: string) => boolean;
  isShuffle: boolean;
  toggleShuffle: () => void;
  loopMode: RepeatMode;
  toggleLoopMode: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { audioQuality, primaryLanguage } = useSettings();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);

  // Download States
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadTitle, setDownloadTitle] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [favoriteSongs, setFavoriteSongs] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [loopMode, setLoopMode] = useState<RepeatMode>(RepeatMode.Off);
  const isFetchingAutoPlay = useRef(false);
  const lastAutoExtendedTrackId = useRef<string | null>(null);

  const playbackState = usePlaybackState();
  const progress = useProgress();

  const state = (playbackState as any).state ?? playbackState;
  const isPlaying = state === State.Playing || state === 'playing';
  const isBuffering = state === State.Buffering || state === State.Loading || state === 'buffering' || state === 3 || state === 6;

  useEffect(() => {
    setupPlayer().catch(() => {});

    // Load initial loop mode
    AsyncStorage.getItem('player_loop_mode').then(res => {
      if (res) {
        const mode = parseInt(res) as RepeatMode;
        setLoopMode(mode);
        TrackPlayer.setRepeatMode(mode).catch(() => {});
      }
    });

    // Load initial favorites
    AsyncStorage.getItem('favorite_songs').then(res => {
      if (res) setFavoriteSongs(JSON.parse(res));
    });
  }, []);

  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged, Event.PlaybackError], async (event: any) => {
    if (event.type === Event.PlaybackActiveTrackChanged && event.track) {
      setCurrentTrack(event.track as unknown as Track);
    }
    if (event.type === Event.PlaybackError) {
      console.error('[AudioContext] PLAYBACK ERROR:', event.message || event.error || event);
    }
  });

  const mapToTrackPlayer = useCallback(async (t: Track) => {
    let url = '';
    const downloaded = await isSongDownloaded(t.id);

    if (downloaded) {
      try {
        // t is just a Track. We need the full DownloadedSong object with localPath
        const allDownloads = await getDownloadedSongs();
        const localSong = allDownloads.find(s => s.id === t.id);
        if (localSong?.localPath) {
          url = await getDecryptedFileUri(localSong);
        }
      } catch (e) {
        console.warn('[AudioContext] Decryption failed', e);
      }
    }

    if (!url) {
      let songData: any = { ...t };
      if (!Array.isArray(t.downloadUrl) || t.downloadUrl.length === 0) {
        try {
          const res = await fetch(`https://suman-api.vercel.app/songs?id=${t.id}`);
          const json = await res.json();
          if (json.success !== false && json.data) {
            songData = Array.isArray(json.data) ? json.data[0] : json.data;
          }
        } catch (e) {
          console.warn('[AudioContext] API fetch failed', e);
        }
      }

      if (Array.isArray(songData.downloadUrl) && songData.downloadUrl.length > 0) {
        const targetQuality = audioQuality || '320kbps';
        const exact = songData.downloadUrl.find((du: any) => du.quality === targetQuality);
        
        if (exact) {
          url = exact.link;
        } else {
          // Intelligent search for the BEST AVAILABLE quality favoring DATA SAVING if exact is missing
          const order = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
          const targetIdx = order.indexOf(targetQuality);
          
          // Try to find target or any lower first
          for (let i = targetIdx; i < order.length; i++) {
            const match = songData.downloadUrl.find((du: any) => du.quality === order[i]);
            if (match) { url = match.link; break; }
          }
          
          // If still no url, try anything from highest down
          if (!url) {
            for (let i = 0; i < order.length; i++) {
              const match = songData.downloadUrl.find((du: any) => du.quality === order[i]);
              if (match) { url = match.link; break; }
            }
          }
        }
      } else if (typeof songData.downloadUrl === 'string' && songData.downloadUrl.startsWith('http')) {
        url = songData.downloadUrl;
      }

      if (!url && typeof songData.url === 'string' && !songData.url.includes('jiosaavn.com/featured')) {
        url = songData.url;
      }
    }

    let artwork = '';
    const imageSource = t.image || (t.album as any)?.image;
    if (Array.isArray(imageSource)) {
      artwork = imageSource.find(img => img.quality === '500x500')?.link || (imageSource[imageSource.length - 1] as any)?.link || '';
    } else if (typeof imageSource === 'string') {
      if (imageSource.startsWith('/data/')) {
        artwork = `file://${imageSource}`;
      } else {
        artwork = imageSource;
      }
    }

    let artist = 'Unknown Artist';
    const artistSource = t.primaryArtists || (t as any).artists?.primary || (t as any).artists || t.subtitle;
    if (Array.isArray(artistSource)) {
      artist = artistSource.map((a: any) => a.name || a).join(', ');
    } else if (typeof artistSource === 'string') {
      artist = artistSource;
    }

    const trackObj: any = {
      ...t, // Preserve original API payload so downloadSong has access to internal image/artist arrays!
      id: t.id,
      url: url || '',
      title: (t.name || t.title || 'Untitled').split('(')[0].trim(),
      artist: artist,
      duration: parseInt(t.duration) || 0,
      isDownloaded: downloaded
    };

    if (artwork && artwork.trim().length > 0) {
      trackObj.artwork = artwork;
    }

    return trackObj;
  }, [audioQuality]);

  const [fullQueue, setFullQueue] = useState<Track[]>([]);

  const playTrack = useCallback(async (track: Track, queue?: Track[]) => {
    try {
      await TrackPlayer.reset();
      const actualQueue = queue || [track];
      setFullQueue(actualQueue);

      const startIndex = actualQueue.findIndex(s => s.id === track.id);
      const targetIndex = startIndex !== -1 ? startIndex : 0;

      // Map up to 50 songs synchronously for immediate responsiveness
      const initialBatch = actualQueue.slice(0, 50);
      const mappedQueue = await Promise.all(
        initialBatch.map(s => mapToTrackPlayer(s))
      );

      const playableQueue = mappedQueue.filter(t => t.url);
      if (playableQueue.length === 0) {
        console.error('[AudioContext] No playable tracks found in queue');
        return;
      }

      await TrackPlayer.add(playableQueue as any);
      
      // Find the correct index in the playable queue (some might have been filtered)
      const playableTargetIndex = playableQueue.findIndex(s => s.id === track.id);
      if (playableTargetIndex !== -1) {
        await TrackPlayer.skip(playableTargetIndex);
      }

      await TrackPlayer.play();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Load the rest of the queue if it's very large (optional background task)
      if (actualQueue.length > 50) {
        setTimeout(async () => {
          try {
            const remaining = actualQueue.slice(50);
            for (const s of remaining) {
              const mapped = await mapToTrackPlayer(s);
              if (mapped.url) await TrackPlayer.add([mapped] as any);
            }
          } catch (e) {}
        }, 1500);
      }
    } catch (err) {
      console.error('[AudioContext] playTrack error:', err);
    }
  }, [mapToTrackPlayer, audioQuality]);

  const toggleShuffle = useCallback(async () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const queue = await TrackPlayer.getQueue();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex === undefined) return;
      const currentTrackInPlayer = queue[currentIndex];

      if (nextShuffle) {
        // SHUFFLE ON: Randomize what's left
        if (currentIndex < queue.length - 1) {
          const remaining = queue.slice(currentIndex + 1);
          const shuffled = [...remaining].sort(() => Math.random() - 0.5);
          for (let i = queue.length - 1; i > currentIndex; i--) await TrackPlayer.remove(i);
          await TrackPlayer.add(shuffled as any);
        }
      } else {
        // SHUFFLE OFF: Restore original sequential order after current track
        const originalIdx = fullQueue.findIndex(s => s.id === currentTrackInPlayer.id);
        if (originalIdx !== -1 && originalIdx < fullQueue.length - 1) {
          const originalRemaining = fullQueue.slice(originalIdx + 1);
          // Only restore up to 50 for performance, similar to playTrack
          const toRestore = originalRemaining.slice(0, 50);
          
          for (let i = queue.length - 1; i > currentIndex; i--) await TrackPlayer.remove(i);
          
          for (const s of toRestore) {
            const mapped = await mapToTrackPlayer(s);
            if (mapped.url) await TrackPlayer.add([mapped] as any);
          }
        }
      }
    } catch (e) {
      console.error('[AudioContext] Shuffle toggle logic failed:', e);
    }
  }, [isShuffle, fullQueue, mapToTrackPlayer, loopMode]);

  const toggleLoopMode = useCallback(async () => {
    let nextMode: RepeatMode;
    if (loopMode === RepeatMode.Off) {
      nextMode = RepeatMode.Track; // Off -> One
    } else if (loopMode === RepeatMode.Track) {
      nextMode = RepeatMode.Queue; // One -> Loop (All)
    } else {
      nextMode = RepeatMode.Off; // Loop -> Off (Infinity)
    }

    setLoopMode(nextMode);
    await TrackPlayer.setRepeatMode(nextMode);
    await AsyncStorage.setItem('player_loop_mode', nextMode.toString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [loopMode]);

  const togglePlayPause = useCallback(async () => {
    try {
      const playbackState = await TrackPlayer.getPlaybackState();
      const state = (playbackState as any).state ?? playbackState;

      if (state === State.Playing || state === 'playing') {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
      Haptics.selectionAsync();
    } catch (e) {}
  }, []);

  const seekTo = useCallback((pos: number) => {
    TrackPlayer.seekTo(pos).catch(e => {});
  }, []);

  const nextTrack = useCallback(() => { TrackPlayer.skipToNext().catch(e => {}); }, []);
  const previousTrack = useCallback(() => { TrackPlayer.skipToPrevious().catch(e => console.error('[AudioContext] Previous failed:', e)); }, []);

  const downloadCurrentTrack = useCallback(async () => {
    if (currentTrack && !currentTrack.isDownloaded && !isDownloading) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadTitle(currentTrack.title || 'Unknown');
        setDownloadSuccess(false);

        await downloadSong(
          currentTrack as any,
          "320kbps",
          (p) => setDownloadProgress(p)
        );

        setDownloadSuccess(true);
        const updated = { ...currentTrack, isDownloaded: true };
        setCurrentTrack(updated);

        setTimeout(() => {
          setIsDownloading(false);
          setDownloadSuccess(false);
        }, 2500); // Wait for the green success state animation to show before hiding

      } catch (err) {
        setIsDownloading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [currentTrack, isDownloading]);

  const checkDownloadStatus = useCallback(async (songId: string) => {
    return await isSongDownloaded(songId);
  }, []);

  const skipAd = useCallback(() => {
    setIsAdPlaying(false);
    TrackPlayer.play().catch(e => {});
  }, []);

  const toggleFavoriteSong = useCallback(async (track: Track) => {
    try {
      const exists = favoriteSongs.some(s => s.id === track.id);
      let updated;
      if (exists) {
        updated = favoriteSongs.filter(s => s.id !== track.id);
      } else {
        updated = [...favoriteSongs, track];
      }
      setFavoriteSongs(updated);
      await AsyncStorage.setItem('favorite_songs', JSON.stringify(updated));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      DeviceEventEmitter.emit('favorite_updated');
    } catch (e) {}
  }, [favoriteSongs]);

  const isFavorite = useCallback((songId: string) => {
    return favoriteSongs.some(s => s.id === songId);
  }, [favoriteSongs]);

  // ♾️ NEVER STOP MUSIC FEATURE (Infinity Songs)
  useEffect(() => {
    const checkAndExtendQueue = async () => {
      // ONLY trigger if loopMode is OFF (which represents Infinity)
      if (!currentTrack || isFetchingAutoPlay.current || isShuffle || loopMode !== RepeatMode.Off) return;
      
      // Prevent multiple extensions for the same track
      if (lastAutoExtendedTrackId.current === currentTrack.id) return;

      try {
        const queue = await TrackPlayer.getQueue();
        const index = await TrackPlayer.getActiveTrackIndex();

        // STRICT INFINITY TRIGGER: Only trigger on the absolute LAST song of the current queue
        if (index !== undefined && index >= queue.length - 1) {
          const artistName = currentTrack.artist?.split(',')[0].trim();
          if (!artistName) return;

          isFetchingAutoPlay.current = true;
          lastAutoExtendedTrackId.current = currentTrack.id;

          // Strategy: Try to find a new album first, otherwise top songs
          // Include primaryLanguage in query to improve relevance
          const albumRes = await searchAlbums(`${artistName} ${primaryLanguage} album`, 1, 5);
          let newSongs: any[] = [];

          if (albumRes?.albums && albumRes.albums.length > 0) {
            // Find an album that isn't the current one (if possible)
            const currentAlbumName = (currentTrack as any).album?.name || '';
            const nextAlbum = albumRes.albums.find(a => a.name !== currentAlbumName) || albumRes.albums[0];
            
            const albumDetails = await getAlbumDetails(nextAlbum.id);
            if (albumDetails?.songs) {
              // STRICT LANGUAGE FILTERING
              newSongs = albumDetails.songs.filter(s => 
                s.language?.toLowerCase() === primaryLanguage?.toLowerCase()
              );
            }
          }

          // Fallback to top songs if album failed or was too small
          if (newSongs.length === 0) {
             const songRes = await searchSongs(`${artistName} ${primaryLanguage} top songs`, 1, 15);
             if (songRes?.songs) {
               // STRICT LANGUAGE FILTERING
               newSongs = songRes.songs.filter(s => 
                 s.language?.toLowerCase() === primaryLanguage?.toLowerCase()
               );
             }
          }

          if (newSongs.length > 0) {
            const mapped = await Promise.all(
              newSongs
                .filter(s => !queue.some(q => q.id === String(s.id)))
                .slice(0, 10) // Only add 10 to keep it manageable
                .map(s => mapToTrackPlayer(s))
            );

            if (mapped.length > 0) {
              await TrackPlayer.add(mapped as any);
              // Update fullQueue to reflect the extension
              setFullQueue(prev => [...prev, ...mapped as any]);
            }
          }
        }
      } catch (e) {
        // Fail silently for release
      } finally {
        isFetchingAutoPlay.current = false;
      }
    };

    checkAndExtendQueue();
  }, [currentTrack, isShuffle, primaryLanguage, mapToTrackPlayer]);

  const contextValue = useMemo(() => ({
    currentTrack,
    isPlaying,
    isBuffering,
    isAdPlaying,
    position: progress.position,
    duration: progress.duration,
    playTrack,
    togglePlayPause,
    seekTo,
    nextTrack,
    previousTrack,
    downloadCurrentTrack,
    checkDownloadStatus,
    skipAd,
    isDownloading,
    downloadProgress,
    downloadTitle,
    downloadSuccess,
    favoriteSongs,
    toggleFavoriteSong,
    isFavorite,
    isShuffle,
    toggleShuffle,
    loopMode,
    toggleLoopMode
  }), [
    currentTrack,
    isPlaying,
    isBuffering,
    isAdPlaying,
    progress.position,
    progress.duration,
    playTrack,
    togglePlayPause,
    seekTo,
    nextTrack,
    previousTrack,
    downloadCurrentTrack,
    checkDownloadStatus,
    skipAd,
    isDownloading,
    downloadProgress,
    downloadTitle,
    downloadSuccess,
    favoriteSongs,
    toggleFavoriteSong,
    isFavorite,
    isShuffle,
    toggleShuffle,
    fullQueue,
    loopMode,
    toggleLoopMode
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};
