const Parser = require('rss-parser');

// 1. Standard Parser (Works for SEBI, CNBC, etc.)
const strictParser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
});

// 2. Lenient Parser (Fixes MoneyControl "Attribute without value" error)
const lenientParser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    xml2js: {
        strict: false,
        normalize: true,
        trim: true,
    }
});

const fetchFeed = async (url) => {
    try {
        console.log(`[RSS] Fetching: ${url}`);

        // Try Standard Parser First (Best for valid feeds like SEBI)
        let feed;
        try {
            feed = await strictParser.parseURL(url);
        } catch (err) {
            // If it fails with XML error, try Lenient Parser
            if (err.message.includes('Attribute without value') || err.message.includes('Unexpected close tag') || err.message.includes('Feed not recognized')) {
                console.warn(`[RSS] Standard parse failed for ${url}. Retrying with Lenient Parser...`);
                feed = await lenientParser.parseURL(url);
            } else {
                throw err;
            }
        }

        console.log(`[RSS] Success: ${url} (${feed.items.length} items)`);

        return feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            contentSnippet: item.contentSnippet || item.content,
        }));

    } catch (error) {
        console.error(`[RSS] Failed ${url}: ${error.message}`);
        return []; // Return empty array to continue
    }
};

module.exports = { fetchFeed };
