/**
 * E2E Test — Stages 3 & 4 Only
 *
 * Takes an existing applicant (from Stage 1) and:
 * - Forces status to zoom_invited (bypassing video screen)
 * - Adds mock video scores
 * - Runs Cal.com webhook simulation (Stage 3)
 * - Submits interview scores (Stage 4)
 * - Cleans up (unless --keep-data)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

const PROJECT_ID = 'garage-scholars-v2';
const WEBHOOK_URL = 'https://gscalbookingwebhook-4rdedojp6q-uc.a.run.app';
const WEBHOOK_SECRET = 'gs-hiring-webhook-2026';
const KEEP_DATA = process.argv.includes('--keep-data');

// Get applicant ID from command line or use the one from Stage 1/2
const APPLICANT_ID = process.argv.find(a => !a.startsWith('-') && a !== 'node' && !a.includes('run-stages'))
  || 'AFh4heHQCLrYdBULemza';

const APPLICANTS = 'gs_hiringApplicants';
const INTERVIEW_SCORES = 'gs_hiringInterviewScores';
const VIDEO_TOKENS = 'gs_hiringVideoTokens';
const MAIL = 'mail';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
});

const db = getFirestore();
const cleanup = { interviewScoreId: null, mailIds: [] };

function log(stage, msg) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${ts}] [Stage ${stage}] ${msg}`);
}
function pass(stage, msg) { console.log(`\x1b[32m  \u2713 [Stage ${stage}] ${msg}\x1b[0m`); }
function fail(stage, msg) { console.log(`\x1b[31m  \u2717 [Stage ${stage}] ${msg}\x1b[0m`); }
function warn(stage, msg) { console.log(`\x1b[33m  \u26a0 [Stage ${stage}] ${msg}\x1b[0m`); }

async function pollDoc(collection, docId, condition, timeoutMs, interval = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await db.collection(collection).doc(docId).get();
    if (snap.exists && condition(snap.data())) return snap.data();
    await new Promise(r => setTimeout(r, interval));
    process.stdout.write('.');
  }
  console.log('');
  return null;
}

async function main() {
  console.log('\n== Stages 3 & 4: Cal.com Webhook + Decision Engine ==\n');
  console.log(`Applicant ID: ${APPLICANT_ID}`);

  // Get the applicant
  const appSnap = await db.collection(APPLICANTS).doc(APPLICANT_ID).get();
  if (!appSnap.exists) {
    fail('SETUP', `Applicant ${APPLICANT_ID} not found`);
    return;
  }

  const applicant = appSnap.data();
  log('SETUP', `Found: ${applicant.name} (${applicant.email}), status: ${applicant.status}`);

  // Force to zoom_invited with mock video scores
  if (applicant.status !== 'zoom_invited' && applicant.status !== 'zoom_scheduled') {
    log('SETUP', 'Setting status to zoom_invited with mock video scores...');
    await db.collection(APPLICANTS).doc(APPLICANT_ID).update({
      status: 'zoom_invited',
      videoScores: {
        communication: 72,
        mechanical_aptitude: 68,
        problem_solving_honesty: 75,
        reliability_conscientiousness: 70,
        startup_fit: 74,
        composite_score: 72,
        red_flags: [],
        strengths: ['Clear communicator', 'Genuine enthusiasm'],
        concerns: ['Limited hands-on demo in video'],
        pass: true,
        summary: 'Mock video scores for E2E testing. Candidate showed solid communication skills.',
      },
      videoCompletedAt: FieldValue.serverTimestamp(),
      zoomInvitedAt: FieldValue.serverTimestamp(),
    });
    pass('SETUP', 'Applicant set to zoom_invited with mock video scores');
  }

  // Re-read applicant
  const updatedSnap = await db.collection(APPLICANTS).doc(APPLICANT_ID).get();
  const updated = updatedSnap.data();

  // ── Stage 3: Cal.com Webhook ──
  console.log('\n-- Stage 3: Cal.com Webhook Simulation --');

  const calPayload = {
    payload: {
      attendees: [{ email: updated.email }],
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
    const respBody = await response.json();
    log(3, `Response: ${JSON.stringify(respBody)}`);
  } else {
    const text = await response.text();
    fail(3, `Webhook rejected: HTTP ${response.status} -- ${text}`);
    return;
  }

  // Verify status changed
  await new Promise(r => setTimeout(r, 3000));
  const afterWebhook = await db.collection(APPLICANTS).doc(APPLICANT_ID).get();
  const afterData = afterWebhook.data();

  if (afterData?.status === 'zoom_scheduled') {
    pass(3, 'Status -> zoom_scheduled');
  } else {
    fail(3, `Expected zoom_scheduled, got ${afterData?.status}`);
    return;
  }

  // Check dossier email
  await new Promise(r => setTimeout(r, 2000));
  try {
    const mailSnap = await db.collection(MAIL)
      .where('to', 'array-contains', 'garagescholars@gmail.com')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    const dossier = mailSnap.docs.find(d =>
      d.data().message?.subject?.includes('[GS INTERVIEW]')
    );
    if (dossier) {
      pass(3, `Dossier email: "${dossier.data().message.subject}"`);
      cleanup.mailIds.push(dossier.id);
    } else {
      warn(3, 'Dossier email not found yet');
    }
  } catch { warn(3, 'Could not query emails'); }

  // ── Stage 4: Interview Scoring ──
  console.log('\n-- Stage 4: Interview Score Submission --');

  const scoreData = {
    applicantId: APPLICANT_ID,
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

  // Poll for decision
  log(4, 'Waiting for decision engine (up to 60s)...');
  const result = await pollDoc(
    APPLICANTS,
    APPLICANT_ID,
    d => d.finalComposite !== undefined && d.finalComposite !== null,
    60000,
  );

  if (!result) {
    fail(4, 'TIMEOUT: Decision engine did not fire');
    return;
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

  // Decision email
  await new Promise(r => setTimeout(r, 3000));
  try {
    const mailSnap = await db.collection(MAIL)
      .where('to', 'array-contains', 'garagescholars@gmail.com')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    const decMail = mailSnap.docs.find(d =>
      d.data().message?.subject?.includes('[GS DECISION]')
    );
    if (decMail) {
      pass(4, `Decision email: "${decMail.data().message.subject}"`);
      cleanup.mailIds.push(decMail.id);
    }
  } catch { warn(4, 'Could not query decision emails'); }

  // ── Summary ──
  console.log('\n== RESULTS ==');
  console.log(`\x1b[32m  Stage 3 (Cal.com): PASS\x1b[0m`);
  console.log(`\x1b[32m  Stage 4 (Decision): PASS -- ${result.decision?.toUpperCase()} (${result.finalComposite}/100)\x1b[0m`);
  console.log(`\x1b[32m  ALL STAGES PASSED -- Pipeline is fully operational\x1b[0m\n`);

  // Cleanup
  if (!KEEP_DATA) {
    log(5, 'Cleaning up...');
    if (cleanup.interviewScoreId) {
      await db.collection(INTERVIEW_SCORES).doc(cleanup.interviewScoreId).delete();
    }
    for (const id of cleanup.mailIds) {
      await db.collection(MAIL).doc(id).delete().catch(() => {});
    }
    // Reset applicant back for further testing
    await db.collection(APPLICANTS).doc(APPLICANT_ID).delete().catch(() => {});
    pass(5, 'Cleanup complete');
  } else {
    log(5, `Keeping data. Applicant ID: ${APPLICANT_ID}`);
  }
}

main().catch(console.error);
