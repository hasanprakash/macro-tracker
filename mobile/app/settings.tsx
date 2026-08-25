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
  const [aiSettings, setAiSettings] = useState({ byok_enabled: false, has_custom_key: false });

  useEffect(() => {
    fetchAiSettings();
  }, []);

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
        .update(profileData)
        .eq('id', user.id);
        
      if (error) throw error;
      
      showAlert('Success', 'Goals updated successfully');
      setOnboardingVisible(false);
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
              onPress={() => setOnboardingVisible(true)}
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
      </ScrollView>

      <OnboardingModal
        visible={onboardingVisible}
        onSave={handleSaveOnboarding}
        onSkip={() => setOnboardingVisible(false)}
      />

      <BYOKModal
        visible={byokVisible}
        hasCustomKey={aiSettings.has_custom_key}
        onClose={() => setByokVisible(false)}
        onSaveSuccess={fetchAiSettings}
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
});
