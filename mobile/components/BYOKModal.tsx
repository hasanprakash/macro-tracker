import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/components/ui/CustomAlert';

interface BYOKModalProps {
  visible: boolean;
  onClose: () => void;
  hasCustomKey: boolean;
  onSaveSuccess: () => void;
}

export function BYOKModal({ visible, onClose, hasCustomKey, onSaveSuccess }: BYOKModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showAlert } = useAlert();

  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const inputBg = isDark ? '#0F172A' : '#F1F5F9';
  const accentColor = '#6366F1';

  // Clear input when modal opens
  useEffect(() => {
    if (visible) {
      setApiKey('');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      showAlert('Error', 'Please enter a valid API key.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_custom_api_key', {
        new_key: apiKey.trim(),
      });

      if (error) throw error;
      
      showAlert('Success', 'Your API key has been securely saved.');
      onSaveSuccess();
      onClose();
    } catch (e: any) {
      showAlert('Save Failed', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContainer, { backgroundColor: cardBg }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textPrimary }]}>Bring Your Own Key</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.infoBox, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Ionicons name="information-circle" size={24} color={accentColor} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.infoTitle, { color: textPrimary }]}>Free AI Features</Text>
                <Text style={[styles.infoText, { color: textSecondary }]}>
                  By providing your own Gemini API key, you can unlock free AI features. 
                  Your key is encrypted and stored safely on our secure servers, and it is entirely inaccessible to other users or apps.
                </Text>
              </View>
            </View>

            <Text style={[styles.label, { color: textPrimary }]}>Your Gemini API Key</Text>
            
            {hasCustomKey && !apiKey && (
              <Text style={{ color: '#10B981', fontSize: 13, marginBottom: 8, fontWeight: '500' }}>
                ✓ You currently have a custom API key saved. Enter a new one below to replace it.
              </Text>
            )}

            <TextInput
              style={[
                styles.input,
                { color: textPrimary, backgroundColor: inputBg, borderColor }
              ]}
              placeholder="AIzaSy..."
              placeholderTextColor={textSecondary}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              secureTextEntry
              autoCorrect={false}
            />

            <Pressable 
              style={styles.linkButton} 
              onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
            >
              <Ionicons name="open-outline" size={16} color={accentColor} style={{ marginRight: 6 }} />
              <Text style={[styles.linkText, { color: accentColor }]}>Get a key from Google AI Studio</Text>
            </Pressable>

            <Pressable 
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Key</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      }
    })
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
