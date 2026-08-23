import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MEAL_STEPS = [
  { label: 'Identifying foods...', emoji: '🔍' },
  { label: 'Estimating portions...', emoji: '⚖️' },
  { label: 'Calculating nutrition...', emoji: '📊' },
  { label: 'Preparing results...', emoji: '✨' },
];

const EXERCISE_STEPS = [
  { label: 'Analyzing text...', emoji: '📝' },
  { label: 'Identifying exercise...', emoji: '🏃' },
  { label: 'Calculating intensity...', emoji: '🔥' },
  { label: 'Logging calories...', emoji: '✅' },
];

// Each step advances every 6 seconds, giving ~24s total before looping.
// The actual Gemini call usually finishes within 10-30s.
const STEP_DURATION_MS = 6000;

interface ScanningLoaderProps {
  type?: 'meal' | 'exercise';
}

export function ScanningLoader({ type = 'meal' }: ScanningLoaderProps) {
  const STEPS = type === 'meal' ? MEAL_STEPS : EXERCISE_STEPS;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [currentStep, setCurrentStep] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [fadeAnims] = useState([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]);

  // Pulse animation on the food emoji
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Step progression
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1;
        return prev; // Stay on last step
      });
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, []);

  // Fade in each step when it becomes active
  useEffect(() => {
    Animated.timing(fadeAnims[currentStep], {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  return (
    <View style={styles.container}>
      {/* Pulsing food emoji */}
      <Animated.Text style={[styles.mainEmoji, { transform: [{ scale: pulseAnim }] }]}>
        {type === 'meal' ? '🍛' : '💪'}
      </Animated.Text>

      <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
        {type === 'meal' ? 'Analyzing your meal' : 'Analyzing your workout'}
      </Text>

      <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
        {type === 'meal' ? 'Our AI is breaking down your food' : 'Our AI is estimating your calories'}
      </Text>

      {/* Steps list */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;

          return (
            <Animated.View
              key={index}
              style={[
                styles.stepRow,
                {
                  opacity: isPending ? 0.3 : fadeAnims[index],
                },
              ]}
            >
              <Text style={styles.stepIcon}>
                {isCompleted ? '✅' : isActive ? step.emoji : '○'}
              </Text>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: isCompleted
                      ? (isDark ? '#34D399' : '#059669')
                      : isActive
                        ? (isDark ? '#F8FAFC' : '#0F172A')
                        : (isDark ? '#475569' : '#CBD5E1'),
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {step.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  mainEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  stepsContainer: {
    width: '100%',
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  stepIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  stepLabel: {
    fontSize: 16,
  },
});
