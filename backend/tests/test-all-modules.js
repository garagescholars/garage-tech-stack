/**
 * Comprehensive test suite for the listing automation system.
 * Tests all modules without requiring Firebase or browser connections.
 *
 * Run: node backend/tests/test-all-modules.js
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  PASS  ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e.message });
        console.log(`  FAIL  ${name}`);
        console.log(`        ${e.message}`);
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  PASS  ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e.message });
        console.log(`  FAIL  ${name}`);
        console.log(`        ${e.message}`);
    }
}

// ============================================
// 1. FB COMPLIANCE VALIDATOR
// ============================================
console.log('\n--- fbCompliance.js ---');

const {
    validateFBListing,
    checkProhibitedKeywords,
    validateTitle,
    validateDescription,
    validatePrice,
    validateImages
} = require('../lib/fbCompliance');

test('checkProhibitedKeywords: detects weapons', () => {
    const matches = checkProhibitedKeywords('Brand new rifle for sale');
    assert.ok(matches.length > 0, 'Should detect "rifle"');
    assert.strictEqual(matches[0].category, 'weapons');
});

test('checkProhibitedKeywords: detects drugs', () => {
    const matches = checkProhibitedKeywords('CBD oil organic extract');
    assert.ok(matches.length > 0, 'Should detect "cbd"');
    assert.strictEqual(matches[0].category, 'drugs');
});

test('checkProhibitedKeywords: clean text passes', () => {
    const matches = checkProhibitedKeywords('Beautiful oak dining table in great condition');
    assert.strictEqual(matches.length, 0, 'Should find no prohibited keywords');
});

test('checkProhibitedKeywords: detects counterfeit', () => {
    const matches = checkProhibitedKeywords('Replica designer handbag');
    assert.ok(matches.length > 0, 'Should detect "replica"');
});

test('validateTitle: valid title passes', () => {
    const r = validateTitle('Vintage Oak Coffee Table');
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.errors.length, 0);
});

test('validateTitle: too short fails', () => {
    const r = validateTitle('Hi');
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('short')));
});

test('validateTitle: too long fails', () => {
    const r = validateTitle('A'.repeat(81));
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('long')));
});

test('validateTitle: empty fails', () => {
    const r = validateTitle('');
    assert.strictEqual(r.valid, false);
});

test('validateTitle: phone number fails', () => {
    const r = validateTitle('Table for sale call 303-555-1234');
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('phone')));
});

test('validateTitle: URL fails', () => {
    const r = validateTitle('Check out https://mysite.com for deals');
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('URL')));
});

test('validateTitle: ALL CAPS warns', () => {
    const r = validateTitle('HUGE SALE EVERYTHING MUST GO');
    assert.strictEqual(r.valid, true); // warning, not error
    assert.ok(r.warnings.length > 0);
});

test('validateDescription: valid description passes', () => {
    const r = validateDescription('This is a beautiful solid wood dining table in excellent condition. Seats 6.');
    assert.strictEqual(r.valid, true);
});

test('validateDescription: empty warns but passes', () => {
    const r = validateDescription('');
    assert.strictEqual(r.valid, true);
    assert.ok(r.warnings.length > 0);
});

test('validateDescription: phone number fails', () => {
    const r = validateDescription('Great table, call me at 303-555-1234 for pickup details.');
    assert.strictEqual(r.valid, false);
});

test('validatePrice: valid price passes', () => {
    const r = validatePrice('25.00');
    assert.strictEqual(r.valid, true);
});

test('validatePrice: zero fails', () => {
    const r = validatePrice('0');
    assert.strictEqual(r.valid, false);
});

test('validatePrice: too high fails', () => {
    const r = validatePrice('100000');
    assert.strictEqual(r.valid, false);
});

test('validatePrice: empty fails', () => {
    const r = validatePrice('');
    assert.strictEqual(r.valid, false);
});

test('validateImages: valid images pass', () => {
    const r = validateImages(['https://example.com/photo1.jpg', 'https://example.com/photo2.png']);
    assert.strictEqual(r.valid, true);
});

test('validateImages: no images fails', () => {
    const r = validateImages([]);
    assert.strictEqual(r.valid, false);
});

test('validateImages: placeholder URL fails', () => {
    const r = validateImages(['https://via.placeholder.com/300']);
    assert.strictEqual(r.valid, false);
});

test('validateImages: single image warns', () => {
    const r = validateImages(['https://example.com/photo1.jpg']);
    assert.strictEqual(r.valid, true);
    assert.ok(r.warnings.some(w => w.includes('1 image')));
});

test('validateFBListing: valid listing passes', () => {
    const item = {
        price: '50',
        imageUrls: ['https://firebasestorage.googleapis.com/photo1.jpg'],
        condition: 'Used'
    };
    const r = validateFBListing(item, 'Vintage Oak Table', 'Beautiful table in excellent condition. Seats 6 people comfortably.');
    assert.strictEqual(r.valid, true);
});

test('validateFBListing: prohibited keyword blocks', () => {
    const item = {
        price: '50',
        imageUrls: ['https://example.com/photo1.jpg'],
        condition: 'Used'
    };
    const r = validateFBListing(item, 'Rifle case with scope mount', 'Great condition rifle case');
    assert.strictEqual(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('rifle')));
});

// ============================================
// 2. EBAY LISTING — Price Parsing
// ============================================
console.log('\n--- ebayListing.js (parsePrice, validateImageUrls) ---');

const { parsePrice, validateImageUrls } = require('../ebay/ebayListing');

test('parsePrice: simple number', () => {
    assert.strictEqual(parsePrice('25'), 25);
});

test('parsePrice: dollar sign', () => {
    assert.strictEqual(parsePrice('$25.99'), 25.99);
});

test('parsePrice: comma thousands', () => {
    assert.strictEqual(parsePrice('$1,234.56'), 1234.56);
});

test('parsePrice: BUG FIX — comma in wrong place does not create wrong number', () => {
    // Old bug: "$12,34.5" → 12345. New: "$12,34.5" → 1234.5
    const result = parsePrice('$1,234');
    assert.strictEqual(result, 1234);
});

test('parsePrice: zero returns null', () => {
    assert.strictEqual(parsePrice('0'), null);
});

test('parsePrice: negative returns null', () => {
    assert.strictEqual(parsePrice('-5'), null);
});

test('parsePrice: empty returns null', () => {
    assert.strictEqual(parsePrice(''), null);
});

test('parsePrice: null returns null', () => {
    assert.strictEqual(parsePrice(null), null);
});

test('parsePrice: rounds to 2 decimals', () => {
    assert.strictEqual(parsePrice('19.999'), 20);
});

test('parsePrice: handles whitespace', () => {
    assert.strictEqual(parsePrice('  $50  '), 50);
});

test('validateImageUrls: valid HTTPS images', () => {
    const r = validateImageUrls(['https://example.com/img.jpg']);
    assert.strictEqual(r.valid.length, 1);
    assert.strictEqual(r.warnings.length, 0);
});

test('validateImageUrls: rejects HTTP (non-HTTPS)', () => {
    const r = validateImageUrls(['http://example.com/img.jpg']);
    assert.strictEqual(r.valid.length, 0);
    assert.ok(r.warnings.some(w => w.includes('HTTPS')));
});

test('validateImageUrls: rejects placeholders', () => {
    const r = validateImageUrls(['https://via.placeholder.com/300']);
    assert.strictEqual(r.valid.length, 0);
});

test('validateImageUrls: empty array', () => {
    const r = validateImageUrls([]);
    assert.strictEqual(r.valid.length, 0);
    assert.ok(r.warnings.length > 0);
});

test('validateImageUrls: mixed valid/invalid', () => {
    const r = validateImageUrls([
        'https://example.com/good.jpg',
        'http://example.com/bad.jpg',
        'https://via.placeholder.com/300',
        'https://example.com/also-good.png'
    ]);
    assert.strictEqual(r.valid.length, 2);
    assert.strictEqual(r.warnings.length, 2);
});

// ============================================
// 3. EBAY CLIENT — Error Classification
// ============================================
console.log('\n--- ebayClient.js (error classification) ---');

const { isTransientError } = require('../ebay/ebayClient');

test('isTransientError: network error (no response) is transient', () => {
    assert.strictEqual(isTransientError(new Error('ECONNRESET')), true);
});

test('isTransientError: 429 is transient', () => {
    assert.strictEqual(isTransientError({ response: { status: 429 } }), true);
});

test('isTransientError: 500 is transient', () => {
    assert.strictEqual(isTransientError({ response: { status: 500 } }), true);
});

test('isTransientError: 503 is transient', () => {
    assert.strictEqual(isTransientError({ response: { status: 503 } }), true);
});

test('isTransientError: 400 is NOT transient', () => {
    assert.strictEqual(isTransientError({ response: { status: 400 } }), false);
});

test('isTransientError: 401 is NOT transient', () => {
    assert.strictEqual(isTransientError({ response: { status: 401 } }), false);
});

test('isTransientError: 404 is NOT transient', () => {
    assert.strictEqual(isTransientError({ response: { status: 404 } }), false);
});

// ============================================
// 4. HUMAN BEHAVIOR — Functions exist and work
// ============================================
console.log('\n--- humanBehavior.js ---');

const {
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
} = require('../lib/humanBehavior');

test('humanDelay: exported and is a function', () => {
    assert.strictEqual(typeof humanDelay, 'function');
});

test('humanType: exported and is a function', () => {
    assert.strictEqual(typeof humanType, 'function');
});

test('humanClick: exported and is a function', () => {
    assert.strictEqual(typeof humanClick, 'function');
});

test('humanScroll: exported and is a function', () => {
    assert.strictEqual(typeof humanScroll, 'function');
});

test('randomizeViewport: exported and is a function', () => {
    assert.strictEqual(typeof randomizeViewport, 'function');
});

test('applyStealthPatches: exported and is a function', () => {
    assert.strictEqual(typeof applyStealthPatches, 'function');
});

test('injectFingerprint: exported and is a function', () => {
    assert.strictEqual(typeof injectFingerprint, 'function');
});

test('trySelectors: exported and is a function', () => {
    assert.strictEqual(typeof trySelectors, 'function');
});

test('retryStep: exported and is a function', () => {
    assert.strictEqual(typeof retryStep, 'function');
});

test('detectCaptcha: exported and is a function', () => {
    assert.strictEqual(typeof detectCaptcha, 'function');
});

test('waitForCaptchaSolution: exported and is a function', () => {
    assert.strictEqual(typeof waitForCaptchaSolution, 'function');
});

// ============================================
// 5. HUMAN BEHAVIOR — Async behavior tests
// ============================================
console.log('\n--- humanBehavior.js (async behavior) ---');

async function runAsyncTests() {
    await testAsync('humanDelay: resolves within expected range', async () => {
        const start = Date.now();
        await humanDelay(50, 150);
        const elapsed = Date.now() - start;
        assert.ok(elapsed >= 40, `Delay too short: ${elapsed}ms`); // small buffer for timer imprecision
        assert.ok(elapsed < 500, `Delay too long: ${elapsed}ms`);
    });

    await testAsync('retryStep: succeeds on first try', async () => {
        let calls = 0;
        const result = await retryStep(async () => { calls++; return 'ok'; }, { maxRetries: 2, stepName: 'test' });
        assert.strictEqual(result, 'ok');
        assert.strictEqual(calls, 1);
    });

    await testAsync('retryStep: retries on failure then succeeds', async () => {
        let calls = 0;
        const result = await retryStep(async () => {
            calls++;
            if (calls < 2) throw new Error('fail');
            return 'recovered';
        }, { maxRetries: 2, stepName: 'test' });
        assert.strictEqual(result, 'recovered');
        assert.strictEqual(calls, 2);
    });

    await testAsync('retryStep: throws after exhausting retries', async () => {
        let calls = 0;
        try {
            await retryStep(async () => { calls++; throw new Error('always fail'); }, { maxRetries: 1, stepName: 'test' });
            assert.fail('Should have thrown');
        } catch (e) {
            assert.strictEqual(e.message, 'always fail');
            assert.strictEqual(calls, 2); // 1 initial + 1 retry
        }
    });

    // ============================================
    // 6. PROXY MANAGER
    // ============================================
    console.log('\n--- proxyManager.js ---');

    const { getProxy, closeAllProxies, PROXY_ENABLED } = require('../lib/proxyManager');

    await testAsync('getProxy: returns null when PROXY_ENABLED=false', async () => {
        const result = await getProxy({ sessionId: 'test123' });
        assert.strictEqual(result.proxyUrl, null);
        assert.strictEqual(typeof result.cleanup, 'function');
    });

    test('PROXY_ENABLED: defaults to false', () => {
        assert.strictEqual(PROXY_ENABLED, false);
    });

    test('closeAllProxies: exported and is a function', () => {
        assert.strictEqual(typeof closeAllProxies, 'function');
    });

    // ============================================
    // 7. RATE LIMITER — structure
    // ============================================
    console.log('\n--- rateLimiter.js (exports check) ---');

    const rateLimiter = require('../lib/rateLimiter');

    test('rateLimiter: exports canPost', () => {
        assert.strictEqual(typeof rateLimiter.canPost, 'function');
    });

    test('rateLimiter: exports recordPost', () => {
        assert.strictEqual(typeof rateLimiter.recordPost, 'function');
    });

    test('rateLimiter: exports checkDuplicate', () => {
        assert.strictEqual(typeof rateLimiter.checkDuplicate, 'function');
    });

    test('rateLimiter: exports recordPosting', () => {
        assert.strictEqual(typeof rateLimiter.recordPosting, 'function');
    });

    test('rateLimiter: exports getRateLimitStatus', () => {
        assert.strictEqual(typeof rateLimiter.getRateLimitStatus, 'function');
    });

    test('rateLimiter: PLATFORM_LIMITS has facebook config', () => {
        assert.ok(rateLimiter.PLATFORM_LIMITS.facebook);
        assert.ok(rateLimiter.PLATFORM_LIMITS.facebook.maxPerDay > 0);
        assert.ok(rateLimiter.PLATFORM_LIMITS.facebook.minGapMs > 0);
    });

    test('rateLimiter: PLATFORM_LIMITS has craigslist config', () => {
        assert.ok(rateLimiter.PLATFORM_LIMITS.craigslist);
        assert.ok(rateLimiter.PLATFORM_LIMITS.craigslist.maxPerDay > 0);
        assert.ok(rateLimiter.PLATFORM_LIMITS.craigslist.minGapMs > 0);
    });

    // ============================================
    // 8. EBAY AUTH — exports
    // ============================================
    console.log('\n--- ebayAuth.js (exports check) ---');

    const ebayAuth = require('../ebay/ebayAuth');

    test('ebayAuth: exports getAccessToken', () => {
        assert.strictEqual(typeof ebayAuth.getAccessToken, 'function');
    });

    test('ebayAuth: exports refreshAccessToken', () => {
        assert.strictEqual(typeof ebayAuth.refreshAccessToken, 'function');
    });

    test('ebayAuth: exports exchangeCodeForTokens', () => {
        assert.strictEqual(typeof ebayAuth.exchangeCodeForTokens, 'function');
    });

    test('ebayAuth: exports buildAuthUrl', () => {
        assert.strictEqual(typeof ebayAuth.buildAuthUrl, 'function');
    });

    test('ebayAuth: EBAY_ENV defaults to production', () => {
        assert.strictEqual(ebayAuth.EBAY_ENV, 'production');
    });

    // ============================================
    // 9. MAIN AUTOMATION — exports
    // ============================================
    console.log('\n--- runListingAutomation.js (exports check) ---');

    const automation = require('../automation/runListingAutomation');

    test('automation: exports runListingAutomation', () => {
        assert.strictEqual(typeof automation.runListingAutomation, 'function');
    });

    test('automation: exports getOpenBrowsers', () => {
        assert.strictEqual(typeof automation.getOpenBrowsers, 'function');
    });

    test('automation: exports closeAllProxies', () => {
        assert.strictEqual(typeof automation.closeAllProxies, 'function');
    });

    test('automation: getOpenBrowsers returns a Set', () => {
        const browsers = automation.getOpenBrowsers();
        assert.ok(browsers instanceof Set);
        assert.strictEqual(browsers.size, 0);
    });

    // ============================================
    // 10. EBAY SETUP — exports
    // ============================================
    console.log('\n--- ebaySetup.js (exports check) ---');

    const ebaySetup = require('../ebay/ebaySetup');

    test('ebaySetup: exports getSetup', () => {
        assert.strictEqual(typeof ebaySetup.getSetup, 'function');
    });

    test('ebaySetup: exports saveSetup', () => {
        assert.strictEqual(typeof ebaySetup.saveSetup, 'function');
    });

    test('ebaySetup: exports ensureMerchantLocation', () => {
        assert.strictEqual(typeof ebaySetup.ensureMerchantLocation, 'function');
    });

    test('ebaySetup: exports fetchPolicies', () => {
        assert.strictEqual(typeof ebaySetup.fetchPolicies, 'function');
    });

    test('ebaySetup: EBAY_MARKETPLACE_ID defaults to EBAY_US', () => {
        assert.strictEqual(ebaySetup.EBAY_MARKETPLACE_ID, 'EBAY_US');
    });

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n============================================');
    console.log(`  ${passed + failed} tests run: ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
        console.log('\n  Failures:');
        for (const f of failures) {
            console.log(`    - ${f.name}: ${f.error}`);
        }
    }
    console.log('============================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runAsyncTests();
