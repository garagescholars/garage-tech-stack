/**
 * Garage Scholars — Google Review Request Campaign
 *
 * Sends email + SMS to customers 3 and 5 days after job completion,
 * asking them to leave a Google review.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { GS_COLLECTIONS } from "./gs-constants";
import { sendEmail, sendSMS } from "./gs-notifications";

const db = getFirestore();

// ─── Email template wrapper ───
function emailWrapper(body: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
  <div style="background: #0f1b2d; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #14b8a6; margin: 0; font-size: 24px;">Garage Scholars</h1>
  </div>
  <div style="padding: 32px 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
    ${body}
  </div>
  <div style="background: #0f1b2d; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: #64748b; font-size: 12px; margin: 0;">Garage Scholars — Denver's College-Powered Garage Transformations</p>
  </div>
</div>`;
}

function reviewButton(reviewLink: string): string {
  return `<div style="text-align: center; margin: 32px 0;">
    <a href="${reviewLink}" style="background: #14b8a6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">Leave a Review</a>
  </div>`;
}

// ─── Day 3 Email Templates (3 rotating) ───
function getDay3Email(templateIndex: number, firstName: string, reviewLink: string) {
  const templates = [
    {
      subject: `We loved transforming your garage, ${firstName}!`,
      body: emailWrapper(`
        <p>Hi ${firstName},</p>
        <p>Thank you for choosing Garage Scholars to help transform your garage into your dream space! Our scholars put their heart into every job, and we hope you're enjoying the results.</p>
        <p>If you had a great experience, we'd be honored if you'd share it with a quick Google review. It takes less than a minute and helps other homeowners find us!</p>
        ${reviewButton(reviewLink)}
        <p style="color: #64748b; font-size: 14px;">Thank you for supporting local college students while getting an amazing garage!</p>
      `),
    },
    {
      subject: `How's your newly organized garage, ${firstName}?`,
      body: emailWrapper(`
        <p>Hi ${firstName},</p>
        <p>We hope you're loving your freshly organized garage! Every time you walk in and see everything in its place, we hope it puts a smile on your face.</p>
        <p>Your feedback means the world to our team of college scholars. If you have a moment, a quick Google review would help us continue bringing garage transformations to Denver homeowners.</p>
        ${reviewButton(reviewLink)}
        <p style="color: #64748b; font-size: 14px;">We appreciate your support!</p>
      `),
    },
    {
      subject: `You helped a college student today, ${firstName}!`,
      body: emailWrapper(`
        <p>Hi ${firstName},</p>
        <p>Did you know? By choosing Garage Scholars, you helped support a college student's education and career development. Our scholars learn real-world skills while transforming garages across Denver.</p>
        <p>If you enjoyed the experience, sharing a quick review helps us connect with more homeowners — and hire more students!</p>
        ${reviewButton(reviewLink)}
        <p style="color: #64748b; font-size: 14px;">Thank you for being part of the Garage Scholars community!</p>
      `),
    },
  ];
  return templates[templateIndex % 3];
}

// ─── Day 3 SMS Templates (3 rotating) ───
function getDay3SMS(templateIndex: number, firstName: string, reviewLink: string): string {
  const templates = [
    `Hi ${firstName}! Thanks for choosing Garage Scholars for your garage transformation. If you loved the results, a quick Google review would mean so much to our team! ${reviewLink}`,
    `Hey ${firstName}! We hope you're enjoying your newly organized garage. If we exceeded your expectations, we'd love a quick Google review: ${reviewLink}`,
    `${firstName}, thanks for trusting Garage Scholars with your garage! Your feedback helps other homeowners find us. Leave a review here: ${reviewLink}`,
  ];
  return templates[templateIndex % 3];
}

// ─── Day 5 Templates ───
function getDay5Email(firstName: string, reviewLink: string) {
  return {
    subject: `Quick reminder — we'd love your feedback, ${firstName}!`,
    body: emailWrapper(`
      <p>Hi ${firstName},</p>
      <p>Just a friendly follow-up! If you haven't had a chance yet, we'd still love to hear about your Garage Scholars experience.</p>
      <p>A quick Google review helps other Denver homeowners discover us, and it means the world to our team of college scholars.</p>
      ${reviewButton(reviewLink)}
      <p style="color: #64748b; font-size: 14px;">This is our last reminder — we won't bug you again! Thank you.</p>
    `),
  };
}

function getDay5SMS(firstName: string, reviewLink: string): string {
  return `Hi ${firstName}, just a gentle nudge! If you enjoyed your Garage Scholars experience, a Google review would really help us out: ${reviewLink}`;
}

// ═══════════════════════════════════════════════════════════════
// Scheduled: Google Review Campaign (daily at 10:00 AM)
// ═══════════════════════════════════════════════════════════════

export const gsReviewCampaign = onSchedule(
  {
    schedule: "0 10 * * *", // 10:00 AM daily
    timeoutSeconds: 120,
    secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "GOOGLE_PLACE_ID"],
  },
  async () => {
    const placeId = process.env.GOOGLE_PLACE_ID;
    if (!placeId) {
      console.error("GOOGLE_PLACE_ID not configured — skipping review campaign.");
      return;
    }

    const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
    const now = Timestamp.now();
    const threeDaysAgo = Timestamp.fromDate(new Date(now.toMillis() - 3 * 24 * 60 * 60 * 1000));
    const fiveDaysAgo = Timestamp.fromDate(new Date(now.toMillis() - 5 * 24 * 60 * 60 * 1000));

    // ── Day 3 Campaigns ──
    try {
      const day3Snap = await db.collection(GS_COLLECTIONS.REVIEW_CAMPAIGNS)
        .where("day3Sent", "==", false)
        .where("completedAt", "<=", threeDaysAgo)
        .get();

      for (const doc of day3Snap.docs) {
        const campaign = doc.data();
        const firstName = (campaign.customerName || "").split(" ")[0] || "there";

        try {
          const template = getDay3Email(campaign.templateIndex || 0, firstName, reviewLink);

          if (campaign.customerEmail) {
            await sendEmail([campaign.customerEmail], template.subject, template.body);
          }

          if (campaign.customerPhone) {
            const smsBody = getDay3SMS(campaign.templateIndex || 0, firstName, reviewLink);
            await sendSMS(campaign.customerPhone, smsBody);
          }

          await doc.ref.update({
            day3Sent: true,
            day3SentAt: FieldValue.serverTimestamp(),
          });

          console.log(`Day 3 review request sent for job ${campaign.jobId}`);
        } catch (err) {
          console.error(`Day 3 send failed for campaign ${doc.id}:`, err);
        }
      }

      console.log(`Day 3 campaigns processed: ${day3Snap.size}`);
    } catch (err) {
      console.error("Day 3 campaign query failed:", err);
    }

    // ── Day 5 Campaigns ──
    try {
      const day5Snap = await db.collection(GS_COLLECTIONS.REVIEW_CAMPAIGNS)
        .where("day3Sent", "==", true)
        .where("day5Sent", "==", false)
        .where("completedAt", "<=", fiveDaysAgo)
        .get();

      for (const doc of day5Snap.docs) {
        const campaign = doc.data();
        const firstName = (campaign.customerName || "").split(" ")[0] || "there";

        try {
          const template = getDay5Email(firstName, reviewLink);

          if (campaign.customerEmail) {
            await sendEmail([campaign.customerEmail], template.subject, template.body);
          }

          if (campaign.customerPhone) {
            const smsBody = getDay5SMS(firstName, reviewLink);
            await sendSMS(campaign.customerPhone, smsBody);
          }

          await doc.ref.update({
            day5Sent: true,
            day5SentAt: FieldValue.serverTimestamp(),
          });

          console.log(`Day 5 review follow-up sent for job ${campaign.jobId}`);
        } catch (err) {
          console.error(`Day 5 send failed for campaign ${doc.id}:`, err);
        }
      }

      console.log(`Day 5 campaigns processed: ${day5Snap.size}`);
    } catch (err) {
      console.error("Day 5 campaign query failed:", err);
    }
  },
);
