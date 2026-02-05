# 🚀 Scholar Recruitment System - Setup Instructions

**Time to Complete:** 15 minutes
**Cost:** $10-20 for flyers
**Result:** Ready to accept scholar applications

---

## Step 1: Update Firebase Security Rules (5 minutes)

Open `/Users/tylersodia/Desktop/Garage Scholars/schedulingsystem/firestore.rules` and add this section:

```javascript
// Add this BEFORE the closing bracket "}"

// Scholar Applications
match /scholarApplications/{appId} {
  // Allow anyone to create (public application form)
  allow create: if request.resource.data.keys().hasAll(['name', 'phone', 'email', 'school']);

  // Only admins can read and update
  allow read, update: if request.auth != null &&
    (request.auth.token.email == 'tylerzsodia@gmail.com' ||
     request.auth.token.email == 'zach.harmon25@gmail.com');

  // Prevent deletion
  allow delete: if false;
}
```

Then deploy:
```bash
cd schedulingsystem
firebase deploy --only firestore:rules
```

---

## Step 2: Deploy Landing Page (3 minutes)

**Option A: Add to existing website**

```bash
# Copy landing page to Website folder
cp scholarrecruitment/landing-page/index.html Website/apply.html

# The landing page will be at garagescholars.com/apply after website deployment
```

**Option B: Test locally first**

```bash
# Start local server
cd scholarrecruitment/landing-page
python3 -m http.server 8001

# Open in browser: http://localhost:8001
```

---

## Step 3: Update QR Code on Flyer (2 minutes)

1. Open `scholarrecruitment/assets/flyer-template.html`
2. Find line 125:
   ```javascript
   const applicationUrl = "https://garagescholars.com/apply";
   ```
3. Update URL to your actual landing page URL
4. Open in Chrome
5. Print to PDF
6. Take PDF to library/print shop

**Printing Tips:**
- Bright colored paper (yellow or orange grabs attention)
- 200 copies = ~$10-20
- Print on Saturday morning, deploy immediately

---

## Step 4: Bookmark Admin Dashboard (1 minute)

1. Open `scholarrecruitment/tracking/admin-dashboard.html` in Chrome
2. Press Cmd+D to bookmark
3. Name it "Scholar Applications"
4. Check daily for new applications

---

## Step 5: Deploy Flyers (30 minutes)

**Best Locations (DU Campus):**
- Student Center bulletin boards
- Library study areas
- Rec center locker rooms
- Nelson Hall (business school)
- Ritchie Center (gym)
- Dining halls

**Pro Tips:**
- Go Saturday morning 8-9am (less security, more visibility)
- Use thumbtacks or tape
- Place at eye level
- Take photos of where you posted (remember for next batch)

**Legal Note:** Some campuses have rules about posting. If asked, say "I'm a student hiring for a local business."

---

## Step 6: Post on Social Media (30 minutes)

Use templates from `scholarrecruitment/templates/response-templates.md`

**Facebook Groups to Join:**
- "DU Class of 2025, 2026, 2027, 2028"
- "CU Boulder Student Jobs"
- "CSM Mines Student Marketplace"
- "Denver College Students"

**Post on Sunday Evening (7-9pm)** - Students are planning their week

---

## Step 7: Test the System (5 minutes)

1. Open landing page on your phone
2. Fill out the application form as a test
3. Submit
4. Check admin dashboard - your test application should appear
5. Delete test application from Firebase Console (optional)

---

## 🎯 Week 1 Goals

- [ ] 200 flyers deployed
- [ ] 10 Facebook posts made
- [ ] 10 applications received
- [ ] 5 phone interviews completed
- [ ] 3 scholars hired

---

## 📱 Your Daily Routine (15 minutes/day)

**Morning:**
- Check admin dashboard for new applications
- Text top candidates for phone interviews

**Afternoon:**
- Conduct 2-3 quick phone interviews (10 min each)
- Update statuses in dashboard

**Evening:**
- Post in 1-2 Facebook groups
- Respond to questions

---

## 🚨 Common Issues & Fixes

### Issue: Landing page not loading
**Fix:** Make sure you deployed it. Check Firebase Console → Hosting

### Issue: No applications coming in
**Fix:**
1. Verify landing page URL is correct on flyers
2. Test form submission yourself
3. Post more aggressively on social media

### Issue: Dashboard shows "Loading..."
**Fix:**
1. Open browser console (F12)
2. Check for Firebase errors
3. Verify you're using correct Firebase project

### Issue: Can't update application status
**Fix:** Make sure you're signed in to Firebase (only admins can update)

---

## 💡 Pro Tips

1. **Respond within 4 hours** - Students apply to multiple jobs, first to respond wins
2. **Interview on the spot** - "Can you chat for 10 min right now?" gets 80% yes rate
3. **Hire fast** - Same-day hiring decision. Don't overthink it.
4. **Overhire** - Not everyone will take jobs. Aim for 2x scholars vs. jobs needed.
5. **Use referrals** - After hiring first 3, ask them "Know anyone else who wants to work?"

---

## 📊 Success Metrics (Week 1)

- **Applications:** 10+
- **Interview Rate:** 50% (5 of 10)
- **Hire Rate:** 60% (3 of 5 interviewed)
- **Cost Per Hire:** $5-10 (flyers + your time)
- **Time to First Hire:** 3-4 days from flyer deployment

---

## 🎉 You're Ready!

Everything is built and ready to go. Now it's about execution:

**Today:** Print flyers + join Facebook groups
**Tomorrow:** Deploy flyers on campus
**This Week:** First 3 hires
**Next Week:** First job with scholar

Questions? Refer to `README.md` or text Tyler.

---

**System Status:** ✅ READY TO LAUNCH
**Next Action:** Print flyers and deploy on campus
**Time to First Application:** 24-48 hours after flyer deployment

Good luck! 🚀
