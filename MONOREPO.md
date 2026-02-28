# Garage Scholars Monorepo Structure

This monorepo contains three frontend applications that will be deployed to Vercel. Each app is deployed as a separate Vercel project.

## Applications

### 1. Website (Marketing Site)
- **Directory**: `Website/`
- **Type**: Static HTML/CSS
- **Vercel Project Name**: `garage-scholars-website`
- **Build Command**: None (static files)
- **Output Directory**: `.` (root)
- **Environment Variables**: Firebase config (see .env.example)

### 2. Resale Concierge
- **Directory**: `frontend/`
- **Type**: React + Vite
- **Vercel Project Name**: `garage-scholars-resale`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Firebase config (see .env.example)

### 3. Scheduling System
- **Directory**: `schedulingsystem/app/`
- **Type**: React + TypeScript + Vite
- **Vercel Project Name**: `garage-scholars-scheduling`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Firebase config + Gemini API key (see .env.example)

## Firebase Backend (Stays on Firebase)

### Cloud Functions
- **Directory**: `schedulingsystem/functions/`
- **Deployed to**: Firebase Cloud Functions
- **Functions**:
  - `generateSopForJob` - Generates SOPs using OpenAI
  - `approveSignup` - Admin approval for scholar signups
  - `declineSignup` - Admin rejection for scholar signups
  - `submitQuoteRequest` - Handles quote requests from website
  - `sendJobReviewEmail` - Firestore trigger for job review notifications

### Firestore Database
- Collections: `serviceJobs`, `sops`, `signupRequests`, `users`, `quoteRequests`, `mail`
- Security rules: `schedulingsystem/firestore.rules`

### Firebase Storage
- Used for: Job photos, intake media, check-in/check-out photos
- Security rules: `schedulingsystem/storage.rules`

## Deployment Strategy

Each frontend app is deployed to Vercel as a separate project:
1. Import each directory as a new Vercel project
2. Set the root directory in Vercel dashboard
3. Configure environment variables in Vercel dashboard
4. Deploy

Firebase backend remains on Firebase Cloud Platform:
- Firestore, Auth, Storage, Functions stay on Firebase
- No changes to Firebase backend deployment
