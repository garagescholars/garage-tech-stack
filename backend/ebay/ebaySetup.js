const { ebayRequest } = require('./ebayClient');
const { logger } = require('../lib/logger');

const EBAY_SETUP_DOC_PATH = 'integrations/ebay';
const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const DEFAULT_MERCHANT_LOCATION_KEY = process.env.EBAY_MERCHANT_LOCATION_KEY || 'garage_scholars_primary';
const DEFAULT_POLICY_NAMES = {
    payment: process.env.EBAY_PAYMENT_POLICY_NAME || 'Garage Scholars Payment',
    fulfillment: process.env.EBAY_FULFILLMENT_POLICY_NAME || 'Garage Scholars Shipping',
    return: process.env.EBAY_RETURN_POLICY_NAME || 'Garage Scholars Returns'
};
const DEFAULT_CATEGORY_TYPES = [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES', default: true }];

const DEFAULT_LOCATION = {
    addressLine1: process.env.EBAY_LOCATION_ADDRESS_LINE1 || '123 Main St',
    city: process.env.EBAY_LOCATION_CITY || 'Denver',
    stateOrProvince: process.env.EBAY_LOCATION_STATE || 'CO',
    postalCode: process.env.EBAY_LOCATION_POSTAL || '80202',
    country: process.env.EBAY_LOCATION_COUNTRY || 'US'
};

const getSetupDocRef = (db) => db.doc(EBAY_SETUP_DOC_PATH);

const getSetup = async (db) => {
    const snap = await getSetupDocRef(db).get();
    return snap.exists ? snap.data() : null;
};

const cleanData = (data) => Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
);

const saveSetup = async (db, data) => {
    await getSetupDocRef(db).set(cleanData({
        ...data,
        updatedAt: Date.now()
    }), { merge: true });
};

const listLocations = async (db) => {
    const response = await ebayRequest(db, {
        method: 'GET',
        path: '/sell/inventory/v1/location'
    });
    return response.data.locations || [];
};

const pickExistingLocation = (locations) => {
    if (!locations.length) return null;
    const preferred = locations.find((loc) => (
        String(loc.name || '').toLowerCase().includes('garage scholars')
    ));
    return preferred || locations[0];
};

const ensureMerchantLocation = async (db, merchantLocationKey = DEFAULT_MERCHANT_LOCATION_KEY, addressOverride) => {
    const locations = await listLocations(db);
    const existing = locations.find((loc) => loc.merchantLocationKey === merchantLocationKey);
    if (existing) return merchantLocationKey;
    if (locations.length > 0) {
        const fallback = pickExistingLocation(locations);
        logger.warn('Using existing merchant location', { merchantLocationKey: fallback.merchantLocationKey });
        return fallback.merchantLocationKey;
    }
    const address = { ...DEFAULT_LOCATION, ...(addressOverride || {}) };
    try {
        await ebayRequest(db, {
            method: 'PUT',
            path: `/sell/inventory/v1/location/${merchantLocationKey}`,
            data: {
                name: 'Garage Scholars HQ',
                locationTypes: ['WAREHOUSE'],
                location: { address },
                merchantLocationStatus: 'ENABLED'
            }
        });
        return merchantLocationKey;
    } catch (error) {
        const errors = error.response?.data?.errors || [];
        if (errors.find(e => e.errorId === 25803)) {
            return merchantLocationKey;
        }
        throw error;
    }
};

const findPolicyByName = (policies, name) => policies.find((policy) => policy.name === name);

const ensurePaymentPolicy = async (db, marketplaceId, name = DEFAULT_POLICY_NAMES.payment) => {
    const response = await ebayRequest(db, {
        method: 'GET',
        path: `/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`
    });
    const policies = response.data.paymentPolicies || [];
    const existing = findPolicyByName(policies, name);
    if (existing?.paymentPolicyId) return existing.paymentPolicyId;
    if (policies.length > 0) {
        logger.warn('Using existing payment policy', { paymentPolicyId: policies[0].paymentPolicyId });
        return policies[0].paymentPolicyId;
    }

    const createRes = await ebayRequest(db, {
        method: 'POST',
        path: '/sell/account/v1/payment_policy',
        data: {
            name,
            marketplaceId,
            categoryTypes: DEFAULT_CATEGORY_TYPES,
            paymentMethods: [{
                paymentMethodType: 'CREDIT_CARD',
                brands: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'DISCOVER']
            }],
            paymentInstructions: 'Contact us with any questions.'
        }
    });
    return createRes.data.paymentPolicyId;
};

const ensureFulfillmentPolicy = async (db, marketplaceId, name = DEFAULT_POLICY_NAMES.fulfillment) => {
    const response = await ebayRequest(db, {
        method: 'GET',
        path: `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`
    });
    const policies = response.data.fulfillmentPolicies || [];
    const existing = findPolicyByName(policies, name);
    if (existing?.fulfillmentPolicyId) return existing.fulfillmentPolicyId;
    if (policies.length > 0) {
        logger.warn('Using existing fulfillment policy', { fulfillmentPolicyId: policies[0].fulfillmentPolicyId });
        return policies[0].fulfillmentPolicyId;
    }

    const createRes = await ebayRequest(db, {
        method: 'POST',
        path: '/sell/account/v1/fulfillment_policy',
        data: {
            name,
            marketplaceId,
            categoryTypes: DEFAULT_CATEGORY_TYPES,
            handlingTime: { value: 3, unit: 'DAY' },
            shippingOptions: [
                {
                    optionType: 'DOMESTIC',
                    costType: 'FLAT_RATE',
                    shippingServices: [
                        {
                            shippingServiceCode: 'USPSParcel',
                            shippingCost: { value: '0.00', currency: 'USD' }
                        }
                    ]
                }
            ],
            shipToLocations: {
                regionIncluded: [{ regionName: 'US', regionType: 'COUNTRY' }]
            }
        }
    });
    return createRes.data.fulfillmentPolicyId;
};

const ensureReturnPolicy = async (db, marketplaceId, name = DEFAULT_POLICY_NAMES.return) => {
    const response = await ebayRequest(db, {
        method: 'GET',
        path: `/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`
    });
    const policies = response.data.returnPolicies || [];
    const existing = findPolicyByName(policies, name);
    if (existing?.returnPolicyId) return existing.returnPolicyId;
    if (policies.length > 0) {
        logger.warn('Using existing return policy', { returnPolicyId: policies[0].returnPolicyId });
        return policies[0].returnPolicyId;
    }

    const createRes = await ebayRequest(db, {
        method: 'POST',
        path: '/sell/account/v1/return_policy',
        data: {
            name,
            marketplaceId,
            categoryTypes: DEFAULT_CATEGORY_TYPES,
            returnsAccepted: true,
            returnPeriod: { value: 30, unit: 'DAY' },
            returnShippingCostPayer: 'BUYER',
            refundMethod: 'MONEY_BACK'
        }
    });
    return createRes.data.returnPolicyId;
};

const fetchPolicies = async (db, marketplaceId = EBAY_MARKETPLACE_ID) => {
    const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId] = await Promise.all([
        ensureFulfillmentPolicy(db, marketplaceId),
        ensurePaymentPolicy(db, marketplaceId),
        ensureReturnPolicy(db, marketplaceId)
    ]);

    return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
};

module.exports = {
    EBAY_SETUP_DOC_PATH,
    EBAY_MARKETPLACE_ID,
    DEFAULT_MERCHANT_LOCATION_KEY,
    DEFAULT_POLICY_NAMES,
    getSetup,
    saveSetup,
    listLocations,
    ensureMerchantLocation,
    fetchPolicies
};
