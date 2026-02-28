/**
 * Firestore-backed Rate Limiter
 *
 * Tracks posting frequency per platform to stay within platform rules
 * and avoid getting flagged or banned.
 *
 * Platform limits:
 *   Facebook:   max 10 posts/day, min 15 min gap between posts
 *   Craigslist: min 30 min gap between any posts
 */

const { logger } = require('./logger');

// --- Default limits (overridable via env) ---
const PLATFORM_LIMITS = {
    facebook: {
        maxPerDay: parseInt(process.env.FB_MAX_POSTS_PER_DAY, 10) || 10,
        minGapMs: (parseInt(process.env.FB_MIN_POST_GAP_MINUTES, 10) || 15) * 60 * 1000
    },
    craigslist: {
        maxPerDay: parseInt(process.env.CL_MAX_POSTS_PER_DAY, 10) || 20,
        minGapMs: (parseInt(process.env.CL_MIN_POST_GAP_MINUTES, 10) || 30) * 60 * 1000
    }
};

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get the rate limit document reference
 */
function getRateLimitRef(db, platform, workerId) {
    const docId = `${platform}_${workerId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return db.collection('rateLimits').doc(docId);
}

/**
 * Check if a post is allowed right now
 *
 * @param {Object} db - Firestore instance
 * @param {string} platform - 'facebook' or 'craigslist'
 * @param {string} workerId - Worker identifier
 * @returns {{allowed: boolean, waitMs: number, reason: string, dailyCount: number}}
 */
async function canPost(db, platform, workerId) {
    const limits = PLATFORM_LIMITS[platform];
    if (!limits) {
        return { allowed: true, waitMs: 0, reason: 'Unknown platform — no limits', dailyCount: 0 };
    }

    const ref = getRateLimitRef(db, platform, workerId);
    const snap = await ref.get();

    if (!snap.exists) {
        return { allowed: true, waitMs: 0, reason: 'No posting history', dailyCount: 0 };
    }

    const data = snap.data();
    const now = Date.now();
    const windowStart = now - ROLLING_WINDOW_MS;

    // Filter to timestamps within the rolling window
    const timestamps = (data.postTimestamps || [])
        .map(ts => ts.toMillis ? ts.toMillis() : ts)
        .filter(ts => ts > windowStart)
        .sort((a, b) => b - a); // newest first

    const dailyCount = timestamps.length;

    // Check daily limit
    if (dailyCount >= limits.maxPerDay) {
        const oldestInWindow = timestamps[timestamps.length - 1];
        const waitMs = (oldestInWindow + ROLLING_WINDOW_MS) - now;
        return {
            allowed: false,
            waitMs: Math.max(0, waitMs),
            reason: `Daily limit reached (${dailyCount}/${limits.maxPerDay}). Next slot in ${Math.ceil(waitMs / 60000)} min`,
            dailyCount
        };
    }

    // Check minimum gap
    if (timestamps.length > 0) {
        const lastPostAt = timestamps[0];
        const elapsed = now - lastPostAt;
        if (elapsed < limits.minGapMs) {
            const waitMs = limits.minGapMs - elapsed;
            return {
                allowed: false,
                waitMs,
                reason: `Too soon since last post. Wait ${Math.ceil(waitMs / 60000)} min (min gap: ${limits.minGapMs / 60000} min)`,
                dailyCount
            };
        }
    }

    return { allowed: true, waitMs: 0, reason: 'OK', dailyCount };
}

/**
 * Record a successful post
 *
 * @param {Object} db - Firestore instance
 * @param {string} platform - 'facebook' or 'craigslist'
 * @param {string} workerId - Worker identifier
 */
async function recordPost(db, platform, workerId) {
    const ref = getRateLimitRef(db, platform, workerId);
    const now = Date.now();
    const windowStart = now - ROLLING_WINDOW_MS;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : { postTimestamps: [] };

        // Keep only timestamps within the rolling window + the new one
        const timestamps = (data.postTimestamps || [])
            .map(ts => ts.toMillis ? ts.toMillis() : ts)
            .filter(ts => ts > windowStart);

        timestamps.push(now);

        tx.set(ref, {
            platform,
            workerId,
            postTimestamps: timestamps,
            lastPostAt: now,
            dailyCount: timestamps.length,
            updatedAt: now
        });
    });

    logger.info('Rate limiter: post recorded', { platform, workerId });
}

/**
 * Check if a listing title was posted recently (duplicate detection)
 *
 * @param {Object} db - Firestore instance
 * @param {string} title - Listing title to check
 * @param {string} platform - Platform name
 * @param {number} windowMs - How far back to check (default 48h)
 * @returns {{isDuplicate: boolean, lastPostedAt: number|null}}
 */
async function checkDuplicate(db, title, platform, windowMs = 48 * 60 * 60 * 1000) {
    const normalizedTitle = title.trim().toLowerCase();
    const windowStart = Date.now() - windowMs;

    const snap = await db.collection('postingHistory')
        .where('normalizedTitle', '==', normalizedTitle)
        .where('platform', '==', platform)
        .where('postedAt', '>', windowStart)
        .limit(1)
        .get();

    if (!snap.empty) {
        const lastPostedAt = snap.docs[0].data().postedAt;
        return { isDuplicate: true, lastPostedAt };
    }

    return { isDuplicate: false, lastPostedAt: null };
}

/**
 * Record a posting for duplicate detection
 */
async function recordPosting(db, title, platform, inventoryId) {
    await db.collection('postingHistory').add({
        normalizedTitle: title.trim().toLowerCase(),
        title: title.trim(),
        platform,
        inventoryId,
        postedAt: Date.now()
    });
}

/**
 * Get current rate limit status for monitoring
 */
async function getRateLimitStatus(db, platform, workerId) {
    const limits = PLATFORM_LIMITS[platform];
    const ref = getRateLimitRef(db, platform, workerId);
    const snap = await ref.get();

    if (!snap.exists) {
        return {
            platform,
            workerId,
            dailyCount: 0,
            maxPerDay: limits?.maxPerDay || 0,
            minGapMinutes: limits ? limits.minGapMs / 60000 : 0,
            lastPostAt: null,
            nextAvailableAt: null
        };
    }

    const data = snap.data();
    const now = Date.now();
    const windowStart = now - ROLLING_WINDOW_MS;
    const timestamps = (data.postTimestamps || [])
        .map(ts => ts.toMillis ? ts.toMillis() : ts)
        .filter(ts => ts > windowStart)
        .sort((a, b) => b - a);

    const lastPostAt = timestamps[0] || null;
    let nextAvailableAt = now;

    if (limits) {
        if (timestamps.length >= limits.maxPerDay) {
            const oldest = timestamps[timestamps.length - 1];
            nextAvailableAt = Math.max(nextAvailableAt, oldest + ROLLING_WINDOW_MS);
        }
        if (lastPostAt) {
            nextAvailableAt = Math.max(nextAvailableAt, lastPostAt + limits.minGapMs);
        }
    }

    return {
        platform,
        workerId,
        dailyCount: timestamps.length,
        maxPerDay: limits?.maxPerDay || 0,
        minGapMinutes: limits ? limits.minGapMs / 60000 : 0,
        lastPostAt: lastPostAt ? new Date(lastPostAt).toISOString() : null,
        nextAvailableAt: new Date(nextAvailableAt).toISOString()
    };
}

module.exports = {
    canPost,
    recordPost,
    checkDuplicate,
    recordPosting,
    getRateLimitStatus,
    PLATFORM_LIMITS
};
