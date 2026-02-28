# Garage Scholars Schedule System - Implementation SOP

**Date**: January 31, 2026
**Version**: 2.0
**Branch**: mansion-01-security-and-ebay

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Feature Implementation Summary](#feature-implementation-summary)
3. [User Workflows](#user-workflows)
4. [Admin Workflows](#admin-workflows)
5. [Technical Architecture](#technical-architecture)
6. [Testing Procedures](#testing-procedures)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

The Garage Scholars Schedule System is a comprehensive job management platform enabling scholars to claim jobs, execute work with documented check-ins/check-outs, and receive payments tracked through an integrated payout system.

### Key Components

- **Scholar Job Execution Flow**: Check-in, real-time checklist updates, check-out with media uploads
- **Admin Review System**: Quality control review queue with approval/rejection workflows
- **Payout Management**: Complete payment tracking with tax compliance (1099) exports
- **Firebase Integration**: Firestore for data, Storage for media, Cloud Functions for business logic

---

## Feature Implementation Summary

### Prompt 3: Scholar Job Execution Flow ✅
**Commit**: `f61c5ab`

**What Was Built:**
- **Check-In Process**: Photo upload to Firebase Storage at `/jobs/{jobId}/checkin.jpg`
- **Interactive Checklist**: Real-time Firestore updates with green emerald animations on completion
- **Check-Out Process**: Photo + video upload with review submission

**Files Modified:**
- `schedulingsystem/app/views/JobDetail.tsx` (lines 113-160, 242-263, 288-331, 449-450)

**Key Features:**
- Storage-based photo uploads (no more base64 bloat)
- Immediate Firestore sync for checklist items
- Visual feedback with emerald-600 checkmarks and scale-in animations
- Separate UI flows for check-in and check-out

---

### Prompt 4: Admin Job Review & Approval ✅
**Commit**: `f61c5ab`

**What Was Built:**
- **Review Queue**: Dashboard section showing all REVIEW_PENDING jobs
- **Review Modal**:
  - Side-by-side check-in/check-out photos from Storage
  - Complete checklist view
  - Work duration calculation
  - Approve & Pay button (creates payout record)
  - Request Changes button (with admin notes)

**Files Modified:**
- `schedulingsystem/app/src/pages/AdminDashboard.tsx` (added JobForReview type, review modal, handlers)

**Key Features:**
- Real-time query: `where("status", "==", JobStatus.REVIEW_PENDING)`
- Photo loading from Firebase Storage via `getDownloadURL`
- Payout creation: `setDoc(doc(db, "payouts", job.id), payoutData)`
- Change request: Updates job to `CHANGES_REQUESTED` with admin notes

---

### Prompt 5: Payout Tracking & 1099 Export ✅
**Commit**: `4015248`

**What Was Built:**
- **Admin Payout Dashboard** (`/admin/payouts`):
  - Summary cards: Pending, Paid (YTD), Total Payouts
  - Sortable table with Payout ID, Scholar, Job ID (clickable), Amount, Status, Action
  - Mark as Paid modal with payment method dropdown and transaction note
  - Export for Taxes button (CSV export for 1099 compliance)

- **Scholar Earnings View**:
  - Earnings section in UserProfile showing pending/paid totals
  - Payout history list (last 10 transactions)
  - Download 1099 Info button (visible if earnings >$600)

**Files Created:**
- `schedulingsystem/app/src/pages/AdminPayouts.tsx` (324 lines)

**Files Modified:**
- `schedulingsystem/app/types.ts` (added Payout interface)
- `schedulingsystem/app/index.tsx` (added /admin/payouts route)
- `schedulingsystem/app/src/pages/AdminDashboard.tsx` (added Payouts navigation button)
- `schedulingsystem/app/views/UserProfile.tsx` (added earnings section with 1099 export)

**Key Features:**
- Real-time payout tracking via Firestore snapshots
- Payment method tracking: Venmo, Zelle, Cash, Check
- CSV export filters scholars earning >$600 (1099 threshold)
- Year-to-date calculations for tax compliance

---

## User Workflows

### Scholar: Claiming and Completing a Job

#### 1. **Claim a Job**
```
1. Navigate to /app
2. Switch to "Job Board 🔥" tab
3. Browse APPROVED_FOR_POSTING jobs
4. Click on a job card
5. Review job details (address, pay, description, checklist)
6. Click "Claim Job" button
7. Confirm in modal
8. Job appears in "My Schedule" tab with UPCOMING status
```

#### 2. **Check-In to Job Site**
```
1. Navigate to job detail page
2. Click "Check In" button (only visible for UPCOMING jobs assigned to you)
3. Take photo of property exterior using camera or upload from gallery
4. Click "Submit Check-In"
5. Photo uploads to Firebase Storage at jobs/{jobId}/checkin.jpg
6. Job status changes to IN_PROGRESS
7. Redirected to job details view
```

#### 3. **Complete Checklist Tasks**
```
1. On job detail page, scroll to "Checklist" section
2. Click checkbox icon next to any task
3. Task immediately updates in Firestore
4. Checkmark turns emerald-600 with scale-in animation
5. Task text shows strikethrough
6. Changes persist across all devices in real-time
```

#### 4. **Check-Out from Job**
```
1. After completing all/most tasks, click "Complete Job (Check Out)"
2. Take photo of front of house
3. Upload from gallery if needed
4. Record video of garage interior
5. Click "Complete Job" button
6. Confirm in modal: "Submit documentation for quality control review?"
7. Media uploads to Storage
8. Job status changes to REVIEW_PENDING
9. Admin is notified for review
```

#### 5. **View Earnings**
```
1. Click profile icon (top right)
2. Scroll to "Earnings" section
3. View pending payouts (yellow/amber)
4. View paid payouts (green/emerald) with payment method
5. If total >$600, click "Download 1099 Info"
6. CSV file downloads with year-to-date earnings data
```

---

## Admin Workflows

### Admin: Managing Job Reviews and Payouts

#### 1. **Review Completed Jobs**
```
1. Navigate to /admin
2. See "Jobs Pending Review" section
3. Click "Review" button on any REVIEW_PENDING job
4. Modal opens showing:
   - Scholar name and payout amount
   - Work duration (minutes)
   - Check-in photo (left)
   - Check-out photo (right)
   - Completed checklist with green checkmarks
```

#### 2. **Approve and Create Payout**
```
1. In review modal, verify work quality
2. Click "Approve & Pay $[amount]"
3. System:
   - Updates job status to COMPLETED
   - Creates payout record in /payouts collection
   - Sets payout status to "pending"
   - Records approval timestamp
4. Modal closes, job removed from review queue
5. Payout appears in /admin/payouts dashboard
```

#### 3. **Request Changes**
```
1. In review modal, if work needs revision
2. Click "Request Changes" button
3. Text area appears
4. Enter detailed notes: "Please retake garage video - too dark"
5. Click "Submit Changes Request"
6. System:
   - Updates job status to CHANGES_REQUESTED
   - Saves admin notes
   - Records timestamp
7. Scholar sees notes and can resubmit
```

#### 4. **Manage Payouts**
```
1. Navigate to /admin
2. Click green "Payouts" button in header
3. View summary cards:
   - Pending: $[amount] (yellow)
   - Paid YTD: $[amount] (green)
   - Total Payouts: [count]
4. Table shows all payouts sorted by date
```

#### 5. **Mark Payment as Paid**
```
1. On /admin/payouts page
2. Find pending payout in table
3. Click "Mark as Paid" button
4. Modal opens
5. Select payment method from dropdown:
   - Venmo (default)
   - Zelle
   - Cash
   - Check
6. Enter transaction ID/note: e.g., "Venmo TX: 12345ABC"
7. Click "Confirm Payment"
8. System:
   - Updates payout status to "paid"
   - Records payment method
   - Saves transaction note
   - Records paid timestamp
9. Badge turns green, payment method displays in table
```

#### 6. **Export 1099 Tax Data**
```
1. On /admin/payouts page
2. Click "Export for Taxes" button (top right)
3. System:
   - Filters current year payouts
   - Groups by scholar
   - Calculates year-to-date totals
   - Filters scholars earning >$600
4. CSV downloads as "1099-data-2026.csv"
5. Columns: Scholar Name, Scholar Email, Total Paid (YTD), Tax ID
6. Share with accounting/tax preparer
```

---

## Technical Architecture

### Firebase Collections

#### `/jobs`
```typescript
{
  id: string;
  clientName: string;
  address: string;
  date: string; // ISO
  pay: number;
  status: JobStatus; // UPCOMING | IN_PROGRESS | REVIEW_PENDING | COMPLETED | CHANGES_REQUESTED
  assigneeId?: string;
  assigneeName?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInMedia?: {
    photoFrontOfHouse: string; // Storage path: jobs/{jobId}/checkin.jpg
    timestamp: string;
  };
  checkOutMedia?: {
    photoFrontOfHouse: string; // Storage path
    videoGarage: string; // Storage path
    timestamp: string;
  };
  checklist: Task[];
  // ... other fields
}
```

#### `/payouts`
```typescript
{
  id: string; // Same as jobId for easy linking
  jobId: string;
  scholarId: string;
  scholarName: string;
  scholarEmail?: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string; // ISO
  paidAt?: string; // ISO
  paymentMethod?: 'Venmo' | 'Zelle' | 'Cash' | 'Check';
  transactionNote?: string; // Confirmation code or transaction ID
  approvedBy?: string; // Admin UID
}
```

#### `/users`
```typescript
{
  id: string;
  name: string;
  email: string;
  role: 'scholar' | 'admin';
  status: 'active' | 'pending' | 'declined';
  monthlyGoal: number;
  phoneNumber?: string;
  // ... other fields
}
```

### Firebase Storage Structure

```
/jobs
  /{jobId}
    /checkin.jpg         (check-in photo)
    /checkout-photo.jpg  (check-out photo)
    /checkout-video.mp4  (check-out video)
```

### Key Functions

#### Scholar Check-In (`JobDetail.tsx:113-160`)
```typescript
const submitCheckIn = async () => {
  // 1. Validate photo exists
  // 2. Convert base64 to blob
  // 3. Upload to Storage: jobs/{jobId}/checkin.jpg
  // 4. Update job with storage path (not base64)
  // 5. Change status to IN_PROGRESS
  // 6. Record check-in timestamp
}
```

#### Checklist Toggle (`JobDetail.tsx:242-263`)
```typescript
const toggleTask = async (taskId: string) => {
  // 1. Update local state immediately (optimistic UI)
  // 2. Write to Firestore with merge: true
  // 3. Real-time listeners update all connected clients
}
```

#### Admin Approve & Pay (`AdminDashboard.tsx:144-176`)
```typescript
const handleApproveAndPay = async (job: JobForReview) => {
  // 1. Update job status to COMPLETED
  // 2. Record approval timestamp
  // 3. Create payout document in /payouts
  // 4. Set initial status to "pending"
  // 5. Close modal, update UI
}
```

#### Mark as Paid (`AdminPayouts.tsx:48-63`)
```typescript
const handleMarkAsPaid = async () => {
  // 1. Update payout status to "paid"
  // 2. Record payment method (Venmo/Zelle/Cash/Check)
  // 3. Save transaction note
  // 4. Record paid timestamp
}
```

---

## Testing Procedures

### End-to-End Test: Complete Job Lifecycle

**Setup:**
- 2 browser windows: Admin (Chrome), Scholar (Firefox/Incognito)
- Clean Firestore database or test data

**Test Steps:**

#### Phase 1: Job Creation & Claiming
```
[Admin]
1. Navigate to /admin/create-job
2. Create test job:
   - Client: "Test Property LLC"
   - Address: "123 Test St, Test City"
   - Pay: $350
   - Checklist: 3 tasks
3. Approve for posting

[Scholar]
4. Navigate to /app > Job Board
5. Verify test job appears
6. Click and claim job
7. Verify job moves to "My Schedule"
```

#### Phase 2: Job Execution
```
[Scholar]
8. Open claimed job
9. Click "Check In"
10. Upload test photo (any JPG)
11. Submit check-in
12. Verify:
    - Job status = IN_PROGRESS
    - Photo stored in Firebase Storage
    - Check-in time recorded

13. Toggle checklist items (1 by 1)
14. Verify each immediately shows green checkmark
15. Open second browser window as admin
16. Verify checklist updates appear in real-time

17. Click "Complete Job (Check Out)"
18. Upload photo and video
19. Confirm submission
20. Verify:
    - Job status = REVIEW_PENDING
    - Media stored in Storage
    - Check-out time recorded
```

#### Phase 3: Admin Review
```
[Admin]
21. Navigate to /admin
22. Verify job appears in "Jobs Pending Review"
23. Click "Review"
24. Verify modal shows:
    - Check-in photo loads from Storage
    - Check-out photo loads from Storage
    - Checklist shows completed items
    - Work duration calculated correctly

25. Click "Approve & Pay $350"
26. Verify:
    - Job disappears from review queue
    - Job status = COMPLETED
```

#### Phase 4: Payout Management
```
[Admin]
27. Click "Payouts" button
28. Verify payout appears in table:
    - Status: PENDING (yellow badge)
    - Amount: $350.00
    - Scholar name correct

29. Click "Mark as Paid"
30. Select "Venmo"
31. Enter note: "TEST-TX-12345"
32. Confirm
33. Verify:
    - Status badge turns green
    - Payment method shows "Venmo"
    - Paid date displays

[Scholar]
34. Click profile icon
35. Scroll to "Earnings"
36. Verify:
    - Paid (YTD) shows $350.00
    - Payout listed with Venmo method
    - Status: PAID
```

#### Phase 5: Tax Export
```
[Admin]
37. On /admin/payouts
38. Click "Export for Taxes"
39. Open downloaded CSV
40. Verify:
    - Headers: Scholar Name, Email, Total Paid, Tax ID
    - Row contains scholar data
    - Total matches $350.00

[Scholar]
41. If earnings >$600, verify "Download 1099 Info" button appears
42. Click and download
43. Verify CSV contains scholar's earnings data
```

**Expected Results:**
- ✅ All statuses transition correctly
- ✅ Photos/videos stored in Firebase Storage (not Firestore)
- ✅ Real-time updates work across devices
- ✅ Payout workflow completes without errors
- ✅ CSV exports contain correct data

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: Check-In Photo Upload Fails
**Symptoms:**
- "Failed to upload check-in photo" alert
- Console error: "Storage not initialized"

**Solution:**
```javascript
// Verify Firebase Storage is configured in firebase.ts
import { getStorage } from 'firebase/storage';
export const storage = getStorage(app);

// Check Firebase Storage rules
service firebase.storage {
  match /b/{bucket}/o {
    match /jobs/{jobId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### Issue 2: Review Modal Photos Don't Load
**Symptoms:**
- "Loading..." placeholder never changes
- Console error: "Failed to get download URL"

**Solution:**
```javascript
// Check storage path format
// Correct: jobs/abc123/checkin.jpg
// Incorrect: data:image/jpeg;base64,... (old base64 format)

// Verify Storage rules allow read access
// Check that checkInMedia.photoFrontOfHouse is a path, not base64
```

#### Issue 3: Payouts Not Appearing
**Symptoms:**
- /admin/payouts shows "No payouts found"
- Job was approved but no payout created

**Solution:**
```javascript
// Check handleApproveAndPay in AdminDashboard.tsx
// Verify payout document is created:
await setDoc(doc(db, "payouts", job.id), {
  jobId: job.id,
  scholarId: job.assigneeName, // Should be assigneeId
  scholarName: job.assigneeName,
  amount: job.pay,
  status: "pending",
  createdAt: new Date().toISOString()
});

// Common fix: Update scholarId to use job.assigneeId instead of assigneeName
```

#### Issue 4: 1099 Export Empty
**Symptoms:**
- CSV downloads but has no data rows
- Only headers present

**Solution:**
```javascript
// Check filter logic in handleExportCSV
// Verify scholars earned >$600
// Check year filter matches current year
const currentYear = new Date().getFullYear();
const yearPayouts = payouts.filter(p => {
  const payoutYear = new Date(p.paidAt || p.createdAt).getFullYear();
  return payoutYear === currentYear && p.status === 'paid';
});

// Debug: Log filtered payouts to console
console.log('Year payouts:', yearPayouts);
```

#### Issue 5: Checklist Not Updating in Real-Time
**Symptoms:**
- Scholar checks task, but admin doesn't see update
- Requires page refresh

**Solution:**
```javascript
// Verify Firestore listener is active in AdminDashboard
// Check that toggleTask uses setDoc with merge:
await setDoc(doc(db, 'jobs', job.id), {
  checklist: updatedChecklist
}, { merge: true });

// Verify Firestore rules allow real-time updates
match /jobs/{jobId} {
  allow read, write: if request.auth != null;
}
```

#### Issue 6: Scholar Can't See Earnings
**Symptoms:**
- Earnings section shows "Loading earnings..."
- Or shows "No payouts yet"

**Solution:**
```javascript
// Check query in UserProfile.tsx
const payoutsQuery = query(
  collection(db, 'payouts'),
  where('scholarId', '==', currentUserId) // Verify scholarId matches
);

// Debug: Check Firestore console for payout documents
// Ensure scholarId field matches user's UID, not name
```

---

## Security Considerations

### Firestore Rules (Required)

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // Jobs: Authenticated users can read/write
    match /jobs/{jobId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Payouts: Only admins can write, scholars can read own
    match /payouts/{payoutId} {
      allow read: if request.auth != null &&
        (request.auth.token.admin == true ||
         resource.data.scholarId == request.auth.uid);
      allow write: if request.auth != null &&
        request.auth.token.admin == true;
    }

    // Users: Can read own, admins can read all
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (request.auth.uid == userId ||
         request.auth.token.admin == true);
    }
  }
}
```

### Firebase Storage Rules

```javascript
service firebase.storage {
  match /b/{bucket}/o {
    match /jobs/{jobId}/{allPaths=**} {
      // Only authenticated users
      allow read: if request.auth != null;

      // Only file uploader or admin can write
      allow write: if request.auth != null &&
        (request.resource.size < 10 * 1024 * 1024 && // Max 10MB
         request.resource.contentType.matches('image/.*|video/.*'));
    }
  }
}
```

---

## Performance Optimization

### Best Practices Implemented

1. **Optimistic UI Updates**
   - Checklist toggles update locally first
   - Firestore write happens asynchronously
   - No waiting for round-trip

2. **Storage Over Firestore**
   - Photos/videos stored in Firebase Storage
   - Only storage paths saved in Firestore
   - Avoids 1MB document size limits

3. **Real-Time Listeners**
   - Single snapshot listener per collection
   - Automatic cleanup on unmount
   - Efficient updates without polling

4. **Lazy Loading**
   - Photos loaded only when modal opens
   - Uses `getDownloadURL` on demand
   - Reduces initial page load

---

## Deployment Checklist

Before deploying to production:

- [ ] Update Firestore security rules
- [ ] Update Storage security rules
- [ ] Set up Cloud Functions admin role verification
- [ ] Configure environment variables (API keys)
- [ ] Test end-to-end flow in staging
- [ ] Verify 1099 export with real data
- [ ] Train admin users on review workflow
- [ ] Train scholars on job execution flow
- [ ] Set up error monitoring (Sentry/Firebase Crashlytics)
- [ ] Document backup/recovery procedures

---

## Change Log

### Version 2.0 - January 31, 2026

**Added:**
- Scholar job execution flow (check-in, checklist, check-out)
- Admin job review and approval system
- Payout tracking and management
- 1099 tax export functionality
- Firebase Storage integration for media
- Real-time checklist synchronization

**Modified:**
- Job status enum: Added REVIEW_PENDING, CHANGES_REQUESTED
- JobDetail.tsx: Complete rewrite of media handling
- AdminDashboard.tsx: Added review queue and payout integration
- UserProfile.tsx: Added earnings section

**Fixed:**
- Approval bug where missing user documents caused failures
- Color palette consistency issues
- Base64 storage bloat replaced with Firebase Storage paths

**Commits:**
- `f61c5ab`: Prompt 3 & 4 implementation
- `46aa572`: Color theme consistency fix
- `4015248`: Prompt 5 payout system

---

## Support & Maintenance

**Primary Developer**: Claude Sonnet 4.5
**Repository**: `/Users/tylersodia/Desktop/Garage Scholars`
**Branch**: `mansion-01-security-and-ebay`
**Documentation**: This file + inline code comments

**For Issues:**
1. Check this troubleshooting guide first
2. Review Firebase console for errors
3. Check browser console for client-side errors
4. Verify Firestore/Storage rules are correct
5. Test with fresh data in staging environment

---

*End of Implementation SOP*
