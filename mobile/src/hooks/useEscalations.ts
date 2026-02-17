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
import type { GsEscalation } from "../types";

/**
 * Real-time listener for escalations on a specific job.
 */
export function useJobEscalations(jobId: string | undefined) {
  const [escalations, setEscalations] = useState<GsEscalation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setEscalations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.ESCALATIONS),
      where("jobId", "==", jobId),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as GsEscalation,
      );
      setEscalations(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [jobId]);

  const openCount = escalations.filter((e) => e.status === "open").length;

  return { escalations, loading, openCount };
}
