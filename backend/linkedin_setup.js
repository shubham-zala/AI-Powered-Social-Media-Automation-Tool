/**
 * LinkedIn Auth & Test Script
 * This script:
 * 1. Gets a fresh LinkedIn auth URL
 * 2. Waits for you to paste the code from the callback URL
 * 3. Exchanges the code for a token
 * 4. Auto-updates your .env file
 * 5. Tests posting to LinkedIn
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/linkedin/callback`;
const ENV_FILE = path.join(__dirname, '.env');

// Step 1: Generate auth URL
const state = Math.random().toString(36).substring(7);
const SCOPE = 'openid profile w_member_social email';
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scope=${encodeURIComponent(SCOPE)}`;

// Step 2: Update the .env file
function updateEnvFile(key, value) {
    let content = fs.readFileSync(ENV_FILE, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
    } else {
        content += `\n${key}=${value}`;
    }
    fs.writeFileSync(ENV_FILE, content);
    console.log(`✅ Updated .env: ${key}=...`);
}

// Step 3: Exchange code for token
async function exchangeCode(code) {
    const url = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code.trim());
    params.append('redirect_uri', REDIRECT_URI);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
}

// Step 4: Get Person URN
async function getPersonUrn(token) {
    // Try /v2/me first
    try {
        const resp = await axios.get('https://api.linkedin.com/v2/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.data && resp.data.id) {
            return `urn:li:person:${resp.data.id}`;
        }
    } catch (e) { }

    // Try /v2/userinfo (OpenID)
    try {
        const resp = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.data && resp.data.sub) {
            return `urn:li:person:${resp.data.sub}`;
        }
    } catch (e) { }

    return null;
}

// Step 5: Test post
async function testPost(token, personUrn) {
    console.log('\n[TEST] Registering image upload...');
    const registerResp = await axios.post(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
            registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: personUrn,
                serviceRelationships: [{
                    relationshipType: "OWNER",
                    identifier: "urn:li:userGeneratedContent"
                }]
            }
        },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const uploadUrl = registerResp.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerResp.data.value.asset;

    console.log('[TEST] Uploading test image...');
    // Download a tiny test image
    const testImageResp = await axios.get('https://templated-assets.s3.amazonaws.com/public/placeholder-square.jpg', { responseType: 'arraybuffer' });
    await axios.put(uploadUrl, testImageResp.data, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg' }
    });

    console.log('[TEST] Creating LinkedIn post...');
    const postResp = await axios.post('https://api.linkedin.com/v2/ugcPosts', {
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
            "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: "✅ Test post from Miracles Fintech Social Media Automation! LinkedIn integration is working! #MiraclesFintech #MarketNews" },
                shareMediaCategory: "IMAGE",
                media: [{ status: "READY", description: { text: "Market News" }, media: asset, title: { text: "Test Post" } }]
            }
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
    }, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    const permalink = `https://www.linkedin.com/feed/update/${postResp.data.id}`;
    console.log(`\n✅✅✅ POST SUCCESSFUL! View it here:\n${permalink}\n`);
    return permalink;
}

// Main Flow
async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n=== LinkedIn Auth & Test Script ===\n');
    console.log('STEP 1: Open this URL in your browser (you may need to login):');
    console.log('\n' + authUrl + '\n');
    console.log('STEP 2: After LinkedIn redirects you back, copy the entire callback URL.');
    console.log('        It will look like: http://localhost:3000/api/auth/linkedin/callback?code=AQS...\n');

    const callbackUrl = await ask('Paste the full callback URL here: ');
    rl.close();

    // Extract code from URL
    const urlMatch = callbackUrl.match(/[?&]code=([^&]+)/);
    if (!urlMatch) {
        console.error('ERROR: Could not find "code=" in the URL you pasted.');
        process.exit(1);
    }
    const code = urlMatch[1];
    console.log('\n✅ Code extracted. Exchanging for access token...');

    try {
        const token = await exchangeCode(code);
        console.log('✅ Access Token obtained!');

        // Update .env
        updateEnvFile('LINKEDIN_ACCESS_TOKEN', token);

        console.log('\nFetching your Person URN...');
        const personUrn = await getPersonUrn(token);
        if (personUrn) {
            console.log('✅ Person URN:', personUrn);
            updateEnvFile('LINKEDIN_PERSON_URN', personUrn);
        } else {
            console.log('⚠️  Could not auto-fetch URN. Proceeding with test anyway...');
        }

        console.log('\nRunning LinkedIn post test...');
        await testPost(token, personUrn);

        console.log('\n=== ALL DONE! ===');
        console.log('Your .env has been updated. Restart the server with: node index.js');

    } catch (err) {
        console.error('\nERROR:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
        process.exit(1);
    }
}

main();
