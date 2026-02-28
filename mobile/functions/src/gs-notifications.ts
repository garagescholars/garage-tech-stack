/**
 * Garage Scholars — Multi-Channel Notification System
 *
 * Unified push (Expo), SMS (Twilio), and email (Firestore mail collection)
 * notification system. Also handles:
 * - Escalation triggers (notify admins + scholars when someone needs help)
 * - Pre-job video homework reminders (48h, 24h, 2h before job)
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GS_COLLECTIONS } from "./gs-constants";

const db = getFirestore();

// ─── Lazy-load Twilio (avoids cold start cost) ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _twilio: any = null;
function getTwilio(): any {
  if (!_twilio) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Twilio = require("twilio");
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("Twilio credentials not configured");
    _twilio = new Twilio(sid, token);
  }
  return _twilio;
}

// ─── Core: Send via Expo Push ───
export async function sendPush(
  pushTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
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

// ─── Core: Send via Email (Firestore mail collection) ───
export async function sendEmail(to: string[], subject: string, html: string) {
  await db.collection("mail").add({
    to,
    message: { subject, html },
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ─── Core: Send via SMS (Twilio) ───
export async function sendSMS(phoneNumber: string, body: string) {
  try {
    const twilio = getTwilio();
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) throw new Error("TWILIO_PHONE_NUMBER not configured");
    await twilio.messages.create({ to: phoneNumber, from, body });
    console.log(`SMS sent to ${phoneNumber.slice(0, 5)}***`);
  } catch (err) {
    console.error("SMS failed:", err);
  }
}

// ─── Unified: Multi-Channel Notification ───
export type NotificationChannels = ("push" | "sms" | "email")[];

export interface MultiChannelPayload {
  title: string;
  body: string;
  htmlBody?: string;
  data?: Record<string, string>;
  channels: NotificationChannels;
}

export async function sendMultiChannelNotification(
  userId: string,
  payload: MultiChannelPayload,
): Promise<{ push: boolean; sms: boolean; email: boolean }> {
  const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(userId).get();
  if (!profileSnap.exists) return { push: false, sms: false, email: false };

  const profile = profileSnap.data()!;
  const results = { push: false, sms: false, email: false };

  if (payload.channels.includes("push") && profile.pushToken) {
    try {
      await sendPush([profile.pushToken], payload.title, payload.body, payload.data);
      results.push = true;
    } catch (err) {
      console.error("Push failed for", userId, err);
    }
  }

  if (payload.channels.includes("sms") && profile.phone) {
    try {
      await sendSMS(profile.phone, `${payload.title}: ${payload.body}`);
      results.sms = true;
    } catch (err) {
      console.error("SMS failed for", userId, err);
    }
  }

  if (payload.channels.includes("email") && profile.email) {
    try {
      await sendEmail(
        [profile.email],
        payload.title,
        payload.htmlBody || `<p>${payload.body}</p>`,
      );
      results.email = true;
    } catch (err) {
      console.error("Email failed for", userId, err);
    }
  }

  return results;
}

// ─── Batch: Send to multiple users ───
export async function sendMultiChannelBatch(
  userIds: string[],
  payload: MultiChannelPayload,
): Promise<void> {
  await Promise.allSettled(
    userIds.map((uid) => sendMultiChannelNotification(uid, payload)),
  );
}

// ─── Helper: get push token for a user ───
async function getPushToken(uid: string): Promise<string | null> {
  const snap = await db.collection(GS_COLLECTIONS.PROFILES).doc(uid).get();
  return snap.exists ? (snap.data()?.pushToken as string) || null : null;
}

// ════════════════════════════════════════
//  Callable: Admin multi-channel notify
// ════════════════════════════════════════

export const gsMultiNotify = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
    secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { targetUids, title, body, channels } = request.data as {
      targetUids: string[];
      title: string;
      body: string;
      channels: NotificationChannels;
    };

    if (!targetUids?.length || !title || !body) {
      throw new HttpsError("invalid-argument", "targetUids, title, and body required.");
    }

    await sendMultiChannelBatch(targetUids, {
      title,
      body,
      channels: channels || ["push"],
    });

    return { ok: true };
  },
);

// ════════════════════════════════════════
//  Escalation: Notify on new escalation
// ════════════════════════════════════════

export const gsOnEscalationCreated = onDocumentCreated(
  {
    document: `${GS_COLLECTIONS.ESCALATIONS}/{escalationId}`,
    secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const escalationId = event.params.escalationId;

    // 1. Notify ALL admins via push + email
    const adminSnap = await db
      .collection(GS_COLLECTIONS.PROFILES)
      .where("role", "==", "admin")
      .get();
    const adminIds = adminSnap.docs.map((d) => d.id);

    await sendMultiChannelBatch(adminIds, {
      title: "Escalation: Help Needed On-Site",
      body: `${data.scholarName} needs help on "${data.jobTitle}": ${(data.description || "").slice(0, 100)}`,
      htmlBody: `<h3>Escalation on ${data.jobTitle}</h3>
        <p><strong>${data.scholarName}</strong> needs help:</p>
        <p>${data.description}</p>
        <p><strong>Already tried:</strong> ${data.attemptedSolutions}</p>
        ${data.equipmentName ? `<p><strong>Equipment:</strong> ${data.equipmentName}</p>` : ""}
        <p><strong>Photos:</strong> ${data.photoUrls?.length || 0} attached</p>`,
      data: { screen: "escalation", escalationId, jobId: data.jobId },
      channels: ["push", "email"],
    });

    // 2. Notify ALL other active scholars via push only (teamwork)
    const scholarsSnap = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
    const otherScholarIds = scholarsSnap.docs
      .map((d) => d.id)
      .filter((id) => id !== data.scholarId);

    // Batch push to other scholars
    const tokens: string[] = [];
    for (const scholarId of otherScholarIds) {
      const token = await getPushToken(scholarId);
      if (token) tokens.push(token);
    }

    if (tokens.length > 0) {
      await sendPush(
        tokens,
        "A Scholar Needs Help!",
        `${data.scholarName} is stuck on "${data.jobTitle}" — can you help?`,
        { screen: "escalation", escalationId, jobId: data.jobId },
      );
    }

    console.log(
      `Escalation ${escalationId}: notified ${adminIds.length} admins, ${tokens.length} scholars`,
    );
  },
);

// ════════════════════════════════════════
//  Pre-Job Video Homework Reminders
// ════════════════════════════════════════

function parseJobDateTime(dateStr: string, timeStr: string): number | null {
  if (!dateStr || !timeStr) return null;
  try {
    // dateStr format: "2026-02-20" or "Feb 20, 2026"
    // timeStr format: "9:00 AM" or "09:00"
    const dateNorm = dateStr.includes("-") ? dateStr : new Date(dateStr).toISOString().split("T")[0];
    const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeParts) return null;

    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const ampm = timeParts[3]?.toUpperCase();

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    const dt = new Date(`${dateNorm}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
    return dt.getTime();
  } catch {
    return null;
  }
}

export const gsJobPrepReminders = onSchedule(
  {
    schedule: "every 30 minutes",
    timeoutSeconds: 120,
    secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  },
  async () => {
    const now = Date.now();

    const prepSnap = await db
      .collection(GS_COLLECTIONS.JOB_PREP)
      .where("allConfirmed", "==", false)
      .get();

    if (prepSnap.empty) {
      console.log("No unconfirmed job prep docs found.");
      return;
    }

    for (const prepDoc of prepSnap.docs) {
      const prep = prepDoc.data();
      const jobSnap = await db.collection(GS_COLLECTIONS.JOBS).doc(prep.jobId).get();
      if (!jobSnap.exists) continue;

      const job = jobSnap.data()!;
      const jobStart = parseJobDateTime(job.scheduledDate, job.scheduledTimeStart);
      if (!jobStart) continue;

      const hoursUntilJob = (jobStart - now) / (60 * 60 * 1000);

      // Skip if job is already past
      if (hoursUntilJob < 0) continue;

      let reminderKey: string | null = null;
      let reminderMessage = "";

      if (hoursUntilJob <= 2 && !prep.reminder2hSent) {
        reminderKey = "reminder2hSent";
        reminderMessage = `URGENT: Your job "${job.title}" starts in 2 hours! You haven't watched all required assembly videos yet. Check-in will be blocked until you do. Open the app now.`;
      } else if (hoursUntilJob <= 24 && hoursUntilJob > 2 && !prep.reminder24hSent) {
        reminderKey = "reminder24hSent";
        reminderMessage = `Reminder: Your job "${job.title}" is tomorrow. Please watch the required assembly videos before your shift so you're ready to go.`;
      } else if (hoursUntilJob <= 48 && hoursUntilJob > 24 && !prep.reminder48hSent) {
        reminderKey = "reminder48hSent";
        reminderMessage = `Heads up: "${job.title}" is in 2 days. Start watching the assembly videos now so you're fully prepared on job day.`;
      }

      if (reminderKey) {
        const confirmed = (prep.videoConfirmations || []).filter(
          (v: { confirmedAt: unknown }) => v.confirmedAt !== null,
        ).length;
        const total = (prep.videoConfirmations || []).length;

        await sendMultiChannelNotification(prep.scholarId, {
          title: "Video Homework Required",
          body: reminderMessage,
          htmlBody: `<h3>Video Homework Required</h3>
            <p>${reminderMessage}</p>
            <p><strong>Progress:</strong> ${confirmed}/${total} videos confirmed</p>
            <p>Open the Garage Scholars app to view and confirm your videos.</p>`,
          data: { screen: "job-prep", jobId: prep.jobId },
          channels: ["push", "sms", "email"],
        });

        await prepDoc.ref.update({ [reminderKey]: true });
        console.log(`Sent ${reminderKey} for job ${prep.jobId} to scholar ${prep.scholarId}`);
      }
    }
  },
);
