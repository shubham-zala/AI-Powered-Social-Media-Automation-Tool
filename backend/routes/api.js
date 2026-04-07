const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { authorize } = require('../middleware/auth');
const { fetchFeed } = require('../services/rss');
const { scrapeContent } = require('../services/scraper');
const { generateContent, analyzeContentBulk, regenerateFields, getQuotaStatus, trackUsage } = require('../services/gemini');

// Global Fetch State for UI progress tracking
let fetchState = {
    isFetching: false,
    message: '',
    progress: 0,
    total: 0
};

const updateFetchState = (isFetching, message, progress = 0, total = 0) => {
    fetchState = { isFetching, message, progress, total };
    console.log(`[FetchState] ${isFetching ? 'BUSY' : 'IDLE'}${message ? ': ' + message : ''}`);
};

// Get Quota Status
router.get('/quota', (req, res) => {
    res.json(getQuotaStatus());
});

// Fetch status endpoint for long-polling/UI updates
router.get('/fetch/status', (req, res) => {
    res.json(fetchState);
});

// Fetch & Generate New Posts
router.post('/fetch', authorize('admin', 'user'), async (req, res) => {
    const body = req.body || {};
    const { sourceId } = body;

    try {
        let query = 'SELECT * FROM sources WHERE is_active = true';
        let params = [];
        if (sourceId) {
            query += ' AND id = $1';
            params.push(sourceId);
        }

        const sources = await pool.query(query, params);
        let newPostsCount = 0;

        updateFetchState(true, `Starting fetch from ${sources.rows.length} sources...`);

        for (const source of sources.rows) {
            if (source.type === 'rss') {
                updateFetchState(true, `Connecting to ${source.name}...`);

                // 1. Get top 10 items
                const allItems = await fetchFeed(source.url);
                const itemsToAnalyze = allItems.slice(0, 10);

                if (itemsToAnalyze.length === 0) continue;

                updateFetchState(true, `Analyzing ${itemsToAnalyze.length} headlines from ${source.name}...`);

                // 2. Bulk Analyze (1 API Call)
                let analysisResults = [];
                try {
                    analysisResults = await analyzeContentBulk(itemsToAnalyze);
                } catch (err) {
                    console.error("Bulk analysis failed:", err);
                    continue; // Skip source on failure
                }

                // 3. Filter "Winners" (Score >= 7)
                const relevantItems = analysisResults.filter(r => r.relevance_score >= 7);
                console.log(`[Batch] Found ${relevantItems.length} relevant items (Score >= 7).`);

                if (relevantItems.length > 0) {
                    updateFetchState(true, `Found ${relevantItems.length} relevant news items from ${source.name}. Processing...`);
                } else {
                    updateFetchState(true, `No relevant items found in ${source.name}. Moving to next source...`);
                }

                // 4. Process Winners One-by-One (Generation)
                for (let i = 0; i < relevantItems.length; i++) {
                    const analysis = relevantItems[i];
                    // Find original item by index (more reliable than URL matching)
                    const itemIndex = (analysis.item_index || 1) - 1;
                    const originalItem = itemsToAnalyze[itemIndex];
                    if (!originalItem) {
                        console.warn(`[Batch] Could not resolve item_index=${analysis.item_index}, skipping.`);
                        continue;
                    }

                    // Duplicate Check
                    const exists = await pool.query('SELECT 1 FROM posts WHERE original_link = $1', [originalItem.link]);
                    if (exists.rowCount > 0) {
                        console.log(`[Batch] Skipping (already exists in DB): ${originalItem.title}`);
                        continue;
                    }

                    updateFetchState(true, `Generating AI post: "${originalItem.title.substring(0, 30)}..."`, i + 1, relevantItems.length);

                    // Scrape (Optional)
                    let fullContent = originalItem.contentSnippet || originalItem.content || '';
                    try {
                        const scraped = await scrapeContent(originalItem.link);
                        if (scraped && scraped.content) fullContent = scraped.content;
                    } catch (e) {
                        console.error(`Scrape failed: ${e.message}`);
                    }

                    try {
                        // Generate Post (1 API Call)
                        trackUsage(1);
                        const aiContent = await generateContent(originalItem.title, fullContent);

                        // Image generated on-demand only (user clicks 'Change Style' in Approval Queue)
                        // Saves Templated.io API credits — placeholder shown until user selects a template
                        let imageUrl = null;

                        // Save to DB
                        await pool.query(
                            `INSERT INTO posts 
                            (source_id, original_title, generated_title, generated_description, generated_content, hashtags, image_url, original_content, original_link, ai_summary, relevance_score, status, posted_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW())`,
                            [
                                source.id,
                                originalItem.title,
                                aiContent.title,
                                aiContent.description,
                                aiContent.content,
                                aiContent.hashtags,
                                imageUrl,
                                fullContent,
                                originalItem.link,
                                analysis.reason,
                                analysis.relevance_score
                            ]
                        );
                        newPostsCount++;

                        // Brief delay between Generations to be safe
                        await new Promise(resolve => setTimeout(resolve, 1500));

                    } catch (genErr) {
                        console.error(`Generation failed for ${originalItem.title}:`, genErr);
                    }
                }
            }
        }

        updateFetchState(false, `Completed! Added ${newPostsCount} new posts.`);
        res.json({ message: `Fetched ${newPostsCount} new posts.` });
    } catch (err) {
        console.error(err);
        updateFetchState(false, `Error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});
const { postToTwitter } = require('../services/twitter');
const { postToFacebook, uploadLocalImageForCDN, uploadUrlImageForCDN } = require('../services/facebook');
const { postToInstagram } = require('../services/instagram');
const { postToLinkedIn } = require('../services/linkedin');

// --- Templates & Image Gen Services ---
const templates = require('../data/templates.json');
const { renderTemplate } = require('../services/templated_api');
const path = require('path');

// Serve generated images statically
router.use('/generated', express.static(path.join(__dirname, '../public/generated')));

// --- Sources ---
router.get('/sources', authorize('admin', 'user'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sources ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/sources', authorize('admin', 'user'), async (req, res) => {
    const { name, url, type } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO sources (name, url, type) VALUES ($1, $2, $3) RETURNING *',
            [name, url, type || 'rss']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/sources/:id', authorize('admin', 'user'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete associated posts first
        await client.query('DELETE FROM posts WHERE source_id = $1', [req.params.id]);

        // Delete the source
        await client.query('DELETE FROM sources WHERE id = $1', [req.params.id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.put('/sources/:id/toggle', authorize('admin', 'user'), async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE sources SET is_active = NOT is_active WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Source Health Check ---
router.get('/sources/health', authorize('admin', 'user'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sources WHERE is_active = true ORDER BY id');
        const sources = result.rows;

        const Parser = require('rss-parser');
        const parser = new Parser({ timeout: 10000 });

        const healthChecks = await Promise.all(sources.map(async (source) => {
            if (source.type !== 'rss') {
                return { id: source.id, status: 'ok', message: 'Non-RSS source' };
            }
            try {
                await parser.parseURL(source.url);
                return { id: source.id, status: 'ok', message: 'Feed is reachable' };
            } catch (err) {
                return { id: source.id, status: 'error', message: err.message || 'Unreachable' };
            }
        }));

        res.json(healthChecks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Fetch & Generate ---

router.post('/fetch', async (req, res) => {
    const body = req.body || {};
    const { sourceId } = body;
    try {
        // 1. Get Settings for Keywords/Filters (optional, skipping for now)

        // 2. Get Sources
        let query = 'SELECT * FROM sources WHERE is_active = TRUE';
        let params = [];

        if (sourceId) {
            query = 'SELECT * FROM sources WHERE id = $1';
            params = [sourceId];
        }

        const sources = await pool.query(query, params);

        let newPostsCount = 0;

        for (const source of sources.rows) {
            if (source.type === 'rss') {
                // Limit to 10 most recent items to save API quota
                const items = (await fetchFeed(source.url)).slice(0, 10);

                // Helper for concurrency control
                const processItem = async (item) => {
                    try {
                        // Check if link exists
                        const exists = await pool.query('SELECT 1 FROM posts WHERE original_link = $1', [item.link]);
                        if (exists.rowCount > 0) return;

                        // Analyze Relevance using Snippet first (Faster)
                        const initialContent = item.contentSnippet || item.content || '';
                        const analysis = await analyzeContent(item.title, initialContent);

                        if (!analysis.is_relevant && analysis.relevance_score < 6) {
                            console.log(`Skipping: ${item.title} (Score: ${analysis.relevance_score})`);
                            return;
                        }

                        // Scrape full content ONLY for relevant items
                        console.log(`Create content for relevant item: ${item.title}`);
                        let fullContent = initialContent;
                        try {
                            const scraped = await scrapeContent(item.link);
                            if (scraped && scraped.content) {
                                fullContent = scraped.content;
                            }
                        } catch (scrapeErr) {
                            console.error(`Scrape failed for ${item.link}, using snippet.`);
                        }

                        // Generate AI Content (Tweets/Linkedin)
                        const aiContent = await generateContent(item.title, fullContent);

                        // Image generated on-demand only (user clicks 'Change Style')
                        let imageUrl = null;

                        // Save to DB
                        await pool.query(
                            `INSERT INTO posts 
                (source_id, original_title, original_link, original_content, ai_summary, relevance_score, generated_title, generated_description, generated_content, hashtags, image_url, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')`,
                            [source.id, item.title, item.link, fullContent, analysis.summary, analysis.relevance_score, aiContent.title, aiContent.description, aiContent.content, aiContent.hashtags, imageUrl]
                        );

                        newPostsCount++;
                    } catch (e) {
                        console.error(`Error processing item ${item.title}:`, e.message);
                    }
                };

                // Batch processing with concurrency limit of 1 (Strict Serial)
                const BATCH_SIZE = 1;
                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batch = items.slice(i, i + BATCH_SIZE);
                    console.log(`Processing Item ${i + 1}/${items.length}...`);

                    await Promise.all(batch.map(processItem));

                    // Delay 3.5 seconds to leverage Gemma's 30 RPM limit
                    // (3.5s delay + ~1.5s process = 5s/item -> 12 items/min -> 24 req/min)
                    if (i + BATCH_SIZE < items.length) {
                        await new Promise(resolve => setTimeout(resolve, 3500));
                    }
                }
            }
        }

        res.json({ message: `Fetched ${newPostsCount} new posts.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- Posts ---
router.post('/posts', async (req, res) => {
    const { title, content, link } = req.body;
    try {
        // Generate AI Content for manual post
        const aiContent = await generateContent(title, content);

        // Image generated on-demand only (user clicks 'Change Style')
        let imageUrl = null;

        const result = await pool.query(
            `INSERT INTO posts 
            (source_id, original_title, original_link, original_content, ai_summary, relevance_score, generated_title, generated_description, generated_content, hashtags, image_url, status)
            VALUES (NULL, $1, $2, $3, 'Manual Post', 10, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
            [title, link || `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`, content, aiContent.title, aiContent.description, aiContent.content, aiContent.hashtags, imageUrl]
        );

        // postToTwitter(`New Manual Post Created: ${title}`, null).catch(console.error); // Optional/Debug - REMOVED
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/posts/:id/regenerate', async (req, res) => {
    const { fields } = req.body; // e.g., ['title', 'content']
    try {
        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({ error: "No fields specified for regeneration." });
        }

        console.log(`[Regenerate] Starting regeneration for Post ${req.params.id}. Fields: ${fields.join(', ')}`);

        const post = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
        if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        const p = post.rows[0];

        // Combine original title and content for context
        const context = `Title: ${p.original_title}\n\nContent: ${p.original_content}\n\nLink: ${p.original_link}`;

        // Call Gemini to regenerate specific fields
        const newValues = await regenerateFields(fields, context);

        // Dynamic SQL Update
        const updates = [];
        const params = [req.params.id];
        let query = "UPDATE posts SET ";

        Object.keys(newValues).forEach((field, index) => {
            // Map JSON keys to DB columns
            const dbColumnMap = {
                title: 'generated_title',
                description: 'generated_description',
                content: 'generated_content',
                hashtags: 'hashtags'
            };

            const dbColumn = dbColumnMap[field];
            if (dbColumn) {
                updates.push(`${dbColumn} = $${params.length + 1}`);
                params.push(newValues[field]);
            }
        });

        if (updates.length === 0) return res.json({ message: "No valid fields to update." });

        query += updates.join(', ') + " WHERE id = $1 RETURNING *";

        const result = await pool.query(query, params);
        console.log(`[Regenerate] Completed regeneration for Post ${req.params.id}.`);
        res.json(result.rows[0]);

    } catch (err) {
        console.error("Regeneration error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/posts/reject-all', async (req, res) => {
    try {
        await pool.query("UPDATE posts SET status = 'rejected' WHERE status = 'pending'");
        res.json({ success: true, message: "All pending posts rejected." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/templates', authorize('admin', 'user'), (req, res) => {
    const newTemplate = req.body; // Expects { id, name, color, ... }
    if (!newTemplate.id || !newTemplate.name) return res.status(400).json({ error: "Invalid template data" });

    // Check for duplicate ID
    if (templates.find(t => t.id === newTemplate.id)) {
        return res.status(400).json({ error: "Template ID already exists" });
    }

    templates.push(newTemplate);

    // Save to file
    try {
        const fs = require('fs');
        const templatesPath = path.join(__dirname, '../data/templates.json');
        fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 4));
        res.json(newTemplate);
    } catch (err) {
        console.error("Error saving template:", err);
        res.status(500).json({ error: "Failed to save template" });
    }
});

router.delete('/templates/:id', authorize('admin', 'user'), (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE] Request to delete template ID: '${id}'`);
    console.log(`[DELETE] Current templates IDs:`, templates.map(t => t.id));

    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
        console.warn(`[DELETE] Template not found: ${id}`);
        return res.status(404).json({ error: "Template not found" });
    }

    templates.splice(index, 1);

    // Save to file
    try {
        const fs = require('fs');
        const templatesPath = path.join(__dirname, '../data/templates.json');
        fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 4));
        res.json({ success: true, message: "Template deleted" });
    } catch (err) {
        console.error("Error deleting template:", err);
        res.status(500).json({ error: "Failed to delete template" });
    }
});

router.put('/templates/:id', authorize('admin', 'user'), (req, res) => {
    const { id } = req.params;
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
        return res.status(404).json({ error: "Template not found" });
    }

    // Update fields (merge existing with new)
    templates[index] = { ...templates[index], ...req.body, id }; // Prevent ID change

    // Save to file
    try {
        const fs = require('fs');
        const templatesPath = path.join(__dirname, '../data/templates.json');
        fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 4));
        res.json({ success: true, template: templates[index] });
    } catch (err) {
        console.error("Error updating template:", err);
        res.status(500).json({ error: "Failed to update template" });
    }
});

router.get('/posts', async (req, res) => {
    const { status, date } = req.query;
    try {
        let query = 'SELECT * FROM posts';
        const params = [];
        const conditions = [];

        if (status) {
            const statusList = status.split(',');
            if (statusList.length > 1) {
                const placeholders = [];
                for (const s of statusList) {
                    params.push(s.trim());
                    placeholders.push(`$${params.length}`);
                }
                conditions.push(`status IN (${placeholders.join(', ')})`);
            } else {
                params.push(status);
                conditions.push(`status = $${params.length}`);
            }
        }

        if (date) {
            params.push(date);
            // Convert stored UTC timestamp to IST ('Asia/Kolkata') before extracting date
            // Prefer posted_at if available (for published items), else created_at
            conditions.push(`(COALESCE(posted_at, created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/posts/:id', async (req, res) => {
    const { status, generated_content, generated_title, hashtags, platforms } = req.body;

    // Handle shortlisting (any role can shortlist)
    if (status === 'shortlisted') {
        try {
            await pool.query(
                'UPDATE posts SET status = $1, shortlisted_by = $2 WHERE id = $3',
                ['shortlisted', req.user.id, req.params.id]
            );
            return res.json({ success: true, message: 'Post shortlisted' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }
    try {
        // Handle approval — just change status, do NOT publish
        if (status === 'approved') {
            // Only approvers and admins can approve
            if (!['approver', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions to approve' });
            }
            await pool.query(
                'UPDATE posts SET status = $1, approved_by = $2 WHERE id = $3',
                ['approved', req.user.id, req.params.id]
            );
            return res.json({ success: true, message: 'Post approved' });
        }

        // Handle publishing — actually post to platforms
        if (status === 'posted') {
            const post = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
            if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

            const p = post.rows[0];
            const caption = `${p.generated_content}\n\n${p.hashtags || ''}`;
            const imageUrl = p.image_url || 'https://placehold.co/600x400?text=News+Update';

            // Default to all if not specified (backward compatibility)
            const targetPlatforms = platforms || ['facebook', 'instagram'];

            console.log(`[Posting] Starting unified posting for Post ID ${p.id} to: ${targetPlatforms.join(', ')}`);
            const results = {};

            // 1. Post to Facebook
            if (targetPlatforms.includes('facebook')) {
                try {
                    results.facebook = await postToFacebook(caption, imageUrl);
                } catch (err) {
                    console.error("Facebook Post Failed:", err);
                    results.facebook = { success: false, error: err.message };
                }
            } else {
                results.facebook = { success: false, skipped: true };
            }

            // 2. Post to Instagram
            if (targetPlatforms.includes('instagram')) {
                const isFacebookCDN = imageUrl && imageUrl.includes('fbcdn.net');
                const isLocal = imageUrl && (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1'));
                const needsCDNUpload = imageUrl && !isFacebookCDN;

                let instagramImageUrl = imageUrl;

                if (needsCDNUpload) {
                    if (results.facebook && results.facebook.success && results.facebook.cdnUrl) {
                        console.log("[Instagram] Using Facebook CDN URL from current post.");
                        instagramImageUrl = results.facebook.cdnUrl;
                    } else {
                        try {
                            if (isLocal) {
                                console.log("[Instagram] Local image — uploading via file stream to FB CDN...");
                                instagramImageUrl = await uploadLocalImageForCDN(imageUrl);
                            } else {
                                console.log("[Instagram] External image (Templated.io/other) — uploading via buffer to FB CDN...");
                                instagramImageUrl = await uploadUrlImageForCDN(imageUrl);
                            }
                            console.log("[Instagram] Got CDN URL via CDN upload.");
                        } catch (cdnErr) {
                            console.error("[Instagram] CDN upload failed:", cdnErr.message);
                            results.instagram = { success: false, error: `CDN upload failed: ${cdnErr.message}` };
                            instagramImageUrl = null;
                        }
                    }
                }

                if (instagramImageUrl) {
                    try {
                        results.instagram = await postToInstagram(caption, instagramImageUrl);
                    } catch (err) {
                        console.error("Instagram Post Failed:", err);
                        results.instagram = { success: false, error: err.message };
                    }
                }
            } else {
                results.instagram = { success: false, skipped: true };
            }

            // 3. Post to LinkedIn
            if (targetPlatforms.includes('linkedin')) {
                let linkedInImage = imageUrl;
                try {
                    console.log("[LinkedIn] Attempting to post...");
                    results.linkedin = await postToLinkedIn(caption, linkedInImage);
                } catch (err) {
                    console.error("LinkedIn Post Failed:", err);
                    results.linkedin = { success: false, error: err.message };
                }
            } else {
                results.linkedin = { success: false, skipped: true };
            }

            // 4. Post to Twitter
            if (targetPlatforms.includes('twitter')) {
                try {
                    console.log("[Twitter] Attempting to post...");
                    results.twitter = await postToTwitter(caption, imageUrl);
                } catch (err) {
                    console.error("Twitter Post Failed:", err);
                    results.twitter = { success: false, error: err.message };
                }
            } else {
                results.twitter = { success: false, skipped: true };
            }

            const anySuccess = Object.values(results).some(r => r.success && !r.skipped);

            if (anySuccess) {
                const platformLinks = {
                    facebook: results.facebook?.permalink || null,
                    instagram: results.instagram?.permalink || null,
                    linkedin: results.linkedin?.permalink || null,
                    twitter: results.twitter?.url || null
                };

                await pool.query(
                    'UPDATE posts SET status = $1, posted_at = NOW(), platform_links = $2 WHERE id = $3',
                    ['posted', JSON.stringify(platformLinks), req.params.id]
                );

                res.json({
                    success: true,
                    message: "Posted successfully!",
                    details: results,
                    links: platformLinks
                });
            } else {
                console.error("All selected posting attempts failed.");
                res.status(200).json({
                    success: false,
                    error: "Failed to post to any platform.",
                    details: results
                });
            }
            return;
        }

        // Normal update
        await pool.query(
            'UPDATE posts SET status = COALESCE($1, status), generated_content = COALESCE($2, generated_content), generated_title = COALESCE($3, generated_title), hashtags = COALESCE($4, hashtags), generated_description = COALESCE($5, generated_description) WHERE id = $6',
            [status, generated_content, generated_title, hashtags, req.body.generated_description, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});



router.get('/templates', authorize('admin', 'user'), (req, res) => {
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const configuredUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const updatedTemplates = templates.map(t => ({
        ...t,
        preview: t.preview ? t.preview.replace('http://localhost:3000', baseUrl).replace(configuredUrl, baseUrl) : t.preview
    }));
    res.json(updatedTemplates);
});

router.post('/posts/:id/template', async (req, res) => {
    const { templateId } = req.body;
    try {
        // Fetch post WITH source name
        const post = await pool.query(`
            SELECT posts.*, sources.name as source_name 
            FROM posts 
            LEFT JOIN sources ON posts.source_id = sources.id 
            WHERE posts.id = $1
        `, [req.params.id]);

        if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        const p = post.rows[0];

        // Find selected template
        const selectedTemplate = templates.find(t => t.id === templateId) || templates[0];

        let imageUrl = null;

        // Only Templated.io is supported — no Jimp fallback
        if (selectedTemplate && selectedTemplate.templated_id) {
            console.log("Using Templated.io for generation...", selectedTemplate.templated_id);
            imageUrl = await renderTemplate(selectedTemplate.templated_id, {
                title: p.generated_title,
                description: p.generated_description ? p.generated_description.substring(0, 200) : (p.generated_content ? p.generated_content.substring(0, 200) : "News Update"),
                source: p.source_name ? `Source: ${p.source_name}` : "Miracles Fintech"
            }, selectedTemplate.layer_map);
        } else {
            console.warn("[Template Switch] Selected template has no templated_id — no image generated.");
        }

        await pool.query('UPDATE posts SET image_url = $1 WHERE id = $2', [imageUrl, req.params.id]);
        res.json({ imageUrl: imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const { getAuthorizationUrl, getAccessToken, getUserProfile } = require('../services/linkedin_auth');

// Existing Routes...

// --- LinkedIn Auth Routes ---

// 1. Redirect to LinkedIn Login
router.get('/auth/linkedin', (req, res) => {
    const url = getAuthorizationUrl();
    res.redirect(url);
});

// 2. Callback from LinkedIn
router.get('/auth/linkedin/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`LinkedIn Auth Error: ${error}`);
    }

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        // Exchange code for text
        const tokenData = await getAccessToken(code);
        const accessToken = tokenData.access_token;
        const expiresIn = tokenData.expires_in;

        // Get User URN (Profile ID)
        const profile = await getUserProfile(accessToken);
        const personUrn = `urn:li:person:${profile.sub}`;
        const name = profile.name;

        // Display results to user
        res.send(`
            <h1>LinkedIn Integration Successful! 🎉</h1>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Person URN:</strong> ${personUrn}</p>
            <p><strong>Access Token:</strong> ${accessToken}</p>
            <hr>
            <h3>Next Steps:</h3>
            <p>Please copy these values into your <code>.env</code> file:</p>
            <pre>
LINKEDIN_ACCESS_TOKEN=${accessToken}
LINKEDIN_PERSON_URN=${personUrn}
            </pre>
            <p>(Token expires in ${expiresIn} seconds, approx 60 days)</p>
        `);

    } catch (err) {
        console.error("LinkedIn Callback Failed:", err);
        res.status(500).send(`Failed to authenticate with LinkedIn: ${err.message}`);
    }
});



// --- User Management (Admin Only) ---

router.get('/users', authorize('admin'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/users', authorize('admin'), async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    if (!['admin', 'approver', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active, created_at',
            [name, email.toLowerCase().trim(), hashedPassword, role]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/users/:id/toggle', authorize('admin'), async (req, res) => {
    try {
        // Prevent admin from deactivating themselves
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        const result = await pool.query(
            'UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, name, email, role, is_active',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/users/:id', authorize('admin'), async (req, res) => {
    try {
        // Prevent admin from deleting themselves
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
