const path = require('path');
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const PAYMENT_INFO = {
    name: process.env.PAYMENT_NAME || 'Test Name',
    cardNumber: process.env.PAYMENT_CARD_NUMBER || '0000000000000000',
    expMonth: process.env.PAYMENT_EXP_MONTH || '01',
    expYear: process.env.PAYMENT_EXP_YEAR || '30',
    cvc: process.env.PAYMENT_CVC || '000',
    address: process.env.PAYMENT_ADDRESS || '123 Main St',
    city: process.env.PAYMENT_CITY || 'Denver',
    state: process.env.PAYMENT_STATE || 'CO',
    zip: process.env.PAYMENT_ZIP || '80202',
    phone: process.env.PAYMENT_PHONE || '0000000000'
};

const scrollDown = async (page, times = 5) => {
    await page.evaluate(async (loops) => {
        for (let i = 0; i < loops; i++) {
            window.scrollBy(0, 300);
            await new Promise(r => setTimeout(r, 50));
        }
    }, times);
};

const dismissFacebookPopups = async (page) => {
    try {
        await page.keyboard.press('Escape');
        await delay(300);
        const closeButtons = await page.$$('xpath///div[@aria-label="Close"] | //div[@role="button"]//i');
        if (closeButtons.length > 0) {
            await closeButtons[0].click();
            await delay(300);
        }
    } catch (e) {}
};

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

async function runListingAutomation(docId, item, db, admin) {
    const listingTitle = item.clientName ? `${item.clientName} - ${item.title}` : item.title;
    console.log(`\n🔔 NEW JOB RECEIVED: ${listingTitle}`);
    const listingRef = db.collection('inventory').doc(docId);
    const platformValue = (item.platform || '').toLowerCase();
    const shouldRunCraigslist = platformValue.includes('craigslist') || platformValue.includes('cl') || platformValue.includes('both');
    const shouldRunFacebook = platformValue.includes('facebook') || platformValue.includes('fb') || platformValue.includes('both');
    console.log(`[JOB] platform=${item.platform} shouldRunCL=${shouldRunCraigslist} shouldRunFB=${shouldRunFacebook}`);
    const initialProgress = {};
    if (shouldRunCraigslist) initialProgress.craigslist = 'queued';
    if (shouldRunFacebook) initialProgress.facebook = 'queued';
    const updateListing = (data) => (
        listingRef.update({
            ...data,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
    );

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizePublicText = (text, clientName) => {
        if (!text) return '';
        if (!clientName) return text.trim();
        const name = escapeRegExp(clientName);
        const patterns = [
            new RegExp(`${name}\\s*-\\s*`, 'ig'),
            new RegExp(`${name}\\s*:\\s*`, 'ig'),
            new RegExp(name, 'ig')
        ];
        let result = text;
        patterns.forEach((pattern) => {
            result = result.replace(pattern, '');
        });
        return result
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };
    const containsClientName = (text, clientName) => {
        if (!clientName || !text) return false;
        return new RegExp(escapeRegExp(clientName), 'i').test(text);
    };
    const publicTitle = sanitizePublicText(item.title || '', item.clientName || '');
    const publicDescription = sanitizePublicText(item.description || '', item.clientName || '');
    const fbDescription = publicDescription || publicTitle;
    if (item.clientName && (
        containsClientName(publicTitle, item.clientName) ||
        containsClientName(publicDescription, item.clientName) ||
        containsClientName(fbDescription, item.clientName)
    )) {
        const message = 'Client name detected in public fields after sanitization';
        await updateListing({
            status: 'Error',
            lastError: { platform: 'JOB', message, screenshotPath: '' },
            finishedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: false, lastError: { platform: 'JOB', message, screenshotPath: '' }, screenshots: [] };
    }

    const debugDir = path.join(__dirname, '..', 'debug_screenshots');
    const screenshots = [];
    const captureScreenshot = async (platform, step, page) => {
        const safeStep = (step || 'unknown').replace(/[^a-z0-9_-]/gi, '-');
        const filePath = path.join(debugDir, `${docId}_${platform.toLowerCase()}_${safeStep}.png`);
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        if (page) await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
        screenshots.push(filePath);
        return filePath;
    };
    const logStep = (platform, step, page) => {
        const url = page && page.url ? page.url() : '';
        console.log(`[${platform}] step=${step} url=${url}`);
    };
    const withFocus = async (page, platform, step, fn) => {
        await page.bringToFront();
        logStep(platform, step, page);
        return fn();
    };

    await updateListing({
        status: 'Running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        progress: initialProgress,
        lastError: null
    });

    const downloadedPaths = [];
    if (item.imageUrls && item.imageUrls.length > 0) {
        console.log(`   ⬇️ Downloading ${item.imageUrls.length} images...`);
        const tempDir = path.join(__dirname, '..', 'temp_downloads');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        for (let i = 0; i < item.imageUrls.length; i++) {
            try {
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

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        userDataDir: "./chrome_profile",
        args: [
            '--start-maximized',
            '--disable-notifications',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=CalculateNativeWinOcclusion'
        ]
    });

    const pageCL = shouldRunCraigslist ? await browser.newPage() : null;
    const pageFB = shouldRunFacebook ? await browser.newPage() : null;

    const runCraigslist = async (page) => {
        if (!shouldRunCraigslist) return 'skipped';
        await updateListing({ 'progress.craigslist': 'running' });
        console.log('   🟣 [CL] Starting Mission...');
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(90000);
        let clStep = 'start';
        try {
            clStep = 'goto';
            await withFocus(page, 'CL', clStep, () => page.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' }));

            if (page.url().includes('login')) {
                clStep = 'login';
                console.log("      ⚠️ PLEASE LOG IN MANUALLY (Waiting 60s)...");
                await delay(60000);
                await withFocus(page, 'CL', clStep, () => page.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' }));
            }

            try {
                clStep = 'location';
                await page.waitForSelector('input[value="fsd"]', { timeout: 2000 });
                await withFocus(page, 'CL', 'location_continue', async () => {
                    await page.click('input[value="fsd"]');
                    await page.click('button[name="go"]');
                });
            } catch (e) {}

            try {
                clStep = 'category';
                await page.waitForSelector('.picker', { timeout: 5000 });
                const radios = await page.$$('input[type="radio"]');
                const TARGET_INDEX = 24;
                if (radios.length > TARGET_INDEX) await radios[TARGET_INDEX].click();
                else await radios[radios.length - 1].click();

                try { await page.waitForNavigation({ timeout: 2000 }); }
                catch (e) {
                    try {
                        await withFocus(page, 'CL', 'category_continue', async () => {
                            await page.click('button[name="go"]');
                            await page.waitForNavigation();
                        });
                    } catch (e) {}
                }
            } catch (e) {
                try {
                    await withFocus(page, 'CL', 'category_continue', async () => {
                        await page.click('button[name="go"]');
                        await page.waitForNavigation();
                    });
                } catch (e) {}
            }

            try {
                clStep = 'subarea';
                const denverLabel = await page.$('label');
                if (denverLabel) {
                    await page.evaluate(() => {
                        const labels = Array.from(document.querySelectorAll('label'));
                        const den = labels.find(el => el.textContent.toLowerCase().includes('city of denver'));
                        if (den) den.click();
                    });
                    await withFocus(page, 'CL', 'subarea_continue', async () => {
                        await Promise.all([page.waitForNavigation(), page.click('button[name="go"]')]);
                    });
                }
            } catch (e) {}

            clStep = 'fill_form';
            console.log('      📝 [CL] Filling Form...');
            await page.waitForSelector('input[name="PostingTitle"]', { timeout: 10000 });

            let finalBody = `${publicTitle}\n\n`;
            finalBody += (publicDescription && publicDescription.trim() !== "") ? publicDescription : "Item available for pickup.";
            finalBody += "\n\nItem Available for Pickup. Please contact for details.";

            await page.evaluate((data) => {
                const emailInput = document.querySelector('input[name="FromEMail"]');
                if (emailInput && !emailInput.value) emailInput.value = 'garagescholars@gmail.com';
                document.querySelector('input[name="PostingTitle"]').value = data.title;
                document.querySelector('input[name="price"]').value = data.price.replace(/[^0-9.]/g, '');
                document.querySelector('input[name="postal"]').value = '80202';
                document.querySelector('textarea[name="PostingBody"]').value = data.body;
            }, { title: publicTitle, price: item.price, body: finalBody });

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

            await withFocus(page, 'CL', 'form_continue', async () => {
                await Promise.all([page.waitForNavigation(), page.click('button[name="go"]')]);
            });

            let onImagePage = false;
            let attempts = 0;
            while (!onImagePage && attempts < 5) {
                attempts++;
                const fileInputFound = await page.$('input[type="file"]');
                if (fileInputFound) onImagePage = true;
                else {
                    const continueBtn = await page.$('button[name="go"], button.continue');
                    if (continueBtn) {
                        try {
                            await withFocus(page, 'CL', 'map_continue', async () => {
                                await Promise.all([page.waitForNavigation({ timeout: 3000 }), continueBtn.click()]);
                            });
                        } catch (e) {}
                    } else await delay(500);
                }
            }

            if (downloadedPaths.length > 0) {
                console.log(`      📸 [CL] Uploading images...`);
                const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
                if (fileInput) {
                    await fileInput.uploadFile(...downloadedPaths);
                    await delay(5000);

                    await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const doneBtn = buttons.find(b => b.textContent.toLowerCase().includes('done with images'));
                        if (doneBtn) doneBtn.click();
                    });
                    try { await page.waitForNavigation({ timeout: 5000 }); } catch (e) {}
                }
            }

            console.log('      🚀 [CL] Going to Payment...');
            const draftContinueBtn = await page.$('button[name="go"], button.continue');
            if (draftContinueBtn) {
                await withFocus(page, 'CL', 'payment_continue', async () => {
                    await Promise.all([
                        page.waitForNavigation({ timeout: 20000 }),
                        draftContinueBtn.click()
                    ]);
                });
                await delay(2000);
                await scrollDown(page, 5);
            }

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

            await updateListing({ 'progress.craigslist': 'success' });
            return 'success';
        } catch (e) {
            const screenshotPath = await captureScreenshot('CL', clStep, page);
            await updateListing({
                'progress.craigslist': 'error',
                lastError: {
                    platform: 'CL',
                    message: e.message || String(e),
                    screenshotPath
                }
            });
            console.error(`CL Failed: ${e.message || e} screenshot=${screenshotPath}`);
            return 'error';
        }
    };

    const runFacebook = async (page) => {
        if (!shouldRunFacebook) return 'skipped';
        await updateListing({ 'progress.facebook': 'running' });
        console.log('   🔵 [FB] Starting Mission...');
        try {
            await withFocus(page, 'FB', 'goto', () => page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' }));
            await page.waitForSelector('body', { timeout: 60000 });

            const loginField = await page.$('input[name="email"]');
            if (loginField) {
                console.log("      ⚠️ PLEASE LOG IN TO FB MANUALLY (Waiting 60s)...");
                await delay(60000);
                await withFocus(page, 'FB', 'login', () => page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' }));
            }
            await dismissFacebookPopups(page);
            await page.waitForSelector('xpath///label[.//span[contains(text(), "Title")]]//input | //label[.//span[contains(text(), "Title")]]//textarea', { timeout: 60000 });

            if (downloadedPaths.length > 0) {
                console.log(`      📸 [FB] Uploading images...`);
                const fbFileInput = await page.waitForSelector('div[aria-label="Add photos"] input, input[type="file"]', { timeout: 10000 });
                if (fbFileInput) {
                    await fbFileInput.uploadFile(...downloadedPaths);
                    await page.waitForFunction(() => {
                        const imgs = document.querySelectorAll('img');
                        return imgs.length > 0;
                    }, { timeout: 15000 }).catch(() => {});
                }
                await dismissFacebookPopups(page);
            }

            console.log('      📝 [FB] Filling Text...');
            const fillFB = async (labelText, value) => {
                try {
                    const xpath = `xpath///label[.//span[contains(text(), "${labelText}")]]//input | //label[.//span[contains(text(), "${labelText}")]]//textarea`;
                    const elements = await page.$$(xpath);
                    if (elements.length > 0) {
                        await elements[0].click({ clickCount: 3 });
                        await elements[0].type(value);
                    }
                } catch (e) {}
            };

            await fillFB("Title", publicTitle);
            await fillFB("Price", item.price.replace(/[^0-9]/g, ''));
            await fillFB("Description", fbDescription);

            await scrollDown(page, 20);

            try {
                const xpath = `xpath///label[.//span[contains(text(), "Category")]]/following::div[@role="button"][1]`;
                const suggestionBtn = await page.$$(xpath);
                if (suggestionBtn.length > 0) {
                    await suggestionBtn[0].click();
                    await delay(500);
                }
            } catch (e) {}

            try {
                const condLabels = await page.$$('xpath///label[.//span[contains(text(), "Condition")]]');
                if (condLabels.length > 0) {
                    await condLabels[0].click();
                    await delay(500);
                    await page.keyboard.press("ArrowDown");
                    await delay(50);
                    await page.keyboard.press("ArrowDown");
                    await delay(50);
                    await page.keyboard.press("ArrowDown");
                    await delay(50);
                    await page.keyboard.press("Enter");
                }
            } catch (e) {}

            console.log('      🚀 [FB] Moving to Delivery...');
            await scrollDown(page, 10);
            try {
                const nextBtns = await page.$$('xpath///div[@aria-label="Next"] | //span[contains(text(), "Next")]');
                if (nextBtns.length > 0) {
                    await withFocus(page, 'FB', 'delivery_next', async () => {
                        await nextBtns[nextBtns.length - 1].click();
                    });
                }
            } catch (e) {}

            await page.waitForFunction(() => {
                const spans = Array.from(document.querySelectorAll('span'));
                return spans.some(el => el.textContent.includes('Public meetup'));
            }, { timeout: 15000 }).catch(() => {});

            console.log('      🚚 [FB] Toggling Meetup...');
            try {
                await page.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span'));
                    const target = spans.find(el => el.textContent.includes('Public meetup'));
                    if (target) { target.click(); return true; }
                    return false;
                });
            } catch (e) {}

            console.log('      🏁 [FB] Finalizing...');
            try {
                const finalNextBtns = await page.$$('xpath///div[@aria-label="Next"] | //span[contains(text(), "Next")]');
                if (finalNextBtns.length > 0) {
                    await withFocus(page, 'FB', 'final_next', async () => {
                        await finalNextBtns[finalNextBtns.length - 1].click();
                    });
                    console.log('      👉 [FB] Clicked Final Next Button');
                }
            } catch (e) {}

            console.log('      ✅ [FB] Ready.');

            await updateListing({ 'progress.facebook': 'success' });
            return 'success';
        } catch (e) {
            const screenshotPath = await captureScreenshot('FB', 'error', page);
            await updateListing({
                'progress.facebook': 'error',
                lastError: {
                    platform: 'FB',
                    message: e.message || String(e),
                    screenshotPath
                }
            });
            console.error(`FB Failed: ${e.message || e} screenshot=${screenshotPath}`);
            return 'error';
        }
    };

    let focusTicker = null;
    if (pageCL && pageFB) {
        let focusIndex = 0;
        focusTicker = setInterval(() => {
            const target = focusIndex % 2 === 0 ? pageCL : pageFB;
            focusIndex += 1;
            if (target) target.bringToFront().catch(() => {});
        }, 1500);
    }

    let craigslistResult = 'skipped';
    let facebookResult = 'skipped';
    try {
        [craigslistResult, facebookResult] = await Promise.all([
            runCraigslist(pageCL),
            runFacebook(pageFB)
        ]);
    } finally {
        if (focusTicker) clearInterval(focusTicker);
    }

    const hadError = [craigslistResult, facebookResult].includes('error');
    await updateListing({
        status: hadError ? 'Error' : 'Active',
        finishedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("   ✅ Job Complete.");

    return {
        success: !hadError,
        lastError: hadError ? { message: 'Automation failed', platform: 'JOB', screenshotPath: '' } : null,
        screenshots
    };
}

module.exports = { runListingAutomation };
