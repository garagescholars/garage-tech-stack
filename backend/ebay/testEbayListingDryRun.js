/*
Dry-run eBay listing setup: upsert inventory item + create offer (no publish).

1) cd backend
2) node ebay/testEbayListingDryRun.js
*/

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { ebayRequest } = require('./ebayClient');
const { getSetup, EBAY_MARKETPLACE_ID } = require('./ebaySetup');
const { EBAY_ENV } = require('./ebayAuth');

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

const parsePrice = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(String(value).replace(/[^0-9.]/g, ''));
    return Number.isFinite(num) ? num : null;
};

const normalizeCondition = (condition) => {
    const normalized = String(condition || '').toUpperCase();
    if (normalized.includes('NEW')) return 'NEW';
    return 'USED';
};

const conditionToId = (condition) => (condition === 'NEW' ? 1000 : 3000);

const sanitizeSku = (sku) => sku.replace(/[^a-zA-Z0-9_-]/g, '_');

const loadInventoryItem = async () => {
    const inventoryCollection = db.collection('inventory');
    let snap = await inventoryCollection.where('status', '==', 'Pending').limit(1).get();
    if (snap.empty) {
        snap = await inventoryCollection.limit(1).get();
    }
    if (snap.empty) {
        return {
            id: 'fixture_item',
            item: {
                title: 'Garage Scholars Test Item',
                description: 'Test listing for eBay inventory/offer dry run.',
                price: 100,
                condition: 'Used',
                imageUrls: [
                    process.env.EBAY_FALLBACK_IMAGE_URL || 'https://via.placeholder.com/1000'
                ]
            },
            exists: false
        };
    }
    const doc = snap.docs[0];
    return { id: doc.id, item: doc.data(), exists: true };
};

async function runDryRun() {
    const setup = await getSetup(db);
    const merchantLocationKey = setup?.merchantLocationKey || null;
    const paymentPolicyId = setup?.paymentPolicyId || null;
    const fulfillmentPolicyId = setup?.fulfillmentPolicyId || null;
    const returnPolicyId = setup?.returnPolicyId || null;
    const marketplaceId = setup?.marketplaceId || EBAY_MARKETPLACE_ID;

    if (!merchantLocationKey || !paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId) {
        console.error('❌ FAIL: Missing eBay setup (merchantLocationKey or policies). Run bootstrapEbay.js.');
        process.exit(1);
    }

    const { id: inventoryId, item, exists } = await loadInventoryItem();
    const title = item.title || item.name || 'Garage Scholars Item';
    const description = item.description || item.details || title;
    const imageUrls = Array.isArray(item.imageUrls) && item.imageUrls.length > 0
        ? item.imageUrls.slice(0, 2)
        : [process.env.EBAY_FALLBACK_IMAGE_URL || 'https://via.placeholder.com/1000'];
    const condition = normalizeCondition(item.condition);
    const sku = sanitizeSku(item.ebay?.sku || `gs_${inventoryId}`);
    const categoryId = item.ebayCategoryId || process.env.EBAY_DEFAULT_CATEGORY_ID || '11700';
    let price = parsePrice(item.price);
    if (!price) {
        console.warn('⚠️ Missing/invalid price; defaulting to $100.00 for dry run.');
        price = 100;
    }

    const inventoryPayload = {
        availability: { shipToLocationAvailability: { quantity: 1 } },
        product: {
            title,
            description,
            imageUrls
        }
    };

    try {
        await ebayRequest(db, {
            method: 'PUT',
            path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
            data: inventoryPayload
        });
        console.log('✅ Inventory item upserted:', { sku });
    } catch (error) {
        const status = error.response?.status || null;
        const details = error.response?.data ? JSON.stringify(error.response.data) : (error.message || String(error));
        console.error('❌ Inventory upsert failed:', { status, details, inventoryPayload });
        process.exit(2);
    }

    const offerPayload = {
        sku,
        marketplaceId,
        format: 'FIXED_PRICE',
        availableQuantity: 1,
        categoryId,
        conditionId: conditionToId(condition),
        merchantLocationKey,
        listingDescription: description,
        listingPolicies: {
            fulfillmentPolicyId,
            paymentPolicyId,
            returnPolicyId
        },
        pricingSummary: { price: { value: price, currency: 'USD' } }
    };

    let offerId;
    try {
        const offerRes = await ebayRequest(db, {
            method: 'POST',
            path: '/sell/inventory/v1/offer',
            data: offerPayload
        });
        offerId = offerRes.data.offerId;
        console.log('✅ Offer created (dry run, not published):', { offerId });
    } catch (error) {
        const existingOfferId = error.response?.data?.errors?.[0]?.parameters?.find(
            (param) => param.name === 'offerId'
        )?.value;
        if (existingOfferId) {
            offerId = existingOfferId;
            console.warn('⚠️ Offer already exists; reusing offerId:', offerId);
        } else {
            const status = error.response?.status || null;
            const details = error.response?.data ? JSON.stringify(error.response.data) : (error.message || String(error));
            console.error('❌ Offer creation failed:', { status, details, offerPayload });
            process.exit(3);
        }
    }

    const ebayDocRef = db.doc('integrations/ebay');
    await ebayDocRef.set({
        lastDryRunOfferId: offerId,
        lastDryRunSku: sku,
        lastDryRunInventoryId: inventoryId,
        updatedAt: Date.now()
    }, { merge: true });

    if (exists) {
        await db.collection('inventory').doc(inventoryId).set({
            ebay: {
                sku,
                offerId,
                marketplaceId,
                status: 'DRAFT'
            }
        }, { merge: true });
    }

    console.log('✅ Dry run completed. No publish call made.');
}

runDryRun().catch((error) => {
    const status = error.response?.status || null;
    const details = error.response?.data ? JSON.stringify(error.response.data) : (error.message || String(error));
    console.error('❌ Dry run crashed:', { status, details });
    process.exit(4);
});
