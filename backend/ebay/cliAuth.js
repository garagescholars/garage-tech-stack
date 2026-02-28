/*
Run this once to authorize and store eBay tokens in Firestore.

1) node backend/ebay/cliAuth.js
2) Visit the printed URL, approve, and paste the "code" parameter back here.
*/
require('dotenv').config();

const path = require('path');
const readline = require('readline');
const admin = require('firebase-admin');
const { buildAuthUrl, exchangeCodeForTokens } = require('./ebayAuth');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account'
];

const authUrl = buildAuthUrl(scopes);
console.log('\nAuthorize this app by visiting:\n');
console.log(authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('\nPaste the "code" parameter from the redirect URL: ', async (code) => {
    try {
        await exchangeCodeForTokens(db, code.trim());
        console.log('✅ Tokens stored in Firestore.');
    } catch (error) {
        console.error('❌ Failed to exchange code:', error.message || error);
    } finally {
        rl.close();
    }
});
