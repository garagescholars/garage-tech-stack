# Garage Scholars - Hybrid Deployment Guide

This guide explains the hybrid deployment architecture using both Vercel and Firebase Hosting.

## Architecture Overview

### Vercel (Customer-Facing Website)
- **Website** (Marketing Site) - Static HTML/CSS
  - URL: Your custom domain or Vercel URL
  - Benefits: CDN, edge caching, SEO optimization
  - Deployed via: GitHub integration

### Firebase Hosting (Admin Applications)
- **Scheduling System** - React + TypeScript + Vite app
  - URL: https://garage-scholars-scheduling.web.app
  - Integrated with Firebase Auth/Firestore

- **Resale Concierge** - React + Vite app
  - URL: https://garage-scholars-resale.web.app
  - Integrated with Firebase Auth/Firestore

### Firebase Backend (Shared Infrastructure)
- Firebase Authentication
- Cloud Firestore Database
- Cloud Storage
- Cloud Functions (all 5 functions)
- Security Rules

**Why Hybrid?** Admin apps work perfectly on Firebase and integrate seamlessly with Firebase services. The public website benefits from Vercel's global CDN and performance optimization.

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

## Step 3: Deploy Admin Applications to Firebase

Both the Resale Concierge and Scheduling System are deployed to Firebase Hosting since they integrate deeply with Firebase services.

### 3.1 Build and Deploy Scheduling System

```bash
cd schedulingsystem/app
npm install
npm run build
cd ..
firebase deploy --only hosting:scheduling
```

**Result**: App deployed to https://garage-scholars-scheduling.web.app

### 3.2 Build and Deploy Resale Concierge

```bash
cd frontend
npm install
npm run build
firebase deploy --only hosting
```

**Result**: App deployed to https://garage-scholars-resale.web.app

### 3.3 Environment Variables

Both apps use environment variables from their respective `.env` files in development. For production:
- Firebase hosting serves the built apps with env vars baked in at build time
- Ensure `.env` files exist in `frontend/` and `schedulingsystem/app/` directories
- These files should already be configured with your Firebase credentials

---

## Step 4: Update Firebase Functions Environment Variables

The Firebase Cloud Functions need to know the scheduling app URL for email links.

### 4.1 Set Function Environment Variable

```bash
cd schedulingsystem
firebase functions:config:set app.scheduling_url="https://garage-scholars-scheduling.web.app"
```

### 4.2 Redeploy Firebase Functions (if needed)

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

## Step 6: Update Firebase Auth Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `garage-scholars-v2`
3. Go to Authentication → Settings → Authorized domains
4. Add your Vercel URL for the website:
   - `garage-scholars-website.vercel.app` (or your custom domain)
5. Firebase app URLs should already be authorized:
   - `garage-scholars-scheduling.web.app`
   - `garage-scholars-resale.web.app`

---

## Step 7: Test All Applications

### 7.1 Website (Vercel)
- Visit: Your Vercel URL or custom domain
- Test the quote modal
- Verify form submissions work
- Check that luxury enhancements are visible

### 7.2 Resale Concierge (Firebase)
- Visit: https://garage-scholars-resale.web.app
- Test authentication (login/logout)
- Test file uploads to Firebase Storage
- Verify all CRUD operations work

### 7.3 Scheduling System (Firebase)
- Visit: https://garage-scholars-scheduling.web.app
- Test admin login
- Test scholar management
- Verify Gemini AI features work
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
