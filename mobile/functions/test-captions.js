/**
 * Test script for social media captions - resale, donation, gym install
 * Run from functions directory: node test-captions.js
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Initialize with ADC (gcloud auth application-default login)
initializeApp({ projectId: "garage-scholars-v2" });
const db = getFirestore();

// Load compiled caption logic
const socialModule = require("./lib/gs-social");

async function createTestEntries() {
  console.log("Creating 3 test social queue entries...\n");

  const batch = db.batch();

  const resaleRef = db.collection("gs_socialContentQueue").doc("test_resale_caption");
  batch.set(resaleRef, {
    jobId: "test_job_resale",
    scholarId: "test_scholar",
    jobTitle: "Full Garage Transformation",
    address: "1234 Cherry Creek Dr, Denver, CO",
    packageTier: "Premium",
    contentType: "resale",
    itemName: "DeWalt 20V Cordless Drill Set",
    itemPhotos: [],
    beforePhotoUrl: "",
    afterPhotoUrl: "",
    status: "test",
    retryCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  const donationRef = db.collection("gs_socialContentQueue").doc("test_donation_caption");
  batch.set(donationRef, {
    jobId: "test_job_donation",
    scholarId: "test_scholar",
    jobTitle: "Garage Cleanup and Organization",
    address: "5678 Broadway, Denver, CO",
    packageTier: "Standard",
    contentType: "donation",
    itemName: "Box of children clothing and toys",
    itemPhotos: [],
    beforePhotoUrl: "",
    afterPhotoUrl: "",
    status: "test",
    retryCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  const gymRef = db.collection("gs_socialContentQueue").doc("test_gym_caption");
  batch.set(gymRef, {
    jobId: "test_job_gym",
    scholarId: "test_scholar",
    jobTitle: "Garage to Home Gym Conversion",
    address: "9012 Colfax Ave, Denver, CO",
    packageTier: "Premium",
    contentType: "gym_install",
    itemName: "Rogue Squat Rack, Concept2 Rower, Rogue Dumbbells",
    itemPhotos: [],
    beforePhotoUrl: "",
    afterPhotoUrl: "",
    status: "test",
    retryCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log("Test entries created.\n");

  // Read them back
  for (const [name, ref] of [["Resale", resaleRef], ["Donation", donationRef], ["Gym", gymRef]]) {
    const snap = await ref.get();
    const d = snap.data();
    console.log(`${name}: contentType=${d.contentType}, itemName=${d.itemName}`);
  }
}

createTestEntries()
  .then(() => {
    console.log("\nDone! Check Firestore gs_socialContentQueue for test entries.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
