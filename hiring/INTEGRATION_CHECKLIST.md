# Garage Scholars — Hiring Pipeline Integration Checklist

**Role:** Systems Engineer, Hiring & Recruiting Operations
**System:** Zero-Touch Applicant Screening & Evaluation Pipeline
**Stack:** Firebase Cloud Functions | Firestore | Firebase Storage | Anthropic Claude | OpenAI Whisper | Cal.com
**Reference:** `Garage Scholars Documentation/garage_scholars_ hiring automation guide.docx`

---

## System Architecture Overview

```
ENTRY POINTS
├─ garagescholars.com/apply.html                    (source: "direct")
├─ garagescholars.com/apply.html?source=indeed      (Indeed job posting)
├─ garagescholars.com/apply.html?source=handshake   (Handshake posting)
├─ garagescholars.com/apply.html?source=referral    (Flyer / referral link)
└─ [standalone] hiring/application-form/index.html  (backup / direct link)
    │
    ▼ Firestore Trigger
gs_hiringApplicants → gsScoreHiringApplication (Claude AI, 4 dimensions)
    │
    ├─ PASS (≥60) → Video invite email → status: video_invited
    └─ FAIL → Rejection email → status: rejected
    │
    ▼ Firestore Trigger
gs_hiringVideoCompletions → gsProcessVideoCompletion (Whisper + Claude AI, 5 dimensions)
    │
    ├─ PASS (≥65) → Zoom invite email (Cal.com) → status: zoom_invited
    └─ FAIL → Rejection email → status: rejected
    │
    ▼ HTTP Webhook
Cal.com booking → gsCalBookingWebhook → Founder dossier email → status: zoom_scheduled
    │
    ▼ Firestore Trigger
gs_hiringInterviewScores → gsProcessInterviewScore (Weighted: App 20% + Video 30% + Zoom 50%)
    │
    ├─ ≥75 → Offer email → status: hired
    ├─ 60-74 → Founder review email → status: review_needed
    └─ <60 → Rejection email → status: rejected
    │
    ▼ Scheduled (Monday 8 AM MST)
gsHiringWeeklyDigest → Pipeline summary email to founders
```

---

## PHASE 1: Entry Point Integration

### 1.1 Website — "Join Our Team"

- [ ] `Website/src/pages/apply.html` rewritten to submit to `gs_hiringApplicants`
- [ ] Form includes: name, email, phone, source, isStudent (conditional: school, year), 6 screening questions
- [ ] Source auto-detected from URL param `?source=`
- [ ] Form writes `status: 'pending_ai'` and `appliedAt: serverTimestamp()`
- [ ] Success message: "Application Received! You'll hear from us within 24-48 hours."
- [ ] Website rebuilt: `cd Website && node build.js`
- [ ] Deployed to Vercel: `garage-scholars-website`
- [ ] Verify: Header nav "Join Our Team" → apply.html → form renders
- [ ] Verify: Footer "Join Our Team" → apply.html → form renders
- [ ] Verify: `apply.html?source=indeed` → dropdown auto-selects "Indeed"
- [ ] Verify: `apply.html?source=handshake` → dropdown auto-selects "Handshake"

### 1.2 Indeed Job Posting

- [ ] Update Indeed job posting description to include application link:
  ```
  APPLY HERE: https://garagescholars.com/apply.html?source=indeed
  ```
- [ ] Indeed posting "How to apply" section points to the URL above
- [ ] Screening questions in Indeed posting match Spec Step 6.1 (for context, not submission):
  1. Transportation & vehicle situation
  2. Tools owned/used
  3. Independent physical project
  4. Problem-solving scenario
  5. Availability & commitments
  6. Why this job interests you
- [ ] Verify: Click link from Indeed → form loads with source="indeed" pre-selected

### 1.3 Handshake Job Posting

- [ ] Update Handshake posting to include application link:
  ```
  APPLY HERE: https://garagescholars.com/apply.html?source=handshake
  ```
- [ ] Verify: Click link from Handshake → form loads with source="handshake" pre-selected

### 1.4 Referral / Flyer Distribution

- [ ] Create referral link: `https://garagescholars.com/apply.html?source=referral`
- [ ] Update any flyers / QR codes to point to this URL
- [ ] Verify: Referral link → form loads with source="referral" pre-selected

### 1.5 Standalone Backup Form

- [ ] `hiring/application-form/index.html` has URL param source detection
- [ ] Firebase config is real (not placeholder XXX values)
- [ ] Host standalone form (Firebase Hosting or Vercel) as backup entry point
- [ ] Verify: Form submits to same `gs_hiringApplicants` collection

---

## PHASE 2: Secrets & Environment Variables

### 2.1 Firebase Secrets (required for Cloud Functions)

- [ ] `OPENAI_API_KEY` — Required for Whisper video transcription
  ```bash
  cd mobile && firebase functions:secrets:set OPENAI_API_KEY
  ```
- [ ] `ANTHROPIC_API_KEY` — Required for Claude AI scoring (may already be set for SOP generator)
  ```bash
  cd mobile && firebase functions:secrets:set ANTHROPIC_API_KEY
  ```
- [ ] Verify both secrets are accessible:
  ```bash
  firebase functions:secrets:access OPENAI_API_KEY
  firebase functions:secrets:access ANTHROPIC_API_KEY
  ```

### 2.2 Environment Config (optional overrides)

- [ ] `VIDEO_APP_URL` — Base URL for video screen app (default: `https://screen.garagescholars.com`)
  - Set if hosting video app at a different domain
- [ ] `CAL_LINK` — Cal.com booking URL (default: `https://cal.com/garagescholars/interview`)
  - Set once Cal.com account is created

---

## PHASE 3: Firebase Rules & Security

### 3.1 Firestore Rules (Spec SEC-001 through SEC-007)

- [ ] `mobile/firestore.rules` includes:
  - `gs_hiringApplicants`: public create + read, admin-only update/delete
  - `gs_hiringVideoCompletions`: public create + read, admin-only update/delete
  - `gs_hiringInterviewScores`: admin-only read/write
- [ ] Deploy rules:
  ```bash
  cd mobile && firebase deploy --only firestore:rules
  ```

### 3.2 Storage Rules

- [ ] `mobile/storage.rules` includes:
  - `hiring-videos/{applicantId}/{videoFile}`: public read + write
- [ ] Deploy rules:
  ```bash
  cd mobile && firebase deploy --only storage
  ```

### 3.3 Security Verification (Spec Step 8.3)

- [ ] SEC-001: All API keys in Firebase secrets (none in code/git)
- [ ] SEC-002: Firestore admin-only rules enforced for scoring collections
- [ ] SEC-003: Video app uses Firestore document IDs (UUID-like) for applicant IDs
- [ ] SEC-005: No PII beyond answers/transcripts sent to AI APIs
- [ ] SEC-007: Rejection emails contain no scoring data (verify email templates in gs-hiring.ts)

---

## PHASE 4: Deployment

### 4.1 Cloud Functions

- [ ] Build: `cd mobile/functions && npm run build` (zero errors)
- [ ] Deploy:
  ```bash
  cd mobile && firebase deploy --only functions
  ```
- [ ] Verify 5 functions deployed:
  - `gsScoreHiringApplication`
  - `gsProcessVideoCompletion`
  - `gsCalBookingWebhook`
  - `gsProcessInterviewScore`
  - `gsHiringWeeklyDigest`

### 4.2 Website

- [ ] Build: `cd Website && node build.js`
- [ ] Deploy via Vercel (auto on push to main) or manual:
  ```bash
  cd Website && vercel --prod
  ```
- [ ] Verify live: `https://garagescholars.com/apply.html`

### 4.3 Video Screen App

- [ ] Host `hiring/video-app/index.html` at `VIDEO_APP_URL`
- [ ] Options:
  - Firebase Hosting (add target to `mobile/firebase.json`)
  - Vercel (new project pointing to `hiring/video-app/`)
  - Custom subdomain: `screen.garagescholars.com`
- [ ] Verify: Video app loads, camera permission works, test recording plays

### 4.4 Cal.com Setup

- [ ] Create Cal.com account (free tier)
- [ ] Create event type: "Garage Scholars Interview" (15-20 min)
- [ ] Connect Google Calendar for Zach & Tyler
- [ ] Configure webhook:
  - URL: `https://us-central1-garage-scholars-v2.cloudfunctions.net/gsCalBookingWebhook`
  - Events: `BOOKING_CREATED`
- [ ] Verify: Test booking fires webhook → dossier email received

---

## PHASE 5: End-to-End Testing (Spec Step 9)

### 5.1 Application Intake (FR-001, FR-002)

- [ ] Submit test application via website `apply.html` → doc created in `gs_hiringApplicants`
- [ ] Submit test application via `apply.html?source=indeed` → source field = "indeed"
- [ ] Submit test application via standalone `hiring/application-form/index.html` → same collection
- [ ] `gsScoreHiringApplication` triggers within 60 seconds
- [ ] AI scores appear on applicant doc: `appScores.composite_score`, `appScores.pass`

### 5.2 Pass/Fail Emails (FR-003, FR-004)

- [ ] Strong applicant (score ≥60): receives video invite email with unique link
- [ ] Weak applicant (score <60 or red flags): receives rejection email
- [ ] Founders receive notification email for both outcomes
- [ ] Video invite link format: `{VIDEO_APP_URL}?id={applicantId}`

### 5.3 Video Screen (FR-005, FR-006, FR-007)

- [ ] Open video link → applicant status verified as `video_invited`
- [ ] Record 5 videos (test with short clips) → videos upload to Firebase Storage
- [ ] `gs_hiringVideoCompletions` doc created → triggers `gsProcessVideoCompletion`
- [ ] Whisper transcribes all 5 videos → transcripts stored on applicant doc
- [ ] Claude scores transcripts → `videoScores` stored on applicant doc

### 5.4 Video Pass/Fail (FR-008)

- [ ] Video pass (≥65): Zoom scheduling email with Cal.com link sent
- [ ] Video fail (<65 or red flags): rejection email sent
- [ ] Founders notified with scores + strengths/concerns

### 5.5 Zoom Booking (FR-009)

- [ ] Book interview on Cal.com → webhook fires to `gsCalBookingWebhook`
- [ ] Founder dossier email received with:
  - App score + summary
  - Video score + summary + strengths/concerns
  - Contact info
  - Zoom time (Denver timezone)

### 5.6 Decision Engine (FR-010, FR-011, FR-012)

- [ ] Create `gs_hiringInterviewScores` doc with test data:
  - 6 question scores (1-5) + gut_check
- [ ] `gsProcessInterviewScore` calculates weighted final:
  - App × 0.20 + Video × 0.30 + Zoom × 0.50
- [ ] Test all 3 thresholds:
  - Score ≥75 + gut="yes" → offer email sent
  - Score 60-74 → founder review email sent
  - Score <60 → rejection email sent
  - Gut check "no" → forced to review regardless of score

### 5.7 Weekly Digest (FR-014)

- [ ] `gsHiringWeeklyDigest` runs (test via Firebase console "Run now")
- [ ] Email received with pipeline stage counts

### 5.8 Error Handling (FR-013)

- [ ] AI scoring failure → error notification email to founders
- [ ] Video processing failure → error notification email to founders

---

## PHASE 6: Indeed / Handshake Job Posting Copy

### 6.1 Indeed Posting Template

```
TITLE: Garage Transformation Technician — $35-45/hr | Garage Scholars (Denver)

COMPANY: Garage Scholars
LOCATION: Denver Metro Area, CO
TYPE: Part-time / Flexible
PAY: $35-45/hour

ABOUT US:
We transform messy garages into organized, functional spaces. You'll install
shelves, wall-mounted storage, clean, organize, and interact with homeowners.
Founded by a Doctor of Physical Therapy and a PhD — we're a startup that
moves fast and values people who show up.

WHAT YOU'LL DO:
• Install shelving systems and wall-mounted storage
• Clean out and organize garages
• Interact professionally with homeowners
• Work independently at job sites across Denver

WHAT WE'RE LOOKING FOR:
• Reliable transportation to job sites
• Comfortable with basic tools (drill, level, tape measure)
• Self-starter who can work independently
• Available 10-20+ hours/week
• No experience required — we train you

BENEFITS:
• $35-45/hour
• Flexible schedule — work around classes or other commitments
• Same-day pay available
• Team jobs with friends
• Build real project management skills

HOW TO APPLY:
Apply directly at: https://garagescholars.com/apply.html?source=indeed
Quick application (5-10 min) — answer 6 short questions about your
experience and availability. No resume required.
```

### 6.2 Handshake Posting Template

Same as Indeed, but change the apply link to:
```
https://garagescholars.com/apply.html?source=handshake
```

---

## PHASE 7: Email Templates Verification (Spec Step 6.7)

All emails sent via Firestore `mail` collection (Firebase Firestore-Send-Email extension).

- [ ] **Application rejection**: Subject matches "Update on Your Garage Scholars Application"
- [ ] **Video invite**: Subject matches "Next Step — Garage Scholars Video Screen (5 min)"
- [ ] **Video rejection**: Subject matches "Update on Your Garage Scholars Application"
- [ ] **Zoom invite**: Subject matches "Garage Scholars — Let's Talk (15 min Zoom)"
- [ ] **Founder dossier**: Subject matches "[GS INTERVIEW] {name} — {datetime}"
- [ ] **Offer email**: Subject matches "Welcome to Garage Scholars"
- [ ] **Final rejection**: Subject matches "Update on Your Garage Scholars Application"
- [ ] **Decision summary**: Subject matches "[GS DECISION] {name} — {HIRE/REJECT/REVIEW}"
- [ ] **Weekly digest**: Subject matches "[GS Hiring] Weekly Pipeline Digest"
- [ ] **Error alerts**: Subject matches "[GS Hiring ERROR]"

---

## PHASE 8: Monitoring & Maintenance (Spec Step 10)

### 8.1 Weekly Review

- [ ] Monday 8 AM: Check weekly digest email for pipeline health
- [ ] Review funnel metrics:
  - Applications received per source (Indeed vs. Handshake vs. Website vs. Referral)
  - Pass rate at application stage (target: 30-40%)
  - Pass rate at video stage (target: 60-70% of those who passed app)
  - Zoom → offer rate (target: 70-80%)
  - Drop-off rate at video stage (target: <30%)

### 8.2 Monthly Calibration (Spec Step 10.1)

- [ ] Week 2: Review first 10 hires. Did AI scores correlate with Zoom performance?
- [ ] Week 4: Review first 3 hires' 30-day job performance
- [ ] Monthly: Check pass rates — adjust thresholds if too many pass (>50%) or too few (<10%)
- [ ] Tune AI scoring prompts based on hire quality data (after 10+ hires)

### 8.3 Ongoing Maintenance

- [ ] Monitor Firebase Functions error logs: `firebase functions:log`
- [ ] Check email delivery rates (Firestore-Send-Email extension logs)
- [ ] Verify OPENAI_API_KEY and ANTHROPIC_API_KEY remain valid
- [ ] Watch Firebase Storage usage (hiring videos)
- [ ] Consider Storage lifecycle rule: auto-delete `hiring-videos/` after 30 days

### 8.4 Improvement Backlog (Spec Step 10.2)

| Priority | Improvement | Trigger | Effort |
|----------|-------------|---------|--------|
| 1 | AI scoring prompt tuning | After 10+ hires | 2 hours |
| 2 | SMS notifications via Twilio | If email response time too slow | 1 hour |
| 3 | Founder dashboard in admin app | Volume > 20 applicants/week | 2 days |
| 4 | 48-hour video reminder email | FR-015, reduce drop-off | 1 hour |
| 5 | Storage lifecycle rule (30-day delete) | SEC-004 compliance | 30 min |
| 6 | Indeed API integration (replace link approach) | When volume justifies | 4 hours |
| 7 | Founder interview scoring UI in mobile admin | Replace manual Firestore writes | 3 hours |

---

## PHASE 9: Founder Interview Scoring (Manual Step)

Until a scoring UI is built (backlog #7), founders submit interview scores via direct Firestore write.

**After each Zoom interview, create a document in `gs_hiringInterviewScores`:**

```json
{
  "applicantId": "<the applicant's Firestore doc ID>",
  "q1_dependability": 4,
  "q2_problem_solving": 3,
  "q3_customer_interaction": 5,
  "q4_practical_skills": 3,
  "q5_coachability": 4,
  "q6_growth_mindset": 4,
  "gut_check": "yes",
  "notes": "Strong candidate, good energy, honest about skill gaps"
}
```

This triggers `gsProcessInterviewScore` → weighted final → decision email.

---

## Quick Reference: Source Attribution Links

| Source | URL |
|--------|-----|
| Website | `https://garagescholars.com/apply.html` |
| Indeed | `https://garagescholars.com/apply.html?source=indeed` |
| Handshake | `https://garagescholars.com/apply.html?source=handshake` |
| Referral / Flyer | `https://garagescholars.com/apply.html?source=referral` |
| Standalone | `https://[hosted-url]/hiring/application-form/index.html` |

---

*Generated: February 2026 | Spec reference: garage_scholars_hiring_automation_guide.docx*
