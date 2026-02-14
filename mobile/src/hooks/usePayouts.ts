import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { GsPayout, GsStripeAccount } from "../types";

/**
 * Subscribe to a scholar's payout history.
 */
export function usePayouts(scholarId: string | undefined) {
  const [payouts, setPayouts] = useState<GsPayout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.PAYOUTS),
      where("scholarId", "==", scholarId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as GsPayout[];
      setPayouts(items);
      setLoading(false);
    });

    return () => unsub();
  }, [scholarId]);

  return { payouts, loading };
}

/**
 * Check Stripe onboarding status for a user.
 */
export function useStripeStatus(userId: string | undefined) {
  const [stripeAccount, setStripeAccount] = useState<GsStripeAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.STRIPE_ACCOUNTS),
      where("userId", "==", userId),
      where("accountType", "==", "scholar")
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setStripeAccount({
          id: snap.docs[0].id,
          ...snap.docs[0].data(),
        } as GsStripeAccount);
      } else {
        setStripeAccount(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return {
    stripeAccount,
    loading,
    isOnboarded: stripeAccount?.onboardingComplete ?? false,
    payoutsEnabled: stripeAccount?.payoutsEnabled ?? false,
    bankLast4: stripeAccount?.bankLast4 ?? null,
  };
}
