"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.declineSignup = exports.approveSignup = exports.generateSopForJob = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const storage_1 = require("firebase-admin/storage");
const openai_1 = __importDefault(require("openai"));
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const storage = (0, storage_1.getStorage)();
const adminAuth = (0, auth_1.getAuth)();
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
    if (userRole !== "admin") {
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
const requireAdmin = async (uid) => {
    const userSnap = await db.collection("users").doc(uid).get();
    const role = userSnap.exists ? userSnap.data()?.role : null;
    if (role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
};
exports.approveSignup = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { requestId } = request.data;
    if (!requestId) {
        throw new https_1.HttpsError("invalid-argument", "Missing requestId.");
    }
    await requireAdmin(request.auth.uid);
    const requestRef = db.collection("signupRequests").doc(requestId);
    const reqSnap = await requestRef.get();
    if (!reqSnap.exists) {
        throw new https_1.HttpsError("not-found", "Signup request not found.");
    }
    const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
    if (userQuery.empty) {
        throw new https_1.HttpsError("not-found", "User for request not found.");
    }
    const userDoc = userQuery.docs[0];
    await requestRef.set({
        status: "approved",
        decidedAt: firestore_1.FieldValue.serverTimestamp(),
        decidedByUid: request.auth.uid
    }, { merge: true });
    await userDoc.ref.set({
        role: "scholar",
        status: "active",
        approvedAt: firestore_1.FieldValue.serverTimestamp(),
        approvedByUid: request.auth.uid
    }, { merge: true });
    return { ok: true };
});
exports.declineSignup = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { requestId } = request.data;
    if (!requestId) {
        throw new https_1.HttpsError("invalid-argument", "Missing requestId.");
    }
    await requireAdmin(request.auth.uid);
    const requestRef = db.collection("signupRequests").doc(requestId);
    const reqSnap = await requestRef.get();
    if (!reqSnap.exists) {
        throw new https_1.HttpsError("not-found", "Signup request not found.");
    }
    const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
    const userDoc = userQuery.empty ? null : userQuery.docs[0];
    await requestRef.set({
        status: "declined",
        decidedAt: firestore_1.FieldValue.serverTimestamp(),
        decidedByUid: request.auth.uid
    }, { merge: true });
    if (userDoc) {
        await userDoc.ref.set({
            status: "disabled"
        }, { merge: true });
        await adminAuth.deleteUser(userDoc.id).catch(() => null);
    }
    return { ok: true };
});
