import { useState, useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  initialize,
  requestPermission,
  aggregateRecord,
  openHealthConnectSettings,
} from 'react-native-health-connect';

export function useHealthConnect(targetDateStr?: string) {
  const [steps, setSteps] = useState<number | null>(null);
  const [activeCalories, setActiveCalories] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const awaitingSettingsReturn = useRef(false);

  const fetchSteps = async (isManual = false, overrideDateStr?: string) => {
    if (Platform.OS !== 'android') {
      setIsSupported(false);
      return;
    }

    try {
      const isInitialized = await initialize();
      if (!isInitialized) {
        setIsSupported(false);
        return;
      }

      const granted = await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
      
      if (granted.length === 0 && isManual) {
        awaitingSettingsReturn.current = true;
        openHealthConnectSettings();
        return; // Don't try to fetch if permission not granted
      }
      
      const dateStr = overrideDateStr || targetDateStr || new Date().toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      
      const startTime = new Date(year, month - 1, day, 0, 0, 0);
      let endTime = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      const now = new Date();
      if (endTime > now) {
        endTime = now;
      }

      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });
      const totalSteps = result.COUNT_TOTAL || 0;
      setSteps(totalSteps);

      const caloriesResult = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });
      const totalKcal = caloriesResult.ACTIVE_CALORIES_TOTAL?.inKilocalories || 0;
      setActiveCalories(totalKcal > 0 ? totalKcal : null);
      setError(null);
    } catch (err: any) {
      console.warn('Health Connect Error:', err);
      if (isManual) {
        awaitingSettingsReturn.current = true;
        openHealthConnectSettings();
      }
      if (err.message?.includes('not supported') || err.message?.includes('SDK')) {
        setIsSupported(false);
      }
      setError(err.message || 'Failed to fetch steps from Health Connect');
    }
  };

  const fetchStepsRef = useRef(fetchSteps);
  fetchStepsRef.current = fetchSteps;

  useEffect(() => {
    fetchSteps();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && awaitingSettingsReturn.current) {
        awaitingSettingsReturn.current = false;
        fetchStepsRef.current(false); // Refetch automatically without triggering settings again
      }
    });

    return () => {
      subscription.remove();
    };
  }, [targetDateStr]);

  return { steps, activeCalories, error, isSupported, fetchSteps };
}
