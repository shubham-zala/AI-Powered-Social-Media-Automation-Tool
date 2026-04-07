const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Usage: node get_permanent_token.js <SHORT_LIVED_USER_TOKEN>
const SHORT_LIVED_TOKEN = process.argv[2];

if (!SHORT_LIVED_TOKEN) {
    console.error("❌ Please provide a Short-Lived User Token as an argument.");
    console.log("Usage: node get_permanent_token.js <YOUR_SHORT_LIVED_TOKEN>");
    process.exit(1);
}

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
    console.error("❌ Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET in .env");
    process.exit(1);
}

async function getPermanentToken() {
    try {
        console.log("🔄 Exchanging Short-Lived Token for Long-Lived User Token...");

        // 1. Get Long-Lived User Token
        const userTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`;

        const userResp = await axios.get(userTokenUrl);
        const longLivedUserToken = userResp.data.access_token;
        console.log("✅ Got Long-Lived User Token: ", longLivedUserToken); // PRINT IT!

        // 1.2 Check User Profile
        const meResp = await axios.get(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${longLivedUserToken}`);
        console.log("👤 User Profile:", meResp.data);

        // 1.5 Check Permissions
        const permissionsUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${longLivedUserToken}`;
        const permResp = await axios.get(permissionsUrl);
        console.log("🔎 Token Permissions:", permResp.data.data.filter(p => p.status === 'granted').map(p => p.permission).join(', '));

        // 2. Get Long-Lived Page Token (This is what we need for the .env)
        console.log("🔄 Fetching Accounts/Pages...");
        const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedUserToken}`;
        const accountsResp = await axios.get(accountsUrl);

        if (accountsResp.data.data.length === 0) {
            console.error("❌ No Pages found for this user.");
            return;
        }

        console.log("\n🎉 FOUND PAGES & PERMANENT TOKENS:\n");
        accountsResp.data.data.forEach(page => {
            console.log(`Page Name: ${page.name}`);
            console.log(`Page ID:   ${page.id}`);
            console.log(`Permanent Access Token: ${page.access_token}`);
            console.log("---------------------------------------------------");
        });

        console.log("\n👉 ACTION REQUIRED: Copy the 'Permanent Access Token' above and update FACEBOOK_ACCESS_TOKEN in your .env file.");

    } catch (error) {
        console.error("❌ Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

getPermanentToken();
