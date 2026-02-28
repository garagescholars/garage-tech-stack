const path = require('path');
const fs = require('fs'); 
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const multer = require('multer'); 

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- MULTER SETUP ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawTitle = req.body.title || 'untitled';
    const safeTitle = rawTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${safeTitle}-${uniqueSuffix}${path.extname(file.originalname)}`); 
  }
});
const upload = multer({ storage: storage });
// --------------------

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: KEYBOARD SCROLLER ---
const scrollDown = async (page, times = 15) => {
    console.log(`      ⬇️ Scrolling down ${times} times...`);
    for (let i = 0; i < times; i++) {
        await page.keyboard.press('ArrowDown');
        await delay(100); 
    }
};

// --- HELPER: POPUP KILLER ---
const dismissFacebookPopups = async (page) => {
    try {
        await page.keyboard.press('Escape');
        await delay(500);
        const closeButtons = await page.$$('xpath///div[@aria-label="Close"] | //div[@role="button"]//i');
        if (closeButtons.length > 0) {
            await closeButtons[0].click();
            await delay(500);
        }
    } catch (e) {}
};

app.post('/api/post', upload.array('images', 12), async (req, res) => {
  const item = req.body; 
  const uploadedFiles = req.files; 
  console.log(`📩 Received command: ${item.title} [Target: ${item.platform}]`);

  // =========================================================
  // 💳 CREDIT CARD CONFIGURATION
  // =========================================================
  const PAYMENT_INFO = {
      name:       "Tyler Sodia",      
      cardNumber: "0000000000000000", // <--- REPLACE THIS
      expMonth:   "01",               
      expYear:    "26",               
      cvc:        "123",              
      address:    "123 Main St",      
      city:       "Denver",
      state:      "CO",
      zip:        "80202"
  };
  // =========================================================

  let results = { craigslist: 'skipped', facebook: 'skipped' };

  try {
    const browser = await puppeteer.launch({ 
        headless: false, 
        slowMo: 40, 
        userDataDir: "./my_craigslist_session",
        args: ['--disable-notifications'] 
    });
    
    // CRAIGSLIST TAB
    const clPage = await browser.newPage();

    // =================================================================
    // 🟣 MISSION 1: CRAIGSLIST (Brute Force Mode)
    // =================================================================
    if (item.platform === 'Craigslist' || item.platform === 'Both') {
        console.log('🟣 Starting Craigslist Mission...');
        try {
            // 1. LOGIN & NAVIGATE
            await clPage.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' });
            if (clPage.url().includes('login')) {
                await clPage.waitForSelector('a[href*="logout"]', { timeout: 0 }); 
                await clPage.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' });
            }

            // 2. LOCATION & TYPE
            try {
              await clPage.waitForSelector('input[value="fsd"]', { timeout: 2000 });
              await clPage.click('input[value="fsd"]');
              await clPage.click('button[name="go"]'); 
            } catch (e) {}
      
            // 3. FORCE CLICK RADIO BUTTON #25
            try {
                await clPage.waitForSelector('.picker', {timeout: 5000}); 
                console.log('      ...Searching for Radio Button #25...');
                const radios = await clPage.$$('input[type="radio"]');
                const TARGET_INDEX = 24; 

                if (radios.length > TARGET_INDEX) {
                    await radios[TARGET_INDEX].click(); 
                    console.log(`      ✅ Clicked Radio Button #${TARGET_INDEX + 1} (General for Sale)`);
                    try {
                        await clPage.waitForNavigation({ timeout: 3000 });
                        console.log('      👉 Auto-navigation detected.');
                    } catch (navError) {
                        console.log('      👉 No auto-nav. Clicking Continue...');
                        await clPage.click('button[name="go"]');
                        await clPage.waitForNavigation();
                    }
                } else {
                    await radios[radios.length - 1].click();
                    await clPage.click('button[name="go"]');
                }
            } catch (e) {
                console.log('      ❌ CL Category Error:', e.message);
                try { await clPage.click('button[name="go"]'); await clPage.waitForNavigation(); } catch(e){}
            }

            try {
                 const denverLabel = await clPage.$('label'); 
                 if (denverLabel) {
                     await clPage.evaluate(() => {
                        const labels = Array.from(document.querySelectorAll('label'));
                        const den = labels.find(el => el.textContent.toLowerCase().includes('city of denver'));
                        if (den) den.click();
                    });
                     await Promise.all([clPage.waitForNavigation(), clPage.click('button[name="go"]')]);
                 }
            } catch (e) {}
      
           // 4. FILL FORM
          console.log('   📝 Filling CL Form...');
          await clPage.waitForSelector('input[name="PostingTitle"]', { timeout: 10000 });
          
          let finalBody = `${item.title}\n\n`;
          finalBody += (item.description && item.description.trim() !== "") ? item.description : "Item available for pickup.";
          finalBody += "\n\nItem Available for Pickup. Please contact for details.\n----------------\nContact Garage Scholars, LLC";
    
          await clPage.evaluate((data) => {
              const emailInput = document.querySelector('input[name="FromEMail"]');
              if (emailInput && !emailInput.value) emailInput.value = 'garagescholars@gmail.com';
              document.querySelector('input[name="PostingTitle"]').value = data.title;
              document.querySelector('input[name="price"]').value = data.price.replace(/[^0-9.]/g, '');
              document.querySelector('input[name="postal"]').value = '80202';
              document.querySelector('textarea[name="PostingBody"]').value = data.body;
          }, { title: item.title, price: item.price, body: finalBody });
    
          try {
              const showPhoneCheckbox = await clPage.$('input[name="show_phone_ok"]');
              if (showPhoneCheckbox) {
                  await showPhoneCheckbox.click();
                  await clPage.type('input[name="contact_phone"]', '7205073969');
                  await clPage.type('input[name="contact_name"]', 'Garage Scholars');
                  const contactTextOk = await clPage.$('input[name="contact_text_ok"]');
                  if (contactTextOk) await contactTextOk.click();
              }
          } catch (e) {}
    
          await Promise.all([ clPage.waitForNavigation(), clPage.click('button[name="go"]') ]);
          
          // 5. MAP ENFORCER
          console.log('   🗺️ Negotiating Navigation...');
          let onImagePage = false;
          let attempts = 0;
          while (!onImagePage && attempts < 5) {
              attempts++;
              const fileInputFound = await clPage.$('input[type="file"]');
              if (fileInputFound) {
                  onImagePage = true;
              } else {
                  const continueBtn = await clPage.$('button[name="go"], button.continue');
                  if (continueBtn) {
                      try { await Promise.all([ clPage.waitForNavigation({ timeout: 5000 }), continueBtn.click() ]); } catch(e) {}
                  } else {
                      await delay(1000);
                  }
              }
          }

          // 6. UPLOAD IMAGES
          if (uploadedFiles && uploadedFiles.length > 0) {
            console.log(`   📸 Uploading ${uploadedFiles.length} images...`);
            const fileInput = await clPage.waitForSelector('input[type="file"]', { timeout: 10000 });
            if (fileInput) {
                const imagePaths = uploadedFiles.map(file => file.path);
                await fileInput.uploadFile(...imagePaths);
                
                let onDraftPage = false;
                let draftAttempts = 0;
                while (!onDraftPage && draftAttempts < 45) {
                    draftAttempts++;
                    await clPage.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const doneBtn = buttons.find(b => b.textContent.toLowerCase().includes('done with images'));
                        if (doneBtn) doneBtn.click();
                    });
                    await delay(1000);
                    const pageContent = await clPage.content();
                    if (pageContent.includes('unpublished draft')) onDraftPage = true;
                }
            }
          }

          // 7. PUSH TO PAYMENT
          console.log('   🚀 Pushing to Payment Page...');
          const draftContinueBtn = await clPage.$('button[name="go"], button.continue');
          if (draftContinueBtn) {
              await Promise.all([ draftContinueBtn.click() ]);
              console.log('      ...Waiting 2.5s for payment form...');
              await delay(2500); 
              await scrollDown(clPage, 5); 
          }

          // 8. AUTO-FILL PAYMENT
          console.log('   💳 Filling Payment Information...');
          try {
             let paymentFrame = null;
             let nameField = null;

             const frames = clPage.frames();
             for (const frame of frames) {
                 const el = await frame.$('xpath///label[contains(text(), "Name")]/following::input[1] | //div[contains(text(), "Name")]/following::input[1]');
                 if (el) {
                     paymentFrame = frame;
                     nameField = el;
                     break;
                 }
             }

             if (paymentFrame && nameField) {
                 await nameField.click({ clickCount: 3 });
                 await nameField.type(PAYMENT_INFO.name);
                 
                 const pressTab = async (text) => {
                     await clPage.keyboard.press('Tab');
                     await delay(300);
                     if (text) await clPage.keyboard.type(text);
                 };

                 await pressTab(PAYMENT_INFO.cardNumber); 
                 const combinedDate = `${PAYMENT_INFO.expMonth}${PAYMENT_INFO.expYear}`;
                 await pressTab(combinedDate);  
                 await pressTab(PAYMENT_INFO.cvc);        
                 await pressTab(PAYMENT_INFO.address);    
                 await pressTab(PAYMENT_INFO.city);       
                 await pressTab(PAYMENT_INFO.state);      
                 await pressTab(PAYMENT_INFO.zip);        
                 
                 console.log('      ✅ Payment Filled. Please review.');
                 results.craigslist = 'success - manual submit required';
             } else {
                 console.log('      ⚠️ Could not find "Name" field.');
             }

          } catch (e) {
             console.log('   ⚠️ Payment Auto-fill Error:', e.message);
          }
          
        } catch (err) {
            console.error('   ❌ Craigslist Failed:', err.message);
            results.craigslist = 'failed';
        }
    }

    // =================================================================
    // 🔵 MISSION 2: FACEBOOK MARKETPLACE (Winner: JS Force Click)
    // =================================================================
    if (item.platform === 'FB Marketplace' || item.platform === 'Both') {
        console.log('🔵 Starting Facebook Mission (New Tab)...');
        const fbPage = await browser.newPage();
        
        try {
            await fbPage.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'networkidle2' });
            
            const loginField = await fbPage.$('input[name="email"]');
            if (loginField) {
                 await fbPage.waitForNavigation({ timeout: 0 }); 
                 await fbPage.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'networkidle2' });
            }
            await dismissFacebookPopups(fbPage);

            // 1. UPLOAD IMAGES
            console.log('   📸 Uploading images to Facebook...');
            const fbFileInput = await fbPage.waitForSelector('div[aria-label="Add photos"] input, input[type="file"]', { timeout: 10000 });
            if (fbFileInput && uploadedFiles.length > 0) {
                const imagePaths = uploadedFiles.map(file => file.path);
                await fbFileInput.uploadFile(...imagePaths);
                await delay(5000); 
            }
            await dismissFacebookPopups(fbPage);

            // 2. FILL TEXT FIELDS
            console.log('   📝 Filling Facebook Details...');
            const fillFB = async (labelText, value) => {
                 try {
                     const xpath = `xpath///label[.//span[contains(text(), "${labelText}")]]//input | //label[.//span[contains(text(), "${labelText}")]]//textarea`;
                     const elements = await fbPage.$$(xpath);
                     if (elements.length > 0) {
                         await elements[0].click({ clickCount: 3 });
                         await elements[0].type(value);
                         console.log(`      ✅ Typed "${labelText}"`);
                     }
                 } catch(e) {}
            };

            await fillFB("Title", item.title);
            await delay(3000); 

            await fillFB("Price", item.price.replace(/[^0-9]/g, ''));
            await fillFB("Description", item.description || item.title);

            // 3. KEYBOARD SCROLL
            await scrollDown(fbPage, 20);

            // 4. SMART CATEGORY
            console.log('   📂 Clicking First Suggested Category...');
            try {
                const xpath = `xpath///label[.//span[contains(text(), "Category")]]/following::div[@role="button"][1]`;
                const suggestionBtn = await fbPage.$$(xpath);
                
                if (suggestionBtn.length > 0) {
                    const text = await fbPage.evaluate(el => el.textContent, suggestionBtn[0]);
                    console.log(`      👉 Clicking Suggestion: "${text}"`);
                    await suggestionBtn[0].click();
                    await delay(1000);
                } else {
                    console.log('      ⚠️ No suggestion button found. Defaulting.');
                }
            } catch (e) {
                console.log('      ❌ Category Click Error:', e.message);
            }

            // 5. CONDITION (USED - GOOD)
            console.log('   ✨ Selecting Condition...');
            try {
                const condLabels = await fbPage.$$('xpath///label[.//span[contains(text(), "Condition")]]');
                if (condLabels.length > 0) {
                    await condLabels[0].click();
                    await delay(1000);
                    await fbPage.keyboard.press("ArrowDown"); await delay(100);
                    await fbPage.keyboard.press("ArrowDown"); await delay(100);
                    await fbPage.keyboard.press("ArrowDown"); await delay(100);
                    await fbPage.keyboard.press("Enter");
                    console.log('      ✅ Condition Selected (Used - Good)');
                }
            } catch (e) {}

            // 6. CLICK NEXT (To Delivery Page)
            console.log('   🚀 Clicking Next...');
            await scrollDown(fbPage, 10); 
            try {
                const nextBtns = await fbPage.$$('xpath///div[@aria-label="Next"] | //span[contains(text(), "Next")]');
                if (nextBtns.length > 0) await nextBtns[nextBtns.length - 1].click();
            } catch (e) {}
            
            // WAIT FOR DELIVERY PAGE
            console.log('      ...Waiting for Delivery Page...');
            await delay(4000); 

            // 7. DELIVERY (Skipping Location, Focusing on Meetup)
            console.log('   🚚 Setting Delivery (Skipping Location)...');
            try {
                // FORCE CLICK "Public meetup" using JS (The Winning Logic)
                const meetupClicked = await fbPage.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span'));
                    const target = spans.find(el => el.textContent.includes('Public meetup'));
                    if (target) {
                        target.click(); // Click the text itself
                        return true;
                    }
                    return false;
                });

                if (meetupClicked) {
                    console.log('      ✅ Public Meetup Toggled (JS Force Click)');
                } else {
                    console.log('      ⚠️ Could not find "Public meetup" text.');
                }

                // C. Click Final Next
                await delay(1000);
                const nextBtns2 = await fbPage.$$('xpath///div[@aria-label="Next"] | //span[contains(text(), "Next")]');
                if (nextBtns2.length > 0) {
                     await nextBtns2[nextBtns2.length - 1].click();
                     console.log('      ✅ Clicked Final Next');
                }
                
            } catch(e) {
                console.log('      ⚠️ Delivery settings skipped/error:', e.message);
            }

            console.log('   ✅ Facebook Draft Ready. Please review and click Publish!');
            results.facebook = 'success - manual review';

        } catch (err) {
            console.error('   ❌ Facebook Failed:', err.message);
            results.facebook = 'failed';
        }
    }

    console.log('✅ ALL MISSIONS COMPLETE', results);
    res.json({ success: true, results });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});