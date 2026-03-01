# Garage Scholars — Zero-Touch Hiring Pipeline

Automated applicant screening & evaluation system. Candidates flow through 3 stages with only ~17 min of founder time per finalist.

## Architecture

```
Application Form → [AI Score] → Video Screen → [Whisper + AI Score] → Zoom → [Decision Engine]
     ↓                              ↓                                        ↓
  Firestore              Firebase Storage                           Firestore mail
gs_hiringApplicants      hiring-videos/                          Auto offer/reject
```

**Stack:** Firebase Cloud Functions, Firestore, Firebase Storage, Anthropic Claude API, OpenAI Whisper API, Cal.com

## Pipeline Flow

| Stage | Trigger | Action | Output |
|-------|---------|--------|--------|
| 1. Application | Doc created in `gs_hiringApplicants` | Claude AI scores 6 screening answers | Video invite or rejection email |
| 2. Video Screen | Doc created in `gs_hiringVideoCompletions` | Whisper transcribes → Claude AI scores | Zoom invite or rejection email |
| 3. Zoom Booking | Cal.com webhook → `gsCalBookingWebhook` | Lookup applicant, build dossier | Founder dossier email |
| 4. Decision | Doc created in `gs_hiringInterviewScores` | Weighted composite (20/30/50) | Offer, rejection, or review email |
| 5. Weekly Digest | Monday 8am MST cron | Pipeline stats | Founder digest email |

## Files

### Cloud Functions (`mobile/functions/src/`)
- `gs-hiring-types.ts` — TypeScript interfaces + scoring constants
- `gs-hiring.ts` — All 5 pipeline functions
- `gs-constants.ts` — Updated with hiring collection names
- `index.ts` — Updated with hiring exports

### Web Apps (`hiring/`)
- `application-form/index.html` — Candidate application form (6 screening questions)
- `video-app/index.html` — Video recording app (5 prompts, 60-90 sec each)

## Setup

### 1. Firebase Config (both web apps)

Replace the placeholder `firebaseConfig` in both `index.html` files with your actual Firebase config. You can find it in the Firebase Console → Project Settings → Web App.

### 2. Firestore Security Rules

Add these rules to allow candidates to submit applications and upload videos:

```
// In mobile/firestore.rules — add inside rules_version block
match /gs_hiringApplicants/{appId} {
  allow create: if true;  // Public application form
  allow read: if true;    // Video app checks status
  allow update: if true;  // Video app updates status to pending_video
}

match /gs_hiringVideoCompletions/{docId} {
  allow create: if true;  // Video app signals completion
}

match /gs_hiringInterviewScores/{docId} {
  allow create: if request.auth != null;  // Admin only (founder scoring form)
}
```

### 3. Firebase Storage Rules

Allow video uploads to the `hiring-videos/` path:

```
// In mobile/storage.rules
match /hiring-videos/{applicantId}/{videoFile} {
  allow write: if true;   // Candidates upload videos
  allow read: if true;    // System reads for transcription
}
```

### 4. Environment Variables / Secrets

Set these Firebase secrets for the Cloud Functions:

```bash
cd mobile

# OpenAI API key for Whisper transcription
firebase functions:secrets:set OPENAI_API_KEY

# Optional: custom video app URL (defaults to https://screen.garagescholars.com)
firebase functions:config:set hiring.video_app_url="https://your-video-app-url.com"

# Optional: Cal.com scheduling link
firebase functions:config:set hiring.cal_link="https://cal.com/garagescholars/interview"
```

The `ANTHROPIC_API_KEY` should already be configured (used by SOP generator).

### 5. Cal.com Setup

1. Create a free account at [cal.com](https://cal.com)
2. Create a 15-minute event type called "Garage Scholars Interview"
3. Connect your Google Calendar
4. Go to Settings → Webhooks → Add webhook:
   - URL: `https://us-central1-garage-scholars-v2.cloudfunctions.net/gsCalBookingWebhook`
   - Events: Booking Created
5. Update the `CAL_LINK` in the function config

### 6. Deploy

```bash
cd mobile

# Build and deploy functions
npm run build && firebase deploy --only functions

# Deploy application form to Firebase Hosting (optional)
# Or host on Vercel/Netlify/any static host
```

### 7. Hosting the Web Apps

**Option A: Firebase Hosting** — Add hosting targets in `mobile/firebase.json`

**Option B: Vercel** — Deploy each `index.html` as a static site

**Option C: Add to Website** — Copy the application form to `Website/src/pages/apply-technician.html`

## Firestore Collections

| Collection | Purpose | Created By |
|-----------|---------|------------|
| `gs_hiringApplicants` | Main applicant records | Application form |
| `gs_hiringVideoCompletions` | Video completion signals | Video recording app |
| `gs_hiringInterviewScores` | Post-interview scores | Founder scoring form |

## Scoring Weights

### Application AI Score (4 dimensions)
- Skills Fit: 30%
- Reliability: 15%
- Conscientiousness: 25%
- Problem-Solving: 30%
- **Pass threshold: 60/100 + zero red flags**

### Video AI Score (5 dimensions)
- Communication: 20%
- Mechanical Aptitude: 25%
- Problem-Solving & Honesty: 20%
- Reliability & Conscientiousness: 20%
- Startup Fit: 15%
- **Pass threshold: 65/100 + zero red flags**

### Final Decision Composite
- Application: 20%
- Video: 30%
- Zoom Interview: 50%
- **75+ = HIRE** | **60-74 = FOUNDER REVIEW** | **<60 = REJECT**

## Cost

- Tools/hosting: $0/month (Firebase free tier)
- Per applicant (rejected at Stage 1): ~$0.05 (Claude Haiku)
- Per finalist (all 3 stages): ~$0.30-0.50 (Claude + Whisper)
- Founder time per hire: ~17 minutes (Zoom + scoring)
