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
// Caption story angles — rotated one per post so every caption tells a different story
const CAPTION_ANGLES = [
  // --- HEALTH & FITNESS ---
  "HOME GYM angle: The homeowner set up a home gym in their clean garage. They work out every morning now without a gym membership. Paint a picture of early morning workouts, weights racked on the wall, and someone who got their fitness back because the space was finally there.",
  "MENTAL HEALTH angle: The clutter was causing real anxiety. Every time they opened the garage door they felt overwhelmed. Now it's calm and organized and that peace of mind carries into the rest of their day. Talk about how physical clutter equals mental clutter.",
  "ACTIVE FAMILY angle: The family bikes together now. The kids grab their helmets off the hooks and ride out of the garage on Saturday mornings. The garage went from a place nobody wanted to enter to the launchpad for family adventures.",

  // --- MONEY & VALUE ---
  "HOME RESALE angle: An organized garage adds real value to a home. Talk about how buyers notice the garage first and a clean one signals a well-maintained property. This homeowner just increased their home's appeal and resale value with one transformation.",
  "CASH BACK angle: During the cleanup they found gear, tools, and equipment worth hundreds of dollars. Some of it went on Facebook Marketplace, some to a consignment shop. The garage transformation literally paid for part of itself. Talk about the money they made back.",
  "STOP REBUYING angle: This homeowner used to rebuy things they already owned because they couldn't find anything. Duplicate tools, extra holiday lights, three sets of the same screws. Now everything has a spot and they're saving money every month without even trying.",

  // --- GIVING BACK ---
  "DONATION angle: The best part of this cleanup was the six bags of stuff that went straight to Goodwill. Clothes the kids outgrew, sports equipment they never used, perfectly good items that will help another family. Decluttering feels even better when it helps someone else.",

  // --- ORGANIZATION & DAILY LIFE ---
  "PARKING INSIDE angle: No more scraping ice at 6 AM in a Denver winter. No more worrying about hail season. This homeowner parks inside their garage again for the first time in years. It changed their entire morning routine and they wonder why they waited so long.",
  "MORNING ROUTINE angle: The homeowner's morning used to start with stress — stepping over boxes, searching for keys, tripping on shoes. Now they walk through a clean garage to their car and start the day calm. Talk about how the first five minutes of your day set the tone for everything.",
  "SEASONAL STORAGE angle: Winter gear, summer toys, camping equipment, sports stuff — all labeled and easy to find when the season changes. No more digging through piles to find the right bin. This homeowner is ready for whatever Colorado throws at them. Do NOT mention specific holidays or seasons — keep it general about being prepared year-round.",
  "EVERYTHING HAS A HOME angle: Every tool on a pegboard, every bin labeled, every shelf with a purpose. The homeowner said the most satisfying thing is that nothing ends up on the floor anymore. When everything has a spot, putting things away takes seconds instead of being a chore.",

  // --- CONFIDENCE & LIFESTYLE ---
  "CONFIDENCE angle: This homeowner used to rush guests past the garage. Now they actually show it off. A clean organized space makes the whole house feel more put together and gave them a sense of pride they didn't expect from a garage.",
  "DOMINO EFFECT angle: It started with the garage and then they organized the closets, then the basement. A clean garage kicked off a whole lifestyle shift. Talk about how one transformation inspired them to level up the rest of their home.",
  "COUPLE'S PROJECT SPACE angle: The garage became a workshop where the homeowner and their partner build things together. Weekend projects, refinishing furniture, finally having space to work on hobbies side by side. The garage went from dead space to their favorite room.",
  "SAFETY angle: There were tripping hazards everywhere, heavy boxes stacked dangerously, and the kids couldn't walk through without bumping into something. Now it's safe, clear paths, nothing falling off shelves, and the family doesn't worry about someone getting hurt in there.",
];

const DEFAULT_CAPTION_PROMPT = `You are writing a real Instagram/Facebook caption for Garage Scholars, a Denver garage transformation company run by college students. This is a before-and-after photo post.

JOB: {jobTitle} in {location} ({packageTier} package)

Write it like a real person — professional but warm, the kind of caption a sharp small business owner posts when they're genuinely proud of the work.

YOUR STORY ANGLE FOR THIS POST (you MUST use this specific angle):
{storyAngle}

Weave this angle into the caption naturally. Tell a mini story or paint a vivid picture of the homeowner's life after the transformation. Do NOT list multiple benefits — go deep on this one angle.

{avoidSection}

STRICT FORMATTING RULES (violating these is an error):
- NEVER use asterisks, bold, italic, underscores, or any markdown/formatting characters
- NEVER use bullet points, numbered lists, or dashes as list items
- NEVER use quotation marks around phrases for emphasis
- NEVER use ALL CAPS for emphasis (hashtags excluded)
- Write in plain conversational text only — exactly how it would appear on Instagram
- Do NOT start with "Just" or "Another" or "Imagine" — vary your openings every time

CONTENT GUIDELINES:
- 2-3 short paragraphs, written naturally
- Mention the scholars (college students doing the work) casually — it's a differentiator
- Never trash-talk the "before" — focus on what's possible now
- End with a clear call-to-action (link in bio, DM us, book a consultation, etc.)
- Add 8-12 hashtags at the very end on their own line
- 1-2 emojis max, placed naturally
- Mention Denver area when it fits
- Keep under 250 words

HASHTAGS TO MIX FROM:
#GarageOrganization #GarageTransformation #DenverHome #GarageScholars #BeforeAndAfter #HomeOrganization #GarageMakeover #Denver #Colorado #OrganizedGarage #DeclutterYourLife #GarageGoals #ClearSpaceClearMind #HealthyHome

Output ONLY the caption text. No labels, no headers, no extra formatting. Plain text + hashtags.`;

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
    // Theme 1: Deep Black + Emerald — signature brand look
    name: "emerald",
    bg: { r: 9, g: 9, b: 11 },
    bgHex: "#09090b",
    accent: "#10b981",       // emerald-500
    labelBg: "rgba(9,9,11,0.85)",
    tagline: "#6ee7b7",      // emerald-300
  },
  {
    // Theme 2: Navy Blue + Teal — stands out with blue undertone
    name: "teal",
    bg: { r: 12, g: 30, b: 58 },
    bgHex: "#0c1e3a",
    accent: "#14b8a6",       // teal-500 (app primary)
    labelBg: "rgba(12,30,58,0.85)",
    tagline: "#5eead4",      // teal-300
  },
  {
    // Theme 3: Dark Olive + Gold — warm premium feel, noticeably different
    name: "gold",
    bg: { r: 28, g: 25, b: 12 },
    bgHex: "#1c190c",
    accent: "#d4a843",       // warm gold
    labelBg: "rgba(28,25,12,0.85)",
    tagline: "#fbbf24",      // amber-400
  },
  {
    // Theme 4: Forest Green + Bright Green — bold green-on-green
    name: "green",
    bg: { r: 8, g: 28, b: 14 },
    bgHex: "#081c0e",
    accent: "#22c55e",       // green-500
    labelBg: "rgba(8,28,14,0.85)",
    tagline: "#86efac",      // green-300
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

// ─── Convert hex color to RGB object for Sharp ───
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
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

  // Create accent-colored base canvas (visible border/outline around the whole image)
  const accentRgb = hexToRgb(t.accent);
  const base = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: accentRgb,
    },
  })
    .jpeg()
    .toBuffer();

  // Dark inner fill so the border is the accent color outline
  const innerFill = Buffer.from(`
    <svg width="${INNER}" height="${INNER}">
      <rect width="${INNER}" height="${INNER}" fill="${t.bgHex}"/>
    </svg>
  `);

  // Composite everything
  const result = await sharp(base)
    .composite([
      { input: innerFill, left: BORDER, top: BORDER },
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

// ─── Get next story angle + last caption from Firestore ───
async function getNextCaptionAngle(): Promise<{ angle: string; lastCaption: string }> {
  const configRef = db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("socialMediaCaption");
  try {
    const snap = await configRef.get();
    const lastIndex = snap.exists ? (snap.data()?.lastAngleIndex ?? -1) as number : -1;
    const lastCaption = snap.exists ? (snap.data()?.lastCaption ?? "") as string : "";
    const nextIndex = (lastIndex + 1) % CAPTION_ANGLES.length;
    await configRef.set({
      lastAngleIndex: nextIndex,
      lastAngleName: `angle_${nextIndex}`,
    }, { merge: true });
    return { angle: CAPTION_ANGLES[nextIndex], lastCaption };
  } catch {
    return { angle: CAPTION_ANGLES[0], lastCaption: "" };
  }
}

// ─── Save last caption to Firestore so next post can avoid repeating ───
async function saveLastCaption(caption: string) {
  try {
    await db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("socialMediaCaption").set(
      { lastCaption: caption.substring(0, 500) },
      { merge: true },
    );
  } catch {
    // Non-critical
  }
}

// ─── Generate caption using Gemini ───
async function generateCaption(
  jobTitle: string,
  address: string,
  packageTier: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // Get the next story angle and last caption for context
  const { angle, lastCaption } = await getNextCaptionAngle();
  console.log(`Caption angle: ${angle.substring(0, 60)}...`);

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

  // Build avoidance section from last caption
  const avoidSection = lastCaption
    ? `IMPORTANT — DO NOT repeat the previous post. Here is the last caption we posted (write something COMPLETELY different — different opening, different story, different vibe):\n---\n${lastCaption}\n---`
    : "";

  const prompt = promptTemplate
    .replace("{jobTitle}", jobTitle || "Garage Transformation")
    .replace("{location}", location)
    .replace("{packageTier}", packageTier || "Standard")
    .replace("{storyAngle}", angle)
    .replace("{avoidSection}", avoidSection);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  let text = result.response.text()?.trim() || "Another garage transformed! #GarageScholars";

  // Strip AI formatting artifacts that slip through despite prompt instructions
  text = text
    .replace(/\*\*/g, "")        // Remove bold markdown **
    .replace(/(?<!\w)\*(?!\*)/g, "") // Remove stray single asterisks
    .replace(/__/g, "")          // Remove underline markdown __
    .replace(/(?<!\w)_(?!_)/g, (match, offset, str) => {
      // Keep underscores inside words/hashtags, remove emphasis underscores
      const before = str[offset - 1];
      const after = str[offset + 1];
      if (before && /\w/.test(before)) return match;
      if (after && /\w/.test(after)) return "";
      return match;
    })
    .replace(/^#{1,6}\s+/gm, "") // Remove markdown headers
    .replace(/^[-•]\s+/gm, "")   // Remove bullet points
    .replace(/^\d+\.\s+/gm, "")  // Remove numbered lists
    .trim();

  // Save this caption so the next post knows what to avoid
  await saveLastCaption(text);

  return text;
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

