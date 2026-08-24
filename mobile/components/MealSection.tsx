import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MealEntry } from '@/lib/types';

interface MealSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  entries: MealEntry[];
  onAddPress: () => void;
  onDeleteEntry: (entry: MealEntry) => void;
  onEditEntry: (entry: MealEntry) => void;
}

// A large enough value to cover any realistic meal list height
const MAX_HEIGHT = 800;

export function MealSection({ title, icon, color, entries, onAddPress, onDeleteEntry, onEditEntry }: MealSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [expanded, setExpanded] = React.useState(false);

  const animHeight = useSharedValue(0);
  const animOpacity = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  const totalCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const entryBg = isDark ? '#0F172A' : '#F8FAFC';

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
      {/* Section Header */}
      <Pressable style={styles.header} onPress={toggleExpand}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={[styles.title, { color: textPrimary }]}>{title}</Text>
          {totalCalories > 0 && (
            <Text style={[styles.totalCal, { color: textSecondary }]}>
              {Math.round(totalCalories)} kcal
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

      {/* Animated content — always rendered, height slides from 0 to MAX_HEIGHT */}
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
                <TouchableOpacity
                  style={[styles.entryRow, { backgroundColor: entryBg }]}
                  onPress={() => onEditEntry(entry)}
                  activeOpacity={0.7}
                >
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryName, { color: textPrimary }]} numberOfLines={1}>
                      {entry.title || entry.meal_name}
                    </Text>
                    {entry.meal_name && entry.meal_name !== entry.title && (
                      <Text style={[styles.entryDesc, { color: textSecondary }]} numberOfLines={1}>
                        {entry.meal_name}
                      </Text>
                    )}
                    <Text style={[styles.entryMacros, { color: textSecondary }]}>
                      Protein: {Math.round(entry.protein)}g • Carbs: {Math.round(entry.carbs)}g • Fat: {Math.round(entry.fat)}g
                    </Text>
                  </View>
                  <View style={styles.entryRowRight}>
                    <Text style={[styles.entryCal, { color: textPrimary }]}>
                      {Math.round(entry.calories || 0)} kcal
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={textSecondary} style={{ marginLeft: 4 }} />
                  </View>
                </TouchableOpacity>
              </Swipeable>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: textSecondary }]}>No meals logged yet</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  totalCal: {
    fontSize: 13,
    fontWeight: '500',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entriesList: {
    marginTop: 12,
    gap: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  entryDesc: {
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  entryMacros: {
    fontSize: 12,
    marginTop: 4,
  },
  entryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryCal: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    borderRadius: 12,
    marginLeft: 8,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
