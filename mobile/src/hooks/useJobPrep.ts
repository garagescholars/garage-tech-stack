import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { GsJobPrep } from "../types";

/**
 * Real-time listener for a scholar's job prep document.
 * Document ID format: `${jobId}_${scholarId}`
 */
export function useJobPrep(
  jobId: string | undefined,
  scholarId: string | undefined,
) {
  const [prep, setPrep] = useState<GsJobPrep | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId || !scholarId) {
      setPrep(null);
      setLoading(false);
      return;
    }

    const docId = `${jobId}_${scholarId}`;
    const docRef = doc(db, COLLECTIONS.JOB_PREP, docId);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setPrep({ id: snapshot.id, ...snapshot.data() } as GsJobPrep);
      } else {
        setPrep(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [jobId, scholarId]);

  const allConfirmed = prep?.allConfirmed ?? true; // No prep doc = no equipment = allowed
  const confirmedCount =
    prep?.videoConfirmations.filter((v) => v.confirmedAt !== null).length ?? 0;
  const totalCount = prep?.videoConfirmations.length ?? 0;

  return { prep, loading, allConfirmed, confirmedCount, totalCount };
}
