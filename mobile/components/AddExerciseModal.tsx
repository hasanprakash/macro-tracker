import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AddExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onLogExercise: (entryData: any, desc: string) => Promise<void>;
  onAnalyzeExercise: (text: string) => Promise<any>;
}

export function AddExerciseModal({
  visible,
  onClose,
  onLogExercise,
  onAnalyzeExercise,
}: AddExerciseModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [exerciseText, setExerciseText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#0F172A' : '#F8FAFC';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const activeColor = '#14B8A6'; // Teal for exercise

  const handleReset = () => {
    setExerciseText('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      if (!exerciseText.trim()) {
        setIsProcessing(false);
        return;
      }
      const result = await onAnalyzeExercise(exerciseText);
      await onLogExercise(result, exerciseText);
      handleClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Log Exercise</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={textPrimary} />
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: textSecondary }]}>Describe your workout</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
              placeholder="e.g. Ran for 30 minutes, or heavy weightlifting for an hour"
              placeholderTextColor={textSecondary}
              multiline
              numberOfLines={3}
              value={exerciseText}
              onChangeText={setExerciseText}
              autoFocus
            />
          </View>

          <Pressable
            style={[styles.submitBtn, { backgroundColor: activeColor }, isProcessing && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Log Exercise</Text>
            )}
          </Pressable>
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
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
