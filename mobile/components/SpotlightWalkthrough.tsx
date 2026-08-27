import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
  ScrollView as RNScrollView,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = 'has_seen_walkthrough';
const TOOLTIP_PADDING = 20;

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WalkthroughStep {
  text: string;
  targetKey: string;
  tooltipPosition: 'above' | 'below';
  showImage?: boolean;
}

const STEPS: WalkthroughStep[] = [
  {
    text: 'Your daily calories and macros at a glance — watch them fill up as you log meals.',
    targetKey: 'dailySummary',
    tooltipPosition: 'below',
  },
  {
    text: 'Tap + to log a meal — describe, or scan, or both 👀. AI handles the rest.',
    targetKey: 'mealSections',
    tooltipPosition: 'below',
  },
  {
    text: 'Log workouts here — burned calories count towards your daily calorie budget.',
    targetKey: 'exerciseSection',
    tooltipPosition: 'below',
  },
  {
    text: 'Track your weight consistently to see how it changes with your calorie intake.',
    targetKey: 'weightSection',
    tooltipPosition: 'above',
  },
  {
    text: 'Tap here to visualize your progress with calorie and weight trend graphs.',
    targetKey: 'insightsTab',
    tooltipPosition: 'above',
    showImage: true,
  },
];

interface SpotlightWalkthroughProps {
  visible: boolean;
  onComplete: () => void;
  targetRefs: Record<string, React.RefObject<View | null>>;
  scrollViewRef: React.RefObject<RNScrollView | null>;
  rootRef: React.RefObject<View | null>;
  scrollOffsetRef: React.MutableRefObject<number>;
}

export function SpotlightWalkthrough({
  visible,
  onComplete,
  targetRefs,
  scrollViewRef,
  rootRef,
  scrollOffsetRef,
}: SpotlightWalkthroughProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Animation values
  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const tooltipTranslateY = useSharedValue(12);
  const cutoutOpacity = useSharedValue(0);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const dotInactive = isDark ? '#334155' : '#E2E8F0';

  const measureTarget = useCallback((stepIndex: number) => {
    const step = STEPS[stepIndex];
    const ref = targetRefs[step.targetKey];

    if (!ref?.current) {
      // For insightsTab, use bottom-of-screen position
      if (step.targetKey === 'insightsTab') {
        const tabHeight = 60;
        const tabWidth = SCREEN_WIDTH / 2; // 2 tabs currently
        setTargetRect({
          x: tabWidth, // Second tab
          y: SCREEN_HEIGHT - tabHeight,
          width: tabWidth,
          height: tabHeight,
        });
        animateIn();
      }
      return;
    }

    if (!rootRef.current) return;

    rootRef.current.measure((rootX, rootY, rootW, rootH, rootPageX, rootPageY) => {
      ref.current!.measure((x, y, width, height, pageX, pageY) => {
        if (width === 0 && height === 0) return;

        const relativeX = pageX - rootPageX;
        const relativeY = pageY - rootPageY;

        // Add some padding around the target
        const padding = 6;
        setTargetRect({
          x: Math.max(0, relativeX - padding),
          y: Math.max(0, relativeY - padding),
          width: width + padding * 2,
          height: height + padding * 2,
        });
        animateIn();
      });
    });
  }, [targetRefs, rootRef]);

  const animateIn = useCallback(() => {
    setIsReady(true);
    overlayOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    cutoutOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    tooltipOpacity.value = withDelay(150, withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) }));
    tooltipTranslateY.value = withDelay(150, withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animateOut = useCallback((callback: () => void) => {
    tooltipOpacity.value = withTiming(0, { duration: 180 });
    tooltipTranslateY.value = withTiming(8, { duration: 180 });
    cutoutOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(callback)();
    });
  }, []);

  const scrollToTarget = useCallback((stepIndex: number) => {
    const step = STEPS[stepIndex];
    const ref = targetRefs[step.targetKey];

    if (!ref?.current || !scrollViewRef?.current) {
      // Small delay then measure for non-scrollable targets (insightsTab)
      setTimeout(() => measureTarget(stepIndex), 100);
      return;
    }

    if (!rootRef.current) return;

    rootRef.current.measure((rootX, rootY, rootW, rootH, rootPageX, rootPageY) => {
      ref.current!.measure((x, y, width, height, pageX, pageY) => {
        const relativeY = pageY - rootPageY;
        const visibleTop = 0;
        const visibleBottom = SCREEN_HEIGHT - 100; // account for tab bar

        if (relativeY < visibleTop || relativeY + height > visibleBottom) {
          // Need to scroll
          const targetScroll = scrollOffsetRef.current + relativeY - 120; // 120px from top
          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetScroll), animated: false });
          // Wait for layout to update, then measure again
          setTimeout(() => measureTarget(stepIndex), 150);
        } else {
          measureTarget(stepIndex);
        }
      });
    });
  }, [targetRefs, scrollViewRef, scrollOffsetRef, measureTarget, rootRef]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (visible) {
      setCurrentStep(0);
      // Initial delay to let the home screen render fully
      timeout = setTimeout(() => scrollToTarget(0), 400);
    } else {
      overlayOpacity.value = 0;
      tooltipOpacity.value = 0;
      cutoutOpacity.value = 0;
      setIsReady(false);
      setTargetRect(null);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [visible]);

  const goToStep = useCallback((nextStep: number) => {
    Haptics.selectionAsync();
    animateOut(() => {
      setTargetRect(null);
      setIsReady(false);
      setCurrentStep(nextStep);
      scrollToTarget(nextStep);
    });
  }, [animateOut, scrollToTarget]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    } else {
      handleFinish();
    }
  }, [currentStep, goToStep]);

  const handleSkip = useCallback(() => {
    handleFinish();
  }, []);

  const handleFinish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    overlayOpacity.value = withTiming(0, { duration: 250 });
    tooltipOpacity.value = withTiming(0, { duration: 200 });
    tooltipTranslateY.value = withTiming(8, { duration: 200 });
    cutoutOpacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(onComplete)();
    });
  }, [onComplete]);

  // Animated styles
  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tooltipAnimStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ translateY: tooltipTranslateY.value }],
  }));

  if (!visible || !isReady || !targetRect) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // Calculate tooltip position
  const tooltipTop = step.tooltipPosition === 'below'
    ? targetRect.y + targetRect.height + 16
    : undefined;
  const tooltipBottom = step.tooltipPosition === 'above'
    ? SCREEN_HEIGHT - targetRect.y + 16
    : undefined;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Dark overlay with cutout - using 4 rectangles */}
      <Animated.View style={[StyleSheet.absoluteFill, overlayAnimStyle]} pointerEvents="box-none">
        {/* Top region */}
        <View
          style={[styles.overlayRegion, {
            top: 0,
            left: 0,
            right: 0,
            height: targetRect.y,
          }]}
          pointerEvents="auto"
        />
        {/* Bottom region */}
        <View
          style={[styles.overlayRegion, {
            top: targetRect.y + targetRect.height,
            left: 0,
            right: 0,
            bottom: 0,
          }]}
          pointerEvents="auto"
        />
        {/* Left region */}
        <View
          style={[styles.overlayRegion, {
            top: targetRect.y,
            left: 0,
            width: targetRect.x,
            height: targetRect.height,
          }]}
          pointerEvents="auto"
        />
        {/* Right region */}
        <View
          style={[styles.overlayRegion, {
            top: targetRect.y,
            left: targetRect.x + targetRect.width,
            right: 0,
            height: targetRect.height,
          }]}
          pointerEvents="auto"
        />

        {/* Cutout border glow */}
        <View
          style={[styles.cutoutBorder, {
            top: targetRect.y - 2,
            left: targetRect.x - 2,
            width: targetRect.width + 4,
            height: targetRect.height + 4,
          }]}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Tooltip */}
      <Animated.View
        style={[
          styles.tooltip,
          { backgroundColor: cardBg },
          tooltipAnimStyle,
          tooltipTop !== undefined ? { top: tooltipTop } : {},
          tooltipBottom !== undefined ? { bottom: tooltipBottom } : {},
        ]}
        pointerEvents="auto"
      >
        {/* Preview image for Insights step */}
        {step.showImage && (
          <View style={styles.previewImageContainer}>
            <Image
              source={require('@/assets/images/insights-preview.jpg')}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <Text style={[styles.previewCaption, { color: textSecondary }]}>
              What 1 month of consistency looks like
            </Text>
          </View>
        )}

        {/* Step text */}
        <Text style={[styles.tooltipText, { color: textPrimary }]}>
          {step.text}
        </Text>

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentStep ? '#6366F1' : dotInactive,
                  width: i === currentStep ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          {!isLastStep ? (
            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
              onPress={handleSkip}
            >
              <Text style={[styles.skipBtnText, { color: textSecondary }]}>Skip</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.nextBtnText}>
              {isLastStep ? 'Got it' : 'Next'}
            </Text>
            {!isLastStep && (
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </Pressable>
        </View>
      </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRegion: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  cutoutBorder: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  tooltip: {
    position: 'absolute',
    left: TOOLTIP_PADDING,
    right: TOOLTIP_PADDING,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  previewImageContainer: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  previewCaption: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
    letterSpacing: 0.2,
  },
  tooltipText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
