import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  aggregateRecord,
} from 'react-native-health-connect';

export function useHealthConnect() {
  const [steps, setSteps] = useState<number | null>(null);
  const [activeCalories, setActiveCalories] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const fetchSteps = async () => {
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

      await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      });
      const totalSteps = result.COUNT_TOTAL || 0;
      setSteps(totalSteps);

      const caloriesResult = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      });
      const totalKcal = caloriesResult.ACTIVE_CALORIES_TOTAL?.inKilocalories || 0;
      setActiveCalories(totalKcal > 0 ? totalKcal : null);
    } catch (err: any) {
      console.warn('Health Connect Error:', err);
      if (err.message?.includes('not supported') || err.message?.includes('SDK')) {
        setIsSupported(false);
      }
      setError(err.message || 'Failed to fetch steps from Health Connect');
    }
  };

  useEffect(() => {
    fetchSteps();
  }, []);

  return { steps, activeCalories, error, isSupported, fetchSteps };
}
