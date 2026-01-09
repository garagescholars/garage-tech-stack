const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs'); 
const https = require('https'); // For downloading
const puppeteer = require('puppeteer');

// 1. INITIALIZE FIREBASE
const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = getFirestore();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log("🤖 NODE ROBOT ONLINE: Watching for 'Pending' items...");

// [YOUR PAYMENT_INFO OBJECT HERE]
const PAYMENT_INFO = {
    name: "Tyler Sodia",
    cardNumber: "0000000000000000", // <--- UPDATE THIS
    expMonth: "01", expYear: "26", cvc: "123",
    address: "123 Main St", city: "Denver", state: "CO", zip: "80202", phone: "7205073969"
};

// --- HELPER: SCROLLER ---
const scrollDown = async (page, times = 5) => {
    await page.evaluate(async (loops) => {
        for(let i=0; i<loops; i++){ window.scrollBy(0, 300); await new Promise(r => setTimeout(r, 50)); }
    }, times);
};

// --- HELPER: POPUP KILLER ---
const dismissFacebookPopups = async (page) => {
    try {
        await page.keyboard.press('Escape'); await delay(300);
        const closeButtons = await page.$$('xpath///div[@aria-label="Close"] | //div[@role="button"]//i');
        if (closeButtons.length > 0) { await closeButtons[0].click(); await delay(300); }
    } catch (e) {}
};

// --- HELPER: DOWNLOADER ---
// Downloads a file from a URL to a local path
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(filepath);
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
};

// =========================================================
// 🧠 THE WORKER FUNCTION
// =========================================================
async function processListing(docId, item) {
    const listingTitle = item.clientName ? `${item.clientName} - ${item.title}` : item.title;
    console.log(`\n🔔 NEW JOB RECEIVED: ${listingTitle}`);

    // 1. DOWNLOAD IMAGES
    const downloadedPaths = [];
    if (item.imageUrls && item.imageUrls.length > 0) {
        console.log(`   ⬇️ Downloading ${item.imageUrls.length} images...`);
        const tempDir = path.join(__dirname, 'temp_downloads');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        for (let i = 0; i < item.imageUrls.length; i++) {
            try {
                // Ensure unique name
                const safeName = `img_${docId}_${i}.jpg`;
                const destPath = path.join(tempDir, safeName);
                
                await downloadImage(item.imageUrls[i], destPath);
                downloadedPaths.push(destPath);
            } catch (e) {
                console.error(`      ❌ Download failed for img ${i}:`, e.message);
            }
        }
    } else {
        console.log("   ⚠️ No images found in this listing.");
    }

    // 2. LAUNCH BROWSER
    const browser = await puppeteer.launch({ 
        headless: false, defaultViewport: null, userDataDir: "./chrome_profile",
        args: ['--start-maximized', '--disable-notifications'] 
    });
    
    // --- TASK 1: CRAIGSLIST ---
    const runCraigslist = async () => {
        if (!item.platform.includes('Craigslist') && !item.platform.includes('Both')) return;
        console.log('   🟣 [CL] Starting Mission...');
        const page = await browser.newPage();
        try {
            await page.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' });
            
            // Login Check
            if (page.url().includes('login')) {
                console.log("      ⚠️ PLEASE LOG IN MANUALLY (Waiting 60s)...");
                await delay(60000); 
                await page.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' });
            }

            // Location
            try {
              await page.waitForSelector('input[value="fsd"]', { timeout: 2000 });
              await page.click('input[value="fsd"]');
              await page.click('button[name="go"]'); 
            } catch (e) {}
      
            // Category: Force Radio #25
            try {
                await page.waitForSelector('.picker', {timeout: 5000}); 
                const radios = await page.$$('input[type="radio"]');
                const TARGET_INDEX = 24; 
                if (radios.length > TARGET_INDEX) await radios[TARGET_INDEX].click(); 
                else await radios[radios.length - 1].click();

                try { await page.waitForNavigation({ timeout: 2000 }); } 
                catch(e) { try { await page.click('button[name="go"]'); await page.waitForNavigation(); } catch(e){} }
            } catch (e) { try { await page.click('button[name="go"]'); await page.waitForNavigation(); } catch(e){} }

            // Sub-area
            try {
                 const denverLabel = await page.$('label'); 
                 if (denverLabel) {
                     await page.evaluate(() => {
                        const labels = Array.from(document.querySelectorAll('label'));
                        const den = labels.find(el => el.textContent.toLowerCase().includes('city of denver'));
                        if (den) den.click();
                    });
                     await Promise.all([page.waitForNavigation(), page.click('button[name="go"]')]);
                 }
            } catch (e) {}
      
           // Fill Form
          console.log('      📝 [CL] Filling Form...');
          await page.waitForSelector('input[name="PostingTitle"]', { timeout: 10000 });
          
          let finalBody = `${listingTitle}\n\n`;
          finalBody += (item.description && item.description.trim() !== "") ? item.description : "Item available for pickup.";
          finalBody += "\n\nItem Available for Pickup. Please contact for details.";
    
          await page.evaluate((data) => {
              const emailInput = document.querySelector('input[name="FromEMail"]');
              if (emailInput && !emailInput.value) emailInput.value = 'garagescholars@gmail.com';
              document.querySelector('input[name="PostingTitle"]').value = data.title;
              document.querySelector('input[name="price"]').value = data.price.replace(/[^0-9.]/g, '');
              document.querySelector('input[name="postal"]').value = '80202';
              document.querySelector('textarea[name="PostingBody"]').value = data.body;
          }, { title: listingTitle, price: item.price, body: finalBody });
    
          try {
              const showPhoneCheckbox = await page.$('input[name="show_phone_ok"]');
              if (showPhoneCheckbox) {
                  await showPhoneCheckbox.click();
                  await page.type('input[name="contact_phone"]', PAYMENT_INFO.phone);
                  await page.type('input[name="contact_name"]', 'Garage Scholars');
                  const contactTextOk = await page.$('input[name="contact_text_ok"]');
                  if (contactTextOk) await contactTextOk.click();
              }
          } catch (e) {}
    
          await Promise.all([ page.waitForNavigation(), page.click('button[name="go"]') ]);
          
          // Map Enforcer
          let onImagePage = false;
          let attempts = 0;
          while (!onImagePage && attempts < 5) {
              attempts++;
              const fileInputFound = await page.$('input[type="file"]');
              if (fileInputFound) onImagePage = true;
              else {
                  const continueBtn = await page.$('button[name="go"], button.continue');
                  if (continueBtn) try { await Promise.all([ page.waitForNavigation({ timeout: 3000 }), continueBtn.click() ]); } catch(e) {}
                  else await delay(500);
              }
          }

             // Upload Images (BULK)
            if (downloadedPaths.length > 0) {
                  console.log(`      📸 [CL] Uploading images...`);
                  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
                  if (fileInput) {
                        // SPREAD OPERATOR FOR MULTIPLE FILES
                        await fileInput.uploadFile(...downloadedPaths);
                        await delay(5000); 
                        
                        await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const doneBtn = buttons.find(b => b.textContent.toLowerCase().includes('done with images'));
                            if (doneBtn) doneBtn.click();
                        });
                        try { await page.waitForNavigation({ timeout: 5000 }); } catch(e) {}
                  }
            }

            // Push to Payment
          console.log('      🚀 [CL] Going to Payment...');
          const draftContinueBtn = await page.$('button[name="go"], button.continue');
          if (draftContinueBtn) {
              await Promise.all([
                   page.waitForNavigation({ timeout: 20000 }), 
                   draftContinueBtn.click()
              ]);
              await delay(2000); 
              await scrollDown(page, 5); 
          }

          // Payment Fill
          console.log('      💳 [CL] Filling Card...');
          try {
             let paymentFrame = null;
             let nameField = null;
             const frames = page.frames();
             for (const frame of frames) {
                 const el = await frame.$('xpath///label[contains(text(), "Name")]/following::input[1] | //div[contains(text(), "Name")]/following::input[1]');
                 if (el) { paymentFrame = frame; nameField = el; break; }
             }

             if (paymentFrame && nameField) {
                 await nameField.click({ clickCount: 3 });
                 await nameField.type(PAYMENT_INFO.name);
                 const pressTab = async (text) => {
                     await page.keyboard.press('Tab');
                     if (text) await page.keyboard.type(text);
                 };
                 await pressTab(PAYMENT_INFO.cardNumber); 
                 await pressTab(`${PAYMENT_INFO.expMonth}${PAYMENT_INFO.expYear}`);  
                 await pressTab(PAYMENT_INFO.cvc);        
                 await pressTab(PAYMENT_INFO.address);    
                 await pressTab(PAYMENT_INFO.city);       
                 await pressTab(PAYMENT_INFO.state);      
                 await pressTab(PAYMENT_INFO.zip);        
                 console.log('      ✅ [CL] Payment Filled');
             }
          } catch (e) { console.log('      ⚠️ [CL] Payment Error:', e.message); }

        } catch (e) { console.error("CL Failed:", e); }
    };

    // --- TASK 2: FACEBOOK ---
    const runFacebook = async () => {
        if (!item.platform.includes('FB') && !item.platform.includes('Both')) return;
        console.log('   🔵 [FB] Starting Mission...');
        const page = await browser.newPage();
        try {
            await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'networkidle2' });
            
            const loginField = await page.$('input[name="email"]');
            if (loginField) {
                 console.log("      ⚠️ PLEASE LOG IN TO FB MANUALLY (Waiting 60s)...");
                 await delay(60000); 
                 await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'networkidle2' });
            }
            await dismissFacebookPopups(page);

            if (downloadedPaths.length > 0) {
                console.log(`      📸 [FB] Uploading images...`);
                const fbFileInput = await page.waitForSelector('div[aria-label="Add photos"] input, input[type="file"]', { timeout: 10000 });
                if (fbFileInput) {
                    await fbFileInput.uploadFile(...downloadedPaths);
                    await delay(5000); 
                }
                await dismissFacebookPopups(page);
            }

            // Fill Text
        console.log('      📝 [FB] Filling Text...');
        const fillFB = async (labelText, value) => {
             try {
                 const xpath = `xpath///label[.//span[contains(text(), "${labelText}")]]//input | //label[.//span[contains(text(), "${labelText}")]]//textarea`;
                 const elements = await page.$$(xpath);
                 if (elements.length > 0) {
                     await elements[0].click({ clickCount: 3 });
                     await elements[0].type(value);
                 }
             } catch(e) {}
        };

        await fillFB("Title", listingTitle);
        await fillFB("Price", item.price.replace(/[^0-9]/g, ''));
        await fillFB("Description", item.description || listingTitle);

        await scrollDown(page, 20);

        // Category (First Button)
        try {
            const xpath = `xpath///label[.//span[contains(text(), "Category")]]/following::div[@role="button"][1]`;
            const suggestionBtn = await page.$$(xpath);
            if (suggestionBtn.length > 0) {
                await suggestionBtn[0].click();
                await delay(500);
            }
        } catch (e) {}

        // Condition (Used - Good)
        try {
            const condLabels = await page.$$('xpath///label[.//span[contains(text(), "Condition")]]');
            if (condLabels.length > 0) {
                await condLabels[0].click();
                await delay(500);
                await page.keyboard.press("ArrowDown"); await delay(50);
                await page.keyboard.press("ArrowDown"); await delay(50);
                await page.keyboard.press("ArrowDown"); await delay(50);
                await page.keyboard.press("Enter");
            }
        } catch (e) {}

        // Next -> Delivery
        console.log('      🚀 [FB] Moving to Delivery...');
        await scrollDown(page, 10); 
        try {
            const nextBtns = await page.$$('xpath///div[@aria-label="Next"] | //span[contains(text(), "Next")]');
            if (nextBtns.length > 0) await nextBtns[nextBtns.length - 1].click();
        } catch (e) {}
        
        await delay(3000); 

        // Delivery Logic
        console.log('      🚚 [FB] Toggling Meetup...');
        try {
            const meetupClicked = await page.evaluate(() => {
                const spans = Array.from(document.querySelectorAll('span'));
                const target = spans.find(el => el.textContent.includes('Public meetup'));
                if (target) { target.click(); return true; }
                return false;
            });
        } catch(e) {}

        // --- THE FINAL CLICK ---
        console.log('      🏁 [FB] Finalizing...');
        await delay(1000);
        try {
            const finalNextBtns = await page.$$('xpath///div[@aria-label="Next"] | //span[contains(text(), "Next")]');
            if (finalNextBtns.length > 0) {
                await finalNextBtns[finalNextBtns.length - 1].click();
                console.log('      👉 [FB] Clicked Final Next Button');
            }
        } catch (e) {}

        console.log('      ✅ [FB] Ready.');

        } catch (e) { console.error("FB Failed:", e); }
    };

    await Promise.all([ runCraigslist(), runFacebook() ]);
   
    await db.collection('inventory').doc(docId).update({ status: 'Active' });
    console.log("   ✅ Job Complete.");
}

// 👂 LISTENER
db.collection('inventory').where('status', '==', 'Pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
        if (change.type === 'added') processListing(change.doc.id, change.doc.data());
    });
});