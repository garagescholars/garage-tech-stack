const axios = require('axios');
const dotenv = require('dotenv');
const qs = require('qs');

dotenv.config();

const APP_ID = 'GarageSc-GarageSc-PRD-495fabc6f-76bc36b4';
const CERT_ID = 'PRD-95fabc6ff421-d75f-402b-8819-c5f8';
const REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN; 

// --- YOUR SPECIFIC POLICY IDS ---
const FULFILLMENT_ID = "321862361021"; // Shipping//PICKUPONLY
const PAYMENT_ID = "321862356021";     // Payment
const RETURN_ID = "321862391021";      // Returns
const MERCHANT_LOCATION = "GarageScholars_Denver";

async function getAccessToken() {
    const credentials = Buffer.from(`${APP_ID}:${CERT_ID}`).toString('base64');
    try {
        const response = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', 
            qs.stringify({ grant_type: 'refresh_token', refresh_token: REFRESH_TOKEN }), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials}` } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Token Error:", error.response?.data || error.message);
        throw new Error("Failed to refresh eBay token");
    }
}

async function postToEbay(itemData) {
    console.log(`\n🚀 STARTING LIVE LISTING: ${itemData.title}`);
    const token = await getAccessToken();
    const sku = itemData.sku || `GS-${Date.now()}`;
    const headers = { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json', 
        'Content-Language': 'en-US' 
    };

    // 1. CREATE INVENTORY (The Product)
    try {
        await axios.put(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
            availability: { shipToLocationAvailability: { quantity: 1, merchantLocationKey: MERCHANT_LOCATION } },
            condition: 'USED_EXCELLENT',
            product: {
                title: itemData.title,
                description: itemData.description || "No description provided.",
                imageUrls: itemData.images || [], 
                aspects: { 
                    'Brand': [itemData.brand || 'Unbranded'],
                    'MPN': [itemData.mpn || 'Does Not Apply'],
                    'Type': ['Equipment'],
                    'Country/Region of Manufacture': ['United States'] // <--- Added this line
                }
            }
        }, { headers });
        console.log("✅ Step 1: Product Created");
    } catch (err) {
        console.error("❌ Step 1 Failed:", err.response?.data);
        return { success: false, step: 1, error: err.response?.data };
    }

    // 2. CREATE OFFER (The Price & Policies)
    let offerId = "";
    try {
        const offerRes = await axios.post(`https://api.ebay.com/sell/inventory/v1/offer`, {
            sku: sku,
            marketplaceId: "EBAY_US",
            format: "FIXED_PRICE",
            availableQuantity: 1,
            categoryId: "11700", // Default: Home & Garden -> Tools
            listingDescription: itemData.description,
            listingPolicies: {
                fulfillmentPolicyId: FULFILLMENT_ID,
                paymentPolicyId: PAYMENT_ID,
                returnPolicyId: RETURN_ID
            },
            pricingSummary: { price: { value: itemData.price, currency: "USD" } }
        }, { headers });
        
        offerId = offerRes.data.offerId;
        console.log(`✅ Step 2: Offer Created (ID: ${offerId})`);
    } catch (err) {
        console.error("❌ Step 2 Failed:", err.response?.data);
        return { success: false, step: 2, error: err.response?.data };
    }

    // 3. PUBLISH OFFER (Go Live!)
    try {
        const publishRes = await axios.post(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {}, { headers });
        const listingId = publishRes.data.listingId;
        console.log(`🎉 SUCCESS! LISTING IS LIVE!`);
        console.log(`👉 View it here: https://www.ebay.com/itm/${listingId}`);
        
        return { success: true, listingId: listingId, url: `https://www.ebay.com/itm/${listingId}` };
    } catch (err) {
        console.error("❌ Step 3 Failed (Publish):", err.response?.data);
        return { success: false, step: 3, error: err.response?.data };
    }
}

module.exports = { postToEbay };