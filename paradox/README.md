# PARADOX — Where Vision Meets Capital

> **A premium, technology-driven investment-matching ecosystem connecting ambitious entrepreneurs with accredited investors.**

PARADOX is not a traditional trading application, stock market, or open brokerage platform. It is a private, institutionally governed financial ecosystem engineered for discretion, speed, and strategic alignment.

---

## 🏛️ Brand Identity & Values

- **Tagline**: *Where Vision Meets Capital*
- **Core Pillars**: **Trust** • **Innovation** • **Opportunity**
- **Aesthetic**:
  - **Glassmorphism**: Translucent frosted glass layers (`backdrop-filter: blur(20px) saturate(180%)`), specular top-border rim highlights, and ambient multi-color light refraction.
  - **Neomorphism (Dark Extrusions & Inset Depth)**: Convex 3D tactile elevation (`box-shadow: 8px 8px 24px rgba(0,0,0,0.8), -5px -5px 16px rgba(255,255,255,0.024)`), sunken/carved financial metric wells, and radiant gold extrusion buttons.
  - Primary Background: Deep Black (`#070709`) with radial golden nebula backlights
  - Accent: Sovereign Gold / Yellow (`#FACC15`) with liquid luminescence
  - Typography: Plus Jakarta Sans & JetBrains Mono

---

## ⚡ Key Platform Capabilities

### 1. 💼 Investor Portal
- **Overview Dashboard**: Track portfolio metrics matching institutional figures (₹12.8 Cr invested across vetted assets, 156 discovered ventures, 24 saved opportunities, 18 active encrypted communications).
- **Venture Discovery**: Live search and multi-parameter filters (Fintech, Healthtech, AI/ML, Clean Energy, Agritech, Cybersecurity) with stage filters (Pre-Seed to Series B+).
- **Expressions of Interest (EOI)**: Submit formal indications of interest with proposed ticket size, requested equity stake, and strategic value-add.
- **Deal Pipeline Tracker**: Track progress across status stages (`Pending`, `Under Review`, `Accepted / Term Sheet`, `Closed`).
- **Private Watchlist**: Save and bookmark high-conviction ventures with one-click toggles.
- **Bilateral Messaging**: Secure, encrypted communication threads with verified founders.
- **Accredited KYC**: Passport and government ID verification workflow.

### 2. 🚀 Entrepreneur Portal
- **Founder Command Desk**: Monitor capital progress (₹3.8 Cr raised, 12 interested investors, 8 active ventures, 46 investor inquiries).
- **Venture Proposal Wizard**: Structured 5-step proposal creation (Venture identity, Financial requirements, Pre-money valuation, Unit economics/MRR/Runway, Pitch deck links).
- **Inbound Inquiries**: Review inbound indications of interest with one-click Accept, Counter, or Decline actions.
- **Deal Rooms**: Share confidential data room links and diligence materials with verified investors only.
- **Corporate KYC**: Business registration and Certificate of Incorporation verification.

### 3. 🛡️ Administrator Governance Desk
- **Platform Analytics**: Total capital sought vs raised, active listings, pending KYC queues, and platform volume.
- **Venture Listing Moderation**: Review startup proposals before public listing; approve or reject with detailed compliance notes.
- **Global KYC Desk**: Inspect submitted passports, national IDs, and corporate incorporation documents with one-click verification.
- **User Directory**: Search, filter, and audit all registered investors, founders, and administrators.
- **Security Audit Trail**: Real-time immutable audit logging of critical actions, IPs, and resource mutations.

---

## 🛠️ Technology Stack & Architecture

- **Backend**: Native Node.js 24 Full-Stack Engine (CommonJS & TypeScript-compatible).
- **Database Engine (Dual-Mode)**:
  - **Local Mode (Default)**: Embedded persistent SQLite powered by Node 24 native `node:sqlite` (`DatabaseSync` with WAL journal mode and foreign key constraints). Zero external network setup required!
  - **Production Cloud Mode**: Supabase (PostgreSQL with full Row Level Security policies, foreign keys, triggers, and storage buckets).
- **Authentication**: PBKDF2 with 10,000 rounds, cryptographic salts, and zero-dependency signed JWT session tokens.
- **Security**: Server-side Role-Based Access Control (RBAC), strict input sanitization, and cryptographic timing-safe comparisons.
- **Frontend**: High-performance Single-Page Application (SPA) with custom dark-mode financial styling, responsive grid, and interactive modals.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Antigravity runtime or Node.js v20+

### 2. Run the Application
Open PowerShell or your terminal in this directory:
```powershell
# Using the built-in Antigravity Node runner:
& "C:\Users\Sanja\AppData\Roaming\Antigravity\bin\agy-node.cmd" src/server/server.js

# Or with standard node (if installed globally):
node src/server/server.js
```
The server will start on **`http://localhost:3000`**.

### 3. Open in Browser
Visit **`http://localhost:3000`** in your browser.

---

## 🔑 Demo Access Accounts

Use the **Live Enterprise Sandbox bar** at the top of the interface for instantaneous one-click role switching, or sign in manually with these credentials:

| Role | Email | Password | Primary Persona |
| :--- | :--- | :--- | :--- |
| **Investor** | `investor@paradox.com` | `Password#123` | Vikramaditya Singhania (Apex Capital Partners) |
| **Entrepreneur** | `entrepreneur@paradox.com` | `Password#123` | Dr. Aarav Patel (NeuralPay & QuantumLedger) |
| **Administrator** | `admin@paradox.com` | `Password#123` | Evelyn Cross (PARADOX Governance Desk) |

---

## 🧪 Automated Integration Tests

Run the complete 22-test automated verification suite:
```powershell
& "C:\Users\Sanja\AppData\Roaming\Antigravity\bin\agy-node.cmd" --test tests/api.test.js
```
The test suite verifies:
1. Database engine & PBKDF2 password hashing integrity.
2. Registration, login, validation, and session recovery.
3. Proposal submission, draft isolation, and admin approval workflows.
4. Watchlist save/unsave toggles and Expressions of Interest (EOI).
5. KYC submission and compliance verification.
6. Bilateral encrypted messaging and read receipts.

---

## 🗄️ Supabase / PostgreSQL Production Deployment

When deploying to Supabase Cloud:
1. Log in to your [Supabase Dashboard](https://app.supabase.com).
2. Create a new project named `paradox-production`.
3. Open the **SQL Editor** and run the migration scripts in sequence:
   - `supabase/migrations/001_initial_schema.sql` (Tables, constraints, indexes)
   - `supabase/migrations/002_rls_policies.sql` (Row Level Security policies)
   - `supabase/seed.sql` (Foundational seed data)
4. Update your `.env` file with `DB_ENGINE=postgres` and your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 📂 Project Directory Structure

```
paradox/
├── .env.example                     # Environment configuration template
├── package.json                     # Project manifest and scripts
├── tsconfig.json                    # TypeScript configuration
├── README.md                        # Documentation and user guide
├── ARCHITECTURE.md                  # Comprehensive system architecture document
├── paradox.db                       # Persistent SQLite database (WAL mode)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  # Complete PostgreSQL schema
│   │   └── 002_rls_policies.sql    # Complete Row Level Security policies
│   └── seed.sql                     # Production seed data
├── src/
│   ├── server/
│   │   ├── db.js                    # Persistent database engine with auto-seeding
│   │   ├── auth.js                  # PBKDF2 cryptography & JWT session signing
│   │   ├── middleware.js            # Security guards, RBAC, body parsing, audit logging
│   │   ├── server.js                # Core HTTP application server & routing
│   │   └── routes/
│   │       ├── authRoutes.js        # Registration, login, profile, demo switch
│   │       ├── startupRoutes.js     # Proposal creation, catalog, discovery filters
│   │       ├── investmentRoutes.js  # Expressions of interest, watchlist, portfolio
│   │       ├── kycRoutes.js         # Identification submission and verification
│   │       ├── messageRoutes.js     # Bilateral encrypted conversations & messages
│   │       ├── notificationRoutes.js# Notification queue and read receipts
│   │       └── adminRoutes.js       # Admin stats, user directory, venture moderation
│   └── public/
│       ├── index.html               # Main single-page application mount
│       ├── css/
│       │   └── paradox.css          # Design system stylesheet (#080808, #FACC15)
│       └── js/
│           ├── api.js               # Client API communication vault
│           └── app.js               # Reactive UI controller & dashboard engine
└── tests/
    └── api.test.js                  # Comprehensive automated integration test suite
```

---

## 🛡️ License & Compliance

PARADOX is a proprietary technology specification for accredited private capital matching.
All rights reserved © 2026 PARADOX Technologies Inc.
