import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAchievements } from "./useGoals";
import type { ScholarAchievement } from "../types";

const STORAGE_KEY = "gs_lastSeenAchievementCount";

/**
 * Detects new (unseen) achievements by comparing current count
 * with the last-seen count stored in AsyncStorage.
 *
 * Returns the latest unread achievement for the overlay, or null.
 * Call `dismiss()` to mark it as seen.
 */
export function useAchievementUnlock(scholarId: string | undefined) {
  const { achievements, loading } = useAchievements(scholarId);
  const [newAchievement, setNewAchievement] = useState<ScholarAchievement | null>(null);

  useEffect(() => {
    if (loading || !scholarId || achievements.length === 0) return;

    const check = async () => {
      try {
        const key = `${STORAGE_KEY}_${scholarId}`;
        const stored = await AsyncStorage.getItem(key);
        const lastSeenCount = stored ? parseInt(stored, 10) : 0;

        if (achievements.length > lastSeenCount) {
          // achievements are ordered desc by createdAt, so [0] is the newest
          setNewAchievement(achievements[0]);
        }
      } catch {
        // Ignore AsyncStorage errors
      }
    };

    check();
  }, [achievements, loading, scholarId]);

  const dismiss = async () => {
    setNewAchievement(null);
    if (scholarId) {
      try {
        const key = `${STORAGE_KEY}_${scholarId}`;
        await AsyncStorage.setItem(key, String(achievements.length));
      } catch {
        // Ignore
      }
    }
  };

  return { newAchievement, dismiss };
}
