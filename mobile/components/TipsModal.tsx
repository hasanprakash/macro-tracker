import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface TipsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TipsModal({ visible, onClose }: TipsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const accentColor = '#3B82F6'; // Blue
  const surfaceBg = isDark ? '#0F172A' : '#F1F5F9';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: cardBg }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="bulb" size={26} color="#EAB308" style={{ marginRight: 8 }} />
                <Text style={[styles.title, { color: textPrimary }]}>Health Tips</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={textSecondary} />
              </Pressable>
            </View>

            {/* TIP 1 */}
            <View style={[styles.tipCard, { backgroundColor: surfaceBg }]}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="water-outline" size={22} color="#EF4444" />
              </View>
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle, { color: textPrimary }]}>Watch Your Salt Intake</Text>
                <Text style={[styles.tipDescription, { color: textSecondary }]}>
                  Avoid consuming salty foods 2 hours before bed. Excess sodium causes water retention and bloating, which can negatively affect your morning weight on the scale.
                </Text>
              </View>
            </View>

            {/* TIP 2 */}
            <View style={[styles.tipCard, { backgroundColor: surfaceBg }]}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="restaurant-outline" size={22} color="#10B981" />
              </View>
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle, { color: textPrimary }]}>Optimal Eating Order</Text>
                <Text style={[styles.tipDescription, { color: textSecondary }]}>
                  Ideally, try to eat your food in this order: <Text style={{ fontWeight: '600' }}>Protein → Fiber → Carbs/Fats</Text>. Protein and fiber digest slowly, keeping you full longer and preventing large blood sugar spikes. 
                </Text>
                <Text style={[styles.tipDescription, { color: textSecondary, marginTop: 8 }]}>
                  Since mixed meals (like rice and curry) make this tricky, aim to at least eat your <Text style={{ fontWeight: '600' }}>Fiber (veggies) first</Text> before the rest of your meal to help prevent an insulin spike.
                </Text>
              </View>
            </View>

            {/* TIP 3 */}
            <View style={[styles.tipCard, { backgroundColor: surfaceBg }]}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="fitness-outline" size={22} color="#3B82F6" />
              </View>
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle, { color: textPrimary }]}>Log Your Activities</Text>
                <Text style={[styles.tipDescription, { color: textSecondary }]}>
                  Logging your exercises and steps is important! The extra calories you burn are directly contributed to your daily target allowances, meaning you get to eat more while still hitting your goals!
                </Text>
              </View>
            </View>

            <Pressable 
              style={[styles.saveButton, { backgroundColor: accentColor }]} 
              onPress={onClose}
            >
              <Text style={styles.saveButtonText}>Got it!</Text>
            </Pressable>

          </ScrollView>
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
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '50%',
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  tipCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  tipDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
