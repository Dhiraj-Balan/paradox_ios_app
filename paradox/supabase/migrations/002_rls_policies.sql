-- ==============================================================================
-- PARADOX — Where Vision Meets Capital
-- Supabase / PostgreSQL Database Migration 002: Row Level Security (RLS)
-- ==============================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 1. USERS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile or public cards"
    ON public.users FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. STARTUPS POLICIES
-- ------------------------------------------------------------------------------
-- Anyone authenticated can view approved startups (public catalogue)
CREATE POLICY "Public approved startups are viewable by all authenticated users"
    ON public.startups FOR SELECT
    USING (status = 'approved' OR founder_id = auth.uid() OR public.is_admin());

-- Entrepreneurs can create startups
CREATE POLICY "Entrepreneurs can submit startup proposals"
    ON public.startups FOR INSERT
    WITH CHECK (
        founder_id = auth.uid() AND 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'entrepreneur')
    );

-- Entrepreneurs can update their own startups while not locked/funded
CREATE POLICY "Entrepreneurs can update their own startups"
    ON public.startups FOR UPDATE
    USING (founder_id = auth.uid() OR public.is_admin())
    WITH CHECK (founder_id = auth.uid() OR public.is_admin());

-- Administrators can moderate (update/delete) any startup
CREATE POLICY "Admins can delete startups"
    ON public.startups FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. INVESTMENT INTERESTS POLICIES
-- ------------------------------------------------------------------------------
-- Investors can see interests they submitted; Founders can see interests submitted to their startups
CREATE POLICY "Users can view relevant investment interests"
    ON public.investment_interests FOR SELECT
    USING (
        investor_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.startups WHERE startups.id = investment_interests.startup_id AND startups.founder_id = auth.uid()) OR
        public.is_admin()
    );

-- Verified Investors can create investment interests
CREATE POLICY "Investors can express interest"
    ON public.investment_interests FOR INSERT
    WITH CHECK (
        investor_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'investor')
    );

-- Investors and Founders can update interest status (e.g. Accept / Decline)
CREATE POLICY "Participants can update investment interest status"
    ON public.investment_interests FOR UPDATE
    USING (
        investor_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.startups WHERE startups.id = investment_interests.startup_id AND startups.founder_id = auth.uid()) OR
        public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- 4. SAVED STARTUPS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can manage their own watchlist"
    ON public.saved_startups FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 5. KYC VERIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own KYC submissions"
    ON public.kyc_verifications FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can submit their own KYC"
    ON public.kyc_verifications FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Only admins can review/update KYC status"
    ON public.kyc_verifications FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. CONVERSATIONS & MESSAGES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Participants can view conversations"
    ON public.conversations FOR SELECT
    USING (participant1_id = auth.uid() OR participant2_id = auth.uid() OR public.is_admin());

CREATE POLICY "Participants can view messages"
    ON public.messages FOR SELECT
    USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY "Participants can send messages"
    ON public.messages FOR INSERT
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can mark messages as read"
    ON public.messages FOR UPDATE
    USING (recipient_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 7. NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can access their own notifications"
    ON public.notifications FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 8. AUDIT LOGS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Only admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());
