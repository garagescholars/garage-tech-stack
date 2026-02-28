"use strict";
/**
 * Garage Scholars — Auto Social Media Content
 *
 * Processes completed job photos into premium before/after composites,
 * auto-enhances images with Sharp, generates AI captions with Gemini,
 * and posts to Facebook + Instagram — fully automated, zero manual work.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gsRefreshMetaToken = exports.gsProcessSocialContent = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const generative_ai_1 = require("@google/generative-ai");
const sharp_1 = __importDefault(require("sharp"));
const gs_constants_1 = require("./gs-constants");
const gs_notifications_1 = require("./gs-notifications");
const db = (0, firestore_1.getFirestore)();
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
const MIN_FILE_SIZE = 10000; // 10 KB — reject corrupt/blank images
const MAX_RETRY_ATTEMPTS = 3;
const MIN_CAPTION_LENGTH = 50;
// ─── Validate a source photo before processing ───
async function validatePhoto(buffer, label) {
    if (buffer.length < MIN_FILE_SIZE) {
        return { valid: false, reason: `${label} photo too small (${buffer.length} bytes) — likely corrupt` };
    }
    try {
        const metadata = await (0, sharp_1.default)(buffer).metadata();
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
    }
    catch {
        return { valid: false, reason: `${label} photo could not be read by Sharp — invalid format` };
    }
}
// ─── Validate a generated caption ───
function validateCaption(caption) {
    if (!caption || caption.trim().length < MIN_CAPTION_LENGTH) {
        return { valid: false, reason: `Caption too short (${caption?.length || 0} chars, min ${MIN_CAPTION_LENGTH})` };
    }
    if (!caption.includes("#")) {
        return { valid: false, reason: "Caption missing hashtags" };
    }
    return { valid: true };
}
// ─── Alert admin on persistent failures ───
async function alertAdminFailure(jobId, error, attempts) {
    try {
        const adminsSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES)
            .where("role", "==", "admin")
            .limit(3)
            .get();
        const emails = adminsSnap.docs
            .map((d) => d.data().email)
            .filter(Boolean);
        if (emails.length > 0) {
            await (0, gs_notifications_1.sendEmail)(emails, `Social Media Post Failed (${attempts} attempts) — Job ${jobId}`, `<p>The automated social media post for job <strong>${jobId}</strong> has failed <strong>${attempts}</strong> times.</p>
         <p><strong>Error:</strong> ${error}</p>
         <p>The item has been marked as permanently failed. Check the <code>gs_socialContentQueue</code> collection for details.</p>`);
        }
    }
    catch (err) {
        console.error("Failed to send admin alert:", err);
    }
}
// ─── Auto-enhance a cell phone photo using Sharp ───
async function enhancePhoto(buffer) {
    try {
        return await (0, sharp_1.default)(buffer)
            .rotate() // Fix EXIF orientation
            .normalize() // Auto-level histogram
            .sharpen({ sigma: 1.0, m1: 1.0, m2: 2.0 }) // Gentle sharpening
            .modulate({ brightness: 1.05, saturation: 1.12 }) // Subtle pop
            .gamma(1.1) // Lift shadows
            .toBuffer();
    }
    catch (err) {
        console.warn("Photo enhancement failed, using original:", err);
        return buffer;
    }
}
const COLOR_THEMES = [
    {
        // Theme 1: Deep Black + Emerald — signature brand look
        name: "emerald",
        bg: { r: 9, g: 9, b: 11 },
        bgHex: "#09090b",
        accent: "#10b981", // emerald-500
        labelBg: "rgba(9,9,11,0.85)",
        tagline: "#6ee7b7", // emerald-300
    },
    {
        // Theme 2: Navy Blue + Teal — stands out with blue undertone
        name: "teal",
        bg: { r: 12, g: 30, b: 58 },
        bgHex: "#0c1e3a",
        accent: "#14b8a6", // teal-500 (app primary)
        labelBg: "rgba(12,30,58,0.85)",
        tagline: "#5eead4", // teal-300
    },
    {
        // Theme 3: Dark Olive + Gold — warm premium feel, noticeably different
        name: "gold",
        bg: { r: 28, g: 25, b: 12 },
        bgHex: "#1c190c",
        accent: "#d4a843", // warm gold
        labelBg: "rgba(28,25,12,0.85)",
        tagline: "#fbbf24", // amber-400
    },
    {
        // Theme 4: Forest Green + Bright Green — bold green-on-green
        name: "green",
        bg: { r: 8, g: 28, b: 14 },
        bgHex: "#081c0e",
        accent: "#22c55e", // green-500
        labelBg: "rgba(8,28,14,0.85)",
        tagline: "#86efac", // green-300
    },
];
// ─── Fixed themes for resale, donation, gym (no rotation) ───
const RESALE_THEME = {
    name: "resale-amber",
    bg: { r: 45, g: 20, b: 5 },
    bgHex: "#2d1405",
    accent: "#f59e0b",
    labelBg: "rgba(45,20,5,0.85)",
    tagline: "#fcd34d",
};
const DONATION_THEME = {
    name: "donation-violet",
    bg: { r: 30, g: 10, b: 45 },
    bgHex: "#1e0a2d",
    accent: "#a855f7",
    labelBg: "rgba(30,10,45,0.85)",
    tagline: "#c084fc",
};
const GYM_THEME = {
    name: "gym-crimson",
    bg: { r: 40, g: 8, b: 8 },
    bgHex: "#280808",
    accent: "#ef4444",
    labelBg: "rgba(40,8,8,0.85)",
    tagline: "#fca5a5",
};
// ─── Caption angles for resale posts ───
const RESALE_CAPTION_ANGLES = [
    "CASH BACK angle: Got the customer money back by selling items found during their garage cleanup. Talk about the surprise of finding value in clutter and how the garage transformation literally put money back in their pocket.",
    "HIDDEN VALUE angle: They had no idea that old piece of equipment was worth real money. Paint a picture of the discovery moment during the cleanup and the customer's reaction when they found out what it was worth.",
    "DECLUTTER PROFIT angle: Turned years of clutter into actual cash while organizing their space. Focus on how decluttering does not have to mean throwing things away — someone else wanted exactly what was collecting dust.",
    "SMART SELLER angle: Instead of throwing it away we helped them list it and someone bought it same week. Emphasize the speed and ease of resale when you have the right system.",
    "MONEY FOUND angle: That dusty equipment collecting cobwebs in the corner? Someone else was searching for it online. Talk about supply and demand and hidden garage treasures.",
    "SECOND LIFE angle: This item sat unused for years and now it has a new owner who actually uses it every day. Tell the story of the item's journey from forgotten to loved again.",
    "WIN-WIN angle: Customer got their garage back AND money in their pocket. Paint the picture of a double victory — space plus cash.",
    "TREASURE HUNT angle: You never know what valuables are buried under years of garage clutter. Tell the story like an adventure of discovery during the cleanup.",
    "UPGRADE FUND angle: Sold the old gear and now they are putting it toward an upgrade. Talk about how selling the old made room and funded the new.",
    "SURPRISE PAYOUT angle: Customer did not expect to make money from a garage cleanup. Focus on the pleasant surprise factor.",
    "MARKETPLACE MAGIC angle: Listed it and sold it fast. Customer walked away smiling with cash in hand and a clean garage.",
    "SPRING CLEANING CASH [SEASONAL: March-May]: Spring cleaning does not have to cost money — it can actually pay you.",
    "HOLIDAY BUDGET BOOST [SEASONAL: November-December]: Extra cash right before the holidays from selling unused garage items.",
    "NEW YEAR FRESH START [SEASONAL: January-February]: Starting the year organized AND with money back from resale.",
    "BACK TO SCHOOL FUND [SEASONAL: July-August]: Sold unused garage items to help with back to school costs.",
];
// ─── Caption angles for donation posts ───
const DONATION_CAPTION_ANGLES = [
    "GIVING BACK angle: The best part of organizing is finding things to give to someone who needs them. Tell a warm story about the joy of donating during a garage cleanup.",
    "COMMUNITY IMPACT angle: These items are heading to families in our community who can really use them. Focus on the local Denver impact.",
    "PAYING IT FORWARD angle: One family's clutter became another family's blessing. Paint the picture of generosity flowing from one home to another.",
    "CLEAN HEART angle: Their garage is clean and their heart is full knowing items found new homes. Focus on the emotional satisfaction of donating.",
    "PURPOSE angle: Every donated item has a story and now it gets to start a new chapter with someone who needs it.",
    "LOCAL LOVE angle: Donated right here in Denver to neighbors who needed it most. Emphasize the local community connection.",
    "LIGHTEN THE LOAD angle: Sometimes letting go of stuff is the most freeing feeling there is. Focus on the lightness and relief.",
    "KIDS ITEMS angle: Those outgrown toys and clothes are now making another kid's day. Tell a touching story about children's items finding new owners.",
    "FULL CIRCLE angle: They received help once and now they are giving back through donations. Tell a story of gratitude coming full circle.",
    "WARMTH angle: Coats, blankets, and gear donated just when someone needed them most. Paint a picture of warmth reaching someone in need.",
    "GARAGE TO GOOD angle: From taking up space in a garage to making a real difference in someone's life.",
    "HOLIDAY GIVING [SEASONAL: November-December]: Spreading warmth this holiday season with generous donations from a garage transformation.",
    "SPRING FORWARD [SEASONAL: March-May]: Spring cleaning with a purpose — donating to those in need while organizing your space.",
    "BACK TO SCHOOL GIVING [SEASONAL: July-August]: Backpacks, supplies, and clothes donated for kids heading back to school.",
    "WINTER WARMTH [SEASONAL: November-February]: Warm clothes and gear donated as temperatures drop in Denver.",
];
// ─── Caption angles for gym install posts ───
const GYM_INSTALL_CAPTION_ANGLES = [
    "HOME GYM DREAM angle: They talked about building a home gym for years and today it finally happened. Paint the picture of a dream becoming reality.",
    "NO EXCUSES angle: The gym is 10 steps away now. No commute, no membership, no excuses. Focus on the convenience of a home gym.",
    "FAMILY FITNESS angle: The whole family works out together now right in their own garage. Tell the story of a family getting fit together.",
    "MORNING WORKOUT angle: First thing every morning they walk into their garage and start training. Paint the picture of a transformed morning routine.",
    "INVESTMENT angle: A home gym pays for itself. No monthly fees and it is always open. Talk about the financial wisdom of building at home.",
    "TRANSFORMATION SPACE angle: This garage went from storage chaos to a legit training facility. Focus on the dramatic transformation.",
    "CUSTOM BUILD angle: Every piece of equipment placed exactly where they wanted it. Emphasize the personalization of the layout.",
    "GARAGE TO GYM angle: Same four walls but a completely different purpose now. Tell the story of a space reborn with new energy.",
    "STRENGTH AT HOME angle: Heavy lifts in their own space. No waiting for equipment and no distractions. Paint the picture of focused training.",
    "MENTAL HEALTH angle: Their daily workout routine changed everything and now the gym is always available. Connect the gym to mental wellness.",
    "COUPLE GOALS angle: They built this gym together and now they train together every morning. Tell the story of partnership through fitness.",
    "NEW YEAR NEW GYM [SEASONAL: January-February]: New year resolution made real with a home gym they will actually use.",
    "SUMMER BODY [SEASONAL: May-July]: Getting ready for summer with a home gym right in the garage.",
    "HOLIDAY GIFT [SEASONAL: November-December]: The best gift this year was a home gym for the whole family.",
    "BACK TO ROUTINE [SEASONAL: August-September]: Kids are back in school and this parent finally has time to train at home.",
];
// ─── Seasonal tag parsing ───
function isAngleInSeason(angle) {
    const match = angle.match(/\[SEASONAL:\s*(\w+)-(\w+)\]/);
    if (!match)
        return true; // Non-seasonal = always available
    const months = {
        January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
        July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
    };
    const start = months[match[1]];
    const end = months[match[2]];
    const current = new Date().getMonth() + 1;
    if (!start || !end)
        return true;
    if (start <= end) {
        return current >= start && current <= end;
    }
    // Wraps around (e.g., November-February)
    return current >= start || current <= end;
}
// ─── Get next caption angle for a specific content type with seasonal filtering ───
async function getNextTypedCaptionAngle(configDocName, angles) {
    const configRef = db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc(configDocName);
    try {
        const snap = await configRef.get();
        const lastIndex = snap.exists ? (snap.data()?.lastAngleIndex ?? -1) : -1;
        const lastCaption = snap.exists ? (snap.data()?.lastCaption ?? "") : "";
        // Find next in-season angle
        let nextIndex = (lastIndex + 1) % angles.length;
        let attempts = 0;
        while (!isAngleInSeason(angles[nextIndex]) && attempts < angles.length) {
            nextIndex = (nextIndex + 1) % angles.length;
            attempts++;
        }
        await configRef.set({
            lastAngleIndex: nextIndex,
            lastAngleName: `angle_${nextIndex}`,
        }, { merge: true });
        // Strip the seasonal tag from the angle text
        const cleanAngle = angles[nextIndex].replace(/\s*\[SEASONAL:[^\]]+\]/, "");
        return { angle: cleanAngle, lastCaption };
    }
    catch {
        return { angle: angles[0].replace(/\s*\[SEASONAL:[^\]]+\]/, ""), lastCaption: "" };
    }
}
async function saveTypedLastCaption(configDocName, caption) {
    try {
        await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc(configDocName).set({ lastCaption: caption.substring(0, 500) }, { merge: true });
    }
    catch {
        // Non-critical
    }
}
// Determine which theme to use based on rotating index stored in Firestore
async function getNextColorTheme() {
    const configRef = db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("socialMediaTheme");
    try {
        const snap = await configRef.get();
        const lastIndex = snap.exists ? (snap.data()?.lastThemeIndex ?? -1) : -1;
        const nextIndex = (lastIndex + 1) % COLOR_THEMES.length;
        await configRef.set({ lastThemeIndex: nextIndex, lastThemeName: COLOR_THEMES[nextIndex].name }, { merge: true });
        return COLOR_THEMES[nextIndex];
    }
    catch {
        return COLOR_THEMES[0]; // Fallback to emerald
    }
}
// ─── Convert hex color to RGB object for Sharp ───
function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
    };
}
// ─── Create premium before/after composite (1080x1080 Instagram square) ───
async function createCompositeImage(beforeBuffer, afterBuffer, theme) {
    const t = theme || COLOR_THEMES[0];
    const CANVAS = 1080;
    const BORDER = 8;
    const INNER = CANVAS - BORDER * 2; // 1064
    const DIVIDER_WIDTH = 6;
    const IMG_WIDTH = Math.floor((INNER - DIVIDER_WIDTH) / 2); // 529
    const IMG_HEIGHT = 904;
    // Enhance both photos
    const [enhancedBefore, enhancedAfter] = await Promise.all([
        enhancePhoto(beforeBuffer),
        enhancePhoto(afterBuffer),
    ]);
    // Resize to fill their slots (cover crop, center)
    const [beforeResized, afterResized] = await Promise.all([
        (0, sharp_1.default)(enhancedBefore)
            .resize(IMG_WIDTH, IMG_HEIGHT, { fit: "cover", position: "centre" })
            .jpeg({ quality: 92 })
            .toBuffer(),
        (0, sharp_1.default)(enhancedAfter)
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
    const base = await (0, sharp_1.default)({
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
    const result = await (0, sharp_1.default)(base)
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
// ─── Create resale composite (4-photo grid, 1080x1080) ───
async function createResaleComposite(photoBuffers, itemName, theme) {
    const CANVAS = 1080;
    const BORDER = 8;
    const INNER = CANVAS - BORDER * 2;
    // Layout: 2x2 grid with brand bar at bottom
    const GRID_GAP = 4;
    const BRAND_BAR_HEIGHT = 140;
    const GRID_HEIGHT = INNER - BRAND_BAR_HEIGHT - 2;
    const CELL_W = Math.floor((INNER - GRID_GAP) / 2);
    const CELL_H = Math.floor((GRID_HEIGHT - GRID_GAP) / 2);
    // Enhance and resize all photos to grid cells
    const cells = [];
    for (let i = 0; i < 4; i++) {
        const buf = photoBuffers[i] || photoBuffers[0];
        const enhanced = await enhancePhoto(buf);
        cells.push(await (0, sharp_1.default)(enhanced)
            .resize(CELL_W, CELL_H, { fit: "cover", position: "centre" })
            .jpeg({ quality: 92 })
            .toBuffer());
    }
    // Labels for each cell
    const labels = ["FRONT", "SIDE", "BACK", "FULL VIEW"];
    const labelHeight = 32;
    const labelSvgs = labels.map((label) => Buffer.from(`<svg width="${CELL_W}" height="${labelHeight}">
      <rect width="${CELL_W}" height="${labelHeight}" fill="${theme.labelBg}"/>
      <text x="${CELL_W / 2}" y="22" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="14" font-weight="700" letter-spacing="3" fill="#ffffff">${label}</text>
    </svg>`));
    // Escape item name for SVG (handle special chars)
    const safeName = (itemName || "ITEM").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 40);
    // Brand bar
    const brandBar = Buffer.from(`
    <svg width="${INNER}" height="${BRAND_BAR_HEIGHT}">
      <rect width="${INNER}" height="${BRAND_BAR_HEIGHT}" fill="${theme.bgHex}"/>
      <rect x="${(INNER - 120) / 2}" y="14" width="120" height="2" fill="${theme.accent}"/>
      <text x="${INNER / 2}" y="46" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="24" font-weight="700" letter-spacing="5" fill="${theme.accent}">GARAGE SCHOLARS</text>
      <text x="${INNER / 2}" y="74" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="16" font-weight="600" letter-spacing="2" fill="${theme.tagline}">SOLD BY GARAGE SCHOLARS</text>
      <text x="${INNER / 2}" y="104" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="14" letter-spacing="1" fill="#ffffff">${safeName}</text>
    </svg>
  `);
    const horizontalDivider = Buffer.from(`<svg width="${INNER}" height="2"><rect width="${INNER}" height="2" fill="${theme.accent}"/></svg>`);
    const accentRgb = hexToRgb(theme.accent);
    const base = await (0, sharp_1.default)({ create: { width: CANVAS, height: CANVAS, channels: 3, background: accentRgb } }).jpeg().toBuffer();
    const innerFill = Buffer.from(`<svg width="${INNER}" height="${INNER}"><rect width="${INNER}" height="${INNER}" fill="${theme.bgHex}"/></svg>`);
    const result = await (0, sharp_1.default)(base)
        .composite([
        { input: innerFill, left: BORDER, top: BORDER },
        // Row 1
        { input: cells[0], left: BORDER, top: BORDER },
        { input: labelSvgs[0], left: BORDER, top: BORDER + CELL_H - labelHeight },
        { input: cells[1], left: BORDER + CELL_W + GRID_GAP, top: BORDER },
        { input: labelSvgs[1], left: BORDER + CELL_W + GRID_GAP, top: BORDER + CELL_H - labelHeight },
        // Row 2
        { input: cells[2], left: BORDER, top: BORDER + CELL_H + GRID_GAP },
        { input: labelSvgs[2], left: BORDER, top: BORDER + CELL_H + GRID_GAP + CELL_H - labelHeight },
        { input: cells[3], left: BORDER + CELL_W + GRID_GAP, top: BORDER + CELL_H + GRID_GAP },
        { input: labelSvgs[3], left: BORDER + CELL_W + GRID_GAP, top: BORDER + CELL_H + GRID_GAP + CELL_H - labelHeight },
        // Divider + brand bar
        { input: horizontalDivider, left: BORDER, top: BORDER + GRID_HEIGHT },
        { input: brandBar, left: BORDER, top: BORDER + GRID_HEIGHT + 2 },
    ])
        .jpeg({ quality: 93 })
        .toBuffer();
    return result;
}
// ─── Create donation composite (2-photo layout, 1080x1080) ───
async function createDonationComposite(photoBuffers, theme) {
    const CANVAS = 1080;
    const BORDER = 8;
    const INNER = CANVAS - BORDER * 2;
    const BRAND_BAR_HEIGHT = 140;
    const IMG_HEIGHT = INNER - BRAND_BAR_HEIGHT - 2;
    const DIVIDER = 4;
    // Left image (larger) = 65%, right image = 35%
    const LEFT_W = Math.floor((INNER - DIVIDER) * 0.65);
    const RIGHT_W = INNER - LEFT_W - DIVIDER;
    const [buf1, buf2] = [photoBuffers[0], photoBuffers[1] || photoBuffers[0]];
    const [enhanced1, enhanced2] = await Promise.all([enhancePhoto(buf1), enhancePhoto(buf2)]);
    const leftImg = await (0, sharp_1.default)(enhanced1).resize(LEFT_W, IMG_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
    const rightImg = await (0, sharp_1.default)(enhanced2).resize(RIGHT_W, IMG_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
    const labelHeight = 36;
    const leftLabel = Buffer.from(`<svg width="${LEFT_W}" height="${labelHeight}">
    <rect width="${LEFT_W}" height="${labelHeight}" fill="${theme.labelBg}"/>
    <text x="${LEFT_W / 2}" y="25" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
          font-size="16" font-weight="700" letter-spacing="3" fill="#ffffff">DONATED ITEMS</text>
  </svg>`);
    const rightLabel = Buffer.from(`<svg width="${RIGHT_W}" height="${labelHeight}">
    <rect width="${RIGHT_W}" height="${labelHeight}" fill="${theme.labelBg}"/>
    <text x="${RIGHT_W / 2}" y="25" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
          font-size="14" font-weight="700" letter-spacing="2" fill="#ffffff">DETAILS</text>
  </svg>`);
    const brandBar = Buffer.from(`
    <svg width="${INNER}" height="${BRAND_BAR_HEIGHT}">
      <rect width="${INNER}" height="${BRAND_BAR_HEIGHT}" fill="${theme.bgHex}"/>
      <rect x="${(INNER - 120) / 2}" y="14" width="120" height="2" fill="${theme.accent}"/>
      <text x="${INNER / 2}" y="46" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="24" font-weight="700" letter-spacing="5" fill="${theme.accent}">GARAGE SCHOLARS</text>
      <text x="${INNER / 2}" y="74" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="16" font-weight="600" letter-spacing="2" fill="${theme.tagline}">DONATED WITH PURPOSE</text>
    </svg>
  `);
    const horizontalDivider = Buffer.from(`<svg width="${INNER}" height="2"><rect width="${INNER}" height="2" fill="${theme.accent}"/></svg>`);
    const accentRgb = hexToRgb(theme.accent);
    const base = await (0, sharp_1.default)({ create: { width: CANVAS, height: CANVAS, channels: 3, background: accentRgb } }).jpeg().toBuffer();
    const innerFill = Buffer.from(`<svg width="${INNER}" height="${INNER}"><rect width="${INNER}" height="${INNER}" fill="${theme.bgHex}"/></svg>`);
    const result = await (0, sharp_1.default)(base)
        .composite([
        { input: innerFill, left: BORDER, top: BORDER },
        { input: leftImg, left: BORDER, top: BORDER },
        { input: leftLabel, left: BORDER, top: BORDER + IMG_HEIGHT - labelHeight },
        { input: rightImg, left: BORDER + LEFT_W + DIVIDER, top: BORDER },
        { input: rightLabel, left: BORDER + LEFT_W + DIVIDER, top: BORDER + IMG_HEIGHT - labelHeight },
        { input: horizontalDivider, left: BORDER, top: BORDER + IMG_HEIGHT },
        { input: brandBar, left: BORDER, top: BORDER + IMG_HEIGHT + 2 },
    ])
        .jpeg({ quality: 93 })
        .toBuffer();
    return result;
}
// ─── Create gym install composite (hero + 2 thumbnails, 1080x1080) ───
async function createGymComposite(photoBuffers, equipmentName, theme) {
    const CANVAS = 1080;
    const BORDER = 8;
    const INNER = CANVAS - BORDER * 2;
    const BRAND_BAR_HEIGHT = 140;
    const GAP = 4;
    // Hero image takes 65% of height, thumbnails take remaining
    const HERO_HEIGHT = Math.floor((INNER - BRAND_BAR_HEIGHT - 2 - GAP) * 0.65);
    const THUMB_HEIGHT = INNER - BRAND_BAR_HEIGHT - 2 - GAP - HERO_HEIGHT;
    const heroBuffer = await enhancePhoto(photoBuffers[0]);
    const heroImg = await (0, sharp_1.default)(heroBuffer).resize(INNER, HERO_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
    // Bottom row: 2 thumbnails side by side
    const THUMB_W = Math.floor((INNER - GAP) / 2);
    const thumbs = [];
    for (let i = 1; i <= 2; i++) {
        const buf = photoBuffers[i] || photoBuffers[0];
        const enhanced = await enhancePhoto(buf);
        thumbs.push(await (0, sharp_1.default)(enhanced).resize(THUMB_W, THUMB_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer());
    }
    // Labels
    const heroLabel = Buffer.from(`<svg width="${INNER}" height="36">
    <rect width="${INNER}" height="36" fill="${theme.labelBg}"/>
    <text x="${INNER / 2}" y="25" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
          font-size="16" font-weight="700" letter-spacing="3" fill="#ffffff">HOME GYM INSTALLED</text>
  </svg>`);
    const safeEquipment = (equipmentName || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 45);
    const brandBar = Buffer.from(`
    <svg width="${INNER}" height="${BRAND_BAR_HEIGHT}">
      <rect width="${INNER}" height="${BRAND_BAR_HEIGHT}" fill="${theme.bgHex}"/>
      <rect x="${(INNER - 120) / 2}" y="14" width="120" height="2" fill="${theme.accent}"/>
      <text x="${INNER / 2}" y="46" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="24" font-weight="700" letter-spacing="5" fill="${theme.accent}">GARAGE SCHOLARS</text>
      <text x="${INNER / 2}" y="74" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="16" font-weight="600" letter-spacing="2" fill="${theme.tagline}">HOME GYM BUILT</text>
      ${safeEquipment ? `<text x="${INNER / 2}" y="104" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif"
            font-size="13" letter-spacing="1" fill="#ffffff">${safeEquipment}</text>` : ""}
    </svg>
  `);
    const horizontalDivider = Buffer.from(`<svg width="${INNER}" height="2"><rect width="${INNER}" height="2" fill="${theme.accent}"/></svg>`);
    const accentRgb = hexToRgb(theme.accent);
    const base = await (0, sharp_1.default)({ create: { width: CANVAS, height: CANVAS, channels: 3, background: accentRgb } }).jpeg().toBuffer();
    const innerFill = Buffer.from(`<svg width="${INNER}" height="${INNER}"><rect width="${INNER}" height="${INNER}" fill="${theme.bgHex}"/></svg>`);
    const thumbTop = BORDER + HERO_HEIGHT + GAP;
    const result = await (0, sharp_1.default)(base)
        .composite([
        { input: innerFill, left: BORDER, top: BORDER },
        { input: heroImg, left: BORDER, top: BORDER },
        { input: heroLabel, left: BORDER, top: BORDER + HERO_HEIGHT - 36 },
        { input: thumbs[0], left: BORDER, top: thumbTop },
        { input: thumbs[1], left: BORDER + THUMB_W + GAP, top: thumbTop },
        { input: horizontalDivider, left: BORDER, top: thumbTop + THUMB_HEIGHT },
        { input: brandBar, left: BORDER, top: thumbTop + THUMB_HEIGHT + 2 },
    ])
        .jpeg({ quality: 93 })
        .toBuffer();
    return result;
}
// ─── Generate caption for a specific content type ───
async function generateTypedCaption(contentType, jobTitle, address, packageTier, itemName) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error("GEMINI_API_KEY not configured");
    let angles;
    let configDoc;
    let contentDescription;
    let extraHashtags;
    switch (contentType) {
        case "resale":
            angles = RESALE_CAPTION_ANGLES;
            configDoc = "socialMediaResaleCaption";
            contentDescription = `This is a RESALE post. The item "${itemName || "item"}" was found during a garage cleanup and sold to get money back for the customer.`;
            extraHashtags = "#ResaleValue #DeclutterAndEarn #GarageTreasure #MakeMoneyDecluttering #SellYourStuff";
            break;
        case "donation":
            angles = DONATION_CAPTION_ANGLES;
            configDoc = "socialMediaDonationCaption";
            contentDescription = `This is a DONATION post. Items were donated to charity during a garage transformation, giving back to the community.`;
            extraHashtags = "#DonateLocal #GivingBack #CommunityImpact #DeclutterForGood #PayItForward";
            break;
        case "gym_install":
            angles = GYM_INSTALL_CAPTION_ANGLES;
            configDoc = "socialMediaGymCaption";
            contentDescription = `This is a HOME GYM INSTALLATION post. ${itemName ? `Equipment installed: ${itemName}.` : ""} A home gym was built in the customer's garage or home.`;
            extraHashtags = "#HomeGym #GarageGym #GymSetup #HomeWorkout #FitnessAtHome #GymLife";
            break;
        default:
            // Fall back to existing before/after system
            return await generateCaption(jobTitle, address, packageTier);
    }
    const { angle, lastCaption } = await getNextTypedCaptionAngle(configDoc, angles);
    console.log(`${contentType} caption angle: ${angle.substring(0, 60)}...`);
    const location = address ? address.split(",").slice(-2, -1)[0]?.trim() || "Denver" : "Denver";
    const avoidSection = lastCaption
        ? `IMPORTANT — DO NOT repeat the previous post. Here is the last caption we posted (write something COMPLETELY different):\n---\n${lastCaption}\n---`
        : "";
    const prompt = `You are writing a real Instagram/Facebook caption for Garage Scholars, a Denver garage transformation company run by college students. ${contentDescription}

JOB: ${jobTitle || "Garage Transformation"} in ${location} (${packageTier || "Standard"} package)

YOUR STORY ANGLE FOR THIS POST (you MUST use this specific angle):
${angle}

Weave this angle into the caption naturally. Tell a mini story or paint a vivid picture. Do NOT list multiple benefits — go deep on this one angle.

${avoidSection}

STRICT FORMATTING RULES:
- NEVER use asterisks, bold, italic, underscores, or any markdown/formatting characters
- NEVER use bullet points, numbered lists, or dashes as list items
- Write in plain conversational text only
- Do NOT start with "Just" or "Another" or "Imagine"

CONTENT GUIDELINES:
- 2-3 short paragraphs, written naturally
- Mention the scholars (college students doing the work) casually
- End with a clear call-to-action (link in bio, DM us, book a consultation, etc.)
- Add 8-12 hashtags at the very end on their own line
- 1-2 emojis max, placed naturally
- Mention Denver area when it fits
- Keep under 250 words

HASHTAGS TO MIX FROM:
#GarageScholars #DenverHome #Denver #Colorado ${extraHashtags}

Output ONLY the caption text. No labels, no headers, no extra formatting.`;
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    let text = result.response.text()?.trim() || "Another transformation! #GarageScholars";
    // Strip AI formatting artifacts
    text = text
        .replace(/\*\*/g, "")
        .replace(/(?<!\w)\*(?!\*)/g, "")
        .replace(/__/g, "")
        .replace(/(?<!\w)_(?!_)/g, (match, offset, str) => {
        const before = str[offset - 1];
        if (before && /\w/.test(before))
            return match;
        return "";
    })
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^[-•]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .trim();
    await saveTypedLastCaption(configDoc, text);
    return text;
}
// ─── Get next story angle + last caption from Firestore ───
async function getNextCaptionAngle() {
    const configRef = db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("socialMediaCaption");
    try {
        const snap = await configRef.get();
        const lastIndex = snap.exists ? (snap.data()?.lastAngleIndex ?? -1) : -1;
        const lastCaption = snap.exists ? (snap.data()?.lastCaption ?? "") : "";
        const nextIndex = (lastIndex + 1) % CAPTION_ANGLES.length;
        await configRef.set({
            lastAngleIndex: nextIndex,
            lastAngleName: `angle_${nextIndex}`,
        }, { merge: true });
        return { angle: CAPTION_ANGLES[nextIndex], lastCaption };
    }
    catch {
        return { angle: CAPTION_ANGLES[0], lastCaption: "" };
    }
}
// ─── Save last caption to Firestore so next post can avoid repeating ───
async function saveLastCaption(caption) {
    try {
        await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("socialMediaCaption").set({ lastCaption: caption.substring(0, 500) }, { merge: true });
    }
    catch {
        // Non-critical
    }
}
// ─── Generate caption using Gemini ───
async function generateCaption(jobTitle, address, packageTier) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error("GEMINI_API_KEY not configured");
    // Get the next story angle and last caption for context
    const { angle, lastCaption } = await getNextCaptionAngle();
    console.log(`Caption angle: ${angle.substring(0, 60)}...`);
    // Try to load custom prompt from Firestore
    let promptTemplate = DEFAULT_CAPTION_PROMPT;
    try {
        const configSnap = await db
            .collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG)
            .doc("socialMediaPrompt")
            .get();
        if (configSnap.exists && configSnap.data()?.prompt) {
            promptTemplate = configSnap.data().prompt;
        }
    }
    catch {
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
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    let text = result.response.text()?.trim() || "Another garage transformed! #GarageScholars";
    // Strip AI formatting artifacts that slip through despite prompt instructions
    text = text
        .replace(/\*\*/g, "") // Remove bold markdown **
        .replace(/(?<!\w)\*(?!\*)/g, "") // Remove stray single asterisks
        .replace(/__/g, "") // Remove underline markdown __
        .replace(/(?<!\w)_(?!_)/g, (match, offset, str) => {
        // Keep underscores inside words/hashtags, remove emphasis underscores
        const before = str[offset - 1];
        const after = str[offset + 1];
        if (before && /\w/.test(before))
            return match;
        if (after && /\w/.test(after))
            return "";
        return match;
    })
        .replace(/^#{1,6}\s+/gm, "") // Remove markdown headers
        .replace(/^[-•]\s+/gm, "") // Remove bullet points
        .replace(/^\d+\.\s+/gm, "") // Remove numbered lists
        .trim();
    // Save this caption so the next post knows what to avoid
    await saveLastCaption(text);
    return text;
}
// ─── Post to Facebook Page ───
async function postToFacebook(imageUrl, caption) {
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
    const data = await resp.json();
    if (data.error) {
        throw new Error(`Facebook API error: ${data.error.message}`);
    }
    return data.id || null;
}
// ─── Post to Instagram ───
async function postToInstagram(imageUrl, caption) {
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
    const createData = await createResp.json();
    if (createData.error) {
        throw new Error(`Instagram create error: ${createData.error.message}`);
    }
    if (!createData.id)
        throw new Error("No creation_id returned from Instagram");
    // Step 2: Wait for Instagram to process the media container
    const containerId = createData.id;
    const maxWaitMs = 60000; // 60 seconds max
    const pollInterval = 5000; // check every 5 seconds
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        const statusResp = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`);
        const statusData = await statusResp.json();
        if (statusData.status_code === "FINISHED")
            break;
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
    const publishData = await publishResp.json();
    if (publishData.error) {
        throw new Error(`Instagram publish error: ${publishData.error.message}`);
    }
    return publishData.id || null;
}
// ═══════════════════════════════════════════════════════════════
// Scheduled: Process social media content queue (daily at 9 AM MT)
// ═══════════════════════════════════════════════════════════════
exports.gsProcessSocialContent = (0, scheduler_1.onSchedule)({
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
}, async () => {
    // Query pending items + failed items eligible for retry
    const [pendingSnap, retrySnap] = await Promise.all([
        db.collection(gs_constants_1.GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE)
            .where("status", "==", "pending")
            .limit(3)
            .get(),
        db.collection(gs_constants_1.GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE)
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
    const storage = (0, storage_1.getStorage)();
    const bucket = storage.bucket();
    for (const doc of allDocs) {
        const item = doc.data();
        const retryCount = (item.retryCount || 0);
        const isRetry = item.status === "failed";
        try {
            console.log(`${isRetry ? "Retrying" : "Processing"} social content for job ${item.jobId}` +
                `${isRetry ? ` (attempt ${retryCount + 1})` : ""}...`);
            // Mark as processing to prevent duplicate pickups
            await doc.ref.update({ status: "processing" });
            const contentType = (item.contentType || "before_after");
            let compositeBuffer;
            let caption;
            if (contentType === "resale" || contentType === "donation" || contentType === "gym_install") {
                // ─── NEW CONTENT TYPES: resale, donation, gym_install ───
                const itemPhotos = (item.itemPhotos || []);
                if (itemPhotos.length === 0)
                    throw new Error(`No item photos found for ${contentType} post`);
                // Download all item photos
                const photoBuffers = [];
                for (const url of itemPhotos) {
                    const resp = await fetch(url);
                    if (!resp.ok)
                        throw new Error(`Failed to download photo: ${url}`);
                    photoBuffers.push(Buffer.from(await resp.arrayBuffer()));
                }
                // Validate at least the first photo
                const firstCheck = await validatePhoto(photoBuffers[0], "Item");
                if (!firstCheck.valid)
                    throw new Error(firstCheck.reason);
                // Create the appropriate composite
                const itemName = (item.itemName || "");
                if (contentType === "resale") {
                    console.log(`Creating resale composite for: ${itemName}`);
                    compositeBuffer = await createResaleComposite(photoBuffers, itemName, RESALE_THEME);
                }
                else if (contentType === "donation") {
                    console.log("Creating donation composite");
                    compositeBuffer = await createDonationComposite(photoBuffers, DONATION_THEME);
                }
                else {
                    console.log(`Creating gym composite for: ${itemName}`);
                    compositeBuffer = await createGymComposite(photoBuffers, itemName, GYM_THEME);
                }
                // Generate typed caption
                caption = await generateTypedCaption(contentType, item.jobTitle, item.address, item.packageTier, itemName);
            }
            else {
                // ─── EXISTING: before_after content type ───
                const [beforeResp, afterResp] = await Promise.all([
                    fetch(item.beforePhotoUrl),
                    fetch(item.afterPhotoUrl),
                ]);
                if (!beforeResp.ok || !afterResp.ok) {
                    throw new Error("Failed to download photos from Firebase Storage");
                }
                const beforeBuffer = Buffer.from(await beforeResp.arrayBuffer());
                const afterBuffer = Buffer.from(await afterResp.arrayBuffer());
                const [beforeCheck, afterCheck] = await Promise.all([
                    validatePhoto(beforeBuffer, "Before"),
                    validatePhoto(afterBuffer, "After"),
                ]);
                if (!beforeCheck.valid)
                    throw new Error(beforeCheck.reason);
                if (!afterCheck.valid)
                    throw new Error(afterCheck.reason);
                const theme = await getNextColorTheme();
                console.log(`Using color theme: ${theme.name}`);
                compositeBuffer = await createCompositeImage(beforeBuffer, afterBuffer, theme);
                caption = await generateCaption(item.jobTitle, item.address, item.packageTier);
            }
            // Validate composite output
            const compositeMeta = await (0, sharp_1.default)(compositeBuffer).metadata();
            if (!compositeMeta.width || compositeMeta.width < 1080) {
                throw new Error(`Composite output invalid: ${compositeMeta.width}x${compositeMeta.height}`);
            }
            // Upload composite to Firebase Storage
            const compositePath = `gs_social_content/${item.jobId}/${contentType}_composite_${Date.now()}.jpg`;
            const file = bucket.file(compositePath);
            await file.save(compositeBuffer, {
                metadata: { contentType: "image/jpeg" },
            });
            await file.makePublic();
            const compositeUrl = `https://storage.googleapis.com/${bucket.name}/${compositePath}`;
            // Validate caption
            const captionCheck = validateCaption(caption);
            if (!captionCheck.valid) {
                console.warn(`Caption validation failed (${captionCheck.reason}), retrying once...`);
                if (contentType === "before_after" || !item.contentType) {
                    caption = await generateCaption(item.jobTitle, item.address, item.packageTier);
                }
                else {
                    caption = await generateTypedCaption(contentType, item.jobTitle, item.address, item.packageTier, item.itemName);
                }
                const retryCheck = validateCaption(caption);
                if (!retryCheck.valid) {
                    throw new Error(`Caption failed validation after retry: ${retryCheck.reason}`);
                }
            }
            // 7. Post to Facebook
            let fbPostId = null;
            try {
                fbPostId = await postToFacebook(compositeUrl, caption);
                console.log(`Facebook post created: ${fbPostId}`);
            }
            catch (err) {
                console.error("Facebook post failed:", err);
            }
            // 8. Post to Instagram
            let igPostId = null;
            try {
                igPostId = await postToInstagram(compositeUrl, caption);
                console.log(`Instagram post created: ${igPostId}`);
            }
            catch (err) {
                console.error("Instagram post failed:", err);
            }
            // 9. Update queue item — success
            await doc.ref.update({
                status: "posted",
                compositeUrl,
                caption,
                fbPostId: fbPostId || "",
                igPostId: igPostId || "",
                postedAt: firestore_1.FieldValue.serverTimestamp(),
                retryCount: retryCount + (isRetry ? 1 : 0),
            });
            console.log(`Social content posted for job ${item.jobId}`);
        }
        catch (err) {
            const newRetryCount = retryCount + 1;
            const errorMsg = err.message || "Unknown error";
            console.error(`Social content failed for job ${item.jobId} (attempt ${newRetryCount}):`, err);
            if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
                // Permanently failed — alert admin
                await doc.ref.update({
                    status: "permanently_failed",
                    error: errorMsg,
                    retryCount: newRetryCount,
                    failedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                await alertAdminFailure(item.jobId, errorMsg, newRetryCount);
            }
            else {
                // Mark as failed with retry count — will be picked up next cycle
                await doc.ref.update({
                    status: "failed",
                    error: errorMsg,
                    retryCount: newRetryCount,
                });
            }
        }
    }
});
// ═══════════════════════════════════════════════════════════════
// Callable: Refresh Meta access token (admin-only)
// ═══════════════════════════════════════════════════════════════
exports.gsRefreshMetaToken = (0, https_1.onCall)({
    cors: true,
    timeoutSeconds: 30,
    secrets: ["META_PAGE_ACCESS_TOKEN"],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const profileSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PROFILES)
        .doc(request.auth.uid)
        .get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { appId, appSecret, shortLivedToken } = request.data;
    if (!appId || !appSecret || !shortLivedToken) {
        throw new https_1.HttpsError("invalid-argument", "appId, appSecret, and shortLivedToken required.");
    }
    // Exchange for long-lived token
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) {
        throw new https_1.HttpsError("internal", `Meta API error: ${data.error.message}`);
    }
    if (!data.access_token) {
        throw new https_1.HttpsError("internal", "No access token returned from Meta.");
    }
    // Store the new token in platform config for reference
    await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("metaTokens").set({
        lastRefreshedAt: firestore_1.FieldValue.serverTimestamp(),
        expiresInDays: 60,
    }, { merge: true });
    return {
        ok: true,
        token: data.access_token,
        message: "Long-lived token generated. Set it as META_PAGE_ACCESS_TOKEN secret: firebase functions:secrets:set META_PAGE_ACCESS_TOKEN",
    };
});
