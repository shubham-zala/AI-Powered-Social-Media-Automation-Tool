require('dotenv').config({ path: '../.env' });
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

async function checkTwitter() {
    console.log('--- Twitter Credentials & Media Check ---');
    console.log('API Key:', process.env.TWITTER_API_KEY ? '✅' : '❌');
    console.log('API Secret:', process.env.TWITTER_API_SECRET ? '✅' : '❌');
    console.log('Access Token:', process.env.TWITTER_ACCESS_TOKEN ? '✅' : '❌');
    console.log('Access Secret:', process.env.TWITTER_ACCESS_SECRET ? '✅' : '❌');

    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    try {
        console.log('\n1. Testing Account Connection (v1.1)...');
        const user = await client.v1.verifyCredentials();
        console.log(`✅ Success! Logged in as: @${user.screen_name}`);

        console.log('\n2. Testing v2 API Access...');
        await client.v2.me();
        console.log('✅ Success! v2 API is reachable.');

        console.log('\n3. Testing Media Upload (v1.1)...');
        const imageUrl = 'https://placehold.co/600x400/png?text=Twitter+Test';
        console.log(`Downloading sample image: ${imageUrl}`);
        const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imgResponse.data, 'binary');

        const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/png' });
        console.log('✅ Success! Media Uploaded. ID:', mediaId);

        console.log('\n4. Testing Tweet with Media (v2)...');
        const mediaTweet = await client.v2.tweet({
            text: `Twitter Posting Test with Media - ${new Date().toLocaleString()}`,
            media: { media_ids: [mediaId] }
        });
        console.log('✅ Success! Tweet with media posted. ID:', mediaTweet.data.id);

        console.log('\n5. Testing Long Tweet (280+ characters)...');
        const longText = "This is a test of a very long tweet intended to exceed the standard two hundred and eighty character limit imposed by the X API on certain tiers. We want to see if this triggers the 403 Forbidden error that we have been seeing in the main application flow. " +
            "If this fails with a 403, we know that we need to implement character counting and truncation to stay within the limits. " +
            "Adding more text here to ensure we definitely hit the limit. #Test #TwitterAPI #LongTweet #AutomationCheck #DebuggingSocialMedia #MiraclesFintech #PresidentTrump #SOTU";
        console.log(`Text length: ${longText.length} characters.`);
        try {
            const longTweet = await client.v2.tweet(longText);
            console.log('✅ Success! Long tweet posted. ID:', longTweet.data.id);
        } catch (err) {
            console.error('❌ Long tweet FAILED as expected/suspected:');
            if (err.data) console.error(JSON.stringify(err.data, null, 2));
            else console.error(err.message);
        }

        console.log('\n--- VERIFICATION COMPLETE ---');

    } catch (error) {
        console.error('\n❌ ERROR DETECTED:');
        if (error.data) {
            console.error(JSON.stringify(error.data, null, 2));
        } else {
            console.error(error.message);
        }

        if (error.code === 403) {
            console.log('\n💡 Tip: 403 Forbidden on Media/Posting usually means:');
            console.log('1. Your App does not have "Read and Write" permissions (check Portal).');
            console.log('2. You are on the "Free" tier which blocks media uploads/v2 posting.');
            console.log('3. Your App is currently suspended or restricted.');
        }
    }
}

checkTwitter();
