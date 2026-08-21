import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DailySummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
}

export function DailySummaryCard({ 
  calories, protein, carbs, fat, 
  targetCalories, targetProtein, targetCarbs, targetFat 
}: DailySummaryProps) {
  const getPercent = (current: number, target?: number | null, fallbackMax: number = 100) => {
    const max = (target && target > 0) ? target : fallbackMax;
    return Math.min(100, (current / max) * 100);
  };
  return (
    <View style={[styles.summaryCard, { backgroundColor: '#6366F1' }]}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Today's Progress</Text>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>Day 1</Text>
        </View>
      </View>

      <View style={styles.caloriesContainer}>
        <View style={styles.caloriesHeader}>
          <Text style={styles.caloriesLabel}>Calories</Text>
          <Text style={styles.caloriesValue}>
            {Math.round(calories)}
            {targetCalories ? <Text style={styles.caloriesTargetText}> / {Math.round(targetCalories)} kcal</Text> : <Text style={styles.caloriesTargetText}> kcal</Text>}
          </Text>
        </View>
        <View style={[styles.macroBar, { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <View style={[styles.macroBarFill, { width: `${getPercent(calories, targetCalories, 2000)}%`, backgroundColor: '#FCD34D' }]} />
        </View>
      </View>

      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>
            {Math.round(protein)}
            {targetProtein ? <Text style={styles.macroTargetText}>/{Math.round(targetProtein)}</Text> : null}g
          </Text>
          <Text style={styles.macroLabel}>Protein</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${getPercent(protein, targetProtein, 150)}%`, backgroundColor: '#34D399' }]} />
          </View>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>
            {Math.round(carbs)}
            {targetCarbs ? <Text style={styles.macroTargetText}>/{Math.round(targetCarbs)}</Text> : null}g
          </Text>
          <Text style={styles.macroLabel}>Carbs</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${getPercent(carbs, targetCarbs, 250)}%`, backgroundColor: '#60A5FA' }]} />
          </View>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>
            {Math.round(fat)}
            {targetFat ? <Text style={styles.macroTargetText}>/{Math.round(targetFat)}</Text> : null}g
          </Text>
          <Text style={styles.macroLabel}>Fat</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${getPercent(fat, targetFat, 70)}%`, backgroundColor: '#FB923C' }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  caloriesContainer: {
    marginBottom: 24,
  },
  caloriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  caloriesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  caloriesValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  caloriesTargetText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  macroTargetText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroBar: {
    width: '80%',
    height: 4,
    borderRadius: 2,
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  macroDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 4,
  },
});
