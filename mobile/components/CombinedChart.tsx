import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChartData {
  date: string;
  label: string;
  calories: number;
  weight: number | null;
}

interface CombinedChartProps {
  data: ChartData[];
  targetCalories: number;
  isDark: boolean;
}

export function CombinedChart({ data, targetCalories, isDark }: CombinedChartProps) {
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const PADDING_HORIZONTAL = 20;
  const CHART_HEIGHT = 200;
  // Account for parent padding (e.g. 20 on each side)
  const CHART_WIDTH = SCREEN_WIDTH - 80; 

  const N = data.length;
  if (N === 0) return null;

  // --- Scaling Logic ---
  // Calories
  const maxCal = Math.max(targetCalories, ...data.map(d => d.calories)) * 1.1 || 2500;
  
  // Weight
  const validWeights = data.map(d => d.weight).filter(w => w !== null) as number[];
  const minW = validWeights.length > 0 ? Math.min(...validWeights) : 70;
  const maxW = validWeights.length > 0 ? Math.max(...validWeights) : 70;
  
  // Expand weight range slightly so dots don't sit exactly on the edges
  let weightMin = minW - 2;
  let weightMax = maxW + 2;
  if (weightMin === weightMax) {
    weightMin -= 5;
    weightMax += 5;
  }
  const weightRange = weightMax - weightMin;

  // --- Helpers for coordinates ---
  const getX = (index: number) => (index / Math.max(1, N - 1)) * CHART_WIDTH;
  const getCalY = (cal: number) => CHART_HEIGHT - (cal / maxCal) * CHART_HEIGHT;
  const getWeightY = (w: number) => CHART_HEIGHT - ((w - weightMin) / weightRange) * CHART_HEIGHT;

  // --- Line Renderer ---
  const renderLineSegment = (
    x1: number, y1: number, 
    x2: number, y2: number, 
    color: string, 
    key: string,
    thickness: number = 2
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    return (
      <View
        key={key}
        style={{
          position: 'absolute',
          width: length,
          height: thickness,
          backgroundColor: color,
          left: centerX - length / 2,
          top: centerY - thickness / 2,
          transform: [{ rotate: `${angle}deg` }],
          borderRadius: thickness / 2,
        }}
      />
    );
  };

  // Determine x-axis labels to show (max 6 labels to avoid crowding)
  const labelIndices: number[] = [];
  if (N <= 6) {
    for (let i = 0; i < N; i++) labelIndices.push(i);
  } else {
    const step = Math.floor(N / 5);
    for (let i = 0; i < N; i += step) labelIndices.push(i);
    if (labelIndices[labelIndices.length - 1] !== N - 1) {
      labelIndices.push(N - 1);
    }
  }

  return (
    <View style={styles.container}>
      {/* Chart Area */}
      <View style={[styles.chartArea, { width: CHART_WIDTH, height: CHART_HEIGHT }]}>
        
        {/* Horizontal Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((perc, i) => (
          <View 
            key={`grid-${i}`} 
            style={[styles.gridLine, { top: CHART_HEIGHT * perc, backgroundColor: gridColor }]} 
          />
        ))}

        {/* Target Calorie Line */}
        <View 
          style={[
            styles.targetLine, 
            { 
              top: getCalY(targetCalories),
              borderColor: textSecondary,
            }
          ]} 
        />

        {/* Calorie Line & Points */}
        {data.map((d, i) => {
          if (i === N - 1) return null;
          const next = data[i + 1];
          return renderLineSegment(getX(i), getCalY(d.calories), getX(i + 1), getCalY(next.calories), '#F43F5E', `cal-line-${i}`, 2.5);
        })}
        {data.map((d, i) => (
          <View
            key={`cal-dot-${i}`}
            style={[
              styles.dot, 
              { 
                left: getX(i) - 4, 
                top: getCalY(d.calories) - 4, 
                backgroundColor: '#F43F5E',
                borderColor: isDark ? '#1E293B' : '#FFF'
              }
            ]}
          />
        ))}

        {/* Weight Line & Points */}
        {data.map((d, i) => {
          if (i === N - 1 || d.weight === null) return null;
          
          // Find next valid weight
          let nextI = i + 1;
          while (nextI < N && data[nextI].weight === null) nextI++;
          if (nextI >= N) return null;

          const next = data[nextI];
          // Even though we forward-fill, if there are gaps (e.g. before first log), we handle them here
          return renderLineSegment(getX(i), getWeightY(d.weight), getX(nextI), getWeightY(next.weight as number), '#60A5FA', `w-line-${i}`, 2);
        })}
        {data.map((d, i) => {
          if (d.weight === null) return null;
          return (
            <View
              key={`w-dot-${i}`}
              style={[
                styles.dot, 
                { 
                  left: getX(i) - 4, 
                  top: getWeightY(d.weight) - 4, 
                  backgroundColor: '#60A5FA',
                  borderColor: isDark ? '#1E293B' : '#FFF'
                }
              ]}
            />
          );
        })}
      </View>

      {/* X-Axis Labels */}
      <View style={[styles.xAxis, { width: CHART_WIDTH }]}>
        {data.map((d, i) => {
          if (!labelIndices.includes(i)) {
            // Render invisible placeholder to keep spacing if needed, but absolute positioning is better
            return null;
          }
          return (
            <Text 
              key={`label-${i}`} 
              style={[
                styles.xLabel, 
                { 
                  color: textSecondary,
                  position: 'absolute',
                  left: getX(i) - 15,
                  width: 30,
                  textAlign: 'center'
                }
              ]}
            >
              {d.label}
            </Text>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#F43F5E' }]} />
          <Text style={[styles.legendText, { color: textPrimary }]}>Calories</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#60A5FA' }]} />
          <Text style={[styles.legendText, { color: textPrimary }]}>Weight</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: textSecondary }]} />
          <Text style={[styles.legendText, { color: textPrimary }]}>Target Cal</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
  },
  chartArea: {
    position: 'relative',
    marginHorizontal: 20,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    zIndex: 2,
  },
  xAxis: {
    height: 20,
    marginTop: 8,
    position: 'relative',
  },
  xLabel: {
    fontSize: 10,
  },
  legend: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLine: {
    width: 12,
    height: 2,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
