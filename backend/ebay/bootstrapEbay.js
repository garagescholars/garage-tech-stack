/*
Bootstrap eBay setup data (merchant location + business policies).

1) node backend/ebay/bootstrapEbay.js
*/

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const {
    ensureMerchantLocation,
    fetchPolicies,
    saveSetup,
    getSetup,
    EBAY_MARKETPLACE_ID,
    DEFAULT_MERCHANT_LOCATION_KEY
} = require('./ebaySetup');
const { EBAY_ENV, getAccessToken } = require('./ebayAuth');

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
    console.error('❌ FAIL: Missing GCLOUD_PROJECT or FIREBASE_PROJECT_ID in backend/.env');
    process.exit(1);
}
const credentialsPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service-account.json')
);
if (!fs.existsSync(credentialsPath)) {
    console.error(`❌ FAIL: Service account not found at ${credentialsPath}`);
    process.exit(1);
}
if (EBAY_ENV !== 'production') {
    console.error(`❌ FAIL: EBAY_ENV must be "production" (current: ${EBAY_ENV})`);
    process.exit(1);
}

if (!admin.apps.length) {
    const serviceAccount = require(credentialsPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId
    });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function bootstrap() {
    await getAccessToken(db);
    const existingSetup = await getSetup(db);
    const merchantLocationKey = await ensureMerchantLocation(
        db,
        DEFAULT_MERCHANT_LOCATION_KEY,
        existingSetup?.locationAddress
    );
    const policies = await fetchPolicies(db, EBAY_MARKETPLACE_ID);

    await saveSetup(db, {
        merchantLocationKey,
        paymentPolicyId: policies.paymentPolicyId,
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        returnPolicyId: policies.returnPolicyId,
        marketplaceId: EBAY_MARKETPLACE_ID,
        ebayEnv: EBAY_ENV
    });

    console.log('✅ eBay setup stored:', {
        merchantLocationKey,
        marketplaceId: EBAY_MARKETPLACE_ID,
        ...policies
    });
}

bootstrap().catch((error) => {
    const status = error.response?.status || null;
    const details = error.response?.data ? JSON.stringify(error.response.data) : (error.message || String(error));
    console.error('❌ Bootstrap failed:', { status, details });
    process.exit(1);
});
