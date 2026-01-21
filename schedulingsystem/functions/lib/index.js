"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSopForJob = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const openai_1 = __importDefault(require("openai"));
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const storage = (0, storage_1.getStorage)();
const parseJsonStrict = (raw) => {
    const trimmed = raw.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) {
        throw new Error("No JSON object found in response.");
    }
    const slice = trimmed.slice(start, end + 1);
    const parsed = JSON.parse(slice);
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
        throw new Error("Invalid SOP: missing sections array.");
    }
    if (!parsed.requiredPhotos || !Array.isArray(parsed.requiredPhotos)) {
        throw new Error("Invalid SOP: missing requiredPhotos array.");
    }
    return parsed;
};
const buildPrompt = (job, imageUrls) => {
    return {
        system: [
            "You are an SOP generator for Garage Scholars.",
            "Return JSON only, with no markdown and no extra text.",
            "Schema must match:",
            "{ jobId, qaStatus, brandStyleVersion, sections: [{ title, steps: [{ id, text, requiresApproval?, requiredPhotoKey? }] }], requiredPhotos: [{ key, label, required }] }",
            "Rules:",
            "- qaStatus must be 'NEEDS_REVIEW'",
            "- brandStyleVersion must be 'v1'",
            "- steps must be dummy-proof, safety-first, and zone-by-zone",
            "- include before/after photo requirements and QC checks",
            "- include at least 3 requiredPhotos",
            "- keep text concise and operational"
        ].join("\n"),
        userText: [
            `Job ID: ${job.id}`,
            `Client: ${job.clientName || "Unknown"}`,
            `Address: ${job.address || "Unknown"}`,
            `Description: ${job.description || ""}`,
            `Access Constraints: ${job.accessConstraints || ""}`,
            `Sell vs Keep: ${job.sellVsKeepPreference || ""}`,
            `Intake images provided: ${imageUrls.length}`
        ].join("\n")
    };
};
exports.generateSopForJob = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { jobId } = request.data;
    if (!jobId) {
        throw new https_1.HttpsError("invalid-argument", "Missing jobId.");
    }
    const userSnap = await db.collection("users").doc(request.auth.uid).get();
    const userRole = userSnap.exists ? userSnap.data()?.role : null;
    if (userRole !== "ADMIN") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        throw new https_1.HttpsError("failed-precondition", "OPENAI_API_KEY is not configured.");
    }
    const jobRef = db.collection("jobs").doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        throw new https_1.HttpsError("not-found", "Job not found.");
    }
    const jobData = { id: jobSnap.id, ...jobSnap.data() };
    const intakePaths = Array.isArray(jobData.intakeMediaPaths) ? jobData.intakeMediaPaths : [];
    const bucket = storage.bucket();
    const imageUrls = await Promise.all(intakePaths.map(async (path) => {
        const [url] = await bucket.file(path).getSignedUrl({
            action: "read",
            expires: Date.now() + 60 * 60 * 1000
        });
        return url;
    }));
    const openai = new openai_1.default({ apiKey: openaiKey });
    const prompt = buildPrompt(jobData, imageUrls);
    const runCompletion = async () => {
        const imageParts = imageUrls.map((url) => ({
            type: "image_url",
            image_url: { url }
        }));
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
                { role: "system", content: prompt.system },
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt.userText },
                        ...imageParts
                    ]
                }
            ]
        });
        return response.choices[0]?.message?.content || "";
    };
    let parsed = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const raw = await runCompletion();
            parsed = parseJsonStrict(raw);
            break;
        }
        catch (error) {
            lastError = error;
        }
    }
    if (!parsed) {
        throw new https_1.HttpsError("internal", `Failed to parse SOP JSON: ${lastError?.message || "unknown"}`);
    }
    const sopRef = db.collection("sops").doc();
    const sopDoc = {
        jobId,
        qaStatus: "NEEDS_REVIEW",
        brandStyleVersion: "v1",
        sections: parsed.sections,
        requiredPhotos: parsed.requiredPhotos
    };
    await sopRef.set({
        ...sopDoc,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp()
    });
    await jobRef.set({
        sopId: sopRef.id,
        status: "SOP_NEEDS_REVIEW",
        updatedAt: firestore_1.FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, sopId: sopRef.id };
});
