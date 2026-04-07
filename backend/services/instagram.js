const axios = require('axios');
require('dotenv').config();

const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

/**
 * Post an image and caption to the Instagram Business Account
 * @param {string} caption - The caption for the post (including hashtags)
 * @param {string} imageUrl - The URL of the image to post (must be public)
 * @returns {Promise<Object>} - Result with success status and id or error
 */
async function postToInstagram(caption, imageUrl) {
    if (!INSTAGRAM_ACCOUNT_ID || !FACEBOOK_ACCESS_TOKEN) {
        console.error("Instagram credentials missing.");
        return { success: false, error: "Missing Credentials" };
    }

    try {
        console.log(`[Instagram] Creating media container for ${INSTAGRAM_ACCOUNT_ID}...`);

        // Step 1: Create Media Container
        const containerUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`;
        const containerResponse = await axios.post(containerUrl, null, {
            params: {
                image_url: imageUrl,
                caption: caption,
                access_token: FACEBOOK_ACCESS_TOKEN
            }
        });

        if (!containerResponse.data || !containerResponse.data.id) {
            throw new Error(`Failed to create media container: ${JSON.stringify(containerResponse.data)}`);
        }

        const creationId = containerResponse.data.id;
        console.log(`[Instagram] Media container created: ${creationId}. Polling status...`);

        // Step 2: Poll for Media Status (Max 60 seconds)
        let status = 'IN_PROGRESS';
        let attempts = 0;
        const maxAttempts = 20; // 20 attempts * 3 seconds = 60 seconds

        while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

            try {
                const statusResp = await axios.get(`https://graph.facebook.com/v18.0/${creationId}`, {
                    params: {
                        fields: 'status_code,status',
                        access_token: FACEBOOK_ACCESS_TOKEN
                    }
                });

                status = statusResp.data.status_code || statusResp.data.status;
                console.log(`[Instagram] Container ${creationId} status: ${status} (Attempt ${attempts}/${maxAttempts})`);

                if (status === 'FINISHED') break;
                if (status === 'ERROR') {
                    throw new Error(`Instagram processing error: ${statusResp.data.status_message || 'Unknown error'}`);
                }
            } catch (statusErr) {
                console.warn(`[Instagram] Status poll error: ${statusErr.message}`);
                // Continue polling unless it's a critical failure
            }
        }

        if (status !== 'FINISHED') {
            throw new Error(`Media processing timeout or failed (Final status: ${status})`);
        }

        console.log(`[Instagram] Media ready. Publishing...`);

        // Step 3: Publish Media
        const publishUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`;
        const publishResponse = await axios.post(publishUrl, null, {
            params: {
                creation_id: creationId,
                access_token: FACEBOOK_ACCESS_TOKEN
            }
        });

        if (publishResponse.data && publishResponse.data.id) {
            const mediaId = publishResponse.data.id;
            console.log(`[Instagram] Success! Media ID: ${mediaId}`);

            // Fetch Permalink
            try {
                const mediaResp = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
                    params: {
                        fields: 'permalink,shortcode',
                        access_token: FACEBOOK_ACCESS_TOKEN
                    }
                });
                if (mediaResp.data) {
                    const permalink = mediaResp.data.permalink;
                    console.log(`[Instagram] Retrieved Link: ${permalink}`);
                    return { success: true, id: mediaId, permalink: permalink };
                }
            } catch (mediaErr) {
                console.warn("[Instagram] Warning: Could not retrieve Permalink:", mediaErr.message);
            }

            return { success: true, id: mediaId };
        } else {
            throw new Error(`Failed to publish media: ${JSON.stringify(publishResponse.data)}`);
        }

    } catch (error) {
        const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[Instagram] Failed: ${errMsg}`);
        return { success: false, error: errMsg };
    }
}

module.exports = { postToInstagram };
