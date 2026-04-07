require('dotenv').config({ path: '../.env' });
const axios = require('axios');

async function checkMetaToken() {
    let results = '--- Meta (Facebook & Instagram) Token Check ---\n';
    console.log('--- Meta (Facebook & Instagram) Token Check ---');

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const userToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!appId || !appSecret || !userToken) {
        console.error('❌ Error: Missing FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, or FACEBOOK_ACCESS_TOKEN in .env');
        return;
    }

    // A Facebook App Access Token is usually AppID|AppSecret
    const appAccessToken = `${appId}|${appSecret}`;

    try {
        const msg = '\nConnecting to Meta Graph API to debug token...';
        console.log(msg);
        results += msg + '\n';

        const response = await axios.get('https://graph.facebook.com/debug_token', {
            params: {
                input_token: userToken,
                access_token: appAccessToken
            }
        });

        const data = response.data.data;

        const detailMsg = `\n✅ Token Details found:\n---------------------------\nApp ID: ${data.app_id}\nType: ${data.type}\nApplication: ${data.application}\nIs Valid: ${data.is_valid ? 'YES ✅' : 'NO ❌'}\n`;
        console.log(detailMsg);
        results += detailMsg;

        if (data.expires_at === 0) {
            const expiryMsg = 'Expires At: Never (Permanent Token) ♾️\n';
            console.log(expiryMsg);
            results += expiryMsg;
        } else {
            const expiryDate = new Date(data.expires_at * 1000);
            const now = new Date();
            const daysLeft = Math.round((expiryDate - now) / (1000 * 60 * 60 * 24));

            const expiryMsg = `Expires At: ${expiryDate.toLocaleString()}\nDays Remaining: ${daysLeft > 0 ? `${daysLeft} days` : 'EXPIRED ❌'}\n`;
            console.log(expiryMsg);
            results += expiryMsg;
        }

        const scopeMsg = `\nPermissions granted:\n${data.scopes.join(', ')}\n`;
        console.log(scopeMsg);
        results += scopeMsg;

        if (!data.scopes.includes('pages_manage_posts') && !data.scopes.includes('instagram_basic')) {
            const warnMsg = '\n⚠️  Warning: Token might be missing required posting permissions (pages_manage_posts, instagram_content_publish).\n';
            console.warn(warnMsg);
            results += warnMsg;
        }

        // Additional check for Instagram Account ID if present
        if (process.env.INSTAGRAM_ACCOUNT_ID) {
            const igMsg = `\nInstagram ID Check:\nFound ID: ${process.env.INSTAGRAM_ACCOUNT_ID}\n`;
            console.log(igMsg);
            results += igMsg;
        }

    } catch (error) {
        let errorMsg = '❌ Meta API Error:\n';
        if (error.response && error.response.data) {
            errorMsg += JSON.stringify(error.response.data, null, 2);
        } else {
            errorMsg += error.message;
        }
        console.error(errorMsg);
        results += errorMsg + '\n';
    }

    const fs = require('fs');
    fs.writeFileSync('meta_check_output.txt', results, 'utf8');
    console.log('\nResults saved to meta_check_output.txt');
}

checkMetaToken();
