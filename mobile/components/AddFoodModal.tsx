import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RecentFood, FoodItem, MealTotals } from '@/lib/types';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AddFoodModalProps {
  visible: boolean;
  mealType: string;
  recentFoods: RecentFood[];
  onClose: () => void;
  onAnalyze: (text?: string, imageBase64?: string) => void;
  onQuickAdd: (mealName: string, foods: FoodItem[], totals: MealTotals) => void;
  onRepeatYesterday: () => void;
}

export function AddFoodModal({
  visible,
  mealType,
  recentFoods,
  onClose,
  onAnalyze,
  onQuickAdd,
  onRepeatYesterday,
}: AddFoodModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [mode, setMode] = useState<'options' | 'describe'>('options');
  const [description, setDescription] = useState('');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [showTip, setShowTip] = useState(false);

  React.useEffect(() => {
    if (visible) {
      checkTip();
    }
  }, [visible]);

  const checkTip = async () => {
    try {
      const hasSeen = await AsyncStorage.getItem('has_seen_add_food_tip');
      if (!hasSeen) {
        setShowTip(true);
      }
    } catch (e) {}
  };

  const dismissTip = async () => {
    setShowTip(false);
    try {
      await AsyncStorage.setItem('has_seen_add_food_tip', 'true');
    } catch (e) {}
  };

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const inputBg = isDark ? '#0F172A' : '#F8FAFC';
  const buttonBg = isDark ? '#334155' : '#F1F5F9';

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode('options');
    setDescription('');
    setImageBase64(undefined);
    setImageUri(undefined);
    onClose();
  };

  const processImage = async (uri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipResult.base64) {
        setImageBase64(manipResult.base64);
        setImageUri(manipResult.uri);
      }
    } catch (error) {
      console.error("Image processing error:", error);
      alert("Failed to process image.");
    }
  };

  const handleScanPress = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("You need to allow camera access to scan food.");
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({
      quality: 1, // Capture full quality, then compress specifically in ImageManipulator
    });
    if (!pickerResult.canceled && pickerResult.assets[0].uri) {
      await processImage(pickerResult.assets[0].uri);
      setMode('describe'); // Move to describe mode so they can add optional text or submit directly
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("You need to allow gallery access to pick food images.");
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
    });
    if (!pickerResult.canceled && pickerResult.assets[0].uri) {
      await processImage(pickerResult.assets[0].uri);
    }
  };

  const handleSubmitDescribe = () => {
    if (description.trim() || imageBase64) {
      onAnalyze(description.trim(), imageBase64);
      handleClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Add to {mealType}</Text>
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={24} color={textSecondary} />
            </Pressable>
          </View>

          {showTip && (
            <View style={[styles.tipBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Ionicons name="information-circle" size={24} color="#3B82F6" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.tipText, { color: textPrimary }]}>
                  Results will be more accurate if you attach a photo and describe the items!
                </Text>
              </View>
              <Pressable onPress={dismissTip} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </Pressable>
            </View>
          )}

          {mode === 'options' ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.optionsGrid}>
                {/* Search / Describe (Text) */}
                <Pressable
                  style={[styles.optionCard, { backgroundColor: buttonBg, borderColor }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMode('describe');
                  }}
                >
                  <Ionicons name="text-outline" size={28} color="#10B981" />
                  <Text style={[styles.optionTitle, { color: textPrimary }]}>Describe meal</Text>
                  <Text style={[styles.optionSub, { color: textSecondary }]}>Type what you ate</Text>
                </Pressable>

                {/* Scan (Camera) */}
                <Pressable
                  style={[styles.optionCard, { backgroundColor: buttonBg, borderColor }]}
                  onPress={handleScanPress}
                >
                  <Ionicons name="camera-outline" size={28} color="#10B981" />
                  <Text style={[styles.optionTitle, { color: textPrimary }]}>Scan meal</Text>
                  <Text style={[styles.optionSub, { color: textSecondary }]}>Use camera</Text>
                </Pressable>
              </View>

              {/* Repeat Yesterday */}
              <Pressable
                style={({ pressed }) => [
                  styles.listOption,
                  { borderColor },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  onRepeatYesterday();
                  handleClose();
                }}
              >
                <View style={styles.listOptionLeft}>
                  <Ionicons name="repeat" size={22} color="#F59E0B" />
                  <Text style={[styles.listOptionTitle, { color: textPrimary }]}>Repeat yesterday</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={textSecondary} />
              </Pressable>

              {/* Recent Foods */}
              <View style={styles.recentSection}>
                <Text style={[styles.recentTitle, { color: textPrimary }]}>⭐ Recent foods</Text>
                {recentFoods.length > 0 ? (
                  recentFoods.map((recent) => (
                    <Pressable
                      key={recent.id}
                      style={({ pressed }) => [
                        styles.recentRow,
                        { borderColor },
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => {
                        onQuickAdd(
                          recent.meal_name,
                          recent.foods,
                          {
                            calories: recent.total_calories,
                            protein_g: recent.total_protein,
                            carbs_g: recent.total_carbs,
                            fat_g: recent.total_fat,
                          }
                        );
                        handleClose();
                      }}
                    >
                      <View style={styles.recentInfo}>
                        <Text style={[styles.recentName, { color: textPrimary }]}>
                          {recent.meal_name}
                        </Text>
                        <Text style={[styles.recentCal, { color: textSecondary }]}>
                          {recent.total_calories} kcal
                        </Text>
                      </View>
                      <View style={styles.addIconWrap}>
                        <Ionicons name="add" size={20} color="#10B981" />
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={{ color: textSecondary, marginTop: 8, fontStyle: 'italic' }}>
                    No recent foods yet.
                  </Text>
                )}
              </View>
            </ScrollView>
          ) : (
            /* Describe Mode (Text + optional Image) */
            <View style={styles.describeContainer}>
              <Text style={[styles.describeHint, { color: textSecondary }]}>
                Describe your meal, or attach a photo, or both!
              </Text>
              
              <View style={styles.imageActions}>
                <Pressable
                  style={[styles.imageBtn, { backgroundColor: buttonBg }]}
                  onPress={handleScanPress}
                >
                  <Ionicons name="camera" size={20} color="#10B981" />
                  <Text style={[styles.imageBtnText, { color: textPrimary }]}>
                    {imageBase64 ? 'Retake Photo' : 'Take Photo'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.imageBtn, { backgroundColor: buttonBg }]}
                  onPress={handlePickImage}
                >
                  <Ionicons name="image" size={20} color="#10B981" />
                  <Text style={[styles.imageBtnText, { color: textPrimary }]}>
                    Gallery
                  </Text>
                </Pressable>
              </View>

              {imageUri && (
                <View style={[styles.imagePreviewWrap, { borderColor }]}>
                  <Text style={{ color: textPrimary, fontSize: 12, marginBottom: 4 }}>
                    Image attached ✅
                  </Text>
                </View>
              )}

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: inputBg, color: textPrimary, borderColor },
                ]}
                placeholder="e.g. 2 scrambled eggs and 1 slice of toast, or 'I ate half of this'"
                placeholderTextColor={textSecondary}
                multiline
                value={description}
                onChangeText={setDescription}
                autoFocus={!imageBase64} // Auto focus if no image was taken yet
              />

              <View style={styles.actionButtons}>
                <Pressable
                  style={[styles.backButton, { borderColor }]}
                  onPress={() => setMode('options')}
                >
                  <Text style={[styles.backButtonText, { color: textSecondary }]}>Back</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.submitButton,
                    (!description.trim() && !imageBase64) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmitDescribe}
                  disabled={!description.trim() && !imageBase64}
                >
                  <Text style={styles.submitButtonText}>Analyze</Text>
                </Pressable>
              </View>
            </View>
          )}
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
    maxHeight: '85%',
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
  tipBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  optionSub: {
    fontSize: 12,
    marginTop: 4,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  listOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  recentSection: {
    marginTop: 20,
    paddingBottom: 20,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 15,
    fontWeight: '500',
  },
  recentCal: {
    fontSize: 13,
    marginTop: 2,
  },
  addIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  describeContainer: {
    gap: 16,
  },
  describeHint: {
    fontSize: 14,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  imageBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewWrap: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#6EE7B7',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
