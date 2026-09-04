import React, { useState, useEffect, useMemo } from 'react';
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
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  ActivityGroup,
  ActivityVariant,
  ExerciseEntry,
  ExerciseSemanticCandidate,
  ExerciseSemanticResponse,
} from '@/lib/types';
import {
  getGroups,
  getGroup,
  getVariantsForGroup,
  searchCatalog,
  calculateBurnedCalories,
  cleanVariantName,
  getIntensityLabel,
} from '@/lib/compendiumCatalog';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AddExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onLogExercise: (entryData: any, desc: string) => Promise<void>;
  onUpdateExercise?: (id: string, entryData: any, desc: string) => Promise<void>;
  onAnalyzeExercise: (text: string) => Promise<ExerciseSemanticResponse>;
  editingExercise?: ExerciseEntry | null;
  userWeightKg?: number;
}

type ModalStep = 'input' | 'candidates' | 'confirm' | 'catalog';

const POPULAR_CATEGORIES = [
  'All',
  'Walking',
  'Running',
  'Bicycling',
  'Conditioning',
  'Dancing',
  'Sports',
  'Water Activities',
  'Winter Activities',
  'Lawn & Garden',
];

export function AddExerciseModal({
  visible,
  onClose,
  onLogExercise,
  onUpdateExercise,
  onAnalyzeExercise,
  editingExercise,
  userWeightKg = 70,
}: AddExerciseModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Modal Flow State
  const [step, setStep] = useState<ModalStep>('input');
  const [exerciseText, setExerciseText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambiguity / Selection State
  const [candidates, setCandidates] = useState<ExerciseSemanticCandidate[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ActivityGroup | null>(null);
  const [availableVariants, setAvailableVariants] = useState<ActivityVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ActivityVariant | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [workoutTitle, setWorkoutTitle] = useState<string>('');

  // Manual Catalog Search State
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');

  // Handle Edit Mode Initialization
  useEffect(() => {
    if (visible && editingExercise) {
      setWorkoutTitle(editingExercise.title || editingExercise.exercise_type);
      setDurationMinutes(editingExercise.duration_minutes || 30);
      setExerciseText(editingExercise.description || editingExercise.title || '');

      const allGroups = getGroups();
      const exerciseType = (editingExercise.exercise_type || '').toLowerCase();
      const title = (editingExercise.title || '').toLowerCase();

      // Find matching group
      let matchedGroup = allGroups.find(
        (g) => g.code === editingExercise.activity_code || g.name.toLowerCase() === title || g.name.toLowerCase() === exerciseType
      );

      if (!matchedGroup) {
        matchedGroup = allGroups.find((g) => {
          const gName = g.name.toLowerCase();
          return exerciseType.includes(gName) || gName.includes(exerciseType) || title.includes(gName) || gName.includes(title);
        });
      }

      if (!matchedGroup && allGroups.length > 0) {
        matchedGroup = allGroups[0];
      }

      if (matchedGroup) {
        setSelectedGroup(matchedGroup);
        const variants = getVariantsForGroup(matchedGroup.code);
        setAvailableVariants(variants);

        // Pre-select matching variant
        const matchedVariant = variants.find(
          (v) => v.code === editingExercise.activity_code || cleanVariantName(v.name).toLowerCase() === exerciseType
        );
        setSelectedVariant(matchedVariant || variants[0] || null);
      }

      setStep('confirm');
    } else if (visible && !editingExercise) {
      handleReset();
    }
  }, [visible, editingExercise]);

  // Theme Colors
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#0F172A' : '#F8FAFC';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const surfaceBg = isDark ? '#0F172A' : '#F1F5F9';
  const accentColor = '#3B82F6'; // Fitness Blue
  const activePillBg = isDark ? '#1E3A8A' : '#DBEAFE';

  const handleReset = () => {
    setStep('input');
    setExerciseText('');
    setIsProcessing(false);
    setErrorMessage(null);
    setCandidates([]);
    setSelectedGroup(null);
    setAvailableVariants([]);
    setSelectedVariant(null);
    setDurationMinutes(30);
    setWorkoutTitle('');
    setCatalogQuery('');
    setCatalogCategory('All');
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleReset();
    onClose();
  };

  // ── 1. Semantic Search Submission ──────────────────────────────────
  const handleAnalyze = async () => {
    if (!exerciseText.trim()) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res: ExerciseSemanticResponse = await onAnalyzeExercise(exerciseText);

      if (!res) {
        setIsProcessing(false);
        return;
      }

      const initialDuration = res.duration_minutes && res.duration_minutes > 0 ? res.duration_minutes : 30;
      setDurationMinutes(initialDuration);

      if (res.status === 'exact_match' && res.activity) {
        selectActivityGroup(res.activity.code, initialDuration, res.detected_intensity);
      } else if (res.status === 'multiple_candidates' && res.candidates && res.candidates.length > 0) {
        setCandidates(res.candidates);
        setStep('candidates');
      } else {
        setErrorMessage("We couldn't identify the workout. Pick your activity from the catalog below:");
        setCatalogQuery(exerciseText.trim());
        setStep('catalog');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Analysis failed. You can choose from the catalog manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── 2. Select an Activity Group and Populate Variants ──────────────
  const selectActivityGroup = (
    groupCode: string,
    durationOverride?: number,
    intensityHint?: 'light' | 'moderate' | 'vigorous' | null
  ) => {
    const group = getGroup(groupCode);
    if (!group) return;

    setSelectedGroup(group);
    setWorkoutTitle(group.name);

    // Get curated, human-friendly variants (strictly 2 to 5 options!)
    const variants = getVariantsForGroup(groupCode);
    setAvailableVariants(variants);

    // Pre-select variant based on hint, or pick the first moderate one, or the middle
    let defaultVariant = variants[0];
    if (intensityHint && variants.length > 1) {
      const match = variants.find((v) => v.intensity_level === intensityHint);
      if (match) defaultVariant = match;
    } else if (variants.length > 1) {
      const mod = variants.find((v) => v.intensity_level === 'moderate');
      defaultVariant = mod || variants[Math.floor(variants.length / 2)];
    }
    setSelectedVariant(defaultVariant || null);

    if (durationOverride) {
      setDurationMinutes(durationOverride);
    }

    Haptics.selectionAsync();
    setStep('confirm');
  };

  // ── 3. Duration Adjusters ──────────────────────────────────────────
  const adjustDuration = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDurationMinutes((prev) => Math.max(5, Math.min(600, prev + delta)));
  };

  // ── 4. Real-time Burned Calories Calculation ───────────────────────
  const estimatedCalories = useMemo(() => {
    if (!selectedVariant) return 0;
    return calculateBurnedCalories(selectedVariant.met, durationMinutes, userWeightKg);
  }, [selectedVariant, durationMinutes, userWeightKg]);

  // ── 5. Final Confirmation & Logging ────────────────────────────────
  const handleConfirmAndLog = async () => {
    if (!selectedVariant || !selectedGroup) return;

    setIsProcessing(true);
    try {
      const entryData = {
        title: workoutTitle.trim() || selectedGroup.name,
        exercise_type: cleanVariantName(selectedVariant.name),
        activity_code: selectedVariant.code,
        duration_minutes: durationMinutes,
        calories_burned: estimatedCalories,
      };

      if (editingExercise && onUpdateExercise) {
        await onUpdateExercise(editingExercise.id, entryData, exerciseText.trim() || selectedVariant.name);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleClose();
      } else {
        await onLogExercise(entryData, exerciseText.trim() || selectedVariant.name);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save workout.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── 6. Filtered Catalog Results for Manual Search ──────────────────
  const filteredCatalog = useMemo(() => {
    if (step !== 'catalog') return { groups: [] };
    const res = searchCatalog(catalogQuery);
    if (catalogCategory === 'All') return { groups: res.groups };

    return {
      groups: res.groups.filter((g) =>
        g.category.toLowerCase().includes(catalogCategory.toLowerCase())
      ),
    };
  }, [step, catalogQuery, catalogCategory]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.topSpacer} onPress={handleClose} />

        <View
          style={[
            styles.modalContent,
            { backgroundColor: cardBg },
            step === 'catalog' && styles.modalContentCatalog,
            step === 'confirm' && styles.modalContentConfirm,
          ]}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step !== 'input' && !editingExercise && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (step === 'confirm' && candidates.length > 1) {
                      setStep('candidates');
                    } else {
                      setStep('input');
                    }
                  }}
                  style={styles.backBtn}
                  hitSlop={10}
                >
                  <Ionicons name="arrow-back" size={22} color={textPrimary} />
                </Pressable>
              )}
              <Text style={[styles.title, { color: textPrimary }]}>
                {editingExercise
                  ? 'Edit Workout'
                  : step === 'input'
                  ? 'Log Exercise'
                  : step === 'candidates'
                  ? 'Choose Activity'
                  : step === 'confirm'
                  ? 'Workout Details'
                  : 'Exercise Catalog'}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color={textPrimary} />
            </Pressable>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* ──────────────── STEP 1: Text Description Input ──────────────── */}
          {step === 'input' && (
            <View style={styles.inputStepWrapper}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: textSecondary }]}>
                  Describe what workout you did:
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: inputBg, color: textPrimary, borderColor },
                  ]}
                  placeholder="e.g. 30 min brisk walk, or 45 min cycling"
                  placeholderTextColor={textSecondary}
                  multiline
                  maxLength={120}
                  numberOfLines={3}
                  value={exerciseText}
                  onChangeText={setExerciseText}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: exerciseText.length >= 95 ? '#F59E0B' : textSecondary }}>
                    {exerciseText.length}/120
                  </Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: accentColor },
                  (!exerciseText.trim() || isProcessing) && { opacity: 0.7 },
                ]}
                onPress={handleAnalyze}
                disabled={!exerciseText.trim() || isProcessing}
              >
                {isProcessing ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.primaryBtnText}>Finding Matching Activity...</Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="sparkles" size={18} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Find Activity</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
                <Text style={[styles.dividerText, { color: textSecondary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
              </View>

              <Pressable
                style={[styles.secondaryBtn, { borderColor }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStep('catalog');
                }}
              >
                <Ionicons name="search" size={18} color={accentColor} />
                <Text style={[styles.secondaryBtnText, { color: accentColor }]}>
                  Browse Exercise Catalog
                </Text>
              </Pressable>
            </View>
          )}

          {/* ──────────────── STEP 1.5: Multiple Candidates ──────────────── */}
          {step === 'candidates' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>
                We found a few matching activities for "{exerciseText}". Tap the closest one:
              </Text>

              <View style={styles.candidateList}>
                {candidates.map((cand) => (
                  <TouchableOpacity
                    key={cand.code}
                    activeOpacity={0.7}
                    style={[styles.candidateCard, { backgroundColor: surfaceBg, borderColor }]}
                    onPress={() => selectActivityGroup(cand.code, durationMinutes)}
                  >
                    <View style={styles.candidateContent}>
                      <View style={[styles.categoryBadge, { backgroundColor: activePillBg }]}>
                        <Text style={[styles.categoryBadgeText, { color: accentColor }]}>
                          {cand.category}
                        </Text>
                      </View>
                      <Text style={[styles.candidateName, { color: textPrimary }]}>{cand.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>

              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setCatalogQuery(exerciseText);
                  setStep('catalog');
                }}
              >
                <Text style={[styles.linkBtnText, { color: accentColor }]}>
                  None of these? Search catalog manually
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {/* ──────────────── STEP 2: Confirm & Customize ──────────────── */}
          {step === 'confirm' && selectedGroup && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* Selected Activity Badge */}
              <View style={[styles.groupBanner, { backgroundColor: surfaceBg, borderColor }]}>
                <View style={styles.groupBannerHeader}>
                  <View style={[styles.categoryBadge, { backgroundColor: activePillBg }]}>
                    <Text style={[styles.categoryBadgeText, { color: accentColor }]}>
                      {selectedGroup.category}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setStep('catalog')}
                    style={styles.changeActivityBtn}
                    hitSlop={8}
                  >
                    <Text style={[styles.changeActivityText, { color: accentColor }]}>Change</Text>
                  </Pressable>
                </View>
                <Text style={[styles.groupBannerTitle, { color: textPrimary }]}>
                  {selectedGroup.name}
                </Text>
              </View>

              {/* Intensity / Pacing Selector (Clean, Curated 2 to 5 options!) */}
              {availableVariants.length > 0 && (
                <View style={styles.fieldSection}>
                  <Text style={[styles.fieldLabel, { color: textSecondary }]}>Select Intensity / Pace</Text>
                  <View style={styles.variantsContainer}>
                    {availableVariants.map((v) => {
                      const isSelected = selectedVariant?.code === v.code;
                      const cleanName = cleanVariantName(v.name);
                      const intensityText = getIntensityLabel(v.intensity_level);

                      return (
                        <TouchableOpacity
                          key={v.code}
                          activeOpacity={0.7}
                          style={[
                            styles.variantOption,
                            { backgroundColor: surfaceBg, borderColor },
                            isSelected && {
                              borderColor: accentColor,
                              backgroundColor: isDark ? '#1E3A8A33' : '#EFF6FF',
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedVariant(v);
                          }}
                        >
                          <View style={styles.variantContent}>
                            <Text
                              style={[
                                styles.variantName,
                                { color: textPrimary },
                                isSelected && { fontWeight: '700', color: accentColor },
                              ]}
                            >
                              {cleanName}
                            </Text>
                            <View style={styles.variantPillRow}>
                              <View
                                style={[
                                  styles.intensityBadge,
                                  v.intensity_level === 'vigorous'
                                    ? styles.vigorousBadge
                                    : v.intensity_level === 'light'
                                    ? styles.lightBadge
                                    : styles.moderateBadge,
                                ]}
                              >
                                <Text style={styles.intensityBadgeText}>{intensityText}</Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.radioWrap}>
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={22}
                              color={isSelected ? accentColor : textSecondary}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Duration Stepper */}
              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Duration</Text>
                <View style={styles.stepperContainer}>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: surfaceBg, borderColor }]}
                    onPress={() => adjustDuration(-15)}
                  >
                    <Text style={[styles.stepBtnText, { color: textPrimary }]}>-15m</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: surfaceBg, borderColor }]}
                    onPress={() => adjustDuration(-5)}
                  >
                    <Text style={[styles.stepBtnText, { color: textPrimary }]}>-5m</Text>
                  </Pressable>

                  <View style={[styles.durationDisplay, { backgroundColor: inputBg, borderColor }]}>
                    <TextInput
                      style={[styles.durationNumber, { color: textPrimary }]}
                      keyboardType="numeric"
                      value={String(durationMinutes)}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        setDurationMinutes(isNaN(parsed) ? 0 : Math.min(600, parsed));
                      }}
                    />
                    <Text style={[styles.durationUnit, { color: textSecondary }]}>min</Text>
                  </View>

                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: surfaceBg, borderColor }]}
                    onPress={() => adjustDuration(5)}
                  >
                    <Text style={[styles.stepBtnText, { color: textPrimary }]}>+5m</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.stepBtn, { backgroundColor: surfaceBg, borderColor }]}
                    onPress={() => adjustDuration(15)}
                  >
                    <Text style={[styles.stepBtnText, { color: textPrimary }]}>+15m</Text>
                  </Pressable>
                </View>
              </View>

              {/* Optional Workout Title */}
              <View style={styles.fieldSection}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Workout Title (Optional)</Text>
                <TextInput
                  style={[styles.smallInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
                  value={workoutTitle}
                  onChangeText={setWorkoutTitle}
                  placeholder="e.g. Morning Workout"
                  placeholderTextColor={textSecondary}
                  maxLength={120}
                />
              </View>

              {/* Live Calories Burned Preview Card */}
              <View
                style={[
                  styles.calorieCard,
                  { backgroundColor: isDark ? '#1E3A8A25' : '#EFF6FF', borderColor: accentColor + '40' },
                ]}
              >
                <View style={styles.calorieCardIcon}>
                  <Ionicons name="flame" size={26} color="#F97316" />
                </View>
                <View style={styles.calorieCardInfo}>
                  <Text style={[styles.calorieCardNumber, { color: textPrimary }]}>
                    ~{estimatedCalories} kcal burned
                  </Text>
                  <Text style={[styles.calorieCardSub, { color: textSecondary }]}>
                    {durationMinutes} min • {selectedVariant ? getIntensityLabel(selectedVariant.intensity_level) : 'Moderate'} intensity
                  </Text>
                </View>
              </View>

              {/* Log Button */}
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: accentColor }, isProcessing && { opacity: 0.7 }]}
                onPress={handleConfirmAndLog}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.primaryBtnText}>
                      {editingExercise ? 'Update Workout' : 'Log Workout'}
                    </Text>
                  </View>
                )}
              </Pressable>
            </ScrollView>
          )}

          {/* ──────────────── STEP 3: Manual Catalog Browser ──────────────── */}
          {step === 'catalog' && (
            <View style={styles.catalogWrapper}>
              {/* Search Bar */}
              <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor }]}>
                <Ionicons name="search" size={18} color={textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: textPrimary }]}
                  placeholder="Search exercises (e.g. walk, cycle, swim)..."
                  placeholderTextColor={textSecondary}
                  value={catalogQuery}
                  onChangeText={setCatalogQuery}
                  autoFocus
                />
                {catalogQuery.length > 0 && (
                  <Pressable onPress={() => setCatalogQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={textSecondary} />
                  </Pressable>
                )}
              </View>

              {/* Category Filter Pills */}
              <View style={{ height: 42 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryPillsContent}
                >
                  {POPULAR_CATEGORIES.map((cat) => {
                    const isCatSelected = catalogCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCatalogCategory(cat);
                        }}
                        style={[
                          styles.catPill,
                          { backgroundColor: surfaceBg, borderColor },
                          isCatSelected && { backgroundColor: accentColor, borderColor: accentColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            { color: textSecondary },
                            isCatSelected && { color: '#FFF', fontWeight: '700' },
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Catalog Items List */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <Text style={[styles.catalogCount, { color: textSecondary }]}>
                  {filteredCatalog.groups.length} activities available
                </Text>

                {filteredCatalog.groups.map((g) => (
                  <TouchableOpacity
                    key={g.code}
                    activeOpacity={0.7}
                    style={[styles.catalogRow, { backgroundColor: surfaceBg, borderColor }]}
                    onPress={() => selectActivityGroup(g.code)}
                  >
                    <View style={styles.catalogRowLeft}>
                      <Text style={[styles.catalogRowName, { color: textPrimary }]}>{g.name}</Text>
                      <Text style={[styles.catalogRowCategory, { color: textSecondary }]}>
                        {g.category}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={textSecondary} />
                  </TouchableOpacity>
                ))}

                {filteredCatalog.groups.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="barbell-outline" size={36} color={textSecondary} />
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No activities found for "{catalogQuery}"
                    </Text>
                  </View>
                )}
              </ScrollView>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  topSpacer: {
    flex: 1,
  },
  inputStepWrapper: {
    paddingBottom: 4,
  },
  modalContent: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    maxHeight: '90%',
  },
  modalContentCatalog: {
    height: '86%',
    maxHeight: '92%',
  },
  modalContentConfirm: {
    maxHeight: '92%',
    minHeight: 450,
  },
  catalogWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 85,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  primaryBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  candidateList: {
    gap: 8,
    marginBottom: 14,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  candidateContent: {
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  candidateName: {
    fontSize: 15,
    fontWeight: '600',
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  groupBanner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  groupBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupBannerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  changeActivityBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  changeActivityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  variantsContainer: {
    gap: 8,
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  variantContent: {
    flex: 1,
    marginRight: 8,
  },
  variantName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  variantPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioWrap: {
    marginLeft: 6,
  },
  intensityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  intensityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  lightBadge: {
    backgroundColor: '#10B981',
  },
  moderateBadge: {
    backgroundColor: '#3B82F6',
  },
  vigorousBadge: {
    backgroundColor: '#F97316',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  durationDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
  },
  durationNumber: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 36,
  },
  durationUnit: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  calorieCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  calorieCardInfo: {
    flex: 1,
  },
  calorieCardNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  calorieCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoryPillsContent: {
    gap: 6,
    paddingVertical: 2,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  catalogCount: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: 6,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  catalogRowLeft: {
    flex: 1,
  },
  catalogRowName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  catalogRowCategory: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
  },
});
