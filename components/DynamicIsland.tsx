import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { Theme } from '@/constants/Theme';
import { useAudio } from '@/context/AudioContext';
import { Check } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

export default function DynamicIsland() {
  const { isDownloading, downloadProgress, downloadTitle, downloadSuccess } = useAudio();

  const width = useSharedValue(120);
  const height = useSharedValue(36);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isDownloading && !downloadSuccess) {
      // Expand to show progress
      width.value = withSpring(220, { damping: 14, stiffness: 120 });
      height.value = withSpring(48, { damping: 14, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 300 });
    } else if (downloadSuccess) {
      // Widen slightly and show success
      width.value = withSpring(180, { damping: 12, stiffness: 100 });
      height.value = withSpring(44, { damping: 12, stiffness: 100 });
    } else {
      // Collapse
      opacity.value = withTiming(0, { duration: 400 });
      width.value = withTiming(100, { duration: 400 });
      height.value = withTiming(36, { duration: 400 });
    }
  }, [isDownloading, downloadSuccess, width, height, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: width.value,
      height: height.value,
      opacity: opacity.value,
    };
  });

  // We avoid reading .value during render to stop the Reanimated warning.
  // The animatedStyle with opacity handles visibility naturally.
  const percent = Math.round(downloadProgress * 100);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.island, animatedStyle]}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

        {downloadSuccess ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.successContent}>
            <View style={styles.successIconWrap}>
              <Check size={14} color="#fff" strokeWidth={3} />
            </View>
            <Text style={styles.successText}>Downloaded</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.downloadContent}>
            <View style={styles.leftSide}>
              <ActivityIndicator size="small" color={Theme.colors.accent} />
              <View style={styles.textWrap}>
                <Text style={styles.titletxt} numberOfLines={1}>Downloading</Text>
                <Text style={styles.subtxt} numberOfLines={1}>{downloadTitle || 'Song'}</Text>
              </View>
            </View>
            <Text style={styles.percentTxt}>{percent}%</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    zIndex: 9999,
  },
  island: {
    marginTop: 45, // sits right below the very top notch/camera
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  downloadContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  textWrap: {
    marginLeft: 12,
    flex: 1,
  },
  titletxt: {
    color: Theme.colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '500',
  },
  percentTxt: {
    color: Theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  successContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  successIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759', // Green flag color requested by user
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  successText: {
    color: Theme.colors.white,
    fontSize: 14,
    fontWeight: '800',
  }
});
