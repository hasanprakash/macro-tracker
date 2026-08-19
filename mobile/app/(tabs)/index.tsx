import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import type { FoodItem, MealEstimate, MealTotals, FoodEntry, RecentFood } from '@/lib/types';

import { DailySummaryCard } from '@/components/DailySummaryCard';
import { MealSection } from '@/components/MealSection';
import { AddFoodModal } from '@/components/AddFoodModal';
import { ScanningLoader } from '@/components/ScanningLoader';
import { MealReviewModal } from '@/components/MealReviewModal';

const MEAL_TYPES = [
  { title: 'Breakfast', icon: 'sunny-outline' as const, color: '#F59E0B' },
  { title: 'Lunch', icon: 'partly-sunny-outline' as const, color: '#10B981' },
  { title: 'Dinner', icon: 'moon-outline' as const, color: '#6366F1' },
  { title: 'Snacks', icon: 'cafe-outline' as const, color: '#EC4899' },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [dailySummary, setDailySummary] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [todaysEntries, setTodaysEntries] = useState<FoodEntry[]>([]);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);

  // UI Flow State
  const [activeMealType, setActiveMealType] = useState('Breakfast');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Review Modal State
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDashboardData = useCallback(async (uid: string) => {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch daily summary
    const { data: summaryData } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', uid)
      .eq('summary_date', today)
      .single();

    if (summaryData) {
      setDailySummary({
        calories: Number(summaryData.total_calories || 0),
        protein: Number(summaryData.total_protein || 0),
        carbs: Number(summaryData.total_carbs || 0),
        fat: Number(summaryData.total_fat || 0),
      });
    }

    // 2. Fetch today's food entries
    const { data: entriesData } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', uid)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .order('created_at', { ascending: true });

    if (entriesData) {
      setTodaysEntries(entriesData as FoodEntry[]);
    }

    // 3. Fetch recent foods (limit 10)
    const { data: recentsData } = await supabase
      .from('recent_foods')
      .select('*')
      .eq('user_id', uid)
      .order('last_used_at', { ascending: false })
      .limit(10);

    if (recentsData) {
      setRecentFoods(recentsData as RecentFood[]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
        setUserEmail(user.email || '');
        setUserId(user.id);
        fetchDashboardData(user.id);
      }
    };
    init();
  }, [fetchDashboardData]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign Out Error', error.message);
  };

  const openAddFood = (mealType: string) => {
    setActiveMealType(mealType);
    setAddModalVisible(true);
  };

  // Step 1: Call Gemini
  const handleAnalyze = async (text?: string, imageBase64?: string) => {
    setAddModalVisible(false);
    setIsScanning(true);

    try {
      const { data, error } = await supabase.functions.invoke('scan-food', {
        body: { text, image_base64: imageBase64, meal_type: activeMealType }
      });
      
      if (error) throw error;
      
      setEstimate(data.data as MealEstimate);
      setReviewVisible(true);
    } catch (err: any) {
      Alert.alert('Analysis Failed', err.message || 'Could not analyze meal.');
    } finally {
      setIsScanning(false);
    }
  };

  // Step 2: Save to DB
  const handleSaveMeal = async (mealName: string, foods: FoodItem[], totals: MealTotals) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('log-meal', {
        body: {
          meal_type: activeMealType,
          meal_name: mealName,
          foods: foods,
          totals: totals,
          // image_base64 would go here if we were passing the image forward
        }
      });
      
      if (error) throw error;
      
      setReviewVisible(false);
      setEstimate(null);
      if (userId) fetchDashboardData(userId);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save meal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAdd = async (mealName: string, foods: FoodItem[], totals: MealTotals) => {
    // Show the review modal pre-filled with the recent food data
    setEstimate({
      meal_name: mealName,
      foods: foods,
      totals: totals,
      confidence: 1.0,
    });
    setReviewVisible(true);
  };

  const handleRepeatYesterday = async () => {
    if (!userId) return;
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdayEntries } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('meal_type', activeMealType)
        .gte('created_at', `${yesterdayStr}T00:00:00.000Z`)
        .lt('created_at', `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);

      if (!yesterdayEntries || yesterdayEntries.length === 0) {
        Alert.alert('No meals found', `You didn't log any ${activeMealType} yesterday.`);
        return;
      }

      // Combine yesterday's entries into a single reviewable estimate
      const combinedFoods: FoodItem[] = [];
      const combinedTotals: MealTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      
      yesterdayEntries.forEach(entry => {
        combinedTotals.calories += Number(entry.calories);
        combinedTotals.protein_g += Number(entry.protein);
        combinedTotals.carbs_g += Number(entry.carbs);
        combinedTotals.fat_g += Number(entry.fat);
        
        let parsedFoods: FoodItem[] = [];
        try {
          if (entry.raw_input && typeof entry.raw_input === 'object' && 'foods' in (entry.raw_input as any)) {
            parsedFoods = (entry.raw_input as any).foods;
          }
        } catch(e) {}
        
        if (parsedFoods.length > 0) {
          combinedFoods.push(...parsedFoods);
        } else {
          combinedFoods.push({
            name: entry.meal_name || 'Unknown',
            quantity: 1, unit: 'serving',
            calories: entry.calories, protein_g: entry.protein, carbs_g: entry.carbs, fat_g: entry.fat
          });
        }
      });

      setEstimate({
        meal_name: `Yesterday's ${activeMealType}`,
        foods: combinedFoods,
        totals: combinedTotals,
        confidence: 1.0,
      });
      setReviewVisible(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not fetch yesterday\'s meals.');
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (isScanning) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', justifyContent: 'center' }]}>
        <ScanningLoader />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: isDark ? '#94A3B8' : '#64748B' }]}>{greeting()} 👋</Text>
            <Text style={[styles.name, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{userName}</Text>
          </View>
          <Pressable style={[styles.profileButton, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
          </Pressable>
        </View>

        <DailySummaryCard
          calories={dailySummary.calories}
          protein={dailySummary.protein}
          carbs={dailySummary.carbs}
          fat={dailySummary.fat}
        />

        {MEAL_TYPES.map((meal) => (
          <MealSection
            key={meal.title}
            title={meal.title}
            icon={meal.icon}
            color={meal.color}
            entries={todaysEntries.filter(e => e.meal_type === meal.title)}
            onAddPress={() => openAddFood(meal.title)}
          />
        ))}

        <View style={styles.accountInfo}>
          <Text style={[styles.accountEmail, { color: isDark ? '#475569' : '#CBD5E1' }]}>
            Signed in as {userEmail}
          </Text>
        </View>
      </ScrollView>

      <AddFoodModal
        visible={addModalVisible}
        mealType={activeMealType}
        recentFoods={recentFoods}
        onClose={() => setAddModalVisible(false)}
        onAnalyze={handleAnalyze}
        onQuickAdd={handleQuickAdd}
        onRepeatYesterday={handleRepeatYesterday}
      />

      <MealReviewModal
        visible={reviewVisible}
        mealType={activeMealType}
        estimate={estimate}
        onClose={() => setReviewVisible(false)}
        onSave={handleSaveMeal}
        isSaving={isSaving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  accountInfo: {
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 20,
  },
  accountEmail: {
    fontSize: 12,
  },
});
