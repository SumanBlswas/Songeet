import React, { useState, useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Path } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withRepeat, 
  withTiming, 
  Easing, 
  withSpring,
  cancelAnimation
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SquigglySliderProps {
  value: number;
  maximumValue: number;
  onSlidingComplete?: (val: number) => void;
  onValueChange?: (val: number) => void;
  isPlaying: boolean;
  activeColor: string;
  inactiveColor: string;
}

export default function SquigglySlider({ 
  value, 
  maximumValue, 
  onSlidingComplete, 
  onValueChange,
  isPlaying, 
  activeColor, 
  inactiveColor 
}: SquigglySliderProps) {
  const [sliderWidth, setSliderWidth] = useState(0);
  
  // Animation values
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(0);

  const safeMax = maximumValue > 0 ? maximumValue : 1;
  const progress = Math.max(0, Math.min(1, value / safeMax));
  
  useEffect(() => {
    if (isPlaying) {
      amplitude.value = withSpring(4.5, { damping: 12, stiffness: 100 });
      phase.value = withRepeat(
        withTiming(phase.value + 1, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      amplitude.value = withSpring(0);
      cancelAnimation(phase);
    }
  }, [isPlaying]);

  const animatedActiveProps = useAnimatedProps(() => {
    if (sliderWidth === 0) return { d: '' };
    
    const fillWidth = progress * sliderWidth;
    const height = 40; 
    const midY = height / 2;
    const waveLength = 32; 
    
    let d = `M 0 ${midY}`;
    
    // Step by 1.5 pixels for extremely high quality smooth curves without pixelation
    for (let x = 0; x <= fillWidth; x += 1.5) {
      // Taper the amplitude at BOTH the start (x=0) and the thumb (x=fillWidth)
      // so the wave smoothly grows out of the straight line and merges back into the straight line
      const distFromStart = x;
      const distToThumb = fillWidth - x;
      
      let localAmplitude = amplitude.value;
      const taperDist = 18; // smooth over 18 pixels
      
      if (distFromStart < taperDist) {
        localAmplitude *= (distFromStart / taperDist);
      } else if (distToThumb < taperDist) {
        localAmplitude *= (distToThumb / taperDist);
      }
      
      const y = midY + Math.sin((x / waveLength - phase.value) * Math.PI * 2) * localAmplitude;
      d += ` L ${x} ${y}`;
    }
    
    // Ensure we perfectly meet the thumb center
    d += ` L ${fillWidth} ${midY}`;

    return { d };
  });

  const animatedInactiveProps = useAnimatedProps(() => {
    if (sliderWidth === 0) return { d: '' };
    const fillWidth = progress * sliderWidth;
    const height = 40;
    const midY = height / 2;
    
    // The straight inactive line goes from the thumb to the end
    return { d: `M ${fillWidth} ${midY} L ${sliderWidth} ${midY}` };
  });

  return (
    <View style={styles.container}>
      {/* SVG Background Layer */}
      <View 
        style={styles.svgContainer} 
        onLayout={(e: LayoutChangeEvent) => setSliderWidth(e.nativeEvent.layout.width - 32)}
      >
        {sliderWidth > 0 && (
          <Svg width={sliderWidth + 32} height={40} viewBox={`0 0 ${sliderWidth + 32} 40`} style={{ marginLeft: 16 }}>
            {/* The Inactive Straight Track */}
            <AnimatedPath
              animatedProps={animatedInactiveProps}
              fill="none"
              stroke={inactiveColor}
              strokeWidth={3}
              strokeLinecap="round"
            />
            
            {/* The Animated Squiggly Active Track */}
            <AnimatedPath
              animatedProps={animatedActiveProps}
              fill="none"
              stroke={activeColor}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>

      {/* Actual Interactive Slider on top */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={maximumValue}
        value={value}
        onSlidingComplete={onSlidingComplete}
        onValueChange={onValueChange}
        // Completely hide both native tracks to reveal the flawless SVG behind them
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor={activeColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  svgContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
