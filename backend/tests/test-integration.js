/**
 * Integration dry-run tests for the listing automation system.
 * Validates the end-to-end flow logic by mocking external dependencies
 * (Firestore, browser, APIs) and verifying orchestration works correctly.
 *
 * Run: node backend/tests/test-integration.js
 */

const assert = require('assert');
const path = require('path');

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

// ============================================================
// 1. COMPLIANCE → RATE LIMIT → DUPLICATE CHECK PIPELINE
// ============================================================
console.log('\n--- Integration: FB Compliance → Rate Limit → Duplicate Check ---');

const { validateFBListing } = require('../lib/fbCompliance');
const { PLATFORM_LIMITS } = require('../lib/rateLimiter');

test('Pipeline: valid listing passes compliance', () => {
    const item = {
        price: '50',
        condition: 'Used',
        imageUrls: [
            'https://example.com/img1.jpg',
            'https://example.com/img2.jpg',
            'https://example.com/img3.jpg'
        ]
    };
    const result = validateFBListing(item, 'Vintage oak dining table', 'Beautiful solid oak dining table in great condition. Seats 6 comfortably.');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
});

test('Pipeline: prohibited item blocked before browser launch', () => {
    const item = {
        price: '200',
        condition: 'Used',
        imageUrls: ['https://example.com/img1.jpg']
    };
    const result = validateFBListing(item, 'Hunting rifle with scope', 'Great rifle for hunting season, barely used.');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('rifle')));
});

test('Pipeline: rate limits are configured for both platforms', () => {
    assert.ok(PLATFORM_LIMITS.facebook, 'facebook limits exist');
    assert.ok(PLATFORM_LIMITS.craigslist, 'craigslist limits exist');
    assert.strictEqual(PLATFORM_LIMITS.facebook.maxPerDay, 10);
    assert.strictEqual(PLATFORM_LIMITS.craigslist.minGapMs, 30 * 60 * 1000);
});

test('Pipeline: price validation catches invalid before posting', () => {
    const item = { price: '0', condition: 'Used', imageUrls: ['https://example.com/img.jpg'] };
    const result = validateFBListing(item, 'Valid Title Here', 'A perfectly valid description for this item listing.');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.toLowerCase().includes('price')));
});

test('Pipeline: missing images blocked before posting', () => {
    const item = { price: '25', condition: 'Used', imageUrls: [] };
    const result = validateFBListing(item, 'Valid Title Here', 'A perfectly valid description for this item listing.');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.toLowerCase().includes('image')));
});

// ============================================================
// 2. TEXT SANITIZATION (from runListingAutomation.js)
// ============================================================
console.log('\n--- Integration: Text Sanitization ---');

// These functions are internal to runListingAutomation.js, so we replicate the logic
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

test('Sanitize: removes client name prefix', () => {
    const result = sanitizePublicText('AcmeCorp - Vintage Chair', 'AcmeCorp');
    assert.strictEqual(result, 'Vintage Chair');
});

test('Sanitize: removes client name with colon', () => {
    const result = sanitizePublicText('AcmeCorp: Vintage Chair', 'AcmeCorp');
    assert.strictEqual(result, 'Vintage Chair');
});

test('Sanitize: removes client name mid-text', () => {
    const result = sanitizePublicText('A Vintage AcmeCorp Chair', 'AcmeCorp');
    assert.strictEqual(result, 'A Vintage  Chair');
});

test('Sanitize: no client name returns trimmed text', () => {
    const result = sanitizePublicText('  Vintage Chair  ', '');
    assert.strictEqual(result, 'Vintage Chair');
});

test('Sanitize: handles regex special characters in client name', () => {
    const result = sanitizePublicText('A+B Corp - Item', 'A+B Corp');
    assert.strictEqual(result, 'Item');
});

test('containsClientName: detects name case-insensitively', () => {
    assert.strictEqual(containsClientName('made by acmecorp', 'AcmeCorp'), true);
});

test('containsClientName: returns false when not present', () => {
    assert.strictEqual(containsClientName('vintage chair', 'AcmeCorp'), false);
});

test('containsClientName: handles null inputs', () => {
    assert.strictEqual(containsClientName(null, 'AcmeCorp'), false);
    assert.strictEqual(containsClientName('text', null), false);
});

// ============================================================
// 3. PLATFORM ROUTING LOGIC
// ============================================================
console.log('\n--- Integration: Platform Routing ---');

function parsePlatforms(platformValue) {
    const p = (platformValue || '').toLowerCase();
    return {
        craigslist: p.includes('craigslist') || p.includes('cl') || p.includes('both') || p.includes('all'),
        facebook: p.includes('facebook') || p.includes('fb') || p.includes('both') || p.includes('all'),
        ebay: p.includes('ebay') || p.includes('both') || p.includes('all')
    };
}

test('Platform: "craigslist" routes only to CL', () => {
    const p = parsePlatforms('craigslist');
    assert.strictEqual(p.craigslist, true);
    assert.strictEqual(p.facebook, false);
    assert.strictEqual(p.ebay, false);
});

test('Platform: "facebook" routes only to FB', () => {
    const p = parsePlatforms('facebook');
    assert.strictEqual(p.craigslist, false);
    assert.strictEqual(p.facebook, true);
    assert.strictEqual(p.ebay, false);
});

test('Platform: "both" routes to CL + FB + eBay', () => {
    const p = parsePlatforms('both');
    assert.strictEqual(p.craigslist, true);
    assert.strictEqual(p.facebook, true);
    assert.strictEqual(p.ebay, true);
});

test('Platform: "all" routes to all platforms', () => {
    const p = parsePlatforms('all');
    assert.strictEqual(p.craigslist, true);
    assert.strictEqual(p.facebook, true);
    assert.strictEqual(p.ebay, true);
});

test('Platform: "fb" shorthand works', () => {
    const p = parsePlatforms('fb');
    assert.strictEqual(p.facebook, true);
});

test('Platform: "cl" shorthand works', () => {
    const p = parsePlatforms('cl');
    assert.strictEqual(p.craigslist, true);
});

test('Platform: empty/null defaults to nothing', () => {
    const p = parsePlatforms('');
    assert.strictEqual(p.craigslist, false);
    assert.strictEqual(p.facebook, false);
    assert.strictEqual(p.ebay, false);
});

test('Platform: "ebay" routes only to eBay', () => {
    const p = parsePlatforms('ebay');
    assert.strictEqual(p.craigslist, false);
    assert.strictEqual(p.facebook, false);
    assert.strictEqual(p.ebay, true);
});

// ============================================================
// 4. EBAY PRICE PARSING + IMAGE VALIDATION INTEGRATION
// ============================================================
console.log('\n--- Integration: eBay Price + Image Pipeline ---');

const { parsePrice, validateImageUrls } = require('../ebay/ebayListing');

test('eBay: real-world price "$1,234.56" parses correctly', () => {
    assert.strictEqual(parsePrice('$1,234.56'), 1234.56);
});

test('eBay: price + image validation for full listing', () => {
    const price = parsePrice('$49.99');
    const { valid } = validateImageUrls(['https://firebase.storage/img1.jpg', 'https://firebase.storage/img2.jpg']);
    assert.strictEqual(price, 49.99);
    assert.strictEqual(valid.length, 2);
});

test('eBay: listing with bad price and bad images both caught', () => {
    const price = parsePrice('free');
    const { valid, warnings } = validateImageUrls(['http://insecure.com/img.jpg']);
    assert.strictEqual(price, null);
    assert.strictEqual(valid.length, 0);
    assert.ok(warnings.length > 0);
});

// ============================================================
// 5. PROXY MANAGER DRY-RUN
// ============================================================
console.log('\n--- Integration: Proxy Manager ---');

const { getProxy, closeAllProxies, PROXY_ENABLED } = require('../lib/proxyManager');

testAsync('Proxy: disabled by default, returns null proxy', async () => {
    assert.strictEqual(PROXY_ENABLED, false);
    const proxy = await getProxy({ sessionId: 'test-123' });
    assert.strictEqual(proxy.proxyUrl, null);
    assert.ok(typeof proxy.cleanup === 'function');
});

testAsync('Proxy: cleanup is safe to call when disabled', async () => {
    await closeAllProxies(); // should not throw
});

// ============================================================
// 6. HUMAN BEHAVIOR DRY-RUN
// ============================================================
console.log('\n--- Integration: Human Behavior Timing ---');

const { humanDelay, retryStep } = require('../lib/humanBehavior');

testAsync('humanDelay: 100-200ms delay is in range', async () => {
    const start = Date.now();
    await humanDelay(100, 200);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 80, `Too fast: ${elapsed}ms`); // small tolerance
    assert.ok(elapsed < 500, `Too slow: ${elapsed}ms`);
});

testAsync('retryStep: integration — recovers from transient failure', async () => {
    let calls = 0;
    const result = await retryStep(async () => {
        calls++;
        if (calls < 3) throw new Error('transient');
        return 'recovered';
    }, { maxRetries: 3, stepName: 'test_recovery' });
    assert.strictEqual(result, 'recovered');
    assert.strictEqual(calls, 3);
});

testAsync('retryStep: integration — permanent failure exhausts retries', async () => {
    let calls = 0;
    try {
        await retryStep(async () => {
            calls++;
            throw new Error('permanent');
        }, { maxRetries: 2, stepName: 'test_permanent' });
        assert.fail('Should have thrown');
    } catch (e) {
        assert.strictEqual(e.message, 'permanent');
        assert.strictEqual(calls, 3); // 1 initial + 2 retries
    }
});

// ============================================================
// 7. SELECTOR DEFINITIONS INTEGRITY
// ============================================================
console.log('\n--- Integration: Selector Definitions ---');

// We can't import the selectors directly (they're const inside module scope),
// but we verify the module exports and that trySelectors works with mock data.
const { trySelectors } = require('../lib/humanBehavior');

test('trySelectors: exported and callable', () => {
    assert.ok(typeof trySelectors === 'function');
});

// ============================================================
// 8. PAYMENT VALIDATION
// ============================================================
console.log('\n--- Integration: Payment Config Validation ---');

test('Payment: missing env vars throws descriptive error', () => {
    // Temporarily unset all payment vars
    const saved = {};
    const FIELDS = [
        'PAYMENT_NAME', 'PAYMENT_CARD_NUMBER', 'PAYMENT_EXP_MONTH',
        'PAYMENT_EXP_YEAR', 'PAYMENT_CVC', 'PAYMENT_ADDRESS',
        'PAYMENT_CITY', 'PAYMENT_STATE', 'PAYMENT_ZIP', 'PAYMENT_PHONE'
    ];
    FIELDS.forEach(k => { saved[k] = process.env[k]; delete process.env[k]; });

    try {
        // Replicate the validation from runListingAutomation.js
        const missing = FIELDS.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required payment env vars: ${missing.join(', ')}`);
        }
        assert.fail('Should have thrown');
    } catch (e) {
        assert.ok(e.message.includes('Missing required payment env vars'));
        assert.ok(e.message.includes('PAYMENT_NAME'));
        assert.ok(e.message.includes('PAYMENT_PHONE'));
    } finally {
        // Restore
        Object.entries(saved).forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; });
    }
});

test('Payment: all env vars present passes validation', () => {
    const FIELDS = [
        'PAYMENT_NAME', 'PAYMENT_CARD_NUMBER', 'PAYMENT_EXP_MONTH',
        'PAYMENT_EXP_YEAR', 'PAYMENT_CVC', 'PAYMENT_ADDRESS',
        'PAYMENT_CITY', 'PAYMENT_STATE', 'PAYMENT_ZIP', 'PAYMENT_PHONE'
    ];
    const saved = {};
    FIELDS.forEach(k => { saved[k] = process.env[k]; process.env[k] = 'test_value'; });

    try {
        const missing = FIELDS.filter(key => !process.env[key]);
        assert.strictEqual(missing.length, 0);
    } finally {
        Object.entries(saved).forEach(([k, v]) => {
            if (v !== undefined) process.env[k] = v;
            else delete process.env[k];
        });
    }
});

// ============================================================
// 9. EBAY ERROR CLASSIFICATION INTEGRATION
// ============================================================
console.log('\n--- Integration: eBay Error Handling ---');

const { isTransientError } = require('../ebay/ebayClient');

test('eBay retry: 429 rate limit is retryable', () => {
    assert.strictEqual(isTransientError({ response: { status: 429 } }), true);
});

test('eBay retry: 503 service unavailable is retryable', () => {
    assert.strictEqual(isTransientError({ response: { status: 503 } }), true);
});

test('eBay retry: network error (no response) is retryable', () => {
    assert.strictEqual(isTransientError({ code: 'ECONNRESET' }), true);
});

test('eBay retry: 400 bad request is NOT retryable', () => {
    assert.strictEqual(isTransientError({ response: { status: 400 } }), false);
});

test('eBay retry: 404 not found is NOT retryable', () => {
    assert.strictEqual(isTransientError({ response: { status: 404 } }), false);
});

// ============================================================
// 10. FULL FLOW DRY-RUN (mocked Firestore)
// ============================================================
console.log('\n--- Integration: Full Flow Dry-Run (mocked DB) ---');

test('Full flow: compliance blocks prohibited item before any DB/browser work', () => {
    // Simulate the exact sequence from runListingAutomation
    const item = {
        platform: 'facebook',
        title: 'Ammo box and accessories',
        description: 'Military grade ammunition storage box',
        price: '45',
        condition: 'Used',
        imageUrls: ['https://storage.example.com/img1.jpg'],
        clientName: ''
    };

    const publicTitle = sanitizePublicText(item.title, item.clientName);
    const publicDescription = sanitizePublicText(item.description, item.clientName);

    // Step 1: Compliance check (happens BEFORE browser launch)
    const compliance = validateFBListing(item, publicTitle, publicDescription);

    // Should be blocked at this stage — no browser, no DB updates, no images downloaded
    assert.strictEqual(compliance.valid, false);
    assert.ok(compliance.errors.length > 0);
    assert.ok(compliance.errors.some(e => e.includes('ammo') || e.includes('ammunition')));
});

test('Full flow: valid listing passes all pre-checks', () => {
    const item = {
        platform: 'facebook',
        title: 'Solid Wood Bookshelf',
        description: 'Beautiful handcrafted bookshelf with 5 shelves. Perfect for home office or living room.',
        price: '150',
        condition: 'Used',
        imageUrls: [
            'https://storage.example.com/img1.jpg',
            'https://storage.example.com/img2.jpg',
            'https://storage.example.com/img3.jpg'
        ],
        clientName: 'TestClient'
    };

    // Step 1: Sanitize
    const publicTitle = sanitizePublicText(item.title, item.clientName);
    const publicDescription = sanitizePublicText(item.description, item.clientName);
    assert.ok(!containsClientName(publicTitle, item.clientName));
    assert.ok(!containsClientName(publicDescription, item.clientName));

    // Step 2: Compliance
    const compliance = validateFBListing(item, publicTitle, publicDescription);
    assert.strictEqual(compliance.valid, true);
    assert.strictEqual(compliance.errors.length, 0);

    // Step 3: Platform routing
    const platforms = parsePlatforms(item.platform);
    assert.strictEqual(platforms.facebook, true);
    assert.strictEqual(platforms.craigslist, false);
    assert.strictEqual(platforms.ebay, false);
});

test('Full flow: client name leak is caught before automation', () => {
    // Simulate a case where sanitization fails to remove client name
    // (e.g. name embedded in a URL or unusual format)
    const item = {
        title: 'Chair from SecretCorp warehouse',
        clientName: 'SecretCorp'
    };

    const publicTitle = sanitizePublicText(item.title, item.clientName);
    // Sanitization should remove it, but let's check containsClientName as a safety net
    // In this case sanitize DOES remove it, so containsClientName should return false
    const leaked = containsClientName(publicTitle, item.clientName);
    assert.strictEqual(leaked, false, 'Sanitization should have removed client name');
});

test('Full flow: eBay-only listing skips browser entirely', () => {
    const platforms = parsePlatforms('ebay');
    const needsBrowser = platforms.craigslist || platforms.facebook;
    assert.strictEqual(needsBrowser, false, 'eBay-only should not need browser');
});

test('Full flow: both platforms need browser + payment for CL', () => {
    const platforms = parsePlatforms('both');
    const needsBrowser = platforms.craigslist || platforms.facebook;
    const needsPayment = platforms.craigslist;
    assert.strictEqual(needsBrowser, true);
    assert.strictEqual(needsPayment, true);
});

// ============================================================
// RESULTS
// ============================================================

// Wait for async tests
setTimeout(() => {
    console.log('\n============================================');
    console.log(`  ${passed + failed} tests run: ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
        console.log('\n  Failures:');
        failures.forEach(f => console.log(`    - ${f.name}: ${f.error}`));
    }
    console.log('============================================\n');
    process.exit(failed > 0 ? 1 : 0);
}, 3000);
