# 🎓 Scholar Recruitment System

Complete infrastructure for recruiting college students to work as Garage Scholars.

---

## 📁 Directory Structure

```
scholarrecruitment/
├── landing-page/          # Student application landing page
│   └── index.html         # Mobile-optimized application form
├── templates/             # All communication templates
│   └── response-templates.md  # SMS, email, phone scripts
├── tracking/              # Admin dashboards
│   └── admin-dashboard.html   # Track all applications
├── assets/                # Marketing materials
│   └── flyer-template.html    # Printable recruitment flyer
├── scripts/               # Automation scripts (NOT YET ACTIVE)
│   └── (to be added)
└── README.md              # This file
```

---

## 🚀 Quick Start (5-Minute Setup)

### Step 1: Deploy Landing Page to Firebase Hosting

**Option A: Use existing hosting**
```bash
# Copy landing page to Website folder
cp landing-page/index.html ../Website/apply.html

# Deploy
cd ../schedulingsystem
firebase deploy --only hosting
```

**Option B: Create separate hosting site**
```bash
cd landing-page
firebase init hosting
firebase deploy
```

**Result:** Landing page will be live at `garagescholars.com/apply` or your chosen URL.

---

### Step 2: Print Flyers (Today!)

1. Open `assets/flyer-template.html` in Chrome
2. **IMPORTANT:** Edit line 125 to update the QR code URL:
   ```javascript
   const applicationUrl = "https://garagescholars.com/apply"; // UPDATE THIS
   ```
3. File → Print → Save as PDF
4. Take PDF to library/print shop
5. Print 200 copies on bright colored paper (yellow or orange works best)
6. Deploy on campus:
   - Student center bulletin boards
   - Library study areas
   - Gym locker rooms
   - Dining halls
   - Engineering/Business school buildings
   - Dorm common areas

**Cost:** ~$10-20 for 200 copies

---

### Step 3: Open Admin Dashboard

1. Open `tracking/admin-dashboard.html` in your browser
2. Bookmark it for easy access
3. Check daily for new applications

**Features:**
- Real-time application tracking
- Filter by status (New, Interviewed, Hired, Rejected)
- Quick action buttons
- Applicant details modal
- Stats dashboard

---

### Step 4: Set Up Auto-Response (Optional but Recommended)

**Using Firebase Cloud Functions:**

Create a new Cloud Function in `schedulingsystem/functions/src/index.ts`:

```typescript
export const notifyNewScholarApplication = onDocumentCreated(
  'scholarApplications/{appId}',
  async (event) => {
    const appData = event.data?.data();
    if (!appData) return;

    // Send SMS to Tyler
    // TODO: Integrate Twilio or similar SMS service

    // Send auto-response email to applicant
    await db.collection('mail').add({
      to: appData.email,
      message: {
        subject: 'Application Received - Garage Scholars',
        text: `Hi ${appData.name}!\n\nThanks for applying to Garage Scholars! 🎓\n\nWe're reviewing your application now. You'll hear from us within 24 hours for a quick phone interview.\n\nQuestions? Text me directly: (720) 290-1560\n\n- Tyler, Garage Scholars`
      }
    });
  }
);
```

---

## 📋 Execution Checklist

### Week 1: Foundation
- [ ] Deploy landing page to `garagescholars.com/apply`
- [ ] Print 200 flyers
- [ ] Post flyers on DU/CSM/CU campuses (Saturday morning)
- [ ] Join 15 student Facebook groups
- [ ] Post in Facebook groups using templates from `templates/response-templates.md`
- [ ] Set up Google Voice number (free) for applications
- [ ] Bookmark admin dashboard for daily checks

### Week 2: Scale Up
- [ ] Post in additional 20 Facebook groups
- [ ] Text 10 friends personally
- [ ] Reach out to 5 fraternity/sorority presidents
- [ ] Post on Reddit: r/DU, r/CSM, r/CUBoulder
- [ ] Offer $50 referral bonus to first 5 hires
- [ ] Interview top 10 applicants

### Week 3: Optimize
- [ ] Analyze which channels got most applications
- [ ] Double down on best-performing channels
- [ ] Update flyers based on feedback
- [ ] Launch referral bonus program ($50 per hired friend)
- [ ] Aim for 20 active scholars on roster

---

## 📱 Daily Workflow

### Morning (10 minutes)
1. Open admin dashboard
2. Check for new applications
3. Text top candidates: "Hi [Name]! Saw your application. Can you do a 10-min call today?"

### Afternoon (30 minutes)
4. Conduct 3-4 phone interviews (use script from templates)
5. Update status in dashboard (Interviewed/Hired/Rejected)
6. Send offer texts to qualified candidates

### Evening (15 minutes)
7. Post 2-3 recruitment messages in Facebook groups
8. Respond to any questions from applicants
9. Check tomorrow's jobs and alert available scholars

---

## 🎯 Response Time Targets

- **New Application → Initial Text:** 4 hours max
- **Interview Request → Phone Call:** 24 hours max
- **Interview → Hiring Decision:** Same day
- **Offer Accepted → First Job Alert:** 24 hours max

**Why this matters:** Fast response = higher acceptance rates. Students apply to multiple jobs, first to respond wins.

---

## 📊 Key Metrics to Track

Monitor these weekly in admin dashboard:

1. **Application Volume**
   - Goal: 10-20 applications/week
   - Track by source (flyer, Facebook, friend referral)

2. **Conversion Rate**
   - Applications → Interviews: Target 50%
   - Interviews → Hires: Target 70%
   - Overall: 35% of applicants should get hired

3. **Retention**
   - Scholars completing 1 job: 100%
   - Scholars completing 3+ jobs: Target 60%
   - Scholars active after 1 month: Target 40%

4. **Channel Effectiveness**
   - Which source brings best scholars?
   - Which has lowest cost per hire?
   - Double down on winners, cut losers

---

## 💬 Sample Conversations

### Text Conversation: New Applicant

```
YOU: Hi Jake! Tyler from Garage Scholars. Saw your application - looks great! Can you do a quick 10-min call today? Reply with a good time.

JAKE: Yeah, 3pm works

YOU: Perfect! I'll call you at 3pm at this number. Talk soon!

[At 3pm, call and use phone script from templates]

[After interview if YES]
YOU: Great talking to you! You're hired 🎉 I'm adding you to our job board app. You'll start seeing available jobs within 24 hours. Pay is $25-35/hr depending on the job. Questions?

JAKE: Sweet! When's the first job?

YOU: I'll text you when one gets posted. Usually 2-3 jobs per week. You pick which ones you want to take - totally flexible. Welcome to the team! 👊
```

### Text Conversation: Job Alert

```
YOU: 🚨 JOB AVAILABLE THIS SATURDAY 🚨

Where: Denver (Highlands)
When: Saturday 10am-3pm (5 hours)
Pay: $175
What: Garage organization

Interested? First to reply gets it!

SCHOLAR 1: I'll take it!

YOU: It's yours! I'll text you the address Friday night. Bring work gloves. Client will be home. See you Saturday!
```

---

## 🎨 Marketing Tips

### What Works
✅ **Emphasize flexibility** - "Work around your class schedule"
✅ **Highlight same-day pay** - Students are cash-strapped
✅ **Mention working with friends** - Team jobs are more fun
✅ **Show earning potential** - "$150-200 for one Saturday"
✅ **Post at optimal times** - Sunday evening (students planning their week)

### What Doesn't Work
❌ Long-winded job descriptions
❌ Posting during class hours (nobody sees it)
❌ Corporate-sounding language
❌ Making it sound like a "real job" (students want flexibility)
❌ Asking for resumes or formal applications

### Best Channels (Ranked)
1. **Campus flyers** - High visibility, low competition
2. **Friend referrals** - Pre-vetted, higher retention
3. **Facebook student groups** - Wide reach, free
4. **Direct messages** - Personalized, high response rate
5. **Reddit** - Tech-savvy students, niche communities

---

## 🔧 Technical Setup

### Firebase Collection Structure

**Collection:** `scholarApplications`

**Document Fields:**
```javascript
{
  name: string,
  phone: string,
  email: string,
  school: string,
  year: string,
  availability: string,
  hasCar: string,
  referralSource: string,
  whyJoin: string,
  status: 'NEW' | 'INTERVIEWED' | 'HIRED' | 'REJECTED',
  appliedAt: timestamp,
  statusUpdatedAt: timestamp (optional),
  source: 'landing-page' | 'manual'
}
```

### Security Rules

Add to `schedulingsystem/firestore.rules`:

```javascript
// Scholar Applications
match /scholarApplications/{appId} {
  // Allow public writes (anyone can apply)
  allow create: if request.resource.data.keys().hasAll(['name', 'phone', 'email', 'school']);

  // Only admins can read and update
  allow read, update: if request.auth != null &&
    request.auth.token.email in ['tylerzsodia@gmail.com', 'zach.harmon25@gmail.com'];

  // Prevent deletion
  allow delete: if false;
}
```

Deploy rules:
```bash
cd schedulingsystem
firebase deploy --only firestore:rules
```

---

## 🤖 Automation Scripts (Coming Soon)

These scripts are built but **NOT YET ACTIVE**. Activate when ready:

1. **Auto-poster** - Daily Craigslist posts
2. **Lead scraper** - Monitor Facebook groups for interested students
3. **Email harvester** - Collect university emails from public directories
4. **Response bot** - Auto-reply to common questions

**To activate:** See `scripts/` directory (to be added when ready to launch).

---

## 📈 Growth Strategy

### Month 1: Foundation (10 Scholars)
- Focus on quality over quantity
- Manual recruitment only
- DU/CSM/CU students only
- Build processes and templates

### Month 2: Scale (30 Scholars)
- Launch referral program
- Expand to Metro State, Regis
- Start automation scripts
- Track retention metrics

### Month 3: Optimize (50+ Scholars)
- Cut underperforming channels
- Double down on best sources
- Implement tiered pay ($25/$30/$35 based on experience)
- Create "Scholar Team Lead" role

---

## 🆘 Troubleshooting

### Problem: Not enough applications

**Solutions:**
- Post flyers in NEW locations
- Offer $25 signup bonus for first 10 scholars
- Lower requirements (remove "has car" requirement)
- Post at different times of day
- Try Instagram/TikTok instead of Facebook

### Problem: High application volume but low hires

**Solutions:**
- Speed up interview process (text instead of call)
- Simplify requirements
- Raise pay rate to $30 starting
- Offer flexible scheduling guarantee

### Problem: Scholars not taking jobs

**Solutions:**
- Post jobs earlier in the week
- Increase pay for unpopular time slots
- Bundle jobs (work 2 Saturdays, get bonus)
- Create competition ("First 5 to accept get $5 bonus")

### Problem: High turnover after first job

**Solutions:**
- Better job prep (clearer expectations)
- Provide supplies and tools
- Pair new scholars with experienced ones
- Check in after first job (text "How'd it go?")

---

## 📞 Support

**Questions?** Text Tyler: (720) 290-1560

**System Issues?** Check:
1. Firebase Console → scholarApplications collection
2. Admin dashboard → Browser console (F12)
3. Landing page → Test form submission

---

## ✅ Next Steps

**Right Now (5 minutes):**
1. Open `assets/flyer-template.html`
2. Update QR code URL to your landing page
3. Print 200 copies

**Today (30 minutes):**
4. Post flyers on DU campus
5. Join 5 student Facebook groups
6. Post recruitment message using templates

**This Week:**
7. Collect 10 applications
8. Interview 5 candidates
9. Hire first 3 scholars
10. Post first job

**Launch timeline:** 7 days from flyer deployment to first scholar-completed job.

---

**Built with Claude Code | Last Updated: Feb 2026**
