/**
 * Proxy Manager for Puppeteer Automation
 *
 * Handles residential proxy rotation for Facebook and Craigslist.
 * Uses proxy-chain to handle authenticated proxies (Puppeteer only
 * natively supports unauthenticated proxies).
 *
 * Supports: Bright Data, Oxylabs, Smartproxy, IPRoyal, or any
 * HTTP/SOCKS5 proxy with user:pass authentication.
 *
 * Configuration via env vars:
 *   PROXY_URL=http://user:pass@proxy.provider.com:port
 *   PROXY_ENABLED=true
 *
 * For sticky sessions (same IP for entire posting flow):
 *   PROXY_STICKY_SESSION=true
 */

const ProxyChain = require('proxy-chain');
const { logger } = require('./logger');

const PROXY_ENABLED = (process.env.PROXY_ENABLED || 'false') === 'true';
const PROXY_URL = process.env.PROXY_URL || '';
const PROXY_STICKY_SESSION = (process.env.PROXY_STICKY_SESSION || 'true') === 'true';

// Track active anonymized proxy URLs so we can close them on shutdown
const activeProxies = new Set();

/**
 * Get a proxy URL for Puppeteer. If the proxy requires authentication,
 * proxy-chain spins up a local intermediary that handles auth transparently.
 *
 * @param {Object} options
 * @param {string} options.sessionId - Unique ID for sticky sessions (e.g., docId)
 * @returns {{ proxyUrl: string|null, cleanup: Function }}
 */
async function getProxy({ sessionId } = {}) {
    if (!PROXY_ENABLED || !PROXY_URL) {
        return { proxyUrl: null, cleanup: () => {} };
    }

    try {
        let url = PROXY_URL;

        // For sticky sessions: append session ID to username
        // Most residential proxy providers support this format:
        //   user-session-abc123:pass@proxy.com:port
        if (PROXY_STICKY_SESSION && sessionId) {
            const parsed = new URL(url);
            if (parsed.username) {
                parsed.username = `${parsed.username}-session-${sessionId}`;
                url = parsed.toString();
            }
        }

        // proxy-chain anonymizes the proxy (strips auth) and returns
        // a local URL that Puppeteer can use directly
        const anonymizedUrl = await ProxyChain.anonymizeProxy(url);
        activeProxies.add(anonymizedUrl);

        logger.info('Proxy configured', {
            provider: new URL(PROXY_URL).hostname,
            sticky: PROXY_STICKY_SESSION,
            sessionId: sessionId || null
        });

        const cleanup = async () => {
            try {
                await ProxyChain.closeAnonymizedProxy(anonymizedUrl, true);
                activeProxies.delete(anonymizedUrl);
            } catch (_) {}
        };

        return { proxyUrl: anonymizedUrl, cleanup };
    } catch (error) {
        logger.error('Failed to configure proxy — running without proxy', {
            error: error.message
        });
        return { proxyUrl: null, cleanup: () => {} };
    }
}

/**
 * Close all active proxy connections (call during shutdown)
 */
async function closeAllProxies() {
    for (const url of activeProxies) {
        try {
            await ProxyChain.closeAnonymizedProxy(url, true);
        } catch (_) {}
    }
    activeProxies.clear();
}

module.exports = { getProxy, closeAllProxies, PROXY_ENABLED };
