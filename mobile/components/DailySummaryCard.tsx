import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DailySummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function DailySummaryCard({ calories, protein, carbs, fat }: DailySummaryProps) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: '#6366F1' }]}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Today's Progress</Text>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>Day 1</Text>
        </View>
      </View>

      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(calories)}</Text>
          <Text style={styles.macroLabel}>Calories</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${Math.min(100, (calories / 2000) * 100)}%`, backgroundColor: '#FCD34D' }]} />
          </View>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(protein)}g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${Math.min(100, (protein / 150) * 100)}%`, backgroundColor: '#34D399' }]} />
          </View>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(carbs)}g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${Math.min(100, (carbs / 250) * 100)}%`, backgroundColor: '#60A5FA' }]} />
          </View>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{Math.round(fat)}g</Text>
          <Text style={styles.macroLabel}>Fat</Text>
          <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.macroBarFill, { width: `${Math.min(100, (fat / 70) * 100)}%`, backgroundColor: '#FB923C' }]} />
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
  macroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
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
