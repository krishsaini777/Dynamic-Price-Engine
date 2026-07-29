import { useState, useEffect, useCallback } from 'react';
import {
  getAllSettings,
  getSeasonalConfig,
  toggleSeasonal as apiToggleSeasonal,
  updateSeasonalCategories,
  updateSetting,
} from '../api/settingsApi';

export default function useSettings() {
  const [seasonalEnabled, setSeasonalEnabled] = useState(false);
  const [disabledCategories, setDisabledCategories] = useState([]);
  const [allSettings, setAllSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper: convert settings array to key-value map
  const settingsToMap = (arr) => {
    const map = {};
    if (Array.isArray(arr)) {
      arr.forEach((s) => { map[s.key] = s.value; });
    }
    return map;
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [seasonalRes, settingsRes] = await Promise.allSettled([
        getSeasonalConfig(),
        getAllSettings(),
      ]);
      if (seasonalRes.status === 'fulfilled') {
        const sc = seasonalRes.value.data;
        setSeasonalEnabled(sc.seasonalPricingEnabled ?? false);
        setDisabledCategories(sc.seasonalDisabledCategories || []);
      }
      if (settingsRes.status === 'fulfilled') {
        setAllSettings(settingsToMap(settingsRes.value.data));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleSeasonal = async (enabled) => {
    try {
      setError(null);
      await apiToggleSeasonal(enabled);
      setSeasonalEnabled(enabled);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateCategory = async (category, add) => {
    try {
      setError(null);
      let updated;
      if (add) {
        updated = [...disabledCategories, category];
      } else {
        updated = disabledCategories.filter((c) => c !== category);
      }
      await updateSeasonalCategories(updated);
      setDisabledCategories(updated);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateScheduler = async (key, value) => {
    try {
      setError(null);
      await updateSetting(key, value);
      setAllSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    seasonalEnabled,
    disabledCategories,
    schedulerEnabled: allSettings.schedulerEnabled ?? true,
    schedulerInterval: allSettings.schedulerIntervalMinutes ?? 30,
    autoApplyThreshold: allSettings.autoApplyThreshold ?? 0.8,
    eventsEnabled: allSettings.eventsEnabled ?? true,
    maxGlobalDiscount: allSettings.maxGlobalDiscountPercent ?? 0.3,
    loading,
    error,
    setError,
    toggleSeasonal,
    updateCategory,
    updateScheduler,
    refetch: fetchAll,
  };
}
