const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cache the URN so we don't fetch it on every post
let _cachedPersonUrn = null;

/**
 * Auto-discovers the Person URN using the access token.
 * Tries /v2/me (older) first, then /v2/userinfo (OpenID).
 * Falls back to LINKEDIN_PERSON_URN from .env if both fail.
 */
const getPersonUrn = async () => {
    // Return cached if available
    if (_cachedPersonUrn) return _cachedPersonUrn;

    // Return env var if set
    if (process.env.LINKEDIN_PERSON_URN) {
        _cachedPersonUrn = process.env.LINKEDIN_PERSON_URN;
        return _cachedPersonUrn;
    }

    const token = process.env.LINKEDIN_ACCESS_TOKEN;

    // Try /v2/me (works with w_member_social scope alone)
    try {
        const resp = await axios.get('https://api.linkedin.com/v2/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.data && resp.data.id) {
            _cachedPersonUrn = `urn:li:person:${resp.data.id}`;
            console.log(`[LinkedIn] Auto-discovered Person URN: ${_cachedPersonUrn}`);
            return _cachedPersonUrn;
        }
    } catch (err) {
        console.warn('[LinkedIn] /v2/me failed, trying /v2/userinfo...');
    }

    // Try /v2/userinfo (OpenID Connect - needs openid profile scope)
    try {
        const resp = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.data && resp.data.sub) {
            _cachedPersonUrn = `urn:li:person:${resp.data.sub}`;
            console.log(`[LinkedIn] Auto-discovered Person URN (OpenID): ${_cachedPersonUrn}`);
            return _cachedPersonUrn;
        }
    } catch (err) {
        console.warn('[LinkedIn] /v2/userinfo also failed:', err.response?.data || err.message);
    }

    throw new Error('Could not determine LinkedIn Person URN. Please set LINKEDIN_PERSON_URN in .env');
};

/**
 * Registers an upload with LinkedIn to get an upload URL
 */
const registerUpload = async (personUrn) => {
    try {
        const response = await axios.post(
            'https://api.linkedin.com/v2/assets?action=registerUpload',
            {
                registerUploadRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                    owner: personUrn,
                    serviceRelationships: [
                        {
                            relationshipType: "OWNER",
                            identifier: "urn:li:userGeneratedContent"
                        }
                    ]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const uploadUrl = response.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const asset = response.data.value.asset;
        return { uploadUrl, asset };
    } catch (error) {
        console.error("LinkedIn Register Upload Failed:", error.response?.data || error.message);
        throw new Error(`LinkedIn Register Upload Failed: ${JSON.stringify(error.response?.data || error.message)}`);
    }
};

/**
 * Uploads the image binary to the URL provided by LinkedIn
 */
const uploadImage = async (uploadUrl, imagePath) => {
    try {
        let imageBuffer;

        if (imagePath && imagePath.startsWith('http')) {
            const response = await axios.get(imagePath, { responseType: 'arraybuffer' });
            imageBuffer = response.data;
        } else if (imagePath) {
            let localPath = imagePath;
            if (imagePath.startsWith('/generated/')) {
                localPath = path.join(__dirname, '../public', imagePath);
            } else if (imagePath.includes('localhost:3000')) {
                localPath = path.join(__dirname, '../public', imagePath.replace(/https?:\/\/localhost:\d+/, ''));
            }

            if (fs.existsSync(localPath)) {
                imageBuffer = fs.readFileSync(localPath);
            } else if (fs.existsSync(imagePath)) {
                imageBuffer = fs.readFileSync(imagePath);
            } else {
                throw new Error(`Image not found at path: ${imagePath}`);
            }
        } else {
            throw new Error('No image path provided');
        }

        await axios.put(uploadUrl, imageBuffer, {
            headers: {
                'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'image/jpeg'
            }
        });
        console.log("[LinkedIn] Image uploaded successfully.");
    } catch (error) {
        console.error("LinkedIn Image Upload Failed:", error.response?.data || error.message);
        throw new Error(`LinkedIn Image Upload Failed: ${error.message}`);
    }
};

/**
 * Creates the UGC Post on LinkedIn
 */
const createPost = async (content, assetUrn, personUrn) => {
    try {
        const postData = {
            author: personUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: content
                    },
                    shareMediaCategory: "IMAGE",
                    media: [
                        {
                            status: "READY",
                            description: { text: "Market News" },
                            media: assetUrn,
                            title: { text: "Miracles Fintech Update" }
                        }
                    ]
                }
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        };

        const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
            headers: {
                'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const postId = response.data.id;
        const permalink = `https://www.linkedin.com/feed/update/${postId}`;
        return { success: true, id: postId, permalink };

    } catch (error) {
        console.error("LinkedIn Create Post Failed:", error.response?.data || error.message);
        throw new Error(`LinkedIn Create Post Failed: ${JSON.stringify(error.response?.data || error.message)}`);
    }
};

/**
 * Main function to post to LinkedIn
 */
const postToLinkedIn = async (content, imageUrl) => {
    try {
        if (!process.env.LINKEDIN_ACCESS_TOKEN) {
            throw new Error("Missing LINKEDIN_ACCESS_TOKEN in .env");
        }

        // Auto-discover Person URN if not set
        const personUrn = await getPersonUrn();

        console.log("[LinkedIn] Step 1: Registering Upload...");
        const { uploadUrl, asset } = await registerUpload(personUrn);

        console.log("[LinkedIn] Step 2: Uploading Image...");
        await uploadImage(uploadUrl, imageUrl);

        console.log("[LinkedIn] Step 3: Creating Post...");
        const result = await createPost(content, asset, personUrn);

        console.log(`[LinkedIn] Success! Link: ${result.permalink}`);
        return result;

    } catch (error) {
        console.error("LinkedIn Posting Error:", error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { postToLinkedIn };
