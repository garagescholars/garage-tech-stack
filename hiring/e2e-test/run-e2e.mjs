import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import crypto from 'crypto';

// ── Config ──
const PROJECT_ID = 'garage-scholars-v2';
const WEBHOOK_URL = 'https://gscalbookingwebhook-4rdedojp6q-uc.a.run.app';
const WEBHOOK_SECRET = 'gs-hiring-webhook-2026';
const KEEP_DATA = process.argv.includes('--keep-data');
const TEST_EMAIL = `e2e-test-${Date.now()}@garagescholars.test`;

// Collections
const APPLICANTS = 'gs_hiringApplicants';
const VIDEO_COMPLETIONS = 'gs_hiringVideoCompletions';
const INTERVIEW_SCORES = 'gs_hiringInterviewScores';
const VIDEO_TOKENS = 'gs_hiringVideoTokens';
const MAIL = 'mail';

// Initialize Firebase Admin with ADC
initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
});

const db = getFirestore();
const storage = getStorage();

// Track IDs for cleanup
const cleanup = {
  applicantId: null,
  videoCompletionId: null,
  interviewScoreId: null,
  mailIds: [],
  videoFiles: [],
  localVideoFiles: [],
};

// ── Helpers ──
function log(stage, msg) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${timestamp}] [Stage ${stage}] ${msg}`);
}

function pass(stage, msg) {
  console.log(`\x1b[32m  \u2713 [Stage ${stage}] ${msg}\x1b[0m`);
}

function fail(stage, msg) {
  console.log(`\x1b[31m  \u2717 [Stage ${stage}] ${msg}\x1b[0m`);
}

function warn(stage, msg) {
  console.log(`\x1b[33m  \u26a0 [Stage ${stage}] ${msg}\x1b[0m`);
}

async function pollDoc(collection, docId, condition, timeoutMs, interval = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await db.collection(collection).doc(docId).get();
    if (snap.exists && condition(snap.data())) {
      return snap.data();
    }
    await new Promise((r) => setTimeout(r, interval));
    process.stdout.write('.');
  }
  console.log('');
  return null;
}

function generateTestVideo(index) {
  const filename = `/tmp/gs_test_video_${index}.webm`;
  try {
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=blue:s=320x240:d=3" -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=44100" -shortest -c:v libvpx -c:a libopus "${filename}"`,
      { stdio: 'pipe' }
    );
    return filename;
  } catch (err) {
    throw new Error(`Failed to generate test video ${index}: ${err.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════
// STAGE 1: Application Submission
// ════════════════════════════════════════════════════════════════════
async function stage1() {
  log(1, 'Submitting test application...');

  const applicantData = {
    name: 'E2E Test Candidate',
    email: TEST_EMAIL,
    phone: '(303) 555-0199',
    source: 'direct',
    q1_transport: 'I have a 2022 Toyota Tacoma. I live in Denver and drive across the metro daily for my current landscaping job. Happy to go wherever.',
    q2_tools: 'I own a DeWalt 20V drill, impact driver, circular saw, orbital sander, level, stud finder, tape measure, speed square, and a full set of wrenches and sockets.',
    q3_project: 'I built floating shelves in my apartment from scratch. Measured the wall, located studs with a stud finder, used a french cleat mounting system. Cut all the lumber myself with a circular saw, sanded and stained with 3 coats. They hold 60+ lbs of books no problem.',
    q4_problem: 'First I would stop and assess. If I cracked a shelf or hit something wrong, I would call the homeowner immediately and be honest about it. Then I would figure out if I can fix it on the spot or if we need a different approach. I always document with photos so we have a record.',
    q5_availability: 'Available Monday through Saturday, any time. No other commitments that would conflict. I can start as soon as needed.',
    q6_interest: 'I love working with my hands and seeing a real transformation. The idea of turning a messy garage into something clean and organized sounds incredibly satisfying. Plus I want to learn how a startup operates from the ground up.',
    status: 'pending_ai',
    appliedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection(APPLICANTS).add(applicantData);
  cleanup.applicantId = docRef.id;
  log(1, `Created applicant doc: ${docRef.id}`);

  // Poll for AI scoring (up to 120s)
  log(1, 'Waiting for Claude to score application (up to 120s)...');
  const result = await pollDoc(APPLICANTS, docRef.id, (d) => d.status !== 'pending_ai', 120000);

  if (!result) {
    fail(1, 'TIMEOUT: Application was not scored within 120 seconds');
    return null;
  }

  if (result.appScores) {
    pass(1, `Application scored: ${result.appScores.composite_score}/100 (pass: ${result.appScores.pass})`);
    log(1, `Summary: ${result.appScores.summary}`);
  }

  if (result.status === 'video_invited') {
    pass(1, 'Status -> video_invited (PASSED app screen)');
  } else if (result.status === 'rejected') {
    warn(1, `Status -> rejected (score: ${result.appScores?.composite_score})`);
    log(1, `Red flags: ${JSON.stringify(result.appScores?.red_flags || [])}`);
  }

  // Check mail was sent
  const mailSnap = await db.collection(MAIL).where('to', 'array-contains', TEST_EMAIL).get();
  if (!mailSnap.empty) {
    pass(1, `Email sent to candidate (${mailSnap.size} email(s))`);
    mailSnap.docs.forEach((d) => cleanup.mailIds.push(d.id));
  } else {
    warn(1, 'No email found for test candidate (may still be sending)');
  }

  // Also capture founder notification emails
  try {
    const founderMail = await db.collection(MAIL)
      .where('to', 'array-contains', 'garagescholars@gmail.com')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    founderMail.docs.forEach((d) => {
      const data = d.data();
      if (data.message?.subject?.includes('E2E Test Candidate')) {
        cleanup.mailIds.push(d.id);
      }
    });
  } catch {
    // Index may not exist for this query — non-critical
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════
// STAGE 2: Video Submission (Mock)
// ════════════════════════════════════════════════════════════════════
async function stage2() {
  log(2, 'Generating 5 mock video files with ffmpeg...');

  const localFiles = [];
  for (let i = 1; i <= 5; i++) {
    const file = generateTestVideo(i);
    localFiles.push(file);
    cleanup.localVideoFiles.push(file);
  }
  pass(2, 'Generated 5 test WebM videos');

  // Upload to Firebase Storage
  const storagePaths = [];
  const bucket = storage.bucket();

  for (let i = 0; i < 5; i++) {
    const path = `hiring-videos/${cleanup.applicantId}/video_${i + 1}.webm`;
    storagePaths.push(path);

    const fileBuffer = readFileSync(localFiles[i]);
    const file = bucket.file(path);
    await file.save(fileBuffer, {
      metadata: { contentType: 'video/webm' },
    });
    cleanup.videoFiles.push(path);
    log(2, `Uploaded video_${i + 1}.webm (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  }
  pass(2, 'All 5 videos uploaded to Firebase Storage');

  // Update applicant status to pending_video (matches what video app does)
  await db.collection(APPLICANTS).doc(cleanup.applicantId).update({
    status: 'pending_video',
  });

  // Create video completion event (triggers gsProcessVideoCompletion)
  log(2, 'Creating video completion event...');
  const completionRef = await db.collection(VIDEO_COMPLETIONS).add({
    applicantId: cleanup.applicantId,
    storagePaths: storagePaths,
    completedAt: FieldValue.serverTimestamp(),
  });
  cleanup.videoCompletionId = completionRef.id;
  log(2, `Video completion doc: ${completionRef.id}`);

  // Poll for Gemini scoring (up to 300s)
  log(2, 'Waiting for Gemini to score videos (up to 300s)...');
  const result = await pollDoc(
    APPLICANTS,
    cleanup.applicantId,
    (d) => d.status !== 'pending_video' && d.status !== 'video_scoring',
    300000,
    10000,
  );

  if (!result) {
    fail(2, 'TIMEOUT: Videos were not scored within 300 seconds');
    return null;
  }

  if (result.videoScores) {
    pass(2, `Videos scored: ${result.videoScores.composite_score}/100 (pass: ${result.videoScores.pass})`);
    log(2, `Summary: ${result.videoScores.summary}`);
    if (result.videoScores.strengths?.length) log(2, `Strengths: ${result.videoScores.strengths.join(', ')}`);
    if (result.videoScores.concerns?.length) log(2, `Concerns: ${result.videoScores.concerns.join(', ')}`);
  }

  if (result.status === 'zoom_invited') {
    pass(2, 'Status -> zoom_invited (PASSED video screen)');
  } else if (result.status === 'rejected') {
    warn(2, 'Status -> rejected at video screen (expected for mock blue-screen videos)');
    log(2, `Red flags: ${JSON.stringify(result.videoScores?.red_flags || [])}`);
    log(2, 'NOTE: Mock videos are blank -- rejection is expected. Pipeline flow is verified.');
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════
// STAGE 3: Cal.com Webhook Simulation
// ════════════════════════════════════════════════════════════════════
async function stage3() {
  log(3, 'Simulating Cal.com booking webhook...');

  const calPayload = {
    payload: {
      attendees: [{ email: TEST_EMAIL }],
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: { videoCallUrl: 'https://zoom.us/j/e2e-test-12345' },
    },
  };

  const body = JSON.stringify(calPayload);
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  log(3, `Sending signed webhook to ${WEBHOOK_URL}`);
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-signature-256': signature,
    },
    body: body,
  });

  if (response.ok) {
    pass(3, `Webhook accepted: HTTP ${response.status}`);
  } else {
    const text = await response.text();
    fail(3, `Webhook rejected: HTTP ${response.status} -- ${text}`);
    return null;
  }

  // Verify applicant status changed
  await new Promise((r) => setTimeout(r, 3000));
  const applicant = await db.collection(APPLICANTS).doc(cleanup.applicantId).get();
  const data = applicant.data();

  if (data?.status === 'zoom_scheduled') {
    pass(3, 'Status -> zoom_scheduled');
  } else {
    fail(3, `Expected status 'zoom_scheduled', got '${data?.status}'`);
  }

  // Check for founder dossier email
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const mailSnap = await db.collection(MAIL)
      .where('to', 'array-contains', 'garagescholars@gmail.com')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    const dossierMail = mailSnap.docs.find((d) =>
      d.data().message?.subject?.includes('[GS INTERVIEW]') &&
      d.data().message?.subject?.includes('E2E Test')
    );

    if (dossierMail) {
      pass(3, `Founder dossier email sent: "${dossierMail.data().message.subject}"`);
      cleanup.mailIds.push(dossierMail.id);
    } else {
      warn(3, 'Founder dossier email not found (may still be sending)');
    }
  } catch {
    warn(3, 'Could not query founder emails (index may be missing)');
  }

  return data;
}

// ════════════════════════════════════════════════════════════════════
// STAGE 4: Interview Score Submission
// ════════════════════════════════════════════════════════════════════
async function stage4() {
  log(4, 'Submitting interview scores...');

  const scoreData = {
    applicantId: cleanup.applicantId,
    scores: {
      q1_dependability: 4,
      q2_problem_solving: 5,
      q3_customer_interaction: 4,
      q4_practical_skills: 3,
      q5_coachability: 5,
      q6_growth_mindset: 4,
      gut_check: 'yes',
      notes: 'E2E test -- strong candidate, confident and articulate.',
    },
    submittedAt: FieldValue.serverTimestamp(),
  };

  const scoreRef = await db.collection(INTERVIEW_SCORES).add(scoreData);
  cleanup.interviewScoreId = scoreRef.id;
  log(4, `Interview score doc: ${scoreRef.id}`);

  // Poll for decision engine (up to 60s)
  log(4, 'Waiting for decision engine (up to 60s)...');
  const result = await pollDoc(
    APPLICANTS,
    cleanup.applicantId,
    (d) => d.finalComposite !== undefined && d.finalComposite !== null,
    60000,
  );

  if (!result) {
    fail(4, 'TIMEOUT: Decision engine did not fire within 60 seconds');
    return null;
  }

  pass(4, `Final composite: ${result.finalComposite}/100`);
  pass(4, `Decision: ${result.decision?.toUpperCase()}`);
  pass(4, `Status: ${result.status}`);

  // Score breakdown
  const appPts = result.appScores ? Math.round((result.appScores.composite_score / 100) * 20) : 0;
  const vidPts = result.videoScores ? Math.round((result.videoScores.composite_score / 100) * 30) : 0;
  const zoomAvg = (4 + 5 + 4 + 3 + 5 + 4) / 6;
  const zoomPts = Math.round((zoomAvg / 5) * 50);
  log(4, `Breakdown: App ${appPts}/20 + Video ${vidPts}/30 + Zoom ${zoomPts}/50 = ${result.finalComposite}/100`);

  // Check decision email
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const mailSnap = await db.collection(MAIL)
      .where('to', 'array-contains', 'garagescholars@gmail.com')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    const decisionMail = mailSnap.docs.find((d) =>
      d.data().message?.subject?.includes('[GS DECISION]') &&
      d.data().message?.subject?.includes('E2E Test')
    );

    if (decisionMail) {
      pass(4, `Decision email sent: "${decisionMail.data().message.subject}"`);
      cleanup.mailIds.push(decisionMail.id);
    }
  } catch {
    warn(4, 'Could not query decision emails (index may be missing)');
  }

  return result;
}

// ════════════════════════════════════════════════════════════════════
// STAGE 5: Cleanup
// ════════════════════════════════════════════════════════════════════
async function stage5() {
  if (KEEP_DATA) {
    log(5, 'Skipping cleanup (--keep-data flag set)');
    log(5, `Applicant ID: ${cleanup.applicantId}`);
    log(5, `Test email: ${TEST_EMAIL}`);
    return;
  }

  log(5, 'Cleaning up test data...');

  if (cleanup.applicantId) {
    await db.collection(APPLICANTS).doc(cleanup.applicantId).delete();
    log(5, `Deleted applicant doc: ${cleanup.applicantId}`);
  }
  if (cleanup.videoCompletionId) {
    await db.collection(VIDEO_COMPLETIONS).doc(cleanup.videoCompletionId).delete();
    log(5, 'Deleted video completion doc');
  }
  if (cleanup.interviewScoreId) {
    await db.collection(INTERVIEW_SCORES).doc(cleanup.interviewScoreId).delete();
    log(5, 'Deleted interview score doc');
  }
  if (cleanup.applicantId) {
    await db.collection(VIDEO_TOKENS).doc(cleanup.applicantId).delete().catch(() => {});
    log(5, 'Deleted video token doc');
  }

  for (const mailId of cleanup.mailIds) {
    await db.collection(MAIL).doc(mailId).delete().catch(() => {});
  }
  log(5, `Deleted ${cleanup.mailIds.length} mail docs`);

  const bucket = storage.bucket();
  for (const path of cleanup.videoFiles) {
    await bucket.file(path).delete().catch(() => {});
  }
  log(5, `Deleted ${cleanup.videoFiles.length} video files from storage`);

  for (const file of cleanup.localVideoFiles) {
    if (existsSync(file)) unlinkSync(file);
  }
  log(5, `Deleted ${cleanup.localVideoFiles.length} local temp files`);

  pass(5, 'Cleanup complete');
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551  Garage Scholars Hiring Pipeline \u2014 E2E Test   \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');
  console.log(`Test email: ${TEST_EMAIL}`);
  console.log(`Keep data: ${KEEP_DATA}\n`);

  const results = { stage1: false, stage2: false, stage3: false, stage4: false };

  try {
    // Stage 1: Application
    console.log('\n\u2500\u2500 Stage 1: Application Submission \u2500\u2500');
    const s1 = await stage1();
    results.stage1 = !!s1;

    if (!s1 || s1.status !== 'video_invited') {
      warn('1->2', 'Candidate did not pass app screen -- skipping video stage');
      console.log('\n\u2500\u2500 Stage 5: Cleanup \u2500\u2500');
      await stage5();
      printSummary(results);
      return;
    }

    // Stage 2: Video
    console.log('\n\u2500\u2500 Stage 2: Video Submission (Mock) \u2500\u2500');
    const s2 = await stage2();
    results.stage2 = !!s2;

    if (!s2 || s2.status !== 'zoom_invited') {
      warn('2->3', 'Candidate did not pass video screen -- skipping Cal.com stage');
      warn('2->3', 'This is EXPECTED for blue-screen mock videos. Pipeline flow verified.');
      console.log('\n\u2500\u2500 Stage 5: Cleanup \u2500\u2500');
      await stage5();
      printSummary(results);
      return;
    }

    // Stage 3: Cal.com Webhook
    console.log('\n\u2500\u2500 Stage 3: Cal.com Webhook Simulation \u2500\u2500');
    const s3 = await stage3();
    results.stage3 = !!s3;

    if (!s3 || s3.status !== 'zoom_scheduled') {
      warn('3->4', 'Cal.com webhook did not update status -- skipping interview stage');
      console.log('\n\u2500\u2500 Stage 5: Cleanup \u2500\u2500');
      await stage5();
      printSummary(results);
      return;
    }

    // Stage 4: Interview Scoring
    console.log('\n\u2500\u2500 Stage 4: Interview Score Submission \u2500\u2500');
    const s4 = await stage4();
    results.stage4 = !!s4;

    // Stage 5: Cleanup
    console.log('\n\u2500\u2500 Stage 5: Cleanup \u2500\u2500');
    await stage5();

    printSummary(results);
  } catch (error) {
    console.error('\n\x1b[31mFATAL ERROR\x1b[0m');
    console.error(error);

    console.log('\n\u2500\u2500 Emergency Cleanup \u2500\u2500');
    try { await stage5(); } catch (e) { console.error('Cleanup also failed:', e); }
  }
}

function printSummary(results) {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551  E2E Test Summary                              \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
  console.log(`  Stage 1 (Application):   ${results.stage1 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
  console.log(`  Stage 2 (Video):         ${results.stage2 ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mSKIP/FAIL\x1b[0m'}`);
  console.log(`  Stage 3 (Cal.com):       ${results.stage3 ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mSKIP/FAIL\x1b[0m'}`);
  console.log(`  Stage 4 (Decision):      ${results.stage4 ? '\x1b[32mPASS\x1b[0m' : '\x1b[33mSKIP/FAIL\x1b[0m'}`);
  console.log('');

  if (results.stage1 && results.stage2 && results.stage3 && results.stage4) {
    console.log('\x1b[32m  * ALL STAGES PASSED -- Pipeline is fully operational\x1b[0m\n');
  } else if (results.stage1 && results.stage2) {
    console.log('\x1b[33m  * Core pipeline working (app + video scoring). Some stages skipped.\x1b[0m\n');
  } else if (results.stage1) {
    console.log('\x1b[33m  * App scoring working. Video/later stages need investigation.\x1b[0m\n');
  } else {
    console.log('\x1b[31m  * Pipeline needs attention -- Stage 1 failed.\x1b[0m\n');
  }
}

main().catch(console.error);
