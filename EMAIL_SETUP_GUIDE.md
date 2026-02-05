# Email Notification System Setup Guide

## Overview
Automatically send email notifications to admins when a job is ready for review, with embedded photos, video links, and one-click approval.

---

## Step 1: Install Firebase Email Extension

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: **garage-scholars-v2**
3. Click **Extensions** in the left sidebar
4. Click **Install Extension** (or **Reconfigure** if already installed)
5. Search for **"Trigger Email from Firestore"**
6. Click **Install** and configure:
   - **Firestore Instance Location**: `nam5`
   - **Email documents collection**: `mail`
   - **SMTP Connection URI**: `smtps://tylerzsodia@gmail.com:YOUR_APP_PASSWORD@smtp.gmail.com:465`
     - Replace `YOUR_APP_PASSWORD` with the 16-character App Password from Step 2
   - **Email from address**: `tylerzsodia@gmail.com`
   - **Email from name**: `Garage Scholars`

---

## Step 2: Set Up Gmail SMTP (Free Forever)

**Email Workflow:**
- **FROM:** tylerzsodia@gmail.com (your personal email)
- **TO:** garagescholars@gmail.com (centralized review inbox)
- **Result:** Both admins can check garagescholars@gmail.com for pending job reviews

**Setup Steps:**

1. Go to your Google Account: https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already enabled
   - Click "2-Step Verification" → "Get Started"
   - Follow the prompts (enter phone number, receive code)
3. Once 2-step verification is enabled, go to: https://myaccount.google.com/apppasswords
4. Create a new App Password:
   - Name: "Firebase Email Extension"
   - Click "Create"
   - Copy the 16-character password (you'll use this in Step 3)

**Why 2-step verification?** Google requires it as a security prerequisite for App Passwords. It ensures that even if your App Password is compromised, attackers still can't access your full Google account.

---

## Step 3: Deploy Cloud Functions

Run this command to deploy the new email notification function:

```bash
cd /Users/tylersodia/Desktop/Garage\ Scholars/schedulingsystem
firebase deploy --only functions:sendJobReviewEmail
```

This deploys the Firestore trigger that automatically sends emails when jobs are ready for review.

---

## Step 4: Update Email Template URLs

After deploying to production, update the email approval links in the Cloud Function:

1. Open: `schedulingsystem/functions/src/index.ts`
2. Find line with `https://localhost:3000/admin?approve=`
3. Replace with your production URL:
   - If using Firebase Hosting: `https://garage-scholars-schedule-system.web.app/admin?approve=`
   - If using custom domain: `https://yourdomain.com/admin?approve=`

---

## Step 5: Test the Email System

1. Create a test job in the admin dashboard
2. Claim the job as a scholar
3. Complete check-in (upload photo)
4. Complete check-out (upload photo + video)
5. Check the **garagescholars@gmail.com** inbox
6. You should receive an email FROM tylerzsodia@gmail.com with:
   - Job details
   - Check-in/check-out photos
   - Video link
   - Approve & Pay button

---

## How It Works

### Automatic Trigger
- When a job status changes to `REVIEW_PENDING`
- Cloud Function (`sendJobReviewEmail`) automatically triggers
- Generates download URLs for photos/video (7-day expiration)
- Writes email document to `mail` collection
- Firebase Email Extension detects the new document
- Sends formatted HTML email FROM tylerzsodia@gmail.com TO garagescholars@gmail.com
- Both admins can check garagescholars@gmail.com inbox for pending reviews

### Email Contents
- **Subject**: 🔔 Review Required: [Client Name] - $[Payout]
- **Body**:
  - Job details (client, scholar, payout, duration)
  - Check-in and check-out photos (embedded)
  - Video link (clickable)
  - Approve & Pay button (one-click approval)
  - Payment policy explanation

### Security
- Approval links include a secure token (base64 encoded jobId + timestamp)
- Media URLs are signed URLs with 7-day expiration
- Only accessible by authenticated admins

---

## Step 6: (Optional) Implement One-Click Approval

To make the "Approve & Pay" button work from email, add an approval handler in your admin dashboard:

### Add URL parameter handling in AdminDashboard.tsx

```typescript
useEffect(() => {
  // Check for approval token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const approvalToken = urlParams.get('approve');

  if (approvalToken) {
    // Decode token to get jobId
    const decoded = atob(approvalToken);
    const jobId = decoded.split('-')[0];

    // Auto-open the review modal for this job
    const job = jobsForReview.find(j => j.id === jobId);
    if (job) {
      setSelectedJobForReview(job);
    }
  }
}, []);
```

---

## Troubleshooting

### Emails not sending?
1. Check Firebase Console > Functions > Logs
2. Look for `sendJobReviewEmail` execution logs
3. Verify the `mail` collection has documents

### Photos/videos not loading in email?
1. Check that Firebase Storage CORS is configured
2. Verify signed URLs are being generated (check function logs)

### Wrong email addresses?
Emails are now sent TO **garagescholars@gmail.com** (centralized inbox).
If you need to change this:
1. Edit line 631 in `schedulingsystem/functions/src/index.ts`
2. Redeploy: `firebase deploy --only functions:sendJobReviewEmail`

---

## Cost Estimate

- **Firebase Email Extension**: Free
- **Gmail SMTP**: Free forever (500 emails/day limit)
- **Expected usage**: ~5-10 emails/day (1 per job review)
- **Total cost**: $0/month

---

## Next Steps

Once email notifications are working:
1. ✅ Add second-half payout automation (24-hour delayed payment)
2. ✅ Add client notification emails (job confirmed, completed)
3. ✅ Add scholar notification emails (job assigned, approved)
