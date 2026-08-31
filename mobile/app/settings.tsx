import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAlert } from '@/components/ui/CustomAlert';
import { OnboardingModal } from '@/components/OnboardingModal';
import { BYOKModal } from '@/components/BYOKModal';
import { TipsModal } from '@/components/TipsModal';
import { FeedbackModal } from '@/components/FeedbackModal';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import type { Profile } from '@/lib/types';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showAlert } = useAlert();
  
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const bgSurface = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? '#334155' : '#E2E8F0';

  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [byokVisible, setByokVisible] = useState(false);
  const [tipsVisible, setTipsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [hasSeenTips, setHasSeenTips] = useState(true);
  const [aiSettings, setAiSettings] = useState({ byok_enabled: true, has_custom_key: false });
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<'intro' | 'review'>('intro');

  const appVersion = Constants.expoConfig?.version || '1.0.0';


  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    fetchAiSettings();
    loadTipsState();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!hasSeenTips) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [hasSeenTips]);

  const loadTipsState = async () => {
    try {
      const value = await AsyncStorage.getItem('has_seen_tips');
      setHasSeenTips(value === 'true');
    } catch (e) {}
  };

  const handleOpenTips = async () => {
    setTipsVisible(true);
    if (!hasSeenTips) {
      setHasSeenTips(true);
      await AsyncStorage.setItem('has_seen_tips', 'true');
    }
  };

  const glowingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setCurrentProfile(data as Profile);
      }
    } catch (e) {
      console.log('Error fetching profile:', e);
    }
  };

  const fetchAiSettings = async () => {
    try {
      const { data, error } = await supabase.rpc('get_ai_settings');
      if (!error && data) {
        setAiSettings(data);
      }
    } catch (err) {
      console.log('Error fetching AI settings:', err);
    }
  };

  const handleSaveOnboarding = async (profileData: Partial<Profile>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { ...profileData, id: user.id, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
        
      if (error) throw error;
      
      await AsyncStorage.setItem('should_refresh_home_goals', 'true');
      setOnboardingVisible(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textSecondary }]}>ACCOUNT & GOALS</Text>
          
          <View style={[styles.card, { backgroundColor: bgSurface, borderColor }]}>
            <Pressable 
              style={styles.listItem}
              onPress={() => {
                showAlert('Nutrition Goals', 'How would you like to proceed?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Edit Manually', onPress: () => {
                      setOnboardingInitialStep('review');
                      setOnboardingVisible(true);
                  }},
                  { text: 'Take Quiz', onPress: () => {
                      setOnboardingInitialStep('intro');
                      setOnboardingVisible(true);
                  }}
                ]);
              }}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                  <Ionicons name="flame-outline" size={20} color="#6366F1" />
                </View>
                <View>
                  <Text style={[styles.listItemTitle, { color: textPrimary }]}>Nutrition Goals</Text>
                  <Text style={[styles.listItemSubtitle, { color: textSecondary }]}>Set your target calories and macros</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textSecondary} />
            </Pressable>
            
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            
            <Pressable 
              style={styles.listItem}
              onPress={() => supabase.auth.signOut()}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                </View>
                <View>
                  <Text style={[styles.listItemTitle, { color: '#EF4444' }]}>Log Out</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textSecondary }]}>HELP & RESOURCES</Text>
          
          <View style={[styles.card, { backgroundColor: bgSurface, borderColor }]}>
            <Pressable 
              style={styles.listItem}
              onPress={handleOpenTips}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                  {!hasSeenTips ? (
                    <Animated.View style={glowingStyle}>
                      <Ionicons name="bulb" size={20} color="#EAB308" />
                    </Animated.View>
                  ) : (
                    <Ionicons name="bulb-outline" size={20} color="#EAB308" />
                  )}
                </View>
                <View>
                  <Text style={[styles.listItemTitle, { color: textPrimary }]}>Health & Tracking Tips</Text>
                  <Text style={[styles.listItemSubtitle, { color: textSecondary }]}>Best practices for your goals</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textSecondary} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <Pressable 
              style={styles.listItem}
              onPress={async () => {
                await AsyncStorage.removeItem('has_seen_walkthrough');
                await AsyncStorage.removeItem('has_seen_add_food_tip');
                await AsyncStorage.removeItem('has_seen_swipe_delete_tip');
                await AsyncStorage.removeItem('has_seen_swipe_delete_tip_home');
                router.replace('/(tabs)');
              }}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                  <Ionicons name="compass-outline" size={20} color="#6366F1" />
                </View>
                <View>
                  <Text style={[styles.listItemTitle, { color: textPrimary }]}>Reset Tutorials & Tips</Text>
                  <Text style={[styles.listItemSubtitle, { color: textSecondary }]}>Replay the tour and tooltip animations</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textSecondary }]}>SUPPORT & FEEDBACK</Text>
          
          <View style={[styles.card, { backgroundColor: bgSurface, borderColor }]}>
            <Pressable 
              style={styles.listItem}
              onPress={() => setFeedbackVisible(true)}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Ionicons name="chatbox-ellipses-outline" size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[styles.listItemTitle, { color: textPrimary }]}>Report a Bug / Feedback</Text>
                  <Text style={[styles.listItemSubtitle, { color: textSecondary }]}>Share your ideas or report an issue</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textSecondary} />
            </Pressable>
          </View>
        </View>

        {aiSettings.byok_enabled && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textSecondary }]}>AI FEATURES</Text>
            
            <View style={[styles.card, { backgroundColor: bgSurface, borderColor }]}>
              <Pressable 
                style={styles.listItem}
                onPress={() => setByokVisible(true)}
              >
                <View style={styles.listItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Ionicons name="key-outline" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text style={[styles.listItemTitle, { color: textPrimary }]}>Custom API Key</Text>
                    <Text style={[styles.listItemSubtitle, { color: textSecondary }]}>
                      {aiSettings.has_custom_key ? 'Key is configured' : 'Bring your own Gemini key'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={textSecondary} />
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: textSecondary }]}>
            MacroTracker v{appVersion}
          </Text>
        </View>
      </ScrollView>

      <OnboardingModal
        visible={onboardingVisible}
        onSave={handleSaveOnboarding}
        onSkip={() => setOnboardingVisible(false)}
        initialStep={onboardingInitialStep}
        initialProfile={currentProfile}
      />

      <BYOKModal
        visible={byokVisible}
        hasCustomKey={aiSettings.has_custom_key}
        onClose={() => setByokVisible(false)}
        onSaveSuccess={fetchAiSettings}
      />

      <TipsModal 
        visible={tipsVisible} 
        onClose={() => setTipsVisible(false)} 
      />

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 16,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
