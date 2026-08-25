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
        keyboardType="numeric"
        placeholder="e.g. 175"
        placeholderTextColor={textSecondary}
        value={height}
        onChangeText={setHeight}
      />

      <Text style={[styles.label, { color: textPrimary, marginTop: 24 }]}>Current Weight (kg)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
        keyboardType="numeric"
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
        keyboardType="numeric"
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
        Here are your calculated daily targets. You can tweak them manually if you prefer.
      </Text>
      
      <View style={{ marginTop: 24, gap: 16 }}>
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: textPrimary }]}>🔥 Calories (kcal)</Text>
          <TextInput
            style={[styles.targetInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
            keyboardType="numeric"
            value={targetCalories}
            onChangeText={setTargetCalories}
          />
        </View>
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: textPrimary }]}>🥩 Protein (g)</Text>
          <TextInput
            style={[styles.targetInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
            keyboardType="numeric"
            value={targetProtein}
            onChangeText={setTargetProtein}
          />
        </View>
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: textPrimary }]}>🥑 Fat (g)</Text>
          <TextInput
            style={[styles.targetInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
            keyboardType="numeric"
            value={targetFat}
            onChangeText={setTargetFat}
          />
        </View>
        <View style={styles.targetRow}>
          <Text style={[styles.targetLabel, { color: textPrimary }]}>🍚 Carbs (g)</Text>
          <TextInput
            style={[styles.targetInput, { backgroundColor: inputBg, color: textPrimary, borderColor }]}
            keyboardType="numeric"
            value={targetCarbs}
            onChangeText={setTargetCarbs}
          />
        </View>
      </View>
      
      <View style={[styles.infoBox, { backgroundColor: buttonBg, borderColor }]}>
        <Ionicons name="information-circle-outline" size={20} color={textSecondary} />
        <Text style={[styles.infoText, { color: textSecondary }]}>
          These use a baseline "sedentary" activity multiplier. You can change these anytime in your profile!
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
          {step !== 'intro' && (
            <View style={styles.header}>
              <Pressable onPress={handleBack} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={24} color={textPrimary} />
              </Pressable>
              <Pressable onPress={onSkip} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: textSecondary }]}>Skip</Text>
              </Pressable>
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
    marginBottom: 16,
  },
  iconBtn: {
    padding: 4,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepContainer: {
    paddingTop: 8,
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
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  targetInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    width: 100,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
