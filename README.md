# 🚀 AI-Powered Social Media Automation Tool

An intelligent social media automation platform designed for **Fintech & Market News**. This tool scrapes relevant live news from RSS feeds, uses **Google Gemini AI** to analyze and summarize content into engaging posts, generates professional social media images (via **Templated.io**), and streamlines the approval process for multi-platform publishing.

## ✨ Key Features

- **🔎 Smart Content Fetching**: Aggregates live news from multiple RSS feeds (MoneyControl, Economic Times, Livemint, etc.).
- **🧠 AI Analysis (Google Gemini)**: 
  - Filters news for relevance (Stock Market, Budget 2025, etc.).
  - Generates platform-optimized content (Hook, Caption, Hashtags).
  - Assigns a "Relevance Score" to prioritize high-impact news.
- **🎨 Automated Image Generation**:
  - Full integration with **Templated.io** for branded visuals.
  - Fullscreen image preview and template selection.
- **✅ Unified Approval Workflow**:
  - Dashboard to review, edit, and bulk-approve AI-generated posts.
  - **Multi-Platform Toggles**: Choose exactly where to post (Facebook, Instagram, Twitter/X) for each individual item.
- **📊 Real-time Publishing Status**: Tracks success/failure for each platform during the posting process.
- **📱 Platform Integrations**:
  - **Meta (Facebook & Instagram)**: Full API integration with automatic token management.
  - **Twitter (X)**: Integrated v2 API support with **Automatic Truncation** (280-char limit) and **Invisible Signature** to bypass duplicate content blocks.
- **⌛ History & Clickable Links**: 
  - Track all "Published" and "Rejected" posts.
  - **Live Links**: Direct "Click to View" buttons for published posts on Twitter, Facebook, and Instagram.

## 🔐 Roles & Permissions

The application uses a role-based access control (RBAC) system. Each user is assigned one of three roles.

### Page Access Matrix

| Page | Admin | Approver | User |
|------|:-----:|:--------:|:----:|
| Dashboard | ✅ | ✅ | ✅ |
| Sources | ✅ | ❌ | ✅ |
| Pending Queue | ✅ | ❌ | ✅ |
| Shortlisted | ✅ | ✅ | ❌ |
| Approved Queue | ✅ | ❌ | ✅ |
| History | ✅ | ✅ | ✅ |
| Templates | ✅ | ❌ | ✅ |
| User Management | ✅ | ❌ | ❌ |

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Framer Motion (Animations)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (pg)
- **AI Engine**: Google Gemini (gemma-3-27b-it)
- **Image Generation**: Templated.io API
- **Social APIs**: `twitter-api-v2`, Meta Graph API

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- API Keys: 
  - **Google Gemini** (for content generation)
  - **Templated.io** (for image generation)
  - **Meta Developer App** (for FB/IG)
  - **Twitter Developer App** (v2 API credentials)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/miraclesfintech/miracles-social-media-automation.git
    cd miracles-social-media-automation
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    npm install
    ```
    - Create a `.env` file in the `backend` folder:
      ```env
      PORT=3000
      DB_USER=postgres
      DB_HOST=localhost
      DB_NAME=social_automation
      DB_PASSWORD=your_password
      DB_PORT=5432
      GEMINI_API_KEY=...
      TEMPLATED_API_KEY=...
      TEMPLATED_TEMPLATE_ID=...
      
      # Social Media Credentials
      FACEBOOK_ACCESS_TOKEN=...
      FACEBOOK_PAGE_ID=...
      INSTAGRAM_ACCOUNT_ID=...
      
      TWITTER_API_KEY=...
      TWITTER_API_SECRET=...
      TWITTER_ACCESS_TOKEN=...
      TWITTER_ACCESS_SECRET=...
      ```
    - Initialize the Database:
      ```bash
      node scripts/setup_db.js
      ```
    - Start the Server:
      ```bash
      node index.js
      ```

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 📱 Developer Notes on Social Media Posting

### Twitter (X) Truncation & Uniqueness
To support **Free Tier API** accounts, the backend automatically:
1.  **Truncates** any content over 270 characters.
2.  Adds **Invisible Zero-Width Characters** (`\u200B`) to the end of every post. This makes every tweet unique to bypass Twitter's "Duplicate Content" block (403 Forbidden) without being visible to the end user.

### Meta (Facebook/Instagram) Media Handling
Images are automatically downloaded and converted to a format compatible with the Meta Graph API before publishing.

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License
Distributed under the MIT License.
