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

function CountingNumber({ value, isLoading, style, prefix = '', suffix = '' }: { value: number; isLoading?: boolean; style: any; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = React.useState(value);
  const currentValRef = React.useRef(value);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const startVal = currentValRef.current;
    const targetVal = Math.round(value);

    if (startVal === targetVal) {
      setDisplayValue(targetVal);
      return;
    }

    let startTime: number | null = null;
    const duration = 600;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetVal - startVal) * eased);
      currentValRef.current = current;
      setDisplayValue(current);
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        currentValRef.current = targetVal;
        setDisplayValue(targetVal);
      }
    };
    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [value, isLoading]);

  if (isLoading) {
    return <Text style={style}>...</Text>;
  }

  return (
    <Text style={style}>
      {prefix}{Math.round(displayValue)}{suffix}
    </Text>
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
  baseTargetCalories?: number | null;
  activityCredit?: number;
  maintenanceCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
  burnedCalories?: number;
  underEatingThreshold?: number | null;
  isLoading?: boolean;
  date?: string;
}

export function DailySummaryCard({ 
  calories, protein, carbs, fat, 
  targetCalories, baseTargetCalories, activityCredit = 0,
  maintenanceCalories, targetProtein, targetCarbs, targetFat,
  burnedCalories = 0,
  underEatingThreshold,
  isLoading,
  date,
}: DailySummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showAlert } = useAlert();

  const tCals = targetCalories || 2000;
  const mCals = maintenanceCalories || tCals;
  const tPro = targetProtein || 150;
  const tCarbs = targetCarbs || 250;
  const tFat = targetFat || 70;

  const remainingCals = Math.max(0, tCals - calories);
  const getPercent = (current: number, max: number) => Math.min(100, (current / max) * 100);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const macroBg = isDark ? '#0F172A' : '#F1F5F9';
  
  // ── Under-eating and Over-eating Thresholds ──────────────────
  const isUnderEating = underEatingThreshold ? calories < underEatingThreshold : false;
  const surplus = calories - mCals;
  const isOverEatingCaution = surplus >= 500 && surplus <= 600;
  const isOverEatingAlert = surplus > 600;
  const hasAlert = isUnderEating || isOverEatingCaution || isOverEatingAlert;

  // Ring Color: Red for undereating, Dangerous Purple for overeating, Green for target
  let ringColor = isDark ? '#34D399' : '#10B981';
  if (isUnderEating) {
    ringColor = '#EF4444'; // Red
  } else if (isOverEatingAlert) {
    ringColor = '#9333EA'; // Intense Deep Purple
  } else if (isOverEatingCaution) {
    ringColor = '#A855F7'; // Dangerous Electric Purple
  }

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

  const isFirstLoadRef = React.useRef(true);
  const prevDateRef = React.useRef(date);
  const prevMetricsRef = React.useRef({ calories: -1, protein: -1, carbs: -1, fat: -1, tCals: -1, tPro: -1, tCarbs: -1, tFat: -1 });

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const prev = prevMetricsRef.current;
    const isDateChange = date !== undefined && date !== prevDateRef.current;
    prevDateRef.current = date;

    const hasChanged = 
      isDateChange ||
      prev.calories !== calories ||
      prev.protein !== protein ||
      prev.carbs !== carbs ||
      prev.fat !== fat ||
    prev.tCals !== tCals ||
      prev.tPro !== tPro ||
      prev.tCarbs !== tCarbs ||
      prev.tFat !== tFat;

    // If nothing changed (e.g. weight logged or returning from modal), skip entrance animation & haptics!
    if (!isFirstLoadRef.current && !hasChanged) {
      return;
    }

    prevMetricsRef.current = { calories, protein, carbs, fat, tCals, tPro, tCarbs, tFat };
    const isInitial = isFirstLoadRef.current;
    isFirstLoadRef.current = false;

    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    // Play structured haptic feedback on initial dashboard load
    if (isInitial) {
      const playHaptics = () => {
        for (let i = 0; i < 12; i++) {
          const timeOffset = 700 * Math.pow(i / 11, 1.5);
          timeoutIds.push(setTimeout(() => Haptics.selectionAsync(), 200 + timeOffset));
        }
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
      const barStagger = 150;

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
    } else {
      // Smooth animated transition for updates & date transitions + rich multi-step rotary haptic sequence
      const playUpdateHaptics = () => {
        // Rotary ticking as numbers roll and ring expands / shrinks
        for (let i = 0; i < 7; i++) {
          const delay = Math.round(500 * Math.pow(i / 6, 1.4));
          timeoutIds.push(setTimeout(() => Haptics.selectionAsync(), delay));
        }
        // Satisfying medium + heavy completion settle as macros lock in
        timeoutIds.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 550));
        timeoutIds.push(setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 680));
      };
      playUpdateHaptics();

      ringProgress.value = withTiming(calPercent, { duration: 600, easing: Easing.out(Easing.cubic) });
      proteinOpacity.value = 1;
      carbsOpacity.value = 1;
      fatOpacity.value = 1;
      proteinBarWidth.value = withTiming(getPercent(protein, tPro), { duration: 600, easing: Easing.out(Easing.cubic) });
      carbsBarWidth.value = withTiming(getPercent(carbs, tCarbs), { duration: 600, easing: Easing.out(Easing.cubic) });
      fatBarWidth.value = withTiming(getPercent(fat, tFat), { duration: 600, easing: Easing.out(Easing.cubic) });
    }

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [calories, protein, carbs, fat, calPercent, tPro, tCarbs, tFat, isLoading, date]);

  const [animatedRingPercent, setAnimatedRingPercent] = React.useState(0);
  const ringInitialRef = React.useRef(true);
  const prevRingPercentRef = React.useRef(0);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (ringInitialRef.current) {
      ringInitialRef.current = false;
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

      prevRingPercentRef.current = calPercent;
      return () => { cancelled = true; clearTimeout(timeout); };
    } else if (prevRingPercentRef.current !== calPercent) {
      let cancelled = false;
      let startTime: number | null = null;
      const duration = 600;
      const startPercent = prevRingPercentRef.current;
      const targetPercent = calPercent;

      const animate = (timestamp: number) => {
        if (cancelled) return;
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedRingPercent(startPercent + (targetPercent - startPercent) * eased);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);

      prevRingPercentRef.current = calPercent;
      return () => { cancelled = true; };
    }
  }, [calPercent, isLoading, date]);

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

  // Gentle breathing animation for warning/info indicators
  const breathingScale = useSharedValue(1);
  const breathingOpacity = useSharedValue(0.85);

  useEffect(() => {
    if (hasAlert) {
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
  }, [hasAlert]);

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathingScale.value }],
    opacity: breathingOpacity.value,
  }));

  const handleUnderEatingPress = () => {
    if (!underEatingThreshold) return;
    const diff = Math.round(underEatingThreshold - calories);
    showAlert(
      'Eat More to Fuel Your Body!',
      `You need ${Math.ceil(diff)} more kcal to hit your minimum requirement (${Math.round(underEatingThreshold)} kcal).\n\nEating too little causes muscle loss, severe energy drops, and metabolic adaptation. Make sure to properly fuel your body!`
    );
  };

  const handleOverEatingCautionPress = () => {
    const diff = Math.round(surplus);
    showAlert(
      'Time to Slow Down!',
      `You are currently ${diff} kcal above your daily maintenance level (${Math.round(mCals)} kcal).\n\nA moderate surplus is fine on occasion, but eating further above maintenance will lead to unwanted fat gain. Consider pacing your calorie intake for the rest of the day!`
    );
  };

  const handleOverEatingAlertPress = () => {
    const diff = Math.round(surplus);
    showAlert(
      'High Calorie Surplus Alert!',
      `You have consumed ${diff} kcal above your daily maintenance level today (${Math.round(calories)} kcal total vs ${Math.round(mCals)} kcal maintenance).\n\nA large surplus causes significant fat accumulation. If your goal is staying lean or managing weight, consider stopping further calorie consumption today and resetting fresh tomorrow!`
    );
  };

  const handleTargetBudgetPress = () => {
    if (activityCredit && activityCredit > 0 && baseTargetCalories) {
      const base = Math.round(baseTargetCalories);
      const credit = Math.round(activityCredit);
      const total = Math.round(tCals);
      const burned = Math.round(burnedCalories);
      showAlert(
        '⚡ Daily Calorie Budget',
        `• Base Goal: ${base} kcal\n• Activity Bonus: +${credit} kcal (70% of ${burned} kcal burned)\n─────────────────────\n• Total Target: ${total} kcal\n\nBurning calories through workouts increases your daily calorie allowance so you can fuel your recovery!`
      );
    }
  };

  const handleBurnedCardPress = () => {
    if (burnedCalories > 0) {
      const credit = activityCredit && activityCredit > 0 ? Math.round(activityCredit) : Math.round(burnedCalories * 0.7);
      showAlert(
        '🔥 Burned Calories',
        `You burned ${Math.round(burnedCalories)} kcal through exercise today.\n\n70% (+${credit} kcal) has been added to your daily calorie budget to properly fuel your activity.`
      );
    } else {
      showAlert(
        '🔥 Burned Calories',
        'Log your workouts or connect Health Connect to track burned calories and earn activity bonus calories automatically!'
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mainCard, { backgroundColor: cardBg }]}>
        
        {/* Undereating Icon (Red) */}
        {isUnderEating && (
          <Pressable style={styles.infoButton} onPress={handleUnderEatingPress}>
            <Animated.View style={breathingStyle}>
              <Ionicons name="information-circle" size={24} color="#EF4444" />
            </Animated.View>
          </Pressable>
        )}

        {/* Overeating Caution Icon (Purple - 500-600 surplus) */}
        {isOverEatingCaution && (
          <Pressable style={styles.infoButton} onPress={handleOverEatingCautionPress}>
            <Animated.View style={breathingStyle}>
              <Ionicons name="information-circle" size={24} color="#A855F7" />
            </Animated.View>
          </Pressable>
        )}

        {/* Overeating High Alert Icon (Intense Purple - >600 surplus) */}
        {isOverEatingAlert && (
          <Pressable style={styles.infoButton} onPress={handleOverEatingAlertPress}>
            <Animated.View style={breathingStyle}>
              <Ionicons name="warning" size={24} color="#A855F7" />
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
              <Pressable
                style={styles.centerRingContent}
                onPress={handleTargetBudgetPress}
                disabled={!activityCredit || activityCredit <= 0}
              >
                <Text style={[styles.ringLabel, { color: textSecondary }]}>Remaining</Text>
                <CountingNumber value={Math.round(remainingCals)} isLoading={isLoading} style={[styles.ringValue, { color: textPrimary }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <Text style={[styles.ringSub, { color: textSecondary }]}>/ {Math.round(tCals)} kcal</Text>
                  {activityCredit && activityCredit > 0 ? (
                    <Ionicons name="flash" size={11} color="#F59E0B" />
                  ) : null}
                </View>
              </Pressable>
            </PureCircularProgress>
          </View>

          <Pressable style={styles.sideStat} onPress={handleBurnedCardPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Burned</Text>
              <Ionicons name="information-circle-outline" size={11} color={textSecondary} />
            </View>
            <CountingNumber value={Math.round(burnedCalories)} isLoading={isLoading} style={[styles.sideStatValue, { color: '#F59E0B' }]} />
          </Pressable>
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
    marginBottom: 20,
  },
  mainCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
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
    marginBottom: 24,
  },
  sideStat: {
    flex: 1,
    alignItems: 'center',
  },
  sideStatLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  sideStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  centerRingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRingContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  ringValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ringSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
  },
  macroName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  macroAmount: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
