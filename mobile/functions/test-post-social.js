/**
 * Test script: Generate composites + captions and post to Facebook + Instagram
 * for each content type (resale, donation, gym install)
 *
 * Usage: cd functions && node test-post-social.js
 */

const sharp = require("sharp");
const https = require("https");
const os = require("os");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "garage-scholars-v2";
const STORAGE_BUCKET = "garage-scholars-v2.firebasestorage.app";

// ── Auth ──
const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const TOKEN = config.tokens.access_token.trim();

// ── Secrets cache ──
const secrets = {};

async function getSecret(name) {
  if (secrets[name]) return secrets[name];
  return new Promise((resolve, reject) => {
    https.get(
      {
        hostname: "secretmanager.googleapis.com",
        path: `/v1/projects/${PROJECT_ID}/secrets/${name}/versions/latest:access`,
        headers: { Authorization: "Bearer " + TOKEN },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode === 200) {
            const decoded = Buffer.from(JSON.parse(body).payload.data, "base64").toString("utf8").trim();
            secrets[name] = decoded;
            resolve(decoded);
          } else reject(new Error(`Secret ${name}: HTTP ${res.statusCode}`));
        });
      }
    );
  });
}

// ── Image download ──
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : require("http");
    client.get(url, { headers: { "User-Agent": "GarageScholars/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ── Helper functions (from gs-social.ts) ──
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

async function enhancePhoto(buffer) {
  try {
    return await sharp(buffer).rotate().normalize().sharpen({ sigma: 1.0, m1: 1.0, m2: 2.0 }).modulate({ brightness: 1.05, saturation: 1.12 }).gamma(1.1).toBuffer();
  } catch { return buffer; }
}

// ── Color Themes ──
const RESALE_THEME = { name: "resale-amber", bg: { r: 45, g: 20, b: 5 }, bgHex: "#2d1405", accent: "#f59e0b", labelBg: "rgba(45,20,5,0.85)", tagline: "#fcd34d" };
const DONATION_THEME = { name: "donation-violet", bg: { r: 30, g: 10, b: 45 }, bgHex: "#1e0a2d", accent: "#a855f7", labelBg: "rgba(30,10,45,0.85)", tagline: "#c084fc" };
const GYM_THEME = { name: "gym-crimson", bg: { r: 40, g: 8, b: 8 }, bgHex: "#280808", accent: "#ef4444", labelBg: "rgba(40,8,8,0.85)", tagline: "#fca5a5" };

// ── Composite Builders ──

async function createResaleComposite(photoBuffers, itemName, theme) {
  const CANVAS = 1080, BORDER = 8, INNER = CANVAS - BORDER * 2;
  const GRID_GAP = 4, BRAND_BAR_HEIGHT = 140;
  const GRID_HEIGHT = INNER - BRAND_BAR_HEIGHT - 2;
  const CELL_W = Math.floor((INNER - GRID_GAP) / 2);
  const CELL_H = Math.floor((GRID_HEIGHT - GRID_GAP) / 2);

  const cells = [];
  for (let i = 0; i < 4; i++) {
    const buf = photoBuffers[i] || photoBuffers[0];
    const enhanced = await enhancePhoto(buf);
    cells.push(await sharp(enhanced).resize(CELL_W, CELL_H, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer());
  }

  const labels = ["FRONT", "SIDE", "BACK", "FULL VIEW"];
  const labelHeight = 32;
  const labelSvgs = labels.map((label) =>
    Buffer.from(`<svg width="${CELL_W}" height="${labelHeight}"><rect width="${CELL_W}" height="${labelHeight}" fill="${theme.labelBg}"/><text x="${CELL_W / 2}" y="22" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3" fill="#ffffff">${label}</text></svg>`)
  );

  const safeName = (itemName || "ITEM").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 40);
  const brandBar = Buffer.from(`<svg width="${INNER}" height="${BRAND_BAR_HEIGHT}"><rect width="${INNER}" height="${BRAND_BAR_HEIGHT}" fill="${theme.bgHex}"/><rect x="${(INNER - 120) / 2}" y="14" width="120" height="2" fill="${theme.accent}"/><text x="${INNER / 2}" y="46" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="${theme.accent}">GARAGE SCHOLARS</text><text x="${INNER / 2}" y="74" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="16" font-weight="600" letter-spacing="2" fill="${theme.tagline}">SOLD BY GARAGE SCHOLARS</text><text x="${INNER / 2}" y="104" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="14" letter-spacing="1" fill="#ffffff">${safeName}</text></svg>`);
  const horizontalDivider = Buffer.from(`<svg width="${INNER}" height="2"><rect width="${INNER}" height="2" fill="${theme.accent}"/></svg>`);
  const accentRgb = hexToRgb(theme.accent);
  const base = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 3, background: accentRgb } }).jpeg().toBuffer();
  const innerFill = Buffer.from(`<svg width="${INNER}" height="${INNER}"><rect width="${INNER}" height="${INNER}" fill="${theme.bgHex}"/></svg>`);

  return sharp(base).composite([
    { input: innerFill, left: BORDER, top: BORDER },
    { input: cells[0], left: BORDER, top: BORDER },
    { input: labelSvgs[0], left: BORDER, top: BORDER + CELL_H - labelHeight },
    { input: cells[1], left: BORDER + CELL_W + GRID_GAP, top: BORDER },
    { input: labelSvgs[1], left: BORDER + CELL_W + GRID_GAP, top: BORDER + CELL_H - labelHeight },
    { input: cells[2], left: BORDER, top: BORDER + CELL_H + GRID_GAP },
    { input: labelSvgs[2], left: BORDER, top: BORDER + CELL_H + GRID_GAP + CELL_H - labelHeight },
    { input: cells[3], left: BORDER + CELL_W + GRID_GAP, top: BORDER + CELL_H + GRID_GAP },
    { input: labelSvgs[3], left: BORDER + CELL_W + GRID_GAP, top: BORDER + CELL_H + GRID_GAP + CELL_H - labelHeight },
    { input: horizontalDivider, left: BORDER, top: BORDER + GRID_HEIGHT },
    { input: brandBar, left: BORDER, top: BORDER + GRID_HEIGHT + 2 },
  ]).jpeg({ quality: 93 }).toBuffer();
}

async function createDonationComposite(photoBuffers, theme) {
  const CANVAS = 1080, BORDER = 8, INNER = CANVAS - BORDER * 2;
  const BRAND_BAR_HEIGHT = 140, DIVIDER = 4;
  const IMG_HEIGHT = INNER - BRAND_BAR_HEIGHT - 2;
  const LEFT_W = Math.floor((INNER - DIVIDER) * 0.65);
  const RIGHT_W = INNER - LEFT_W - DIVIDER;

  const [buf1, buf2] = [photoBuffers[0], photoBuffers[1] || photoBuffers[0]];
  const [enhanced1, enhanced2] = await Promise.all([enhancePhoto(buf1), enhancePhoto(buf2)]);
  const leftImg = await sharp(enhanced1).resize(LEFT_W, IMG_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
  const rightImg = await sharp(enhanced2).resize(RIGHT_W, IMG_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();

  const labelHeight = 36;
  const leftLabel = Buffer.from(`<svg width="${LEFT_W}" height="${labelHeight}"><rect width="${LEFT_W}" height="${labelHeight}" fill="${theme.labelBg}"/><text x="${LEFT_W / 2}" y="25" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="3" fill="#ffffff">DONATED ITEMS</text></svg>`);
  const rightLabel = Buffer.from(`<svg width="${RIGHT_W}" height="${labelHeight}"><rect width="${RIGHT_W}" height="${labelHeight}" fill="${theme.labelBg}"/><text x="${RIGHT_W / 2}" y="25" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="#ffffff">DETAILS</text></svg>`);
  const brandBar = Buffer.from(`<svg width="${INNER}" height="${BRAND_BAR_HEIGHT}"><rect width="${INNER}" height="${BRAND_BAR_HEIGHT}" fill="${theme.bgHex}"/><rect x="${(INNER - 120) / 2}" y="14" width="120" height="2" fill="${theme.accent}"/><text x="${INNER / 2}" y="46" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="${theme.accent}">GARAGE SCHOLARS</text><text x="${INNER / 2}" y="74" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="16" font-weight="600" letter-spacing="2" fill="${theme.tagline}">DONATED WITH PURPOSE</text></svg>`);
  const horizontalDivider = Buffer.from(`<svg width="${INNER}" height="2"><rect width="${INNER}" height="2" fill="${theme.accent}"/></svg>`);
  const accentRgb = hexToRgb(theme.accent);
  const base = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 3, background: accentRgb } }).jpeg().toBuffer();
  const innerFill = Buffer.from(`<svg width="${INNER}" height="${INNER}"><rect width="${INNER}" height="${INNER}" fill="${theme.bgHex}"/></svg>`);

  return sharp(base).composite([
    { input: innerFill, left: BORDER, top: BORDER },
    { input: leftImg, left: BORDER, top: BORDER },
    { input: leftLabel, left: BORDER, top: BORDER + IMG_HEIGHT - labelHeight },
    { input: rightImg, left: BORDER + LEFT_W + DIVIDER, top: BORDER },
    { input: rightLabel, left: BORDER + LEFT_W + DIVIDER, top: BORDER + IMG_HEIGHT - labelHeight },
    { input: horizontalDivider, left: BORDER, top: BORDER + IMG_HEIGHT },
    { input: brandBar, left: BORDER, top: BORDER + IMG_HEIGHT + 2 },
  ]).jpeg({ quality: 93 }).toBuffer();
}

async function createGymComposite(photoBuffers, equipmentName, theme) {
  const CANVAS = 1080, BORDER = 8, INNER = CANVAS - BORDER * 2;
  const BRAND_BAR_HEIGHT = 140, GAP = 4;
  const HERO_HEIGHT = Math.floor((INNER - BRAND_BAR_HEIGHT - 2 - GAP) * 0.65);
  const THUMB_HEIGHT = INNER - BRAND_BAR_HEIGHT - 2 - GAP - HERO_HEIGHT;
  const THUMB_W = Math.floor((INNER - GAP) / 2);

  const heroImg = await sharp(await enhancePhoto(photoBuffers[0])).resize(INNER, HERO_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
  const thumbs = [];
  for (let i = 1; i <= 2; i++) {
    const buf = photoBuffers[i] || photoBuffers[0];
    thumbs.push(await sharp(await enhancePhoto(buf)).resize(THUMB_W, THUMB_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer());
  }

  const heroLabel = Buffer.from(`<svg width="${INNER}" height="36"><rect width="${INNER}" height="36" fill="${theme.labelBg}"/><text x="${INNER / 2}" y="25" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="3" fill="#ffffff">HOME GYM INSTALLED</text></svg>`);
  const safeEquipment = (equipmentName || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 45);
  const brandBar = Buffer.from(`<svg width="${INNER}" height="${BRAND_BAR_HEIGHT}"><rect width="${INNER}" height="${BRAND_BAR_HEIGHT}" fill="${theme.bgHex}"/><rect x="${(INNER - 120) / 2}" y="14" width="120" height="2" fill="${theme.accent}"/><text x="${INNER / 2}" y="46" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="${theme.accent}">GARAGE SCHOLARS</text><text x="${INNER / 2}" y="74" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="16" font-weight="600" letter-spacing="2" fill="${theme.tagline}">HOME GYM BUILT</text>${safeEquipment ? `<text x="${INNER / 2}" y="104" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="13" letter-spacing="1" fill="#ffffff">${safeEquipment}</text>` : ""}</svg>`);
  const horizontalDivider = Buffer.from(`<svg width="${INNER}" height="2"><rect width="${INNER}" height="2" fill="${theme.accent}"/></svg>`);
  const accentRgb = hexToRgb(theme.accent);
  const base = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 3, background: accentRgb } }).jpeg().toBuffer();
  const innerFill = Buffer.from(`<svg width="${INNER}" height="${INNER}"><rect width="${INNER}" height="${INNER}" fill="${theme.bgHex}"/></svg>`);
  const thumbTop = BORDER + HERO_HEIGHT + GAP;

  return sharp(base).composite([
    { input: innerFill, left: BORDER, top: BORDER },
    { input: heroImg, left: BORDER, top: BORDER },
    { input: heroLabel, left: BORDER, top: BORDER + HERO_HEIGHT - 36 },
    { input: thumbs[0], left: BORDER, top: thumbTop },
    { input: thumbs[1], left: BORDER + THUMB_W + GAP, top: thumbTop },
    { input: horizontalDivider, left: BORDER, top: thumbTop + THUMB_HEIGHT },
    { input: brandBar, left: BORDER, top: thumbTop + THUMB_HEIGHT + 2 },
  ]).jpeg({ quality: 93 }).toBuffer();
}

// ── Upload to Firebase Storage ──
async function uploadToStorage(buffer, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = "----FormBoundary" + Date.now();
    const metadata = JSON.stringify({ name: filePath, contentType: "image/jpeg" });
    const parts = [
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`,
    ];
    const head = Buffer.from(parts[0] + parts[1]);
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buffer, tail]);

    const req = https.request({
      hostname: "storage.googleapis.com",
      path: `/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=multipart`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": body.length,
        Authorization: "Bearer " + TOKEN,
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const parsed = JSON.parse(data);
          // Make the file public
          makePublic(filePath).then(() => {
            resolve(`https://storage.googleapis.com/${STORAGE_BUCKET}/${filePath}`);
          }).catch(() => {
            resolve(`https://storage.googleapis.com/${STORAGE_BUCKET}/${filePath}`);
          });
        } else {
          reject(new Error(`Storage upload HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function makePublic(filePath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ entity: "allUsers", role: "READER" });
    const encodedPath = encodeURIComponent(filePath);
    const req = https.request({
      hostname: "storage.googleapis.com",
      path: `/storage/v1/b/${STORAGE_BUCKET}/o/${encodedPath}/acl`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: "Bearer " + TOKEN,
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Caption Generation ──
async function generateCaption(geminiKey, contentType, jobTitle, address, packageTier, itemName) {
  const angles = {
    resale: [
      "CASH BACK angle: Got the customer money back by selling items found during their garage cleanup. Talk about the surprise of finding value in clutter and how the garage transformation literally put money back in their pocket.",
    ],
    donation: [
      "GIVING BACK angle: The best part of organizing is finding things to give to someone who needs them. Tell a warm story about the joy of donating during a garage cleanup.",
    ],
    gym_install: [
      "HOME GYM DREAM angle: They talked about building a home gym for years and today it finally happened. Paint the picture of a dream becoming reality.",
    ],
  };

  const descriptions = {
    resale: `This is a RESALE post. The item "${itemName}" was found during a garage cleanup and sold to get money back for the customer.`,
    donation: `This is a DONATION post. Items were donated to charity during a garage transformation, giving back to the community.`,
    gym_install: `This is a HOME GYM INSTALLATION post. Equipment installed: ${itemName}. A home gym was built in the customer's garage or home.`,
  };

  const hashtags = {
    resale: "#ResaleValue #DeclutterAndEarn #GarageTreasure #MakeMoneyDecluttering #SellYourStuff",
    donation: "#DonateLocal #GivingBack #CommunityImpact #DeclutterForGood #PayItForward",
    gym_install: "#HomeGym #GarageGym #GymSetup #HomeWorkout #FitnessAtHome #GymLife",
  };

  const location = address.split(",").slice(-2, -1)[0]?.trim() || "Denver";
  const angle = angles[contentType][0];

  const prompt = `You are writing a real Instagram/Facebook caption for Garage Scholars, a Denver garage transformation company run by college students. ${descriptions[contentType]}

JOB: ${jobTitle} in ${location} (${packageTier} package)

YOUR STORY ANGLE FOR THIS POST (you MUST use this specific angle):
${angle}

Weave this angle into the caption naturally. Tell a mini story or paint a vivid picture. Do NOT list multiple benefits — go deep on this one angle.

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
#GarageScholars #DenverHome #Denver #Colorado ${hashtags[contentType]}

Output ONLY the caption text. No labels, no headers, no extra formatting.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode === 200) {
          const text = JSON.parse(data).candidates?.[0]?.content?.parts?.[0]?.text || "";
          resolve(text.replace(/\*\*/g, "").replace(/(?<!\w)\*(?!\*)/g, "").replace(/__/g, "").replace(/^#{1,6}\s+/gm, "").replace(/^[-•]\s+/gm, "").replace(/^\d+\.\s+/gm, "").trim());
        } else reject(new Error(`Gemini HTTP ${res.statusCode}`));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Post to Facebook ──
async function postToFacebook(imageUrl, caption, pageId, accessToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ url: imageUrl, message: caption, access_token: accessToken });
    const req = https.request({
      hostname: "graph.facebook.com",
      path: `/v21.0/${pageId}/photos`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(`FB: ${parsed.error.message}`));
        else resolve(parsed.id || null);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Post to Instagram ──
async function postToInstagram(imageUrl, caption, igUserId, accessToken) {
  // Step 1: Create container
  const containerId = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken });
    const req = https.request({
      hostname: "graph.facebook.com",
      path: `/v21.0/${igUserId}/media`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(`IG create: ${parsed.error.message}`));
        else resolve(parsed.id);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  // Step 2: Poll for FINISHED
  const maxWait = 60000, pollInterval = 5000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const status = await new Promise((resolve) => {
      https.get({
        hostname: "graph.facebook.com",
        path: `/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`,
      }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      });
    });
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("IG container processing failed");
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Step 3: Publish
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ creation_id: containerId, access_token: accessToken });
    const req = https.request({
      hostname: "graph.facebook.com",
      path: `/v21.0/${igUserId}/media_publish`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(`IG publish: ${parsed.error.message}`));
        else resolve(parsed.id || null);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Stock photo URLs from Unsplash ──
const STOCK_PHOTOS = {
  resale: [
    "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80",  // DeWalt drill - front
    "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?w=800&q=80",  // Tool rack - side
    "https://images.unsplash.com/photo-1651002488585-1ed4a57f5d76?w=800&q=80",  // Baseball glove - back/label
    "https://images.unsplash.com/photo-1477333183135-292dd5b3910f?w=800&q=80",  // Workbench tools - full shot
  ],
  donation: [
    "https://images.unsplash.com/photo-1514792368985-f80e9d482a02?w=800&q=80",  // Cardboard boxes
    "https://images.unsplash.com/photo-1559764995-a071c12d009f?w=800&q=80",  // Plush toys/items
  ],
  gym: [
    "https://images.unsplash.com/photo-1545612036-2872840642dc?w=800&q=80",  // Gym room wide shot
    "https://images.unsplash.com/photo-1620188467120-5042ed1eb5da?w=800&q=80",  // Barbell/weights close-up
    "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&q=80",  // Dumbbells on floor
  ],
};

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════

async function main() {
  console.log("=== SOCIAL MEDIA LIVE POST TEST ===\n");

  // Get all secrets
  console.log("Loading secrets...");
  const [geminiKey, metaToken, pageId, igUserId] = await Promise.all([
    getSecret("GEMINI_API_KEY"),
    getSecret("META_PAGE_ACCESS_TOKEN"),
    getSecret("META_PAGE_ID"),
    getSecret("META_IG_USER_ID"),
  ]);
  console.log("All secrets loaded.\n");

  // Download real stock photos from Unsplash
  console.log("Downloading stock photos...");
  const resalePhotos = [];
  for (const url of STOCK_PHOTOS.resale) {
    console.log(`  Downloading resale photo: ${url.split("?")[0].split("/").pop()}...`);
    resalePhotos.push(await downloadImage(url));
  }

  const donationPhotos = [];
  for (const url of STOCK_PHOTOS.donation) {
    console.log(`  Downloading donation photo: ${url.split("?")[0].split("/").pop()}...`);
    donationPhotos.push(await downloadImage(url));
  }

  const gymPhotos = [];
  for (const url of STOCK_PHOTOS.gym) {
    console.log(`  Downloading gym photo: ${url.split("?")[0].split("/").pop()}...`);
    gymPhotos.push(await downloadImage(url));
  }
  console.log("All stock photos downloaded.\n");

  // ═══ RESALE POST ═══
  console.log("========================================");
  console.log("1. RESALE POST");
  console.log("========================================");

  console.log("Creating resale composite...");
  const resaleComposite = await createResaleComposite(resalePhotos, "DeWalt 20V Cordless Drill Set", RESALE_THEME);
  console.log(`Composite: ${resaleComposite.length} bytes`);

  console.log("Generating resale caption...");
  const resaleCaption = await generateCaption(geminiKey, "resale", "Full Garage Transformation", "1234 Cherry Creek Dr, Denver, CO", "Premium", "DeWalt 20V Cordless Drill Set");
  console.log(`Caption:\n${resaleCaption}\n`);

  console.log("Uploading composite to Storage...");
  const resaleUrl = await uploadToStorage(resaleComposite, `gs_social_content/test/resale_test_${Date.now()}.jpg`);
  console.log(`URL: ${resaleUrl}`);

  console.log("Posting to Facebook...");
  const fbResale = await postToFacebook(resaleUrl, resaleCaption, pageId, metaToken);
  console.log(`Facebook post ID: ${fbResale}`);

  console.log("Posting to Instagram...");
  const igResale = await postToInstagram(resaleUrl, resaleCaption, igUserId, metaToken);
  console.log(`Instagram post ID: ${igResale}`);
  console.log("RESALE POST COMPLETE!\n");

  // ═══ DONATION POST ═══
  console.log("========================================");
  console.log("2. DONATION POST");
  console.log("========================================");

  console.log("Creating donation composite...");
  const donationComposite = await createDonationComposite(donationPhotos, DONATION_THEME);
  console.log(`Composite: ${donationComposite.length} bytes`);

  console.log("Generating donation caption...");
  const donationCaption = await generateCaption(geminiKey, "donation", "Garage Cleanup", "5678 Broadway, Denver, CO", "Standard", "Box of children clothing and toys");
  console.log(`Caption:\n${donationCaption}\n`);

  console.log("Uploading composite to Storage...");
  const donationUrl = await uploadToStorage(donationComposite, `gs_social_content/test/donation_test_${Date.now()}.jpg`);
  console.log(`URL: ${donationUrl}`);

  console.log("Posting to Facebook...");
  const fbDonation = await postToFacebook(donationUrl, donationCaption, pageId, metaToken);
  console.log(`Facebook post ID: ${fbDonation}`);

  console.log("Posting to Instagram...");
  const igDonation = await postToInstagram(donationUrl, donationCaption, igUserId, metaToken);
  console.log(`Instagram post ID: ${igDonation}`);
  console.log("DONATION POST COMPLETE!\n");

  // ═══ GYM INSTALL POST ═══
  console.log("========================================");
  console.log("3. GYM INSTALL POST");
  console.log("========================================");

  console.log("Creating gym composite...");
  const gymComposite = await createGymComposite(gymPhotos, "Rogue Squat Rack, Concept2 Rower", GYM_THEME);
  console.log(`Composite: ${gymComposite.length} bytes`);

  console.log("Generating gym caption...");
  const gymCaption = await generateCaption(geminiKey, "gym_install", "Garage to Home Gym", "9012 Colfax Ave, Denver, CO", "Premium", "Rogue Squat Rack, Concept2 Rower, Rogue Dumbbells");
  console.log(`Caption:\n${gymCaption}\n`);

  console.log("Uploading composite to Storage...");
  const gymUrl = await uploadToStorage(gymComposite, `gs_social_content/test/gym_test_${Date.now()}.jpg`);
  console.log(`URL: ${gymUrl}`);

  console.log("Posting to Facebook...");
  const fbGym = await postToFacebook(gymUrl, gymCaption, pageId, metaToken);
  console.log(`Facebook post ID: ${fbGym}`);

  console.log("Posting to Instagram...");
  const igGym = await postToInstagram(gymUrl, gymCaption, igUserId, metaToken);
  console.log(`Instagram post ID: ${igGym}`);
  console.log("GYM INSTALL POST COMPLETE!\n");

  console.log("=== ALL 3 POSTS PUBLISHED SUCCESSFULLY ===");
  console.log("Check Facebook and Instagram to see them!");
}

main().catch((e) => {
  console.error("FATAL ERROR:", e.message);
  console.error(e.stack);
  process.exit(1);
});
