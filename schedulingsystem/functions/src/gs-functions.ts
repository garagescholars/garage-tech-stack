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
import { createCheckinPayout, holdCompletionPayout } from "./gs-payments";

const db = getFirestore();

// Max Firestore batch size
const BATCH_LIMIT = 500;

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

// Helper: commit writes in chunks of BATCH_LIMIT
async function commitInChunks(
  ops: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; type: "set" | "update" }>
) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.type === "set") {
        batch.set(op.ref, op.data);
      } else {
        batch.update(op.ref, op.data);
      }
    }
    await batch.commit();
  }
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
        scholarName: (after.claimedByName || "Scholar").split(" ")[0],
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
      // Trigger first 50% payout
      await createCheckinPayout(jobId, after);

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
          photoQualityScore: 0,
          completionScore: 0,
          timelinessScore: 0,
          finalScore: 0,
          customerComplaint: false,
          scoreLocked: false,
          scoreLockedAt: null,
          complaintWindowEnd: Timestamp.fromDate(
            new Date(Date.now() + SCORE_LOCK_HOURS * 60 * 60 * 1000)
          ),
          createdAt: FieldValue.serverTimestamp(),
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
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const goalsSnap = await db
        .collection(GS_COLLECTIONS.SCHOLAR_GOALS)
        .where("scholarId", "==", scholarId)
        .where("month", "==", month)
        .where("year", "==", year)
        .get();

      const goalBatch = db.batch();
      goalsSnap.docs.forEach((goalDoc) => {
        const data = goalDoc.data();
        if (data.goalType === "jobs") {
          goalBatch.update(goalDoc.ref, { currentProgress: FieldValue.increment(1) });
        } else if (data.goalType === "money") {
          goalBatch.update(goalDoc.ref, {
            currentProgress: FieldValue.increment(
              (after.payout || 0) + (after.rushBonus || 0)
            ),
          });
        }
      });
      if (!goalsSnap.empty) await goalBatch.commit();

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
        .get();

      const tokens: string[] = [];
      for (const scholarDoc of scholarsSnap.docs) {
        if (scholarDoc.id === data.fromScholarId) continue;
        const t = await getPushToken(scholarDoc.id);
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

      const token = await getPushToken(after.requestedBy);
      if (token) {
        await sendExpoPush(
          [token],
          "Reschedule Approved",
          `Your reschedule for "${after.jobTitle}" was approved. New date: ${after.newDate}`,
          { screen: "my-jobs", jobId: after.jobId }
        );
      }
    } else if (after.status === "declined") {
      const token = await getPushToken(after.requestedBy);
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
    .where("scoreLocked", "==", false)
    .where("complaintWindowEnd", "<=", now)
    .get();

  if (unlocked.empty) {
    console.log("No scores to lock.");
    return;
  }

  console.log(`Locking ${unlocked.size} scores...`);
  const scholarScores: Record<string, number[]> = {};

  const lockOps: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; type: "set" | "update" }> = [];
  for (const scoreDoc of unlocked.docs) {
    try {
      const data = scoreDoc.data();
      const finalScore =
        (data.photoQualityScore || 0) * SCORING_WEIGHTS.PHOTO_QUALITY +
        (data.completionScore || 0) * SCORING_WEIGHTS.COMPLETION +
        (data.timelinessScore || 0) * SCORING_WEIGHTS.TIMELINESS;

      lockOps.push({
        ref: scoreDoc.ref,
        data: {
          finalScore,
          scoreLocked: true,
          scoreLockedAt: FieldValue.serverTimestamp(),
        },
        type: "update",
      });

      if (data.scholarId) {
        if (!scholarScores[data.scholarId]) scholarScores[data.scholarId] = [];
        scholarScores[data.scholarId].push(finalScore);
      }
    } catch (err) {
      console.error(`Error processing score ${scoreDoc.id}:`, err);
    }
  }
  await commitInChunks(lockOps);

  // Update scholar payScores and tiers
  for (const [scholarId, newScores] of Object.entries(scholarScores)) {
    try {
      const allScores = await db
        .collection(GS_COLLECTIONS.JOB_QUALITY_SCORES)
        .where("scholarId", "==", scholarId)
        .where("scoreLocked", "==", true)
        .get();

      const scores = allScores.docs.map((d) => d.data().finalScore as number);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const tier = getTierFromScore(avg);

      await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).update({
        payScore: Math.round(avg * 100) / 100,
        tier,
      });

      console.log(`Scholar ${scholarId}: payScore=${avg.toFixed(2)}, tier=${tier}`);
    } catch (err) {
      console.error(`Error updating scholar ${scholarId} tier:`, err);
    }
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

  for (const transferDoc of expired.docs) {
    try {
      const data = transferDoc.data();

      // Mark transfer as expired
      await transferDoc.ref.update({
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
    } catch (err) {
      console.error(`Error expiring transfer ${transferDoc.id}:`, err);
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

  const ops = jobs.docs.map((jobDoc) => ({
    ref: jobDoc.ref,
    data: { currentViewers: 0 },
    type: "update" as const,
  }));
  await commitInChunks(ops);

  console.log(`Reset viewer counts on ${jobs.size} jobs.`);
});

// ═══════════════════════════════════════════════════════════════
// 7. SCHEDULED: Monthly goal reset (1st of each month)
// ═══════════════════════════════════════════════════════════════
export const gsMonthlyGoalReset = onSchedule("0 0 1 * *", async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  console.log(`Creating monthly goals for ${year}-${month}...`);

  const scholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
  const ops: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; type: "set" | "update" }> = [];

  for (const scholarDoc of scholars.docs) {
    try {
      const data = scholarDoc.data();
      const scholarId = scholarDoc.id;

      // Create jobs goal
      if (data.monthlyJobGoal && data.monthlyJobGoal > 0) {
        const jobGoalRef = db.collection(GS_COLLECTIONS.SCHOLAR_GOALS).doc(`${scholarId}_${year}_${month}_jobs`);
        ops.push({
          ref: jobGoalRef,
          data: {
            scholarId,
            month,
            year,
            goalType: "jobs",
            goalTarget: data.monthlyJobGoal,
            currentProgress: 0,
            goalMet: false,
            notifiedAt90: false,
            notifiedAt100: false,
            createdAt: FieldValue.serverTimestamp(),
          },
          type: "set",
        });
      }

      // Create money goal
      if (data.monthlyMoneyGoal && data.monthlyMoneyGoal > 0) {
        const moneyGoalRef = db.collection(GS_COLLECTIONS.SCHOLAR_GOALS).doc(`${scholarId}_${year}_${month}_money`);
        ops.push({
          ref: moneyGoalRef,
          data: {
            scholarId,
            month,
            year,
            goalType: "money",
            goalTarget: data.monthlyMoneyGoal,
            currentProgress: 0,
            goalMet: false,
            notifiedAt90: false,
            notifiedAt100: false,
            createdAt: FieldValue.serverTimestamp(),
          },
          type: "set",
        });
      }
    } catch (err) {
      console.error(`Error creating goals for scholar ${scholarDoc.id}:`, err);
    }
  }

  await commitInChunks(ops);
  console.log(`Created ${ops.length} goals for ${scholars.size} scholars.`);
});

// ═══════════════════════════════════════════════════════════════
// 8. SCHEDULED: Compute analytics daily at 4am
// ═══════════════════════════════════════════════════════════════
export const gsComputeAnalytics = onSchedule(
  { schedule: "every day 04:00", timeoutSeconds: 540 },
  async () => {
    console.log("Computing scholar analytics...");

    const scholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
    if (scholars.empty) return;

    // Bulk-fetch all data to avoid N+1 queries
    const [allJobsSnap, allScoresSnap, allTransfersSnap, allReschedulesSnap] = await Promise.all([
      db.collection(GS_COLLECTIONS.JOBS).get(),
      db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).where("scoreLocked", "==", true).get(),
      db.collection(GS_COLLECTIONS.JOB_TRANSFERS).get(),
      db.collection(GS_COLLECTIONS.JOB_RESCHEDULES).get(),
    ]);

    // Index data by scholarId
    const jobsByScholar: Record<string, FirebaseFirestore.QueryDocumentSnapshot[]> = {};
    for (const jobDoc of allJobsSnap.docs) {
      const claimedBy = jobDoc.data().claimedBy;
      if (claimedBy) {
        if (!jobsByScholar[claimedBy]) jobsByScholar[claimedBy] = [];
        jobsByScholar[claimedBy].push(jobDoc);
      }
    }

    const scoresByScholar: Record<string, number[]> = {};
    for (const scoreDoc of allScoresSnap.docs) {
      const sid = scoreDoc.data().scholarId;
      if (sid) {
        if (!scoresByScholar[sid]) scoresByScholar[sid] = [];
        scoresByScholar[sid].push(scoreDoc.data().finalScore as number || 0);
      }
    }

    const transfersByScholar: Record<string, number> = {};
    for (const tDoc of allTransfersSnap.docs) {
      const sid = tDoc.data().fromScholarId;
      if (sid) transfersByScholar[sid] = (transfersByScholar[sid] || 0) + 1;
    }

    const reschedulesByScholar: Record<string, number> = {};
    for (const rDoc of allReschedulesSnap.docs) {
      const sid = rDoc.data().requestedBy;
      if (sid) reschedulesByScholar[sid] = (reschedulesByScholar[sid] || 0) + 1;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const scholarDoc of scholars.docs) {
      try {
        const scholarId = scholarDoc.id;
        const profileData = scholarDoc.data();
        const scholarJobs = jobsByScholar[scholarId] || [];

        // Completed jobs
        const completedJobs = scholarJobs.filter((j) => j.data().status === "COMPLETED");
        const cancelledJobs = scholarJobs.filter((j) => j.data().status === "CANCELLED");

        // Total earnings
        const totalEarningsAllTime = completedJobs.reduce((sum, j) => {
          const d = j.data();
          return sum + (d.payout || 0) + (d.rushBonus || 0);
        }, 0);

        // Time-windowed stats helper
        const jobsInWindow = (jobs: FirebaseFirestore.QueryDocumentSnapshot[], after: Date) =>
          jobs.filter((j) => {
            const ts = j.data().updatedAt;
            return ts && ts.toDate() >= after;
          });

        const earningsInWindow = (jobs: FirebaseFirestore.QueryDocumentSnapshot[], after: Date) =>
          jobsInWindow(jobs, after).reduce((sum, j) => {
            const d = j.data();
            return sum + (d.payout || 0) + (d.rushBonus || 0);
          }, 0);

        const jobsThisMonth = jobsInWindow(completedJobs, monthStart).length;
        const earningsThisMonth = earningsInWindow(completedJobs, monthStart);
        const jobsLast30Days = jobsInWindow(completedJobs, thirtyDaysAgo).length;
        const jobsLast90Days = jobsInWindow(completedJobs, ninetyDaysAgo).length;
        const earningsLast30Days = earningsInWindow(completedJobs, thirtyDaysAgo);
        const earningsLast90Days = earningsInWindow(completedJobs, ninetyDaysAgo);
        const cancellationsThisMonth = jobsInWindow(cancelledJobs, monthStart).length;

        // Reschedules this month
        const reschedulesThisMonth = allReschedulesSnap.docs.filter((d) => {
          const data = d.data();
          if (data.requestedBy !== scholarId) return false;
          const ts = data.createdAt;
          return ts && ts.toDate() >= monthStart;
        }).length;

        // Quality scores
        const scores = scoresByScholar[scholarId] || [];
        const avgPayScoreThisMonth = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          : 0;

        // Avg claim response (time from job creation to claim) — simplified
        const claimResponseTimes: number[] = [];
        for (const j of scholarJobs) {
          const d = j.data();
          if (d.claimedAt && d.createdAt) {
            const diff = (d.claimedAt.toDate().getTime() - d.createdAt.toDate().getTime()) / 60000;
            if (diff > 0 && diff < 10080) claimResponseTimes.push(diff); // cap at 7 days
          }
        }
        const avgClaimResponseMinutes = claimResponseTimes.length > 0
          ? Math.round(claimResponseTimes.reduce((a, b) => a + b, 0) / claimResponseTimes.length)
          : 0;

        // Trends (compare last 30 days to previous 30 days)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const jobsPrev30 = completedJobs.filter((j) => {
          const ts = j.data().updatedAt;
          return ts && ts.toDate() >= sixtyDaysAgo && ts.toDate() < thirtyDaysAgo;
        }).length;
        const earningsPrev30 = completedJobs
          .filter((j) => {
            const ts = j.data().updatedAt;
            return ts && ts.toDate() >= sixtyDaysAgo && ts.toDate() < thirtyDaysAgo;
          })
          .reduce((sum, j) => {
            const d = j.data();
            return sum + (d.payout || 0) + (d.rushBonus || 0);
          }, 0);

        const jobsTrend: "increasing" | "stable" | "declining" =
          jobsLast30Days > jobsPrev30 * 1.1 ? "increasing" :
          jobsLast30Days < jobsPrev30 * 0.9 ? "declining" : "stable";
        const earningsTrend: "increasing" | "stable" | "declining" =
          earningsLast30Days > earningsPrev30 * 1.1 ? "increasing" :
          earningsLast30Days < earningsPrev30 * 0.9 ? "declining" : "stable";

        // Write analytics doc matching GsScholarAnalytics type
        await db.collection(GS_COLLECTIONS.SCHOLAR_ANALYTICS).doc(scholarId).set({
          scholarId,
          scholarName: profileData.scholarName || "",
          jobsThisMonth,
          earningsThisMonth,
          avgPayScoreThisMonth,
          jobsLast30Days,
          jobsLast90Days,
          earningsLast30Days,
          earningsLast90Days,
          avgClaimResponseMinutes,
          cancellationsThisMonth,
          reschedulesThisMonth,
          jobsTrend,
          earningsTrend,
          totalJobsAllTime: completedJobs.length,
          totalEarningsAllTime,
          memberSince: profileData.createdAt || null,
          lastUpdated: FieldValue.serverTimestamp(),
        });

        // Sync key stats back to scholar profile
        const cancellationRate = scholarJobs.length > 0
          ? Math.round((cancelledJobs.length / scholarJobs.length) * 1000) / 10
          : 0;
        await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).update({
          totalJobsCompleted: completedJobs.length,
          totalEarnings: totalEarningsAllTime,
          cancellationRate,
        });
      } catch (err) {
        console.error(`Error computing analytics for scholar ${scholarDoc.id}:`, err);
      }
    }

    console.log(`Analytics computed for ${scholars.size} scholars.`);
  }
);

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
      if (scoreData.scoreLocked) {
        throw new HttpsError(
          "failed-precondition",
          "The complaint window for this job has closed."
        );
      }

      // Deduct points from quality score
      await scoreRef.update({
        customerComplaint: true,
        complaintDetails: description,
        complaintPhotos: photoUrls || [],
        // Reduce completion score by 50% on complaint
        completionScore: Math.max(0, (scoreData.completionScore || 0) * 0.5),
      });
    }

    // Hold any pending completion payout
    await holdCompletionPayout(jobId);

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
