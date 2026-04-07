const axios = require('axios');
require('dotenv').config();

const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

/**
 * Post an image and caption to the Facebook Page
 * @param {string} message - The caption/text for the post
 * @param {string} imageUrl - The URL of the image to post
 * @returns {Promise<Object>} - Result with success status and id or error
 */
async function postToFacebook(message, imageUrl) {
    if (!FACEBOOK_PAGE_ID || !FACEBOOK_ACCESS_TOKEN) {
        console.error("Facebook credentials missing.");
        return { success: false, error: "Missing Credentials" };
    }

    try {
        console.log(`[Facebook] Fetching Page Access Token for ${FACEBOOK_PAGE_ID}...`);

        // 1. Get Page Access Token
        let pageAccessToken = FACEBOOK_ACCESS_TOKEN; // Fallback to user token
        try {
            const tokenResp = await axios.get(`https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}`, {
                params: {
                    fields: 'access_token',
                    access_token: FACEBOOK_ACCESS_TOKEN
                }
            });
            if (tokenResp.data && tokenResp.data.access_token) {
                pageAccessToken = tokenResp.data.access_token;
                console.log("[Facebook] Successfully retrieved Page Access Token.");
            }
        } catch (tokenErr) {
            console.warn("[Facebook] Warning: Could not fetch Page Token, trying with User Token...", tokenErr.message);
        }

        console.log(`[Facebook] Posting to Page ${FACEBOOK_PAGE_ID}...`);

        // Check if image is local (localhost)
        const backendUrl = process.env.BACKEND_URL || '';
        const isLocal = imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1') || (backendUrl && imageUrl.startsWith(backendUrl));
        if (isLocal) {
            console.log("[Facebook] Detected local image URL. Switching to File Upload...");
            const fs = require('fs');
            const path = require('path');
            const FormData = require('form-data'); // You might need to install this: npm install form-data

            // Resolve local path from URL
            // URL: http://localhost:3000/api/generated/abc.png
            // Path: ../public/generated/abc.png
            const filename = imageUrl.split('/').pop();
            const localPath = path.join(__dirname, '../public/generated', filename);

            if (!fs.existsSync(localPath)) {
                throw new Error(`Local file not found: ${localPath}`);
            }

            const formData = new FormData();
            formData.append('source', fs.createReadStream(localPath));
            formData.append('message', message);
            formData.append('access_token', pageAccessToken);

            const uploadUrl = `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`;

            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            if (response.data && (response.data.id || response.data.post_id)) {
                const postId = response.data.post_id || response.data.id;
                console.log(`[Facebook] Success (Upload)! Post ID: ${postId}`);

                // Fetch the Public CDN URL (full_picture) and Permalink
                try {
                    const picResp = await axios.get(`https://graph.facebook.com/v18.0/${postId}`, {
                        params: {
                            fields: 'full_picture,permalink_url',
                            access_token: pageAccessToken
                        }
                    });
                    if (picResp.data) {
                        const cdnUrl = picResp.data.full_picture;
                        const permalink = picResp.data.permalink_url;
                        console.log(`[Facebook] Retrieved Details - CDN: ${cdnUrl ? 'Yes' : 'No'}, Link: ${permalink}`);
                        return { success: true, id: postId, cdnUrl: cdnUrl, permalink: permalink };
                    }
                } catch (picErr) {
                    console.warn("[Facebook] Warning: Could not retrieve CDN URL/Link:", picErr.message);
                }

                return { success: true, id: postId };
            }

        } else {
            // Original URL-based posting (for production/public URLs)
            const url = `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`;

            const response = await axios.post(url, null, {
                params: {
                    url: imageUrl,
                    message: message,
                    access_token: pageAccessToken
                }
            });

            if (response.data && (response.data.id || response.data.post_id)) {
                const postId = response.data.post_id || response.data.id;
                console.log(`[Facebook] Success! Post ID: ${postId}`);
                return { success: true, id: postId };
            }
        }

        console.warn("[Facebook] API returned unexpected data.");
        return { success: false, error: "Unexpected API response" };

    } catch (error) {
        const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[Facebook] Failed: ${errMsg}`);
        return { success: false, error: errMsg };
    }
}

/**
 * Downloads any image URL (Templated.io, external, etc.) to memory and uploads
 * to Facebook CDN as an unpublished photo. Returns the CDN URL.
 * No disk storage — uses only in-memory buffer.
 */
async function uploadUrlImageForCDN(imageUrl) {
    if (!FACEBOOK_PAGE_ID || !FACEBOOK_ACCESS_TOKEN) {
        throw new Error("Facebook credentials missing.");
    }

    const FormData = require('form-data');

    // Get page access token
    let pageAccessToken = FACEBOOK_ACCESS_TOKEN;
    try {
        const tokenResp = await axios.get(`https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}`, {
            params: { fields: 'access_token', access_token: FACEBOOK_ACCESS_TOKEN }
        });
        if (tokenResp.data && tokenResp.data.access_token) {
            pageAccessToken = tokenResp.data.access_token;
        }
    } catch (e) {
        console.warn("[Facebook CDN] Could not fetch page token, using user token.");
    }

    // Download the image to buffer (in-memory, no disk)
    console.log(`[Facebook CDN] Downloading image to buffer: ${imageUrl}`);
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Upload as FormData buffer
    const formData = new FormData();
    formData.append('source', imageBuffer, { filename: 'image.png', contentType: 'image/png' });
    formData.append('published', 'false');
    formData.append('access_token', pageAccessToken);

    const response = await axios.post(
        `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`,
        formData,
        { headers: { ...formData.getHeaders() } }
    );

    const photoId = response.data.id;
    console.log(`[Facebook CDN] Photo uploaded (unpublished), ID: ${photoId}`);

    // Get the CDN URL
    const picResp = await axios.get(`https://graph.facebook.com/v18.0/${photoId}`, {
        params: { fields: 'images', access_token: pageAccessToken }
    });

    if (picResp.data && picResp.data.images && picResp.data.images.length > 0) {
        const cdnUrl = picResp.data.images[0].source;
        console.log(`[Facebook CDN] CDN URL obtained.`);
        return cdnUrl;
    }

    throw new Error("Could not get CDN URL from Facebook after upload.");
}

// Alias for backward compatibility (local file URLs also handled via buffer now)
const uploadLocalImageForCDN = uploadUrlImageForCDN;

module.exports = { postToFacebook, uploadLocalImageForCDN, uploadUrlImageForCDN };
