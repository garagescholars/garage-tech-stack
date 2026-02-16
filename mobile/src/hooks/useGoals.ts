import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { ScholarGoal, ScholarAchievement } from "../types";

/**
 * Subscribe to a scholar's goals for the current month.
 */
export function useCurrentGoals(scholarId: string | undefined) {
  const [goals, setGoals] = useState<ScholarGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const q = query(
      collection(db, COLLECTIONS.SCHOLAR_GOALS),
      where("scholarId", "==", scholarId),
      where("month", "==", month),
      where("year", "==", year)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ScholarGoal[];
        setGoals(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [scholarId]);

  return { goals, loading };
}

/**
 * Subscribe to a scholar's achievements.
 */
export function useAchievements(scholarId: string | undefined) {
  const [achievements, setAchievements] = useState<ScholarAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.SCHOLAR_ACHIEVEMENTS),
      where("scholarId", "==", scholarId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ScholarAchievement[];
        setAchievements(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [scholarId]);

  return { achievements, loading };
}

/**
 * Set or update a monthly goal.
 */
export async function setMonthlyGoal(
  scholarId: string,
  goalType: "jobs" | "money",
  target: number
) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const docId = `${scholarId}_${year}_${month}_${goalType}`;

  await setDoc(
    doc(db, COLLECTIONS.SCHOLAR_GOALS, docId),
    {
      scholarId,
      month,
      year,
      goalType,
      goalTarget: target,
      currentProgress: 0,
      goalMet: false,
      notifiedAt90: false,
      notifiedAt100: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Subscribe to the leaderboard (top scholars by jobs completed).
 */
export function useLeaderboard() {
  const [scholars, setScholars] = useState<
    { uid: string; name: string; payScore: number; tier: string; totalJobsCompleted: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.SCHOLAR_PROFILES),
      where("showOnLeaderboard", "==", true),
      orderBy("totalJobsCompleted", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            name: (data.scholarName as string) || "Scholar",
            payScore: (data.payScore as number) || 0,
            tier: (data.tier as string) || "new",
            totalJobsCompleted: (data.totalJobsCompleted as number) || 0,
          };
        });
        setScholars(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { scholars, loading };
}
