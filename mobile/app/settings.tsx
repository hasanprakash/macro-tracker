import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAlert } from '@/components/ui/CustomAlert';
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [strideCm, setStrideCm] = useState('');
  const [fiveKmDistance, setFiveKmDistance] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      if (data.stride_length_cm) {
        setStrideCm(data.stride_length_cm.toString());
      }
    }
  };

  const calculateAndSetStride = (kmDistanceStr: string) => {
    setFiveKmDistance(kmDistanceStr);
    const km = parseFloat(kmDistanceStr);
    if (!isNaN(km) && km > 0) {
      // 5000 steps = X km
      // 1 step = X km / 5000 = (X * 1000) m / 5000 = (X * 1000 * 100) cm / 5000
      const cm = (km * 100000) / 5000;
      setStrideCm(Math.round(cm).toString());
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    
    const parsedStride = parseInt(strideCm, 10);
    const strideToSave = isNaN(parsedStride) ? null : parsedStride;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ stride_length_cm: strideToSave })
        .eq('id', profile.id);
      
      if (error) throw error;
      
      showAlert('Success', 'Settings saved successfully');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message);
    } finally {
      setSaving(false);
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

      <View style={[styles.section, { backgroundColor: bgSurface, borderColor }]}>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Walking Settings</Text>
        <Text style={[styles.sectionDesc, { color: textSecondary }]}>
          Your stride length is used to estimate distance and calories burned from your daily steps.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Average walking stride (cm)</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor, backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}
            value={strideCm}
            onChangeText={(text) => {
              setStrideCm(text);
              setFiveKmDistance(''); // clear distance if they edit stride directly
            }}
            keyboardType="numeric"
            placeholder="e.g. 74"
            placeholderTextColor={textSecondary}
          />
        </View>

        <View style={styles.divider}>
          <Text style={[styles.dividerText, { color: textSecondary, backgroundColor: bgSurface }]}>OR</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Typical 5,000-step distance (km)</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor, backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}
            value={fiveKmDistance}
            onChangeText={calculateAndSetStride}
            keyboardType="numeric"
            placeholder="e.g. 3.7"
            placeholderTextColor={textSecondary}
          />
          <Text style={[styles.helperText, { color: textSecondary }]}>
            We will automatically calculate your stride from this distance.
          </Text>
        </View>

        <Pressable 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
        </Pressable>
      </View>
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
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerText: {
    position: 'absolute',
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
