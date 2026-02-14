/**
 * Garage Scholars Mobile App — Cloud Functions
 *
 * Firestore triggers, scheduled tasks, and callable functions
 * for the scholar job management mobile app.
 */

import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  GS_COLLECTIONS,
  SCORING_WEIGHTS,
  SCORE_LOCK_HOURS,
  TRANSFER_EXPIRY_MINUTES,
  TIER_THRESHOLDS,
  MAX_RECENT_CLAIMS,
} from "./gs-constants";

const db = getFirestore();

// ─── Helper: send Expo push notification ───
async function sendExpoPush(pushTokens: string[], title: string, body: string, data?: Record<string, string>) {
  const messages = pushTokens
    .filter((t) => t && t.startsWith("ExponentPushToken"))
    .map((to) => ({ to, title, body, sound: "default" as const, data }));

  if (messages.length === 0) return;

  try {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await resp.json();
    console.log(`Push sent to ${messages.length} tokens`, result);
  } catch (err) {
    console.error("Expo push failed:", err);
  }
}

// Helper: get push token for a user
async function getPushToken(uid: string): Promise<string | null> {
  const snap = await db.collection(GS_COLLECTIONS.PROFILES).doc(uid).get();
  return snap.exists ? (snap.data()?.pushToken as string) || null : null;
}

// Helper: get all admin push tokens
async function getAdminTokens(): Promise<string[]> {
  const snap = await db.collection(GS_COLLECTIONS.PROFILES).where("role", "==", "admin").get();
  return snap.docs.map((d) => d.data().pushToken as string).filter(Boolean);
}

// Helper: determine tier from payScore
function getTierFromScore(score: number): string {
  if (score >= TIER_THRESHOLDS.top_hustler) return "top_hustler";
  if (score >= TIER_THRESHOLDS.elite) return "elite";
  if (score >= TIER_THRESHOLDS.standard) return "standard";
  return "new";
}

// ═══════════════════════════════════════════════════════════════
// 1. FIRESTORE TRIGGER: gs_jobs status changes
// ═══════════════════════════════════════════════════════════════
export const gsOnJobUpdated = onDocumentWritten(
  `${GS_COLLECTIONS.JOBS}/{jobId}`,
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return; // deleted

    const jobId = event.params.jobId;
    const oldStatus = before?.status;
    const newStatus = after.status;

    if (oldStatus === newStatus) return;

    console.log(`gs_jobs/${jobId}: ${oldStatus} → ${newStatus}`);

    // ── APPROVED_FOR_POSTING/REOPENED → UPCOMING (claimed) ──
    if (
      ["APPROVED_FOR_POSTING", "REOPENED"].includes(oldStatus) &&
      newStatus === "UPCOMING" &&
      after.claimedBy
    ) {
      // Write recent claim for FOMO banner
      const claimRef = db.collection(GS_COLLECTIONS.RECENT_CLAIMS).doc();
      await claimRef.set({
        jobId,
        jobTitle: after.title || "",
        scholarId: after.claimedBy,
        scholarFirstName: (after.claimedByName || "Scholar").split(" ")[0],
        payout: (after.payout || 0) + (after.rushBonus || 0),
        claimedAt: FieldValue.serverTimestamp(),
      });

      // Trim old recent claims
      const oldClaims = await db
        .collection(GS_COLLECTIONS.RECENT_CLAIMS)
        .orderBy("claimedAt", "desc")
        .offset(MAX_RECENT_CLAIMS)
        .get();
      const batch = db.batch();
      oldClaims.docs.forEach((d) => batch.delete(d.ref));
      if (!oldClaims.empty) await batch.commit();

      // Notify the scholar
      const token = await getPushToken(after.claimedBy);
      if (token) {
        await sendExpoPush(
          [token],
          "Job Claimed!",
          `You claimed "${after.title}" — $${(after.payout || 0) + (after.rushBonus || 0)}`,
          { screen: "my-jobs", jobId }
        );
      }
    }

    // ── UPCOMING → IN_PROGRESS (checked in) ──
    if (oldStatus === "UPCOMING" && newStatus === "IN_PROGRESS") {
      const adminTokens = await getAdminTokens();
      if (adminTokens.length > 0) {
        await sendExpoPush(
          adminTokens,
          "Scholar Checked In",
          `${after.claimedByName || "A scholar"} checked in for "${after.title}"`,
          { screen: "admin-jobs", jobId }
        );
      }
    }

    // ── IN_PROGRESS → REVIEW_PENDING (checked out) ──
    if (oldStatus === "IN_PROGRESS" && newStatus === "REVIEW_PENDING") {
      // Create initial quality score doc
      await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).set(
        {
          jobId,
          scholarId: after.claimedBy || "",
          photoQuality: 0,
          completion: 0,
          timeliness: 0,
          finalScore: 0,
          locked: false,
          createdAt: FieldValue.serverTimestamp(),
          lockedAt: null,
          complaintDeadline: Timestamp.fromDate(
            new Date(Date.now() + SCORE_LOCK_HOURS * 60 * 60 * 1000)
          ),
        },
        { merge: true }
      );

      const adminTokens = await getAdminTokens();
      if (adminTokens.length > 0) {
        await sendExpoPush(
          adminTokens,
          "Job Ready for Review",
          `${after.claimedByName || "A scholar"} completed "${after.title}" — review needed`,
          { screen: "admin-jobs", jobId }
        );
      }
    }

    // ── REVIEW_PENDING → COMPLETED ──
    if (oldStatus === "REVIEW_PENDING" && newStatus === "COMPLETED") {
      const scholarId = after.claimedBy;
      if (!scholarId) return;

      // Update scholar stats
      const profileRef = db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId);
      await profileRef.set(
        {
          totalJobsCompleted: FieldValue.increment(1),
          totalEarnings: FieldValue.increment(
            (after.payout || 0) + (after.rushBonus || 0)
          ),
        },
        { merge: true }
      );

      // Update current month goal progress
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const goalsSnap = await db
        .collection(GS_COLLECTIONS.SCHOLAR_GOALS)
        .where("scholarId", "==", scholarId)
        .where("monthKey", "==", monthKey)
        .get();

      const batch = db.batch();
      goalsSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.goalType === "jobs") {
          batch.update(doc.ref, { currentProgress: FieldValue.increment(1) });
        } else if (data.goalType === "earnings") {
          batch.update(doc.ref, {
            currentProgress: FieldValue.increment(
              (after.payout || 0) + (after.rushBonus || 0)
            ),
          });
        }
      });
      if (!goalsSnap.empty) await batch.commit();

      // Notify scholar
      const token = await getPushToken(scholarId);
      if (token) {
        await sendExpoPush(
          [token],
          "Job Approved!",
          `"${after.title}" is complete. Payment is being processed.`,
          { screen: "my-jobs", jobId }
        );
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 2. FIRESTORE TRIGGER: Transfer created
// ═══════════════════════════════════════════════════════════════
export const gsOnTransferCreated = onDocumentCreated(
  `${GS_COLLECTIONS.JOB_TRANSFERS}/{transferId}`,
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const transferId = event.params.transferId;
    console.log(`Transfer created: ${transferId}, type: ${data.transferType}`);

    if (data.transferType === "direct" && data.toScholarId) {
      // Notify target scholar
      const token = await getPushToken(data.toScholarId);
      if (token) {
        await sendExpoPush(
          [token],
          "Job Transfer Offer",
          `${data.fromScholarName || "A scholar"} wants to transfer "${data.jobTitle}" to you. Tap to respond.`,
          { screen: "transfers", transferId }
        );
      }
    } else if (data.transferType === "requeue") {
      // Notify all scholars about requeued job
      const scholarsSnap = await db
        .collection(GS_COLLECTIONS.SCHOLAR_PROFILES)
        .where("isActive", "!=", false)
        .get();

      const tokens: string[] = [];
      for (const doc of scholarsSnap.docs) {
        if (doc.id === data.fromScholarId) continue; // skip the transferring scholar
        const t = await getPushToken(doc.id);
        if (t) tokens.push(t);
      }

      if (tokens.length > 0) {
        await sendExpoPush(
          tokens,
          "Job Available!",
          `"${data.jobTitle}" is back on the feed — $${data.payout || 0}`,
          { screen: "jobs" }
        );
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 3. FIRESTORE TRIGGER: Reschedule approved/declined
// ═══════════════════════════════════════════════════════════════
export const gsOnRescheduleUpdated = onDocumentWritten(
  `${GS_COLLECTIONS.JOB_RESCHEDULES}/{rescheduleId}`,
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after || before?.status === after.status) return;

    if (after.status === "approved") {
      // Update job with new date/time
      const jobRef = db.collection(GS_COLLECTIONS.JOBS).doc(after.jobId);
      await jobRef.update({
        scheduledDate: after.newDate,
        scheduledTimeStart: after.newTimeStart || null,
        scheduledTimeEnd: after.newTimeEnd || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const token = await getPushToken(after.scholarId);
      if (token) {
        await sendExpoPush(
          [token],
          "Reschedule Approved",
          `Your reschedule for "${after.jobTitle}" was approved. New date: ${after.newDate}`,
          { screen: "my-jobs", jobId: after.jobId }
        );
      }
    } else if (after.status === "declined") {
      const token = await getPushToken(after.scholarId);
      if (token) {
        await sendExpoPush(
          [token],
          "Reschedule Declined",
          `Your reschedule request for "${after.jobTitle}" was declined. Please keep the original schedule.`,
          { screen: "my-jobs", jobId: after.jobId }
        );
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 4. SCHEDULED: Lock quality scores past 48hr window
// ═══════════════════════════════════════════════════════════════
export const gsLockScores = onSchedule("every 1 hours", async () => {
  console.log("gsLockScores: checking for scores to lock...");

  const now = Timestamp.now();
  const unlocked = await db
    .collection(GS_COLLECTIONS.JOB_QUALITY_SCORES)
    .where("locked", "==", false)
    .where("complaintDeadline", "<=", now)
    .get();

  if (unlocked.empty) {
    console.log("No scores to lock.");
    return;
  }

  console.log(`Locking ${unlocked.size} scores...`);
  const scholarScores: Record<string, number[]> = {};

  const batch = db.batch();
  for (const doc of unlocked.docs) {
    const data = doc.data();
    const finalScore =
      (data.photoQuality || 0) * SCORING_WEIGHTS.PHOTO_QUALITY +
      (data.completion || 0) * SCORING_WEIGHTS.COMPLETION +
      (data.timeliness || 0) * SCORING_WEIGHTS.TIMELINESS;

    batch.update(doc.ref, {
      finalScore,
      locked: true,
      lockedAt: FieldValue.serverTimestamp(),
    });

    if (data.scholarId) {
      if (!scholarScores[data.scholarId]) scholarScores[data.scholarId] = [];
      scholarScores[data.scholarId].push(finalScore);
    }
  }
  await batch.commit();

  // Update scholar payScores and tiers
  for (const [scholarId, newScores] of Object.entries(scholarScores)) {
    // Get all locked scores for this scholar
    const allScores = await db
      .collection(GS_COLLECTIONS.JOB_QUALITY_SCORES)
      .where("scholarId", "==", scholarId)
      .where("locked", "==", true)
      .get();

    const scores = allScores.docs.map((d) => d.data().finalScore as number);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const tier = getTierFromScore(avg);

    await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).update({
      payScore: Math.round(avg * 100) / 100,
      tier,
    });

    console.log(`Scholar ${scholarId}: payScore=${avg.toFixed(2)}, tier=${tier}`);
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. SCHEDULED: Expire pending direct transfers past 15min
// ═══════════════════════════════════════════════════════════════
export const gsExpireTransfers = onSchedule("every 5 minutes", async () => {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - TRANSFER_EXPIRY_MINUTES * 60 * 1000)
  );

  const expired = await db
    .collection(GS_COLLECTIONS.JOB_TRANSFERS)
    .where("transferType", "==", "direct")
    .where("status", "==", "pending")
    .where("createdAt", "<=", cutoff)
    .get();

  if (expired.empty) return;

  console.log(`Expiring ${expired.size} transfers...`);

  for (const doc of expired.docs) {
    const data = doc.data();

    // Mark transfer as expired
    await doc.ref.update({
      status: "expired",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Requeue the job
    if (data.jobId) {
      await db.collection(GS_COLLECTIONS.JOBS).doc(data.jobId).update({
        status: "REOPENED",
        claimedBy: null,
        claimedByName: null,
        reopenedAt: FieldValue.serverTimestamp(),
        reopenCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Notify the original scholar
    const token = await getPushToken(data.fromScholarId);
    if (token) {
      await sendExpoPush(
        [token],
        "Transfer Expired",
        `Your transfer for "${data.jobTitle}" expired. The job has been requeued.`,
        { screen: "my-jobs" }
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. SCHEDULED: Reset viewer counts daily at 3am
// ═══════════════════════════════════════════════════════════════
export const gsResetViewerCounts = onSchedule("every day 03:00", async () => {
  console.log("Resetting viewer counts on all gs_jobs...");

  const jobs = await db
    .collection(GS_COLLECTIONS.JOBS)
    .where("currentViewers", ">", 0)
    .get();

  if (jobs.empty) {
    console.log("No jobs with active viewers.");
    return;
  }

  const batch = db.batch();
  jobs.docs.forEach((doc) => {
    batch.update(doc.ref, { currentViewers: 0 });
  });
  await batch.commit();

  console.log(`Reset viewer counts on ${jobs.size} jobs.`);
});

// ═══════════════════════════════════════════════════════════════
// 7. SCHEDULED: Monthly goal reset (1st of each month)
// ═══════════════════════════════════════════════════════════════
export const gsMonthlyGoalReset = onSchedule("0 0 1 * *", async () => {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  console.log(`Creating monthly goals for ${monthKey}...`);

  const scholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
  const batch = db.batch();

  for (const doc of scholars.docs) {
    const data = doc.data();
    const scholarId = doc.id;

    // Create jobs goal
    if (data.monthlyJobGoal && data.monthlyJobGoal > 0) {
      const jobGoalRef = db.collection(GS_COLLECTIONS.SCHOLAR_GOALS).doc(`${scholarId}_${monthKey}_jobs`);
      batch.set(jobGoalRef, {
        scholarId,
        monthKey,
        goalType: "jobs",
        goalTarget: data.monthlyJobGoal,
        currentProgress: 0,
        goalMet: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Create earnings goal
    if (data.monthlyMoneyGoal && data.monthlyMoneyGoal > 0) {
      const earningsGoalRef = db.collection(GS_COLLECTIONS.SCHOLAR_GOALS).doc(`${scholarId}_${monthKey}_earnings`);
      batch.set(earningsGoalRef, {
        scholarId,
        monthKey,
        goalType: "earnings",
        goalTarget: data.monthlyMoneyGoal,
        currentProgress: 0,
        goalMet: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
  console.log(`Created goals for ${scholars.size} scholars.`);
});

// ═══════════════════════════════════════════════════════════════
// 8. SCHEDULED: Compute analytics daily at 4am
// ═══════════════════════════════════════════════════════════════
export const gsComputeAnalytics = onSchedule("every day 04:00", async () => {
  console.log("Computing scholar analytics...");

  const scholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();

  for (const doc of scholars.docs) {
    const scholarId = doc.id;
    const profileData = doc.data();

    // Get completed jobs
    const completedJobs = await db
      .collection(GS_COLLECTIONS.JOBS)
      .where("claimedBy", "==", scholarId)
      .where("status", "==", "COMPLETED")
      .get();

    // Get all assigned jobs (for acceptance rate)
    const allJobs = await db
      .collection(GS_COLLECTIONS.JOBS)
      .where("claimedBy", "==", scholarId)
      .get();

    // Get quality scores
    const scores = await db
      .collection(GS_COLLECTIONS.JOB_QUALITY_SCORES)
      .where("scholarId", "==", scholarId)
      .where("locked", "==", true)
      .get();

    const scoreValues = scores.docs.map((d) => d.data().finalScore as number);
    const avgScore = scoreValues.length > 0
      ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
      : 0;

    // Count cancellations
    const cancelledJobs = allJobs.docs.filter(
      (d) => d.data().status === "CANCELLED"
    ).length;

    const totalJobs = allJobs.size;
    const cancellationRate = totalJobs > 0 ? (cancelledJobs / totalJobs) * 100 : 0;

    // Compute total earnings
    const totalEarnings = completedJobs.docs.reduce((sum, d) => {
      const data = d.data();
      return sum + (data.payout || 0) + (data.rushBonus || 0);
    }, 0);

    // Get transfers/reschedules
    const transfers = await db
      .collection(GS_COLLECTIONS.JOB_TRANSFERS)
      .where("fromScholarId", "==", scholarId)
      .get();

    const reschedules = await db
      .collection(GS_COLLECTIONS.JOB_RESCHEDULES)
      .where("scholarId", "==", scholarId)
      .get();

    // Compute current month stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthJobs = completedJobs.docs.filter((d) => {
      const ts = d.data().updatedAt;
      if (!ts) return false;
      return ts.toDate() >= monthStart;
    }).length;

    const monthEarnings = completedJobs.docs
      .filter((d) => {
        const ts = d.data().updatedAt;
        if (!ts) return false;
        return ts.toDate() >= monthStart;
      })
      .reduce((sum, d) => {
        const data = d.data();
        return sum + (data.payout || 0) + (data.rushBonus || 0);
      }, 0);

    // Write analytics doc
    await db.collection(GS_COLLECTIONS.SCHOLAR_ANALYTICS).doc(scholarId).set({
      scholarId,
      totalJobsCompleted: completedJobs.size,
      totalEarnings,
      avgScore: Math.round(avgScore * 100) / 100,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      totalTransfers: transfers.size,
      totalReschedules: reschedules.size,
      monthJobsCompleted: monthJobs,
      monthEarnings,
      tier: profileData.tier || "new",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Also sync key stats back to scholar profile
    await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).update({
      totalJobsCompleted: completedJobs.size,
      totalEarnings,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
    });
  }

  console.log(`Analytics computed for ${scholars.size} scholars.`);
});

// ═══════════════════════════════════════════════════════════════
// 9. CALLABLE: Submit customer complaint
// ═══════════════════════════════════════════════════════════════
export const gsSubmitComplaint = onCall(
  { cors: true, timeoutSeconds: 60 },
  async (request) => {
    const { jobId, description, photoUrls } = request.data as {
      jobId?: string;
      description?: string;
      photoUrls?: string[];
    };

    if (!jobId || !description) {
      throw new HttpsError("invalid-argument", "jobId and description are required.");
    }

    // Check the job exists
    const jobRef = db.collection(GS_COLLECTIONS.JOBS).doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }

    const jobData = jobSnap.data()!;

    // Check quality score is within complaint window
    const scoreRef = db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId);
    const scoreSnap = await scoreRef.get();

    if (scoreSnap.exists) {
      const scoreData = scoreSnap.data()!;
      if (scoreData.locked) {
        throw new HttpsError(
          "failed-precondition",
          "The complaint window for this job has closed."
        );
      }

      // Deduct points from quality score
      await scoreRef.update({
        customerComplaint: true,
        complaintDescription: description,
        complaintPhotoUrls: photoUrls || [],
        complaintAt: FieldValue.serverTimestamp(),
        // Reduce completion score by 50% on complaint
        completion: Math.max(0, (scoreData.completion || 0) * 0.5),
      });
    }

    // Update job with dispute flag
    await jobRef.update({
      status: "DISPUTED",
      disputeDescription: description,
      disputeAt: FieldValue.serverTimestamp(),
    });

    // Notify admins
    const adminTokens = await getAdminTokens();
    if (adminTokens.length > 0) {
      await sendExpoPush(
        adminTokens,
        "Customer Complaint",
        `Complaint filed for "${jobData.title}" — review needed`,
        { screen: "admin-jobs", jobId }
      );
    }

    console.log(`Complaint submitted for job ${jobId}`);
    return { ok: true };
  }
);

// ═══════════════════════════════════════════════════════════════
// 10. CALLABLE: Send push notification (admin utility)
// ═══════════════════════════════════════════════════════════════
export const gsSendPush = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // Check admin
  const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }

  const { targetUids, title, body, data } = request.data as {
    targetUids?: string[];
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };

  if (!title || !body || !targetUids || targetUids.length === 0) {
    throw new HttpsError("invalid-argument", "targetUids, title, and body are required.");
  }

  const tokens: string[] = [];
  for (const uid of targetUids) {
    const t = await getPushToken(uid);
    if (t) tokens.push(t);
  }

  await sendExpoPush(tokens, title, body, data);
  return { ok: true, sent: tokens.length };
});
