const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
];

const scrapeContent = async (url) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ],
        });
        const page = await browser.newPage();

        // Randomize User Agent
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);

        // Add extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        });

        // Navigate with a slightly longer timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Simulate human behavior (scroll)
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight / 2) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extract content
        const data = await page.evaluate(() => {
            const title = document.querySelector('h1')?.innerText || document.title;
            // Try to find the main article body
            // Improved selector strategy
            const article = document.querySelector('article')
                || document.querySelector('[itemprop="articleBody"]')
                || document.querySelector('.article-body')
                || document.querySelector('main')
                || document.body;

            // Get text, filtering out short snippets (ads, nav links)
            const paragraphs = Array.from(article.querySelectorAll('p'))
                .map(p => p.innerText.trim())
                .filter(t => t.length > 80); // Filter out short lines

            return {
                title,
                content: paragraphs.slice(0, 10).join('\n\n') // Get more context (10 paras)
            };
        });

        return data;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        // Return NULL to indicate failure, allowing RSS fallback in parent function
        return null;
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { scrapeContent };
