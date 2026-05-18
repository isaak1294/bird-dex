import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { Audio, AVPlaybackStatus } from 'expo-av';

type Props = { url: string };

export default function AudioPlayer({ url }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.durationMillis) {
      setProgress(status.positionMillis / status.durationMillis);
    }
    if (status.didJustFinish) {
      setPlaying(false);
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Unload previous
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (!mounted) return;

      setPlaying(false);
      setProgress(0);

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          onStatus
        );
        if (!mounted) { sound.unloadAsync(); return; }
        soundRef.current = sound;
        setPlaying(true);
      } catch { /* silent — URL might be unavailable */ }
    }

    load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [url, onStatus]);

  useEffect(() => {
    if (playing) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [playing, pulseAnim]);

  async function togglePlay() {
    const sound = soundRef.current;
    if (!sound) return;
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.playAsync();
      setPlaying(true);
    }
  }

  return (
    <View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale: pulseAnim }], opacity: playing ? 0.15 : 0 },
        ]}
      />

      {/* Play/Pause button */}
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.75 }]}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Pressable>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function PlayIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24">
      <Path d="M8 5v14l11-7z" fill="white" />
    </Svg>
  );
}

function PauseIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24">
      <Rect x="6" y="4" width="4" height="16" rx="1" fill="white" />
      <Rect x="14" y="4" width="4" height="16" rx="1" fill="white" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#1a2f40',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ffffff',
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#cc3333',
  },
});
