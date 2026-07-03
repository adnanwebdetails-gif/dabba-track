# DabbaTrack 📦

DabbaTrack is a premium full-stack parcel management system designed specifically for Indian e-commerce sellers. It features a custom **kraft-paper logistics aesthetic** and assists in managing, tracking, and reconciling Cash-on-Delivery (COD) packages.

## Key Features

1.  **Dashboard Analytics**: Financial indicators tracking total COD values, success rates, daily trend lines, and top cities using Recharts.
2.  **AI OCR Label Reader**: Upload shipping label photos (e.g. Ekart, Delhivery, XpressBees) to automatically parse tracking numbers (AWB), customer details, address, city, order number, and COD values using **Google Gemini Vision** (`gemini-2.5-flash`).
3.  **Real-Time Live Tracking**: Updates parcel delivery status directly via the **TrackingMore API**, with rate-limiting throttling (3 requests/second) and auto-courier detection.
4.  **Month-End Reconciliation**: Import courier statements (CSV/XLSX), auto-map columns, identify discrepancy buckets, and batch reconcile statuses with one click.

---

## Technical Stack

*   **Frontend**: React (Next.js 16 App Router) + Tailwind CSS v4
*   **Backend**: Next.js API Routes (Node.js) acting as a secure server-side proxy
*   **Database**: SQLite via **Prisma ORM v7** with the `@prisma/adapter-better-sqlite3` driver
*   **SDKs**: `@google/genai` (Gemini API) and `xlsx` (in-browser spreadsheet reader)

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have **Node.js 18+** installed on your system.

### 2. Set Up Environment Variables
Duplicate `.env.example` in the root folder to `.env`:
```bash
cp .env.example .env
```
Open `.env` and configure the following:

#### Obtaining a Gemini API Key:
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click on **Create API Key** and copy the value to `GEMINI_API_KEY`.

#### Obtaining a TrackingMore API Key:
1. Go to [TrackingMore](https://www.trackingmore.com/) and register for a free account.
2. Navigate to the **Developer Center** / **API Keys** section in your dashboard.
3. Copy your API Key to `TRACKINGMORE_API_KEY`.

### 3. Initialize the Database
Configure database tables and generate Prisma Client adapters:
```bash
npx prisma migrate dev --name init
```

### 4. Run the Development Server
Launch the local Next.js dev server:
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to view the app!

### 5. Build for Production
To test production compilation:
```bash
npm run build
npm run start
```

---

## 🚀 Deployment Suggestions

*   **Frontend & Serverless Backend**: Deploy directly to **Vercel** or **Render** as a single Next.js project.
*   **Database swap**: SQLite works perfectly for local/single-server hosting. If scaling up, update `datasource db { provider = "postgresql" }` in `prisma/schema.prisma` and connect to a hosted PostgreSQL instance.
