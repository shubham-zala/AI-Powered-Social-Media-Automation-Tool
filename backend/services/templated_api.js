const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Ensure output directory exists
const outputDir = path.join(__dirname, '../public/generated');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const renderTemplate = async (templateId, data, layerMap) => {
    const apiKey = process.env.TEMPLATED_API_KEY;
    const apiUrl = 'https://api.templated.io/v1/render';

    // Construct layers based on the map
    const layers = {};
    if (layerMap) {
        for (const [layerName, dataField] of Object.entries(layerMap)) {
            layers[layerName] = { text: data[dataField] || "" };
        }
    } else {
        layers["headline"] = { text: data.title };
        layers["summary"] = { text: data.description || "News Update" };
        layers["source"] = { text: data.source || "Miracles Fintech" };
    }

    try {
        console.log(`Requesting render for Template ID: ${templateId}`);
        const response = await axios.post(apiUrl, {
            template: templateId,
            format: 'png',
            layers: layers
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        const renderUrl = response.data.render_url;
        console.log(`[Templated] Render URL (expires soon): ${renderUrl}`);

        // Download immediately while signed URL is still valid
        // Templated.io signed URLs expire within minutes — we must save locally now.
        // Only pending posts will be on disk; images are deleted after posting.
        // S3 render URL is public — do NOT send Authorization header (causes 400 error)
        const imageResponse = await axios.get(renderUrl, { responseType: 'arraybuffer' });

        const filename = `templated_${Date.now()}.png`;
        const localPath = path.join(outputDir, filename);
        fs.writeFileSync(localPath, imageResponse.data);

        const localUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/generated/${filename}`;
        console.log(`[Templated] Image saved locally: ${localUrl}`);
        return localUrl;

    } catch (error) {
        console.error('Error generating image from Templated.io:', error.message);
        if (error.response) {
            console.error('Templated.io Error Details:', JSON.stringify(error.response.data, null, 2));
            const detail = error.response.data?.error || error.message;
            throw new Error(`Templated.io: ${detail}`);
        }
        throw new Error("Failed to generate image via Templated.io");
    }
};

module.exports = { renderTemplate };
