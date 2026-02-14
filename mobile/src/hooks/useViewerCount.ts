import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";

/**
 * Increments currentViewers + totalViews on mount,
 * decrements currentViewers on unmount or app background.
 */
export function useViewerCount(jobId: string | undefined) {
  const decremented = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    decremented.current = false;

    const jobRef = doc(db, COLLECTIONS.JOBS, jobId);

    // Increment on mount
    updateDoc(jobRef, {
      currentViewers: increment(1),
      totalViews: increment(1),
    }).catch(() => {});

    const decrement = () => {
      if (decremented.current) return;
      decremented.current = true;
      updateDoc(jobRef, {
        currentViewers: increment(-1),
      }).catch(() => {});
    };

    // Decrement when app goes to background
    const handleAppState = (state: AppStateStatus) => {
      if (state !== "active") {
        decrement();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);

    return () => {
      sub.remove();
      decrement();
    };
  }, [jobId]);
}
