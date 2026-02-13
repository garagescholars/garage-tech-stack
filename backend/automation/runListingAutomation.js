const path = require('path');
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(RecaptchaPlugin({
    provider: { id: '2captcha', token: process.env.CAPTCHA_API_KEY || '' },
    visualFeedback: true
}));
const { runEbayListing } = require('../ebay/ebayListing');
const { createJobLogger } = require('../lib/logger');
const { cleanupJobFiles } = require('../lib/cleanup');
const { validateFBListing } = require('../lib/fbCompliance');
const { canPost, recordPost, checkDuplicate, recordPosting } = require('../lib/rateLimiter');
const { getProxy, closeAllProxies } = require('../lib/proxyManager');
const {
    humanDelay, humanType, humanClick, humanScroll,
    randomizeViewport, applyStealthPatches, injectFingerprint, trySelectors,
    retryStep, detectCaptcha, waitForCaptchaSolution
} = require('../lib/humanBehavior');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Configuration ---
const HEADLESS = process.env.HEADLESS !== 'false';
const WORKER_ID = process.env.WORKER_ID || `${require('os').hostname()}-${process.pid}`;

// --- Payment info (required env vars, no defaults) ---
const REQUIRED_PAYMENT_FIELDS = [
    'PAYMENT_NAME', 'PAYMENT_CARD_NUMBER', 'PAYMENT_EXP_MONTH',
    'PAYMENT_EXP_YEAR', 'PAYMENT_CVC', 'PAYMENT_ADDRESS',
    'PAYMENT_CITY', 'PAYMENT_STATE', 'PAYMENT_ZIP', 'PAYMENT_PHONE'
];

function getPaymentInfo() {
    const missing = REQUIRED_PAYMENT_FIELDS.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required payment env vars: ${missing.join(', ')}`);
    }
    return {
        name: process.env.PAYMENT_NAME,
        cardNumber: process.env.PAYMENT_CARD_NUMBER,
        expMonth: process.env.PAYMENT_EXP_MONTH,
        expYear: process.env.PAYMENT_EXP_YEAR,
        cvc: process.env.PAYMENT_CVC,
        address: process.env.PAYMENT_ADDRESS,
        city: process.env.PAYMENT_CITY,
        state: process.env.PAYMENT_STATE,
        zip: process.env.PAYMENT_ZIP,
        phone: process.env.PAYMENT_PHONE
    };
}

// --- Track open browsers for graceful shutdown ---
const openBrowsers = new Set();
function getOpenBrowsers() { return openBrowsers; }

// ============================
// FALLBACK SELECTOR DEFINITIONS
// ============================
// Multiple selectors per element — if FB/CL updates HTML, the next one still works.
// Text-based XPath is the most resilient (user-facing text rarely changes).

const FB_SELECTORS = {
    titleInput: [
        'xpath///label[.//span[contains(text(), "Title")]]//input',
        'label[aria-label="Title"] input',
        'input[placeholder*="title" i]',
        'input[name="title"]'
    ],
    priceInput: [
        'xpath///label[.//span[contains(text(), "Price")]]//input',
        'label[aria-label="Price"] input',
        'input[placeholder*="price" i]'
    ],
    descriptionInput: [
        'xpath///label[.//span[contains(text(), "Description")]]//textarea',
        'xpath///label[.//span[contains(text(), "Description")]]//input',
        'textarea[placeholder*="description" i]',
        'textarea[aria-label*="description" i]'
    ],
    categoryButton: [
        'xpath///label[.//span[contains(text(), "Category")]]/following::div[@role="button"][1]',
        'xpath///span[contains(text(), "Category")]/ancestor::label/following-sibling::div'
    ],
    conditionDropdown: [
        'xpath///label[.//span[contains(text(), "Condition")]]',
        'xpath///span[contains(text(), "Condition")]/ancestor::label'
    ],
    imageUpload: [
        'div[aria-label="Add photos"] input[type="file"]',
        'input[type="file"][accept*="image"]',
        'input[type="file"]'
    ],
    nextButton: [
        'div[aria-label="Next"]',
        'xpath///div[@aria-label="Next"]',
        'xpath///span[contains(text(), "Next")]/ancestor::div[@role="button"]',
        'xpath///span[text()="Next"]/..'
    ],
    publishButton: [
        'div[aria-label="Publish"]',
        'xpath///span[contains(text(), "Publish")]/ancestor::div[@role="button"]',
        'xpath///span[text()="Publish"]/..'
    ],
    loginField: [
        'input[name="email"]',
        'input[id="email"]',
        '#email'
    ]
};

const CL_SELECTORS = {
    postingTitle: ['input[name="PostingTitle"]', '#PostingTitle'],
    price: ['input[name="price"]', '#price'],
    postal: ['input[name="postal"]', '#postal_code'],
    postingBody: ['textarea[name="PostingBody"]', '#PostingBody'],
    email: ['input[name="FromEMail"]', '#FromEMail'],
    fileInput: ['input[type="file"]'],
    goButton: ['button[name="go"]', 'button.continue', 'xpath///button[@name="go"]'],
    doneImagesButton: [
        'xpath///button[contains(text(), "done with images")]',
        'xpath///button[contains(text(), "Done with images")]'
    ],
    paymentNameField: [
        'xpath///label[contains(text(), "Name")]/following::input[1]',
        'xpath///div[contains(text(), "Name")]/following::input[1]',
        'input[name="cardholderName"]'
    ]
};

// ============================
// IMAGE DOWNLOAD
// ============================

const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlink(filepath, () => {});
                downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(filepath); });
        }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
    });
};

// ============================
// TEXT SANITIZATION
// ============================

const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizePublicText = (text, clientName) => {
    if (!text) return '';
    if (!clientName) return text.trim();
    const name = escapeRegExp(clientName);
    let result = text;
    [new RegExp(`${name}\\s*-\\s*`, 'ig'), new RegExp(`${name}\\s*:\\s*`, 'ig'), new RegExp(name, 'ig')]
        .forEach(p => { result = result.replace(p, ''); });
    return result.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

const containsClientName = (text, clientName) => {
    if (!clientName || !text) return false;
    return new RegExp(escapeRegExp(clientName), 'i').test(text);
};

// ============================
// MAIN AUTOMATION FUNCTION
// ============================

async function runListingAutomation(docId, item, db, admin) {
    const log = createJobLogger({ inventoryId: docId });
    const listingTitle = item.clientName ? `${item.clientName} - ${item.title}` : item.title;
    log.info('New job received', { title: listingTitle });

    const listingRef = db.collection('inventory').doc(docId);
    const platformValue = (item.platform || '').toLowerCase();
    const shouldRunCraigslist = platformValue.includes('craigslist') || platformValue.includes('cl') || platformValue.includes('both') || platformValue.includes('all');
    const shouldRunFacebook = platformValue.includes('facebook') || platformValue.includes('fb') || platformValue.includes('both') || platformValue.includes('all');
    const shouldRunEbay = platformValue.includes('ebay') || platformValue.includes('both') || platformValue.includes('all');
    log.info('Platform targets', { platform: item.platform, craigslist: shouldRunCraigslist, facebook: shouldRunFacebook, ebay: shouldRunEbay });

    // --- Payment validation (CL only) ---
    let paymentInfo = null;
    if (shouldRunCraigslist) {
        try { paymentInfo = getPaymentInfo(); }
        catch (err) {
            log.error('Payment config validation failed', { error: err.message });
            await listingRef.update({ status: 'Error', lastError: { platform: 'JOB', message: err.message, screenshotPath: '' }, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
            return { success: false, lastError: { platform: 'JOB', message: err.message, screenshotPath: '' }, screenshots: [] };
        }
    }

    // --- Text sanitization ---
    const publicTitle = sanitizePublicText(item.title || '', item.clientName || '');
    const publicDescription = sanitizePublicText(item.description || '', item.clientName || '');
    const fbDescription = publicDescription || publicTitle;

    if (item.clientName && (containsClientName(publicTitle, item.clientName) || containsClientName(publicDescription, item.clientName))) {
        const message = 'Client name detected in public fields after sanitization';
        log.error(message);
        await listingRef.update({ status: 'Error', lastError: { platform: 'JOB', message, screenshotPath: '' }, finishedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
        return { success: false, lastError: { platform: 'JOB', message, screenshotPath: '' }, screenshots: [] };
    }

    // --- FB Compliance Check (BEFORE launching browser) ---
    if (shouldRunFacebook) {
        const compliance = validateFBListing(item, publicTitle, publicDescription);
        if (!compliance.valid) {
            const message = `FB compliance failed: ${compliance.errors.join('; ')}`;
            log.error(message);
            await listingRef.update({ status: 'Compliance Error', lastError: { platform: 'FB', message, screenshotPath: '' }, finishedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
            return { success: false, complianceFailed: true, errors: compliance.errors, lastError: { platform: 'FB', message, screenshotPath: '' }, screenshots: [] };
        }
        if (compliance.warnings.length > 0) log.warn('FB compliance warnings', { warnings: compliance.warnings });
    }

    // --- Rate Limit Checks ---
    if (shouldRunFacebook) {
        const fbRate = await canPost(db, 'facebook', WORKER_ID);
        if (!fbRate.allowed) {
            log.warn('Facebook rate limited', { reason: fbRate.reason, waitMs: fbRate.waitMs });
            if (fbRate.waitMs > 0 && fbRate.waitMs <= 20 * 60 * 1000) {
                log.info('Waiting for FB rate limit window', { waitMs: fbRate.waitMs });
                await delay(fbRate.waitMs);
            } else {
                await listingRef.update({ status: 'Error', lastError: { platform: 'FB', message: `Rate limited: ${fbRate.reason}`, screenshotPath: '' }, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
                return { success: false, lastError: { platform: 'FB', message: fbRate.reason, screenshotPath: '' }, screenshots: [] };
            }
        }
    }
    if (shouldRunCraigslist) {
        const clRate = await canPost(db, 'craigslist', WORKER_ID);
        if (!clRate.allowed) {
            log.warn('CL rate limited', { reason: clRate.reason, waitMs: clRate.waitMs });
            if (clRate.waitMs > 0 && clRate.waitMs <= 35 * 60 * 1000) {
                log.info('Waiting for CL rate limit window', { waitMs: clRate.waitMs });
                await delay(clRate.waitMs);
            } else {
                await listingRef.update({ status: 'Error', lastError: { platform: 'CL', message: `Rate limited: ${clRate.reason}`, screenshotPath: '' }, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
                return { success: false, lastError: { platform: 'CL', message: clRate.reason, screenshotPath: '' }, screenshots: [] };
            }
        }
    }

    // --- Duplicate Detection ---
    if (shouldRunFacebook) {
        const fbDup = await checkDuplicate(db, publicTitle, 'facebook');
        if (fbDup.isDuplicate) log.warn('Duplicate FB listing detected — proceeding with caution', { title: publicTitle });
    }

    // --- Progress tracking ---
    const initialProgress = {};
    if (shouldRunCraigslist) initialProgress.craigslist = 'queued';
    if (shouldRunFacebook) initialProgress.facebook = 'queued';
    if (shouldRunEbay) initialProgress.ebay = 'queued';

    const cleanData = (data) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    const updateListing = (data) => listingRef.update(cleanData({ ...data, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }));

    const debugDir = path.join(__dirname, '..', 'debug_screenshots');
    const screenshots = [];
    const captureScreenshot = async (step, page) => {
        const safeStep = (step || 'unknown').replace(/[^a-z0-9_-]/gi, '-');
        const filePath = path.join(debugDir, `${docId}_${safeStep}.png`);
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        if (page) await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
        screenshots.push(filePath);
        return filePath;
    };

    await updateListing({
        status: 'Running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        progress: initialProgress,
        lastError: null,
        ...(shouldRunEbay ? { 'ebay.status': 'queued', 'ebay.enabled': true } : {})
    });

    // --- Download images (for CL + FB Puppeteer) ---
    const downloadedPaths = [];
    if (shouldRunCraigslist || shouldRunFacebook) {
        if (item.imageUrls && item.imageUrls.length > 0) {
            log.info('Downloading images', { count: item.imageUrls.length });
            const tempDir = path.join(__dirname, '..', 'temp_downloads');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
            for (let i = 0; i < item.imageUrls.length; i++) {
                try {
                    const destPath = path.join(tempDir, `img_${docId}_${i}.jpg`);
                    await downloadImage(item.imageUrls[i], destPath);
                    downloadedPaths.push(destPath);
                } catch (e) { log.warn('Image download failed', { index: i, error: e.message }); }
            }
        } else { log.info('No images found in listing'); }
    }

    // --- Launch browser ---
    let browser = null;
    let pageCL = null;
    let pageFB = null;
    let proxyCleanup = () => {};

    try {
        if (shouldRunCraigslist || shouldRunFacebook) {
            const launchArgs = [
                '--disable-notifications',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=CalculateNativeWinOcclusion',
                // Anti-detection
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1920,1080'
            ];
            if (HEADLESS) { launchArgs.push('--no-sandbox', '--disable-setuid-sandbox'); }
            else { launchArgs.push('--start-maximized'); }

            // Proxy: residential IP rotation (if configured)
            const proxy = await getProxy({ sessionId: docId });
            if (proxy.proxyUrl) {
                launchArgs.push(`--proxy-server=${proxy.proxyUrl}`);
                log.info('Browser launching with proxy');
            }
            proxyCleanup = proxy.cleanup;

            browser = await puppeteer.launch({
                headless: HEADLESS,
                defaultViewport: null,
                userDataDir: "./chrome_profile",
                args: launchArgs
            });
            openBrowsers.add(browser);

            if (shouldRunCraigslist) {
                pageCL = await browser.newPage();
                await applyStealthPatches(pageCL);
                await injectFingerprint(pageCL);
                await randomizeViewport(pageCL);
                pageCL.setDefaultTimeout(60000);
                pageCL.setDefaultNavigationTimeout(90000);
            }
            if (shouldRunFacebook) {
                pageFB = await browser.newPage();
                await applyStealthPatches(pageFB);
                await injectFingerprint(pageFB);
                await randomizeViewport(pageFB);
                pageFB.setDefaultTimeout(60000);
                pageFB.setDefaultNavigationTimeout(90000);
            }
        }

        // ============================
        // CRAIGSLIST — Robust Puppeteer
        // ============================
        const runCraigslist = async (page) => {
            if (!shouldRunCraigslist) return 'skipped';
            await updateListing({ 'progress.craigslist': 'running' });
            log.info('Starting Craigslist automation', { platform: 'CL' });

            try {
                // Step 1: Navigate
                await retryStep(async () => {
                    await page.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' });
                    const captcha = await detectCaptcha(page);
                    if (captcha.detected) {
                        log.warn('CAPTCHA on CL', { type: captcha.type });
                        // Try auto-solve first (requires CAPTCHA_API_KEY)
                        if (process.env.CAPTCHA_API_KEY) {
                            try {
                                const { solved } = await page.solveRecaptchas();
                                if (solved.length > 0) { log.info('CL CAPTCHA auto-solved'); }
                                else { const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('CL CAPTCHA not solved'); }
                            } catch (solveErr) { log.warn('Auto-solve failed, waiting for manual', { error: solveErr.message }); const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('CL CAPTCHA not solved within timeout'); }
                        } else {
                            const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log);
                            if (!manual) throw new Error('CL CAPTCHA not solved within timeout');
                        }
                    }
                    if (page.url().includes('login')) {
                        log.warn('CL login required, waiting 60s', { platform: 'CL' });
                        await delay(60000);
                        await page.goto('https://post.craigslist.org/c/den', { waitUntil: 'domcontentloaded' });
                    }
                }, { maxRetries: 2, stepName: 'cl_navigate', page, captureScreenshot, log });

                // Step 2: Location
                try {
                    await page.waitForSelector('input[value="fsd"]', { timeout: 3000 });
                    await humanDelay(300, 700);
                    await page.click('input[value="fsd"]');
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                    if (goBtn) await humanClick(page, goBtn);
                } catch (_) {}

                // Step 3: Category
                await retryStep(async () => {
                    try {
                        await page.waitForSelector('.picker', { timeout: 5000 });
                        const radios = await page.$$('input[type="radio"]');
                        const TARGET_INDEX = 24;
                        if (radios.length > TARGET_INDEX) await radios[TARGET_INDEX].click();
                        else if (radios.length > 0) await radios[radios.length - 1].click();
                        await humanDelay(500, 1000);
                        try { await page.waitForNavigation({ timeout: 3000 }); }
                        catch (_) {
                            const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                            if (goBtn) { await humanClick(page, goBtn); await page.waitForNavigation({ timeout: 5000 }).catch(() => {}); }
                        }
                    } catch (_) {
                        const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                        if (goBtn) { await humanClick(page, goBtn); await page.waitForNavigation({ timeout: 5000 }).catch(() => {}); }
                    }
                }, { maxRetries: 1, stepName: 'cl_category', page, captureScreenshot, log });

                // Step 4: Subarea
                try {
                    await page.evaluate(() => {
                        const labels = Array.from(document.querySelectorAll('label'));
                        const den = labels.find(el => el.textContent.toLowerCase().includes('city of denver'));
                        if (den) den.click();
                    });
                    await humanDelay(300, 600);
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                    if (goBtn) { await Promise.all([page.waitForNavigation({ timeout: 5000 }).catch(() => {}), humanClick(page, goBtn)]); }
                } catch (_) {}

                // Step 5: Fill form
                await retryStep(async () => {
                    log.info('Filling CL form', { platform: 'CL' });
                    const titleField = await trySelectors(page, CL_SELECTORS.postingTitle, 10000);
                    if (!titleField) throw new Error('Could not find CL title field');

                    let finalBody = `${publicTitle}\n\n`;
                    finalBody += (publicDescription && publicDescription.trim() !== "") ? publicDescription : "Item available for pickup.";
                    finalBody += "\n\nItem Available for Pickup. Please contact for details.";

                    // Email
                    const emailField = await trySelectors(page, CL_SELECTORS.email, 2000);
                    if (emailField) {
                        const emailValue = await page.evaluate(el => el.value, emailField);
                        if (!emailValue) await humanType(page, emailField, 'garagescholars@gmail.com', { typoChance: 0 });
                    }

                    await humanType(page, titleField, publicTitle, { typoChance: 0 });
                    await humanDelay(300, 700);

                    const priceField = await trySelectors(page, CL_SELECTORS.price, 3000);
                    if (priceField) { await humanType(page, priceField, item.price.replace(/[^0-9.]/g, ''), { typoChance: 0 }); await humanDelay(200, 500); }

                    const postalField = await trySelectors(page, CL_SELECTORS.postal, 3000);
                    if (postalField) { await humanType(page, postalField, '80202', { typoChance: 0 }); await humanDelay(200, 500); }

                    const bodyField = await trySelectors(page, CL_SELECTORS.postingBody, 3000);
                    if (bodyField) await humanType(page, bodyField, finalBody, { typoChance: 0 });

                    // Uncheck contact options
                    for (const sel of ['input[name="show_phone_ok"]', 'input[name="contact_text_ok"]', 'input[name="phone_calls_ok"]']) {
                        const el = await page.$(sel);
                        if (el) { const checked = await page.evaluate(e => e.checked, el).catch(() => false); if (checked) await el.click().catch(() => {}); }
                    }
                    const phoneInput = await page.$('input[name="contact_phone"]');
                    if (phoneInput) { await phoneInput.click({ clickCount: 3 }).catch(() => {}); await page.keyboard.press('Backspace').catch(() => {}); }

                    await humanDelay(500, 1000);
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 3000);
                    if (goBtn) {
                        await humanClick(page, goBtn);
                        const navOk = await page.waitForNavigation({ timeout: 12000 }).then(() => true).catch(() => false);
                        if (!navOk) {
                            const errText = await page.evaluate(() => {
                                const errs = Array.from(document.querySelectorAll('.error, .warn, .postingerror')).map(n => n.textContent.trim()).filter(Boolean);
                                return errs.join(' | ').slice(0, 400) || 'CL form did not advance';
                            }).catch(() => 'CL form did not advance');
                            throw new Error(`[CL] ${errText}`);
                        }
                    }
                }, { maxRetries: 2, stepName: 'cl_fill_form', page, captureScreenshot, log });

                // Step 6: Images
                if (downloadedPaths.length > 0) {
                    await retryStep(async () => {
                        let onImagePage = false;
                        for (let a = 0; a < 5 && !onImagePage; a++) {
                            if (await trySelectors(page, CL_SELECTORS.fileInput, 2000)) { onImagePage = true; break; }
                            const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 1000);
                            if (goBtn) { await humanClick(page, goBtn); await page.waitForNavigation({ timeout: 3000 }).catch(() => {}); }
                            else await humanDelay(500, 1000);
                        }
                        log.info('Uploading images to CL', { count: downloadedPaths.length });
                        const fileInput = await trySelectors(page, CL_SELECTORS.fileInput, 10000);
                        if (fileInput) {
                            await fileInput.uploadFile(...downloadedPaths);
                            await humanDelay(4000, 7000);
                            const doneBtn = await trySelectors(page, CL_SELECTORS.doneImagesButton, 5000);
                            if (doneBtn) { await humanClick(page, doneBtn); await page.waitForNavigation({ timeout: 5000 }).catch(() => {}); }
                        }
                    }, { maxRetries: 2, stepName: 'cl_images', page, captureScreenshot, log });
                }

                // Step 7: Payment
                await retryStep(async () => {
                    log.info('Navigating to payment', { platform: 'CL' });
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 3000);
                    if (goBtn) {
                        await humanClick(page, goBtn);
                        await page.waitForNavigation({ timeout: 20000 }).catch(() => {});
                        await humanDelay(1500, 3000);
                        await humanScroll(page, 5);
                    }

                    log.info('Filling payment info', { platform: 'CL' });
                    let paymentFrame = null;
                    let nameField = null;
                    for (const frame of page.frames()) {
                        nameField = await trySelectors(frame, CL_SELECTORS.paymentNameField, 1500);
                        if (nameField) { paymentFrame = frame; break; }
                    }
                    if (paymentFrame && nameField) {
                        await nameField.click({ clickCount: 3 });
                        await humanDelay(100, 300);
                        await nameField.type(paymentInfo.name);
                        const pressTab = async (text) => { await page.keyboard.press('Tab'); await humanDelay(100, 300); if (text) await page.keyboard.type(text); await humanDelay(100, 300); };
                        await pressTab(paymentInfo.cardNumber);
                        await pressTab(`${paymentInfo.expMonth}${paymentInfo.expYear}`);
                        await pressTab(paymentInfo.cvc);
                        await pressTab(paymentInfo.address);
                        await pressTab(paymentInfo.city);
                        await pressTab(paymentInfo.state);
                        await pressTab(paymentInfo.zip);
                        log.info('Payment info filled', { platform: 'CL' });
                    }
                }, { maxRetries: 2, stepName: 'cl_payment', page, captureScreenshot, log });

                await recordPost(db, 'craigslist', WORKER_ID);
                await recordPosting(db, publicTitle, 'craigslist', docId);
                await updateListing({ 'progress.craigslist': 'success' });
                log.info('CL automation complete');
                return 'success';
            } catch (e) {
                const screenshotPath = await captureScreenshot('CL_error', page);
                await updateListing({ 'progress.craigslist': 'error', lastError: { platform: 'CL', message: e.message || String(e), screenshotPath } });
                log.error('CL automation failed', { error: e.message, screenshotPath });
                return 'error';
            }
        };

        // ============================
        // FACEBOOK MARKETPLACE — Robust Puppeteer
        // ============================
        const runFacebook = async (page) => {
            if (!shouldRunFacebook) return 'skipped';
            await updateListing({ 'progress.facebook': 'running' });
            log.info('Starting FB Marketplace automation', { platform: 'FB' });

            try {
                // Step 1: Navigate
                await retryStep(async () => {
                    await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' });
                    await humanDelay(2000, 4000);

                    const captcha = await detectCaptcha(page);
                    if (captcha.detected) {
                        log.warn('FB checkpoint detected', { type: captcha.type });
                        if (process.env.CAPTCHA_API_KEY) {
                            try {
                                const { solved } = await page.solveRecaptchas();
                                if (solved.length > 0) { log.info('FB CAPTCHA auto-solved'); }
                                else { const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('FB checkpoint not resolved'); }
                            } catch (solveErr) { log.warn('Auto-solve failed, waiting for manual', { error: solveErr.message }); const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('FB checkpoint not resolved within timeout'); }
                        } else {
                            const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log);
                            if (!manual) throw new Error('FB checkpoint not resolved within timeout');
                        }
                    }

                    const loginField = await trySelectors(page, FB_SELECTORS.loginField, 3000);
                    if (loginField) {
                        log.warn('FB login required, waiting 60s', { platform: 'FB' });
                        await delay(60000);
                        await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' });
                        await humanDelay(2000, 4000);
                    }

                    await page.keyboard.press('Escape').catch(() => {});
                    await humanDelay(300, 600);
                }, { maxRetries: 2, stepName: 'fb_navigate', page, captureScreenshot, log });

                // Step 2: Wait for form
                await retryStep(async () => {
                    const titleField = await trySelectors(page, FB_SELECTORS.titleInput, 30000);
                    if (!titleField) throw new Error('FB form did not load — title field not found');
                }, { maxRetries: 2, stepName: 'fb_wait_form', page, captureScreenshot, log });

                // Step 3: Upload images
                if (downloadedPaths.length > 0) {
                    await retryStep(async () => {
                        log.info('Uploading images to FB', { count: downloadedPaths.length });
                        const fileInput = await trySelectors(page, FB_SELECTORS.imageUpload, 10000);
                        if (fileInput) {
                            await fileInput.uploadFile(...downloadedPaths);
                            await page.waitForFunction(() => document.querySelectorAll('img').length > 0, { timeout: 15000 }).catch(() => {});
                            await humanDelay(1000, 2000);
                        }
                        await page.keyboard.press('Escape').catch(() => {});
                        await humanDelay(300, 600);
                    }, { maxRetries: 2, stepName: 'fb_images', page, captureScreenshot, log });
                }

                // Step 4: Fill form
                await retryStep(async () => {
                    log.info('Filling FB form', { platform: 'FB' });

                    const titleField = await trySelectors(page, FB_SELECTORS.titleInput, 5000);
                    if (titleField) { await humanType(page, titleField, publicTitle); await humanDelay(500, 1000); }

                    const priceField = await trySelectors(page, FB_SELECTORS.priceInput, 5000);
                    if (priceField) { await humanType(page, priceField, item.price.replace(/[^0-9]/g, ''), { typoChance: 0 }); await humanDelay(500, 1000); }

                    const descField = await trySelectors(page, FB_SELECTORS.descriptionInput, 5000);
                    if (descField) { await humanType(page, descField, fbDescription); await humanDelay(500, 1000); }

                    await humanScroll(page, 10);
                }, { maxRetries: 2, stepName: 'fb_fill_form', page, captureScreenshot, log });

                // Step 5: Category
                try {
                    const catBtn = await trySelectors(page, FB_SELECTORS.categoryButton, 3000);
                    if (catBtn) { await humanClick(page, catBtn); await humanDelay(500, 1000); }
                } catch (_) {}

                // Step 6: Condition (Used = 3rd option)
                try {
                    const condDrop = await trySelectors(page, FB_SELECTORS.conditionDropdown, 3000);
                    if (condDrop) {
                        await humanClick(page, condDrop);
                        await humanDelay(300, 600);
                        for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowDown"); await humanDelay(50, 150); }
                        await page.keyboard.press("Enter");
                        await humanDelay(300, 600);
                    }
                } catch (_) {}

                // Step 7: Next → Delivery
                await retryStep(async () => {
                    log.info('Moving to delivery options', { platform: 'FB' });
                    await humanScroll(page, 5);
                    const nextBtn = await trySelectors(page, FB_SELECTORS.nextButton, 5000);
                    if (nextBtn) { await humanClick(page, nextBtn); await humanDelay(1500, 3000); }
                }, { maxRetries: 2, stepName: 'fb_next', page, captureScreenshot, log });

                // Step 8: Public meetup
                try {
                    await page.waitForFunction(() => {
                        return Array.from(document.querySelectorAll('span')).some(el => el.textContent.includes('Public meetup'));
                    }, { timeout: 10000 });
                    await humanDelay(500, 1000);
                    await page.evaluate(() => {
                        const t = Array.from(document.querySelectorAll('span')).find(el => el.textContent.includes('Public meetup'));
                        if (t) t.click();
                    });
                    await humanDelay(500, 1000);
                } catch (_) { log.warn('Could not find Public meetup toggle', { platform: 'FB' }); }

                // Step 9: Finalize / Publish
                await retryStep(async () => {
                    log.info('Finalizing FB listing', { platform: 'FB' });
                    const nextBtn = await trySelectors(page, FB_SELECTORS.nextButton, 5000);
                    if (nextBtn) { await humanClick(page, nextBtn); await humanDelay(1500, 3000); }

                    const publishBtn = await trySelectors(page, FB_SELECTORS.publishButton, 5000);
                    if (publishBtn) { await humanClick(page, publishBtn); await humanDelay(2000, 4000); log.info('Clicked Publish', { platform: 'FB' }); }
                }, { maxRetries: 2, stepName: 'fb_finalize', page, captureScreenshot, log });

                await recordPost(db, 'facebook', WORKER_ID);
                await recordPosting(db, publicTitle, 'facebook', docId);
                await updateListing({ 'progress.facebook': 'success' });
                log.info('FB automation complete');
                return 'success';
            } catch (e) {
                const screenshotPath = await captureScreenshot('FB_error', page);
                await updateListing({ 'progress.facebook': 'error', lastError: { platform: 'FB', message: e.message || String(e), screenshotPath } });
                log.error('FB automation failed', { error: e.message, screenshotPath });
                return 'error';
            }
        };

        // ============================
        // EBAY — API (unchanged)
        // ============================
        const runEbay = async () => {
            if (!shouldRunEbay) return { status: 'skipped' };
            await updateListing({ 'progress.ebay': 'running', 'ebay.enabled': true, 'ebay.status': 'running', 'ebay.error': null, 'ebay.lastRunAt': admin.firestore.FieldValue.serverTimestamp() });
            try {
                const ebayResult = await runEbayListing({ inventoryId: docId, item, publicTitle, publicDescription, db, admin });
                if (!ebayResult.ok) {
                    await updateListing({ 'progress.ebay': 'error', 'ebay.status': 'failed', 'ebay.error': { message: ebayResult.message || 'eBay listing failed', code: ebayResult.code || null, raw: ebayResult.rawError || null }, lastError: { platform: 'EBAY', message: ebayResult.message || 'eBay listing failed', screenshotPath: '' } });
                    return { status: 'error', error: ebayResult };
                }
                const ebayStatus = ebayResult.status === 'published' ? 'published' : 'ready_to_publish';
                const ebayUpdate = { 'progress.ebay': 'success', 'ebay.enabled': true, 'ebay.marketplaceId': ebayResult.marketplaceId || null, 'ebay.sku': ebayResult.sku || null, 'ebay.offerId': ebayResult.offerId || null, 'ebay.listingId': ebayResult.listingId || null, 'ebay.inventoryItemId': ebayResult.inventoryItemId || null, 'ebay.status': ebayStatus, 'ebay.error': null, 'ebay.merchantLocationKey': ebayResult.merchantLocationKey || null, 'ebay.paymentPolicyId': ebayResult.paymentPolicyId || null, 'ebay.fulfillmentPolicyId': ebayResult.fulfillmentPolicyId || null, 'ebay.returnPolicyId': ebayResult.returnPolicyId || null, 'ebay.lastRunAt': admin.firestore.FieldValue.serverTimestamp() };
                if (ebayStatus === 'published') ebayUpdate['ebay.publishedAt'] = admin.firestore.FieldValue.serverTimestamp();
                await updateListing(ebayUpdate);
                return { status: 'success', result: ebayResult };
            } catch (error) {
                const message = error.message || String(error);
                await updateListing({ 'progress.ebay': 'error', 'ebay.status': 'failed', 'ebay.error': { message, code: null, raw: null }, lastError: { platform: 'EBAY', message, screenshotPath: '' } });
                return { status: 'error', error: { message } };
            }
        };

        // ============================
        // RUN ALL PLATFORMS IN PARALLEL
        // ============================
        let focusTicker = null;
        if (pageCL && pageFB) {
            let focusIndex = 0;
            focusTicker = setInterval(() => {
                const target = focusIndex % 2 === 0 ? pageCL : pageFB;
                focusIndex++;
                if (target) target.bringToFront().catch(() => {});
            }, 1500);
        }

        let craigslistResult = 'skipped';
        let facebookResult = 'skipped';
        let ebayResult = { status: 'skipped' };
        try {
            [craigslistResult, facebookResult, ebayResult] = await Promise.all([
                runCraigslist(pageCL),
                runFacebook(pageFB),
                runEbay()
            ]);
        } finally { if (focusTicker) clearInterval(focusTicker); }

        const hadError = [craigslistResult, facebookResult].includes('error') || ebayResult.status === 'error';
        await updateListing({ status: hadError ? 'Error' : 'Active', finishedAt: admin.firestore.FieldValue.serverTimestamp() });
        log.info('Job complete', { success: !hadError, craigslist: craigslistResult, facebook: facebookResult, ebay: ebayResult.status });

        return {
            success: !hadError,
            lastError: hadError ? { message: 'Automation failed', platform: 'JOB', screenshotPath: '' } : null,
            screenshots,
            results: {
                craigslist: craigslistResult,
                facebook: facebookResult,
                ebay: ebayResult.status === 'success' ? { ok: true, offerId: ebayResult.result.offerId || null, listingId: ebayResult.result.listingId || null } :
                       ebayResult.status === 'error' ? { ok: false, error: ebayResult.error || null } : { ok: true, skipped: true }
            }
        };
    } finally {
        if (browser) { try { await browser.close(); } catch (e) { log.warn('Failed to close browser', { error: e.message }); } openBrowsers.delete(browser); }
        await proxyCleanup();
        cleanupJobFiles(docId);
    }
}

module.exports = { runListingAutomation, getOpenBrowsers, closeAllProxies };
