import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/components/ui/CustomAlert';

const PureCircularProgress = ({ size, strokeWidth, progress, ringColor, trackColor, cardBg, children }: any) => {
  const half = size / 2;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  // Progress 0-50 maps to Left Side (45 to 180 deg rotation)
  const leftRotate = clampedProgress >= 50 ? 180 : 45 + (clampedProgress / 50) * 135;
  
  // Progress 50-100 maps to Right Side (0 to 135 deg rotation)
  const rightRotate = clampedProgress <= 50 ? 0 : ((clampedProgress - 50) / 50) * 135;

  const tipRotation = 225 + (clampedProgress / 100) * 270;

  const S = size;
  const topOffset = S * 0.7071 - half;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      
      {/* 1. Base Track (Full Circle) */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: half,
        borderWidth: strokeWidth, borderColor: trackColor
      }} />
      
      {/* 2. Progress Left */}
      <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: 0, width: size, height: size,
          transform: [{ rotate: `${leftRotate}deg` }]
        }}>
          {/* Half-Ring for the right side */}
          <View style={{ position: 'absolute', right: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', right: 0, width: size, height: size, borderRadius: half,
              borderWidth: strokeWidth, borderColor: ringColor
            }} />
          </View>
        </View>
      </View>

      {/* 3. Progress Right */}
      <View style={{ position: 'absolute', right: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', right: 0, width: size, height: size,
          transform: [{ rotate: `${rightRotate}deg` }]
        }}>
          {/* Half-Ring for the left side */}
          <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', left: 0, width: size, height: size, borderRadius: half,
              borderWidth: strokeWidth, borderColor: ringColor
            }} />
          </View>
        </View>
      </View>

      {/* 4. Gap Cutout (Masks the overlapping arcs in the bottom gap) */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: size, height: half, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: 0, top: topOffset, width: size, height: size,
          backgroundColor: cardBg,
          transform: [{ rotate: '45deg' }]
        }} />
      </View>

      {/* 5. Rounded Caps for Track Ends */}
      <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: '225deg' }] }}>
        <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: trackColor }} />
      </View>
      <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: '135deg' }] }}>
        <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: trackColor }} />
      </View>

      {/* 6. Rounded Caps for Progress Ends */}
      {clampedProgress > 0 && (
        <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: '225deg' }] }}>
          <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: ringColor }} />
        </View>
      )}
      {clampedProgress > 0 && (
        <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${tipRotation}deg` }] }}>
          <View style={{ position: 'absolute', top: 0, left: half - strokeWidth/2, width: strokeWidth, height: strokeWidth, borderRadius: strokeWidth/2, backgroundColor: ringColor }} />
        </View>
      )}

      {children}
    </View>
  );
};

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
  underEatingThreshold?: number | null;
}

export function DailySummaryCard({ 
  calories, protein, carbs, fat, 
  targetCalories, targetProtein, targetCarbs, targetFat,
  burnedCalories = 0,
  underEatingThreshold
}: DailySummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showAlert } = useAlert();

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
  
  const isUnderEating = underEatingThreshold ? calories < underEatingThreshold : false;
  const ringColor = isUnderEating ? '#EF4444' : (isDark ? '#34D399' : '#10B981'); // Red if under, else Emerald
  const trackColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const handleInfoPress = () => {
    if (!underEatingThreshold) return;
    const diff = Math.round(underEatingThreshold - calories);
    showAlert(
      'Eat More to Fuel Your Body!',
      `You need ${Math.ceil(diff)} more kcal to hit your minimum requirement.\n\nEating too little causes muscle loss, severe energy drops, and metabolic adaptation. Make sure to properly fuel your body!`
    );
  };

  const ringSize = 160;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const calPercent = getPercent(calories, tCals);
  const strokeDashoffset = circumference - (circumference * calPercent) / 100;

  return (
    <View style={styles.container}>
      <View style={[styles.mainCard, { backgroundColor: cardBg }]}>
        
        {isUnderEating && (
          <Pressable style={styles.infoButton} onPress={handleInfoPress}>
            <Ionicons name="information-circle" size={24} color="#EF4444" />
          </Pressable>
        )}
        
        {/* Central Rings Row */}
        <View style={styles.ringsRow}>
          <View style={styles.sideStat}>
            <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Eaten</Text>
            <Text style={[styles.sideStatValue, { color: textPrimary }]}>{Math.round(calories)}</Text>
          </View>

          <View style={styles.centerRingWrapper}>
            <PureCircularProgress
              size={160}
              strokeWidth={10}
              progress={calPercent}
              ringColor={ringColor}
              trackColor={trackColor}
              cardBg={cardBg}
            >
              <View style={styles.centerRingContent}>
                <Text style={[styles.ringLabel, { color: textSecondary }]}>Remaining</Text>
                <Text style={[styles.ringValue, { color: textPrimary }]}>{Math.round(remainingCals)}</Text>
                <Text style={[styles.ringSub, { color: textSecondary }]}>/ {Math.round(tCals)} kcal</Text>
              </View>
            </PureCircularProgress>
          </View>

          <View style={styles.sideStat}>
            <Text style={[styles.sideStatLabel, { color: textSecondary }]}>Burned</Text>
            <Text style={[styles.sideStatValue, { color: '#F59E0B' }]}>{Math.round(burnedCalories)}</Text>
          </View>
        </View>

        {/* Macros Row */}
        <View style={styles.macrosRow}>
          {/* Protein */}
          <View style={[styles.macroCard, { backgroundColor: macroBg }]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Protein</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{Math.round(protein)} / {Math.round(tPro)}g</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${getPercent(protein, tPro)}%`, backgroundColor: '#F43F5E' }]} />
            </View>
          </View>

          {/* Carbs */}
          <View style={[styles.macroCard, { backgroundColor: macroBg }]}>
            <Text style={[styles.macroName, { color: textPrimary }]}>Carbs</Text>
            <Text style={[styles.macroAmount, { color: textSecondary }]}>{Math.round(carbs)} / {Math.round(tCarbs)}g</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${getPercent(carbs, tCarbs)}%`, backgroundColor: '#60A5FA' }]} />
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
    marginBottom: 16,
  },
  mainCard: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    position: 'relative',
  },
  infoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
  centerRingWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRingContent: {
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
