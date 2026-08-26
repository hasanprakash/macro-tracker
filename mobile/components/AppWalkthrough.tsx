import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = 'has_seen_walkthrough';

interface WalkthroughStep {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}

const STEPS: WalkthroughStep[] = [
  {
    icon: 'camera-outline',
    iconColor: '#10B981',
    iconBg: 'rgba(16, 185, 129, 0.15)',
    title: 'Scan or Describe',
    description: 'Take a photo of your meal or type what you ate — AI will estimate the calories and macros for you.',
  },
  {
    icon: 'barbell-outline',
    iconColor: '#F59E0B',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    title: 'Track Exercise',
    description: 'Log workouts with a quick description, or let Health Connect sync your daily steps automatically.',
  },
  {
    icon: 'analytics-outline',
    iconColor: '#60A5FA',
    iconBg: 'rgba(96, 165, 250, 0.15)',
    title: 'See Your Progress',
    description: 'Track daily calories, macro bars, and weight trends on the Insights tab.',
  },
  {
    icon: 'settings-outline',
    iconColor: '#8B5CF6',
    iconBg: 'rgba(139, 92, 246, 0.15)',
    title: 'Personalise Your Goals',
    description: 'Set your calorie target, macro goals, and body metrics in Settings to get accurate tracking.',
  },
];

interface AppWalkthroughProps {
  visible: boolean;
  onComplete: () => void;
}

export function AppWalkthrough({ visible, onComplete }: AppWalkthroughProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [currentStep, setCurrentStep] = useState(0);

  // Animation shared values
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.9);
  const iconScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(15);
  const backdropOpacity = useSharedValue(0);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const dotInactive = isDark ? '#334155' : '#E2E8F0';

  useEffect(() => {
    if (visible) {
      // Initial entrance
      backdropOpacity.value = withTiming(1, { duration: 300 });
      animateStepIn();
    }
  }, [visible]);

  const animateStepIn = () => {
    // Reset
    contentOpacity.value = 0;
    contentScale.value = 0.9;
    iconScale.value = 0;
    textOpacity.value = 0;
    textTranslateY.value = 15;

    // Animate in
    contentOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    contentScale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    iconScale.value = withDelay(150, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.2)) }));
    textOpacity.value = withDelay(250, withTiming(1, { duration: 300 }));
    textTranslateY.value = withDelay(250, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
  };

  const animateStepOut = (callback: () => void) => {
    contentOpacity.value = withTiming(0, { duration: 200 });
    contentScale.value = withTiming(0.95, { duration: 200 });
    // After animation completes, run callback on JS thread
    iconScale.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(callback)();
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      animateStepOut(() => {
        setCurrentStep(prev => prev + 1);
        animateStepIn();
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    backdropOpacity.value = withTiming(0, { duration: 250 });
    contentOpacity.value = withTiming(0, { duration: 200 });
    contentScale.value = withTiming(0.9, { duration: 200 }, () => {
      runOnJS(onComplete)();
    });
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Animated.View style={[styles.card, { backgroundColor: cardBg }, contentStyle]}>
          {/* Skip button */}
          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipText, { color: textSecondary }]}>Skip</Text>
          </Pressable>

          {/* Step counter */}
          <Text style={[styles.stepCounter, { color: textSecondary }]}>
            {currentStep + 1} of {STEPS.length}
          </Text>

          {/* Icon */}
          <Animated.View style={[styles.iconContainer, { backgroundColor: step.iconBg }, iconStyle]}>
            <Ionicons name={step.icon} size={40} color={step.iconColor} />
          </Animated.View>

          {/* Text content */}
          <Animated.View style={[styles.textContainer, textStyle]}>
            <Text style={[styles.title, { color: textPrimary }]}>
              {step.title}
            </Text>
            <Text style={[styles.description, { color: textSecondary }]}>
              {step.description}
            </Text>
          </Animated.View>

          {/* Dot indicators */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === currentStep ? '#6366F1' : dotInactive,
                    width: i === currentStep ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Next / Get Started button */}
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {isLastStep ? 'Get Started' : 'Next'}
            </Text>
            {!isLastStep && (
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  skipButton: {
    position: 'absolute',
    top: 20,
    right: 24,
    zIndex: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
