/**
 * Garage Scholars — Auto Social Media Content
 *
 * Processes completed job photos into before/after composites,
 * generates AI captions with Claude, and posts to Facebook + Instagram.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { GS_COLLECTIONS } from "./gs-constants";

const db = getFirestore();

// ─── Default Claude prompt for caption generation ───
const DEFAULT_CAPTION_PROMPT = `You are the social media manager for Garage Scholars, a Denver-based garage transformation company staffed by college students ("scholars"). Generate an engaging Instagram/Facebook feed post caption for a before-and-after garage transformation photo.

JOB DETAILS:
- Service: {jobTitle}
- Location: {location}
- Package: {packageTier}

BRAND VOICE:
- Professional but warm and approachable
- Highlight the transformation, not the mess
- Celebrate the homeowner's decision to invest in their space
- Subtly mention scholars (college students doing the work) — it's a differentiator
- Never negative about the "before" state

CAPTION RULES:
- 2-3 short paragraphs (not a wall of text)
- End with a clear call-to-action (book a consultation, link in bio, etc.)
- Include 8-12 relevant hashtags at the end
- Use 1-2 emojis max (professional, not spammy)
- Mention Denver/Colorado when natural
- Keep under 300 words total
- Each caption should feel unique — vary the opening line, structure, and CTA

HASHTAG STRATEGY:
Mix of: #GarageOrganization #GarageTransformation #DenverHome #GarageScholars #BeforeAndAfter #HomeOrganization #GarageMakeover #Denver #Colorado #OrganizedGarage #DeclutterYourLife #GarageGoals

Output ONLY the caption text (including hashtags). No labels, headers, or formatting.`;

// ─── Create before/after composite image with Sharp ───
async function createCompositeImage(
  beforeBuffer: Buffer,
  afterBuffer: Buffer,
): Promise<Buffer> {
  // Resize both images to 540x540 (square, fits in 1200x700 canvas)
  const imgWidth = 540;
  const imgHeight = 540;
  const canvasWidth = 1200;
  const canvasHeight = 700;
  const padding = 30;

  const beforeResized = await sharp(beforeBuffer)
    .resize(imgWidth, imgHeight, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  const afterResized = await sharp(afterBuffer)
    .resize(imgWidth, imgHeight, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  // Create text labels as SVG overlays
  const beforeLabel = Buffer.from(`
    <svg width="${imgWidth}" height="36">
      <rect width="${imgWidth}" height="36" fill="rgba(15,27,45,0.8)" rx="0"/>
      <text x="${imgWidth / 2}" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#94a3b8">BEFORE</text>
    </svg>
  `);

  const afterLabel = Buffer.from(`
    <svg width="${imgWidth}" height="36">
      <rect width="${imgWidth}" height="36" fill="rgba(20,184,166,0.85)" rx="0"/>
      <text x="${imgWidth / 2}" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#ffffff">AFTER</text>
    </svg>
  `);

  // Branding bar
  const brandingBar = Buffer.from(`
    <svg width="${canvasWidth}" height="50">
      <rect width="${canvasWidth}" height="50" fill="#0f1b2d"/>
      <text x="${canvasWidth / 2}" y="32" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#14b8a6">GARAGE SCHOLARS</text>
    </svg>
  `);

  // Compose: dark background with before on left, after on right
  const composite = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 15, g: 27, b: 45 },
    },
  })
    .jpeg()
    .toBuffer();

  const result = await sharp(composite)
    .composite([
      // Before image (left)
      { input: beforeResized, left: padding, top: padding },
      // Before label
      { input: beforeLabel, left: padding, top: padding },
      // After image (right)
      { input: afterResized, left: padding + imgWidth + padding, top: padding },
      // After label
      { input: afterLabel, left: padding + imgWidth + padding, top: padding },
      // Divider arrow in center
      {
        input: Buffer.from(`
          <svg width="30" height="30">
            <polygon points="5,0 25,15 5,30" fill="#14b8a6"/>
          </svg>
        `),
        left: Math.floor(canvasWidth / 2 - 15),
        top: Math.floor(padding + imgHeight / 2 - 15),
      },
      // Branding bar at bottom
      { input: brandingBar, left: 0, top: canvasHeight - 50 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return result;
}

// ─── Generate caption using Claude ───
async function generateCaption(
  jobTitle: string,
  address: string,
  packageTier: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Try to load custom prompt from Firestore
  let promptTemplate = DEFAULT_CAPTION_PROMPT;
  try {
    const configSnap = await db
      .collection(GS_COLLECTIONS.PLATFORM_CONFIG)
      .doc("socialMediaPrompt")
      .get();
    if (configSnap.exists && configSnap.data()?.prompt) {
      promptTemplate = configSnap.data()!.prompt as string;
    }
  } catch {
    // Use default prompt
  }

  // Extract city from address (last part before state/zip)
  const location = address
    ? address.split(",").slice(-2, -1)[0]?.trim() || "Denver"
    : "Denver";

  const prompt = promptTemplate
    .replace("{jobTitle}", jobTitle || "Garage Transformation")
    .replace("{location}", location)
    .replace("{packageTier}", packageTier || "Standard");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text.trim() : "Another garage transformed! #GarageScholars";
}

// ─── Post to Facebook Page ───
async function postToFacebook(
  imageUrl: string,
  caption: string,
): Promise<string | null> {
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    console.warn("Meta credentials not configured — skipping Facebook post");
    return null;
  }

  const url = `https://graph.facebook.com/v21.0/${pageId}/photos`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      message: caption,
      access_token: accessToken,
    }),
  });

  const data = await resp.json() as { id?: string; error?: { message: string } };
  if (data.error) {
    throw new Error(`Facebook API error: ${data.error.message}`);
  }

  return data.id || null;
}

// ─── Post to Instagram ───
async function postToInstagram(
  imageUrl: string,
  caption: string,
): Promise<string | null> {
  const igUserId = process.env.META_IG_USER_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!igUserId || !accessToken) {
    console.warn("Instagram credentials not configured — skipping IG post");
    return null;
  }

  // Step 1: Create media container
  const createUrl = `https://graph.facebook.com/v21.0/${igUserId}/media`;
  const createResp = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  const createData = await createResp.json() as { id?: string; error?: { message: string } };
  if (createData.error) {
    throw new Error(`Instagram create error: ${createData.error.message}`);
  }
  if (!createData.id) throw new Error("No creation_id returned from Instagram");

  // Step 2: Publish the container
  const publishUrl = `https://graph.facebook.com/v21.0/${igUserId}/media_publish`;
  const publishResp = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: createData.id,
      access_token: accessToken,
    }),
  });

  const publishData = await publishResp.json() as { id?: string; error?: { message: string } };
  if (publishData.error) {
    throw new Error(`Instagram publish error: ${publishData.error.message}`);
  }

  return publishData.id || null;
}

// ═══════════════════════════════════════════════════════════════
// Scheduled: Process social media content queue (every 30 min)
// ═══════════════════════════════════════════════════════════════

export const gsProcessSocialContent = onSchedule(
  {
    schedule: "every 30 minutes",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [
      "ANTHROPIC_API_KEY",
      "META_PAGE_ACCESS_TOKEN",
      "META_PAGE_ID",
      "META_IG_USER_ID",
    ],
  },
  async () => {
    const pendingSnap = await db
      .collection(GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE)
      .where("status", "==", "pending")
      .limit(3)
      .get();

    if (pendingSnap.empty) {
      console.log("No pending social content to process.");
      return;
    }

    const storage = getStorage();
    const bucket = storage.bucket();

    for (const doc of pendingSnap.docs) {
      const item = doc.data();

      try {
        console.log(`Processing social content for job ${item.jobId}...`);

        // 1. Download before and after photos
        const [beforeResp, afterResp] = await Promise.all([
          fetch(item.beforePhotoUrl),
          fetch(item.afterPhotoUrl),
        ]);

        if (!beforeResp.ok || !afterResp.ok) {
          throw new Error("Failed to download photos from Firebase Storage");
        }

        const beforeBuffer = Buffer.from(await beforeResp.arrayBuffer());
        const afterBuffer = Buffer.from(await afterResp.arrayBuffer());

        // 2. Create composite image
        const compositeBuffer = await createCompositeImage(beforeBuffer, afterBuffer);

        // 3. Upload composite to Firebase Storage
        const compositePath = `gs_social_content/${item.jobId}/composite_${Date.now()}.jpg`;
        const file = bucket.file(compositePath);
        await file.save(compositeBuffer, {
          metadata: { contentType: "image/jpeg" },
        });
        await file.makePublic();
        const compositeUrl = `https://storage.googleapis.com/${bucket.name}/${compositePath}`;

        // 4. Generate caption with Claude
        const caption = await generateCaption(
          item.jobTitle,
          item.address,
          item.packageTier,
        );

        // 5. Post to Facebook
        let fbPostId: string | null = null;
        try {
          fbPostId = await postToFacebook(compositeUrl, caption);
          console.log(`Facebook post created: ${fbPostId}`);
        } catch (err) {
          console.error("Facebook post failed:", err);
        }

        // 6. Post to Instagram
        let igPostId: string | null = null;
        try {
          igPostId = await postToInstagram(compositeUrl, caption);
          console.log(`Instagram post created: ${igPostId}`);
        } catch (err) {
          console.error("Instagram post failed:", err);
        }

        // 7. Update queue item
        await doc.ref.update({
          status: "posted",
          compositeUrl,
          caption,
          fbPostId: fbPostId || "",
          igPostId: igPostId || "",
          postedAt: FieldValue.serverTimestamp(),
        });

        console.log(`Social content posted for job ${item.jobId}`);
      } catch (err: any) {
        console.error(`Social content processing failed for job ${item.jobId}:`, err);

        await doc.ref.update({
          status: "failed",
          error: err.message || "Unknown error",
        });
      }
    }
  },
);

// ═══════════════════════════════════════════════════════════════
// Callable: Refresh Meta access token (admin-only)
// ═══════════════════════════════════════════════════════════════

export const gsRefreshMetaToken = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
    secrets: ["META_PAGE_ACCESS_TOKEN"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const profileSnap = await db
      .collection(GS_COLLECTIONS.PROFILES)
      .doc(request.auth.uid)
      .get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { appId, appSecret, shortLivedToken } = request.data as {
      appId: string;
      appSecret: string;
      shortLivedToken: string;
    };

    if (!appId || !appSecret || !shortLivedToken) {
      throw new HttpsError("invalid-argument", "appId, appSecret, and shortLivedToken required.");
    }

    // Exchange for long-lived token
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const resp = await fetch(url);
    const data = await resp.json() as { access_token?: string; error?: { message: string } };

    if (data.error) {
      throw new HttpsError("internal", `Meta API error: ${data.error.message}`);
    }

    if (!data.access_token) {
      throw new HttpsError("internal", "No access token returned from Meta.");
    }

    // Store the new token in platform config for reference
    await db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("metaTokens").set(
      {
        lastRefreshedAt: FieldValue.serverTimestamp(),
        expiresInDays: 60,
      },
      { merge: true },
    );

    return {
      ok: true,
      token: data.access_token,
      message: "Long-lived token generated. Set it as META_PAGE_ACCESS_TOKEN secret: firebase functions:secrets:set META_PAGE_ACCESS_TOKEN",
    };
  },
);
