# Garage Scholars - Vercel Deployment Guide

This guide explains how to deploy all three frontend applications to Vercel while keeping the Firebase backend operational.

## Architecture Overview

### What's Moving to Vercel (Frontend Only)
- **Website** (Marketing Site) - Static HTML/CSS
- **Resale Concierge** - React + Vite app
- **Scheduling System** - React + TypeScript + Vite app

### What Stays on Firebase (Backend)
- Firebase Authentication
- Cloud Firestore Database
- Cloud Storage
- Cloud Functions (all 5 functions)
- Security Rules

**IMPORTANT**: The backend remains 100% on Firebase. Only the frontend hosting is moving to Vercel.

---

## Prerequisites

1. GitHub account
2. Vercel account (free tier works)
3. Firebase project credentials
4. All environment variables ready (see `.env.example` files in each app)

---

## Step 1: Push Code to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Prepare for Vercel deployment"

# Create a new GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/garage-scholars.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Website (Marketing Site)

### 2.1 Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your `garage-scholars` repository
4. Configure the project:
   - **Project Name**: `garage-scholars-website`
   - **Root Directory**: `Website`
   - **Framework Preset**: Other
   - **Build Command**: `bash generate-firebase-config.sh`
   - **Output Directory**: `.`

### 2.2 Add Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

```
FIREBASE_API_KEY=AIzaSyBPOosKjdOrj1dMLmgs1bH2Z9FoqqrZQI8
FIREBASE_AUTH_DOMAIN=garage-scholars-v2.firebaseapp.com
FIREBASE_PROJECT_ID=garage-scholars-v2
FIREBASE_STORAGE_BUCKET=garage-scholars-v2.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=583159785746
FIREBASE_APP_ID=1:583159785746:web:87d8ed8f5634ea79c26bcb
```

### 2.3 Deploy

Click "Deploy" and wait for deployment to complete.

### 2.4 Get Production URL

Note the production URL (e.g., `https://garage-scholars-website.vercel.app`)

---

## Step 3: Deploy Resale Concierge App

### 3.1 Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the same `garage-scholars` repository
3. Configure the project:
   - **Project Name**: `garage-scholars-resale`
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.2 Add Environment Variables

```
VITE_FIREBASE_API_KEY=AIzaSyBPOosKjdOrj1dMLmgs1bH2Z9FoqqrZQI8
VITE_FIREBASE_AUTH_DOMAIN=garage-scholars-v2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=garage-scholars-v2
VITE_FIREBASE_STORAGE_BUCKET=garage-scholars-v2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=583159785746
VITE_FIREBASE_APP_ID=1:583159785746:web:87d8ed8f5634ea79c26bcb
```

### 3.3 Deploy

Click "Deploy" and note the production URL.

---

## Step 4: Deploy Scheduling System

### 4.1 Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the same `garage-scholars` repository
3. Configure the project:
   - **Project Name**: `garage-scholars-scheduling`
   - **Root Directory**: `schedulingsystem/app`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 4.2 Add Environment Variables

```
VITE_FIREBASE_API_KEY=AIzaSyBPOosKjdOrj1dMLmgs1bH2Z9FoqqrZQI8
VITE_FIREBASE_AUTH_DOMAIN=garage-scholars-v2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=garage-scholars-v2
VITE_FIREBASE_STORAGE_BUCKET=garage-scholars-v2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=583159785746
VITE_FIREBASE_APP_ID=1:583159785746:web:87d8ed8f5634ea79c26bcb
GEMINI_API_KEY=your_gemini_api_key_here
VITE_SCHEDULING_APP_URL=https://garage-scholars-scheduling.vercel.app
VITE_RESALE_APP_URL=https://garage-scholars-resale.vercel.app
```

**Note**: Replace the URL values with your actual Vercel URLs from Steps 2-3.

### 4.3 Deploy

Click "Deploy" and note the production URL.

---

## Step 5: Update Firebase Functions Environment Variables

The Firebase Cloud Functions need to know the new Vercel URL for the scheduling app to generate correct email links.

### 5.1 Set Function Environment Variable

```bash
cd schedulingsystem
firebase functions:config:set app.scheduling_url="https://garage-scholars-scheduling.vercel.app"
```

Replace with your actual Vercel URL.

### 5.2 Redeploy Firebase Functions

```bash
firebase deploy --only functions
```

---

## Step 6: Configure Custom Domains (Optional)

If you have custom domains:

### 6.1 In Vercel Dashboard

For each project:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 6.2 Update CORS in Firebase

If using custom domains, update CORS settings:

1. Edit `schedulingsystem/cors.json`
2. Add your custom domains to the allowed origins
3. Deploy: `gsutil cors set cors.json gs://garage-scholars-v2.firebasestorage.app`

---

## Step 7: Update Firebase Auth Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `garage-scholars-v2`
3. Go to Authentication → Settings → Authorized domains
4. Add your Vercel URLs:
   - `garage-scholars-website.vercel.app`
   - `garage-scholars-resale.vercel.app`
   - `garage-scholars-scheduling.vercel.app`
5. Add custom domains if applicable

---

## Step 8: Test All Applications

### 8.1 Website
- Visit your Website URL
- Test the quote modal
- Verify Firebase Functions are called correctly

### 8.2 Resale Concierge
- Visit your Resale app URL
- Test authentication
- Test file uploads to Firebase Storage

### 8.3 Scheduling System
- Visit your Scheduling app URL
- Test admin login
- Test job creation and updates
- Verify Firestore reads/writes
- Test the admin dashboard links

---

## Step 9: Monitor and Verify

### 9.1 Check Vercel Deployment Logs
- Go to each project in Vercel Dashboard
- Check the "Deployments" tab for any errors

### 9.2 Check Firebase Usage
- Go to Firebase Console → Usage
- Verify Firestore, Storage, and Functions are working

### 9.3 Check Firebase Functions Logs
```bash
firebase functions:log
```

---

## Rollback Plan (If Needed)

If something goes wrong, you can quickly rollback:

### Option 1: Keep Firebase Hosting Active
The old Firebase Hosting sites are still deployed and functional. Simply point your DNS back to Firebase.

### Option 2: Instant Vercel Rollback
1. Go to Vercel Dashboard → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

---

## What Changed vs. Firebase Hosting

| Aspect | Firebase Hosting | Vercel |
|--------|-----------------|--------|
| Frontend Hosting | Firebase | Vercel |
| Authentication | Firebase | Firebase (no change) |
| Database | Firestore | Firestore (no change) |
| Storage | Firebase Storage | Firebase Storage (no change) |
| Functions | Cloud Functions | Cloud Functions (no change) |
| Deploy Command | `firebase deploy --only hosting` | Git push (auto-deploy) |
| Build Time | Server-side | Server-side |
| Custom Domains | firebase.json | Vercel Dashboard |

---

## Continuous Deployment

After initial setup, deployments are automatic:

1. Make code changes
2. Commit to git
3. Push to GitHub
4. Vercel automatically builds and deploys

```bash
git add .
git commit -m "Update homepage design"
git push
```

---

## Environment Variables Management

### Development
- Use `.env` files locally (already gitignored)
- Copy from `.env.example` and fill in actual values

### Production
- Managed in Vercel Dashboard
- Go to Project Settings → Environment Variables
- Can be different for Production, Preview, and Development

---

## Troubleshooting

### Build Fails
- Check Vercel deployment logs
- Verify all environment variables are set
- Ensure root directory is correct

### Firebase Connection Issues
- Verify Firebase config environment variables
- Check Firebase Auth authorized domains
- Check browser console for CORS errors

### Functions Not Accessible
- Verify CORS configuration
- Check Functions logs: `firebase functions:log`
- Verify function deployment: `firebase deploy --only functions`

---

## Cost Comparison

### Before (Firebase Hosting)
- Firebase Hosting: Free tier (up to 10 GB bandwidth)
- Firebase Backend: Pay-as-you-go

### After (Vercel)
- Vercel Hosting: Free tier (100 GB bandwidth)
- Firebase Backend: Pay-as-you-go (no change)

**Result**: Better performance and higher free tier limits.

---

## Support

For issues or questions:
- Vercel: [vercel.com/support](https://vercel.com/support)
- Firebase: [firebase.google.com/support](https://firebase.google.com/support)

---

## Next Steps

1. Set up custom domains
2. Configure CI/CD with GitHub Actions if needed
3. Set up Vercel preview deployments for staging
4. Configure monitoring and analytics
