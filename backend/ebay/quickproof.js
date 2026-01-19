// backend/ebay/quickProof.js
// ✅ PASS if we can call an authenticated eBay endpoint using the token stored in Firestore.

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { getAccessToken } = require("./ebayAuth");

if (!admin.apps.length) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error("❌ FAIL: Missing GCLOUD_PROJECT or FIREBASE_PROJECT_ID in backend/.env");
    process.exit(1);
  }

  const credentialsPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json"
  );
  if (!fs.existsSync(credentialsPath)) {
    console.error(`❌ FAIL: Service account not found at ${credentialsPath}`);
    process.exit(1);
  }
  const serviceAccount = require(credentialsPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  console.log("Firebase initialized with projectId =", projectId);
}


async function main() {
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const accessToken = await getAccessToken(db); // reads Firestore (integrations/ebay) and refreshes if needed
  if (!accessToken || typeof accessToken !== "string") {
    console.error("❌ FAIL: getAccessToken(db) returned empty token");
    process.exit(1);
  }

  const url = "https://api.ebay.com/sell/account/v1/privilege";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const bodyText = await res.text();
  let bodyJson = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch (error) {
    bodyJson = null;
  }

  if (res.ok) {
    console.log("✅ PASS: eBay is linked and token works.");
    console.log("Status:", res.status);
    console.log(bodyJson || bodyText.slice(0, 800));
    process.exit(0);
  }

  console.error("❌ FAIL: eBay call failed.");
  console.error("Status:", res.status);
  console.error(bodyJson || bodyText.slice(0, 2000));
  process.exit(2);
}

main().catch((e) => {
  console.error("❌ FAIL: Script crashed:", e);
  process.exit(3);
});
