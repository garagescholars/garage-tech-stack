"use strict";
/**
 * Garage Scholars — Zero-Touch Hiring Pipeline
 *
 * Cloud Functions for automated applicant screening & evaluation.
 * Pipeline: Application → AI Score → Video Screen → AI Score → Zoom → Decision
 *
 * Architecture (Firebase-adapted from original n8n + R2 spec):
 * - Firestore triggers replace n8n workflows
 * - Firebase Storage replaces Cloudflare R2
 * - Anthropic Claude for application/resume scoring (rubric adherence, structured output)
 * - Google Gemini for video scoring (native video input, no transcription step)
 * - Firestore mail collection for email sending (already configured)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gsHiringWeeklyDigest = exports.gsProcessInterviewScore = exports.gsCalBookingWebhook = exports.gsProcessVideoCompletion = exports.gsScoreHiringApplication = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const crypto = __importStar(require("crypto"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const generative_ai_1 = require("@google/generative-ai");
const gs_constants_1 = require("./gs-constants");
const gs_hiring_types_1 = require("./gs-hiring-types");
const db = (0, firestore_2.getFirestore)();
const storage = (0, storage_1.getStorage)();
// ── Configuration ──
const FOUNDER_EMAILS = ["garagescholars@gmail.com", "admin@garagescholars.com"];
const VIDEO_APP_BASE_URL = process.env.VIDEO_APP_URL || "https://screen.garagescholars.com";
const CAL_LINK = process.env.CAL_LINK || "https://cal.com/garagescholars/interview";
// ════════════════════════════════════════════════════════════════════
// SECTION 1: AI SCORING PROMPTS (from Spec Steps 6.2, 6.4, 7.1)
// ════════════════════════════════════════════════════════════════════
const APP_SCORING_SYSTEM_PROMPT = `You are an applicant screening AI for Garage Scholars, a garage transformation startup in Denver. You evaluate applicants for a hands-on role: installing shelves/wall-mounted storage, cleaning/organizing garages, basic handyman work, interacting with homeowners professionally.

Score 6 screening answers (and resume if provided) on 0-100 across four dimensions:
1. SKILLS FIT (30%): Tool experience, physical project history, handy work. If a resume is attached, factor in relevant work history, trades experience, and hands-on skills.
2. RELIABILITY (15%): Transportation, availability, consistency signals. Resume work tenure and job stability are relevant.
3. CONSCIENTIOUSNESS (25%): Detail in answers, initiative, follow-through. Resume formatting and completeness reflect this.
4. PROBLEM-SOLVING (30%): Independent thinking in Q4 scenario.

If a resume is attached, also consider:
- Relevant work experience (construction, handyman, trades, physical labor, customer-facing)
- Education (trade schools, certifications, relevant coursework)
- Employment gaps or short tenures (not auto-fail, but factor into reliability)
- Overall presentation and effort

RED FLAGS (auto-fail):
- No transportation and no realistic plan
- Zero tool + zero hands-on project experience
- Answers are AI-generated, copy-pasted, or completely generic
- Hostile or deeply unprofessional tone

OUTPUT (JSON only, no other text):
{"skills_fit":<0-100>,"reliability":<0-100>,"conscientiousness":<0-100>,"problem_solving":<0-100>,"composite_score":<weighted avg>,"red_flags":[],"pass":true/false,"summary":"<2-3 sentences>","resume_summary":"<1-2 sentences about resume highlights, or null if no resume>"}

PASS: composite >= 60 AND zero red flags.`;
const APP_SCORING_FEW_SHOT_STRONG = `Example - Strong Applicant:
Q1: I have a 2019 Toyota Tacoma. I drive all over Denver for my current landscaping gig so I'm used to going wherever the job is.
Q2: I own a drill, impact driver, circular saw, level, tape measure, and a bunch of hand tools. Used all of them regularly.
Q3: I built a full set of floating shelves in my apartment last year. Measured the wall, found the studs, used a french cleat system. Took about 4 hours. They're still holding 50+ lbs of books.
Q4: I'd take a step back, figure out what we're actually dealing with, and adjust the game plan. Might take longer but I'd still get it done.
Q5: Available Mon-Sat, flexible on hours. No other commitments.
Q6: I like working with my hands and seeing a before/after. There's something satisfying about turning a disaster into something clean.

Output:
{"skills_fit":90,"reliability":85,"conscientiousness":80,"problem_solving":70,"composite_score":82,"red_flags":[],"pass":true,"summary":"Strong candidate with proven tool experience and hands-on project history. Reliable transportation and open availability. Shows genuine interest in the work."}`;
const APP_SCORING_FEW_SHOT_WEAK = `Example - Weak Applicant:
Q1: I can probably get rides from friends or take the bus.
Q2: I've used a hammer and screwdriver before.
Q3: I helped my roommate move once.
Q4: I'd call and ask what to do.
Q5: It depends on the week. I have classes and another job.
Q6: I need the money and saw the listing.

Output:
{"skills_fit":20,"reliability":30,"conscientiousness":35,"problem_solving":25,"composite_score":27,"red_flags":["No reliable transportation","Minimal tool experience","No independent project experience"],"pass":false,"summary":"Candidate lacks reliable transportation, has minimal tool experience, and shows no independent project history. Availability is inconsistent. Not a fit for this role."}`;
const VIDEO_SCORING_SYSTEM_PROMPT = `You are evaluating video screen recordings for Garage Scholars. You are watching the actual video of the candidate responding to 5 prompts (60-90 sec each). Evaluate both what they say AND how they present: body language, energy, eye contact, confidence, and authenticity.

SCORING (each 0-100):
1. COMMUNICATION (20%): Clear, coherent, natural, confident. Good eye contact and energy.
2. MECHANICAL APTITUDE (25%): Prompt 2 - real project, actual steps, demonstrated knowledge.
3. PROBLEM-SOLVING & HONESTY (20%): Prompt 3 - owns mistakes, stays calm, solution-oriented.
4. RELIABILITY & CONSCIENTIOUSNESS (20%): Prompt 4 - defines commitment, genuine conviction.
5. STARTUP FIT (15%): Prompt 5 - comfortable with ambiguity, genuine enthusiasm.

RED FLAGS (auto-fail):
- Clearly scripted/read from screen (eyes reading off-camera)
- Hostile or deeply unprofessional demeanor
- Zero hands-on experience in Prompt 2
- Deflects all blame in Prompt 3
- 'I need clear instructions for everything' in Prompt 5
- Appears disinterested, distracted, or unserious

OUTPUT (JSON only, no other text):
{"communication":<0-100>,"mechanical_aptitude":<0-100>,"problem_solving_honesty":<0-100>,"reliability_conscientiousness":<0-100>,"startup_fit":<0-100>,"composite_score":<weighted avg>,"red_flags":[],"strengths":[],"concerns":[],"pass":true/false,"summary":"<3-4 sentences>"}

PASS: composite >= 65 AND zero red flags.`;
const VIDEO_PROMPTS = [
    "Tell us about yourself. What do you do with your time, and what kind of work have you done?",
    "Describe something you built, fixed, or organized with your hands. Walk us through step by step.",
    "You're working solo at a customer's house and something goes wrong - maybe you crack a shelf or can't find a stud. What do you do?",
    "What does 'showing up' mean to you? If a friend described you as someone who always shows up, what would they mean?",
    "Why Garage Scholars? We're a startup - things move fast and roles shift. What about that sounds good or bad to you?",
];
// ════════════════════════════════════════════════════════════════════
// SECTION 2: EMAIL TEMPLATES (from Spec Step 6.7)
// ════════════════════════════════════════════════════════════════════
function emailWrapper(title, subtitle, bodyHtml) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:12px 12px 0 0;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;">${title}</h1>
      ${subtitle ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">${subtitle}</p>` : ""}
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">
      Garage Scholars | Denver, CO | garagescholars.com
    </p>
  </div>
</body></html>`;
}
function rejectionEmail(name, stage) {
    const safe = escapeHtml(name);
    const stageText = stage === "application"
        ? "After reviewing your application, we've decided to move forward with other candidates."
        : stage === "video"
            ? "Thanks for completing the video screen. We've decided to move forward with other candidates."
            : "Thanks for going through our full process. We've decided to go in a different direction.";
    return emailWrapper("Garage Scholars", "", `
    <p style="color:#1e293b;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${safe},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">${stageText}</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">We appreciate your time.</p>
    <p style="color:#475569;font-size:15px;margin-top:24px;">— The Garage Scholars Team</p>`);
}
function videoInviteEmail(name, videoLink) {
    const safe = escapeHtml(name);
    return emailWrapper("Garage Scholars", "Next Step: Video Screen", `
    <p style="color:#1e293b;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${safe},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Nice work on your application. The next step is a quick video screen — just 5 short responses, takes about 5 minutes. No prep needed.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(videoLink)}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
        Start Video Screen
      </a>
    </div>
    <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;">
      Please complete within 48 hours. The link is unique to you.
    </p>
    <p style="color:#475569;font-size:15px;margin-top:24px;">— The Garage Scholars Team</p>`);
}
function zoomInviteEmail(name, calLink) {
    const safe = escapeHtml(name);
    return emailWrapper("Garage Scholars", "Final Step: Let's Talk", `
    <p style="color:#1e293b;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${safe},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      We liked what we saw. The final step is a quick 15-minute Zoom call. Pick a time that works:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(calLink)}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
        Schedule Your Interview
      </a>
    </div>
    <p style="color:#475569;font-size:15px;margin-top:24px;">— Zach & Tyler</p>`);
}
async function founderDossierEmail(applicant, zoomTime) {
    const app = applicant.appScores;
    const vid = applicant.videoScores;
    const safeName = escapeHtml(applicant.name);
    const safePhone = escapeHtml(applicant.phone);
    const safeEmail = escapeHtml(applicant.email);
    const safeSource = escapeHtml(applicant.source);
    // Generate signed URLs for video playback (valid 7 days)
    const videoLinkParts = [];
    for (let i = 0; i < (applicant.videoStoragePaths || []).length; i++) {
        try {
            const [url] = await storage.bucket().file(applicant.videoStoragePaths[i]).getSignedUrl({
                action: "read",
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            });
            videoLinkParts.push(`<a href="${escapeHtml(url)}" style="color:#2563eb;">Video ${i + 1}</a>`);
        }
        catch {
            videoLinkParts.push(`Video ${i + 1} (unavailable)`);
        }
    }
    const videoLinks = videoLinkParts.join(" | ");
    return emailWrapper(`Interview: ${safeName}`, escapeHtml(zoomTime), `
    <div style="display:flex;gap:16px;margin-bottom:20px;">
      <div style="flex:1;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
        <p style="margin:0;color:#475569;font-size:12px;">App Score</p>
        <p style="margin:4px 0 0;color:#166534;font-size:24px;font-weight:700;">${app?.composite_score ?? "—"}/100</p>
      </div>
      <div style="flex:1;padding:16px;background:#eff6ff;border-radius:8px;text-align:center;">
        <p style="margin:0;color:#475569;font-size:12px;">Video Score</p>
        <p style="margin:4px 0 0;color:#1e40af;font-size:24px;font-weight:700;">${vid?.composite_score ?? "—"}/100</p>
      </div>
    </div>

    <div style="margin-bottom:16px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-weight:600;color:#475569;font-size:13px;">AI App Summary</p>
      <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.5;">${escapeHtml(app?.summary ?? "No summary")}</p>
    </div>

    <div style="margin-bottom:16px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-weight:600;color:#475569;font-size:13px;">AI Video Summary</p>
      <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.5;">${escapeHtml(vid?.summary ?? "No summary")}</p>
    </div>

    ${vid?.strengths?.length ? `
    <div style="margin-bottom:16px;padding:16px;background:#f0fdf4;border-radius:8px;">
      <p style="margin:0 0 8px;font-weight:600;color:#166534;font-size:13px;">Strengths</p>
      <p style="margin:0;color:#1e293b;font-size:14px;">${vid.strengths.map(s => escapeHtml(s)).join(", ")}</p>
    </div>` : ""}

    ${vid?.concerns?.length ? `
    <div style="margin-bottom:16px;padding:16px;background:#fef2f2;border-radius:8px;">
      <p style="margin:0 0 8px;font-weight:600;color:#991b1b;font-size:13px;">Concerns</p>
      <p style="margin:0;color:#1e293b;font-size:14px;">${vid.concerns.map(c => escapeHtml(c)).join(", ")}</p>
    </div>` : ""}

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Name</td>
        <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Phone</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="tel:${safePhone}" style="color:#2563eb;">${safePhone}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Email</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="mailto:${safeEmail}" style="color:#2563eb;">${safeEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Source</td>
        <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${safeSource}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;">Videos</td>
        <td style="padding:8px 12px;">${videoLinks || "No videos"}</td>
      </tr>
    </table>`);
}
function offerEmail(name) {
    const safe = escapeHtml(name);
    return emailWrapper("Welcome to Garage Scholars", "", `
    <p style="color:#1e293b;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${safe},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      We'd like to bring you on board.
    </p>
    <div style="padding:20px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:700;color:#166534;font-size:16px;">Garage Transformation Technician</p>
      <p style="margin:0;color:#475569;font-size:14px;">We'll send you details about pay, schedule, and your start date separately.</p>
    </div>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Reply to this email to confirm you're in.
    </p>
    <p style="color:#475569;font-size:15px;margin-top:24px;">— Zach & Tyler</p>`);
}
function decisionSummaryEmail(applicant, decision, finalScore) {
    const app = applicant.appScores;
    const vid = applicant.videoScores;
    const interview = applicant.interviewScores;
    const zoomAvg = interview
        ? ((interview.q1_dependability +
            interview.q2_problem_solving +
            interview.q3_customer_interaction +
            interview.q4_practical_skills +
            interview.q5_coachability +
            interview.q6_growth_mindset) /
            6).toFixed(1)
        : "—";
    const appPoints = app ? ((app.composite_score / 100) * 20).toFixed(1) : "—";
    const vidPoints = vid ? ((vid.composite_score / 100) * 30).toFixed(1) : "—";
    const zoomPoints = interview
        ? (((interview.q1_dependability +
            interview.q2_problem_solving +
            interview.q3_customer_interaction +
            interview.q4_practical_skills +
            interview.q5_coachability +
            interview.q6_growth_mindset) /
            6 /
            5) *
            50).toFixed(1)
        : "—";
    const decisionColor = decision === "HIRE" ? "#166534" : decision === "REJECT" ? "#991b1b" : "#92400e";
    const decisionBg = decision === "HIRE" ? "#f0fdf4" : decision === "REJECT" ? "#fef2f2" : "#fffbeb";
    return emailWrapper(`Decision: ${escapeHtml(applicant.name)}`, decision, `
    <div style="padding:16px;background:${decisionBg};border-radius:8px;text-align:center;margin-bottom:20px;">
      <p style="margin:0;color:${decisionColor};font-size:28px;font-weight:700;">${finalScore}/100</p>
      <p style="margin:4px 0 0;color:${decisionColor};font-size:14px;font-weight:600;">${decision}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">App Score</td>
        <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${app?.composite_score ?? "—"}/100 → ${appPoints}/20 pts</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Video Score</td>
        <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${vid?.composite_score ?? "—"}/100 → ${vidPoints}/30 pts</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Zoom Avg</td>
        <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${zoomAvg}/5 → ${zoomPoints}/50 pts</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Gut Check</td>
        <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${interview?.gut_check ?? "—"}</td>
      </tr>
      ${interview?.notes ? `<tr>
        <td style="padding:8px 12px;font-weight:600;color:#475569;">Notes</td>
        <td style="padding:8px 12px;color:#1e293b;">${escapeHtml(interview.notes)}</td>
      </tr>` : ""}
    </table>`);
}
async function founderReviewEmail(applicant, finalScore) {
    const dossierHtml = await founderDossierEmail(applicant, "Review — no Zoom scheduled");
    const innerHtml = dossierHtml.replace(/<!DOCTYPE[\s\S]*?<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");
    return emailWrapper(`Review Needed: ${escapeHtml(applicant.name)}`, `Score: ${finalScore}/100 — needs your call`, `
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      This candidate scored in the review zone (60-74) or had a "maybe"/"no" gut check. Review their dossier and reply with <strong>HIRE</strong> or <strong>REJECT</strong>.
    </p>
    ${innerHtml}`);
}
// ════════════════════════════════════════════════════════════════════
// SECTION 3: HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════
/** Escape HTML entities to prevent XSS in email templates */
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/** Validate and sanitize applicant data. Throws on invalid input. */
function validateApplicantData(data) {
    // Field length limits
    const textFields = [
        data.q1_transport, data.q2_tools, data.q3_project,
        data.q4_problem, data.q5_availability, data.q6_interest,
    ];
    for (const field of textFields) {
        if (typeof field !== "string" || field.length > 3000) {
            throw new Error("Invalid or oversized answer field");
        }
    }
    if (typeof data.name !== "string" || data.name.length > 200) {
        throw new Error("Invalid name");
    }
    if (typeof data.email !== "string" || !data.email.includes("@") || data.email.length > 320) {
        throw new Error("Invalid email");
    }
    if (typeof data.phone !== "string" || data.phone.length > 30) {
        throw new Error("Invalid phone");
    }
    const validSources = ["indeed", "handshake", "direct", "referral"];
    if (!validSources.includes(data.source)) {
        throw new Error("Invalid source");
    }
}
/** Send email via Firestore mail collection (uses existing Firebase extension) */
async function sendHiringEmail(to, subject, html) {
    await db.collection("mail").add({
        to,
        message: { subject, html },
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    });
}
/** Call Claude API for JSON scoring (supports optional PDF resume attachment) */
async function callClaudeForScoring(systemPrompt, userMessage, resumeBase64) {
    const anthropic = new sdk_1.default();
    // Build content blocks — include resume PDF if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = [];
    if (resumeBase64) {
        content.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: resumeBase64 },
        });
    }
    content.push({ type: "text", text: userMessage });
    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content }],
        system: systemPrompt,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude");
    }
    return textBlock.text;
}
/** Parse JSON from Claude response (handles markdown code blocks) */
function parseClaudeJson(raw) {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
}
/** Score all 5 candidate videos using Gemini native video input */
async function scoreVideosWithGemini(storagePaths, applicantName) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error("GEMINI_API_KEY not configured");
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // Build multimodal prompt: each video paired with its prompt question
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = [
        { text: `${VIDEO_SCORING_SYSTEM_PROMPT}\n\nCandidate: ${applicantName}\n\nThe following are 5 video recordings, each answering a specific prompt:\n` },
    ];
    for (let i = 0; i < storagePaths.length; i++) {
        console.log(`[Hiring] Downloading video ${i + 1}/5 for Gemini scoring`);
        const [buffer] = await storage.bucket().file(storagePaths[i]).download();
        parts.push({ text: `\n--- Video ${i + 1} — Prompt: "${VIDEO_PROMPTS[i]}" ---\n` }, { inlineData: { mimeType: "video/webm", data: buffer.toString("base64") } });
    }
    parts.push({ text: "\n\nNow score this candidate. Output JSON only." });
    const result = await model.generateContent(parts);
    const responseText = result.response.text();
    return parseClaudeJson(responseText);
}
/** Get first name from full name */
function firstName(name) {
    return name.split(" ")[0] || name;
}
// ════════════════════════════════════════════════════════════════════
// SECTION 4: PIPELINE FUNCTION 1 — Application AI Scoring
// ════════════════════════════════════════════════════════════════════
/**
 * Triggered when a new hiring application is submitted.
 * Scores the application using Claude AI, then auto-sends
 * video invite (pass) or rejection (fail).
 */
exports.gsScoreHiringApplication = (0, firestore_1.onDocumentCreated)({
    document: `${gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS}/{appId}`,
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: ["ANTHROPIC_API_KEY"],
}, async (event) => {
    const appData = event.data?.data();
    if (!appData)
        return;
    const appId = event.params.appId;
    const docRef = db.collection(gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS).doc(appId);
    const safeName = escapeHtml(appData.name || "Unknown");
    console.log(`[Hiring] Scoring application: ${appId} (${appData.name})`);
    try {
        // Validate input data
        validateApplicantData(appData);
        // Deduplicate: skip if another application with same email already exists and was scored
        const dupeCheck = await db
            .collection(gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS)
            .where("email", "==", appData.email)
            .where("status", "!=", "pending_ai")
            .limit(1)
            .get();
        if (!dupeCheck.empty) {
            console.log(`[Hiring] Duplicate email ${appData.email} — skipping scoring for ${appId}`);
            await docRef.update({ status: "rejected", decision: "reject", decisionAt: firestore_2.FieldValue.serverTimestamp() });
            return;
        }
        // Download resume if uploaded
        let resumeBase64;
        if (appData.resumePath) {
            try {
                console.log(`[Hiring] Downloading resume: ${appData.resumePath}`);
                const [buffer] = await storage.bucket().file(appData.resumePath).download();
                resumeBase64 = buffer.toString("base64");
                console.log(`[Hiring] Resume loaded (${Math.round(buffer.length / 1024)}KB)`);
            }
            catch (err) {
                console.warn(`[Hiring] Could not download resume: ${err}`);
                // Continue scoring without resume
            }
        }
        // Build the scoring prompt with few-shot examples
        const resumeNote = resumeBase64
            ? "\n\nA resume (PDF) is attached above. Factor it into your scoring."
            : "\n\nNo resume was uploaded.";
        const userMessage = `${APP_SCORING_FEW_SHOT_STRONG}

${APP_SCORING_FEW_SHOT_WEAK}

Now score this applicant:
<applicant_answer question="1_transport">${appData.q1_transport}</applicant_answer>
<applicant_answer question="2_tools">${appData.q2_tools}</applicant_answer>
<applicant_answer question="3_project">${appData.q3_project}</applicant_answer>
<applicant_answer question="4_problem">${appData.q4_problem}</applicant_answer>
<applicant_answer question="5_availability">${appData.q5_availability}</applicant_answer>
<applicant_answer question="6_interest">${appData.q6_interest}</applicant_answer>${resumeNote}`;
        const rawResponse = await callClaudeForScoring(APP_SCORING_SYSTEM_PROMPT, userMessage, resumeBase64);
        const scores = parseClaudeJson(rawResponse);
        console.log(`[Hiring] App scores for ${appId}: composite=${scores.composite_score}, pass=${scores.pass}`);
        if (scores.pass) {
            // PASS → generate secure video access token and send video invite
            const videoToken = crypto.randomBytes(32).toString("hex");
            const videoLink = `${VIDEO_APP_BASE_URL}?id=${appId}&token=${videoToken}`;
            await docRef.update({
                appScores: scores,
                status: "video_invited",
                videoToken,
                videoInvitedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            await sendHiringEmail([appData.email], "Next Step — Garage Scholars Video Screen (5 min)", videoInviteEmail(firstName(appData.name), videoLink));
            // Notify founders
            await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring] ${safeName} PASSED app screen (${scores.composite_score}/100)`, emailWrapper("Applicant Passed", `${safeName} — Score: ${scores.composite_score}/100`, `
            <p style="color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(scores.summary)}</p>
            <p style="color:#475569;font-size:13px;">Video invite sent. Source: ${escapeHtml(appData.source)}</p>`));
        }
        else {
            // FAIL → send rejection
            await docRef.update({
                appScores: scores,
                status: "rejected",
                decision: "reject",
                decisionAt: firestore_2.FieldValue.serverTimestamp(),
            });
            await sendHiringEmail([appData.email], "Update on Your Garage Scholars Application", rejectionEmail(firstName(appData.name), "application"));
            // Notify founders
            await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring] ${safeName} REJECTED at app screen (${scores.composite_score}/100)`, emailWrapper("Applicant Rejected", `${safeName} — Score: ${scores.composite_score}/100`, `
            <p style="color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(scores.summary)}</p>
            ${scores.red_flags.length ? `<p style="color:#991b1b;font-size:13px;">Red flags: ${scores.red_flags.map(f => escapeHtml(f)).join(", ")}</p>` : ""}
            <p style="color:#475569;font-size:13px;">Rejection email sent. Source: ${escapeHtml(appData.source)}</p>`));
        }
    }
    catch (error) {
        console.error(`[Hiring] Failed to score application ${appId}:`, error);
        // Alert founders on failure
        await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring ERROR] Failed to score: ${safeName}`, emailWrapper("Scoring Error", appId, `
          <p style="color:#991b1b;font-size:14px;">Application scoring failed. Manual review needed.</p>
          <p style="color:#475569;font-size:13px;">Applicant: ${safeName} (${escapeHtml(appData.email || "")})</p>
          <p style="color:#475569;font-size:13px;">Error: ${escapeHtml(error instanceof Error ? error.message : "Unknown")}</p>`));
    }
});
// ════════════════════════════════════════════════════════════════════
// SECTION 5: PIPELINE FUNCTION 2 — Video Transcription + AI Scoring
// ════════════════════════════════════════════════════════════════════
/**
 * Triggered when the video recording app signals completion.
 * Downloads videos from Storage, scores with Gemini (native video input),
 * then auto-sends Zoom invite or rejection.
 */
exports.gsProcessVideoCompletion = (0, firestore_1.onDocumentCreated)({
    document: `${gs_constants_1.GS_COLLECTIONS.HIRING_VIDEO_COMPLETIONS}/{completionId}`,
    memory: "1GiB",
    timeoutSeconds: 300,
    secrets: ["GEMINI_API_KEY"],
}, async (event) => {
    const completion = event.data?.data();
    if (!completion)
        return;
    const { applicantId, storagePaths } = completion;
    const applicantRef = db.collection(gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS).doc(applicantId);
    const applicantSnap = await applicantRef.get();
    if (!applicantSnap.exists) {
        console.error(`[Hiring] Video completion for unknown applicant: ${applicantId}`);
        return;
    }
    const applicant = applicantSnap.data();
    console.log(`[Hiring] Processing video completion for ${applicantId} (${applicant.name})`);
    try {
        // Update status to scoring
        await applicantRef.update({
            status: "video_scoring",
            videoStoragePaths: storagePaths,
            videoCompletedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Score all videos with Gemini (native video input — no transcription needed)
        console.log(`[Hiring] Scoring ${storagePaths.length} videos with Gemini for ${applicantId}`);
        const scores = await scoreVideosWithGemini(storagePaths, applicant.name);
        console.log(`[Hiring] Video scores for ${applicantId}: composite=${scores.composite_score}, pass=${scores.pass}`);
        if (scores.pass) {
            // PASS → send Zoom scheduling invite
            await applicantRef.update({
                videoScores: scores,
                status: "zoom_invited",
                zoomInvitedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            await sendHiringEmail([applicant.email], "Garage Scholars — Let's Talk (15 min Zoom)", zoomInviteEmail(firstName(applicant.name), CAL_LINK));
            // Notify founders
            await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring] ${escapeHtml(applicant.name)} PASSED video screen (${scores.composite_score}/100)`, emailWrapper("Video Screen Passed", `${escapeHtml(applicant.name)} — Video: ${scores.composite_score}/100`, `
            <p style="color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(scores.summary)}</p>
            ${scores.strengths.length ? `<p style="color:#166534;font-size:13px;">Strengths: ${scores.strengths.map(s => escapeHtml(s)).join(", ")}</p>` : ""}
            ${scores.concerns.length ? `<p style="color:#92400e;font-size:13px;">Concerns: ${scores.concerns.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
            <p style="color:#475569;font-size:13px;">Zoom invite sent.</p>`));
        }
        else {
            // FAIL → reject
            await applicantRef.update({
                videoScores: scores,
                status: "rejected",
                decision: "reject",
                decisionAt: firestore_2.FieldValue.serverTimestamp(),
            });
            await sendHiringEmail([applicant.email], "Update on Your Garage Scholars Application", rejectionEmail(firstName(applicant.name), "video"));
            await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring] ${escapeHtml(applicant.name)} REJECTED at video screen (${scores.composite_score}/100)`, emailWrapper("Video Screen Failed", `${escapeHtml(applicant.name)} — Video: ${scores.composite_score}/100`, `
            <p style="color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(scores.summary)}</p>
            ${scores.red_flags.length ? `<p style="color:#991b1b;font-size:13px;">Red flags: ${scores.red_flags.map(f => escapeHtml(f)).join(", ")}</p>` : ""}
            <p style="color:#475569;font-size:13px;">Rejection email sent.</p>`));
        }
    }
    catch (error) {
        console.error(`[Hiring] Failed to process videos for ${applicantId}:`, error);
        await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring ERROR] Video processing failed: ${escapeHtml(applicant.name)}`, emailWrapper("Video Processing Error", applicantId, `
          <p style="color:#991b1b;font-size:14px;">Video scoring failed. Manual review needed.</p>
          <p style="color:#475569;font-size:13px;">Applicant: ${escapeHtml(applicant.name)} (${escapeHtml(applicant.email)})</p>
          <p style="color:#475569;font-size:13px;">Error: ${escapeHtml(error instanceof Error ? error.message : "Unknown")}</p>`));
    }
});
// ════════════════════════════════════════════════════════════════════
// SECTION 6: PIPELINE FUNCTION 3 — Cal.com Booking Webhook
// ════════════════════════════════════════════════════════════════════
/**
 * HTTP endpoint that receives Cal.com booking webhooks.
 * Sends a founder dossier email with all scores + video links.
 */
exports.gsCalBookingWebhook = (0, https_1.onRequest)({ memory: "256MiB", timeoutSeconds: 30, secrets: ["CAL_WEBHOOK_SECRET"] }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    // Verify Cal.com webhook signature
    const calSecret = process.env.CAL_WEBHOOK_SECRET;
    if (calSecret) {
        const signature = req.headers["x-cal-signature-256"];
        const expectedSig = crypto
            .createHmac("sha256", calSecret)
            .update(JSON.stringify(req.body))
            .digest("hex");
        if (!signature || signature !== expectedSig) {
            console.error("[Hiring] Cal.com webhook signature mismatch");
            res.status(401).send("Invalid signature");
            return;
        }
    }
    try {
        const payload = req.body;
        // Cal.com sends booking data with attendee email
        const attendeeEmail = payload?.payload?.attendees?.[0]?.email
            || payload?.attendees?.[0]?.email;
        const startTime = payload?.payload?.startTime || payload?.startTime || "TBD";
        if (!attendeeEmail) {
            console.error("[Hiring] Cal.com webhook missing attendee email");
            res.status(400).send("Missing attendee email");
            return;
        }
        // Find applicant by email
        const snapshot = await db
            .collection(gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS)
            .where("email", "==", attendeeEmail)
            .where("status", "==", "zoom_invited")
            .limit(1)
            .get();
        if (snapshot.empty) {
            console.warn(`[Hiring] No zoom_invited applicant found for email: ${attendeeEmail}`);
            res.status(404).send("Applicant not found");
            return;
        }
        const doc = snapshot.docs[0];
        const applicant = doc.data();
        // Update status
        await doc.ref.update({
            status: "zoom_scheduled",
            zoomScheduledAt: firestore_2.FieldValue.serverTimestamp(),
            calBookingUrl: payload?.payload?.metadata?.videoCallUrl || "",
        });
        // Format the zoom time
        const zoomTime = new Date(startTime).toLocaleString("en-US", {
            timeZone: "America/Denver",
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
        // Send dossier to founders
        await sendHiringEmail(FOUNDER_EMAILS, `[GS INTERVIEW] ${escapeHtml(applicant.name)} — ${escapeHtml(zoomTime)}`, await founderDossierEmail(applicant, zoomTime));
        console.log(`[Hiring] Dossier sent for ${applicant.name}, Zoom at ${zoomTime}`);
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error("[Hiring] Cal.com webhook error:", error);
        res.status(500).send("Internal error");
    }
});
// ════════════════════════════════════════════════════════════════════
// SECTION 7: PIPELINE FUNCTION 4 — Decision Engine
// ════════════════════════════════════════════════════════════════════
/**
 * Triggered when a founder submits post-interview scores.
 * Calculates the weighted final composite and executes the decision:
 * 75+ = HIRE (auto offer), 60-74 = REVIEW, <60 = REJECT.
 */
exports.gsProcessInterviewScore = (0, firestore_1.onDocumentCreated)({
    document: `${gs_constants_1.GS_COLLECTIONS.HIRING_INTERVIEW_SCORES}/{scoreId}`,
    memory: "256MiB",
    timeoutSeconds: 60,
}, async (event) => {
    const scoreEvent = event.data?.data();
    if (!scoreEvent)
        return;
    const { applicantId, scores } = scoreEvent;
    const applicantRef = db.collection(gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS).doc(applicantId);
    const applicantSnap = await applicantRef.get();
    if (!applicantSnap.exists) {
        console.error(`[Hiring] Interview score for unknown applicant: ${applicantId}`);
        return;
    }
    const applicant = applicantSnap.data();
    console.log(`[Hiring] Processing interview scores for ${applicantId} (${applicant.name})`);
    try {
        // Calculate zoom score (avg of Q1-Q6, scaled to 0-100)
        const zoomAvg = (scores.q1_dependability +
            scores.q2_problem_solving +
            scores.q3_customer_interaction +
            scores.q4_practical_skills +
            scores.q5_coachability +
            scores.q6_growth_mindset) /
            6;
        // Calculate weighted final composite (Step 6.6)
        const appPoints = applicant.appScores
            ? (applicant.appScores.composite_score / 100) * (gs_hiring_types_1.DECISION_WEIGHTS.APP_SCORE * 100)
            : 0;
        const videoPoints = applicant.videoScores
            ? (applicant.videoScores.composite_score / 100) * (gs_hiring_types_1.DECISION_WEIGHTS.VIDEO_SCORE * 100)
            : 0;
        const zoomPoints = (zoomAvg / 5) * (gs_hiring_types_1.DECISION_WEIGHTS.ZOOM_SCORE * 100);
        const finalComposite = Math.round(appPoints + videoPoints + zoomPoints);
        // Apply decision logic
        let decision;
        let decisionLabel;
        // Gut check override (Step 6.6)
        if (scores.gut_check === "no") {
            decision = "review";
            decisionLabel = "REVIEW";
        }
        else if (finalComposite >= gs_hiring_types_1.DECISION_THRESHOLDS.HIRE) {
            decision = "hire";
            decisionLabel = "HIRE";
        }
        else if (finalComposite >= gs_hiring_types_1.DECISION_THRESHOLDS.REVIEW_MIN) {
            // 60-74 range → always route to founder review
            decision = "review";
            decisionLabel = "REVIEW";
        }
        else {
            decision = "reject";
            decisionLabel = "REJECT";
        }
        // Update applicant record
        await applicantRef.update({
            interviewScores: scores,
            finalComposite,
            status: decision === "hire" ? "hired" : decision === "reject" ? "rejected" : "review_needed",
            decision,
            decisionAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Execute decision
        if (decision === "hire") {
            // Auto-send offer email
            await sendHiringEmail([applicant.email], "Welcome to Garage Scholars", offerEmail(firstName(applicant.name)));
        }
        else if (decision === "reject") {
            // Auto-send final rejection
            await sendHiringEmail([applicant.email], "Update on Your Garage Scholars Application", rejectionEmail(firstName(applicant.name), "final"));
        }
        // For "review" — no email to candidate until founder decides
        // Always send decision summary to founders
        const founderEmailHtml = decision === "review"
            ? await founderReviewEmail({ ...applicant, interviewScores: scores }, finalComposite)
            : decisionSummaryEmail({ ...applicant, interviewScores: scores }, decisionLabel, finalComposite);
        await sendHiringEmail(FOUNDER_EMAILS, `[GS DECISION] ${escapeHtml(applicant.name)} — ${decisionLabel} (${finalComposite}/100)`, founderEmailHtml);
        console.log(`[Hiring] Decision for ${applicant.name}: ${decisionLabel} (${finalComposite}/100)`);
    }
    catch (error) {
        console.error(`[Hiring] Decision engine failed for ${applicantId}:`, error);
        await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring ERROR] Decision engine failed: ${escapeHtml(applicant.name)}`, emailWrapper("Decision Error", applicantId, `
          <p style="color:#991b1b;font-size:14px;">Decision calculation failed. Manual review needed.</p>
          <p style="color:#475569;font-size:13px;">Error: ${escapeHtml(error instanceof Error ? error.message : "Unknown")}</p>`));
    }
});
// ════════════════════════════════════════════════════════════════════
// SECTION 8: PIPELINE FUNCTION 5 — Weekly Digest
// ════════════════════════════════════════════════════════════════════
/**
 * Runs every Monday at 8:00 AM MST.
 * Sends founders a pipeline summary with counts per stage.
 */
exports.gsHiringWeeklyDigest = (0, scheduler_1.onSchedule)({
    schedule: "0 15 * * 1", // 15:00 UTC = 8:00 AM MST
    timeZone: "America/Denver",
    memory: "256MiB",
    timeoutSeconds: 60,
}, async () => {
    console.log("[Hiring] Generating weekly digest");
    try {
        const snapshot = await db.collection(gs_constants_1.GS_COLLECTIONS.HIRING_APPLICANTS).get();
        const applicants = snapshot.docs.map((d) => d.data());
        // Count by status
        const counts = {};
        for (const a of applicants) {
            counts[a.status] = (counts[a.status] || 0) + 1;
        }
        // Count from last 7 days
        const weekAgo = firestore_2.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const newThisWeek = applicants.filter((a) => a.appliedAt && a.appliedAt.toMillis() > weekAgo.toMillis()).length;
        const hiredThisWeek = applicants.filter((a) => a.decision === "hire" && a.decisionAt && a.decisionAt.toMillis() > weekAgo.toMillis()).length;
        const rejectedThisWeek = applicants.filter((a) => a.decision === "reject" && a.decisionAt && a.decisionAt.toMillis() > weekAgo.toMillis()).length;
        const rows = [
            ["New Applications (7d)", String(newThisWeek)],
            ["Pending AI Score", String(counts["pending_ai"] || 0)],
            ["Video Invited", String(counts["video_invited"] || 0)],
            ["Pending Video", String(counts["pending_video"] || 0)],
            ["Zoom Invited", String(counts["zoom_invited"] || 0)],
            ["Zoom Scheduled", String(counts["zoom_scheduled"] || 0)],
            ["Awaiting Decision", String(counts["pending_decision"] || 0)],
            ["Review Needed", String(counts["review_needed"] || 0)],
            ["Hired (7d)", String(hiredThisWeek)],
            ["Rejected (7d)", String(rejectedThisWeek)],
            ["Total All-Time", String(applicants.length)],
        ];
        const tableRows = rows
            .map(([label, val]) => `<tr><td style="padding:8px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">${label}</td>
             <td style="padding:8px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${val}</td></tr>`)
            .join("");
        await sendHiringEmail(FOUNDER_EMAILS, `[GS Hiring] Weekly Pipeline Digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, emailWrapper("Hiring Pipeline Digest", "Weekly Summary", `
          <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows}</table>`));
        console.log("[Hiring] Weekly digest sent");
    }
    catch (error) {
        console.error("[Hiring] Weekly digest failed:", error);
    }
});
