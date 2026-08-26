import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { CombinedChart } from '@/components/CombinedChart';

const { width } = Dimensions.get('window');

interface DailySummary {
  summary_date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface WeightLog {
  id: string;
  weight: number;
  recorded_at: string;
}

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [targetProtein, setTargetProtein] = useState(150);
  const [targetCarbs, setTargetCarbs] = useState(200);
  const [targetFat, setTargetFat] = useState(65);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('target_calories, target_protein, target_carbs, target_fat')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setTargetCalories(profile.target_calories || 2000);
        setTargetProtein(profile.target_protein || 150);
        setTargetCarbs(profile.target_carbs || 200);
        setTargetFat(profile.target_fat || 65);
      }

      // Fetch last 30 days summaries (so we have data for the dynamic window)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: summaryData } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .gte('summary_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('summary_date', { ascending: true });
      
      setSummaries(summaryData || []);

      // Fetch weight logs
      const { data: weightData } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('recorded_at', thirtyDaysAgo.toISOString())
        .order('recorded_at', { ascending: true });

      setWeightLogs(weightData || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAnalyticsData();
    }, [fetchAnalyticsData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setRefreshing(false);
  };

  const bgColor = isDark ? '#0F172A' : '#F8FAFC';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  // --- Dynamic Window Logic ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let oldestLogDate = new Date();
  
  if (summaries.length > 0) {
    const firstSummaryDate = new Date(summaries[0].summary_date);
    if (firstSummaryDate < oldestLogDate) oldestLogDate = firstSummaryDate;
  }
  
  if (weightLogs.length > 0) {
    const firstWeightDate = new Date(weightLogs[0].recorded_at.split('T')[0]);
    if (firstWeightDate < oldestLogDate) oldestLogDate = firstWeightDate;
  }

  const daysSinceFirstLog = Math.floor((today.getTime() - oldestLogDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const chartDaysCount = Math.max(7, Math.min(30, daysSinceFirstLog));

  // Format combined data
  const combinedData = Array.from({ length: chartDaysCount }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (chartDaysCount - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const shortDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const summaryMatch = summaries.find(s => s.summary_date === dateStr);
    
    // Weight forward-fill
    let weightForDay = null;
    let latestBeforeDate = -1;
    
    for (const w of weightLogs) {
      const wDate = new Date(w.recorded_at.split('T')[0]).getTime();
      if (wDate <= d.getTime() && wDate > latestBeforeDate) {
        latestBeforeDate = wDate;
        weightForDay = Number(w.weight);
      }
    }

    return {
      date: dateStr,
      label: shortDay,
      calories: summaryMatch ? Number(summaryMatch.total_calories) : 0,
      protein: summaryMatch ? Number(summaryMatch.total_protein) : 0,
      carbs: summaryMatch ? Number(summaryMatch.total_carbs) : 0,
      fat: summaryMatch ? Number(summaryMatch.total_fat) : 0,
      weight: weightForDay,
    };
  });

  const last7Days = combinedData.slice(-7);
  const maxCal = Math.max(targetCalories, ...last7Days.map(d => d.calories)) * 1.1 || 2500;
  
  // Averages based only on days logged
  const loggedDays = last7Days.filter(d => d.calories > 0);
  const numDaysLogged = loggedDays.length || 1; // avoid divide by zero
  
  const avgCal = loggedDays.reduce((sum, d) => sum + d.calories, 0) / numDaysLogged;
  const avgPro = loggedDays.reduce((sum, d) => sum + d.protein, 0) / numDaysLogged;
  const avgCarb = loggedDays.reduce((sum, d) => sum + d.carbs, 0) / numDaysLogged;
  const avgFat = loggedDays.reduce((sum, d) => sum + d.fat, 0) / numDaysLogged;

  // Weight Plot
  const maxWeight = Math.max(...weightLogs.map(w => Number(w.weight)));
  const minWeight = Math.min(...weightLogs.map(w => Number(w.weight)));
  const weightRange = maxWeight - minWeight || 10;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textPrimary} />}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: textPrimary }]}>Insights</Text>
        </View>

        {/* Combined Line Chart */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Progress Overview ({chartDaysCount} Days)</Text>
          <CombinedChart data={combinedData} targetCalories={targetCalories} isDark={isDark} />
        </View>

        {/* Calories Chart */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Calories (Last 7 Days)</Text>
          <View style={styles.chartContainer}>
            {last7Days.map((day, i) => {
              const heightPct = (day.calories / maxCal) * 100;
              const isOver = day.calories > targetCalories;
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={[styles.barLabel, { color: textSecondary, marginBottom: 4 }]}>
                    {Math.round(day.calories)}
                  </Text>
                  <View style={styles.barTrack}>
                    <View 
                      style={[
                        styles.barFill, 
                        { 
                          height: `${heightPct}%`, 
                          backgroundColor: isOver ? '#EF4444' : '#10B981' 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: textPrimary, marginTop: 4 }]}>{day.label}</Text>
                </View>
              );
            })}
            {/* Target Line */}
            <View style={[styles.targetLine, { bottom: `${(targetCalories / maxCal) * 100}%`, borderColor: textSecondary }]} />
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.legendText, { color: textSecondary }]}>Under Goal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.legendText, { color: textSecondary }]}>Over Goal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: textSecondary }]} />
              <Text style={[styles.legendText, { color: textSecondary }]}>Target ({Math.round(targetCalories)})</Text>
            </View>
          </View>
        </View>

        {/* Macros Averages */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textPrimary, marginBottom: 4 }]}>7-Day Macro Averages</Text>
          <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 20 }}>
            {loggedDays.length > 0 ? `Based on ${loggedDays.length} logged ${loggedDays.length === 1 ? 'day' : 'days'}` : 'No data logged'}
          </Text>
          
          <View style={styles.macroRow}>
            <View style={styles.macroInfo}>
              <Text style={[styles.macroName, { color: '#F43F5E' }]}>Protein</Text>
              <Text style={[styles.macroValue, { color: textPrimary }]}>{Math.round(avgPro)}g / {Math.round(targetProtein)}g</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { backgroundColor: '#F43F5E', width: `${Math.min(100, (avgPro / targetProtein) * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroInfo}>
              <Text style={[styles.macroName, { color: '#60A5FA' }]}>Carbs</Text>
              <Text style={[styles.macroValue, { color: textPrimary }]}>{Math.round(avgCarb)}g / {Math.round(targetCarbs)}g</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { backgroundColor: '#60A5FA', width: `${Math.min(100, (avgCarb / targetCarbs) * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroInfo}>
              <Text style={[styles.macroName, { color: '#FBBF24' }]}>Fat</Text>
              <Text style={[styles.macroValue, { color: textPrimary }]}>{Math.round(avgFat)}g / {Math.round(targetFat)}g</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { backgroundColor: '#FBBF24', width: `${Math.min(100, (avgFat / targetFat) * 100)}%` }]} />
            </View>
          </View>
        </View>

        {/* Weight Trend */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Weight Trend (30 Days)</Text>
          {weightLogs.length > 1 ? (
            <View style={styles.weightChartContainer}>
              <View style={styles.weightChartArea}>
                {weightLogs.map((log, i) => {
                  const xPct = (i / (weightLogs.length - 1)) * 100;
                  const yPct = ((Number(log.weight) - minWeight) / weightRange) * 100;
                  return (
                    <View 
                      key={log.id} 
                      style={[
                        styles.weightDot, 
                        { 
                          left: `${xPct}%`, 
                          bottom: `${yPct}%`,
                          backgroundColor: '#8B5CF6'
                        }
                      ]} 
                    />
                  );
                })}
              </View>
              <View style={styles.weightLabels}>
                <Text style={[styles.weightLabelText, { color: textSecondary }]}>{new Date(weightLogs[0].recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <Text style={[styles.weightLabelText, { color: textSecondary }]}>{new Date(weightLogs[weightLogs.length - 1].recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={styles.weightStats}>
                <View style={styles.weightStatBox}>
                  <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Starting</Text>
                  <Text style={[styles.weightStatValue, { color: textPrimary }]}>{Number(weightLogs[0].weight).toFixed(1)} kg</Text>
                </View>
                <View style={styles.weightStatBox}>
                  <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Current</Text>
                  <Text style={[styles.weightStatValue, { color: textPrimary }]}>{Number(weightLogs[weightLogs.length - 1].weight).toFixed(1)} kg</Text>
                </View>
                <View style={styles.weightStatBox}>
                  <Text style={[styles.weightStatLabel, { color: textSecondary }]}>Change</Text>
                  <Text style={[
                    styles.weightStatValue, 
                    { color: Number(weightLogs[weightLogs.length - 1].weight) < Number(weightLogs[0].weight) ? '#10B981' : '#EF4444' }
                  ]}>
                    {Number(weightLogs[weightLogs.length - 1].weight) < Number(weightLogs[0].weight) ? '-' : '+'}
                    {Math.abs(Number(weightLogs[weightLogs.length - 1].weight) - Number(weightLogs[0].weight)).toFixed(1)} kg
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={{ color: textSecondary, fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' }}>
              Not enough weight data to show a trend. Log your weight for a few days!
            </Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  chartContainer: {
    height: 220,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'relative',
    paddingBottom: 22, // Space for x-axis labels
    paddingTop: 20, // Space for data labels
  },
  barCol: {
    alignItems: 'center',
    width: '12%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: 'rgba(150,150,150,0.1)',
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: -1,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLine: {
    width: 12,
    height: 2,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  macroRow: {
    marginBottom: 16,
  },
  macroInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  macroName: {
    fontSize: 15,
    fontWeight: '700',
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(150,150,150,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  weightChartContainer: {
    marginTop: 10,
  },
  weightChartArea: {
    height: 120,
    position: 'relative',
    marginHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  weightDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginBottom: -4,
  },
  weightLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  weightLabelText: {
    fontSize: 11,
    fontWeight: '500',
  },
  weightStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.1)',
  },
  weightStatBox: {
    alignItems: 'center',
  },
  weightStatLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  weightStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});
