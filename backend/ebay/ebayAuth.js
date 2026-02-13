const axios = require('axios');
const { logger } = require('../lib/logger');

const EBAY_ENV = process.env.EBAY_ENV || 'production';
const EBAY_TOKEN_DOC_PATH = process.env.EBAY_TOKEN_DOC_PATH || 'integrations/ebay';
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || '';
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || '';
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI || '';
logger.debug('eBay redirect URI configured', { redirectUri: EBAY_REDIRECT_URI ? '***set***' : '(empty)' });

// --- In-memory lock to prevent concurrent token refreshes ---
// If two requests hit 401 at the same time, only one should refresh.
let refreshPromise = null;


const getAuthBaseUrl = () => (
    EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
);

const getAuthHost = () => (
    EBAY_ENV === 'sandbox' ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com'
);

const getTokenDocRef = (db) => db.doc(EBAY_TOKEN_DOC_PATH);

const requireClientCredentials = () => {
    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
        throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET');
    }
};

const normalizeStoredTokens = (stored) => {
    if (!stored) return null;
    return {
        accessToken: stored.accessToken || stored.access_token || null,
        refreshToken: stored.refreshToken || stored.refresh_token || null,
        accessTokenExpiresAt: stored.accessTokenExpiresAt
            || stored.access_token_expires_at
            || stored.expiresAt
            || stored.expires_at
            || null,
        env: stored.env || null
    };
};

const tokenIsValid = (tokenDoc) => {
    if (!tokenDoc || !tokenDoc.accessToken || !tokenDoc.accessTokenExpiresAt) return false;
    const expiresAt = tokenDoc.accessTokenExpiresAt.toMillis
        ? tokenDoc.accessTokenExpiresAt.toMillis()
        : Number(tokenDoc.accessTokenExpiresAt);
    const bufferMs = 5 * 60 * 1000;
    return Date.now() + bufferMs < expiresAt;
};

const logAxiosError = (error, context) => {
    const status = error.response?.status || null;
    const payload = error.response?.data || null;
    const details = payload ? JSON.stringify(payload) : error.message || String(error);
    logger.error('eBay auth request failed', { ...context, status, details });
};

const saveTokens = async (db, tokens) => {
    const accessTokenExpiresAt = Date.now() + (tokens.expires_in * 1000);
    const tokenData = {
        accessToken: tokens.access_token,
        accessTokenExpiresAt,
        updatedAt: Date.now(),
        env: EBAY_ENV
    };
    if (tokens.refresh_token) {
        tokenData.refreshToken = tokens.refresh_token;
    }
    if (tokens.scope) {
        tokenData.scopes = tokens.scope.split(' ');
    }
    await getTokenDocRef(db).set(tokenData, { merge: true });
};

/**
 * Refresh the eBay access token. Race-safe: if multiple callers trigger
 * a refresh concurrently, they all await the same in-flight promise
 * instead of issuing duplicate refresh requests.
 */
const refreshAccessToken = async (db) => {
    // If a refresh is already in progress, piggyback on it
    if (refreshPromise) {
        logger.debug('eBay token refresh already in progress — waiting');
        return refreshPromise;
    }

    refreshPromise = _doRefresh(db).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
};

const _doRefresh = async (db) => {
    requireClientCredentials();
    const tokenDoc = await getTokenDocRef(db).get();
    const stored = tokenDoc.exists ? normalizeStoredTokens(tokenDoc.data()) : null;
    if (stored?.env && stored.env !== EBAY_ENV) {
        throw new Error(`Stored eBay token env (${stored.env}) does not match EBAY_ENV (${EBAY_ENV})`);
    }
    if (!stored || !stored.refreshToken) {
        throw new Error('Missing eBay refresh token in Firestore — run cliAuth.js to authorize');
    }

    const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', stored.refreshToken);

    let response;
    try {
        response = await axios.post(
            `${getAuthBaseUrl()}/identity/v1/oauth2/token`,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`
                },
                timeout: 15000
            }
        );
    } catch (error) {
        logAxiosError(error, { endpoint: 'refreshAccessToken', method: 'POST' });
        throw error;
    }

    await saveTokens(db, response.data);
    logger.info('eBay token refreshed successfully');
    return response.data.access_token;
};

const getAccessToken = async (db) => {
    const tokenDoc = await getTokenDocRef(db).get();
    const stored = tokenDoc.exists ? normalizeStoredTokens(tokenDoc.data()) : null;
    if (stored?.env && stored.env !== EBAY_ENV) {
        throw new Error(`Stored eBay token env (${stored.env}) does not match EBAY_ENV (${EBAY_ENV})`);
    }
    if (stored && tokenIsValid(stored)) return stored.accessToken;
    return refreshAccessToken(db);
};

const exchangeCodeForTokens = async (db, code) => {
    requireClientCredentials();
    if (!EBAY_REDIRECT_URI) {
        throw new Error('Missing EBAY_REDIRECT_URI');
    }
    const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', EBAY_REDIRECT_URI);

    let response;
    try {
        response = await axios.post(
            `${getAuthBaseUrl()}/identity/v1/oauth2/token`,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`
                }
            }
        );
    } catch (error) {
        logAxiosError(error, { endpoint: 'exchangeCodeForTokens', method: 'POST' });
        throw error;
    }

    await saveTokens(db, response.data);
    return response.data;
};

const buildAuthUrl = (scopes) => {
    if (!EBAY_CLIENT_ID || !EBAY_REDIRECT_URI) {
        throw new Error('Missing EBAY_CLIENT_ID or EBAY_REDIRECT_URI');
    }
    const scopeParam = scopes.map(encodeURIComponent).join('%20');
    const redirectParam = encodeURIComponent(EBAY_REDIRECT_URI);
    return `${getAuthHost()}/oauth2/authorize?client_id=${EBAY_CLIENT_ID}&response_type=code&redirect_uri=${redirectParam}&scope=${scopeParam}`;
};

module.exports = {
    EBAY_ENV,
    EBAY_TOKEN_DOC_PATH,
    getAccessToken,
    refreshAccessToken,
    exchangeCodeForTokens,
    buildAuthUrl,
    getTokenDocRef
};
