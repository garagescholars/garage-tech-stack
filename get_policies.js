const axios = require('axios');
const dotenv = require('dotenv');
const qs = require('qs');

dotenv.config();

const APP_ID = 'GarageSc-GarageSc-PRD-495fabc6f-76bc36b4';
const CERT_ID = 'PRD-95fabc6ff421-d75f-402b-8819-c5f8';
const REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN;

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
        process.exit(1);
    }
}

async function getPolicies() {
    const token = await getAccessToken();
    const marketplaceId = "EBAY_US";
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    console.log("\n🔍 SEARCHING FOR POLICIES...\n");

    try {
        // 1. Get Fulfillment (Shipping)
        const ship = await axios.get(`https://api.ebay.com/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, { headers });
        console.log("🚚 FULFILLMENT POLICIES:");
        ship.data.fulfillmentPolicies.forEach(p => console.log(`   - Name: "${p.name}" | ID: ${p.fulfillmentPolicyId}`));

        // 2. Get Payment
        const pay = await axios.get(`https://api.ebay.com/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, { headers });
        console.log("\n💳 PAYMENT POLICIES:");
        pay.data.paymentPolicies.forEach(p => console.log(`   - Name: "${p.name}" | ID: ${p.paymentPolicyId}`));

        // 3. Get Returns
        const ret = await axios.get(`https://api.ebay.com/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, { headers });
        console.log("\n↩️  RETURN POLICIES:");
        ret.data.returnPolicies.forEach(p => console.log(`   - Name: "${p.name}" | ID: ${p.returnPolicyId}`));

    } catch (error) {
        console.error("❌ Error fetching policies:", error.response?.data || error.message);
    }
}

getPolicies();