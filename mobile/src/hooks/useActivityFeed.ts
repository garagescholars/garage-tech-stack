import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { GsActivityFeedItem } from "../types";

/**
 * Real-time listener for the gs_activityFeed collection.
 * Returns the latest items for use in the activity banner.
 */
export function useActivityFeed(maxItems = 10) {
  const [items, setItems] = useState<GsActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.ACTIVITY_FEED),
      orderBy("createdAt", "desc"),
      limit(maxItems)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const results = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as GsActivityFeedItem[];
        setItems(results);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [maxItems]);

  return { items, loading };
}
