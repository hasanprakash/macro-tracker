import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ExerciseEntry {
  id: string;
  exercise_type: string;
  description: string;
  duration_minutes: number;
  steps_count: number;
  calories_burned: number;
}

interface ExerciseSectionProps {
  entries: ExerciseEntry[];
  onAddPress: () => void;
  onDeleteEntry: (entry: ExerciseEntry) => void;
}

const MAX_HEIGHT = 800;

export function ExerciseSection({ entries, onAddPress, onDeleteEntry }: ExerciseSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [expanded, setExpanded] = React.useState(true); // default open

  const animHeight = useSharedValue(MAX_HEIGHT);
  const animOpacity = useSharedValue(1);
  const chevronRotation = useSharedValue(1);

  const totalCalories = entries.reduce((sum, e) => sum + (e.calories_burned || 0), 0);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const entryBg = isDark ? '#0F172A' : '#F8FAFC';
  const color = '#14B8A6'; // Teal

  const toggleExpand = () => {
    const opening = !expanded;
    setExpanded(opening);
    animHeight.value = withTiming(opening ? MAX_HEIGHT : 0, { duration: 300, easing: Easing.inOut(Easing.ease) });
    animOpacity.value = withTiming(opening ? 1 : 0, { duration: 250 });
    chevronRotation.value = withTiming(opening ? 1 : 0, { duration: 250 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
    marginLeft: 4,
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    maxHeight: animHeight.value,
    opacity: animOpacity.value,
    overflow: 'hidden',
  }));

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.header} onPress={toggleExpand}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name="barbell-outline" size={20} color={color} />
          </View>
          <Text style={[styles.title, { color: textPrimary }]}>Exercise</Text>
          {totalCalories > 0 && (
            <Text style={[styles.totalCal, { color: textSecondary }]}>
              {Math.round(totalCalories)} kcal burned
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
          onPress={onAddPress}
        >
          <Ionicons name="add" size={20} color={color} />
        </Pressable>
      </Pressable>

      <Animated.View style={animatedContentStyle}>
        {entries.length > 0 ? (
          <View style={styles.entriesList}>
            {entries.map((entry) => (
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
                      {entry.exercise_type === 'Steps' ? `${entry.steps_count} Steps` : (entry.description || entry.exercise_type)}
                    </Text>
                    {entry.exercise_type !== 'Steps' && (
                      <Text style={[styles.entryMacros, { color: textSecondary }]}>
                        {entry.duration_minutes} min • {entry.exercise_type}
                      </Text>
                    )}
                  </View>
                  <View style={styles.entryRowRight}>
                    <Text style={[styles.entryCal, { color: textPrimary }]}>
                      {Math.round(entry.calories_burned)} kcal
                    </Text>
                  </View>
                </View>
              </Swipeable>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: textSecondary }]}>No exercises logged yet</Text>
        )}
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
  entriesList: { marginTop: 12, gap: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 15, fontWeight: '600' },
  entryMacros: { fontSize: 11, marginTop: 2 },
  entryRowRight: { flexDirection: 'row', alignItems: 'center' },
  entryCal: { fontSize: 15, fontWeight: '700', marginLeft: 12 },
  deleteButton: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 60, borderRadius: 12, marginLeft: 8 },
  emptyText: { marginTop: 12, fontSize: 13, fontStyle: 'italic' },
});
