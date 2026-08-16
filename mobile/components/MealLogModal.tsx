import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface MealLogModalProps {
  visible: boolean;
  mealType: string;
  onClose: () => void;
  onSubmitText: (text: string) => void;
  onScanPress: () => void;
  isSubmitting: boolean;
}

export function MealLogModal({ visible, mealType, onClose, onSubmitText, onScanPress, isSubmitting }: MealLogModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [mode, setMode] = useState<'options' | 'text'>('options');
  const [text, setText] = useState('');

  const handleClose = () => {
    setMode('options');
    setText('');
    onClose();
  };

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmitText(text.trim());
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Log {mealType}</Text>
            <Pressable onPress={handleClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>

          {isSubmitting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={[styles.loadingText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                Analyzing {mealType.toLowerCase()}...
              </Text>
            </View>
          ) : mode === 'options' ? (
            <View style={styles.optionsContainer}>
              <Pressable
                style={[styles.optionButton, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
                onPress={() => onScanPress()}
              >
                <Ionicons name="camera-outline" size={32} color="#6366F1" />
                <Text style={[styles.optionText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Scan Food</Text>
                <Text style={[styles.optionSubtext, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Take a photo to analyze macros
                </Text>
              </Pressable>

              <Pressable
                style={[styles.optionButton, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
                onPress={() => setMode('text')}
              >
                <Ionicons name="text-outline" size={32} color="#10B981" />
                <Text style={[styles.optionText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Enter Text</Text>
                <Text style={[styles.optionSubtext, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Type what you ate manually
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.textInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                    borderColor: isDark ? '#334155' : '#E2E8F0'
                  }
                ]}
                placeholder="e.g. 2 scrambled eggs and 1 slice of toast"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                multiline
                value={text}
                onChangeText={setText}
                autoFocus
              />
              
              <View style={styles.actionButtons}>
                <Pressable
                  style={[styles.backButton, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                  onPress={() => setMode('options')}
                >
                  <Text style={[styles.backButtonText, { color: isDark ? '#CBD5E1' : '#475569' }]}>Back</Text>
                </Pressable>
                
                <Pressable
                  style={[styles.submitButton, !text.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!text.trim()}
                >
                  <Text style={styles.submitButtonText}>Log It</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 350,
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
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  optionSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  textInputContainer: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A5B4FC',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
