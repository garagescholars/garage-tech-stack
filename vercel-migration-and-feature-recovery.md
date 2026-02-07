# Claude Code Task Prompt: Vercel Migration + Feature Recovery

Complete these two tasks in order. Read everything before starting.

---

## TASK 1: MIGRATE FRONTEND DEPLOYMENT FROM FIREBASE HOSTING TO VERCEL

### Context
This monorepo contains three applications:
1. **Garage Scholars** — main marketing/service website
2. **Resale Concierge** — resale application
3. **Scheduling App** — scheduling tool

All three use Firebase for backend (Firestore, Auth, Storage) and are currently deployed via Firebase Hosting. The backend stays on Firebase. We are ONLY changing where the frontend is hosted — moving it to Vercel.

### Instructions

**STEP 1: Audit the current project**
- Map the monorepo structure. Identify each app's entry point, build command, and output directory.
- Document all Firebase Hosting config (`firebase.json`, `.firebaserc`, rewrites, redirects, headers).
- List all environment variables and Firebase config keys used across all three apps.

**STEP 2: Create Vercel configuration**
- Create `vercel.json` in project root configured for the monorepo.
- Replicate ALL Firebase Hosting rewrites, redirects, and headers as Vercel equivalents.
- Configure routing so all three apps work correctly.

**STEP 3: Environment variables**
- Create `.env.example` listing every required environment variable with placeholder values and comments.
- Add a note: "Add these as Environment Variables in Vercel Dashboard → Project Settings → Environment Variables"

**STEP 4: Update build/deploy scripts**
- Ensure `npm run build` produces correct output for Vercel.
- Do NOT remove Firebase CLI or firebase packages — we still need them for Firestore, Auth, Functions, Storage.
- Only remove `firebase deploy --only hosting` type commands if present.

**STEP 5: Handle API routes / serverless functions**
- If any apps use Firebase Cloud Functions called via hosting rewrites, either convert to Vercel Serverless Functions or keep as external calls to Firebase Functions URLs.
- Document which approach you chose and why.

**STEP 6: Clean up hardcoded URLs**
- Search for any hardcoded Firebase Hosting URLs (e.g., `your-project.web.app`). Replace with environment variables.

**STEP 7: Verify the build**
- `npm run build` must succeed with zero errors.
- All Firebase SDK imports and initializations are intact.
- All Firestore, Auth, and Storage operations are untouched.

**STEP 8: Create deployment docs**
Create `DEPLOY.md` with clear instructions for:
- Pushing to GitHub
- Importing into Vercel
- Adding environment variables
- Setting up custom domain
- What stays on Firebase vs. what moved to Vercel

### HARD RULES FOR TASK 1:
- ✅ All Firebase backend functionality MUST continue working identically
- ✅ All existing routes and URLs must work on Vercel
- ✅ All three apps must build and deploy successfully
- ❌ Do NOT delete firebase packages from dependencies
- ❌ Do NOT modify any Firestore/Auth/Storage code
- ❌ Do NOT change any database schemas or security rules
- ❌ Do NOT break any existing feature

---

## TASK 2: RECOVER MISSING FEATURES FROM THE ORIGINAL SCHEDULING APP

### Context
The Garage Scholars Scheduling App was originally prototyped and built inside Google AI Studio. That original version was then exported/downloaded and rebuilt here in VS Code using Claude Code. During that rebuild process, some features from the original may have been dropped or not carried over.

There is NO Google AI Studio API key involved in this task. The original was just built there as a development tool. We need to compare what the original version had versus what the current version has, and add back anything that's missing.

### Instructions

**STEP 1: Find the original version**
Search the entire repo for the original Google AI Studio version of the Scheduling App:
- Look for directories like `/original`, `/backup`, `/v1`, `/old`, `/archive`, `/exported`, `/ai-studio`, or any folder containing an earlier version
- Search git history: `git log --all --oneline --diff-filter=A -- "*.html" "*.js" "*.jsx" "*.ts" "*.tsx"` to find early commits
- Check for standalone HTML files (AI Studio often exports single-file apps)
- Look for files with comments referencing "AI Studio", "Google AI Studio", or "original"
- Check all branches: `git branch -a`
- Check for deleted files in git history: `git log --all --diff-filter=D --name-only`

**If you find the original code:** proceed to Step 2.

**If you CANNOT find it:** STOP and report back. List exactly where you looked and what you found. Do not guess or fabricate features. We will need to manually provide the original file.

**STEP 2: Compare feature sets**
Create a detailed comparison:
- Catalog every feature, function, UI element, and user-facing capability in the ORIGINAL version
- Catalog every feature, function, UI element, and user-facing capability in the CURRENT version
- Produce a clear printed list:
  - **In both versions** → leave alone
  - **Only in current version** → leave alone
  - **Only in original version** → THESE GET ADDED

Print this comparison list before implementing anything.

**STEP 3: Implement missing features**
For each feature only in the original:
- Implement it into the current codebase
- Match the current app's code style, component patterns, and design language
- Integrate cleanly — no conflicts or duplicates
- If a feature was done differently in both versions, keep the current version's approach

**STEP 4: Verify**
- ALL original features now exist in the current app
- ALL current features still work exactly as before
- No duplicate or conflicting functionality
- No UI or layout breaks
- Build completes with zero errors

### HARD RULES FOR TASK 2:
- ✅ Add all missing features from the original
- ✅ Match current code style and patterns
- ✅ If you can't find the original code, STOP and say so — do not guess
- ❌ Do NOT remove or modify any current features
- ❌ Do NOT replace current implementations with original ones — only ADD what's missing
- ❌ Do NOT break existing functionality

---

## FINAL CHECKLIST

- [ ] `npm run build` succeeds with zero errors
- [ ] `vercel.json` is properly configured
- [ ] `.env.example` documents all required variables
- [ ] `DEPLOY.md` has clear deployment instructions
- [ ] All Firebase backend connections work (Auth, Firestore, Storage)
- [ ] All three apps route correctly
- [ ] Missing Scheduling App features identified and restored (or reported as unfindable)
- [ ] All current features across all apps preserved
- [ ] No hardcoded secrets in codebase
- [ ] Git commit with clear message describing changes
