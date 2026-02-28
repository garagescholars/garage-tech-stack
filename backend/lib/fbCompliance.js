/**
 * Facebook Marketplace Listing Compliance Validator
 *
 * Validates listings against Meta's Commerce Policies BEFORE launching
 * the browser. Catches policy violations early to avoid wasted automation
 * runs and account flagging.
 */

const { logger } = require('./logger');

// --- Prohibited keyword categories ---
// Each entry: [keyword, category] — matched as whole words (case-insensitive)
const PROHIBITED_KEYWORDS = [
    // Weapons & ammunition
    ['gun', 'weapons'], ['firearm', 'weapons'], ['rifle', 'weapons'],
    ['shotgun', 'weapons'], ['pistol', 'weapons'], ['ammo', 'weapons'],
    ['ammunition', 'weapons'], ['holster', 'weapons'], ['silencer', 'weapons'],
    ['suppressor', 'weapons'], ['magazine clip', 'weapons'], ['assault weapon', 'weapons'],
    ['handgun', 'weapons'], ['revolver', 'weapons'], ['ar-15', 'weapons'],
    ['ar15', 'weapons'], ['ak-47', 'weapons'], ['ak47', 'weapons'],

    // Drugs & substances
    ['marijuana', 'drugs'], ['cannabis', 'drugs'], ['weed', 'drugs'],
    ['cbd', 'drugs'], ['thc', 'drugs'], ['vape', 'drugs'],
    ['e-cigarette', 'drugs'], ['tobacco', 'drugs'], ['kratom', 'drugs'],
    ['psilocybin', 'drugs'], ['mushroom spore', 'drugs'], ['delta-8', 'drugs'],
    ['delta 8', 'drugs'], ['edible', 'drugs'],

    // Animals
    ['puppy for sale', 'animals'], ['kitten for sale', 'animals'],
    ['live animal', 'animals'], ['reptile for sale', 'animals'],
    ['livestock', 'animals'], ['pet for sale', 'animals'],
    ['bird for sale', 'animals'], ['fish for sale', 'animals'],

    // Adult content
    ['adult toy', 'adult'], ['sex toy', 'adult'],

    // Counterfeit / IP
    ['replica', 'counterfeit'], ['knockoff', 'counterfeit'],
    ['counterfeit', 'counterfeit'], ['unauthorized copy', 'counterfeit'],
    ['bootleg', 'counterfeit'], ['fake designer', 'counterfeit'],

    // Hazardous / recalled
    ['recalled', 'hazardous'], ['explosive', 'hazardous'],
    ['flammable liquid', 'hazardous'], ['firework', 'hazardous'],
    ['tear gas', 'hazardous'], ['pepper spray', 'hazardous'],

    // Regulated / medical
    ['prescription', 'medical'], ['pharmaceutical', 'medical'],
    ['controlled substance', 'medical'], ['medical device', 'medical'],

    // Services & digital (FB requires physical items)
    ['digital download', 'digital'], ['gift card', 'digital'],
    ['voucher', 'digital'], ['concert ticket', 'digital'],
    ['event ticket', 'digital'], ['airline ticket', 'digital'],
    ['subscription', 'digital'], ['software license', 'digital'],
    ['nft', 'digital'], ['cryptocurrency', 'digital']
];

// Pre-compile regex patterns for performance
const KEYWORD_PATTERNS = PROHIBITED_KEYWORDS.map(([keyword, category]) => ({
    pattern: new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i'),
    keyword,
    category
}));

// --- Content quality patterns ---
const PHONE_PATTERN = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/i;
const ALL_CAPS_PATTERN = /^[A-Z\s\d!@#$%^&*()_+\-=\[\]{}|;:'",./<>?]{10,}$/;
const EXCESSIVE_PUNCTUATION = /[!]{3,}|[?]{3,}|[$]{3,}|[.]{4,}/;
const SPAM_PATTERNS = [
    /buy\s*now/i, /act\s*fast/i, /limited\s*time/i,
    /call\s*now/i, /text\s*me/i, /dm\s*me/i,
    /\bfree\s+shipping\b/i, /\bno\s+scam\b/i
];

// --- Image validation ---
const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const PLACEHOLDER_URLS = ['via.placeholder.com', 'placeholder.com', 'placehold.it', 'dummyimage.com'];
const MAX_IMAGE_SIZE_BYTES = 30 * 1024 * 1024; // 30MB

/**
 * Check text for prohibited keywords
 * @returns {Array<{keyword: string, category: string}>} matched keywords
 */
function checkProhibitedKeywords(text) {
    if (!text) return [];
    const matches = [];
    for (const { pattern, keyword, category } of KEYWORD_PATTERNS) {
        if (pattern.test(text)) {
            matches.push({ keyword, category });
        }
    }
    return matches;
}

/**
 * Validate title quality
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateTitle(title) {
    const errors = [];
    const warnings = [];

    if (!title || title.trim().length === 0) {
        errors.push('Title is required');
        return { valid: false, errors, warnings };
    }

    const trimmed = title.trim();

    if (trimmed.length < 5) {
        errors.push(`Title too short (${trimmed.length} chars, min 5)`);
    }
    if (trimmed.length > 80) {
        errors.push(`Title too long (${trimmed.length} chars, max 80)`);
    }
    if (ALL_CAPS_PATTERN.test(trimmed)) {
        warnings.push('Title is ALL CAPS — may be flagged as spam');
    }
    if (EXCESSIVE_PUNCTUATION.test(trimmed)) {
        warnings.push('Title has excessive punctuation — may be flagged as spam');
    }
    if (PHONE_PATTERN.test(trimmed)) {
        errors.push('Title contains a phone number — not allowed on FB Marketplace');
    }
    if (URL_PATTERN.test(trimmed)) {
        errors.push('Title contains a URL — not allowed on FB Marketplace');
    }

    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(trimmed)) {
            warnings.push(`Title contains spam-like phrase: "${trimmed.match(pattern)[0]}"`);
            break;
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate description quality
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateDescription(description) {
    const errors = [];
    const warnings = [];

    if (!description || description.trim().length === 0) {
        warnings.push('Description is empty — listings with descriptions perform better');
        return { valid: true, errors, warnings };
    }

    const trimmed = description.trim();

    if (trimmed.length < 20) {
        warnings.push(`Description is very short (${trimmed.length} chars) — may reduce visibility`);
    }
    if (PHONE_PATTERN.test(trimmed)) {
        errors.push('Description contains a phone number — may be flagged by Facebook');
    }
    if (URL_PATTERN.test(trimmed)) {
        errors.push('Description contains a URL — external links are flagged by Facebook');
    }

    // Check for large ALL CAPS blocks
    const lines = trimmed.split('\n');
    const capsLines = lines.filter(line => line.length > 10 && ALL_CAPS_PATTERN.test(line));
    if (capsLines.length > 0) {
        warnings.push('Description has ALL CAPS sections — may be flagged as spam');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate price
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validatePrice(price) {
    const errors = [];
    const warnings = [];

    if (price === null || price === undefined || price === '') {
        errors.push('Price is required');
        return { valid: false, errors, warnings };
    }

    const numericPrice = Number(String(price).replace(/[^0-9.]/g, ''));

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        errors.push('Price must be greater than $0');
    } else if (numericPrice >= 100000) {
        errors.push(`Price $${numericPrice} seems too high (max $99,999)`);
    } else if (numericPrice < 1) {
        warnings.push('Price under $1 may be flagged as spam');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate images
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateImages(imageUrls) {
    const errors = [];
    const warnings = [];

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        errors.push('At least 1 image is required for Facebook Marketplace');
        return { valid: false, errors, warnings };
    }

    for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];

        // Check for placeholder URLs
        if (PLACEHOLDER_URLS.some(placeholder => url.includes(placeholder))) {
            errors.push(`Image ${i + 1} is a placeholder — real product photos required`);
        }

        // Check file extension
        const urlLower = url.toLowerCase().split('?')[0]; // strip query params
        const hasValidExt = VALID_IMAGE_EXTENSIONS.some(ext => urlLower.endsWith(ext));
        if (!hasValidExt && !url.includes('firebasestorage.googleapis.com')) {
            // Firebase Storage URLs don't always have extensions, so skip them
            warnings.push(`Image ${i + 1} may not be JPG/PNG format`);
        }
    }

    if (imageUrls.length === 1) {
        warnings.push('Only 1 image — listings with 3+ images get more views');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Main validation function — call this before launching FB automation
 *
 * @param {Object} item - The inventory item from Firestore
 * @param {string} publicTitle - Sanitized title (client name removed)
 * @param {string} publicDescription - Sanitized description (client name removed)
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateFBListing(item, publicTitle, publicDescription) {
    const errors = [];
    const warnings = [];

    // 1. Check prohibited keywords in title
    const titleKeywords = checkProhibitedKeywords(publicTitle);
    for (const { keyword, category } of titleKeywords) {
        errors.push(`Prohibited keyword in title: "${keyword}" (${category})`);
    }

    // 2. Check prohibited keywords in description
    const descKeywords = checkProhibitedKeywords(publicDescription);
    for (const { keyword, category } of descKeywords) {
        errors.push(`Prohibited keyword in description: "${keyword}" (${category})`);
    }

    // 3. Validate title quality
    const titleResult = validateTitle(publicTitle);
    errors.push(...titleResult.errors);
    warnings.push(...titleResult.warnings);

    // 4. Validate description quality
    const descResult = validateDescription(publicDescription);
    errors.push(...descResult.errors);
    warnings.push(...descResult.warnings);

    // 5. Validate price
    const priceResult = validatePrice(item.price);
    errors.push(...priceResult.errors);
    warnings.push(...priceResult.warnings);

    // 6. Validate images
    const imageResult = validateImages(item.imageUrls);
    errors.push(...imageResult.errors);
    warnings.push(...imageResult.warnings);

    // 7. Check condition
    if (!item.condition) {
        warnings.push('Condition not set — defaults may reduce listing visibility');
    }

    const valid = errors.length === 0;

    if (!valid) {
        logger.warn('FB compliance check failed', { errors, warnings, title: publicTitle });
    } else if (warnings.length > 0) {
        logger.info('FB compliance passed with warnings', { warnings, title: publicTitle });
    }

    return { valid, errors, warnings };
}

module.exports = {
    validateFBListing,
    checkProhibitedKeywords,
    validateTitle,
    validateDescription,
    validatePrice,
    validateImages
};
