const axios = require('axios');
const { getAccessToken, refreshAccessToken, EBAY_ENV } = require('./ebayAuth');
const { logger } = require('../lib/logger');

const getApiBaseUrl = () => (
    EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
);

// --- Error classification ---

/**
 * Determine if an error is transient (worth retrying)
 */
const isTransientError = (error) => {
    // Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, etc.)
    if (!error.response) return true;

    const status = error.response.status;
    // 429 = rate limited, 500-504 = server errors
    return status === 429 || (status >= 500 && status <= 504);
};

/**
 * Determine if the error is an expired/invalid token (should trigger refresh)
 */
const isAuthError = (error) => {
    return error.response?.status === 401;
};

/**
 * Extract Retry-After header value in milliseconds
 */
const getRetryAfterMs = (error) => {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (!retryAfter) return null;
    const seconds = parseInt(retryAfter, 10);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
};

// --- Logging ---

const logAxiosError = (error, context) => {
    const status = error.response?.status || null;
    const payload = error.response?.data || null;
    const details = payload ? JSON.stringify(payload).slice(0, 3000) : error.message || String(error);
    logger.error('eBay API request failed', { ...context, status, details });
};

// --- Core request with retry + auth refresh ---

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Make an authenticated eBay API request with:
 * - Automatic retry on transient errors (429, 5xx, network)
 * - Exponential backoff with jitter
 * - Automatic token refresh on 401
 * - Retry-After header respect for 429s
 *
 * @param {Object} db - Firestore instance
 * @param {Object} config - { method, path, data, headers }
 * @param {Object} options - { maxRetries }
 */
const ebayRequest = async (db, { method, path, data, headers }, { maxRetries = MAX_RETRIES } = {}) => {
    let lastError;
    let tokenRefreshed = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const token = await getAccessToken(db);
            const url = `${getApiBaseUrl()}${path}`;

            const response = await axios({
                method,
                url,
                data,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'en-US',
                    ...(headers || {})
                },
                timeout: 30000 // 30s timeout per request
            });

            return response;
        } catch (error) {
            lastError = error;
            const url = `${getApiBaseUrl()}${path}`;
            const isLast = attempt === maxRetries;

            // 401: token expired mid-request — refresh once and retry
            if (isAuthError(error) && !tokenRefreshed) {
                logger.warn('eBay 401 — refreshing token and retrying', { path, attempt });
                try {
                    await refreshAccessToken(db);
                    tokenRefreshed = true;
                    // Don't count this as a retry attempt
                    attempt--;
                    continue;
                } catch (refreshErr) {
                    logger.error('eBay token refresh failed — auth may need re-authorization', {
                        error: refreshErr.message
                    });
                    // Wrap with actionable message
                    const authError = new Error(
                        `eBay authentication failed. Refresh token may be expired — run cliAuth.js to re-authorize. (${refreshErr.message})`
                    );
                    authError.code = 'EBAY_AUTH_FAILED';
                    authError.response = refreshErr.response;
                    throw authError;
                }
            }

            // Transient error: retry with backoff
            if (isTransientError(error) && !isLast) {
                const retryAfterMs = getRetryAfterMs(error);
                const backoffMs = retryAfterMs || (BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000);

                logger.warn('eBay transient error — retrying', {
                    path,
                    status: error.response?.status || 'network',
                    attempt: attempt + 1,
                    maxRetries,
                    retryInMs: Math.round(backoffMs)
                });

                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }

            // Permanent error or exhausted retries — log and throw
            const requestBody = data ? JSON.stringify(data).slice(0, 1000) : null;
            logAxiosError(error, { method, url, path, requestBody, attempt, maxRetries });
            throw error;
        }
    }

    throw lastError;
};

module.exports = { ebayRequest, getApiBaseUrl, isTransientError };
