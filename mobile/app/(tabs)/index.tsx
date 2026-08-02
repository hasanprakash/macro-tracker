import { useEffect, useState } from 'react';
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

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
        setUserEmail(user.email || '');
      }
    };
    fetchUser();
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

  const quickActions = [
    { icon: 'camera-outline' as const, label: 'Scan Food', color: '#6366F1' },
    { icon: 'add-circle-outline' as const, label: 'Log Meal', color: '#10B981' },
    { icon: 'barbell-outline' as const, label: 'Workout', color: '#F59E0B' },
    { icon: 'water-outline' as const, label: 'Water', color: '#3B82F6' },
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
        <View style={[styles.summaryCard, { backgroundColor: '#6366F1' }]}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Today's Progress</Text>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>Day 1</Text>
            </View>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>0</Text>
              <Text style={styles.macroLabel}>Calories</Text>
              <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: '0%', backgroundColor: '#FCD34D' }]} />
              </View>
            </View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>0g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
              <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: '0%', backgroundColor: '#34D399' }]} />
              </View>
            </View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>0g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
              <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: '0%', backgroundColor: '#60A5FA' }]} />
              </View>
            </View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>0g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
              <View style={[styles.macroBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.macroBarFill, { width: '0%', backgroundColor: '#FB923C' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
              ]}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon} size={26} color={action.color} />
              </View>
              <Text
                style={[styles.actionLabel, { color: isDark ? '#CBD5E1' : '#334155' }]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Recent Meals Placeholder */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Recent Meals
        </Text>
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Ionicons
            name="restaurant-outline"
            size={40}
            color={isDark ? '#475569' : '#CBD5E1'}
          />
          <Text style={[styles.emptyText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            No meals logged yet today
          </Text>
          <Text style={[styles.emptySubtext, { color: isDark ? '#475569' : '#CBD5E1' }]}>
            Tap "Log Meal" to get started
          </Text>
        </View>

        {/* Account info */}
        <View style={styles.accountInfo}>
          <Text style={[styles.accountEmail, { color: isDark ? '#475569' : '#CBD5E1' }]}>
            Signed in as {userEmail}
          </Text>
        </View>
      </ScrollView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: '47%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 4,
  },
  accountInfo: {
    alignItems: 'center',
    paddingTop: 8,
  },
  accountEmail: {
    fontSize: 12,
  },
});
