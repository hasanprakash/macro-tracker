import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
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

export function MealSection({ title, icon, color, entries, onAddPress, onDeleteEntry, onEditEntry }: MealSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const totalCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const entryBg = isDark ? '#0F172A' : '#F8FAFC';

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderColor }]}>
      {/* Section Header */}
      <View style={styles.header}>
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
      </View>

      {/* Logged foods */}
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
                  <Text style={[styles.entryName, { color: textPrimary }]}>{entry.meal_name}</Text>
                  <Text style={[styles.entryMacros, { color: textSecondary }]}>
                    P: {Math.round(entry.protein)}g · C: {Math.round(entry.carbs)}g · F: {Math.round(entry.fat)}g
                  </Text>
                </View>
                <View style={styles.entryRowRight}>
                  <Text style={[styles.entryCal, { color: textPrimary }]}>
                    {Math.round(entry.calories)} kcal
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
  entryMacros: {
    fontSize: 11,
    marginTop: 2,
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
