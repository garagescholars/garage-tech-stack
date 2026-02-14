import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { JobQualityScore } from "../types";

/**
 * Subscribe to a scholar's quality scores.
 */
export function useScoreHistory(scholarId: string | undefined) {
  const [scores, setScores] = useState<JobQualityScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.JOB_QUALITY_SCORES),
      where("scholarId", "==", scholarId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as JobQualityScore[];
      setScores(items);
      setLoading(false);
    });

    return () => unsub();
  }, [scholarId]);

  return { scores, loading };
}
