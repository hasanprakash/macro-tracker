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
import * as ImagePicker from 'expo-image-picker';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { DailySummaryCard } from '@/components/DailySummaryCard';
import { MealCard } from '@/components/MealCard';
import { MealLogModal } from '@/components/MealLogModal';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [dailySummary, setDailySummary] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [activeMealType, setActiveMealType] = useState('Breakfast');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDailySummary = async (uid: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', uid)
      .eq('summary_date', today)
      .single();

    if (data) {
      setDailySummary({
        calories: Number(data.total_calories || 0),
        protein: Number(data.total_protein || 0),
        carbs: Number(data.total_carbs || 0),
        fat: Number(data.total_fat || 0),
      });
    }
  };

  useEffect(() => {
    const fetchUserAndData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
        setUserEmail(user.email || '');
        setUserId(user.id);
        fetchDailySummary(user.id);
      }
    };
    fetchUserAndData();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign Out Error', error.message);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const openMealLog = (mealType: string) => {
    setActiveMealType(mealType);
    setModalVisible(true);
  };

  const submitMealLog = async (text?: string, imageBase64?: string) => {
    setIsSubmitting(true);
    const { data: { session }, error: sessionError, } = await supabase.auth.getSession();
    console.log("SESSION ERROR:", sessionError);
    console.log("HAS SESSION:", !!session);
    console.log("USER ID:", session?.user?.id);
    console.log(
      "ACCESS TOKEN EXISTS:",
      !!session?.access_token
    );

    try {
      const { data, error } = await supabase.functions.invoke('log-meal', {
        body: { meal_type: activeMealType, text: text, image_base64: imageBase64 }
      });
      
      if (error) throw error;
      
      if (userId) {
        await fetchDailySummary(userId);
      }
      
      setModalVisible(false);
      Alert.alert('Success', `Logged ${data.data.meal_name}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to log meal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScanPress = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow camera access to scan food.");
      return;
    }
    
    const pickerResult = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.5, // keep image size manageable
    });

    if (!pickerResult.canceled && pickerResult.assets[0].base64) {
      submitMealLog(undefined, pickerResult.assets[0].base64);
    }
  };

  const mealOptions = [
    { title: 'Breakfast', icon: 'sunny-outline' as const, color: '#F59E0B' },
    { title: 'Lunch', icon: 'partly-sunny-outline' as const, color: '#10B981' },
    { title: 'Dinner', icon: 'moon-outline' as const, color: '#6366F1' },
    { title: 'Snacks', icon: 'cafe-outline' as const, color: '#EC4899' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {greeting()} 👋
            </Text>
            <Text style={[styles.name, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {userName}
            </Text>
          </View>
          <Pressable
            style={[
              styles.profileButton,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
            ]}
            onPress={handleSignOut}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </Pressable>
        </View>

        {/* Daily Summary Card */}
        <DailySummaryCard
          calories={dailySummary.calories}
          protein={dailySummary.protein}
          carbs={dailySummary.carbs}
          fat={dailySummary.fat}
        />

        {/* Meal Logging Section */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Log Meals
        </Text>
        <View style={styles.actionsGrid}>
          {mealOptions.map((meal) => (
            <MealCard
              key={meal.title}
              title={meal.title}
              icon={meal.icon}
              color={meal.color}
              onPress={() => openMealLog(meal.title)}
            />
          ))}
        </View>

        {/* Account info */}
        <View style={styles.accountInfo}>
          <Text style={[styles.accountEmail, { color: isDark ? '#475569' : '#CBD5E1' }]}>
            Signed in as {userEmail}
          </Text>
        </View>
      </ScrollView>

      {/* Modal for Meal Logging */}
      <MealLogModal
        visible={modalVisible}
        mealType={activeMealType}
        onClose={() => setModalVisible(false)}
        onSubmitText={(text) => submitMealLog(text)}
        onScanPress={handleScanPress}
        isSubmitting={isSubmitting}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  accountInfo: {
    alignItems: 'center',
    paddingTop: 8,
  },
  accountEmail: {
    fontSize: 12,
  },
});
