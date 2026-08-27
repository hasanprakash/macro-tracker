import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ExerciseEntry } from '@/lib/types';

interface ExerciseSectionProps {
  entries: ExerciseEntry[];
  onAddPress: () => void;
  onDeleteEntry: (entry: ExerciseEntry) => void;
  onStepsPress?: () => void;
}

const SMOOTH_EASING = Easing.bezier(0.25, 0.1, 0.25, 1.0);

export function ExerciseSection({ entries, onAddPress, onDeleteEntry, onStepsPress }: ExerciseSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [expanded, setExpanded] = React.useState(true); // default open

  // Track actual content height for precise animations
  const contentHeight = React.useRef(0);
  const animHeight = useSharedValue(2000); // Start with large value for initial render
  const animOpacity = useSharedValue(1);
  const chevronRotation = useSharedValue(1);
  const hasInitialized = React.useRef(false);

  const totalCalories = entries.reduce((sum, e) => sum + (e.calories_burned || 0), 0);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const entryBg = isDark ? '#0F172A' : '#F8FAFC';
  const color = '#3B82F6'; // Blue

  const toggleExpand = () => {
    const opening = !expanded;
    setExpanded(opening);

    if (opening) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const targetHeight = opening ? contentHeight.current : 0;
    animHeight.value = withTiming(targetHeight, { duration: 320, easing: SMOOTH_EASING });
    animOpacity.value = withTiming(opening ? 1 : 0, { duration: opening ? 280 : 200, easing: SMOOTH_EASING });
    chevronRotation.value = withTiming(opening ? 1 : 0, { duration: 280, easing: SMOOTH_EASING });
  };

  const handleContentLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      contentHeight.current = height;
      // On first layout when expanded by default, snap to measured height
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        animHeight.value = height;
      } else if (expanded) {
        // Content changed while expanded (e.g. entries added/removed)
        animHeight.value = withTiming(height, { duration: 250, easing: SMOOTH_EASING });
      }
    }
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
    marginLeft: 4,
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
    opacity: animOpacity.value,
    overflow: 'hidden' as const,
  }));

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.header} onPress={toggleExpand}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name="barbell-outline" size={20} color={color} />
          </View>
          <Text style={[styles.title, { color: textPrimary }]}>ACTIVITY</Text>
          {totalCalories > 0 && (
            <Text style={[styles.totalCal, { color: textSecondary }]}>
              ~{Math.round(totalCalories)} kcal burned
            </Text>
          )}
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color={textSecondary} />
          </Animated.View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: color + '18' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddPress();
          }}
        >
          <Ionicons name="add" size={20} color={color} />
        </Pressable>
      </Pressable>

      <Animated.View style={animatedContentStyle}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} onLayout={handleContentLayout}>
          {entries.length > 0 ? (
            <View style={styles.entriesList}>
              {entries.filter(e => e.exercise_type === 'Steps').length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: textSecondary }]}>Daily movement</Text>
                  {entries.filter(e => e.exercise_type === 'Steps').map((entry) => (

                      <TouchableOpacity 
                        key={entry.id} 
                        style={[styles.entryRow, { backgroundColor: entryBg }]}
                        activeOpacity={0.7}
                        onPress={onStepsPress}
                        disabled={!onStepsPress}
                      >
                        <View style={styles.entryInfo}>
                          <Text style={[styles.entryName, { color: textPrimary }]}>
                            {(entry.steps_count ?? -1) >= 0 ? `${(entry.steps_count ?? 0).toLocaleString()} Steps` : 'Steps Not Available'}
                          </Text>
                          {entry.description && (
                            <Text style={[styles.entryMacros, { color: textSecondary }]}>
                              {entry.description}
                            </Text>
                          )}
                        </View>
                        <View style={styles.entryRowRight}>
                          <Text style={[styles.entryCal, { color: textPrimary }]}>
                            ~{Math.round(entry.calories_burned)} kcal
                          </Text>
                        </View>
                      </TouchableOpacity>

                  ))}
                </>
              )}

              {entries.filter(e => e.exercise_type !== 'Steps').length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: textSecondary, marginTop: entries.filter(e => e.exercise_type === 'Steps').length > 0 ? 12 : 0 }]}>
                    Structured exercise
                  </Text>
                  {entries.filter(e => e.exercise_type !== 'Steps').map((entry) => (
                    <Swipeable
                      key={entry.id}
                      renderRightActions={() => (
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => onDeleteEntry(entry)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                        </Pressable>
                      )}
                    >
                      <View style={[styles.entryRow, { backgroundColor: entryBg }]}>
                        <View style={styles.entryInfo}>
                          <Text style={[styles.entryName, { color: textPrimary }]}>
                            {entry.exercise_type}
                          </Text>
                          {entry.description && (
                            <Text style={[styles.entryDesc, { color: textSecondary }]} numberOfLines={1}>
                              {entry.description}
                            </Text>
                          )}
                          <Text style={[styles.entryMacros, { color: textSecondary }]}>
                            {entry.duration_minutes} min • {entry.exercise_type}
                          </Text>
                        </View>
                        <View style={styles.entryRowRight}>
                          <Text style={[styles.entryCal, { color: textPrimary }]}>
                            ~{Math.round(entry.calories_burned)} kcal
                          </Text>
                        </View>
                      </View>
                    </Swipeable>
                  ))}
                </>
              )}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: textSecondary }]}>No activity logged yet</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  totalCal: { fontSize: 13, fontWeight: '500' },
  addButton: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 },
  entriesList: { marginTop: 12, gap: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 15, fontWeight: '600' },
  entryDesc: { fontSize: 13, marginTop: 2, fontStyle: 'italic' },
  entryMacros: { fontSize: 11, marginTop: 2 },
  entryRowRight: { flexDirection: 'row', alignItems: 'center' },
  entryCal: { fontSize: 15, fontWeight: '700', marginLeft: 12 },
  deleteButton: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 60, borderRadius: 12, marginLeft: 8 },
  emptyText: { marginTop: 12, fontSize: 13, fontStyle: 'italic' },
});
