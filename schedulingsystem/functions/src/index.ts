import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import OpenAI from "openai";

initializeApp();

const db = getFirestore();
const storage = getStorage();

type SopSectionStep = {
  id: string;
  text: string;
  requiresApproval?: boolean;
  requiredPhotoKey?: string;
};

type SopSection = {
  title: string;
  steps: SopSectionStep[];
};

type SopRequiredPhoto = {
  key: string;
  label: string;
  required: boolean;
};

type SopPayload = {
  jobId: string;
  qaStatus: "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  brandStyleVersion: "v1";
  sections: SopSection[];
  requiredPhotos: SopRequiredPhoto[];
};

const parseJsonStrict = (raw: string): SopPayload => {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in response.");
  }
  const slice = trimmed.slice(start, end + 1);
  const parsed = JSON.parse(slice) as SopPayload;
  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid SOP: missing sections array.");
  }
  if (!parsed.requiredPhotos || !Array.isArray(parsed.requiredPhotos)) {
    throw new Error("Invalid SOP: missing requiredPhotos array.");
  }
  return parsed;
};

const buildPrompt = (job: FirebaseFirestore.DocumentData, imageUrls: string[]) => {
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

export const generateSopForJob = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { jobId } = request.data as { jobId?: string };
  if (!jobId) {
    throw new HttpsError("invalid-argument", "Missing jobId.");
  }

  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  const userRole = userSnap.exists ? userSnap.data()?.role : null;
  if (userRole !== "ADMIN") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new HttpsError("failed-precondition", "OPENAI_API_KEY is not configured.");
  }

  const jobRef = db.collection("jobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new HttpsError("not-found", "Job not found.");
  }

  const jobData = { id: jobSnap.id, ...jobSnap.data() } as { id: string; intakeMediaPaths?: string[] } & FirebaseFirestore.DocumentData;
  const intakePaths: string[] = Array.isArray(jobData.intakeMediaPaths) ? jobData.intakeMediaPaths : [];
  const bucket = storage.bucket();
  const imageUrls = await Promise.all(intakePaths.map(async (path) => {
    const [url] = await bucket.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000
    });
    return url;
  }));

  const openai = new OpenAI({ apiKey: openaiKey });
  const prompt = buildPrompt(jobData, imageUrls);

  const runCompletion = async () => {
    const imageParts = imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url }
    })) as any;
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
          ] as any
        }
      ]
    });
    return response.choices[0]?.message?.content || "";
  };

  let parsed: SopPayload | null = null;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await runCompletion();
      parsed = parseJsonStrict(raw);
      break;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (!parsed) {
    throw new HttpsError("internal", `Failed to parse SOP JSON: ${lastError?.message || "unknown"}`);
  }

  const sopRef = db.collection("sops").doc();
  const sopDoc: SopPayload = {
    jobId,
    qaStatus: "NEEDS_REVIEW",
    brandStyleVersion: "v1",
    sections: parsed.sections,
    requiredPhotos: parsed.requiredPhotos
  };

  await sopRef.set({
    ...sopDoc,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await jobRef.set({
    sopId: sopRef.id,
    status: "SOP_NEEDS_REVIEW",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, sopId: sopRef.id };
});
