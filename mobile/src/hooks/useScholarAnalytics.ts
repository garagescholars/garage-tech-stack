import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { GsScholarAnalytics } from "../types";

export function useScholarAnalytics(scholarId: string | undefined) {
  const [analytics, setAnalytics] = useState<GsScholarAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, COLLECTIONS.SCHOLAR_ANALYTICS, scholarId),
      (snap) => {
        if (snap.exists()) {
          setAnalytics({ scholarId: snap.id, ...snap.data() } as GsScholarAnalytics);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [scholarId]);

  return { analytics, loading };
}
