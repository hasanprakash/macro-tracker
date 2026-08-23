import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

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
}

export function DailySummaryCard({ 
  calories, protein, carbs, fat, 
  targetCalories, targetProtein, targetCarbs, targetFat,
  burnedCalories = 0
}: DailySummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
  const ringColor = isDark ? '#34D399' : '#10B981'; // Emerald

  return (
    <View style={styles.container}>
      <View style={[styles.mainCard, { backgroundColor: cardBg }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: textPrimary }]}>Today's Progress</Text>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={14} color={textSecondary} />
            <Text style={[styles.dateText, { color: textSecondary }]}>DAY 1</Text>
          </View>
        </View>

        {/* Central Rings Row */}
        <View style={styles.ringsRow}>
          <View style={styles.sideStat}>
            <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Eaten</Text>
            <Text style={[styles.sideStatValue, { color: textPrimary }]}>{Math.round(calories)}</Text>
          </View>

          <View style={[styles.centerRing, { borderColor: ringColor, borderBottomColor: 'transparent' }]}>
            <Text style={[styles.ringLabel, { color: textSecondary }]}>Remaining</Text>
            <Text style={[styles.ringValue, { color: textPrimary }]}>{Math.round(remainingCals)}</Text>
            <Text style={[styles.ringSub, { color: textSecondary }]}>/ {Math.round(tCals)} kcal</Text>
          </View>

          <View style={styles.sideStat}>
            <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Burned</Text>
            <Text style={[styles.sideStatValue, { color: '#F59E0B' }]}>{Math.round(burnedCalories)}</Text>
          </View>
        </View>

        {/* Macros Row */}
        <View style={styles.macrosRow}>
          {/* Carbs */}
          <View style={[styles.macroCard, { backgroundColor: macroBg }]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Carbs</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{Math.round(carbs)} / {Math.round(tCarbs)}g</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${getPercent(carbs, tCarbs)}%`, backgroundColor: '#60A5FA' }]} />
            </View>
          </View>

          {/* Protein */}
          <View style={[styles.macroCard, { backgroundColor: macroBg }]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Protein</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{Math.round(protein)} / {Math.round(tPro)}g</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${getPercent(protein, tPro)}%`, backgroundColor: '#F43F5E' }]} />
            </View>
          </View>

          {/* Fat */}
          <View style={[styles.macroCard, { backgroundColor: macroBg }]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Fat</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{Math.round(fat)} / {Math.round(tFat)}g</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${getPercent(fat, tFat)}%`, backgroundColor: '#FBBF24' }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  mainCard: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
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
  centerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
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
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
