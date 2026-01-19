const { ebayRequest } = require('./ebayClient');
const { getSetup, EBAY_MARKETPLACE_ID } = require('./ebaySetup');

const EBAY_PUBLISH_ENABLED = (process.env.EBAY_PUBLISH_ENABLED || 'false') === 'true';
const DEFAULT_CATEGORY_ID = process.env.EBAY_DEFAULT_CATEGORY_ID || '11700';

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

const sanitizeSku = (sku) => String(sku).replace(/[^a-zA-Z0-9_-]/g, '_');

const formatEbayError = (error) => {
    const payload = error.response?.data || null;
    if (!payload) {
        return {
            message: error.message || String(error),
            code: null,
            rawError: null
        };
    }
    const errors = payload.errors || [];
    const message = errors[0]?.message || 'eBay API error';
    const code = errors[0]?.errorId || errors[0]?.errorCode || null;
    const rawError = JSON.stringify(payload).slice(0, 2000);
    return { message, code, rawError };
};

const upsertInventoryItem = async (db, sku, payload) => {
    return ebayRequest(db, {
        method: 'PUT',
        path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        data: payload
    });
};

const createOffer = async (db, payload) => {
    const response = await ebayRequest(db, {
        method: 'POST',
        path: '/sell/inventory/v1/offer',
        data: payload
    });
    return response.data.offerId;
};

const publishOffer = async (db, offerId) => {
    const response = await ebayRequest(db, {
        method: 'POST',
        path: `/sell/inventory/v1/offer/${offerId}/publish`,
        data: {}
    });
    return response.data.listingId;
};

const runEbayListing = async ({ inventoryId, item, publicTitle, publicDescription, db, admin }) => {
    const setup = await getSetup(db);
    const marketplaceId = setup?.marketplaceId || EBAY_MARKETPLACE_ID;
    const merchantLocationKey = setup?.merchantLocationKey || null;
    const paymentPolicyId = setup?.paymentPolicyId || null;
    const fulfillmentPolicyId = setup?.fulfillmentPolicyId || null;
    const returnPolicyId = setup?.returnPolicyId || null;

    if (!merchantLocationKey || !paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId) {
        return {
            ok: false,
            message: 'Missing eBay setup (merchantLocationKey or policies). Run bootstrapEbay.js.',
            code: 'SETUP_MISSING'
        };
    }

    const sku = sanitizeSku(item.ebay?.sku || `gs_${inventoryId}`);
    const price = parsePrice(item.price);
    if (!price) {
        return { ok: false, message: 'Invalid price for eBay listing', code: 'INVALID_PRICE' };
    }

    const categoryId = item.ebayCategoryId || DEFAULT_CATEGORY_ID;
    if (!item.ebayCategoryId) {
        console.warn(`[EBAY] Using fallback category ${categoryId} for ${inventoryId}`);
    }

    const condition = normalizeCondition(item.condition);
    const description = publicDescription || publicTitle;

    try {
        await upsertInventoryItem(db, sku, {
            availability: { shipToLocationAvailability: { quantity: 1 } },
            product: {
                title: publicTitle,
                description,
                imageUrls: item.imageUrls || []
            }
        });

        let offerId = item.ebay?.offerId || null;
        if (!offerId) {
            try {
                offerId = await createOffer(db, {
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
                });
            } catch (error) {
                const existingOfferId = error.response?.data?.errors?.[0]?.parameters?.find(
                    (param) => param.name === 'offerId'
                )?.value;
                if (existingOfferId) {
                    offerId = existingOfferId;
                } else {
                    throw error;
                }
            }
        }

        let listingId = item.ebay?.listingId || null;
        let status = 'ready_to_publish';
        if (EBAY_PUBLISH_ENABLED) {
            if (item.ebay?.status === 'LIVE' && listingId) {
                status = 'published';
            } else {
                listingId = await publishOffer(db, offerId);
                status = 'published';
            }
        }

        return {
            ok: true,
            sku,
            offerId,
            listingId,
            status,
            inventoryItemId: sku,
            marketplaceId,
            merchantLocationKey,
            paymentPolicyId,
            fulfillmentPolicyId,
            returnPolicyId
        };
    } catch (error) {
        const formatted = formatEbayError(error);
        return {
            ok: false,
            message: formatted.message,
            code: formatted.code,
            rawError: formatted.rawError
        };
    }
};

module.exports = { runEbayListing };
