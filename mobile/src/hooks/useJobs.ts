import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { ServiceJob, GsRecentClaim } from "../types";

/**
 * Subscribe to open jobs (APPROVED_FOR_POSTING, UPCOMING, or REOPENED) for the job feed.
 */
export function useOpenJobs() {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.JOBS),
      where("status", "in", ["APPROVED_FOR_POSTING", "UPCOMING", "REOPENED"]),
      orderBy("scheduledDate", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ServiceJob[];

        // Sort: same_day first, then rush, then standard, then by date
        items.sort((a, b) => {
          const urgencyOrder: Record<string, number> = { same_day: 0, rush: 1, standard: 2 };
          const aUrg = urgencyOrder[a.urgencyLevel || "standard"] ?? 2;
          const bUrg = urgencyOrder[b.urgencyLevel || "standard"] ?? 2;
          if (aUrg !== bUrg) return aUrg - bUrg;
          return (a.scheduledDate || "").localeCompare(b.scheduledDate || "");
        });

        setJobs(items);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn("[useOpenJobs] Listener error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { jobs, loading, error };
}

/**
 * Subscribe to a scholar's claimed/active jobs.
 */
export function useMyJobs(scholarId: string | undefined) {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.JOBS),
      where("claimedBy", "==", scholarId),
      orderBy("scheduledDate", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ServiceJob[];
        setJobs(items);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn("[useMyJobs] Listener error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [scholarId]);

  return { jobs, loading, error };
}

/**
 * Claim a job for a scholar using a Firestore transaction for safety.
 */
export async function claimJob(jobId: string, scholarId: string, scholarName: string) {
  const jobRef = doc(db, COLLECTIONS.JOBS, jobId);
  await runTransaction(db, async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    if (!jobDoc.exists()) throw new Error("Job not found");
    const data = jobDoc.data();
    if (data.status !== "APPROVED_FOR_POSTING" && data.status !== "REOPENED") {
      throw new Error("Job was just taken!");
    }
    if (data.claimedBy) throw new Error("Job was just taken!");
    transaction.update(jobRef, {
      status: "UPCOMING",
      claimedBy: scholarId,
      claimedByName: scholarName,
      claimedAt: serverTimestamp(),
      currentViewers: 0,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Update job status.
 */
export async function updateJobStatus(jobId: string, status: string, extra?: Record<string, unknown>) {
  const jobRef = doc(db, COLLECTIONS.JOBS, jobId);
  await updateDoc(jobRef, {
    status,
    updatedAt: serverTimestamp(),
    ...extra,
  });
}

/**
 * Subscribe to recent claims feed.
 */
export function useRecentClaims() {
  const [claims, setClaims] = useState<GsRecentClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.RECENT_CLAIMS),
      orderBy("claimedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as GsRecentClaim[];
        setClaims(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { claims, loading };
}
