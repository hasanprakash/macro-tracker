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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Profile } from '@/lib/types';
import { TipsModal } from '@/components/TipsModal';

interface OnboardingModalProps {
  visible: boolean;
  onSave: (profileData: Partial<Profile>) => Promise<void>;
  onSkip: () => void;
}

type Step = 'intro' | 'age-gender' | 'height-weight' | 'goal' | 'target-weight' | 'review';

export function OnboardingModal({ visible, onSave, onSkip }: OnboardingModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [step, setStep] = useState<Step>('intro');
  const [isSaving, setIsSaving] = useState(false);
  const [tipsVisible, setTipsVisible] = useState(false);

  // Form State
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | null>(null);
  const [height, setHeight] = useState(''); // cm
  const [weight, setWeight] = useState(''); // kg
  const [goal, setGoal] = useState<'Lose weight' | 'Maintain weight' | 'Gain weight' | 'Just track my food' | null>(null);
  const [targetWeight, setTargetWeight] = useState(''); // kg


  // Calculated Targets State
  const [targetCalories, setTargetCalories] = useState('');
  const [maintenanceCalories, setMaintenanceCalories] = useState('');
  const [underEatingThreshold, setUnderEatingThreshold] = useState('');
  const [targetSteps, setTargetSteps] = useState('');
  const [targetProtein, setTargetProtein] = useState('');
  const [targetCarbs, setTargetCarbs] = useState('');
  const [targetFat, setTargetFat] = useState('');

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const inputBg = isDark ? '#0F172A' : '#F8FAFC';
  const buttonBg = isDark ? '#334155' : '#F1F5F9';

  const handleNext = () => {
    if (step === 'intro') setStep('age-gender');
    else if (step === 'age-gender') setStep('height-weight');
    else if (step === 'height-weight') setStep('goal');
    else if (step === 'goal') {
      if (goal === 'Lose weight' || goal === 'Gain weight') {
        setStep('target-weight');
      } else {
        calculateTargets();
        setStep('review');
      }
    } else if (step === 'target-weight') {
      calculateTargets();
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'age-gender') setStep('intro');
    else if (step === 'height-weight') setStep('age-gender');
    else if (step === 'goal') setStep('height-weight');
    else if (step === 'target-weight') setStep('goal');
    else if (step === 'review') {
      if (goal === 'Lose weight' || goal === 'Gain weight') setStep('target-weight');
      else setStep('goal');
    }
  };

  const calculateTargets = () => {
    const a = parseInt(age);
    const h = parseFloat(height);
    const w = parseFloat(weight);
    
    // 1. Mifflin-St Jeor BMR
    let bmr = 10 * w + 6.25 * h - 5 * a;
    bmr += gender === 'Male' ? 5 : -161;

    // 2. Activity Level Multiplier
    let pal = 1.2;

    let tdee = bmr * pal;

    // 3. Goal adjustments
    let calTarget = tdee;
    if (goal === 'Lose weight') calTarget -= 450;
    else if (goal === 'Gain weight') calTarget += 300;

    // 4. Macros & Specific Logic
    const bmi = w / ((h / 100) * (h / 100));
    const activeWeight = (bmi >= 30 && goal === 'Lose weight') ? (targetWeight ? parseFloat(targetWeight) : w) : w;
    const proteinMultiplier = (bmi >= 30 && goal === 'Lose weight') ? 1.5 : 1.8;
    
    const pTarget = activeWeight * proteinMultiplier;
    const pCals = pTarget * 4;

    let fatPercent = 0.30;
    if (goal === 'Lose weight') fatPercent = 0.20;
    else if (goal === 'Maintain weight') fatPercent = 0.25;
    
    const fCals = calTarget * fatPercent;
    const fTarget = fCals / 9;

    const cCals = calTarget - pCals - fCals;
    const cTarget = cCals / 4;

    // 5. Steps
    let steps = 5000;
    
    setMaintenanceCalories(Math.round(tdee).toString());
    setUnderEatingThreshold(Math.round(bmr).toString());
    setTargetSteps(steps.toString());
    
    setTargetCalories(Math.round(calTarget).toString());
    setTargetProtein(Math.round(pTarget).toString());
    setTargetFat(Math.round(fTarget).toString());
    setTargetCarbs(Math.round(cTarget).toString());
  };

  const submitProfile = async () => {
    setIsSaving(true);
    await onSave({
      age: parseInt(age) || null,
      gender,
      height_cm: parseFloat(height) || null,
      weight_kg: parseFloat(weight) || null,
      goal,
      target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
      activity_level: 'Sedentary',
      maintenance_calories: parseFloat(maintenanceCalories) || null,
      under_eating_threshold: parseFloat(underEatingThreshold) || null,
      target_steps: parseInt(targetSteps) || null,
      target_calories: parseFloat(targetCalories) || 2000,
      target_protein: parseFloat(targetProtein) || 150,
      target_carbs: parseFloat(targetCarbs) || 200,
      target_fat: parseFloat(targetFat) || 65,
    });
    setIsSaving(false);
  };

  const canProceed = () => {
    if (step === 'age-gender') return age && gender;
    if (step === 'height-weight') return height && weight;

    if (step === 'goal') return goal;
    if (step === 'target-weight') {
      const current = parseFloat(weight);
      const target = parseFloat(targetWeight);
      if (!targetWeight || isNaN(target)) return false;
      if (goal === 'Lose weight' && target >= current) return false;
      if (goal === 'Gain weight' && target <= current) return false;
      return true;
    }
    return true;
  };

  const getStepNumber = () => {
    switch (step) {
      case 'intro': return 1;
      case 'age-gender': return 2;
      case 'height-weight': return 3;
      case 'goal': return 4;
      case 'target-weight': return 5;
      case 'review': return 6;
      default: return 1;
    }
  };

  const stepNumber = getStepNumber();
  const totalSteps = goal === 'Lose weight' || goal === 'Gain weight' ? 6 : 5;
  const progressPercent = (stepNumber / totalSteps) * 100;

  const bmrInfoText = () => {
    if (goal === 'Just track my food') return null;

    let targetDiff = 0;
    if (goal === 'Lose weight') targetDiff = parseFloat(maintenanceCalories) - parseFloat(targetCalories);
    else if (goal === 'Gain weight') targetDiff = parseFloat(targetCalories) - parseFloat(maintenanceCalories);
    
    // approx 7700 kcal per kg of body fat. So weekly diff = targetDiff * 7
    // weekly weight change = (targetDiff * 7) / 7700 = targetDiff / 1100
    const weeklyChange = (targetDiff / 1100).toFixed(2);
    const actionStr = goal === 'Lose weight' ? 'lose' : (goal === 'Gain weight' ? 'gain' : 'maintain');

    return (
      <View style={[styles.infoBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
        <Ionicons name="information-circle" size={24} color="#3B82F6" style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.infoTitle, { color: textPrimary }]}>BMR Estimate</Text>
          <Text style={[styles.infoText, { color: textSecondary }]}>
            Everyone's Basal Metabolic Rate (BMR) varies. Based on these calculated targets, we estimate you will {actionStr} <Text style={{ fontWeight: '600', color: textPrimary }}>~{weeklyChange} kg</Text> per week. 
          </Text>
          <Text style={[styles.infoText, { color: textSecondary, marginTop: 8 }]}>
            We will adjust your calorie targets as you progress toward your accurate BMR. Please note that BMR can be affected negatively by poor health and under-eating, and positively by gaining muscle mass.
          </Text>
        </View>
      </View>
    );
  };

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.emoji, { fontSize: 48, textAlign: 'center' }]}>🎯</Text>
      <Text style={[styles.title, { color: textPrimary, textAlign: 'center', marginTop: 16 }]}>
        Set Your Nutrition Goals
      </Text>
      <Text style={[styles.subtitle, { color: textSecondary, textAlign: 'center', marginTop: 12 }]}>
        Let's calculate your personalized calorie and macro targets based on your body and goals.
      </Text>
      
      <View style={{ marginTop: 40, gap: 12 }}>
        <Pressable style={styles.primaryBtn} onPress={handleNext}>
          <Text style={styles.primaryBtnText}>Start Setup</Text>
        </Pressable>
        <Pressable 
          style={[styles.secondaryBtn, { borderColor }]} 
          onPress={onSkip}
        >
          <Text style={[styles.secondaryBtnText, { color: textPrimary }]}>
            Just want to track food for now? Skip goals
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderAgeGender = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: textPrimary }]}>Basic Info</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>We use this to calculate your metabolic rate.</Text>
      
      <Text style={[styles.label, { color: textPrimary, marginTop: 24 }]}>Age</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
        keyboardType="numeric"
        placeholder="e.g. 28"
        placeholderTextColor={textSecondary}
        value={age}
        onChangeText={setAge}
      />

      <Text style={[styles.label, { color: textPrimary, marginTop: 24 }]}>Gender</Text>
      <View style={styles.rowGrid}>
        <Pressable
          style={[styles.choiceBtn, { backgroundColor: buttonBg, borderColor }, gender === 'Male' && styles.choiceActive]}
          onPress={() => setGender('Male')}
        >
          <Text style={[styles.choiceText, { color: textPrimary }, gender === 'Male' && styles.choiceActiveText]}>Male</Text>
        </Pressable>
        <Pressable
          style={[styles.choiceBtn, { backgroundColor: buttonBg, borderColor }, gender === 'Female' && styles.choiceActive]}
          onPress={() => setGender('Female')}
        >
          <Text style={[styles.choiceText, { color: textPrimary }, gender === 'Female' && styles.choiceActiveText]}>Female</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderHeightWeight = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: textPrimary }]}>Body Metrics</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>Just a few more details for the formula.</Text>
      
      <Text style={[styles.label, { color: textPrimary, marginTop: 24 }]}>Height (cm)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
        keyboardType="decimal-pad"
        placeholder="e.g. 175"
        placeholderTextColor={textSecondary}
        value={height}
        onChangeText={setHeight}
      />

      <Text style={[styles.label, { color: textPrimary, marginTop: 24 }]}>Current Weight (kg)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
        keyboardType="decimal-pad"
        placeholder="e.g. 70"
        placeholderTextColor={textSecondary}
        value={weight}
        onChangeText={setWeight}
      />
    </View>
  );

  const renderGoal = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: textPrimary }]}>What's your goal?</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>We'll adjust your calories accordingly.</Text>
      
      <View style={{ marginTop: 24, gap: 12 }}>
        {['Lose weight', 'Maintain weight', 'Gain weight', 'Just track my food'].map((g) => (
          <Pressable
            key={g}
            style={[styles.choiceListBtn, { backgroundColor: buttonBg, borderColor }, goal === g && styles.choiceActive]}
            onPress={() => setGoal(g as any)}
          >
            <Text style={[styles.choiceText, { color: textPrimary }, goal === g && styles.choiceActiveText]}>{g}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderTargetWeight = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: textPrimary }]}>Target Weight</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>
        Since your goal is to {goal?.toLowerCase()}, what is your target weight?
      </Text>
      
      <Text style={[styles.label, { color: textPrimary, marginTop: 24 }]}>Target Weight (kg)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
        keyboardType="decimal-pad"
        placeholder={`Current: ${weight} kg`}
        placeholderTextColor={textSecondary}
        value={targetWeight}
        onChangeText={setTargetWeight}
      />
      
      {targetWeight !== '' && goal === 'Lose weight' && parseFloat(targetWeight) >= parseFloat(weight) && (
        <Text style={styles.errorText}>Target weight must be less than current weight.</Text>
      )}
      {targetWeight !== '' && goal === 'Gain weight' && parseFloat(targetWeight) <= parseFloat(weight) && (
        <Text style={styles.errorText}>Target weight must be greater than current weight.</Text>
      )}
    </View>
  );

  const renderReview = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: textPrimary }]}>Your Targets</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>
        Here are your calculated daily targets.
      </Text>
      
      <View style={styles.reviewGrid}>
        <View style={[styles.reviewCard, { backgroundColor: inputBg, borderColor }]}>
          <Text style={[styles.reviewValue, { color: '#6366F1' }]}>{targetCalories}</Text>
          <Text style={[styles.reviewLabel, { color: textSecondary }]}>Calories</Text>
        </View>
        <View style={[styles.reviewCard, { backgroundColor: inputBg, borderColor }]}>
          <Text style={[styles.reviewValue, { color: '#F43F5E' }]}>{targetProtein}g</Text>
          <Text style={[styles.reviewLabel, { color: textSecondary }]}>Protein</Text>
        </View>
        <View style={[styles.reviewCard, { backgroundColor: inputBg, borderColor }]}>
          <Text style={[styles.reviewValue, { color: '#60A5FA' }]}>{targetCarbs}g</Text>
          <Text style={[styles.reviewLabel, { color: textSecondary }]}>Carbs</Text>
        </View>
        <View style={[styles.reviewCard, { backgroundColor: inputBg, borderColor }]}>
          <Text style={[styles.reviewValue, { color: '#FBBF24' }]}>{targetFat}g</Text>
          <Text style={[styles.reviewLabel, { color: textSecondary }]}>Fat</Text>
        </View>
        <View style={[styles.reviewCard, { backgroundColor: inputBg, borderColor }]}>
          <Text style={[styles.reviewValue, { color: '#10B981' }]}>{targetSteps}</Text>
          <Text style={[styles.reviewLabel, { color: textSecondary }]}>Steps/Day</Text>
        </View>
      </View>

      {bmrInfoText()}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
          
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {step !== 'intro' && (
                <Pressable onPress={handleBack} style={{ padding: 4, marginLeft: -4 }}>
                  <Ionicons name="arrow-back" size={24} color={textPrimary} />
                </Pressable>
              )}
              <Text style={[styles.title, { color: textPrimary }]}>
                {step === 'review' ? 'Your Goals' : 'Nutrition Goals'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {step === 'review' && (
                <Pressable onPress={() => setTipsVisible(true)} style={{ padding: 4 }}>
                  <Ionicons name="bulb-outline" size={24} color="#EAB308" />
                </Pressable>
              )}
              <Pressable onPress={onSkip} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Progress Bar */}
          {step !== 'intro' && (
            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, { color: textSecondary }]}>Step {stepNumber} of {totalSteps}</Text>
              <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {step === 'intro' && renderIntro()}
            {step === 'age-gender' && renderAgeGender()}
            {step === 'height-weight' && renderHeightWeight()}
            {step === 'goal' && renderGoal()}
            {step === 'target-weight' && renderTargetWeight()}
            {step === 'review' && renderReview()}
          </ScrollView>

          {step !== 'intro' && (
            <View style={styles.footer}>
              {step !== 'review' ? (
                <Pressable
                  style={[styles.primaryBtn, !canProceed() && styles.btnDisabled]}
                  onPress={handleNext}
                  disabled={!canProceed()}
                >
                  <Text style={styles.primaryBtnText}>Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, isSaving && styles.btnDisabled]}
                  onPress={submitProfile}
                  disabled={isSaving}
                >
                  <Text style={styles.primaryBtnText}>{isSaving ? 'Saving...' : 'Save Targets'}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <TipsModal visible={tipsVisible} onClose={() => setTipsVisible(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  stepContainer: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  choiceBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  choiceListBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  choiceText: {
    fontSize: 16,
    fontWeight: '500',
  },
  choiceActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  choiceActiveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  reviewCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  reviewValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
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
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  primaryBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
