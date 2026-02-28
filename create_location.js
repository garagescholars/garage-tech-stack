const axios = require('axios');
const dotenv = require('dotenv');
const qs = require('qs');

dotenv.config();

const APP_ID = 'GarageSc-GarageSc-PRD-495fabc6f-76bc36b4';
const CERT_ID = 'PRD-95fabc6ff421-d75f-402b-8819-c5f8';
const REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN;
// NEW KEY NAME to bypass the cache
const LOCATION_KEY = "GarageScholars_Denver"; 

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

async function createLocation() {
    const token = await getAccessToken();
    console.log(`🏗️ Creating FRESH location: ${LOCATION_KEY}...`);

    try {
        await axios.post(
            `https://api.ebay.com/sell/inventory/v1/location/${LOCATION_KEY}`,
            {
                name: "Garage Scholars HQ",
                location: {
                    address: {
                        addressLine1: "123 Main St",
                        city: "Denver",
                        stateOrProvince: "CO",
                        postalCode: "80202",
                        country: "US" // The critical tag
                    }
                },
                merchantLocationStatus: "ENABLED",
                locationWebUrl: "https://www.garagescholars.com",
                locationInstructions: "Available for pickup in Denver."
            },
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        console.log("✅ SUCCESS! New Location 'GarageScholars_Denver' Created.");
    } catch (error) {
        console.error("❌ Failed:", error.response?.data || error.message);
    }
}

createLocation();