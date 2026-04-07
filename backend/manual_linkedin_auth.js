const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // Ensure .env is loaded

const code = "AQSBFLCAyUhY43SfETiO8LdA9NUqm5BVxuEp025X7QpcY8JtbulxRz-TS-z_WSiCNL2gS66qSXCr0RXIXek8Pquk-MQYsVjCxx3psCuK49R1cnhx0Yn2GmHOABmKk_85aTXhJ7Sy6uAhwccc6JvwW5VA_P8Kb3O6fpUS7DT-kwolWw5b27tPVW0l_fV3aikwxPZLCIcJ6RQBZzjM-G0";
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/linkedin/callback`;

console.log("--- Starting Manual Auth ---");
console.log("Client ID:", CLIENT_ID ? "Present" : "Missing");
console.log("Client Secret:", CLIENT_SECRET ? "Present" : "Missing");
console.log("Redirect URI:", REDIRECT_URI);

async function exchange() {
    console.log("Exchanging code for token...");

    const url = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    try {
        const response = await axios.post(url, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = response.data.access_token;
        console.log("\nSuccess! Access Token obtained.");
        console.log("LINKEDIN_ACCESS_TOKEN=" + accessToken);

        console.log("\nFetching User Profile...");
        try {
            const profileResp = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            console.log("Profile Data:", JSON.stringify(profileResp.data, null, 2));
            const personUrn = profileResp.data.sub;
            console.log("\nLINKEDIN_PERSON_URN=" + personUrn);

        } catch (profileErr) {
            console.error("\nProfile Fetch Error:", profileErr.response ? JSON.stringify(profileErr.response.data, null, 2) : profileErr.message);
            console.log("Note: Even if profile fetch fails, try using the Access Token. The URN might be 'urn:li:person:<ID>' where ID is from the profile URL or another source.");
        }

    } catch (error) {
        console.error("\nToken Exchange Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

exchange();
