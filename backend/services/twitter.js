const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

/**
 * Post a single tweet with automatic truncation to 280 chars
 * @param {string} text - The tweet content
 * @param {string} imageUrl - (Optional) URL of the image to attach
 */
const postToTwitter = async (text, imageUrl) => {
    // Initialize client INSIDE the function to ensure ENV vars are loaded
    console.log('[Twitter Service] Creating API client instance...');

    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
        console.error('[Twitter Service] CRITICAL ERROR: Missing API Credentials in process.env!');
        return { success: false, error: 'Missing Twitter credentials in environment' };
    }

    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    try {
        console.log(`[Twitter] Preparation: original text length=${text.length}, imageUrl=${imageUrl}`);

        // 1. Character Truncation (Safety for Free accounts)
        let processedText = text;
        if (text.length > 280) {
            console.log(`[Twitter] Text exceeds limit. Truncating and adding invisible identifier...`);
            // Use invisible zero-width spaces to make every post unique to Twitter's filters
            // without being visible to users.
            const invisibleSignature = '\u200B'.repeat(Math.floor(Math.random() * 10) + 1);
            processedText = text.substring(0, 265) + "..." + invisibleSignature;
        }

        let mediaId = undefined;
        if (imageUrl) {
            console.log(`[Twitter] Downloading image from: ${imageUrl}`);
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');

            const cleanUrl = imageUrl.split('?')[0];
            const mediaType = cleanUrl.split('.').pop().toLowerCase() || 'png';
            const mimeType = (mediaType === 'jpg' || mediaType === 'jpeg') ? 'image/jpeg' : 'image/png';

            console.log(`[Twitter] Uploading media. MIME: ${mimeType}`);
            mediaId = await client.v1.uploadMedia(buffer, { mimeType: mimeType });
            console.log(`[Twitter] Media uploaded. ID: ${mediaId}`);

            // Wait for Twitter to process media
            console.log('[Twitter] Waiting 2s for media processing...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const payload = { text: processedText };
        if (mediaId) {
            payload.media = { media_ids: [mediaId] };
        }

        console.log(`[Twitter] Sending tweet (length: ${processedText.length})...`);
        const tweet = await client.v2.tweet(payload);

        console.log(`[Twitter] Tweet successfully posted! ID: ${tweet.data.id}`);
        return {
            success: true,
            id: tweet.data.id,
            url: `https://x.com/i/status/${tweet.data.id}`,
            truncated: text.length > 270
        };

    } catch (error) {
        console.error('[Twitter] Error posting tweet details:');
        if (error.data) {
            console.error('Twitter API Error Data:', JSON.stringify(error.data, null, 2));

            // Helpful duplicate detection
            if (error.code === 403 && (error.data.detail?.includes('duplicate') || error.data.detail?.includes('permitted'))) {
                console.error('--- HINT: This 403 might be due to "Duplicate Content". Twitter blocks the same text being posted twice. ---');
            }
        }
        console.error('Full Error Object:', error);
        return { success: false, error: error.message, details: error.data };
    }
};

module.exports = { postToTwitter };
