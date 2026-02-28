import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { JobTransfer, JobReschedule } from "../types";

/**
 * Create a job transfer (direct or requeue).
 */
export async function createTransfer(
  jobId: string,
  fromScholarId: string,
  type: "direct" | "requeue",
  reason?: string,
  toScholarId?: string
) {
  const expiresAt = Timestamp.fromMillis(Date.now() + 15 * 60 * 1000); // 15 min

  await addDoc(collection(db, COLLECTIONS.JOB_TRANSFERS), {
    jobId,
    fromScholarId,
    toScholarId: toScholarId || null,
    reason: reason || "",
    transferType: type,
    status: "pending",
    expiresAt,
    createdAt: serverTimestamp(),
  });

  if (type === "requeue") {
    // Release job back to the open feed
    await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
      status: "REOPENED",
      claimedBy: null,
      claimedByName: null,
      reopenedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Create a reschedule request.
 */
export async function requestReschedule(
  jobId: string,
  requestedBy: string,
  role: "scholar" | "customer" | "admin",
  originalDate: string,
  originalTimeStart: string,
  newDate: string,
  newTimeStart: string,
  newTimeEnd?: string
) {
  await addDoc(collection(db, COLLECTIONS.JOB_RESCHEDULES), {
    jobId,
    requestedBy,
    requesterRole: role,
    originalDate,
    originalTimeStart,
    newDate,
    newTimeStart,
    newTimeEnd: newTimeEnd || null,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Subscribe to incoming transfer offers for a scholar.
 */
export function useIncomingTransfers(scholarId: string | undefined) {
  const [transfers, setTransfers] = useState<JobTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.JOB_TRANSFERS),
      where("toScholarId", "==", scholarId),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransfers(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as JobTransfer[]
      );
      setLoading(false);
    });

    return () => unsub();
  }, [scholarId]);

  return { transfers, loading };
}

/**
 * Accept or decline a transfer offer.
 */
export async function respondToTransfer(
  transferId: string,
  jobId: string,
  response: "accepted" | "declined",
  scholarId?: string,
  scholarName?: string
) {
  await updateDoc(doc(db, COLLECTIONS.JOB_TRANSFERS, transferId), {
    status: response,
  });

  if (response === "accepted" && scholarId && scholarName) {
    await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
      claimedBy: scholarId,
      claimedByName: scholarName,
      status: "UPCOMING",
      updatedAt: serverTimestamp(),
    });
  }
}
