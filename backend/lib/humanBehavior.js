/**
 * Human Behavior Simulation for Puppeteer
 *
 * Replaces robotic fixed-delay interactions with realistic human-like
 * patterns to avoid bot detection on Facebook and Craigslist.
 *
 * Uses ghost-cursor for Bezier-curve mouse movement (Fitts's Law)
 * and fingerprint-generator/injector for unique browser fingerprints.
 */

const { createCursor } = require('ghost-cursor');
const { FingerprintGenerator } = require('fingerprint-generator');
const { FingerprintInjector } = require('fingerprint-injector');

// Shared fingerprint generator — generates statistically realistic fingerprints
const fingerprintGenerator = new FingerprintGenerator();

// --- Gaussian-ish random (Box-Muller) ---
function gaussianRandom(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + stdDev * normal);
}

/**
 * Random delay with gaussian distribution (feels more human than uniform)
 * @param {number} minMs - Minimum delay
 * @param {number} maxMs - Maximum delay
 */
async function humanDelay(minMs, maxMs) {
    const mean = (minMs + maxMs) / 2;
    const stdDev = (maxMs - minMs) / 4;
    const ms = Math.max(minMs, Math.min(maxMs, gaussianRandom(mean, stdDev)));
    return new Promise(resolve => setTimeout(resolve, Math.round(ms)));
}

/**
 * Type text with variable speed, occasional pauses, and rare typos
 * @param {import('puppeteer').Page} page
 * @param {import('puppeteer').ElementHandle} element - Element to type into
 * @param {string} text - Text to type
 * @param {Object} options
 * @param {boolean} options.clearFirst - Clear existing text before typing (default true)
 * @param {number} options.typoChance - Probability of a typo per char (default 0.02)
 */
async function humanType(page, element, text, { clearFirst = true, typoChance = 0.02 } = {}) {
    if (clearFirst) {
        await element.click({ clickCount: 3 });
        await humanDelay(50, 150);
        await page.keyboard.press('Backspace');
        await humanDelay(100, 300);
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Occasional typo: type wrong char then backspace
        if (Math.random() < typoChance && char.match(/[a-zA-Z]/)) {
            const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
            await page.keyboard.type(wrongChar, { delay: gaussianRandom(60, 30) });
            await humanDelay(200, 500);
            await page.keyboard.press('Backspace');
            await humanDelay(100, 250);
        }

        // Type the correct character
        const delay = gaussianRandom(100, 40); // 60-140ms per char
        await page.keyboard.type(char, { delay: Math.max(30, delay) });

        // Occasional pause (like thinking) every 5-15 chars
        if (Math.random() < 0.05) {
            await humanDelay(300, 800);
        }
    }
}

/**
 * Click an element with realistic Bezier-curve mouse movement (ghost-cursor).
 * Falls back to simple off-center click if cursor isn't attached.
 * @param {import('puppeteer').Page} page
 * @param {import('puppeteer').ElementHandle} element
 */
async function humanClick(page, element) {
    // Scroll element into view before interacting
    try {
        await page.evaluate(el => {
            if (el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded();
            else el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, element);
        await humanDelay(150, 400);
    } catch (_) {}

    const box = await element.boundingBox();
    if (!box) {
        await element.click();
        return;
    }

    try {
        // Use ghost-cursor for realistic Bezier-curve path
        if (!page._ghostCursor) {
            page._ghostCursor = createCursor(page, await getRandomStartPoint(page));
        }
        await page._ghostCursor.click(element, {
            hesitate: gaussianRandom(50, 30),
            waitForClick: gaussianRandom(100, 50)
        });
        await humanDelay(100, 400);
    } catch (_) {
        // Fallback: manual off-center click
        const offsetX = (Math.random() - 0.5) * box.width * 0.4;
        const offsetY = (Math.random() - 0.5) * box.height * 0.4;
        const x = box.x + box.width / 2 + offsetX;
        const y = box.y + box.height / 2 + offsetY;

        await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
        await humanDelay(50, 200);
        await page.mouse.click(x, y);
        await humanDelay(100, 400);
    }
}

/**
 * Get a random starting point for the ghost cursor (simulates where
 * a human's mouse might be when the page first loads).
 */
async function getRandomStartPoint(page) {
    const viewport = page.viewport();
    if (!viewport) return { x: 400, y: 300 };
    return {
        x: Math.floor(Math.random() * viewport.width * 0.6 + viewport.width * 0.2),
        y: Math.floor(Math.random() * viewport.height * 0.6 + viewport.height * 0.2)
    };
}

/**
 * Scroll page in human-like increments
 * @param {import('puppeteer').Page} page
 * @param {number} scrolls - Number of scroll steps
 */
async function humanScroll(page, scrolls = 5) {
    for (let i = 0; i < scrolls; i++) {
        const distance = Math.floor(gaussianRandom(250, 80)); // 170-330px per scroll
        await page.evaluate((d) => window.scrollBy(0, d), distance);
        await humanDelay(200, 600);
    }
}

/**
 * Set viewport to a common resolution with slight random variation
 * @param {import('puppeteer').Page} page
 */
async function randomizeViewport(page) {
    const resolutions = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1680, height: 1050 }
    ];
    const base = resolutions[Math.floor(Math.random() * resolutions.length)];
    const width = base.width + Math.floor((Math.random() - 0.5) * 40);
    const height = base.height + Math.floor((Math.random() - 0.5) * 40);
    await page.setViewport({ width, height });
}

/**
 * Apply stealth patches to a page to hide Puppeteer fingerprints
 * Call this right after creating a new page, before navigating.
 * @param {import('puppeteer').Page} page
 */
async function applyStealthPatches(page) {
    await page.evaluateOnNewDocument(() => {
        // Hide webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Realistic languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

        // Fake plugins array (empty = bot signal)
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const arr = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' }
                ];
                arr.length = 3;
                return arr;
            }
        });

        // Fake chrome runtime
        window.chrome = {
            runtime: {
                onMessage: { addListener: () => {}, removeListener: () => {} },
                sendMessage: () => {}
            }
        };

        // Override permissions query
        const originalQuery = window.navigator.permissions?.query;
        if (originalQuery) {
            window.navigator.permissions.query = (params) => {
                if (params.name === 'notifications') {
                    return Promise.resolve({ state: 'denied' });
                }
                return originalQuery.call(window.navigator.permissions, params);
            };
        }
    });
}

/**
 * Inject a unique, realistic browser fingerprint into a page.
 * Each session gets a different fingerprint so FB/CL can't link them.
 * Call AFTER page creation, BEFORE navigation.
 * @param {import('puppeteer').Page} page
 */
async function injectFingerprint(page) {
    try {
        const fingerprint = fingerprintGenerator.getFingerprint({
            browsers: ['chrome'],
            operatingSystems: ['windows'],
            locales: ['en-US']
        });

        const injector = new FingerprintInjector();
        await injector.attachFingerprintToPuppeteer(page, fingerprint);
    } catch (err) {
        // Non-fatal: if injection fails, the stealth plugin + manual patches still work
        // This can happen with version mismatches — log but continue
        if (typeof console !== 'undefined') {
            console.warn('Fingerprint injection failed (non-fatal):', err.message);
        }
    }
}

/**
 * Try multiple selectors in order, return first match
 * @param {import('puppeteer').Page} page
 * @param {string[]} selectors - Array of CSS/XPath selectors to try
 * @param {number} timeout - Max wait per selector in ms (default 3000)
 * @returns {import('puppeteer').ElementHandle|null}
 */
async function trySelectors(page, selectors, timeout = 3000) {
    // Race all selectors in parallel — first match wins
    try {
        const result = await Promise.race([
            ...selectors.map(selector =>
                page.waitForSelector(selector, { timeout, visible: true })
                    .then(el => el || Promise.reject('null'))
                    .catch(() => new Promise(() => {})) // never resolves on failure
            ),
            new Promise((_, reject) => setTimeout(() => reject('timeout'), timeout + 500))
        ]);
        if (result) return result;
    } catch (_) {}

    // Fallback: sequential try (handles edge cases where parallel race fails)
    for (const selector of selectors) {
        try {
            const element = await page.waitForSelector(selector, { timeout: Math.min(timeout, 1500), visible: true });
            if (element) return element;
        } catch (_) {}
    }
    return null;
}

/**
 * Retry a step function with screenshot capture on failure
 * @param {Function} stepFn - Async function to retry
 * @param {Object} options
 * @param {number} options.maxRetries - Max retry attempts (default 2)
 * @param {string} options.stepName - Name for logging
 * @param {import('puppeteer').Page} options.page - Page for screenshots
 * @param {Function} options.captureScreenshot - Screenshot capture function
 * @param {Object} options.log - Logger instance
 */
async function retryStep(stepFn, { maxRetries = 2, stepName = 'unknown', page = null, captureScreenshot = null, log = null } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await stepFn();
        } catch (error) {
            lastError = error;
            const isLastAttempt = attempt > maxRetries;

            if (log) {
                log[isLastAttempt ? 'error' : 'warn'](`Step "${stepName}" failed (attempt ${attempt}/${maxRetries + 1})`, {
                    error: error.message
                });
            }

            if (!isLastAttempt) {
                // Capture screenshot for debugging
                if (captureScreenshot && page) {
                    await captureScreenshot(`retry_${stepName}_attempt${attempt}`, page).catch(() => {});
                }
                // Wait before retry (exponential backoff)
                await humanDelay(1000 * attempt, 3000 * attempt);
            }
        }
    }
    throw lastError;
}

/**
 * Detect if a CAPTCHA is present on the page
 * @param {import('puppeteer').Page} page
 * @returns {{detected: boolean, type: string|null}}
 */
async function detectCaptcha(page) {
    const captchaIndicators = await page.evaluate(() => {
        const indicators = {
            recaptcha: !!document.querySelector('iframe[src*="recaptcha"]') ||
                       !!document.querySelector('.g-recaptcha') ||
                       !!document.querySelector('script[src*="recaptcha"]'),
            hcaptcha: !!document.querySelector('iframe[src*="hcaptcha"]') ||
                      !!document.querySelector('.h-captcha') ||
                      !!document.querySelector('script[src*="hcaptcha"]'),
            fbCheckpoint: !!document.querySelector('form[action*="checkpoint"]') ||
                          (document.title.toLowerCase().includes('security check') ||
                           document.title.toLowerCase().includes('checkpoint')),
            clCaptcha: !!document.querySelector('img[src*="captcha"]') ||
                       !!document.querySelector('#captcha') ||
                       !!document.querySelector('input[name*="captcha"]')
        };
        return indicators;
    });

    if (captchaIndicators.recaptcha) return { detected: true, type: 'recaptcha' };
    if (captchaIndicators.hcaptcha) return { detected: true, type: 'hcaptcha' };
    if (captchaIndicators.fbCheckpoint) return { detected: true, type: 'facebook_checkpoint' };
    if (captchaIndicators.clCaptcha) return { detected: true, type: 'craigslist_captcha' };

    return { detected: false, type: null };
}

/**
 * Wait for a CAPTCHA to be solved manually (with timeout)
 * @param {import('puppeteer').Page} page
 * @param {number} timeoutMs - Max wait time (default 5 minutes)
 * @param {Object} log - Logger instance
 * @returns {boolean} true if captcha was solved, false if timed out
 */
async function waitForCaptchaSolution(page, timeoutMs = 5 * 60 * 1000, log = null) {
    if (log) {
        log.warn('CAPTCHA detected — waiting for manual solution', { timeoutMs });
    }

    const startTime = Date.now();
    const checkInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));

        const { detected } = await detectCaptcha(page);
        if (!detected) {
            if (log) log.info('CAPTCHA solved — resuming automation');
            return true;
        }
    }

    if (log) log.error('CAPTCHA solution timed out');
    return false;
}

module.exports = {
    humanDelay,
    humanType,
    humanClick,
    humanScroll,
    randomizeViewport,
    applyStealthPatches,
    injectFingerprint,
    trySelectors,
    retryStep,
    detectCaptcha,
    waitForCaptchaSolution
};
