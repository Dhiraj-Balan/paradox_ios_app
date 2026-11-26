-- ==============================================================================
-- PARADOX — Where Vision Meets Capital
-- Supabase / PostgreSQL Database Migration 001: Initial Schema
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('investor', 'entrepreneur', 'admin')),
    phone VARCHAR(32),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    kyc_status VARCHAR(32) DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER PROFILES TABLE (Role-specific extended metadata)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bio TEXT,
    company_name VARCHAR(255),
    designation VARCHAR(128),
    country VARCHAR(100) DEFAULT 'India',
    accredited_investor BOOLEAN DEFAULT FALSE,
    net_worth_range VARCHAR(64),
    investment_thesis TEXT,
    sectors_of_interest TEXT[], -- Array of sectors e.g. ['Fintech', 'AI/ML', 'Healthtech']
    preferred_stages TEXT[],    -- e.g. ['Seed', 'Series A']
    min_ticket_size NUMERIC(15,2) DEFAULT 500000.00,
    max_ticket_size NUMERIC(15,2) DEFAULT 50000000.00,
    total_invested NUMERIC(15,2) DEFAULT 0.00,
    funding_raised NUMERIC(15,2) DEFAULT 0.00,
    website_url TEXT,
    linkedin_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STARTUPS TABLE (Business Proposals & Ventures)
CREATE TABLE IF NOT EXISTS public.startups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tagline VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    sector VARCHAR(64) NOT NULL,
    stage VARCHAR(32) NOT NULL CHECK (stage IN ('Idea', 'Pre-Seed', 'Seed', 'Series A', 'Series B+')),
    headquarters VARCHAR(128) NOT NULL,
    target_funding NUMERIC(15,2) NOT NULL CHECK (target_funding > 0),
    raised_funding NUMERIC(15,2) DEFAULT 0.00,
    proposed_equity NUMERIC(5,2) NOT NULL CHECK (proposed_equity >= 0 AND proposed_equity <= 100),
    pre_money_valuation NUMERIC(15,2) NOT NULL CHECK (pre_money_valuation >= 0),
    mrr NUMERIC(15,2) DEFAULT 0.00,
    arr NUMERIC(15,2) DEFAULT 0.00,
    burn_rate NUMERIC(15,2) DEFAULT 0.00,
    runway_months INTEGER DEFAULT 12,
    pitch_deck_url TEXT,
    financial_model_url TEXT,
    video_pitch_url TEXT,
    demo_url TEXT,
    problem_statement TEXT NOT NULL,
    solution_statement TEXT NOT NULL,
    business_model TEXT NOT NULL,
    traction_highlights TEXT,
    team_summary TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    status VARCHAR(32) DEFAULT 'pending_approval' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'funded')),
    admin_feedback TEXT,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INVESTMENT INTERESTS TABLE (Offers / Expressions of Interest)
CREATE TABLE IF NOT EXISTS public.investment_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    proposed_amount NUMERIC(15,2) NOT NULL CHECK (proposed_amount > 0),
    proposed_equity NUMERIC(5,2) CHECK (proposed_equity >= 0 AND proposed_equity <= 100),
    strategic_value TEXT,
    message TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'accepted', 'declined', 'term_sheet_issued', 'closed')),
    response_note TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_investor_startup_interest UNIQUE(startup_id, investor_id)
);

-- 5. SAVED STARTUPS (Watchlist / Bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_startups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_saved_startup UNIQUE (user_id, startup_id)
);

-- 6. KYC VERIFICATIONS TABLE (Global Identification Workflow)
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    full_legal_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(64) NOT NULL CHECK (document_type IN ('passport', 'national_id', 'driving_license', 'tax_id', 'incorporation_cert')),
    document_number VARCHAR(128) NOT NULL,
    country_of_issuance VARCHAR(100) NOT NULL,
    document_file_url TEXT NOT NULL,
    address_proof_url TEXT,
    accredited_declaration BOOLEAN DEFAULT TRUE,
    annual_income_range VARCHAR(64),
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CONVERSATIONS & MESSAGES (Secure Direct Negotiation)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startups(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_conversation_participants UNIQUE (participant1_id, participant2_id, startup_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('system', 'interest', 'kyc', 'startup', 'message', 'deal')),
    reference_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDIT LOGS TABLE (Compliance & Traceability)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_startups_founder_id ON public.startups(founder_id);
CREATE INDEX IF NOT EXISTS idx_startups_status ON public.startups(status);
CREATE INDEX IF NOT EXISTS idx_startups_sector ON public.startups(sector);
CREATE INDEX IF NOT EXISTS idx_startups_stage ON public.startups(stage);
CREATE INDEX IF NOT EXISTS idx_startups_target_funding ON public.startups(target_funding);
CREATE INDEX IF NOT EXISTS idx_interests_startup_id ON public.investment_interests(startup_id);
CREATE INDEX IF NOT EXISTS idx_interests_investor_id ON public.investment_interests(investor_id);
CREATE INDEX IF NOT EXISTS idx_saved_user_id ON public.saved_startups(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON public.kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read);
