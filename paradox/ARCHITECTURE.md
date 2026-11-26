# PARADOX — System Architecture & Engineering Blueprint

> **Where Vision Meets Capital: Architectural Design Specification**

---

## 1. Executive Architectural Summary

PARADOX is an institutional-grade, closed-loop investment-matching platform designed for private equity and venture capital deal-making. Unlike consumer fintech or public brokerage platforms, PARADOX enforces strict identity gating, non-solicitation boundaries, bilateral term sheet negotiations, and auditable governance logs.

The client layer features a **Fluid Dual-Theme System** with non-boxy organic geometry:
- **Dark Theme (Default)**: Deep Obsidian Black (`#07070a`) and Sovereign Champagne Gold (`#FACC15`) with ambient golden radiance.
- **Light Theme**: Luminous Cloud White (`#F8FAFC`) and Imperial Navy Blue (`#0F172A`, `#1E3A8A`) with sapphire light flares.
- **Fluid Geometry**: Replaces boxy rectangles with generous curved capsules (`border-radius: 9999px`), rounded-3xl pebble cards (`border-radius: 26px`), sunken metric wells, and floating dynamic island navigation.

```
+-------------------------------------------------------------------------------+
|                           PARADOX CLIENT PLATFORM                             |
|  - Public Discovery & Teaser Catalogue                                        |
|  - Investor Command Desk (Pipeline, Due Diligence, Watchlist, Offers)         |
|  - Entrepreneur Desk (Proposals, Cap Table Goals, Inquiries, Deal Room)       |
|  - Administrator Desk (KYC Desk, Moderation, User Directory, Audit Trail)     |
+-------------------------------------------------------------------------------+
                                      │
                         RESTful HTTPS / Bearer Auth
                                      ▼
+-------------------------------------------------------------------------------+
|                       SECURITY & AUTHORIZATION GATEWAY                        |
|  - PBKDF2 Password Hashing (100,000 rounds, SHA-512, CSPRNG Salts)            |
|  - Signed Session Tokens (HS256, Replay Protection, Timing-Safe Comparison)  |
|  - Role-Based Access Control (RBAC): Investor | Entrepreneur | Administrator   |
|  - Rate Limiting, Input Sanitization & Path Traversal Guards                  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                            BUSINESS LOGIC ROUTING                             |
|  ├── /api/auth/*          (Registration, Authentication, Profile, Recovery)   |
|  ├── /api/startups/*      (Proposals, Valuation, Discovery, Growth Metrics)   |
|  ├── /api/investments/*   (Indications of Interest, Term Sheets, Watchlist)   |
|  ├── /api/kyc/*           (Document Ingestion, Accreditation Certification)   |
|  ├── /api/messages/*      (Encrypted Bilateral Counterparty Threads)          |
|  ├── /api/notifications/* (Real-Time Deal & Compliance Queue)                 |
|  └── /api/admin/*         (Governance, Review Desk, Global Analytics)         |
+-------------------------------------------------------------------------------+
                                      │
                    Unified Data Layer Abstraction
                                      ▼
+-------------------------------------------------------------------------------+
|                           DUAL-ENGINE DATA LAYER                              |
|                                                                               |
|  LOCAL PERSISTENCE (Node 24)        │    PRODUCTION CLOUD (Supabase)          |
|  - Engine: node:sqlite DatabaseSync │    - Engine: PostgreSQL 16+             |
|  - Journal Mode: WAL                │    - Row Level Security (RLS) Enabled   |
|  - Foreign Key Constraints: Strict  │    - Storage: S3-Compatible Vault       |
|  - Zero Network Latency             │    - Real-Time Websockets               |
+-------------------------------------------------------------------------------+
```

---

## 2. Security & Threat Modeling

### 2.1 Identity & Cryptographic Security
- **Password Storage**: Passwords are never stored in plaintext. They are salted with 16 bytes of cryptographically secure random bytes generated via `crypto.randomBytes(16)` and hashed using PBKDF2 with 10,000 to 100,000 iterations of SHA-512.
- **Timing Attack Mitigation**: All credential and token verification procedures use `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- **Session Tokens**: Authenticated sessions issue compact, signed JWT tokens containing user claims (`id`, `email`, `role`, `kyc_status`) with HMAC-SHA256 signatures and strict expiration timestamps (`exp`).

### 2.2 Role-Based Access Control (RBAC) Matrix

| Resource / Endpoint | Public / Unverified | Verified Investor | Entrepreneur / Founder | Platform Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **Public Approved Startups** | Read Only (Teaser) | Full Read | Full Read | Full Read |
| **Draft / Pending Startups** | Blocked (403) | Blocked (403) | Own Only (Read/Write) | Full Read & Review |
| **Submit Startup Proposal** | Blocked (401) | Blocked (403) | Allowed (Creates Pending) | Allowed (Auto-approved) |
| **Express Interest (EOI)** | Blocked (401) | Allowed | Blocked (403) | Allowed |
| **Review / Accept Offers** | Blocked (401) | Blocked (403) | Own Startups Only | Full Management |
| **Private Watchlist** | Blocked (401) | Own Watchlist Only | Own Watchlist Only | Full Audit |
| **KYC Submission** | Blocked (401) | Own Submission | Own Submission | Full Queue Access |
| **KYC Approval / Rejection** | Blocked (403) | Blocked (403) | Blocked (403) | Allowed |
| **Audit Log Trail** | Blocked (403) | Blocked (403) | Blocked (403) | Full Access |

---

## 3. Database Schema Design & Normalization

The database architecture is designed with 3rd normal form (3NF) relational integrity:

1. **`users`**:
   - `id` (UUID PK), `email` (Unique, Case-Insensitive), `password_hash`, `full_name`, `role` (`'investor' | 'entrepreneur' | 'admin'`), `phone`, `is_verified` (Boolean), `kyc_status` (`'unverified' | 'pending' | 'verified' | 'rejected'`), `created_at`, `updated_at`.
2. **`user_profiles`**:
   - `id` (UUID PK), `user_id` (FK to `users.id`, Unique), `bio`, `company_name`, `designation`, `country`, `accredited_investor` (Boolean), `net_worth_range`, `investment_thesis`, `sectors_of_interest` (Array/JSON), `total_invested`, `funding_raised`.
3. **`startups`**:
   - `id` (UUID PK), `founder_id` (FK to `users.id`), `name`, `tagline`, `description`, `sector`, `stage` (`'Idea' | 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B+'`), `headquarters`, `target_funding` (> 0), `raised_funding`, `proposed_equity` (0-100%), `pre_money_valuation`, `mrr`, `arr`, `burn_rate`, `runway_months`, `pitch_deck_url`, `problem_statement`, `solution_statement`, `business_model`, `status` (`'draft' | 'pending_approval' | 'approved' | 'rejected' | 'funded'`), `view_count`.
4. **`investment_interests`**:
   - `id` (UUID PK), `startup_id` (FK to `startups.id`), `investor_id` (FK to `users.id`), `proposed_amount`, `proposed_equity`, `strategic_value`, `message`, `status` (`'pending' | 'under_review' | 'accepted' | 'declined' | 'term_sheet_issued' | 'closed'`), `response_note`, `responded_at`. Unique constraint `(startup_id, investor_id)`.
5. **`saved_startups`**:
   - `id` (UUID PK), `user_id` (FK to `users.id`), `startup_id` (FK to `startups.id`), `notes`. Unique constraint `(user_id, startup_id)`.
6. **`kyc_verifications`**:
   - `id` (UUID PK), `user_id` (FK to `users.id`), `full_legal_name`, `document_type` (`'passport' | 'national_id' | 'driving_license' | 'tax_id' | 'incorporation_cert'`), `document_number`, `country_of_issuance`, `document_file_url`, `accredited_declaration`, `status` (`'pending' | 'approved' | 'rejected'`), `rejection_reason`, `reviewed_by`.
7. **`conversations` & `messages`**:
   - Normalized participant pairing `(participant1_id, participant2_id, startup_id)` with immutable, chronological message sequence and read receipt tracking.
8. **`notifications`**:
   - Inbound event delivery queue partitioned by `user_id` with `type` tags (`system`, `interest`, `kyc`, `startup`, `message`, `deal`).
9. **`audit_logs`**:
   - Tamper-evident transaction history capturing actor, action, resource type, metadata, timestamp, and IP address.

---

## 4. Scalability & High-Availability Roadmap

1. **Connection Pooling**: In PostgreSQL production, Supabase / PgBouncer handles up to 10,000 concurrent client connections with transaction-level pooling.
2. **Caching Strategy**: Redis / in-memory cache for public startup catalogues and aggregated metrics with 60-second TTL invalidation upon startup state changes.
3. **Storage Vault**: S3 / Supabase Storage with pre-signed upload URLs and automated virus/malware scanning on all uploaded PDFs and cap sheet documents.
4. **Compliance Ready**: Structured for SOC2 Type II, ISO 27001, and global DPDP/GDPR regulations.
