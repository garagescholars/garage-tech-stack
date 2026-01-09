const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- YOUR EBAY KEYS ---
const APP_ID = 'GarageSc-GarageSc-PRD-495fabc6f-76bc36b4';
const CERT_ID = 'PRD-95fabc6ff421-d75f-402b-8819-c5f8';
const RU_NAME = 'Garage_Scholars-GarageSc-Garage-jmjsbsfd'; 

// If this RU_NAME fails, we will need to confirm it in your portal. 
// Usually, it is: "Your_App_ID-Redirect-URL" or defined in the "User Tokens" tab.

// 1. GENERATE THE LOGIN URL
const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
].join(' ');

const loginUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${APP_ID}&response_type=code&redirect_uri=${RU_NAME}&scope=${scopes}`;

console.log('\n=== EBAY AUTHORIZATION ===');
console.log('1. Click this link (or paste into browser):');
console.log(loginUrl);
console.log('\n2. Sign in and click "Agree".');
console.log('3. You will see a "Page Not Found" or "Success" page.');
console.log('4. COPY the URL of that page and paste it below:');

// 2. LISTEN FOR USER INPUT
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('\nPaste the full URL here: ', async (redirectUrl) => {
    try {
        // Extract the "code" from the URL
        const codeMatch = redirectUrl.match(/code=([^&]+)/);
        if (!codeMatch) {
            console.error("Error: Could not find 'code' in that URL.");
            process.exit(1);
        }
        const authCode = decodeURIComponent(codeMatch[1]);

        console.log('\nTrading code for token...');

        // 3. EXCHANGE CODE FOR TOKEN
        const credentials = Buffer.from(`${APP_ID}:${CERT_ID}`).toString('base64');
        
        const response = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', 
            `grant_type=authorization_code&code=${authCode}&redirect_uri=${RU_NAME}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`
                }
            }
        );

        const refreshToken = response.data.refresh_token;
        console.log('\nSUCCESS! Here is your Refresh Token (Save this!):');
        console.log('---------------------------------------------------');
        console.log(refreshToken);
        console.log('---------------------------------------------------');
        
        // SAVE TO FILE
        fs.writeFileSync('.env', `EBAY_REFRESH_TOKEN=${refreshToken}\n`, { flag: 'a' });
        console.log('I also appended it to your .env file automatically.');

    } catch (error) {
        console.error('FAILED:', error.response ? error.response.data : error.message);
        if (error.response && error.response.data.error_description) {
            console.error('Reason:', error.response.data.error_description);
            console.log('\nTIP: Use the "User Tokens" tab in Developer Portal to check your "RuName" (Redirect URL) if that was the issue.');
        }
    }
    readline.close();
});