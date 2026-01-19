const axios = require('axios');
const { getAccessToken, EBAY_ENV } = require('./ebayAuth');

const getApiBaseUrl = () => (
    EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
);

const logAxiosError = (error, context) => {
    const status = error.response?.status || null;
    const payload = error.response?.data || null;
    const details = payload ? JSON.stringify(payload) : error.message || String(error);
    console.error('❌ eBay API request failed:', { ...context, status, details });
};

const ebayRequest = async (db, { method, path, data, headers }) => {
    const token = await getAccessToken(db);
    const url = `${getApiBaseUrl()}${path}`;
    try {
        return await axios({
            method,
            url,
            data,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Language': 'en-US',
                ...(headers || {})
            }
        });
    } catch (error) {
        const requestBody = data ? JSON.stringify(data) : null;
        logAxiosError(error, { method, url, path, requestBody });
        throw error;
    }
};

module.exports = { ebayRequest, getApiBaseUrl };
