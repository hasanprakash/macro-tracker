import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/components/ui/CustomAlert';
import * as Haptics from 'expo-haptics';

import { TextInput } from 'react-native';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function CountingNumber({ value, isLoading, style, prefix = '', suffix = '' }: { value: number; isLoading?: boolean; style: any; prefix?: string; suffix?: string }) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      animatedValue.value = 0;
    } else {
      animatedValue.value = withDelay(200, withTiming(value, { duration: 800, easing: Easing.out(Easing.cubic) }));
    }
  }, [value, isLoading]);

  const animatedProps = useAnimatedProps(() => {
    return {
      text: isLoading ? '...' : `${prefix}${Math.round(animatedValue.value)}${suffix}`,
    } as any;
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      value={isLoading ? '...' : `${prefix}${Math.round(value)}${suffix}`}
      animatedProps={animatedProps}
      style={[style, { padding: 0, margin: 0 }]}
    />
  );
}

const PureCircularProgress = ({ size, strokeWidth, progress, ringColor, trackColor, cardBg, children }: any) => {
  const half = size / 2;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  const leftRotate = clampedProgress >= 50 ? 180 : 45 + (clampedProgress / 50) * 135;
  const rightRotate = clampedProgress <= 50 ? 0 : ((clampedProgress - 50) / 50) * 135;
  const tipRotation = 225 + (clampedProgress / 100) * 270;

  const S = size;
  const topOffset = S * 0.7071 - half;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      
      {/* 1. Base Track (Full Circle) */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: half,
        borderWidth: strokeWidth, borderColor: trackColor
      }} />
      
      {/* 2. Progress Left */}
      <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: 0, width: size, height: size,
          transform: [{ rotate: `${leftRotate}deg` }]
        }}>
          {/* Half-Ring for the right side */}
          <View style={{ position: 'absolute', right: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', right: 0, width: size, height: size, borderRadius: half,
              borderWidth: strokeWidth, borderColor: ringColor
            }} />
          </View>
        </View>
      </View>

      {/* 3. Progress Right */}
      <View style={{ position: 'absolute', right: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', right: 0, width: size, height: size,
          transform: [{ rotate: `${rightRotate}deg` }]
        }}>
          {/* Half-Ring for the left side */}
          <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', left: 0, width: size, height: size, borderRadius: half,
              borderWidth: strokeWidth, borderColor: ringColor
            }} />
          </View>
        </View>
      </View>

      {/* 4. Gap Cutout (Masks the overlapping arcs in the bottom gap) */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: size, height: half, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: 0, top: topOffset, width: size, height: size,
          backgroundColor: cardBg,
          transform: [{ rotate: '45deg' }]
        }} />
      </View>

      {/* 5. Rounded Caps for Track Ends */}
      <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: '225deg' }] }}>
        <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: trackColor }} />
      </View>
      <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: '135deg' }] }}>
        <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: trackColor }} />
      </View>

      {/* 6. Rounded Caps for Progress Ends */}
      {clampedProgress > 0 && (
        <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: '225deg' }] }}>
          <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: ringColor }} />
        </View>
      )}
      {clampedProgress > 0 && (
        <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${tipRotation}deg` }] }}>
          <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: ringColor }} />
        </View>
      )}

      {children}
    </View>
  );
};

interface DailySummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
  burnedCalories?: number;
  underEatingThreshold?: number | null;
  isLoading?: boolean;
}

export function DailySummaryCard({ 
  calories, protein, carbs, fat, 
  targetCalories, targetProtein, targetCarbs, targetFat,
  burnedCalories = 0,
  underEatingThreshold,
  isLoading
}: DailySummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showAlert } = useAlert();

  const tCals = targetCalories || 2000;
  const tPro = targetProtein || 150;
  const tCarbs = targetCarbs || 250;
  const tFat = targetFat || 70;

  const remainingCals = Math.max(0, tCals - calories);
  const getPercent = (current: number, max: number) => Math.min(100, (current / max) * 100);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const macroBg = isDark ? '#0F172A' : '#F1F5F9';
  
  const isUnderEating = underEatingThreshold ? calories < underEatingThreshold : false;
  const ringColor = isUnderEating ? '#EF4444' : (isDark ? '#34D399' : '#10B981');
  const trackColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  // ── Entrance Animations ────────────────────────────────────
  const ringProgress = useSharedValue(0);

  // Macro bar widths (animated)
  const proteinBarWidth = useSharedValue(0);
  const carbsBarWidth = useSharedValue(0);
  const fatBarWidth = useSharedValue(0);

  // Macro card opacity (staggered fade-in)
  const proteinOpacity = useSharedValue(0);
  const carbsOpacity = useSharedValue(0);
  const fatOpacity = useSharedValue(0);

  const calPercent = getPercent(calories, tCals);

  useEffect(() => {
    if (isLoading) {
      ringProgress.value = 0;
      proteinBarWidth.value = 0;
      carbsBarWidth.value = 0;
      fatBarWidth.value = 0;
      proteinOpacity.value = 0;
      carbsOpacity.value = 0;
      fatOpacity.value = 0;
      return;
    }

    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    // Play structured haptic feedback sequence alongside animations
    const playHaptics = () => {
      // Ring sweeping up (12 ticks, decelerating frequency)
      for (let i = 0; i < 12; i++) {
        const timeOffset = 700 * Math.pow(i / 11, 1.5);
        timeoutIds.push(setTimeout(() => Haptics.selectionAsync(), 200 + timeOffset));
      }
      // Macro bars hitting (staggered delay 1100, 1250, 1400)
      timeoutIds.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1100));
      timeoutIds.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1250));
      timeoutIds.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1400));
      timeoutIds.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1510));
      
    };
    playHaptics();

    // Ring progress — animate after card appears
    ringProgress.value = 0;
    ringProgress.value = withDelay(200, withTiming(calPercent, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // Macro bars — staggered after ring finishes
    const barDelay = 1100;
    const barDuration = 700;
    const barEasing = Easing.out(Easing.cubic);
    const barStagger = 150; // Increased stagger from 120ms to 150ms for better distinction

    proteinBarWidth.value = 0;
    carbsBarWidth.value = 0;
    fatBarWidth.value = 0;
    proteinOpacity.value = 0;
    carbsOpacity.value = 0;
    fatOpacity.value = 0;

    proteinOpacity.value = withDelay(barDelay, withTiming(1, { duration: 300 }));
    proteinBarWidth.value = withDelay(barDelay, withTiming(getPercent(protein, tPro), { duration: barDuration, easing: barEasing }));

    carbsOpacity.value = withDelay(barDelay + barStagger, withTiming(1, { duration: 300 }));
    carbsBarWidth.value = withDelay(barDelay + barStagger, withTiming(getPercent(carbs, tCarbs), { duration: barDuration, easing: barEasing }));

    fatOpacity.value = withDelay(barDelay + barStagger * 2, withTiming(1, { duration: 300 }));
    fatBarWidth.value = withDelay(barDelay + barStagger * 2, withTiming(getPercent(fat, tFat), { duration: barDuration, easing: barEasing }));

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [calories, protein, carbs, fat, calPercent, tPro, tCarbs, tFat, isLoading]);

  const [animatedRingPercent, setAnimatedRingPercent] = React.useState(0);
  useEffect(() => {
    if (isLoading) {
      setAnimatedRingPercent(0);
      return;
    }

    let cancelled = false;
    let startTime: number | null = null;
    const duration = 800;
    const delay = 200;

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (cancelled) return;
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedRingPercent(calPercent * eased);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [calPercent, isLoading]);

  const proteinBarStyle = useAnimatedStyle(() => ({
    width: `${proteinBarWidth.value}%` as any,
    backgroundColor: '#F43F5E',
  }));

  const carbsBarStyle = useAnimatedStyle(() => ({
    width: `${carbsBarWidth.value}%` as any,
    backgroundColor: '#60A5FA',
  }));

  const fatBarStyle = useAnimatedStyle(() => ({
    width: `${fatBarWidth.value}%` as any,
    backgroundColor: '#FBBF24',
  }));

  const proteinCardStyle = useAnimatedStyle(() => ({ opacity: proteinOpacity.value }));
  const carbsCardStyle = useAnimatedStyle(() => ({ opacity: carbsOpacity.value }));
  const fatCardStyle = useAnimatedStyle(() => ({ opacity: fatOpacity.value }));

  // Gentle breathing animation for undereating indicator
  const breathingScale = useSharedValue(1);
  const breathingOpacity = useSharedValue(0.85);

  useEffect(() => {
    if (isUnderEating) {
      breathingScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      breathingOpacity.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.75, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      breathingScale.value = 1;
      breathingOpacity.value = 1;
    }
  }, [isUnderEating]);

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathingScale.value }],
    opacity: breathingOpacity.value,
  }));

  const handleInfoPress = () => {
    if (!underEatingThreshold) return;
    const diff = Math.round(underEatingThreshold - calories);
    showAlert(
      'Eat More to Fuel Your Body!',
      `You need ${Math.ceil(diff)} more kcal to hit your minimum requirement.\n\nEating too little causes muscle loss, severe energy drops, and metabolic adaptation. Make sure to properly fuel your body!`
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mainCard, { backgroundColor: cardBg }]}>
        
        {isUnderEating && (
          <Pressable style={styles.infoButton} onPress={handleInfoPress}>
            <Animated.View style={breathingStyle}>
              <Ionicons name="information-circle" size={24} color="#EF4444" />
            </Animated.View>
          </Pressable>
        )}
        
        {/* Central Rings Row */}
        <View style={styles.ringsRow}>
          <View style={styles.sideStat}>
            <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Eaten</Text>
            <CountingNumber value={Math.round(calories)} isLoading={isLoading} style={[styles.sideStatValue, { color: textPrimary }]} />
          </View>

          <View style={styles.centerRingWrapper}>
            <PureCircularProgress
              size={160}
              strokeWidth={10}
              progress={animatedRingPercent}
              ringColor={ringColor}
              trackColor={trackColor}
              cardBg={cardBg}
            >
              <View style={styles.centerRingContent}>
                <Text style={[styles.ringLabel, { color: textSecondary }]}>Remaining</Text>
                <CountingNumber value={Math.round(remainingCals)} isLoading={isLoading} style={[styles.ringValue, { color: textPrimary }]} />
                <Text style={[styles.ringSub, { color: textSecondary }]}>/ {Math.round(tCals)} kcal</Text>
              </View>
            </PureCircularProgress>
          </View>

          <View style={styles.sideStat}>
            <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Burned</Text>
            <CountingNumber value={Math.round(burnedCalories)} isLoading={isLoading} style={[styles.sideStatValue, { color: '#F59E0B' }]} />
          </View>
        </View>

        {/* Macros Row */}
        <View style={styles.macrosRow}>
          {/* Protein */}
          <Animated.View style={[styles.macroCard, { backgroundColor: macroBg }, proteinCardStyle]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Protein</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{isLoading ? '...' : `${Math.round(protein)} / ${Math.round(tPro)}g`}</Text>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, proteinBarStyle]} />
            </View>
          </Animated.View>

          {/* Carbs */}
          <Animated.View style={[styles.macroCard, { backgroundColor: macroBg }, carbsCardStyle]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Carbs</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{isLoading ? '...' : `${Math.round(carbs)} / ${Math.round(tCarbs)}g`}</Text>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, carbsBarStyle]} />
            </View>
          </Animated.View>

          {/* Fat */}
          <Animated.View style={[styles.macroCard, { backgroundColor: macroBg }, fatCardStyle]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Fat</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{isLoading ? '...' : `${Math.round(fat)} / ${Math.round(tFat)}g`}</Text>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, fatBarStyle]} />
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mainCard: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    position: 'relative',
  },
  infoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sideStat: {
    alignItems: 'center',
    width: 70,
  },
  sideStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  sideStatValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  centerRingWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  ringValue: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 2,
  },
  ringSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
  },
  macroName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  macroAmount: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(150,150,150,0.2)',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
