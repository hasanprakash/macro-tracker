import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import type { FoodItem, MealEstimate, MealTotals, MealEntry, RecentFood, Profile, ExerciseEntry, WeightLog } from '@/lib/types';
import { ExerciseSource, CalculationMethod } from '@/lib/constants';

import { DailySummaryCard } from '@/components/DailySummaryCard';
import { MealSection } from '@/components/MealSection';
import { AddFoodModal } from '@/components/AddFoodModal';
import { ScanningLoader } from '@/components/ScanningLoader';
import { invokeScanFoodWithProgress } from '@/lib/scan';
import { MealReviewModal } from '@/components/MealReviewModal';
import { OnboardingModal } from '@/components/OnboardingModal';
import { AddExerciseModal } from '@/components/AddExerciseModal';
import { ExerciseSection } from '@/components/ExerciseSection';
import { WeightSection } from '@/components/WeightSection';
import { LogWeightModal } from '@/components/LogWeightModal';
import { CalendarModal } from '@/components/CalendarModal';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { useAlert } from '@/components/ui/CustomAlert';
import { SpotlightWalkthrough } from '@/components/SpotlightWalkthrough';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const MEAL_TYPES = [
  { title: 'Breakfast', icon: 'sunny-outline' as const, color: '#10B981' },
  { title: 'Lunch', icon: 'partly-sunny-outline' as const, color: '#10B981' },
  { title: 'Dinner', icon: 'moon-outline' as const, color: '#10B981' },
  { title: 'Snacks', icon: 'cafe-outline' as const, color: '#10B981' },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const { showAlert } = useAlert();

  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [dailySummary, setDailySummary] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [todaysEntries, setTodaysEntries] = useState<MealEntry[]>([]);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todaysExercises, setTodaysExercises] = useState<ExerciseEntry[]>([]);
  const [todaysWeight, setTodaysWeight] = useState<WeightLog | null>(null);

  // UI Flow State
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [activeMealType, setActiveMealType] = useState<string>('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [addWeightVisible, setAddWeightVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [isRefreshingHC, setIsRefreshingHC] = useState(false);
  const [scanningType, setScanningType] = useState<'meal' | 'exercise' | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  
  // Review Modal State
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);

  const router = useRouter();
  const { steps: hcSteps, activeCalories: hcActiveCalories, isSupported: hcSupported, error: hcError, fetchSteps } = useHealthConnect(selectedDate);

  // Refs for spotlight walkthrough
  const rootRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const dailySummaryRef = useRef<View>(null);
  const mealSectionsRef = useRef<View>(null);
  const exerciseSectionRef = useRef<View>(null);
  const weightSectionRef = useRef<View>(null);
  const insightsTabRef = useRef<View>(null);

  const walkthroughTargetRefs = useRef({
    dailySummary: dailySummaryRef,
    mealSections: mealSectionsRef,
    exerciseSection: exerciseSectionRef,
    weightSection: weightSectionRef,
    insightsTab: insightsTabRef,
  }).current;

  const fetchDashboardData = useCallback(async (uid: string, dateStr: string) => {
    setIsDashboardLoading(true);
    // 1. Fetch daily summary
    const { data: summaryData } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', uid)
      .eq('summary_date', dateStr)
      .single();

    if (summaryData) {
      setDailySummary({
        calories: Number(summaryData.total_calories || 0),
        protein: Number(summaryData.total_protein || 0),
        carbs: Number(summaryData.total_carbs || 0),
        fat: Number(summaryData.total_fat || 0),
      });
    } else {
      setDailySummary({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    }

    // 2. Fetch today's meal entries with foods
    const { data: entriesData } = await supabase
      .from('meal_entries')
      .select('*, meal_food(*)')
      .eq('user_id', uid)
      .gte('created_at', `${dateStr}T00:00:00.000Z`)
      .lt('created_at', `${dateStr}T23:59:59.999Z`)
      .order('created_at', { ascending: true });

    if (entriesData) {
      setTodaysEntries(entriesData as MealEntry[]);
    } else {
      setTodaysEntries([]);
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

    // 4. Fetch today's exercises
    const { data: exercisesData } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', uid)
      .eq('exercise_date', dateStr);

    if (exercisesData) {
      setTodaysExercises(exercisesData as ExerciseEntry[]);
    } else {
      setTodaysExercises([]);
    }

    // 5. Fetch today's weight
    const { data: weightData } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', uid)
      .gte('recorded_at', `${dateStr}T00:00:00.000Z`)
      .lt('recorded_at', `${dateStr}T23:59:59.999Z`)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weightData) {
      setTodaysWeight(weightData as WeightLog);
    } else {
      setTodaysWeight(null);
    }

    setIsDashboardLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        setUserId(user.id);

        // Fetch or create profile
        let { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        const actualName = user.user_metadata?.full_name || '';
          
        if (!profileData) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: user.id, full_name: actualName })
            .select()
            .single();
          profileData = newProfile;
        } else if (actualName && profileData.full_name !== actualName) {
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .update({ full_name: actualName })
            .eq('id', user.id)
            .select()
            .single();
          if (updatedProfile) profileData = updatedProfile;
        }
        
        setUserName(profileData.full_name || profileData.display_name || user.email?.split('@')[0] || 'User');
        setProfile(profileData as Profile);
        
        let needsOnboarding = false;
        if (profileData && !profileData.target_calories) {
          setShowOnboarding(true);
          needsOnboarding = true;
        }

        // Calculate Day Number
        const accountCreatedAt = user.created_at || profileData?.created_at;
        if (accountCreatedAt) {
          const start = new Date(accountCreatedAt);
          start.setHours(0,0,0,0);
          const current = new Date(selectedDate);
          current.setHours(0,0,0,0);
          const diffTime = current.getTime() - start.getTime();
          const dayNum = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
          setDayNumber(dayNum);
        }

        // Check if we should show walkthrough
        if (!needsOnboarding) {
          const hasSeenWalkthrough = await AsyncStorage.getItem('has_seen_walkthrough');
          if (!hasSeenWalkthrough) {
            setShowWalkthrough(true);
          }
        }

        fetchDashboardData(user.id, selectedDate);
      }
    };
    init();
  }, [fetchDashboardData, selectedDate]);

  // Sync Health Connect steps to database
  useEffect(() => {
    const syncStepsToDB = async () => {
      if (!userId || !hcSupported || hcSteps === null || hcSteps <= 0 || !profile) return;
      
      const syncDate = selectedDate;
      const strideCm = profile.stride_length_cm || ((profile.height_cm || 170) * 0.414);
      const distanceKm = hcSteps * (strideCm / 100) / 1000;
      
      let burned = 0;
      let calcMethod = CalculationMethod.HEALTH_PLATFORM;

      if (hcActiveCalories && hcActiveCalories > 0) {
        burned = hcActiveCalories;
      } else {
        calcMethod = CalculationMethod.STEP_DISTANCE_ESTIMATE;
        const durationMins = (distanceKm / 4.5) * 60;
        const weight = profile.weight_kg || 70;
        burned = durationMins * ((3.5 - 1) * 3.5 * weight) / 200;
      }

      const externalId = `health_connect_steps_${syncDate}`;
      const stepEntry = {
        user_id: userId,
        exercise_date: syncDate,
        exercise_type: 'Steps',
        description: `≈ ${distanceKm.toFixed(1)} km`,
        duration_minutes: 0,
        steps_count: hcSteps,
        calories_burned: burned,
        source: ExerciseSource.HEALTH_CONNECT,
        calculation_method: calcMethod,
        external_id: externalId,
      };

      const { data, error } = await supabase
        .from('exercises')
        .upsert(stepEntry, { onConflict: 'user_id,external_id' })
        .select()
        .single();

      if (data && !error) {
        setTodaysExercises(prev => {
          const filtered = prev.filter(e => e.external_id !== externalId && (e.exercise_type !== 'Steps' || e.exercise_date !== syncDate));
          return [...filtered, data as ExerciseEntry];
        });
      }
    };

    const timeoutId = setTimeout(() => {
      syncStepsToDB();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [hcSteps, hcActiveCalories, userId, profile, selectedDate]);

  const handleRefreshHC = () => {
    if (isRefreshingHC) return;
    setIsRefreshingHC(true);
    fetchSteps();
    // 15 seconds cooldown
    setTimeout(() => {
      setIsRefreshingHC(false);
    }, 15000);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) showAlert('Sign Out Error', error.message);
  };

  const handleSaveProfile = async (profileData: Partial<Profile>) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single();
      
    if (error) {
      showAlert('Error saving profile', error.message);
      return;
    }
    
    setProfile(data as Profile);
    setShowOnboarding(false);
    
    // Check walkthrough after onboarding completes
    const hasSeenWalkthrough = await AsyncStorage.getItem('has_seen_walkthrough');
    if (!hasSeenWalkthrough) {
      setTimeout(() => setShowWalkthrough(true), 500);
    }
  };

  const handleSkipOnboarding = async () => {
    if (!userId) return;
    const defaultProfile = {
      goal: 'Just track my food',
      activity_level: 'Sedentary',
      maintenance_calories: 2000,
      under_eating_threshold: 1500,
      target_calories: 2000,
      target_protein: 150,
      target_carbs: 200,
      target_fat: 65,
      target_steps: 5000,
    };
    await handleSaveProfile(defaultProfile);
    showAlert('Targets Set', 'We assigned default targets. You can edit them anytime in your profile.');
  };


  const handleAnalyzeExercise = async (text: string) => {
    setScanningType('exercise');
    try {
      const weight = profile?.weight_kg || 70;
      const idempotencyKey = Crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('log-exercise', {
        body: { text, weight, idempotency_key: idempotencyKey }
      });
      if (error) throw error;
      if (data?.error) {
        const isDaily = data?.is_daily_limit || data.error.includes('daily limit') || data.error.includes('add your own API key');
        if (isDaily) {
          showAlert(
            'Daily Limit Reached',
            data.error,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => router.push('/settings') }
            ]
          );
          return null;
        }
        throw new Error(data.error);
      }
      return data.data;
    } catch (err: any) {
      const isDaily = err.message?.includes('daily limit') || err.message?.includes('add your own API key');
      if (isDaily) {
        showAlert(
          'Daily Limit Reached',
          err.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => router.push('/settings') }
          ]
        );
      } else {
        showAlert('Analysis Failed', err.message || 'Could not analyze exercise.');
      }
      throw err;
    } finally {
      setScanningType(null);
    }
  };

  const handleLogExercise = async (entryData: any, desc: string) => {
    if (!userId) return;
    
    try {
      const clientExerciseId = Crypto.randomUUID();
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          id: clientExerciseId,
          user_id: userId,
          title: entryData.title,
          exercise_type: entryData.exercise_type,
          description: desc,
          duration_minutes: entryData.duration_minutes,
          steps_count: 0,
          calories_burned: entryData.calories_burned,
          source: ExerciseSource.MANUAL,
          calculation_method: CalculationMethod.MET,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setTodaysExercises(prev => [...prev, data as ExerciseEntry]);
    } catch (err: any) {
      showAlert('Log Failed', err.message);
    }
  };

  const handleDeleteExercise = async (entry: ExerciseEntry) => {
    setTodaysExercises(prev => prev.filter(e => e.id !== entry.id));
    try {
      const { error } = await supabase.from('exercises').delete().eq('id', entry.id);
      if (error) throw error;
    } catch (err: any) {
      showAlert('Delete Failed', err.message);
      if (userId) fetchDashboardData(userId, selectedDate);
    }
  };

  const handleLogWeight = async (weight: number) => {
    if (!userId) return;
    try {
      const todayDate = selectedDate || new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('weight_logs')
        .upsert(
          {
            user_id: userId,
            weight,
            log_date: todayDate,
            recorded_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,log_date' }
        )
        .select()
        .single();

      if (error) throw error;
      setTodaysWeight(data as WeightLog);
      
      // Update profile weight
      await supabase.from('profiles').update({ weight_kg: weight }).eq('id', userId);
      setProfile(prev => prev ? { ...prev, weight_kg: weight } : null);
    } catch (err: any) {
      showAlert('Error logging weight', err.message);
    }
  };

  const openAddFood = (mealType: string) => {
    const existingEntriesCount = todaysEntries.filter(e => e.meal_type === mealType).length;
    if (existingEntriesCount >= 5) {
      showAlert('Limit Reached', `You have reached the maximum of 5 entries for ${mealType} today.`);
      return;
    }
    setActiveMealType(mealType);
    setAddModalVisible(true);
  };

  // Step 1: Call Gemini (with Binary Upload, Idempotency Key & Real-Time Upload Progress)
  const handleAnalyze = async (text?: string, imageBase64?: string, imageUri?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScanningType('meal');
    setHasImage(!!imageUri || !!imageBase64);
    setIsUploaded(false);

    try {
      const idempotencyKey = Crypto.randomUUID();
      const data = await invokeScanFoodWithProgress({
        text,
        imageUri,
        imageBase64,
        mealType: activeMealType,
        idempotencyKey,
        onUploadComplete: () => {
          setIsUploaded(true);
        },
      });
      
      if (data?.error) {
        const isSizeError = data.error.includes('too large') || data.error.includes('3MB') || data.error.includes('10MB');
        if (isSizeError) {
          showAlert('Image Too Large', data.error);
          return;
        }

        const isDaily = data?.is_daily_limit || data.error.includes('daily limit') || data.error.includes('add your own API key') || data.error.includes('Daily scan limit');
        if (isDaily) {
          showAlert(
            'Daily Limit Reached',
            data.error,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => router.push('/settings') }
            ]
          );
          return;
        }
        throw new Error(data.error);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEstimate(data.data as MealEstimate);
      setReviewVisible(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const isSizeError = err.message?.includes('too large') || err.message?.includes('3MB') || err.message?.includes('413');
      if (isSizeError) {
        showAlert('Image Too Large', 'The image is too large to analyze. Please choose a smaller photo or retake it.');
        return;
      }
      const isDaily = err.message?.includes('daily limit') || err.message?.includes('add your own API key') || err.message?.includes('Daily scan limit');
      if (isDaily) {
        showAlert(
          'Daily Limit Reached',
          err.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => router.push('/settings') }
          ]
        );
      } else {
        showAlert('Analysis Failed', err.message || 'Could not analyze meal.');
      }
    } finally {
      setScanningType(null);
      setHasImage(false);
      setIsUploaded(false);
    }
  };

  // Step 2: Save to DB (with Client-Generated Meal ID)
  const handleSaveMeal = async (mealName: string, title: string, foods: FoodItem[], totals: MealTotals) => {
    setIsSaving(true);
    try {
      const clientMealId = editingEntry ? editingEntry.id : Crypto.randomUUID();

      if (editingEntry) {
        // Edit mode: if no foods remain, just delete the entry
        if (foods.length === 0) {
          await handleDeleteEntry(editingEntry);
          setReviewVisible(false);
          setEstimate(null);
          setEditingEntry(null);
          return;
        }
        // Otherwise: delete old entry + re-insert via log-meal
        const { error: delError } = await supabase.rpc('delete_meal_entry', {
          p_meal_id: editingEntry.id,
        });
        if (delError) throw delError;
      }

      const { data, error } = await supabase.functions.invoke('log-meal', {
        body: {
          meal_id: clientMealId,
          meal_type: activeMealType,
          meal_name: mealName,
          title: title,
          foods: foods,
          totals: totals,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setReviewVisible(false);
      setEstimate(null);
      setEditingEntry(null);
      if (userId) fetchDashboardData(userId, selectedDate);
    } catch (err: any) {
      const isSizeError = err.message?.includes('too large') || err.message?.includes('3MB') || err.message?.includes('413');
      if (isSizeError) {
        showAlert('Image Too Large', 'The image is too large to save. Please choose a smaller photo.');
      } else {
        showAlert(
          editingEntry ? 'Update Failed' : 'Save Failed',
          err.message || 'Could not save meal.',
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (entry: MealEntry) => {
    // 1. Optimistic local state update for snappy UI
    setTodaysEntries((prev) => prev.filter(e => e.id !== entry.id));
    setDailySummary((prev) => ({
      calories: Math.max(0, prev.calories - (entry.calories || 0)),
      protein: Math.max(0, prev.protein - (entry.protein || 0)),
      carbs: Math.max(0, prev.carbs - (entry.carbs || 0)),
      fat: Math.max(0, prev.fat - (entry.fat || 0)),
    }));

    try {
      // 2. Atomic delete & summary recalculation via Supabase RPC
      const { error } = await supabase.rpc('delete_meal_entry', {
        p_meal_id: entry.id,
      });

      if (error) throw error;
      if (userId) fetchDashboardData(userId, selectedDate);
    } catch (err: any) {
      showAlert('Delete Failed', err.message || 'Could not delete entry.');
      // Re-fetch to rollback/sync local state if RPC failed
      if (userId) fetchDashboardData(userId, selectedDate);
    }
  };

  /** Opens the review modal pre-populated with the entry's food breakdown. */
  const handleEditEntry = (entry: MealEntry) => {
    // Restore the per-food breakdown from the relational table or fallback to raw_input
    let foods: FoodItem[] = [];
    
    if (entry.meal_food && entry.meal_food.length > 0) {
      foods = entry.meal_food.map(f => ({
        name: f.name,
        quantity: f.quantity,
        unit: f.unit,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
      }));
    } else if (entry.raw_input?.foods && entry.raw_input.foods.length > 0) {
      foods = entry.raw_input.foods;
    } else {
      // Fallback: treat the whole entry as one food item
      foods = [{
        name: entry.meal_name,
        quantity: 1,
        unit: 'serving',
        calories: entry.calories,
        protein_g: entry.protein,
        carbs_g: entry.carbs,
        fat_g: entry.fat,
      }];
    }
    setEditingEntry(entry);
    setActiveMealType(entry.meal_type);
    setEstimate({
      meal_name: entry.meal_name,
      foods,
      totals: {
        calories: entry.calories,
        protein_g: entry.protein,
        carbs_g: entry.carbs,
        fat_g: entry.fat,
      },
      confidence: 1.0,
    });
    setReviewVisible(true);
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
        .from('meal_entries')
        .select('*, meal_food(*)')
        .eq('user_id', userId)
        .eq('meal_type', activeMealType)
        .gte('created_at', `${yesterdayStr}T00:00:00.000Z`)
        .lt('created_at', `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);

      if (!yesterdayEntries || yesterdayEntries.length === 0) {
        showAlert('No meals found', `You didn't log any ${activeMealType} yesterday.`);
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
        if (entry.meal_food && entry.meal_food.length > 0) {
          parsedFoods = entry.meal_food.map((f: any) => ({
            name: f.name,
            quantity: f.quantity,
            unit: f.unit,
            calories: f.calories,
            protein_g: f.protein_g,
            carbs_g: f.carbs_g,
            fat_g: f.fat_g,
          }));
        } else {
          try {
            if (entry.raw_input && typeof entry.raw_input === 'object' && 'foods' in (entry.raw_input as any)) {
              parsedFoods = (entry.raw_input as any).foods;
            }
          } catch(e) {}
        }
        
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
      showAlert('Error', 'Could not fetch yesterday\'s meals.');
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const hcStepsEntry = hcSupported && (hcSteps !== null || hcError) ? (() => {
    if (hcError || hcSteps === null) {
      return {
        id: 'health-connect-steps',
        user_id: userId || '',
        exercise_date: selectedDate,
        exercise_type: 'Steps',
        description: 'Tap to connect',
        duration_minutes: 0,
        steps_count: -1,
        calories_burned: 0,
        created_at: new Date().toISOString(),
        source: ExerciseSource.HEALTH_CONNECT,
        calculation_method: CalculationMethod.HEALTH_PLATFORM,
      } as ExerciseEntry;
    }

    const strideCm = profile?.stride_length_cm || ((profile?.height_cm || 170) * 0.414);
    const distanceKm = hcSteps * (strideCm / 100) / 1000;
    
    let burned = 0;
    let calcMethod = CalculationMethod.HEALTH_PLATFORM;

    if (hcActiveCalories && hcActiveCalories > 0) {
      burned = hcActiveCalories;
    } else {
      calcMethod = CalculationMethod.STEP_DISTANCE_ESTIMATE;
      const durationMins = (distanceKm / 4.5) * 60;
      const weight = profile?.weight_kg || 70;
      burned = durationMins * ((3.5 - 1) * 3.5 * weight) / 200;
    }

    return {
      id: 'health-connect-steps',
      user_id: userId || '',
      exercise_date: selectedDate,
      exercise_type: 'Steps',
      description: `≈ ${distanceKm.toFixed(1)} km`,
      duration_minutes: 0,
      steps_count: hcSteps,
      calories_burned: burned,
      created_at: new Date().toISOString(),
      source: ExerciseSource.HEALTH_CONNECT,
      calculation_method: calcMethod,
    } as ExerciseEntry;
  })() : null;

  const displayExercises = [
    ...(hcStepsEntry ? [hcStepsEntry] : []),
    ...todaysExercises.filter(e => e.exercise_type !== 'Steps')
  ];

  const totalBurnedCalories = displayExercises.reduce((sum, e) => sum + (e.calories_burned || 0), 0);
  const activityCreditFactor = profile?.activity_credit_factor ?? 0.70;
  const activityCredit = totalBurnedCalories * activityCreditFactor;

  const targetCals = profile?.target_calories ? profile.target_calories + activityCredit : undefined;
  const targetCarbs = profile?.target_carbs ? profile.target_carbs + (activityCredit / 4) : undefined;

  return (
    <SafeAreaView ref={rootRef} style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <ScrollView
        ref={scrollViewRef}
        scrollEnabled={!showWalkthrough}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: isDark ? '#94A3B8' : '#64748B' }]}>{greeting()} 👋</Text>
            <Text style={[styles.name, { color: textPrimary }]}>{userName}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.profileButton, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
            <Pressable style={[styles.profileButton, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>
        </View>
        
        <View style={styles.headerRow}>
          <Text style={[styles.dateText, { color: textPrimary }]}>
            {(() => {
              const todayDate = new Date();
              const todayStr = todayDate.toISOString().split('T')[0];
              const yesterday = new Date(todayDate);
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().split('T')[0];
              const tomorrow = new Date(todayDate);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];
              
              const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
              
              if (selectedDate === todayStr) return `Today, ${formattedDate}`;
              if (selectedDate === yesterdayStr) return `Yesterday, ${formattedDate}`;
              if (selectedDate === tomorrowStr) return `Tomorrow, ${formattedDate}`;
              
              return new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
            })()}
          </Text>
          <View style={styles.headerIcons}>
            {hcSupported && selectedDate === new Date().toISOString().split('T')[0] && (
              <Pressable
                style={[styles.dateBadge, isRefreshingHC && { opacity: 0.5 }]}
                onPress={handleRefreshHC}
                disabled={isRefreshingHC}
              >
                <Ionicons name="sync" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
              </Pressable>
            )}
            <Pressable style={styles.dateBadge} onPress={() => setCalendarVisible(true)}>
              <Ionicons name="calendar-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
              <Text style={[styles.dayBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>DAY {dayNumber}</Text>
            </Pressable>
          </View>
        </View>

        <View ref={dailySummaryRef} collapsable={false}>
          <DailySummaryCard
            calories={dailySummary.calories}
            protein={dailySummary.protein}
            carbs={dailySummary.carbs}
            fat={dailySummary.fat}
            targetCalories={targetCals}
            targetProtein={profile?.target_protein}
            targetCarbs={targetCarbs}
            targetFat={profile?.target_fat}
            burnedCalories={totalBurnedCalories}
            underEatingThreshold={profile?.under_eating_threshold}
            isLoading={isDashboardLoading}
          />
        </View>

        <View ref={mealSectionsRef} collapsable={false}>
          {MEAL_TYPES.map((meal) => (
            <MealSection
              key={meal.title}
              title={meal.title}
              icon={meal.icon}
              color={meal.color}
              entries={todaysEntries.filter(e => e.meal_type === meal.title)}
              onAddPress={() => openAddFood(meal.title)}
              onDeleteEntry={handleDeleteEntry}
              onEditEntry={handleEditEntry}
            />
          ))}
        </View>

        <View ref={exerciseSectionRef} collapsable={false}>
          <ExerciseSection
            entries={displayExercises}
            onAddPress={() => setAddExerciseVisible(true)}
            onDeleteEntry={handleDeleteExercise}
            onStepsPress={() => fetchSteps(true)}
          />
        </View>

        <View ref={weightSectionRef} collapsable={false}>
          <WeightSection
            latestLog={todaysWeight}
            onAddPress={() => setAddWeightVisible(true)}
          />
        </View>

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

      <AddExerciseModal
        visible={addExerciseVisible}
        onClose={() => setAddExerciseVisible(false)}
        onAnalyzeExercise={handleAnalyzeExercise}
        onLogExercise={handleLogExercise}
      />

      <LogWeightModal
        visible={addWeightVisible}
        initialWeight={todaysWeight?.weight ?? profile?.weight_kg}
        onClose={() => setAddWeightVisible(false)}
        onLogWeight={handleLogWeight}
      />

      <MealReviewModal
        visible={reviewVisible}
        mealType={activeMealType}
        estimate={estimate}
        isEditMode={!!editingEntry}
        onSave={handleSaveMeal}
        onClose={() => {
          setReviewVisible(false);
          setEditingEntry(null);
          setEstimate(null);
        }}
        isSaving={isSaving}
      />
      <OnboardingModal
        visible={showOnboarding}
        onSave={handleSaveProfile}
        onSkip={() => {
          setShowOnboarding(false);
          AsyncStorage.getItem('has_seen_walkthrough').then((hasSeen) => {
            if (!hasSeen) {
              setTimeout(() => setShowWalkthrough(true), 500);
            }
          });
        }}
      />

      <CalendarModal
        visible={calendarVisible}
        selectedDate={selectedDate}
        userId={userId}
        onClose={() => setCalendarVisible(false)}
        onSelectDate={(dateStr) => {
          setSelectedDate(dateStr);
          setCalendarVisible(false);
        }}
      />

      <SpotlightWalkthrough
        visible={showWalkthrough}
        onComplete={async () => {
          await AsyncStorage.setItem('has_seen_walkthrough', 'true');
          setShowWalkthrough(false);
        }}
        targetRefs={walkthroughTargetRefs}
        scrollViewRef={scrollViewRef}
        rootRef={rootRef}
        scrollOffsetRef={scrollOffsetRef}
      />

      {scanningType && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', justifyContent: 'center', zIndex: 1000 }]}>
          <ScanningLoader type={scanningType} hasImage={hasImage} isUploaded={isUploaded} />
        </View>
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
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
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
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
