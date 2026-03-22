import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from 'react-native';
import { useAudio } from '@/context/AudioContext';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Theme } from '@/constants/Theme';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Download, Volume2, Repeat, Repeat1, Shuffle, Heart } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import SquigglySlider from '@/components/SquigglySlider';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import TrackPlayer, { RepeatMode } from 'react-native-track-player';
import * as Haptics from 'expo-haptics';

export default function PlayerScreen() {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    nextTrack, 
    previousTrack, 
    position, 
    duration, 
    seekTo,
    downloadCurrentTrack,
    toggleFavoriteSong,
    isFavorite,
    isShuffle,
    toggleShuffle,
    loopMode,
    toggleLoopMode
  } = useAudio();
  const router = useRouter();
  const [volume, setVolume] = useState(1);
  useEffect(() => {
    TrackPlayer.getVolume().then(setVolume);
  }, []);

  const handleVolumeChange = async (val: number) => {
    setVolume(val);
    await TrackPlayer.setVolume(val);
    Haptics.selectionAsync();
  };


  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={{ color: 'white' }}>No track selected</Text>
      </View>
    );
  }

  // Use the pre-mapped fields from currentTrack (AudioContext)
  const artwork = currentTrack.artwork || '';
  const artist = currentTrack.artist || 'Unknown Artist';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: artwork }} 
        style={StyleSheet.absoluteFill} 
        contentFit="cover"
        blurRadius={50}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <ChevronDown size={28} color={Theme.colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <Pressable onPress={downloadCurrentTrack} style={styles.iconButton}>
            <Download size={22} color={currentTrack.isDownloaded ? Theme.colors.accent : Theme.colors.white} />
          </Pressable>
        </View>

        <Animated.View entering={FadeIn.duration(400)} layout={LinearTransition} style={styles.artworkContainer}>
           <Image 
             source={{ uri: artwork || 'https://via.placeholder.com/500' }} 
             style={styles.largeArtwork} 
             contentFit="cover" 
             transition={500}
           />
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.duration(400)} 
          style={styles.infoContainer}
        >
          <Text style={styles.title} numberOfLines={1}>{currentTrack.name || currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
          
          <View style={styles.sliderContainer}>
            <SquigglySlider
              value={position}
              maximumValue={duration || 100}
              onSlidingComplete={seekTo}
              isPlaying={isPlaying}
              activeColor={Theme.colors.accent}
              inactiveColor="rgba(255,255,255,0.2)"
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.controlsRow}>
            <Pressable style={styles.secondaryControl} onPress={toggleShuffle}>
              <Shuffle size={20} color={isShuffle ? Theme.colors.accent : "rgba(255,255,255,0.5)"} />
            </Pressable>
            
            <View style={styles.mainControls}>
              <Pressable onPress={previousTrack} style={styles.controlButton}>
                <SkipBack size={32} color={Theme.colors.white} fill={Theme.colors.white} />
              </Pressable>
              
              <Pressable onPress={togglePlayPause} style={styles.playPauseButton}>
                {isPlaying ? (
                  <Pause size={40} color={Theme.colors.accent} fill={Theme.colors.accent} />
                ) : (
                  <Play size={40} color={Theme.colors.accent} fill={Theme.colors.accent} style={{ marginLeft: 4 }} />
                )}
              </Pressable>
              
              <Pressable onPress={nextTrack} style={styles.controlButton}>
                <SkipForward size={32} color={Theme.colors.white} fill={Theme.colors.white} />
              </Pressable>
            </View>

            <Pressable style={styles.secondaryControl} onPress={toggleLoopMode}>
              {loopMode === RepeatMode.Track ? (
                <Repeat1 size={20} color={Theme.colors.accent} />
              ) : (
                <Repeat 
                   size={20} 
                   color={loopMode === RepeatMode.Queue ? Theme.colors.accent : "rgba(255,255,255,0.5)"} 
                />
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
             <Volume2 size={18} color="rgba(255,255,255,0.6)" />
             <Slider
               style={styles.volumeSlider}
               step={0.05}
               minimumValue={0}
               maximumValue={1}
               value={volume}
               onValueChange={handleVolumeChange}
               minimumTrackTintColor="rgba(255,255,255,0.6)"
               maximumTrackTintColor="rgba(255,255,255,0.1)"
               thumbTintColor={Theme.colors.white}
             />
             <Pressable onPress={() => toggleFavoriteSong(currentTrack)} style={[styles.iconButton, { marginLeft: 8 }]}>
               <Heart 
                 size={24} 
                 color={isFavorite(currentTrack.id) ? Theme.colors.accent : Theme.colors.white} 
                 fill={isFavorite(currentTrack.id) ? Theme.colors.accent : 'transparent'} 
               />
             </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  } as ViewStyle,
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    justifyContent: 'space-between',
    paddingBottom: 60,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  headerTitle: {
    color: Theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    opacity: 0.7,
  } as TextStyle,
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  artworkContainer: {
    alignItems: 'center',
    marginVertical: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  } as ViewStyle,
  largeArtwork: {
    width: 320,
    height: 320,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  infoContainer: {
    width: '100%',
  } as ViewStyle,
  title: {
    color: Theme.colors.white,
    fontSize: 26,
    fontFamily: Theme.typography.family.serif,
    fontWeight: '700',
    marginBottom: 4,
  } as TextStyle,
  artist: {
    color: Theme.colors.accent,
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.9,
    marginBottom: 30,
  } as TextStyle,
  sliderContainer: {
    marginBottom: 30,
  } as ViewStyle,
  slider: {
    width: '100%',
    height: 40,
  } as ViewStyle,
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  } as ViewStyle,
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  } as ViewStyle,
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 30,
  } as ViewStyle,
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  secondaryControl: {
    padding: 10,
  } as ViewStyle,
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  volumeSlider: {
    flex: 1,
    height: 40,
    marginLeft: Theme.spacing.md,
  } as ViewStyle,
});
