import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import OpenAI from "openai";

initializeApp();

const db = getFirestore();
const storage = getStorage();
const adminAuth = getAuth();

// Admin emails that have elevated privileges
const ADMIN_EMAILS = [
  'tylerzsodia@gmail.com',
  'zach.harmon25@gmail.com'
];

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

  await requireAdmin(request.auth.uid, request.auth.token.email);

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

const requireAdmin = async (uid: string, email?: string) => {
  // Check if user email is in the admin list
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
    return;
  }

  // Fallback to checking Firestore role (for backward compatibility)
  const userSnap = await db.collection("users").doc(uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
};

export const approveSignup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) {
    throw new HttpsError("invalid-argument", "Missing requestId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const requestRef = db.collection("signupRequests").doc(requestId);
  const reqSnap = await requestRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Signup request not found.");
  }

  console.log("Looking for user with requestId:", requestId);
  const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
  console.log("User query result - empty?", userQuery.empty, "size:", userQuery.size);

  if (userQuery.empty) {
    // Try to find user by email as fallback
    const reqData = reqSnap.data();
    const email = reqData?.email;
    const name = reqData?.name || "Scholar";
    console.log("User not found by requestId, trying email:", email);

    if (email) {
      const emailQuery = await db.collection("users").where("email", "==", email).limit(1).get();
      console.log("Email query result - empty?", emailQuery.empty, "size:", emailQuery.size);

      if (!emailQuery.empty) {
        const userDoc = emailQuery.docs[0];
        console.log("Found user by email, updating with requestId");
        // Update the user doc with the requestId and approve
        await userDoc.ref.set({
          requestId,
          role: "scholar",
          status: "active",
          approvedAt: FieldValue.serverTimestamp(),
          approvedByUid: request.auth.uid
        }, { merge: true });

        await requestRef.set({
          status: "approved",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByUid: request.auth.uid
        }, { merge: true });

        return { ok: true };
      }

      // User doesn't exist in Firestore at all - find them in Firebase Auth and create the doc
      console.log("User not found in Firestore, checking Firebase Auth for email:", email);
      try {
        const authUser = await adminAuth.getUserByEmail(email);
        console.log("Found user in Firebase Auth:", authUser.uid);

        // Create the user document
        await db.collection("users").doc(authUser.uid).set({
          email,
          name,
          role: "scholar",
          status: "active",
          requestId,
          createdAt: FieldValue.serverTimestamp(),
          approvedAt: FieldValue.serverTimestamp(),
          approvedByUid: request.auth.uid
        });

        await requestRef.set({
          status: "approved",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByUid: request.auth.uid
        }, { merge: true });

        console.log("Created user document and approved");
        return { ok: true };
      } catch (authError) {
        console.error("Firebase Auth lookup failed:", authError);
      }
    }

    // Last resort: debug all users to see what's in the collection
    console.log("Failed to find user by requestId, email, or Firebase Auth");

    // Get all users to debug
    const allUsers = await db.collection("users").limit(10).get();
    console.log("Total users in collection:", allUsers.size);
    allUsers.docs.forEach(doc => {
      console.log("User doc:", doc.id, doc.data());
    });

    throw new HttpsError("not-found", `User for request not found. Checked requestId: ${requestId}, email: ${email || 'none'}`);
  }
  const userDoc = userQuery.docs[0];
  console.log("Found user document:", userDoc.id, userDoc.data());

  await requestRef.set({
    status: "approved",
    decidedAt: FieldValue.serverTimestamp(),
    decidedByUid: request.auth.uid
  }, { merge: true });

  await userDoc.ref.set({
    role: "scholar",
    status: "active",
    approvedAt: FieldValue.serverTimestamp(),
    approvedByUid: request.auth.uid
  }, { merge: true });

  return { ok: true };
});

export const declineSignup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) {
    throw new HttpsError("invalid-argument", "Missing requestId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const requestRef = db.collection("signupRequests").doc(requestId);
  const reqSnap = await requestRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Signup request not found.");
  }

  const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
  const userDoc = userQuery.empty ? null : userQuery.docs[0];

  await requestRef.set({
    status: "declined",
    decidedAt: FieldValue.serverTimestamp(),
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
