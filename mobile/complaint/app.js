/**
 * Garage Scholars — Customer Complaint Page
 *
 * Calls the gsSubmitComplaint Cloud Function.
 * URL: ?jobId=xxx
 */

// Firebase config — same project as the mobile app
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC_Y_euiDy2ppUkY1H5lDSRsKvOmBxJMAA",
  authDomain: "garage-scholars-v2.firebaseapp.com",
  projectId: "garage-scholars-v2",
  storageBucket: "garage-scholars-v2.firebasestorage.app",
  messagingSenderId: "755927476958",
  appId: "1:755927476958:web:a18efb2c3e5c4d3f2f3e4a",
};

let app, functions;

// Initialize Firebase from CDN (loaded via module)
async function initFirebase() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
  );
  const { getFunctions, httpsCallable } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js"
  );

  app = initializeApp(FIREBASE_CONFIG);
  functions = getFunctions(app);
  window._httpsCallable = httpsCallable;
  window._functions = functions;
}

// Extract jobId from URL
function getJobIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("jobId") || "";
}

// File → base64 data URL
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Photo selection
const photoFiles = [];

document.getElementById("hidden-input").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    if (photoFiles.length >= 5) break; // max 5 photos
    photoFiles.push(file);
    const url = await fileToDataUrl(file);
    const img = document.createElement("img");
    img.src = url;
    img.className = "photo-thumb";
    document.getElementById("photo-preview").appendChild(img);
  }
});

// Submit complaint
async function submitComplaint() {
  const jobId = document.getElementById("jobId").value.trim();
  const description = document.getElementById("description").value.trim();
  const errorEl = document.getElementById("error-msg");
  const btn = document.getElementById("submit-btn");

  // Clear error
  errorEl.style.display = "none";

  if (!jobId) {
    errorEl.textContent = "Job ID is missing. Please use the link provided in your email.";
    errorEl.style.display = "block";
    return;
  }

  if (!description) {
    errorEl.textContent = "Please describe the issue before submitting.";
    errorEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    // Upload photos to data URLs (Cloud Function will handle storage)
    const photoUrls = [];
    for (const file of photoFiles) {
      const dataUrl = await fileToDataUrl(file);
      photoUrls.push(dataUrl);
    }

    const gsSubmitComplaint = window._httpsCallable(window._functions, "gsSubmitComplaint");
    await gsSubmitComplaint({ jobId, description, photoUrls });

    // Show success
    document.getElementById("form-section").style.display = "none";
    document.getElementById("success-section").style.display = "block";
  } catch (err) {
    console.error("Submit failed:", err);
    const msg =
      err.message || "Failed to submit complaint. Please try again.";
    errorEl.textContent = msg;
    errorEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Submit Complaint";
  }
}

// Init
(async () => {
  await initFirebase();
  document.getElementById("jobId").value = getJobIdFromUrl();
})();
