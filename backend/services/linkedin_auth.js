const axios = require('axios');
require('dotenv').config();

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/linkedin/callback`;

// Scopes required for posting
const SCOPE = 'openid profile w_member_social email';

function getAuthorizationUrl() {
    const state = Math.random().toString(36).substring(7);
    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scope=${encodeURIComponent(SCOPE)}`;
    return url;
}

async function getAccessToken(code) {
    const url = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    try {
        const response = await axios.post(url, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data; // contains access_token, expires_in
    } catch (error) {
        console.error('Error getting LinkedIn access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getUserProfile(accessToken) {
    try {
        const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data; // contains sub (urn:li:person:...), name, etc.
    } catch (error) {
        console.error('Error getting user profile:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { getAuthorizationUrl, getAccessToken, getUserProfile };
