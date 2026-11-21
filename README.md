# BizMate — AI Business OS & WhatsApp Automation

BizMate is a production-ready, multi-tenant AI business operating system designed for Indian SMBs, retail shops, restaurants, salons, and service providers. It combines official Meta WhatsApp Cloud API messaging, Google Gemini multilingual AI, n8n workflow automation, real-time CRM, and subscription billing into a unified platform.

---

## 🌟 Key Architecture & Capabilities

### 1. Multi-Tenant Business OS & Industry Adaptability
- **Dynamic Industry Engine**: Switch dynamically between **Restaurants & Cafes**, **Salons & Spas**, **Retail & Boutiques**, **Healthcare Clinics**, and **Professional Services**.
- **Real Database Persistence**: Terminology (e.g. *Customer* vs *Patient* vs *Guest*), KPIs, and workflows reconfigure live from PostgreSQL without hardcoded mock data.
- **Tenant Isolation**: Cryptographic JWT authentication with tenant-scoping middleware guaranteeing complete database data isolation.

### 2. WhatsApp Business Cloud API & AI Pipeline
- **Meta Cloud API v21.0**: Bi-directional messaging with official WhatsApp Cloud API integration.
- **BYOC Architecture (Bring-Your-Own-Credentials)**: Businesses connect their own WhatsApp Business Account with **AES-256-GCM token encryption at rest**.
- **Multilingual AI Intelligence**: Google Gemini models detect languages, translate Indian vernacular (Hindi, Marathi, Hinglish, Tamil, Telugu), extract customer intents/entities, and transcribe voice notes.
- **Zero Data Loss Guarantee**: Immediate raw message persistence before AI processing.
- **Human Handover Escalation**: Automatic sentiment and urgency detection routes complex queries and complaints to staff.

### 3. Centralized SaaS Monetization & Fair-Use Quotas
- **5 Subscription Tiers**:
  - **Free Tier** (₹0/mo): 50 AI ops, 100 CRM contacts, 1 staff seat, 1 automation workflow.
  - **Starter** (₹599/mo): 500 AI ops, 1,000 CRM contacts, 2 staff seats, 3 workflows, voice processing (5 mins).
  - **Growth** (₹1,499/mo): 2,500 AI ops, 10,000 CRM contacts, 5 staff seats, 10 workflows, 30 mins voice processing, advanced analytics.
  - **Pro Scale** (₹3,499/mo): 10,000 AI ops, 50,000 CRM contacts, 15 staff seats, 50 workflows, priority support.
  - **Enterprise** (Custom): Custom quotas, dedicated infrastructure, and SLA.
- **Security-Hardened**: Direct plan modification via profile endpoints is cryptographically blocked. Plan changes require verified checkout payments.

### 4. Transparent Metering & Cost Optimization
- **Gemini Token Engine**: Records actual prompt and candidate token counts using API `usageMetadata`.
- **Transparent Credit Weights**:
  - Language Detection & Translation: `0.5 credits`
  - Intent & Entity Extraction: `1.0 credit`
  - Audio Voice Note Transcription: `2.0 credits`
  - Copilot Instruction Parsing: `1.0 credit`
- **Audit Ledger**: Immutable `usage_events` table and atomic billing cycle aggregation in `tenant_usage`.
- **Admin Unit Economics Overview**: Real-time tracking of tenant MRR, API COGS, and gross margins.

### 5. Razorpay SaaS Billing & Automated Invoicing
- **Cryptographic Payment Gateway**: Server-side HMAC-SHA256 signature verification.
- **Automated Tax Invoicing**: Generates sequential `BZM-INV-XXXXXX` tax invoices and audit trails on successful payment capture.
- **Webhook Processing**: Idempotent event routing (`payment.captured`, `payment.failed`, `subscription.charged`, etc.) with past-due grace period handling.

### 6. Media Storage & Security
- **AES-256-GCM Token Encryption**: 96-bit random IVs and authenticated tags protect third-party API credentials in PostgreSQL.
- **Media Storage Validation**: Enforces audio, image, and PDF MIME types with a 25MB file size limit for voice notes and attachments.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Lucide Icons, Recharts |
| **Backend** | Node.js, Express.js (ES Modules), Zod, JWT, bcryptjs |
| **Database** | PostgreSQL (Supabase compatible) with UUID primary keys |
| **AI Engine** | Google Gemini API (`gemini-3.5-flash-lite`, `gemini-1.5-flash`) |
| **Messaging** | Meta WhatsApp Business Cloud API v21.0 |
| **Payments** | Razorpay Node.js SDK & Webhooks |
| **Automation** | n8n Webhook Workflow Triggers |

---

## 📁 Repository Structure

```
bizmate/
├── backend/
│   ├── config/              # Database, Environment, Plans, Razorpay & Cost Constants
│   ├── controllers/         # Auth, Business, Customer, Inbox, Payment, Subscription, WhatsApp
│   ├── middleware/          # Auth, Tenant isolation, Subscription Quotas, Error handlers
│   ├── migrations/          # PostgreSQL schema migrations (001, 002)
│   ├── routes/              # Express API route modules
│   ├── services/            # Gemini, WhatsApp, Razorpay, Entitlements, Usage, Media, n8n
│   ├── tests/               # Automated test suites (50 tests, 100% pass)
│   ├── utils/               # AES-256-GCM encryption, Logging
│   ├── schema.sql           # Base database schema
│   ├── server.js            # Server entrypoint
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API client with auth interceptors
│   │   ├── components/      # UI components, Sidebar, Header, Metrics, Charts
│   │   ├── context/         # BusinessContext, AuthContext, ThemeContext
│   │   ├── pages/           # Dashboard, WhatsApp Inbox, CRM Pipeline, AI Copilot, Settings
│   │   └── config/          # Industry configs and terminology
│   ├── index.html           # HTML template with Razorpay Checkout SDK
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── package.json             # Root monorepo orchestrator
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **PostgreSQL** running locally on port 5432 (or a remote Supabase / Neon connection)
- **Google Gemini API Key** (from Google AI Studio)
- **Meta WhatsApp Cloud API credentials** (optional for test simulation mode)
- **Razorpay Test Keys** (optional for test checkout mode)

### 2. Database Setup
Create the `bizmate` database and run the migrations in order:

```bash
# 1. Create database
createdb bizmate

# 2. Run base schema
psql -d bizmate -f backend/schema.sql

# 3. Run subscription architecture migration
psql -d bizmate -f backend/migrations/001_subscription_architecture.sql

# 4. Run usage metering & audit tracking migration
psql -d bizmate -f backend/migrations/002_usage_tracking_and_metering.sql
```

### 3. Environment Variables
Copy the example environment file in `backend/`:

```bash
cp backend/.env.example backend/.env
```

Configure your credentials inside `backend/.env`:
```env
PORT=5001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bizmate"
SECRET_KEY="your_production_jwt_secret_key"
GEMINI_API_KEY="your_google_gemini_api_key"
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
```

### 4. Installation
Install all dependencies across the monorepo:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 5. Running the Application

Run both backend and frontend concurrently:
```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:5001`
- **API Health Check**: `http://localhost:5001/`

---

## 🧪 Testing & Verification

BizMate includes an extensive automated test suite covering all services:

```bash
# Run all backend test suites
npm run test:backend

# Or run individual test modules
cd backend
node --test tests/phase4_production_readiness.test.js
node --test tests/payment.test.js
node --test tests/subscription.test.js
node --test tests/usage_and_metering.test.js
node --test tests/backend.test.js
node --test tests/multitenant.test.js

# Build frontend to verify TypeScript types and Vite bundle
npm run build:frontend
```

**Verification Highlights (50/50 tests passing)**:
- ✅ Multi-tenant isolation & zero-state creation
- ✅ Live Gemini translation & Indian vernacular parsing
- ✅ Webhook handshake & WhatsApp message idempotency
- ✅ Centralized subscription limits & fair-use quotas
- ✅ Gemini token & credit metering calculations
- ✅ Razorpay order creation, HMAC signature verification & webhook handling
- ✅ AES-256-GCM token encryption at rest
- ✅ Media storage MIME type & size restrictions

---

## 📄 License

This project is proprietary and confidential. Created for BizMate SaaS.
