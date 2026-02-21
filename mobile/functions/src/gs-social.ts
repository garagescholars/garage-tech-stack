/**
 * Garage Scholars — Auto Social Media Content
 *
 * Processes completed job photos into premium before/after composites,
 * auto-enhances images with Sharp, generates AI captions with Gemini,
 * and posts to Facebook + Instagram — fully automated, zero manual work.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { GS_COLLECTIONS } from "./gs-constants";
import { sendEmail } from "./gs-notifications";

const db = getFirestore();

// ─── Default prompt for caption generation ───
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

// ─── Quality validation constants ───
const MIN_IMAGE_WIDTH = 400;
const MIN_IMAGE_HEIGHT = 400;
const MIN_FILE_SIZE = 10_000;       // 10 KB — reject corrupt/blank images
const MAX_RETRY_ATTEMPTS = 3;
const MIN_CAPTION_LENGTH = 50;

// ─── Validate a source photo before processing ───
async function validatePhoto(
  buffer: Buffer,
  label: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (buffer.length < MIN_FILE_SIZE) {
    return { valid: false, reason: `${label} photo too small (${buffer.length} bytes) — likely corrupt` };
  }

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return { valid: false, reason: `${label} photo has no dimensions — unreadable format` };
    }
    if (metadata.width < MIN_IMAGE_WIDTH || metadata.height < MIN_IMAGE_HEIGHT) {
      return {
        valid: false,
        reason: `${label} photo too low-res (${metadata.width}x${metadata.height}, min ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT})`,
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: `${label} photo could not be read by Sharp — invalid format` };
  }
}

// ─── Validate a generated caption ───
function validateCaption(caption: string): { valid: boolean; reason?: string } {
  if (!caption || caption.trim().length < MIN_CAPTION_LENGTH) {
    return { valid: false, reason: `Caption too short (${caption?.length || 0} chars, min ${MIN_CAPTION_LENGTH})` };
  }
  if (!caption.includes("#")) {
    return { valid: false, reason: "Caption missing hashtags" };
  }
  return { valid: true };
}

// ─── Alert admin on persistent failures ───
async function alertAdminFailure(jobId: string, error: string, attempts: number) {
  try {
    const adminsSnap = await db.collection(GS_COLLECTIONS.PROFILES)
      .where("role", "==", "admin")
      .limit(3)
      .get();
    const emails = adminsSnap.docs
      .map((d) => d.data().email as string)
      .filter(Boolean);

    if (emails.length > 0) {
      await sendEmail(
        emails,
        `Social Media Post Failed (${attempts} attempts) — Job ${jobId}`,
        `<p>The automated social media post for job <strong>${jobId}</strong> has failed <strong>${attempts}</strong> times.</p>
         <p><strong>Error:</strong> ${error}</p>
         <p>The item has been marked as permanently failed. Check the <code>gs_socialContentQueue</code> collection for details.</p>`,
      );
    }
  } catch (err) {
    console.error("Failed to send admin alert:", err);
  }
}

// ─── Auto-enhance a cell phone photo using Sharp ───
async function enhancePhoto(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()                                    // Fix EXIF orientation
      .normalize()                                 // Auto-level histogram
      .sharpen({ sigma: 1.0, m1: 1.0, m2: 2.0 }) // Gentle sharpening
      .modulate({ brightness: 1.05, saturation: 1.12 }) // Subtle pop
      .gamma(1.1)                                  // Lift shadows
      .toBuffer();
  } catch (err) {
    console.warn("Photo enhancement failed, using original:", err);
    return buffer;
  }
}

// ─── Brand color themes that rotate with each post ───
// Derived from garagescholars.com brand: emerald greens, teal, dark backgrounds, gold accents
interface ColorTheme {
  name: string;
  bg: { r: number; g: number; b: number };   // Canvas background
  bgHex: string;                              // Same as bg in hex
  accent: string;                             // Divider & brand name color
  labelBg: string;                            // Label overlay background (rgba)
  tagline: string;                            // Tagline text color
}

const COLOR_THEMES: ColorTheme[] = [
  {
    // Theme 1: Classic Dark + Emerald — signature brand look
    name: "emerald",
    bg: { r: 9, g: 9, b: 11 },
    bgHex: "#09090b",
    accent: "#10b981",       // emerald-500
    labelBg: "rgba(9,9,11,0.8)",
    tagline: "#6ee7b7",      // emerald-300
  },
  {
    // Theme 2: Dark Slate + Teal — app brand colors
    name: "teal",
    bg: { r: 15, g: 27, b: 45 },
    bgHex: "#0f1b2d",
    accent: "#14b8a6",       // teal-500 (app primary)
    labelBg: "rgba(15,27,45,0.8)",
    tagline: "#5eead4",      // teal-300
  },
  {
    // Theme 3: Deep Green + Gold — premium feel
    name: "gold",
    bg: { r: 10, g: 18, b: 10 },
    bgHex: "#0a120a",
    accent: "#c9a84c",       // gold
    labelBg: "rgba(10,18,10,0.8)",
    tagline: "#86efac",      // green-300
  },
  {
    // Theme 4: Charcoal + Bright Green — bold & clean
    name: "green",
    bg: { r: 3, g: 3, b: 3 },
    bgHex: "#030303",
    accent: "#22c55e",       // green-500
    labelBg: "rgba(3,3,3,0.8)",
    tagline: "#94a3b8",      // slate-400
  },
];

// Determine which theme to use based on rotating index stored in Firestore
async function getNextColorTheme(): Promise<ColorTheme> {
  const configRef = db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("socialMediaTheme");
  try {
    const snap = await configRef.get();
    const lastIndex = snap.exists ? (snap.data()?.lastThemeIndex ?? -1) as number : -1;
    const nextIndex = (lastIndex + 1) % COLOR_THEMES.length;
    await configRef.set({ lastThemeIndex: nextIndex, lastThemeName: COLOR_THEMES[nextIndex].name }, { merge: true });
    return COLOR_THEMES[nextIndex];
  } catch {
    return COLOR_THEMES[0]; // Fallback to emerald
  }
}

// ─── Create premium before/after composite (1080x1080 Instagram square) ───
async function createCompositeImage(
  beforeBuffer: Buffer,
  afterBuffer: Buffer,
  theme?: ColorTheme,
): Promise<Buffer> {
  const t = theme || COLOR_THEMES[0];

  const CANVAS = 1080;
  const BORDER = 8;
  const INNER = CANVAS - BORDER * 2;                          // 1064
  const DIVIDER_WIDTH = 6;
  const IMG_WIDTH = Math.floor((INNER - DIVIDER_WIDTH) / 2);  // 529
  const IMG_HEIGHT = 904;

  // Enhance both photos
  const [enhancedBefore, enhancedAfter] = await Promise.all([
    enhancePhoto(beforeBuffer),
    enhancePhoto(afterBuffer),
  ]);

  // Resize to fill their slots (cover crop, center)
  const [beforeResized, afterResized] = await Promise.all([
    sharp(enhancedBefore)
      .resize(IMG_WIDTH, IMG_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 92 })
      .toBuffer(),
    sharp(enhancedAfter)
      .resize(IMG_WIDTH, IMG_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 92 })
      .toBuffer(),
  ]);

  // "BEFORE" label — overlaid near bottom of left image
  const labelHeight = 44;
  const labelY = IMG_HEIGHT - 16 - labelHeight;

  const beforeLabel = Buffer.from(`
    <svg width="${IMG_WIDTH}" height="${labelHeight}">
      <rect width="${IMG_WIDTH}" height="${labelHeight}" fill="${t.labelBg}"/>
      <text x="${IMG_WIDTH / 2}" y="30" text-anchor="middle"
            font-family="Helvetica Neue,Arial,sans-serif"
            font-size="20" font-weight="700" letter-spacing="4"
            fill="#ffffff">BEFORE</text>
    </svg>
  `);

  // "AFTER" label — overlaid near bottom of right image
  const afterLabel = Buffer.from(`
    <svg width="${IMG_WIDTH}" height="${labelHeight}">
      <rect width="${IMG_WIDTH}" height="${labelHeight}" fill="${t.labelBg}"/>
      <text x="${IMG_WIDTH / 2}" y="30" text-anchor="middle"
            font-family="Helvetica Neue,Arial,sans-serif"
            font-size="20" font-weight="700" letter-spacing="4"
            fill="#ffffff">AFTER</text>
    </svg>
  `);

  // Vertical accent divider between images
  const verticalDivider = Buffer.from(`
    <svg width="${DIVIDER_WIDTH}" height="${IMG_HEIGHT}">
      <rect width="${DIVIDER_WIDTH}" height="${IMG_HEIGHT}" fill="${t.accent}"/>
    </svg>
  `);

  // Horizontal accent separator below images
  const horizontalDivider = Buffer.from(`
    <svg width="${INNER}" height="2">
      <rect width="${INNER}" height="2" fill="${t.accent}"/>
    </svg>
  `);

  // Branding bar at bottom
  const brandBarHeight = CANVAS - BORDER * 2 - IMG_HEIGHT - 2; // 158
  const brandBar = Buffer.from(`
    <svg width="${INNER}" height="${brandBarHeight}">
      <rect width="${INNER}" height="${brandBarHeight}" fill="${t.bgHex}"/>
      <rect x="${(INNER - 120) / 2}" y="18" width="120" height="2" fill="${t.accent}"/>
      <text x="${INNER / 2}" y="52" text-anchor="middle"
            font-family="Helvetica Neue,Arial,sans-serif"
            font-size="28" font-weight="700" letter-spacing="6"
            fill="${t.accent}">GARAGE SCHOLARS</text>
      <text x="${INNER / 2}" y="82" text-anchor="middle"
            font-family="Helvetica Neue,Arial,sans-serif"
            font-size="14" letter-spacing="2"
            fill="${t.tagline}">Clear Space, Calm Mind, Confident Life</text>
    </svg>
  `);

  // Create dark base canvas
  const base = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: t.bg,
    },
  })
    .jpeg()
    .toBuffer();

  // Composite everything
  const result = await sharp(base)
    .composite([
      { input: beforeResized, left: BORDER, top: BORDER },
      { input: beforeLabel, left: BORDER, top: BORDER + labelY },
      { input: verticalDivider, left: BORDER + IMG_WIDTH, top: BORDER },
      { input: afterResized, left: BORDER + IMG_WIDTH + DIVIDER_WIDTH, top: BORDER },
      { input: afterLabel, left: BORDER + IMG_WIDTH + DIVIDER_WIDTH, top: BORDER + labelY },
      { input: horizontalDivider, left: BORDER, top: BORDER + IMG_HEIGHT },
      { input: brandBar, left: BORDER, top: BORDER + IMG_HEIGHT + 2 },
    ])
    .jpeg({ quality: 93 })
    .toBuffer();

  return result;
}

// ─── Generate caption using Gemini ───
async function generateCaption(
  jobTitle: string,
  address: string,
  packageTier: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text?.trim() || "Another garage transformed! #GarageScholars";
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

  // Step 2: Wait for Instagram to process the media container
  const containerId = createData.id;
  const maxWaitMs = 60_000; // 60 seconds max
  const pollInterval = 5_000; // check every 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const statusResp = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    const statusData = await statusResp.json() as { status_code?: string; error?: { message: string } };

    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") {
      throw new Error("Instagram media container processing failed");
    }

    // Still processing — wait and poll again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Step 3: Publish the container
  const publishUrl = `https://graph.facebook.com/v21.0/${igUserId}/media_publish`;
  const publishResp = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
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
// Scheduled: Process social media content queue (daily at 9 AM MT)
// ═══════════════════════════════════════════════════════════════

export const gsProcessSocialContent = onSchedule(
  {
    schedule: "every day 09:00",
    timeZone: "America/Denver",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [
      "GEMINI_API_KEY",
      "META_PAGE_ACCESS_TOKEN",
      "META_PAGE_ID",
      "META_IG_USER_ID",
    ],
  },
  async () => {
    // Query pending items + failed items eligible for retry
    const [pendingSnap, retrySnap] = await Promise.all([
      db.collection(GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE)
        .where("status", "==", "pending")
        .limit(3)
        .get(),
      db.collection(GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE)
        .where("status", "==", "failed")
        .where("retryCount", "<", MAX_RETRY_ATTEMPTS)
        .limit(2)
        .get(),
    ]);

    const allDocs = [...pendingSnap.docs, ...retrySnap.docs];

    if (allDocs.length === 0) {
      console.log("No pending social content to process.");
      return;
    }

    const storage = getStorage();
    const bucket = storage.bucket();

    for (const doc of allDocs) {
      const item = doc.data();
      const retryCount = (item.retryCount || 0) as number;
      const isRetry = item.status === "failed";

      try {
        console.log(
          `${isRetry ? "Retrying" : "Processing"} social content for job ${item.jobId}` +
          `${isRetry ? ` (attempt ${retryCount + 1})` : ""}...`,
        );

        // Mark as processing to prevent duplicate pickups
        await doc.ref.update({ status: "processing" });

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

        // 2. Validate source photos
        const [beforeCheck, afterCheck] = await Promise.all([
          validatePhoto(beforeBuffer, "Before"),
          validatePhoto(afterBuffer, "After"),
        ]);
        if (!beforeCheck.valid) throw new Error(beforeCheck.reason!);
        if (!afterCheck.valid) throw new Error(afterCheck.reason!);

        // 3. Pick next color theme in rotation & create enhanced composite
        const theme = await getNextColorTheme();
        console.log(`Using color theme: ${theme.name}`);
        const compositeBuffer = await createCompositeImage(beforeBuffer, afterBuffer, theme);

        // 4. Validate composite output
        const compositeMeta = await sharp(compositeBuffer).metadata();
        if (!compositeMeta.width || compositeMeta.width < 1080) {
          throw new Error(`Composite output invalid: ${compositeMeta.width}x${compositeMeta.height}`);
        }

        // 5. Upload composite to Firebase Storage
        const compositePath = `gs_social_content/${item.jobId}/composite_${Date.now()}.jpg`;
        const file = bucket.file(compositePath);
        await file.save(compositeBuffer, {
          metadata: { contentType: "image/jpeg" },
        });
        await file.makePublic();
        const compositeUrl = `https://storage.googleapis.com/${bucket.name}/${compositePath}`;

        // 6. Generate caption with Gemini + validate
        let caption = await generateCaption(
          item.jobTitle,
          item.address,
          item.packageTier,
        );

        const captionCheck = validateCaption(caption);
        if (!captionCheck.valid) {
          console.warn(`Caption validation failed (${captionCheck.reason}), retrying once...`);
          caption = await generateCaption(item.jobTitle, item.address, item.packageTier);
          const retryCheck = validateCaption(caption);
          if (!retryCheck.valid) {
            throw new Error(`Caption failed validation after retry: ${retryCheck.reason}`);
          }
        }

        // 7. Post to Facebook
        let fbPostId: string | null = null;
        try {
          fbPostId = await postToFacebook(compositeUrl, caption);
          console.log(`Facebook post created: ${fbPostId}`);
        } catch (err) {
          console.error("Facebook post failed:", err);
        }

        // 8. Post to Instagram
        let igPostId: string | null = null;
        try {
          igPostId = await postToInstagram(compositeUrl, caption);
          console.log(`Instagram post created: ${igPostId}`);
        } catch (err) {
          console.error("Instagram post failed:", err);
        }

        // 9. Update queue item — success
        await doc.ref.update({
          status: "posted",
          compositeUrl,
          caption,
          fbPostId: fbPostId || "",
          igPostId: igPostId || "",
          postedAt: FieldValue.serverTimestamp(),
          retryCount: retryCount + (isRetry ? 1 : 0),
        });

        console.log(`Social content posted for job ${item.jobId}`);
      } catch (err: any) {
        const newRetryCount = retryCount + 1;
        const errorMsg = err.message || "Unknown error";
        console.error(`Social content failed for job ${item.jobId} (attempt ${newRetryCount}):`, err);

        if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
          // Permanently failed — alert admin
          await doc.ref.update({
            status: "permanently_failed",
            error: errorMsg,
            retryCount: newRetryCount,
            failedAt: FieldValue.serverTimestamp(),
          });
          await alertAdminFailure(item.jobId, errorMsg, newRetryCount);
        } else {
          // Mark as failed with retry count — will be picked up next cycle
          await doc.ref.update({
            status: "failed",
            error: errorMsg,
            retryCount: newRetryCount,
          });
        }
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

