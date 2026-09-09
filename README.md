# 🚀 LeadGenAI - AI-Powered Conversational Sales & Lead Generation Platform

An enterprise-grade, multi-tenant AI sales agent and lead qualification SaaS platform built with **Next.js 15, NestJS, MongoDB, Redis, WebSockets (Socket.IO), and OpenAI/Anthropic LLMs**.

---

## 🌟 Key Features

- **🤖 Autonomous AI Sales Agent:** Natural language chat powered by OpenAI GPT-4o & Claude 3.5 Sonnet with Tool/Function Calling (`capture_lead`, `book_appointment`, `update_lead_status`).
- **📚 RAG Knowledge Base:** Ingests company documents (PDF, TXT, URLs) with vector embeddings for accurate domain-specific responses.
- **🔥 Automated Lead Qualification:** Real-time AI lead scoring (Hot, Warm, Cold) based on visitor intent and conversation depth.
- **⚡ Real-Time Human Takeover (Handoff):** Live agent takeover with real-time audio notifications and dashboard status badges.
- **🔁 Follow-Up Automation:** Background scheduler for automated multi-channel sequences (Email, SMS, WhatsApp).
- **📈 Visitor Analytics & Attribution:** Tracks referrer sources, UTM parameters, device telemetry, and conversion rates.
- **🏢 Multi-Tenant Architecture:** Isolated workspaces, Role-Based Access Control (Admin, Sales Manager, Agent), Webhooks, and API Keys.
- **💬 Embeddable Chat Widget:** Lightweight, standalone script bundle (`/widget.js`) with Web Audio chime alerts and responsive mobile layout.

---

## 🏗️ Architecture & Monorepo Structure

```
AI_Lead_Generation/
├── apps/
│   ├── api/          # NestJS Backend (REST API, WebSockets, MongoDB, Redis, AI Engine)
│   ├── web/          # Next.js 15 App Router Dashboard (Tailwind CSS, React Query)
│   └── widget/       # Preact / TypeScript Embeddable Chat Widget
├── packages/
│   └── shared/       # Shared TypeScript types, constants & schemas
├── docker-compose.yml # MongoDB (Replica Set), Redis, MinIO (S3)
└── start.bat         # Automated one-click launcher with health-check synchronization
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | NestJS, TypeScript, Mongoose (MongoDB), Redis, Socket.IO, Helmet |
| **Frontend** | Next.js 15, React, Tailwind CSS, Lucide Icons, React Query, Zustand |
| **Widget** | TypeScript, Vite, Preact, Web Audio API |
| **AI / LLMs** | OpenAI API (GPT-4o/mini), Anthropic Claude API, Vector Embeddings |
| **Storage & DB** | MongoDB 7 (Replica Set), Redis 7, MinIO (S3 Compatible Storage) |
| **Monorepo** | Turborepo, NPM Workspaces, Docker Compose |

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Git](https://git-scm.com)

### 2. Clone Repository
```bash
git clone https://github.com/aMan15TG/LeadGenAI.git
cd LeadGenAI
```

### 3. Environment Setup
```bash
# Copy API environment file
cp apps/api/.env.example apps/api/.env

# Copy Web environment file
cp apps/web/.env.example apps/web/.env.local
```
*Add your OpenAI or Anthropic API keys in `apps/api/.env`.*

### 4. Start Infrastructure
```bash
docker compose up -d mongodb redis minio
```

### 5. Install Dependencies & Seed Database
```bash
npm install
npm run seed
```

### 6. Run Application
```bash
# Windows One-Click Start (Automated Health Check & Launch)
start.bat

# Or Manual Development:
npm run dev
```

- **Dashboard:** [http://localhost:3001](http://localhost:3001)
- **Backend API:** [http://localhost:4000](http://localhost:4000)
- **Swagger Docs:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **MinIO Console:** [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)

---

## 🔑 Default Seed Credentials

- **Workspace / Tenant:** `demo`
- **Email:** `admin@demo.com`
- **Password:** `Admin@123`

---

## 📄 License
This project is licensed under the MIT License.
