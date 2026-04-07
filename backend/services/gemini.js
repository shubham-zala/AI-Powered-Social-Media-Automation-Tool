const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
console.log(`[Gemini Service] Initializing with Key: ${apiKey ? 'Present' : 'MISSING'}`);
const genAI = new GoogleGenerativeAI(apiKey);
const modelName = "gemma-3-27b-it"; // High Rate Limit Model (30 RPM)
console.log(`[Gemini Service] Using Model: ${modelName}`);
const model = genAI.getGenerativeModel({ model: modelName });

// Helper: Retry logic
const retryOperation = async (operation, retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error; // Throw on last attempt

      // Check if it's a 503 or 429 (Rate limit/Overloaded)
      if (error.message.includes('503') || error.message.includes('429')) {
        console.warn(`[Gemini] Attempt ${i + 1} failed (Busy/RateLimit). Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Throw other errors immediately
      }
    }
  }
};

const generateContent = async (originalTitle, originalContent, instructions = "") => {
  return retryOperation(async () => {
    try {
      const prompt = `
      You are a social media expert for 'Miracles Fintech'.
      Create a Twitter post based on the following news:
      Title: ${originalTitle}
      Content: ${originalContent}

      Requirements:
      1. Engaging hook.
      2. Professional yet accessible tone.
      3. Short title (STRICTLY between 65 and 70 characters).
      4. Description (STRICTLY max 150 characters).
      5. Post content (STRICTLY max 210 chars). Ensure it is complete and not cut off. STRICTLY DO NOT include any hashtags in the content field.
      6. Hashtags (2-3 relevant ones). Place ALL hashtags ONLY in this field.
      7. STRICTLY NO EMOJIS in any field.
      8. STRICTLY NO SELF-PROMOTION or BRANDING (e.g., do not say "Miracles Fintech expert analysis").
      9. ${instructions}

      Output strict JSON format:
      {
        "title": "...",
        "description": "...",
        "content": "...",
        "hashtags": "..."
      }
    `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up markdown code blocks if present
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);

      // Safety net: Strip any hashtags that leaked into the content field
      if (parsed.content) {
        parsed.content = parsed.content.replace(/\s*#\w+/g, '').trim();
      }

      // Enforce Mandatory Hashtags
      const mandatoryTags = ['#MiraclesFintech', '#MarketNews'];
      let tags = parsed.hashtags || "";
      mandatoryTags.forEach(tag => {
        if (!tags.toLowerCase().includes(tag.toLowerCase())) {
          tags += ` ${tag}`;
        }
      });
      parsed.hashtags = tags.trim();

      return parsed;

    } catch (error) {
      console.error('Error generating content with Gemini:', error.message);
      throw error;
    }
  });
};

// Analyze content for relevance
const analyzeContent = async (title, content) => {
  return retryOperation(async () => {
    try {
      const prompt = `
        Content Analysis Task:
        Analyze the following news item for relevance to the **Indian Stock Market** and **Finance**.

        Title: ${title}
        Content: ${content ? content.substring(0, 3000) : "No content provided"}

        Criteria for Relevance:
        1. Directly mentions Indian stocks, Nifty, Sensex, RBIm SEBI, or Indian economy.
        2. Global events with HIGH impact on India (e.g., US Fed Rate changes, Oil prices, Geopolitics involving India).
        3. Major corporate deals involving Indian companies.

        Output strict JSON format:
        {
            "relevance_score": 0-10, (10 = High Impact, 0 = Irrelevant)
            "is_relevant": true/false, (Score >= 6)
            "summary": "One sentence summary focusing on market impact",
            "reason": "Short reason for the score"
        }
        `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up markdown code blocks if present
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);

    } catch (error) {
      console.error('Error analyzing content with Gemini:', error.message);
      // Return default safe response on error but rethrow if it's the last retry logic handling
      throw error;
    }
  }).catch(error => {
    // Fallback after retries fail
    return { relevance_score: 0, is_relevant: false, summary: "Error during analysis", reason: error.message };
  });
};

// Quota Tracking
// Quota Tracking
const fs = require('fs');
const path = require('path');

const DAILY_LIMIT = 14400; // Gemma 3 27B Limit
const USAGE_FILE = path.join(__dirname, '../data/usage.json');

let usageStats = {
  requestsMade: 0,
  lastReset: new Date().setHours(0, 0, 0, 0)
};

// Load stats from file
try {
  if (fs.existsSync(USAGE_FILE)) {
    const data = fs.readFileSync(USAGE_FILE, 'utf8');
    usageStats = JSON.parse(data);
  }
} catch (err) {
  console.error("Failed to load usage stats:", err);
}

const saveStats = () => {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usageStats, null, 2));
  } catch (err) {
    console.error("Failed to save usage stats:", err);
  }
};

const checkReset = () => {
  const now = new Date().setHours(0, 0, 0, 0);
  if (now > usageStats.lastReset) {
    usageStats.requestsMade = 0;
    usageStats.lastReset = now;
    saveStats();
  }
};

const trackUsage = (count = 1) => {
  checkReset();
  usageStats.requestsMade += count;
  saveStats();
};

const getQuotaStatus = () => {
  checkReset();
  return {
    limit: DAILY_LIMIT,
    used: usageStats.requestsMade,
    remaining: Math.max(0, DAILY_LIMIT - usageStats.requestsMade)
  };
};

// ... (existing generateContent and analyzeContent logic) ...

// Bulk Analyze content for relevance
const analyzeContentBulk = async (items) => {
  return retryOperation(async () => {
    trackUsage(1); // 1 Call for bulk analysis
    try {
      const itemsList = items.map((item, index) =>
        `Item ${index + 1}:\nTitle: ${item.title}\nSnippet: ${item.contentSnippet || item.content || "No snippet"}`
      ).join('\n\n');

      const prompt = `
          Bulk Content Analysis Task:
          Analyze the following news items for relevance to the **Indian Stock Market** and **Finance**.
          
          ${itemsList}
  
          Criteria for Relevance:
          1. Directly mentions Indian stocks, Nifty, Sensex, RBI, SEBI, or Indian economy.
          2. Global events with HIGH impact on India (e.g., US Fed Rate changes, Oil prices).
          3. Major corporate deals involving Indian companies.
  
          Strictly filter out:
          - Administrative notices (Settlement orders, Recovery certificates, etc.)
          - Routine compliance logs
          - Duplicate topics
  
          Output strict JSON format as an Array of Objects. Include ALL items, even irrelevant ones:
          [
              {
                  "item_index": 1, (the number from the input, e.g. 1, 2, 3...)
                  "relevance_score": 0-10,
                  "is_relevant": true/false,
                  "reason": "Short reason"
              },
              ...
          ]
          `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up markdown code blocks if present
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);

    } catch (error) {
      console.error('Error in bulk analysis:', error.message);
      throw error;
    }
  });
};

// Regenerate specific fields
const regenerateFields = async (fields, originalContext) => {
  return retryOperation(async () => {
    trackUsage(1);
    try {
      const fieldDirectives = {
        title: "Short, punchy title (65-70 chars). NO Emojis.",
        description: "Concise summary (max 150 chars). NO Emojis.",
        content: "Engaging post body (max 220 chars). Professional tone. NO Emojis. NO Branding.",
        hashtags: "3-5 relevant hashtags."
      };

      const instructions = fields.map(f => `${f}: ${fieldDirectives[f] || ''}`).join('\n');

      const prompt = `
        You are a social media expert.
        Regenerate the following fields based on this context:
        "${originalContext}"

        Fields to Regenerate:
        ${instructions}

        STRICT RULES:
        1. NO EMOJIS allowed in any output.
        2. NO BRANDING or self-promotion (e.g., "Miracles Fintech says").
        3. Maintain a professional, neutral, yet engaging tone.

        Output strict JSON format with ONLY the requested fields:
        {
          "${fields[0]}": "...",
          ...
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);

      // Safety net: Strip any hashtags that leaked into the content field
      if (parsed.content) {
        parsed.content = parsed.content.replace(/\s*#\w+/g, '').trim();
      }

      // Enforce Mandatory Hashtags if 'hashtags' field was requested
      if (fields.includes('hashtags')) {
        const mandatoryTags = ['#MiraclesFintech', '#MarketNews'];
        let tags = parsed.hashtags || "";
        mandatoryTags.forEach(tag => {
          if (!tags.toLowerCase().includes(tag.toLowerCase())) {
            tags += ` ${tag}`;
          }
        });
        parsed.hashtags = tags.trim();
      }

      return parsed;

    } catch (error) {
      console.error('Error regenerating fields:', error.message);
      throw error;
    }
  });
};

module.exports = { generateContent, analyzeContent, analyzeContentBulk, regenerateFields, getQuotaStatus, trackUsage };
