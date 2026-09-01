import { useState, useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  aggregateRecord,
  openHealthConnectSettings,
} from 'react-native-health-connect';
import { getLocalDateString } from '@/lib/dateUtils';

export function useHealthConnect(targetDateStr?: string) {
  const [steps, setSteps] = useState<number | null>(null);
  const [activeCalories, setActiveCalories] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [syncedDate, setSyncedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const awaitingSettingsReturn = useRef(false);

  const fetchSteps = async (isManual = false, overrideDateStr?: string) => {
    if (Platform.OS !== 'android') {
      setIsSupported(false);
      setHasPermission(false);
      return;
    }

    const dateStr = overrideDateStr || targetDateStr || getLocalDateString();
    const todayStr = getLocalDateString();
    const isFuture = dateStr > todayStr;

    setIsLoading(true);
    try {
      const isInitialized = await initialize();
      if (!isInitialized) {
        setIsSupported(false);
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      // 1. Check permissions
      const granted = await getGrantedPermissions();
      let hasStepsPerm = granted.some(p => p.recordType === 'Steps');

      if (!hasStepsPerm) {
        // Attempt requesting permissions
        const reqResult = await requestPermission([
          { accessType: 'read', recordType: 'Steps' },
          { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        ]);
        hasStepsPerm = reqResult.some(p => p.recordType === 'Steps');
      }

      setHasPermission(hasStepsPerm);

      if (!hasStepsPerm) {
        if (isManual) {
          awaitingSettingsReturn.current = true;
          openHealthConnectSettings();
        }
        setSteps(null);
        setActiveCalories(null);
        setError('Health Connect permission not granted');
        setSyncedDate(dateStr);
        setIsLoading(false);
        return;
      }

      // 2. If future date, health metrics are not yet recorded
      if (isFuture) {
        setSteps(0);
        setActiveCalories(null);
        setError(null);
        setSyncedDate(dateStr);
        setIsLoading(false);
        return;
      }

      // 3. For today or past dates, query Health Connect
      const [year, month, day] = dateStr.split('-').map(Number);
      const startTime = new Date(year, month - 1, day, 0, 0, 0, 0);
      let endTime = new Date(year, month - 1, day, 23, 59, 59, 999);

      if (dateStr === todayStr) {
        const now = new Date();
        if (now > startTime) {
          endTime = now;
        }
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

      let totalKcal: number | null = null;
      try {
        const caloriesResult = await aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter: {
            operator: 'between',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
        });
        totalKcal = caloriesResult.ACTIVE_CALORIES_TOTAL?.inKilocalories || null;
      } catch (calErr) {
        console.warn('ActiveCaloriesBurned aggregate warning:', calErr);
      }

      setActiveCalories(totalKcal && totalKcal > 0 ? totalKcal : null);
      setError(null);
      setSyncedDate(dateStr);
    } catch (err: any) {
      console.warn('Health Connect Error:', err);
      const isPermError = err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('security');
      if (isManual && isPermError) {
        awaitingSettingsReturn.current = true;
        openHealthConnectSettings();
      }
      if (err.message?.includes('not supported') || err.message?.includes('SDK')) {
        setIsSupported(false);
      }
      setError(err.message || 'Failed to fetch steps from Health Connect');
      setSyncedDate(dateStr);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStepsRef = useRef(fetchSteps);
  fetchStepsRef.current = fetchSteps;

  useEffect(() => {
    const target = targetDateStr || getLocalDateString();
    const isFuture = target > getLocalDateString();
    if (isFuture) {
      setSteps(0);
      setActiveCalories(null);
      setError(null);
      setSyncedDate(target);
    } else {
      setSteps(null);
      setActiveCalories(null);
      setError(null);
      setSyncedDate(null);
    }

    fetchSteps(false, target);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && awaitingSettingsReturn.current) {
        awaitingSettingsReturn.current = false;
        fetchStepsRef.current(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [targetDateStr]);

  return { steps, activeCalories, error, isSupported, hasPermission, syncedDate, isLoading, fetchSteps };
}
